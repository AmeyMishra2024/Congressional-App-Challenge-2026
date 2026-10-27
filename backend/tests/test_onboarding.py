"""Guidance persistence must never bypass family authorization or alter money."""
import sqlite3
from sqlalchemy import select
from backend.app import create_app
from backend.db import schema_versions
from backend.tests.test_app import Client, app, family  # pytest fixtures shared with integration suite


def test_tutorial_skip_resume_complete_replay_and_retry(family):
    c = family
    path = f'/children/{c.cid}/tutorial'
    assert c.get(path)['status'] == 'not_started'
    c.send(path, {'status': 'skipped', 'step': 0, 'expected_revision': 0}, 'PUT', status=403)
    c.switch('child')
    before = c.get(f'/runs/{c.rid}')
    body = {'status': 'in_progress', 'step': 1, 'expected_revision': 0}
    first = c.send(path, body, 'PUT', key='tutorial-retry-1')
    assert c.send(path, body, 'PUT', key='tutorial-retry-1') == first
    c.send(path, body, 'PUT', status=409)
    c.send(path, {'status': 'skipped', 'step': 1, 'expected_revision': 1}, 'PUT')
    assert c.get(path)['step'] == 1
    c.send(path, {'status': 'in_progress', 'step': 1, 'expected_revision': 2}, 'PUT')
    c.send(path, {'status': 'completed', 'step': 6, 'expected_revision': 3}, 'PUT')
    c.switch('parent')
    c.switch('child')
    assert c.get(path)['status'] == 'completed'
    c.send(path, {'status': 'in_progress', 'step': 0, 'expected_revision': 4}, 'PUT')
    assert c.get(f'/runs/{c.rid}') == before
    assert c.get(f'/children/{c.cid}/progress') == []


def test_tutorial_scope_and_invalid_states(app, family):
    c = family
    sibling = c.send('/children', {'name': 'Other-child', 'pin': '246810', 'starting': '1000'})['id']
    outsider = Client(app).demo()
    outsider.get(f'/children/{c.cid}/tutorial', status=404)
    c.switch('child')
    c.get(f'/children/{sibling}/tutorial', status=404)
    c.send(f'/children/{sibling}/tutorial', {'status': 'skipped', 'step': 0, 'expected_revision': 0}, 'PUT', status=404)
    for body in [dict(status='completed', step=0), dict(status='skipped', step=6), dict(status='in_progress', step=-1), dict(status='made_up', step=0), dict(status='in_progress', step=True)]:
        c.send(f'/children/{c.cid}/tutorial', dict(expected_revision=0, **body), 'PUT', status=400)


def test_completed_tutorial_survives_application_restart(app, family):
    c = family
    c.switch('child')
    path = f'/api/children/{c.cid}/tutorial'
    c.send(f'/children/{c.cid}/tutorial', {'status': 'completed', 'step': 6, 'expected_revision': 0}, 'PUT')
    cookie = c.client.get_cookie('sprout_session').value
    app.extensions['db'].dispose()
    restarted = create_app({'TESTING': True, 'SECRET_KEY': 'test-secret-not-production', 'DATABASE_URL': app.config['DATABASE_URL']})
    browser = restarted.test_client()
    browser.set_cookie('sprout_session', cookie)
    saved = browser.get(path).get_json()
    assert saved['status'] == 'completed' and saved['step'] == 6 and saved['revision'] == 1
    assert restarted.extensions['migration_backup'] is None
    restarted.extensions['db'].dispose()


def test_version_two_upgrade_preserves_existing_data_and_backup(app, family, tmp_path):
    c = family
    c.switch('child')
    c.send('/lessons/ownership/complete', {'answer': 1, 'exercise': '2'})
    before = c.get(f'/runs/{c.rid}')
    cookie = c.client.get_cookie('sprout_session').value
    path = tmp_path / 'version-two.db'
    # A real v2 database has all v2 records but no v3 guidance table/version.
    with sqlite3.connect(app.extensions['db'].url.database) as source, sqlite3.connect(path) as target:
        source.backup(target)
        target.execute('DROP TABLE tutorials')
        target.execute('DELETE FROM schema_versions WHERE version=3')
    upgraded = create_app({'TESTING': True, 'SECRET_KEY': 'test-secret-not-production', 'DATABASE_URL': 'sqlite:///' + path.as_posix()})
    browser = upgraded.test_client()
    browser.set_cookie('sprout_session', cookie)
    assert browser.get(f'/api/runs/{c.rid}').get_json() == before
    assert browser.get(f'/api/children/{c.cid}/progress').get_json()[0]['completed'] == 1
    assert browser.get(f'/api/children/{c.cid}/tutorial').get_json()['revision'] == 0
    with sqlite3.connect(upgraded.extensions['migration_backup']) as backup:
        assert backup.execute('SELECT max(version) FROM schema_versions').fetchone()[0] == 2
        assert backup.execute('SELECT count(*) FROM progress').fetchone()[0] == 1
    with upgraded.extensions['db'].connect() as db:
        assert list(db.execute(select(schema_versions.c.version).order_by(schema_versions.c.version)).scalars()) == [1, 2, 3]
    upgraded.extensions['db'].dispose()
