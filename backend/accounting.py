"""Exact accounting journal and reconciliation; no HTTP dependencies."""
from collections import defaultdict
from decimal import Decimal, ROUND_HALF_UP
from sqlalchemy import insert, select
from .db import ledger, fills, positions, runs

def money(value):
    return str(Decimal(value).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP))

def open_account(db, run):
    db.execute(insert(ledger).values(run_id=run["id"], fill_id=None,
        source=f"opening:{run['id']}", kind="opening", ticker=None, session=0,
        cash_delta=run["starting"], quantity_delta="0", basis_delta="0", created=run["created"]))

def record_fill(db, fill):
    buy = fill["side"] == "buy"
    db.execute(insert(ledger).values(run_id=fill["run_id"], fill_id=fill["id"],
        source=f"fill:{fill['id']}", kind=fill["side"], ticker=fill["ticker"], session=fill["session"],
        cash_delta=money(-Decimal(fill["amount"]) if buy else fill["amount"]),
        quantity_delta=str(Decimal(fill["quantity"]) * (1 if buy else -1)),
        basis_delta=money(fill["amount"] if buy else -Decimal(fill["basis_removed"])), created=fill["created"]))

def reconcile(db, run):
    """Compare journal entries, fills and materialized balances without repairing data."""
    entries = list(db.execute(select(ledger).where(ledger.c.run_id == run["id"]).order_by(ledger.c.id)).mappings())
    actual_fills = {f["id"]: f for f in db.execute(select(fills).where(fills.c.run_id == run["id"])).mappings()}
    qty, basis = defaultdict(Decimal), defaultdict(Decimal)
    cash = Decimal(0)
    issues = []
    if len([e for e in entries if e["kind"] == "opening"]) != 1:
        issues.append("Expected one opening entry.")
    if {e["fill_id"] for e in entries if e["fill_id"] is not None} != set(actual_fills):
        issues.append("Journal and executed fills differ.")
    for e in entries:
        cash += Decimal(e["cash_delta"])
        if e["kind"] == "opening":
            if Decimal(e["cash_delta"]) != Decimal(run["starting"]):
                issues.append("Opening cash differs from starting funds.")
        else:
            f = actual_fills.get(e["fill_id"])
            buy = e["kind"] == "buy"
            if not f or (e["kind"], e["ticker"], e["session"], Decimal(e["cash_delta"]), Decimal(e["quantity_delta"]), Decimal(e["basis_delta"])) != (
                    f["side"], f["ticker"], f["session"], Decimal(f["amount"]) * (-1 if buy else 1),
                    Decimal(f["quantity"]) * (1 if buy else -1), Decimal(f["amount"]) if buy else -Decimal(f["basis_removed"])):
                issues.append(f"Journal entry {e['id']} does not match its fill.")
            qty[e["ticker"]] += Decimal(e["quantity_delta"])
            basis[e["ticker"]] += Decimal(e["basis_delta"])
    if cash != Decimal(run["cash"]):
        issues.append("Cash does not reconcile.")
    held = {p["ticker"]: p for p in db.execute(select(positions).where(positions.c.run_id == run["id"])).mappings()}
    for ticker in set(held) | set(qty):
        p = held.get(ticker, {"quantity": "0", "basis": "0"})
        if qty[ticker] != Decimal(p["quantity"]) or basis[ticker] != Decimal(p["basis"]):
            issues.append(f"{ticker} quantity or basis does not reconcile.")
        if qty[ticker] < 0 or basis[ticker] < 0:
            issues.append(f"{ticker} has a negative position.")
    if cash < 0:
        issues.append("Negative cash.")
    return {"ok": not issues, "issues": issues, "entries": len(entries), "cash": money(cash)}

def reconcile_all(db):
    return [{"run_id": r["id"], **reconcile(db, r)} for r in db.execute(select(runs)).mappings()]
