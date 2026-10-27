import { useEffect, useState } from "react";
import { api } from "../api.js";
const dollars = (n) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
    Number(n),
  );

export default function AccountHistory({ run, fills, orders }) {
  const [journal, setJournal] = useState(null);
  const [error, setError] = useState("");
  const [downloading, setDownloading] = useState(false);
  const revision = orders
    .map((o) => `${o.id}:${o.status}:${o.quoted_session}:${o.review}`)
    .join("|");
  useEffect(() => {
    let active = true;
    setJournal(null);
    setError("");
    api(`/runs/${run.id}/journal`)
      .then((data) => {
        if (active) setJournal(data);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [run.id, run.session, fills.length, revision]);
  async function download() {
    setDownloading(true);
    setError("");
    try {
      const report = await api(`/runs/${run.id}/report`);
      const url = URL.createObjectURL(
        new Blob([JSON.stringify(report, null, 2)], {
          type: "application/json",
        }),
      );
      const link = document.createElement("a");
      link.href = url;
      link.download = `sprout-practice-run-${run.id}.json`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      setError(e.message);
    } finally {
      setDownloading(false);
    }
  }
  let balance = 0;
  const entries = (journal?.entries || []).map((entry) => {
    balance += Math.round(Number(entry.cash_delta) * 100);
    return { ...entry, balance: balance / 100 };
  });
  return (
    <section
      className="account-history plain-section"
      aria-label="Practice account history"
    >
      <div className="split">
        <div>
          <h2>Cash and decision history</h2>
        </div>
        <button className="secondary" disabled={downloading} onClick={download}>
          {downloading ? "Preparing report…" : "Download practice report"}
        </button>
      </div>
      <p>
        The practice report includes this run's visible prices, outcomes,
        decisions, transactions and reflections. All amounts are virtual.
      </p>
      {error && <p role="alert">{error}</p>}
      {journal ? (
        <>
          <p className={journal.reconciliation.ok ? "positive" : "negative"}>
            {journal.reconciliation.ok
              ? "Cash and holdings match the recorded transactions."
              : "This account needs an accounting review before more trades."}
          </p>
          <details>
            <summary>Review virtual cash movements</summary>
            <div
              className="table-wrap"
              role="region"
              aria-label="Virtual cash movements"
              tabIndex="0"
            >
              <table className="financial-table">
                <caption>
                  Opening funds and executed trades; pending proposals do not
                  move cash
                </caption>
                <thead>
                  <tr>
                    <th>Movement</th>
                    <th>Session</th>
                    <th className="numeric">Change</th>
                    <th className="numeric">Cash after</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((e) => (
                    <tr key={e.id}>
                      <th scope="row">
                        {e.kind === "opening"
                          ? "Starting funds"
                          : `${e.kind === "buy" ? "Buy" : "Sell"} ${e.ticker}`}
                      </th>
                      <td>{e.session + 1}</td>
                      <td className="numeric">{dollars(e.cash_delta)}</td>
                      <td className="numeric">{dollars(e.balance)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
          <details>
            <summary>Review decision events</summary>
            {journal.decisions.length ? (
              <ol className="decision-events">
                {journal.decisions.map((e) => (
                  <li key={e.id}>
                    <strong>
                      Proposal {e.order_id} · {e.kind.replaceAll("_", " ")}
                    </strong>
                    <small>
                      Session {e.session + 1} ·{" "}
                      {new Date(e.created).toLocaleString()}
                    </small>
                    {JSON.parse(e.detail).feedback && (
                      <p>{JSON.parse(e.detail).feedback}</p>
                    )}
                    {JSON.parse(e.detail).note && (
                      <p>{JSON.parse(e.detail).note}</p>
                    )}
                  </li>
                ))}
              </ol>
            ) : (
              <p>No decision events yet.</p>
            )}
          </details>
        </>
      ) : (
        !error && <p role="status">Loading account history…</p>
      )}
    </section>
  );
}
