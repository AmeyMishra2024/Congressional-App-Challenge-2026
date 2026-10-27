# Render deployment notes

This release contains the full Flask account server and a production React build. It is separate from the frozen browser-only public preview. No real account database, credentials or payment information are included.

## Render service configuration

- Source: `AmeyMishra2024/Congressional-App-Challenge-2026`, branch `render-production`.
- Service type: Web Service; runtime: Python 3; region: Oregon.
- Name: `sproutcac-app`.
- Instance: the $7/month, 512 MB paid compute option.
- Build command: `pip install -r backend/requirements.txt`.
- Start command: `python render_start.py`.
- Health check: `/api/health`.
- Persistent disk: 1 GB mounted at `/var/data`, currently $0.25/month.
- Automatic deploys: Off, until future release policy is chosen.

Environment variables:

| Key | Value |
| --- | --- |
| APP_ENV | production |
| SECRET_KEY | Generate a private random value in Render; never put it in Git |
| SESSION_COOKIE_SECURE | true |
| DATABASE_URL | sqlite:////var/data/sprout.db |
| TRUSTED_HOSTS | sproutcac.com,www.sproutcac.com |
| TRUST_PROXY | true |
| ENABLE_LIVE_MARKET | false |

The startup script adds only Render's assigned `RENDER_EXTERNAL_HOSTNAME` to the trusted hosts. It refuses to start without the configured disk directory and database location. Waitress serves both the frontend and `/api` from the same origin, preserving session cookies and CSRF checks. Its proxy configuration trusts the single Render edge hop, sanitizes the allowed forwarded headers and removes other proxy headers. This entry point assumes the listening port is reachable only through Render's edge. Python is pinned to the latest 3.13 patch with `.python-version`.

The frontend is already built in `frontend/dist`; the deployment does not need Node. To reproduce it, run `npm ci` and `npm run build` in `frontend`, then commit the generated production build with its source.

## Database backups

After database initialization, the service creates a verified SQLite online backup immediately and every 24 hours in `/var/data/backups`, retaining the most recent seven snapshots. The online backup API includes committed WAL changes. These copies survive restarts on the same persistent disk, but do not protect against loss of that disk. Download a backup to separate storage regularly and test restoration before accepting important account data. Startup schema migrations also retain their own pre-upgrade backup.

## Deployment and domain handoff

Billing and service creation require the owner's review. This repository does not mean the paid service is live. Create and verify the new service on its assigned Render hostname before moving sproutcac.com from the static preview. Keep the existing ChatGPT Sites version 8 and `sproutcac-preview.onrender.com` deployment intact.

When ready to move the custom domain, transfer its domain attachment to the verified full-app service and change only the root ALIAS and www CNAME targets. The same-origin application must be served by the Flask service; the old static preview uses a browser-local adapter and cannot enable accounts by receiving an API URL.

The application remains an educational prototype. Account recovery and email verification are not implemented. The stored currency and trade records are virtual practice data. See `docs/DEPLOYMENT.md` and `docs/DATABASE.md` for operational and storage details.
