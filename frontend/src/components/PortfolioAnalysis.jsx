import { lazy, Suspense } from "react";
const OutcomeChart = lazy(() => import("./OutcomeChart.jsx"));
const dollars = (n) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
    Number(n),
  );

export default function PortfolioAnalysis({ analysis: a }) {
  if (!a) return <p role="status">Loading portfolio analysis…</p>;
  return (
    <section className="portfolio-analysis" aria-label="Portfolio analysis">
      <header className="split">
        <div>
          <h2>Your portfolio over time</h2>
        </div>
        <span className="pill neutral">
          {a.history.length} visible session{a.history.length === 1 ? "" : "s"}
        </span>
      </header>
      <div className="analysis-metrics">
        <div>
          <span>Realized gain / loss</span>
          <strong>{dollars(a.realized_gain)}</strong>
          <small>From executed sales</small>
        </div>
        <div>
          <span>Unrealized gain / loss</span>
          <strong>{dollars(a.unrealized_gain)}</strong>
          <small>Still held at today's close</small>
        </div>
        <div>
          <span>Largest observed decline</span>
          <strong>{a.max_drawdown_pct}%</strong>
          <small>Below a previous portfolio peak</small>
        </div>
      </div>
      {a.history.length > 1 ? (
        <Suspense fallback={<p role="status">Loading outcome chart…</p>}>
          <OutcomeChart history={a.history} benchmark={a.scenario.benchmark} />
        </Suspense>
      ) : (
        <p className="muted">
          Advance a replay session to compare your portfolio's path with the
          benchmark.
        </p>
      )}
      <div className="analysis-detail">
        <section>
          <h3>Where your virtual funds are</h3>
          <ul className="allocation-list">
            {[
              {
                ticker: "Cash",
                name: "Uninvested virtual cash",
                weight_pct: a.cash_pct,
              },
              ...a.allocation,
            ].map((holding) => (
              <li key={holding.ticker}>
                <div className="split">
                  <span>
                    <strong>{holding.ticker}</strong>
                    <small>{holding.name}</small>
                  </span>
                  <strong>{holding.weight_pct}%</strong>
                </div>
                <div className="allocation-track" aria-hidden="true">
                  <div
                    style={{
                      width: `${Math.max(0, Math.min(100, Number(holding.weight_pct)))}%`,
                    }}
                  />
                </div>
              </li>
            ))}
          </ul>
          <p className="muted">
            Weights include cash. A fund is one holding here, even though it may
            hold many investments. This is not a breakdown of a fund's
            underlying companies.
          </p>
        </section>
        <section>
          <h3>Understanding drawdown</h3>
          <p>
            Drawdown measures a fall from the highest portfolio value already
            observed, including your starting funds. A recovery can leave a
            positive final result after an uncomfortable decline.
          </p>
          <p>
            Compare your original risk explanation with the experience. Keeping
            cash, waiting, and discussing uncertainty can be useful decisions.
          </p>
          <details className="values-detail">
            <summary>View values by session</summary>
            <div
              className="table-wrap"
              tabIndex="0"
              role="region"
              aria-label="Portfolio values by session"
            >
              <table className="financial-table">
                <caption>End-of-session values after executed trades</caption>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th className="numeric">Portfolio</th>
                    <th className="numeric">Benchmark</th>
                    <th className="numeric">Cash</th>
                  </tr>
                </thead>
                <tbody>
                  {a.history.map((h) => (
                    <tr key={h.session}>
                      <th scope="row">{h.date}</th>
                      <td className="numeric">{dollars(h.total)}</td>
                      <td className="numeric">{dollars(h.benchmark)}</td>
                      <td className="numeric">{dollars(h.cash)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </section>
      </div>
      <p className="muted">
        {a.method} This analysis uses made-up prices from {a.history[0].date} to{" "}
        {a.history.at(-1).date}. The financial result does not measure the
        quality of your reasoning.
      </p>
    </section>
  );
}
