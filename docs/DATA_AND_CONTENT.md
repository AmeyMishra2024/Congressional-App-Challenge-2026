# Data provenance and educational review

The default application works fully offline. **Every seeded price is synthetic**: an original educational fixture in `backend/content.py`, not actual Yahoo, exchange, company or fund historical data. Tickers and company/fund names are used to make concepts familiar; prices are invented. Illustrative session dates are 2025-03-03 through 2025-03-18, currency USD, twelve weekday observations. The series has no dividends, splits or adjusted-price claims. Company news is fictional instructional context, not archived news. Scenario responses identify the synthetic source, date range, currency, convention and execution rule.

Sandbox uses the first observation of **A changing market** as a static **offline snapshot**, not a current quote. Three synthetic datasets are defined in `backend/scenario_data.py` and seeded into immutable relational market tables:

| Scenario | Learning focus | Sessions | Illustrative dates |
|---|---|---|---|
| A changing market | Changing expectations and a plan | 12 | 2025-03-03 to 2025-03-18 |
| Different paths | Concentration and company-specific moves | 12 | 2025-03-03 to 2025-03-18 |
| Shared headwinds | Shared uncertainty and holding cash | 8 | 2025-03-03 to 2025-03-12 |

Each scenario has its own cash, holdings and persisted clock, with VTI as its matching benchmark. Dataset versions/checksums identify the original fixtures. Dates intentionally overlap so moving between scenarios does not replenish the same replay policy day's gross-buy allowance. All prices and instructional news are invented, including the new scenarios. Actual licensed historical replay and live-market execution remain outside this release.

Execution occurs at the visible session close with fractional shares. Portfolio and benchmark exclude dividends, splits, fees, taxes, interest, inflation and external cash flows. No dividend is added separately, so it cannot be double-counted. These simplifications are displayed in the debrief.

Portfolio paths reconstruct executed quantities and cash at each close. Drawdown is the largest observed percentage decline from a previous portfolio peak, including starting funds. Allocation percentages include cash and directly held funds; no fund-constituent breakdown is claimed. Practice reports contain only data visible at their run's current session.

The optional `YahooProvider` is behind `/api/market/history/<ticker>` and disabled unless `ENABLE_LIVE_MARKET=true`. Install `requirements-market.txt` to use it. It requests adjusted OHLC (`auto_adjust=True`), has an eight-second request timeout, caches successful observations in process for five minutes, and returns last-observation date, fetch timestamp, source and adjustment convention. Failure returns a safe unavailable response and never affects offline learning. It is read-only exploration and never changes execution quotes. No Yahoo data is shipped or stored in seeded fixtures; the yfinance software license does not provide a data-redistribution license. Do not enable it in an external/public deployment without reviewing provider terms and obtaining any necessary data rights.

## Lesson references

Original explanations and worked examples are drafts for the student team and supervising reviewer. The prototype links each lesson to a primary educational source, checked during implementation on 2026-10-12:

- Stock ownership and price-chart context: [SEC Investor.gov — Stocks](https://www.investor.gov/introduction-investing/investing-basics/investment-products/stocks).
- Investment risk and returns: [SEC Investor.gov — Risk and return](https://www.investor.gov/additional-resources/information/youth/teachers-classroom-resources/risk-and-return).
- Diversification and time horizons: [SEC Investor.gov — Asset allocation and diversification](https://www.investor.gov/introduction-investing/getting-started/asset-allocation).
- Compounding inputs: [SEC Investor.gov — Compound Interest Calculator](https://www.investor.gov/financial-tools-calculators/calculators/compound-interest-calculator).

Worked numerical examples are original arithmetic illustrations, not observed returns. The compounding explorer assumes annual nominal rate / 12, monthly compounding and month-end contributions. The rate is user-editable, clearly assumed and can be negative. It does not modify account balances. A savings goal is illustrative; practice money cannot be withdrawn.

Check the content for age-appropriate language, mathematical accuracy, fund descriptions, accessibility and any competition-specific expectations before publishing or presenting it. This is investment education, not an individualized recommendation. A profitable simulated trade does not establish good reasoning.
