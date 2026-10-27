import Icon from "./Icon.jsx";

// Two sibling buttons: the entire card selects; the star only changes the watchlist.
export default function InvestmentCard({
  asset,
  selected,
  watched,
  showWatch,
  busy,
  onSelect,
  onWatch,
}) {
  const fund = asset.kind.toLowerCase().includes("fund");
  const price = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(Number(asset.quote.price));
  const change = Number(asset.change_pct || 0);
  return (
    <div
      className={`card asset-card investment-card${selected ? " chosen" : ""}`}
    >
      <button
        type="button"
        className={`asset-select${showWatch ? " has-watch" : ""}`}
        aria-label={`Explore ${asset.ticker} ${asset.name}`}
        aria-pressed={selected}
        aria-controls="investment-details"
        onClick={onSelect}
      >
        <span className="asset-title">
          <span
            className={`asset-monogram${fund ? " fund" : ""}`}
            aria-hidden="true"
          >
            {fund ? <Icon name="portfolio" /> : asset.ticker.slice(0, 1)}
          </span>
          <span className="asset-name">
            {asset.ticker}
            <small>{asset.name}</small>
          </span>
        </span>
        <span className="investment-kind">{asset.kind}</span>
        <span className="investment-price">
          <strong>{price}</strong>
          <span
            className={
              change < 0 ? "negative" : change > 0 ? "positive" : "muted"
            }
          >
            {change > 0 ? "+" : ""}
            {change.toFixed(2)}%
          </span>
        </span>
        <span className="investment-open">
          {selected ? (
            <>
              <Icon name="check" /> Exploring now
            </>
          ) : (
            <>
              Explore investment <Icon name="arrow" />
            </>
          )}
        </span>
      </button>
      {showWatch && (
        <button
          type="button"
          className="quiet watch investment-watch"
          aria-label={`${watched ? "Remove" : "Add"} ${asset.ticker} ${watched ? "from" : "to"} watchlist`}
          aria-pressed={watched}
          disabled={busy}
          onClick={onWatch}
        >
          <Icon name="star" className={watched ? "is-watched" : ""} />
        </button>
      )}
    </div>
  );
}
