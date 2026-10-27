"""Render entry point for the full app, durable SQLite and daily online backups."""
import logging
from contextlib import closing
import os
from pathlib import Path
import sqlite3
import threading
import time
from datetime import datetime, timezone

from backend.app import create_app
from waitress import serve


def backup_database(database, directory, keep=7):
    """Include committed WAL writes and verify a snapshot before rotating backups."""
    database, directory = Path(database).resolve(), Path(directory).resolve()
    directory.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S%fZ')
    destination = directory / f'sprout-{stamp}.sqlite3'
    temporary = destination.with_suffix('.partial')
    with closing(sqlite3.connect(database.as_uri() + '?mode=ro', uri=True, timeout=30)) as source:
        with closing(sqlite3.connect(temporary, timeout=30)) as target:
            source.backup(target, pages=128, sleep=0.1)
            if target.execute('PRAGMA integrity_check').fetchone()[0] != 'ok':
                raise RuntimeError('Backup integrity check failed')
    temporary.replace(destination)
    snapshots = sorted(directory.glob('sprout-*.sqlite3'))
    for expired in snapshots[:-keep]:
        expired.unlink()
    return destination


def backup_loop(database, directory):
    while True:
        try:
            backup_database(database, directory)
            logging.info('Daily SQLite backup completed')
        except Exception:
            logging.exception('Daily SQLite backup failed')
        time.sleep(86400)


def server_options():
    # Render's public edge is the only route to this service's listening port.
    # Waitress must retain/sanitize these before Flask's ProxyFix can use them.
    return dict(host='0.0.0.0', port=int(os.environ.get('PORT', '10000')), threads=4,
                trusted_proxy='*', trusted_proxy_count=1,
                trusted_proxy_headers={'x-forwarded-for', 'x-forwarded-proto', 'x-forwarded-host'},
                clear_untrusted_proxy_headers=True)


def main():
    # This mount must be supplied by Render, rather than created on ephemeral storage.
    data = Path('/var/data')
    if not data.is_dir():
        raise RuntimeError('Attach the persistent disk at /var/data before starting')
    if os.getenv('DATABASE_URL') != 'sqlite:////var/data/sprout.db':
        raise RuntimeError('Configure DATABASE_URL to use the persistent disk')
    hostname = os.getenv('RENDER_EXTERNAL_HOSTNAME', '')
    if hostname:
        if not hostname.endswith('.onrender.com') or '/' in hostname or ':' in hostname:
            raise RuntimeError('Unexpected Render hostname')
        hosts = [h.strip() for h in os.getenv('TRUSTED_HOSTS', '').split(',') if h.strip()]
        os.environ['TRUSTED_HOSTS'] = ','.join(dict.fromkeys([*hosts, hostname]))
    app = create_app()
    threading.Thread(target=backup_loop, args=(data / 'sprout.db', data / 'backups'),
                     name='sqlite-backups', daemon=True).start()
    serve(app, **server_options())


if __name__ == '__main__':
    logging.basicConfig(level=logging.INFO)
    main()
