"""Persistence, migration rollback, accounting invariants and multiple-scenario integration."""
from concurrent.futures import ThreadPoolExecutor
from decimal import Decimal
import sqlite3
import uuid
import pytest
from sqlalchemy import create_engine, insert, select, update
from sqlalchemy.exc import IntegrityError
from backend.tests.test_app import app, family, Client
from backend.app import create_app
from backend.db import metadata, runs, positions, orders, fills, ledger, lesson_attempts, datasets, prices, schema_versions
from backend.accounting import reconcile_all

def test_public_preview_fixtures_match_reviewed_backend_content():
    import json
    from pathlib import Path
    from backend.content import ASSETS, LESSONS, GLOSSARY
    from backend.scenario_data import SCENARIOS
    preview = json.loads((Path(__file__).resolve().parents[2] / "frontend/src/preview/fixtures.json").read_text(encoding="utf-8"))
    assert preview == {"assets": ASSETS, "lessons": LESSONS, "glossary": GLOSSARY, "scenarios": SCENARIOS}

LEGACY = {"families", "users", "policies", "sessions", "runs", "positions", "orders", "fills", "progress", "reflections", "goals", "watchlist", "events", "receipts", "login_attempts"}

def legacy_copy(app, path):
    """Build the previous relational schema and copy real persisted records, without new tables."""
    engine = create_engine("sqlite:///" + path.as_posix())
    original = [t for t in metadata.sorted_tables if t.name in LEGACY]
    metadata.create_all(engine, tables=original)
    with app.extensions["db"].connect() as source, engine.begin() as target:
        for table in original:
            records = [dict(r) for r in source.execute(select(table)).mappings()]
            if records:
                target.execute(insert(table), records)
    engine.dispose()
    return {"TESTING": True, "SECRET_KEY": "test-secret-not-production", "DATABASE_URL": "sqlite:///" + path.as_posix()}

def test_legacy_upgrade_retains_balances_sessions_and_learning(app, family, tmp_path):
    c = family
    c.policy(approval=False)
    c.switch("child")
    c.replay()
    c.buy("100", ticker="BND")
    c.send(f"/runs/{c.rid}/advance", {"expected_session": 0})
    c.buy("20", ticker="BND", side="sell")
    c.send("/lessons/ownership/complete", {"answer": 1, "exercise": "2"})
    before = c.get(f"/runs/{c.rid}")
    cookie = c.client.get_cookie("sprout_session").value
    upgraded = create_app(legacy_copy(app, tmp_path / "legacy.db"))
    browser = upgraded.test_client()
    browser.set_cookie("sprout_session", cookie)
    assert browser.get(f"/api/runs/{c.rid}").get_json() == before
    journal = browser.get(f"/api/runs/{c.rid}/journal").get_json()
    assert journal["reconciliation"]["ok"] and len(journal["entries"]) == 3
    assert all(e["kind"] == "imported_state" for e in journal["decisions"])
    learning = browser.get(f"/api/children/{c.cid}/learning").get_json()
    assert learning["completed"] == 1 and learning["unrecorded_legacy_attempts"] == 1
    assert learning["recent_attempts"] == []  # Old attempts were overwritten; never invent them.
    backup = upgraded.extensions["migration_backup"]
    with sqlite3.connect(backup) as db:
        assert db.execute("SELECT count(*) FROM fills").fetchone()[0] == 2
        assert not db.execute("SELECT name FROM sqlite_master WHERE name='ledger'").fetchone()
    upgraded.extensions["db"].dispose()
    restarted = create_app({"TESTING": True, "SECRET_KEY": "test-secret-not-production", "DATABASE_URL": "sqlite:///" + (tmp_path / "legacy.db").as_posix()})
    assert restarted.extensions["migration_backup"] is None
    with restarted.extensions["db"].connect() as db:
        assert list(db.execute(select(schema_versions.c.version).order_by(schema_versions.c.version)).scalars()) == [1, 2, 3]
        assert all(r["ok"] for r in reconcile_all(db))
    restarted.extensions["db"].dispose()

def test_upgrade_rolls_back_if_existing_balances_are_inconsistent(app, family, tmp_path):
    config = legacy_copy(app, tmp_path / "broken.db")
    with sqlite3.connect(tmp_path / "broken.db") as db:
        db.execute("UPDATE runs SET cash='999.00'")
    with pytest.raises(RuntimeError, match="does not reconcile"):
        create_app(config)
    with sqlite3.connect(tmp_path / "broken.db") as db:
        assert db.execute("SELECT cash FROM runs").fetchone()[0] == "999.00"
        assert not db.execute("SELECT name FROM sqlite_master WHERE name='ledger'").fetchone()
        assert not db.execute("SELECT name FROM sqlite_master WHERE name='schema_versions'").fetchone()

