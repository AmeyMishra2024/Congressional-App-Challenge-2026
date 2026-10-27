"""Reconstruct portfolio outcomes from executed fills, using only observable prices."""
from collections import defaultdict
from decimal import Decimal
from sqlalchemy import select
from .db import fills, positions
from .accounting import money
from .content import ASSETS

def analyze(db, run, market):
    executed = list(db.execute(select(fills).where(fills.c.run_id == run["id"]).order_by(fills.c.session, fills.c.id)).mappings())
    by_session = defaultdict(list)
    for fill in executed:
        by_session[fill["session"]].append(fill)
    cash = Decimal(run["starting"])
    starting, peak, drawdown, realized = cash, cash, Decimal(0), Decimal(0)
    quantities = defaultdict(Decimal)
    history = []
    benchmark_ticker = market.scenario["benchmark"]
    for session, observation in market.observations.items():
        for f in by_session[session]:
            direction = 1 if f["side"] == "buy" else -1
            cash -= Decimal(f["amount"]) * direction
            quantities[f["ticker"]] += Decimal(f["quantity"]) * direction
            if f["side"] == "sell":
                realized += Decimal(f["amount"]) - Decimal(f["basis_removed"])
        holdings = sum((qty * market.close(ticker, session) for ticker, qty in quantities.items()), Decimal(0))
        total = cash + holdings
        peak = max(peak, total)
        current_drawdown = (peak - total) / peak * 100
        drawdown = max(drawdown, current_drawdown)
        benchmark = starting * market.close(benchmark_ticker, session) / market.close(benchmark_ticker, 0)
        history.append({"session": session, "date": observation["date"], "cash": money(cash),
                        "holdings": money(holdings), "total": money(total), "benchmark": money(benchmark),
                        "return_pct": money((total / starting - 1) * 100), "drawdown_pct": money(current_drawdown)})
    # Use unrounded values for percentages and gain attribution.
    current_holdings = list(db.execute(select(positions).where(positions.c.run_id == run["id"])).mappings())
    allocated = [{"ticker": p["ticker"], "name": ASSETS[p["ticker"]]["name"], "kind": ASSETS[p["ticker"]]["kind"],
                  "value": money(Decimal(p["quantity"]) * market.close(p["ticker"])),
                  "weight_pct": money(Decimal(p["quantity"]) * market.close(p["ticker"]) / total * 100)}
                 for p in current_holdings if Decimal(p["quantity"]) > 0]
    allocated.sort(key=lambda p: Decimal(p["value"]), reverse=True)
    cash_pct = cash / total * 100
    return {"history": history, "allocation": allocated, "cash_pct": money(cash_pct),
            "max_drawdown_pct": money(drawdown), "realized_gain": money(realized),
            "unrealized_gain": money(total - starting - realized),
            "largest_holding_pct": allocated[0]["weight_pct"] if allocated else "0.00",
            "method": "Values reflect each session's closing prices after completed trades, and the current session updates after each trade. The calculation excludes contributions, dividends, fees, taxes, and interest. Drawdown uses the starting balance as the first portfolio peak.",
            "scenario": market.scenario}
