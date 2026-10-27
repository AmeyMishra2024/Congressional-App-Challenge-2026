# Prepare a one-origin deployment (not deployed)

The production entry point is `backend.wsgi:app` served by Waitress. Flask serves `frontend/dist` alongside `/api`. The Dockerfile builds the React application and runs as an unprivileged user. The Compose configuration binds to loopback and attaches a named persistent volume at `/data`. Do not run production SQLite in a disposable container layer or an ephemeral hosting filesystem.

## Environment

- `APP_ENV=production`
- `SECRET_KEY`: generated private value; keep outside Git and images. Generate with `python -c "import secrets; print(secrets.token_hex(32))"` in your own terminal.
- `SESSION_COOKIE_SECURE=true`; serve HTTPS through a trusted reverse proxy.
- `DATABASE_URL=sqlite:////data/sprout.db` on the mounted durable disk.
- `TRUSTED_HOSTS=your-app.example` (comma-separated allowed host names).
- `TRUST_PROXY=true` **only** when exactly one trusted front proxy sets and sanitizes X-Forwarded-For, X-Forwarded-Proto and X-Forwarded-Host. Keep Waitress inaccessible directly. Without a proxy, leave false and use the actual request origin.
- `ENABLE_LIVE_MARKET=false` until external data-use rights and terms are reviewed.
- Optional editable `APP_NAME=Sprout`.

Production refuses to start without a secret, HTTPS-cookie configuration or allowed hosts. Errors returned to the browser are safe; stack traces remain server-side. CSRF accepts only the actual origin. There is no permissive CORS. Protect proxy logs and runtime data as account information.

## Commands

From the repository root, after building the frontend and installing backend requirements:

```sh
python -m waitress --listen=127.0.0.1:8080 backend.wsgi:app
```

With Docker installed and the environment supplied:

```sh
docker compose build
docker compose up -d
```

These configuration files were prepared but no container image or external deployment was run in this task. Configure TLS/proxy access before presenting a production URL. `/api/health` is unauthenticated and reports backend readiness, not frontend build readiness.

## Durable data and backup

Use one application host with a persistent local disk. Keep the database, its WAL files, and development secret (if using development) outside the image lifecycle. Use SQLite's online backup API or stop writes and back up the database consistently; copying only the main file while WAL writes are active can omit committed data. Protect the backup and secret, test restoration, and keep the same production secret when restarting so pending quotes remain verifiable. Never delete the named Docker volume as a routine upgrade.

The current implementation deliberately supports only SQLite; a managed PostgreSQL deployment requires a migration that replaces decimal-string storage and SQLite-specific transaction locking with validated PostgreSQL types/row locks and re-runs concurrency tests. Do not merely swap the database URL. For horizontal scale, complete that migration before running multiple hosts against shared storage.

Before a public launch, review account recovery, content/privacy requirements, migrations, demo cleanup and abuse monitoring. This release is a supervised educational prototype; deployment preparation is not a claim of operational readiness for a public service.

Schema upgrades now run transactionally on startup and create an adjacent backup before changing an existing database. Allow durable disk capacity for that backup, protect it with the database, and run `python -m backend.manage check-db` as a maintenance verification step. Concurrent starts serialize migration application. [Database upgrade and recovery details](DATABASE.md) describe forward-only migration behavior and restoration. The prepared GitHub Actions checks do not deploy the app.
