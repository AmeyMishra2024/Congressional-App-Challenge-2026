# Sprout: Investing Practice

**Live app: https://sproutcac.com** · Congressional App Challenge 2026

Sprout teaches young people how investing works using a practice account and made-up market data, with a parent involved in the decisions. No real money, bank details or school information are ever used.

## Try it in 30 seconds

1. Open https://sproutcac.com
2. Choose **Try a demonstration**, then **Start judge demo**. No sign-up or password is needed, and each demo gets its own fictional family.
3. Use **Switch to parent** and **Switch to child** to see both sides of the app.

## The problem

Most teens hear about investing from social media, with no safe place to practice and no one to talk through decisions with. Sprout gives them a low-stakes place to learn the basics, make choices, explain their reasoning, and review the results with a parent.

## What it does

- **Family accounts.** A parent creates a family and adds a child profile with a nickname and PIN.
- **Six short lessons:** stocks and ownership, risk and returns, diversification, time horizons and compounding, reading price charts, and explaining investment decisions.
- **Practice account.** Buy and sell with virtual cash, including fractional shares.
- **Parent controls.** Parents set limits, pause trading, and approve or decline a child's proposed trades.
- **Market replay.** Step through 12 market sessions where new information arrives over time, and compare your results with a benchmark (VTI).
- **Reflections.** The child writes why they made each decision, and parents can review their learning.
- **Resets.** Start over at any time. Old runs are archived, not erased.

## Honest limitations

- Replay prices are **synthetic and illustrative**, not real market data. Live market data is off by default.
- It is an educational prototype. Email verification and account recovery are not implemented.
- Positions are long-only: no leverage, shorting or real brokerage connections.

## How it is built

React (Vite, Recharts) front end served by a Flask API with SQLAlchemy and SQLite, hosted on Render behind Waitress.

- Passwords and child PINs are hashed with scrypt. Sessions use HttpOnly cookies, CSRF tokens and login rate limits.
- Money is stored and calculated as exact decimals, not floating point. Every trade is posted atomically with a ledger entry and receipt, and retried requests cannot execute twice.
- Quotes are signed and expire, so a parent approval can't use a stale price.
- The database is backed up daily on a persistent disk.

More detail: [Architecture](docs/ARCHITECTURE.md) · [Database](docs/DATABASE.md) · [Data and content](docs/DATA_AND_CONTENT.md) · [Deployment](docs/DEPLOYMENT.md) · [Render setup](docs/RENDER_SETUP.md)

## Run it locally

```bash
python -m venv .venv
.venv/bin/pip install -r backend/requirements.txt   # Windows: .venv\Scripts\pip
python -m backend.app
```

Then open http://127.0.0.1:5000. The production front-end build is already in `frontend/dist`.

## Author

Amey Mishra