def test_multiple_scenarios_have_separate_clocks_and_share_daily_gross_limit(family):
    c = family
    c.policy(approval=False)
    c.switch("child")
    catalog = c.get("/scenarios")
    assert [s["sessions"] for s in catalog] == [12, 12, 8]
    c.replay()
    first = c.rid
    c.buy("200")
    c.rid = c.send("/runs", {"mode": "replay", "scenario": "different-paths"})["run_id"]
    second = c.rid
    assert second != first
    assert c.get(f"/runs/{second}")["daily_spent"] == "200.00"
    c.buy("101", status=409)
    c.buy("100")
    c.send(f"/runs/{second}/advance", {"expected_session": 0})
    assert c.get(f"/runs/{first}")["run"]["session"] == 0
    market = c.get(f"/runs/{second}/market")
    assert next(a for a in market["assets"] if a["ticker"] == "AAPL")["quote"]["price"] == "108.00"
    assert len(market["assets"][0]["history"]) == 2
    assert c.send("/runs", {"mode": "replay", "scenario": "different-paths"})["run_id"] == second

@pytest.mark.parametrize("scenario,count", [("changing-market", 12), ("different-paths", 12), ("shared-headwinds", 8)])
def test_scenario_future_boundaries_dynamic_end_and_reset(family, scenario, count):
    c = family
    c.switch("child")
    c.rid = c.send("/runs", {"mode": "replay", "scenario": scenario})["run_id"]
    c.get(f"/runs/{c.rid}/market?session=1", status=403)
    analysis = c.get(f"/runs/{c.rid}/analysis")
    assert len(analysis["history"]) == 1
    assert analysis["history"][0]["date"] == "2025-03-03"
    for i in range(count - 1):
        c.send(f"/runs/{c.rid}/advance", {"expected_session": i})
    p = c.get(f"/runs/{c.rid}")
    assert p["ended"] and p["scenario"]["sessions"] == count
    c.buy(status=409)
    c.send(f"/runs/{c.rid}/advance", {"expected_session": count - 1}, status=409)
    c.switch("parent")
    c.rid = c.send(f"/runs/{c.rid}/reset", {"reason": "Review a different decision process"})["run_id"]
    assert c.get(f"/runs/{c.rid}")["run"]["scenario"] == scenario
    assert c.get(f"/runs/{c.rid}/journal")["reconciliation"]["ok"]

def test_analysis_reconstructs_cash_sales_benchmark_and_drawdown(family):
    c = family
    c.policy(approval=False, per_order="1000", daily="1000")
    c.switch("child")
    c.replay()
    c.buy("1000")
    for i in range(4):
        c.send(f"/runs/{c.rid}/advance", {"expected_session": i})
    c.buy("93", side="sell")  # Sell one share with $100 of basis at the $93 close.
    a = c.get(f"/runs/{c.rid}/analysis")
    assert [h["total"] for h in a["history"]] == ["1000.00", "1010.00", "1000.00", "960.00", "930.00"]
    assert a["history"][-1]["cash"] == "93.00"
    assert a["realized_gain"] == "-7.00" and a["unrealized_gain"] == "-63.00"
    assert a["max_drawdown_pct"] == "7.92"
    assert a["cash_pct"] == "10.00" and a["largest_holding_pct"] == "90.00"
    assert a["history"][-1]["benchmark"] == "930.00"
    p = c.get(f"/runs/{c.rid}")
    assert a["history"][-1]["total"] == p["total"]
    assert Decimal(a["realized_gain"]) + Decimal(a["unrealized_gain"]) == Decimal(p["gain"])
    assert c.get(f"/runs/{c.rid}/journal")["reconciliation"]["ok"]

def test_retry_does_not_duplicate_attempt_or_decision_history(family):
    c = family
    c.switch("child")
    key = str(uuid.uuid4())
    payload = {"answer": 0, "exercise": "1"}
    c.send("/lessons/ownership/complete", payload, key=key)
    c.send("/lessons/ownership/complete", payload, key=key)
    c.send("/lessons/ownership/complete", {"answer": 1, "exercise": "2"})
    learning = c.get(f"/children/{c.cid}/learning")
    assert len(learning["recent_attempts"]) == 2
    assert learning["lessons"][0]["attempts"] == 2
    assert learning["lessons"][0]["quiz_correct"] == 1
    key = str(uuid.uuid4())
    quote = c.quote()
    order = c.buy(key=key, quote=quote)
    c.buy(key=key, quote=quote)
    c.switch("parent")
    c.send(f"/orders/{order['id']}/review", {"action": "approve", "review": "We reviewed uncertainty together."})
    c.send(f"/orders/{order['id']}/review", {"action": "approve", "review": "We reviewed uncertainty together."})
    journal = c.get(f"/runs/{c.rid}/journal")
    assert [e["kind"] for e in journal["decisions"]] == ["proposed", "approved", "filled"]
    assert len(journal["entries"]) == 2

