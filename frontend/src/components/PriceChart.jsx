import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

// Adapted from the original Graphs.jsx's Recharts closing-price chart.
export default function PriceChart({ asset, dollars, pct }) {
  const history = asset.history.map((point) => ({
    ...point,
    close: Number(point.close),
  }));
  return (
    <figure className="chart">
      <ResponsiveContainer width="100%" height={230}>
        <AreaChart
          data={history}
          margin={{ top: 15, right: 16, left: 0, bottom: 0 }}
        >
          <CartesianGrid
            stroke="#DCE3EC"
            strokeDasharray="3 3"
            vertical={false}
          />
          <XAxis
            dataKey="date"
            tickFormatter={(d) => d.slice(5)}
            tick={{ fontSize: 14, fill: "#526173" }}
            axisLine={{ stroke: "#DCE3EC" }}
            tickLine={false}
            minTickGap={25}
          />
          <YAxis
            domain={["auto", "auto"]}
            tick={{ fontSize: 14, fill: "#526173" }}
            tickFormatter={(value) => dollars(value)}
            axisLine={false}
            tickLine={false}
            width={90}
          />
          <Tooltip
            formatter={(v) => dollars(v)}
            contentStyle={{
              border: "1px solid #DCE3EC",
              borderRadius: 4,
              color: "#142D50",
              boxShadow: "none",
            }}
          />
          <Area
            dataKey="close"
            name="Closing price"
            stroke="#2459A6"
            fill="#EBF1FA"
            strokeWidth={2.5}
            isAnimationActive={false}
            dot={history.length === 1}
          />
        </AreaChart>
      </ResponsiveContainer>
      <figcaption>
        {asset.ticker}: {history.length} visible session
        {history.length !== 1 ? "s" : ""}, from {dollars(history[0]?.close)} to{" "}
        {dollars(history.at(-1)?.close)}. Change {pct(asset.change_pct)}. Dates{" "}
        {history[0]?.date} to {history.at(-1)?.date}. Synthetic closing prices
        in USD.
      </figcaption>
    </figure>
  );
}
