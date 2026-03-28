import React from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";

const SENTIMENT_COLORS = {
  POSITIVE: "#6dd3a8",
  NEUTRAL: "#b8c5d6",
  NEGATIVE: "#f07c64"
};

export function SentimentChart({ counts }) {
  const data = Object.entries(counts).map(([name, value]) => ({ name, value }));

  return (
    <div className="chart-shell">
      <div className="section-heading">
        <span>Sentiment distribution</span>
      </div>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} margin={{ top: 8, right: 16, left: -16, bottom: 0 }}>
          <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
          <XAxis dataKey="name" stroke="#97a6b7" tickLine={false} axisLine={false} />
          <YAxis stroke="#97a6b7" tickLine={false} axisLine={false} />
          <Tooltip
            contentStyle={{
              background: "#111922",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: "14px",
              color: "#f5f7fa"
            }}
          />
          <Bar dataKey="value" radius={[12, 12, 0, 0]}>
            {data.map((entry) => (
              <Cell key={entry.name} fill={SENTIMENT_COLORS[entry.name]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function AspectChart({ aspects }) {
  const data = aspects.length > 0 ? aspects : [{ name: "No aspects", count: 0 }];

  return (
    <div className="chart-shell">
      <div className="section-heading">
        <span>Top aspects</span>
      </div>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} layout="vertical" margin={{ top: 8, right: 16, left: 16, bottom: 0 }}>
          <CartesianGrid stroke="rgba(255,255,255,0.08)" horizontal={false} />
          <XAxis type="number" stroke="#97a6b7" tickLine={false} axisLine={false} />
          <YAxis
            type="category"
            dataKey="name"
            width={110}
            stroke="#97a6b7"
            tickLine={false}
            axisLine={false}
          />
          <Tooltip
            contentStyle={{
              background: "#111922",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: "14px",
              color: "#f5f7fa"
            }}
          />
          <Bar dataKey="count" fill="#9cc6ff" radius={[0, 12, 12, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
