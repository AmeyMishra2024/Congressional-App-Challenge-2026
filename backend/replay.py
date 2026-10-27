"""Database-backed, version-pinned replay market. Queries never load future observations."""
import json
from decimal import Decimal
from sqlalchemy import select
from .db import datasets, market_sessions, prices

DEFAULT_DATASET = "changing-market"

def scenario_catalog(db):
    return [scenario_view(row) for row in db.execute(select(datasets).order_by(datasets.c.version, datasets.c.key)).mappings()]

def scenario_view(row):
    return {"id": row["key"], "title": row["title"], "description": row["description"],
            "focus": row["focus"], "sessions": row["session_count"], "benchmark": row["benchmark"],
            "version": row["version"], "checksum": row["checksum"], "provenance": json.loads(row["provenance"])}

class ReplayMarket:
    def __init__(self, db, run):
        key = run["scenario"] if run["mode"] == "replay" else DEFAULT_DATASET
        row = db.execute(select(datasets).where(datasets.c.key == key)).mappings().one()
        self.scenario = scenario_view(row)
        self.session = run["session"] if run["mode"] == "replay" else 0
        self.observations = {r["session"]: dict(r) for r in db.execute(select(market_sessions).where(
            market_sessions.c.dataset == key, market_sessions.c.session <= self.session).order_by(market_sessions.c.session)).mappings()}
        self.closes = {(r["ticker"], r["session"]): Decimal(r["close"]) for r in db.execute(select(prices).where(
            prices.c.dataset == key, prices.c.session <= self.session)).mappings()}

    def close(self, ticker, session=None):
        return self.closes[(ticker, self.session if session is None else session)]

    @property
    def date(self):
        return self.observations[self.session]["date"]

    @property
    def ended(self):
        return self.session == self.scenario["sessions"] - 1
