import React from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
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

const COVERAGE_COLORS = ["#9cc6ff", "rgba(255,255,255,0.16)"];

function chartTooltipStyle() {
  return {
    background: "#111922",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: "14px",
    color: "#f5f7fa"
  };
}

function EmptyChartState({ label }) {
  return <div className="chart-empty">{label}</div>;
}

export function SentimentChart({ counts }) {
  const data = Object.entries(counts).map(([name, value]) => ({ name, value }));

  return (
    <div className="chart-shell chart-shell-tall">
      <div className="section-heading">
        <span>Sentiment distribution</span>
      </div>
      <ResponsiveContainer width="100%" height={320}>
        <BarChart data={data} margin={{ top: 12, right: 24, left: -8, bottom: 6 }}>
          <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
          <XAxis dataKey="name" stroke="#97a6b7" tickLine={false} axisLine={false} tickMargin={10} />
          <YAxis stroke="#97a6b7" tickLine={false} axisLine={false} tickMargin={10} />
          <Tooltip contentStyle={chartTooltipStyle()} />
          <Bar dataKey="value" radius={[14, 14, 0, 0]}>
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
    <div className="chart-shell chart-shell-tall">
      <div className="section-heading">
        <span>Top aspects</span>
      </div>
      <ResponsiveContainer width="100%" height={320}>
        <BarChart data={data} layout="vertical" margin={{ top: 12, right: 24, left: 28, bottom: 6 }}>
          <CartesianGrid stroke="rgba(255,255,255,0.08)" horizontal={false} />
          <XAxis type="number" stroke="#97a6b7" tickLine={false} axisLine={false} tickMargin={10} />
          <YAxis
            type="category"
            dataKey="name"
            width={128}
            stroke="#97a6b7"
            tickLine={false}
            axisLine={false}
            tickMargin={10}
          />
          <Tooltip contentStyle={chartTooltipStyle()} />
          <Bar dataKey="count" fill="#9cc6ff" radius={[0, 14, 14, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function AspectSentimentChart({ data }) {
  if (!data || data.length === 0) {
    return (
      <div className="chart-shell chart-shell-wide">
        <div className="section-heading">
          <span>Sentiment by aspect</span>
        </div>
        <EmptyChartState label="No aspect sentiment data yet." />
      </div>
    );
  }

  return (
    <div className="chart-shell chart-shell-wide">
      <div className="section-heading">
        <span>Sentiment by aspect</span>
      </div>
      <ResponsiveContainer width="100%" height={360}>
        <BarChart data={data} margin={{ top: 12, right: 24, left: 8, bottom: 14 }}>
          <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
          <XAxis dataKey="aspect" stroke="#97a6b7" tickLine={false} axisLine={false} tickMargin={12} />
          <YAxis stroke="#97a6b7" tickLine={false} axisLine={false} tickMargin={10} />
          <Tooltip contentStyle={chartTooltipStyle()} />
          <Bar dataKey="POSITIVE" stackId="sentiment" fill={SENTIMENT_COLORS.POSITIVE} />
          <Bar dataKey="NEUTRAL" stackId="sentiment" fill={SENTIMENT_COLORS.NEUTRAL} />
          <Bar dataKey="NEGATIVE" stackId="sentiment" fill={SENTIMENT_COLORS.NEGATIVE} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function AspectCoverageChart({ data }) {
  const chartData = data && data.length > 0 ? data : [{ name: "No data", value: 1 }];

  return (
    <div className="chart-shell chart-shell-compact">
      <div className="section-heading">
        <span>Aspect coverage</span>
      </div>
      <ResponsiveContainer width="100%" height={300}>
        <PieChart>
          <Pie
            data={chartData}
            dataKey="value"
            nameKey="name"
            innerRadius={76}
            outerRadius={108}
            paddingAngle={4}
          >
            {chartData.map((entry, index) => (
              <Cell key={entry.name} fill={COVERAGE_COLORS[index % COVERAGE_COLORS.length]} />
            ))}
          </Pie>
          <Tooltip contentStyle={chartTooltipStyle()} />
        </PieChart>
      </ResponsiveContainer>
      <div className="coverage-legend">
        {chartData.map((entry, index) => (
          <div className="coverage-item" key={entry.name}>
            <span className="coverage-swatch" style={{ background: COVERAGE_COLORS[index % COVERAGE_COLORS.length] }} />
            <strong>{entry.value}</strong>
            <span>{entry.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ReviewLengthChart({ data }) {
  if (!data || data.length === 0) {
    return (
      <div className="chart-shell chart-shell-compact">
        <div className="section-heading">
          <span>Review length by sentiment</span>
        </div>
        <EmptyChartState label="No review length data available." />
      </div>
    );
  }

  return (
    <div className="chart-shell chart-shell-compact">
      <div className="section-heading">
        <span>Review length by sentiment</span>
      </div>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data} margin={{ top: 12, right: 24, left: -8, bottom: 6 }}>
          <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
          <XAxis dataKey="sentiment" stroke="#97a6b7" tickLine={false} axisLine={false} tickMargin={10} />
          <YAxis stroke="#97a6b7" tickLine={false} axisLine={false} tickMargin={10} />
          <Tooltip contentStyle={chartTooltipStyle()} formatter={(value) => [`${value} words`, "Average length"]} />
          <Bar dataKey="averageWords" radius={[14, 14, 0, 0]}>
            {data.map((entry) => (
              <Cell key={entry.sentiment} fill={SENTIMENT_COLORS[entry.sentiment]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function KeywordBreakdownChart({ frequencies }) {
  const positive = frequencies?.POSITIVE?.slice(0, 8) || [];
  const negative = frequencies?.NEGATIVE?.slice(0, 8) || [];
  const tokenMap = new Map();

  for (const item of positive) {
    tokenMap.set(item.token, {
      token: item.token,
      positive: item.count,
      negative: 0
    });
  }

  for (const item of negative) {
    const existing = tokenMap.get(item.token);
    if (existing) {
      existing.negative = item.count;
      continue;
    }

    tokenMap.set(item.token, {
      token: item.token,
      positive: 0,
      negative: item.count
    });
  }

  const data = [...tokenMap.values()]
    .sort((left, right) => (right.positive + right.negative) - (left.positive + left.negative))
    .slice(0, 12);

  if (data.length === 0) {
    return (
      <div className="chart-shell chart-shell-wide">
        <div className="section-heading">
          <span>Keyword breakdown</span>
        </div>
        <EmptyChartState label="Not enough tokens to compare positive and negative keywords." />
      </div>
    );
  }

  return (
    <div className="chart-shell chart-shell-wide">
      <div className="section-heading">
        <span>Keyword breakdown</span>
      </div>
      <ResponsiveContainer width="100%" height={360}>
        <BarChart data={data} layout="vertical" margin={{ top: 12, right: 24, left: 32, bottom: 6 }}>
          <CartesianGrid stroke="rgba(255,255,255,0.08)" horizontal={false} />
          <XAxis type="number" stroke="#97a6b7" tickLine={false} axisLine={false} tickMargin={10} />
          <YAxis type="category" dataKey="token" width={132} interval={0} tickMargin={12} stroke="#97a6b7" tickLine={false} axisLine={false} />
          <Tooltip contentStyle={chartTooltipStyle()} />
          <Bar dataKey="positive" fill={SENTIMENT_COLORS.POSITIVE} radius={[0, 14, 14, 0]} />
          <Bar dataKey="negative" fill={SENTIMENT_COLORS.NEGATIVE} radius={[0, 14, 14, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function WordCloudPanel({ cloud, sentiment, onSentimentChange }) {
  const items = cloud?.[sentiment] || [];

  return (
    <div className="chart-shell chart-shell-wide word-cloud-shell">
      <div className="section-heading">
        <span>Word cloud</span>
        <label className="word-cloud-filter">
          <span>Focus</span>
          <select value={sentiment} onChange={(event) => onSentimentChange(event.target.value)}>
            <option value="NEGATIVE">Negative</option>
            <option value="POSITIVE">Positive</option>
            <option value="NEUTRAL">Neutral</option>
            <option value="ALL">All</option>
          </select>
        </label>
      </div>

      {items.length === 0 ? (
        <EmptyChartState label="No word cloud terms available for this sentiment." />
      ) : (
        <div className="word-cloud-canvas">
          {items.map((item) => (
            <span
              key={`${sentiment}-${item.text}`}
              className={`word-cloud-token sentiment-${sentiment.toLowerCase()}`}
              style={{ fontSize: `${1 + item.weight * 2.3}rem`, opacity: 0.56 + item.weight * 0.44 }}
              title={`${item.text}: ${item.value}`}
            >
              {item.text}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