def test_new_records_are_immutable_and_accounting_drift_blocks_execution(app, family):
    c = family
    c.policy(approval=False)
    c.switch("child")
    c.buy()
    for table in (ledger, fills, datasets, prices):
        with pytest.raises(IntegrityError), app.extensions["db"].begin() as db:
            db.execute(table.delete())
    with app.extensions["db"].begin() as db:
        db.execute(update(runs).where(runs.c.id == c.rid).values(cash="899.00"))
    result = c.buy("10", status=409)
    assert result["code"] == "accounting_mismatch"
    assert len(c.get(f"/runs/{c.rid}")["fills"]) == 1
    assert not c.get(f"/runs/{c.rid}/journal")["reconciliation"]["ok"]

def test_analysis_learning_journal_and_child_wide_review_enforce_ownership(app, family):
    other = Client(app).demo()
    for path in (f"/runs/{family.rid}/analysis", f"/runs/{family.rid}/journal", f"/runs/{family.rid}/report", f"/children/{family.cid}/learning"):
        other.get(path, status=404)
    family.switch("child")
    family.get(f"/children/{family.cid}/review", status=403)

def test_report_is_consistent_contains_only_visible_data_and_no_execution_tokens(family):
    c = family
    c.policy(approval=False)
    c.switch("child")
    c.replay()
    c.buy()
    c.send(f"/runs/{c.rid}/advance", {"expected_session": 0})
    report = c.get(f"/runs/{c.rid}/report")
    assert report["money_type"] == "virtual" and report["report_version"] == 1
    assert len(report["visible_market"]) == len(report["analysis"]["history"]) == 2
    assert report["portfolio"]["total"] == report["analysis"]["history"][-1]["total"]
    assert report["portfolio"]["run"]["cash"] == report["reconciliation"]["cash"]
    assert all("quote" not in order for order in report["portfolio"]["orders"])
    assert report["reconciliation"]["ok"]

def test_parent_review_includes_pending_proposals_in_every_child_run(family):
    c = family
    c.switch("child")
    c.buy("50")
    c.replay()
    c.buy("50")
    c.rid = c.send("/runs", {"mode": "replay", "scenario": "shared-headwinds"})["run_id"]
    c.buy("50", ticker="BND")
    c.switch("parent")
    review = c.get(f"/children/{c.cid}/review")
    assert len(review["orders"]) == 3
    assert len({o["run_id"] for o in review["orders"]}) == 3
    assert {o["run_title"] for o in review["orders"]} == {"Offline sandbox", "A changing market", "Shared headwinds"}

def test_concurrent_startup_applies_each_migration_once(app, tmp_path):
    config = legacy_copy(app, tmp_path / "startup.db")
    def startup(_):
        application = create_app(config)
        with application.extensions["db"].connect() as db:
            versions = list(db.execute(select(schema_versions.c.version).order_by(schema_versions.c.version)).scalars())
        application.extensions["db"].dispose()
        return versions
    with ThreadPoolExecutor(max_workers=2) as pool:
        assert list(pool.map(startup, range(2))) == [[1, 2, 3], [1, 2, 3]]

def test_concurrent_approvals_append_one_accounting_entry(app, family):
    c = family
    c.switch("child")
    order = c.buy()
    c.switch("parent")
    cookie, csrf = c.client.get_cookie("sprout_session").value, c.session["csrf"]
    def approve(_):
        browser = app.test_client()
        browser.set_cookie("sprout_session", cookie)
        return browser.post(f"/api/orders/{order['id']}/review", json={"action": "approve", "review": "We discussed the decision together."}, headers={"X-CSRF-Token": csrf, "Idempotency-Key": str(uuid.uuid4())}).status_code
    with ThreadPoolExecutor(max_workers=4) as pool:
        assert list(pool.map(approve, range(4))) == [200] * 4
    journal = c.get(f"/runs/{c.rid}/journal")
    assert journal["reconciliation"]["ok"] and len(journal["entries"]) == 2
    assert [e["kind"] for e in journal["decisions"]] == ["proposed", "approved", "filled"]
