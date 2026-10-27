import sqlite3
from contextlib import closing

import pytest

from render_start import backup_database


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
