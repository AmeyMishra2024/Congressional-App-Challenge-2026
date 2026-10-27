"""Optional live exploration. Never used by the offline execution engine."""
from datetime import datetime, timezone
import math
import threading
import time

class YahooProvider:
    _cache = {}
    _lock = threading.Lock()

    @classmethod
    def history(cls, ticker):
        with cls._lock:
            cached = cls._cache.get(ticker)
            if cached and time.monotonic() - cached[0] < 300:
                return {**cached[1], "cached": True}
        import yfinance as yf
        data = yf.Ticker(ticker).history(period="3mo", auto_adjust=True, timeout=8)
        if data.empty or "Close" not in data:
            raise ValueError("No market history")
        history = [{"date": idx.strftime("%Y-%m-%d"), "close": round(float(row["Close"]), 4)} for idx, row in data.dropna(subset=["Close"]).iterrows() if math.isfinite(float(row["Close"])) and float(row["Close"]) > 0]
        if not history:
            raise ValueError("Missing close observations")
        result = {"ticker": ticker, "history": history, "cached": False, "as_of": history[-1]["date"], "fetched_at": datetime.now(timezone.utc).isoformat(), "source": "Yahoo Finance via yfinance (personal exploration only)", "currency": "USD", "adjustment": "auto_adjust=True; adjusted OHLC; no separately added dividends", "execution": False}
        with cls._lock:
            cls._cache[ticker] = (time.monotonic(), result)
        return result
