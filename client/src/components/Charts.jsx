import React, { useEffect, useState } from "react";
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

function readPalette() {
  if (typeof window === "undefined") {
    return {};
  }
  const styles = getComputedStyle(document.documentElement);
  const read = (name, fallback) => {
    const value = styles.getPropertyValue(name).trim();
    return value || fallback;
  };
  const radiusRaw = read("--chart-bar-radius", "10");
  const radius = Number.parseFloat(radiusRaw) || 0;

  return {
    POSITIVE: read("--chart-positive", "#6dd3a8"),
    NEUTRAL: read("--chart-neutral", "#b8c5d6"),
    NEGATIVE: read("--chart-negative", "#f07c64"),
    accent: read("--chart-accent", "#9cc6ff"),
    accentSoft: read("--chart-accent-soft", "rgba(156, 198, 255, 0.16)"),
    grid: read("--chart-grid", "rgba(255,255,255,0.08)"),
    text: read("--chart-text", "#97a6b7"),
    tooltipBg: read("--chart-tooltip-bg", "#111922"),
    tooltipBorder: read("--chart-tooltip-border", "rgba(255,255,255,0.1)"),
    tooltipText: read("--chart-tooltip-text", "#f5f7fa"),
    barRadius: radius
  };
}

function useChartPalette() {
  const [palette, setPalette] = useState(() => readPalette());

  useEffect(() => {
    function sync() {
      setPalette(readPalette());
    }

    window.addEventListener("themechange", sync);
    // Also observe data-theme attribute mutations as a safety net.
    const observer = new MutationObserver(sync);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"]
    });

    sync();

    return () => {
      window.removeEventListener("themechange", sync);
      observer.disconnect();
    };
  }, []);

  return palette;
}

function tooltipStyle(palette) {
  return {
    background: palette.tooltipBg,
    border: `1px solid ${palette.tooltipBorder}`,
    borderRadius: "10px",
    color: palette.tooltipText,
    boxShadow: "0 12px 32px rgba(0,0,0,0.3)",
    fontFamily: "inherit",
    fontSize: "12px",
    padding: "8px 12px"
  };
}

function EmptyChartState({ label }) {
  return <div className="chart-empty">{label}</div>;
}

export function SentimentChart({ counts }) {
  const palette = useChartPalette();
  const data = Object.entries(counts).map(([name, value]) => ({ name, value }));
  const r = palette.barRadius;

  return (
    <div className="chart-shell chart-shell-tall">
      <div className="section-heading">
        <span>Sentiment distribution</span>
      </div>
      <ResponsiveContainer width="100%" height={320}>
        <BarChart data={data} margin={{ top: 12, right: 24, left: -8, bottom: 6 }}>
          <CartesianGrid stroke={palette.grid} vertical={false} />
          <XAxis dataKey="name" stroke={palette.text} tickLine={false} axisLine={false} tickMargin={10} />
          <YAxis stroke={palette.text} tickLine={false} axisLine={false} tickMargin={10} />
          <Tooltip contentStyle={tooltipStyle(palette)} cursor={{ fill: palette.accentSoft }} />
          <Bar dataKey="value" radius={[r, r, 0, 0]}>
            {data.map((entry) => (
              <Cell key={entry.name} fill={palette[entry.name]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function AspectChart({ aspects }) {
  const palette = useChartPalette();
  const data = aspects.length > 0 ? aspects : [{ name: "No aspects", count: 0 }];
  const r = palette.barRadius;

  return (
    <div className="chart-shell chart-shell-tall">
      <div className="section-heading">
        <span>Top aspects</span>
      </div>
      <ResponsiveContainer width="100%" height={320}>
        <BarChart data={data} layout="vertical" margin={{ top: 12, right: 24, left: 28, bottom: 6 }}>
          <CartesianGrid stroke={palette.grid} horizontal={false} />
          <XAxis type="number" stroke={palette.text} tickLine={false} axisLine={false} tickMargin={10} />
          <YAxis
            type="category"
            dataKey="name"
            width={128}
            stroke={palette.text}
            tickLine={false}
            axisLine={false}
            tickMargin={10}
          />
          <Tooltip contentStyle={tooltipStyle(palette)} cursor={{ fill: palette.accentSoft }} />
          <Bar dataKey="count" fill={palette.accent} radius={[0, r, r, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function AspectSentimentChart({ data }) {
  const palette = useChartPalette();

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
          <CartesianGrid stroke={palette.grid} vertical={false} />
          <XAxis dataKey="aspect" stroke={palette.text} tickLine={false} axisLine={false} tickMargin={12} />
          <YAxis stroke={palette.text} tickLine={false} axisLine={false} tickMargin={10} />
          <Tooltip contentStyle={tooltipStyle(palette)} cursor={{ fill: palette.accentSoft }} />
          <Bar dataKey="POSITIVE" stackId="sentiment" fill={palette.POSITIVE} />
          <Bar dataKey="NEUTRAL" stackId="sentiment" fill={palette.NEUTRAL} />
          <Bar dataKey="NEGATIVE" stackId="sentiment" fill={palette.NEGATIVE} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function AspectCoverageChart({ data }) {
  const palette = useChartPalette();
  const chartData = data && data.length > 0 ? data : [{ name: "No data", value: 1 }];
  const coverageColors = [palette.accent, palette.grid];

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
            stroke="none"
          >
            {chartData.map((entry, index) => (
              <Cell key={entry.name} fill={coverageColors[index % coverageColors.length]} />
            ))}
          </Pie>
          <Tooltip contentStyle={tooltipStyle(palette)} />
        </PieChart>
      </ResponsiveContainer>
      <div className="coverage-legend">
        {chartData.map((entry, index) => (
          <div className="coverage-item" key={entry.name}>
            <span className="coverage-swatch" style={{ background: coverageColors[index % coverageColors.length] }} />
            <strong>{entry.value}</strong>
            <span>{entry.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ReviewLengthChart({ data }) {
  const palette = useChartPalette();
  const r = palette.barRadius;

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
          <CartesianGrid stroke={palette.grid} vertical={false} />
          <XAxis dataKey="sentiment" stroke={palette.text} tickLine={false} axisLine={false} tickMargin={10} />
          <YAxis stroke={palette.text} tickLine={false} axisLine={false} tickMargin={10} />
          <Tooltip
            contentStyle={tooltipStyle(palette)}
            cursor={{ fill: palette.accentSoft }}
            formatter={(value) => [`${value} words`, "Average length"]}
          />
          <Bar dataKey="averageWords" radius={[r, r, 0, 0]}>
            {data.map((entry) => (
              <Cell key={entry.sentiment} fill={palette[entry.sentiment]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function KeywordBreakdownChart({ frequencies }) {
  const palette = useChartPalette();
  const r = palette.barRadius;
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
          <CartesianGrid stroke={palette.grid} horizontal={false} />
          <XAxis type="number" stroke={palette.text} tickLine={false} axisLine={false} tickMargin={10} />
          <YAxis type="category" dataKey="token" width={132} interval={0} tickMargin={12} stroke={palette.text} tickLine={false} axisLine={false} />
          <Tooltip contentStyle={tooltipStyle(palette)} cursor={{ fill: palette.accentSoft }} />
          <Bar dataKey="positive" fill={palette.POSITIVE} radius={[0, r, r, 0]} />
          <Bar dataKey="negative" fill={palette.NEGATIVE} radius={[0, r, r, 0]} />
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
