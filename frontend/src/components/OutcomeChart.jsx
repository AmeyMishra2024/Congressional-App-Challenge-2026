import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts";
const dollars = (n) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
    Number(n),
  );

export default function OutcomeChart({ history, benchmark }) {
  const data = history.map((h) => ({
    ...h,
    total: Number(h.total),
    benchmark: Number(h.benchmark),
  }));
  const last = history.at(-1);
  return (
    <figure
      className="chart outcome-chart"
      aria-label="Portfolio and benchmark value chart"
    >
      <ResponsiveContainer width="100%" height={265}>
        <LineChart
          data={data}
          margin={{ top: 16, right: 16, left: 0, bottom: 0 }}
        >
          <CartesianGrid
            stroke="#DCE3EC"
            strokeDasharray="3 3"
            vertical={false}
          />
          <XAxis
            dataKey="date"
            tickFormatter={(date) => date.slice(5)}
            tick={{ fontSize: 14, fill: "#526173" }}
            tickLine={false}
            minTickGap={25}
          />
          <YAxis
            domain={["auto", "auto"]}
            width={90}
            tickFormatter={dollars}
            tick={{ fontSize: 14, fill: "#526173" }}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip
            formatter={dollars}
            contentStyle={{
              border: "1px solid #DCE3EC",
              borderRadius: 4,
              boxShadow: "none",
            }}
          />
          <Legend />
          <Line
            dataKey="total"
            name="Your virtual portfolio"
            stroke="#2459A6"
            strokeWidth={2.5}
            dot={false}
            isAnimationActive={false}
          />
          <Line
            dataKey="benchmark"
            name={`${benchmark} benchmark`}
            stroke="#886315"
            strokeWidth={2}
            strokeDasharray="5 4"
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
      <figcaption>
        Portfolio: {dollars(last.total)}. {benchmark} benchmark:{" "}
        {dollars(last.benchmark)}. {history[0].date} to {last.date}, in virtual
        USD. Vertical scale adapts to visible values; exact amounts are in the
        session table.
      </figcaption>
    </figure>
  );
}
