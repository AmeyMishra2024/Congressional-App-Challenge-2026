import sqlite3
from contextlib import closing

import pytest

from backend.app import create_app
from render_start import backup_database, server_options
from waitress.proxy_headers import proxy_headers_middleware


def test_backup_restores_committed_wal_data_and_retains_recent_snapshots(tmp_path):
    database = tmp_path / 'live.db'
    backups = tmp_path / 'backups'
    with sqlite3.connect(database) as live:
        live.execute('PRAGMA journal_mode=WAL')
        live.execute('CREATE TABLE account (name TEXT, balance INTEGER)')
        live.execute("INSERT INTO account VALUES ('family', 100000)")
        live.commit()
        for value in (99000, 98000, 97000):
            live.execute('UPDATE account SET balance = ?', (value,))
            live.commit()
            snapshot = backup_database(database, backups, keep=2)
            with closing(sqlite3.connect(snapshot)) as restored:
                assert restored.execute('SELECT balance FROM account').fetchone()[0] == value
                assert restored.execute('PRAGMA integrity_check').fetchone()[0] == 'ok'
        assert len(list(backups.glob('sprout-*.sqlite3'))) == 2


def test_missing_database_does_not_create_empty_backup_or_remove_existing(tmp_path):
    backups = tmp_path / 'backups'
    backups.mkdir()
    previous = backups / 'sprout-previous.sqlite3'
    previous.write_bytes(b'preserved')
    with pytest.raises(sqlite3.OperationalError):
        backup_database(tmp_path / 'missing.db', backups, keep=1)
    assert previous.read_bytes() == b'preserved'
    assert not (tmp_path / 'missing.db').exists()


def test_waitress_proxy_headers_allow_our_https_origin_and_reject_other_origins(tmp_path, monkeypatch):
    monkeypatch.setenv('APP_ENV', 'production')
    monkeypatch.setenv('SECRET_KEY', 'x' * 64)
    monkeypatch.setenv('SESSION_COOKIE_SECURE', 'true')
    monkeypatch.setenv('TRUST_PROXY', 'true')
    monkeypatch.setenv('TRUSTED_HOSTS', 'sproutcac-app.onrender.com')
    app = create_app({'DATABASE_URL': 'sqlite:///' + (tmp_path / 'production.db').as_posix()})
    options = server_options()
    app.wsgi_app = proxy_headers_middleware(app.wsgi_app,
        trusted_proxy=options['trusted_proxy'], trusted_proxy_count=options['trusted_proxy_count'],
        trusted_proxy_headers=options['trusted_proxy_headers'],
        clear_untrusted=options['clear_untrusted_proxy_headers'])
    client = app.test_client()
    origin = 'https://sproutcac-app.onrender.com'
    forwarded = {'X-Forwarded-Proto': 'https', 'X-Forwarded-Host': 'sproutcac-app.onrender.com',
                 'X-Forwarded-For': '192.0.2.10'}
    session = client.get('/api/session', base_url=origin, headers=forwarded).get_json()
    response = client.post('/api/logout', base_url=origin, json={},
        headers={**forwarded, 'Origin': origin, 'X-CSRF-Token': session['csrf']})
    assert response.status_code == 200
    session = response.get_json()
    response = client.post('/api/logout', base_url=origin, json={},
        headers={**forwarded, 'Origin': 'https://untrusted.example', 'X-CSRF-Token': session['csrf']})
    assert response.status_code == 403
    assert client.get('/api/health', base_url=origin,
        headers={**forwarded, 'X-Forwarded-Host': 'untrusted.example'}).status_code == 400
    app.extensions['db'].dispose()
