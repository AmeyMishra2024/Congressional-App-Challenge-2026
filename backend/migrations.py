"""Numbered, transactional SQLite upgrades, including adoption of legacy databases."""
import hashlib
import json
import sqlite3
from datetime import datetime, timezone
from decimal import Decimal
from pathlib import Path
from sqlalchemy import insert, select
from .db import (metadata, schema_versions, datasets, market_sessions, prices, runs, fills,
                 orders, decision_events, tutorials)
from .scenario_data import SCENARIOS
from .accounting import open_account, record_fill, reconcile_all

LATEST_VERSION = 3
CORE_TABLES = {"families", "users", "policies", "sessions", "runs", "positions", "orders", "fills", "progress", "reflections", "goals", "watchlist", "events", "receipts", "login_attempts"}
V2_TABLES = {"datasets", "market_sessions", "prices", "ledger", "lesson_attempts", "decision_events"}

def backup_before_upgrade(engine):
    """SQLite backup API includes committed WAL data; never overwrite a prior backup."""
    if engine.url.database == ":memory:":
        return None
    path = Path(engine.url.database)
    if not path.is_file() or not path.stat().st_size:
        return None
    with sqlite3.connect(str(path)) as source:
        exists = source.execute("SELECT 1 FROM sqlite_master WHERE name='schema_versions'").fetchone()
        version = source.execute("SELECT COALESCE(MAX(version),0) FROM schema_versions").fetchone()[0] if exists else 0
        if version >= LATEST_VERSION:
            return None
        stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S%fZ")
        target = path.with_name(path.name + f".pre-v{LATEST_VERSION}-{stamp}.bak")
        with sqlite3.connect(str(target)) as destination:
            source.backup(destination)
        return str(target)

def seed_datasets(db):
    for s in SCENARIOS:
        if not (len(s["dates"]) == s["sessions"] == len(s["news"]) and s["dates"] == sorted(set(s["dates"]))):
            raise RuntimeError("Invalid scenario sessions.")
        if not all(len(series) == s["sessions"] and all(Decimal(p).is_finite() and Decimal(p) > 0 for p in series) for series in s["prices"].values()):
            raise RuntimeError("Invalid scenario prices.")
        checksum = hashlib.sha256(json.dumps(s, sort_keys=True, separators=(",", ":")).encode()).hexdigest()
        db.execute(insert(datasets).values(key=s["id"], scenario_id=s["id"], version=s["version"],
            title=s["title"], description=s["description"], focus=s["focus"], benchmark=s["benchmark"],
            session_count=s["sessions"], provenance=json.dumps(s["provenance"]), checksum=checksum))
        db.execute(insert(market_sessions), [{"dataset": s["id"], "session": i, "date": date, "news": s["news"][i]} for i, date in enumerate(s["dates"])])
        db.execute(insert(prices), [{"dataset": s["id"], "session": i, "ticker": ticker, "close": p} for ticker, series in s["prices"].items() for i, p in enumerate(series)])

def expand(db):
    seed_datasets(db)
    for r in db.execute(select(runs)).mappings():
        open_account(db, r)
    for f in db.execute(select(fills).order_by(fills.c.id)).mappings():
        record_fill(db, f)
    for order in db.execute(select(orders)).mappings():
        # Old databases retained only the final state. Never invent past review timestamps.
        db.execute(insert(decision_events).values(order_id=order["id"], actor_id=None, kind="imported_state",
            session=db.execute(select(runs.c.session).where(runs.c.id == order["run_id"])).scalar_one(), detail=json.dumps({"status": order["status"], "note": "State imported during database upgrade; earlier transitions were not recorded."}),
            created=datetime.now(timezone.utc).isoformat()))
    failures = [r for r in reconcile_all(db) if not r["ok"]]
    if failures:
        raise RuntimeError(f"Upgrade stopped: existing accounting does not reconcile: {failures}")
    db.exec_driver_sql("CREATE UNIQUE INDEX ux_active_run_scenario ON runs(child_id, mode, scenario) WHERE status='active'")
    db.exec_driver_sql("CREATE UNIQUE INDEX ux_ledger_opening ON ledger(run_id) WHERE kind='opening'")
    for name in ("datasets", "market_sessions", "prices", "ledger", "fills", "lesson_attempts", "decision_events"):
        for operation in ("UPDATE", "DELETE"):
            db.exec_driver_sql(f"CREATE TRIGGER immutable_{name}_{operation.lower()} BEFORE {operation} ON {name} BEGIN SELECT RAISE(ABORT, 'immutable record'); END")
    for operation in ("INSERT", "UPDATE OF scenario, session, mode"):
        suffix = "insert" if operation == "INSERT" else "update"
        db.exec_driver_sql(f"""CREATE TRIGGER run_dataset_{suffix} BEFORE {operation} ON runs
            WHEN NEW.mode NOT IN ('sandbox','replay') OR NEW.session < 0
              OR (NEW.mode='sandbox' AND (NEW.scenario != 'offline-sandbox' OR NEW.session != 0))
              OR (NEW.mode='replay' AND NOT EXISTS
                 (SELECT 1 FROM datasets WHERE key=NEW.scenario AND NEW.session < session_count))
            BEGIN SELECT RAISE(ABORT, 'invalid run dataset or session'); END""")
    db.exec_driver_sql("""CREATE TRIGGER run_identity_immutable BEFORE UPDATE OF child_id, mode, scenario, starting, created ON runs
        WHEN NEW.child_id != OLD.child_id OR NEW.mode != OLD.mode OR NEW.scenario != OLD.scenario
          OR NEW.starting != OLD.starting OR NEW.created != OLD.created
        BEGIN SELECT RAISE(ABORT, 'run identity is immutable'); END""")

def migrate(engine):
    backup = backup_before_upgrade(engine)
    with engine.connect() as db:
        db.exec_driver_sql("BEGIN IMMEDIATE")
        try:
            # Explicit transaction covers DDL, backfill and version records together.
            schema_versions.create(db, checkfirst=True)
            existing = list(db.execute(select(schema_versions.c.version).order_by(schema_versions.c.version)).scalars())
            if existing and existing != list(range(1, max(existing) + 1)):
                raise RuntimeError("Non-contiguous database migration history.")
            version = max(existing, default=0)
            if version > LATEST_VERSION:
                raise RuntimeError("Database is newer than this application. Upgrade the application.")
            if version < 1:
                metadata.create_all(db, tables=[t for t in metadata.sorted_tables if t.name in CORE_TABLES])
                db.execute(insert(schema_versions).values(version=1, applied=datetime.now(timezone.utc).isoformat()))
            if version < 2:
                metadata.create_all(db, tables=[t for t in metadata.sorted_tables if t.name in V2_TABLES])
                # create_all does not add indexes to pre-existing tables.
                for table in metadata.tables.values():
                    for index in table.indexes:
                        index.create(db, checkfirst=True)
                expand(db)
                db.execute(insert(schema_versions).values(version=2, applied=datetime.now(timezone.utc).isoformat()))
            if version < 3:
                tutorials.create(db, checkfirst=True)
                db.execute(insert(schema_versions).values(version=3, applied=datetime.now(timezone.utc).isoformat()))
            if db.exec_driver_sql("PRAGMA foreign_key_check").fetchall():
                raise RuntimeError("Database contains invalid foreign keys.")
            db.commit()
        except Exception:
            db.rollback()
            raise
    return backup
