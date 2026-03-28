import React, { useEffect, useMemo, useState } from "react";
import { Link, NavLink, Route, Routes, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { AspectChart, SentimentChart } from "./components/Charts.jsx";
import { autoDetectTextColumn, previewCsv } from "./lib/csvPreview.js";

function Shell({ children }) {
  return (
    <div className="app-shell">
      <aside className="nav-rail">
        <div className="brand-block">
          <div className="brand-kicker">Sentiment workspace</div>
          <h1>Review intelligence</h1>
          <p>Upload review datasets, run local analysis, and revisit every run from one calm workspace.</p>
        </div>

        <nav className="nav-links">
          <NavLink to="/" end>
            New analysis
          </NavLink>
          <NavLink to="/history">History</NavLink>
        </nav>
      </aside>

      <main className="workspace">{children}</main>
    </div>
  );
}

function Stat({ label, value, tone = "default" }) {
  return (
    <div className={`stat-block tone-${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function DetailItem({ label, value }) {
  return (
    <div className="detail-item">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function UploadPage() {
  const [categories, setCategories] = useState([]);
  const [file, setFile] = useState(null);
  const [columns, setColumns] = useState([]);
  const [previewRows, setPreviewRows] = useState([]);
  const [textColumn, setTextColumn] = useState("");
  const [category, setCategory] = useState("CLOTHING");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    fetch("/api/config")
      .then((response) => response.json())
      .then((data) => setCategories(data.categories || ["CLOTHING"]))
      .catch(() => setCategories(["CLOTHING"]));
  }, []);

  async function handleFileChange(event) {
    const nextFile = event.target.files?.[0];
    setFile(nextFile || null);
    setError("");

    if (!nextFile) {
      setColumns([]);
      setPreviewRows([]);
      setTextColumn("");
      return;
    }

    const text = await nextFile.text();
    const preview = previewCsv(text);
    setColumns(preview.columns);
    setPreviewRows(preview.rows);
    setTextColumn(autoDetectTextColumn(preview.columns, preview.rows));
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (!file) {
      setError("Choose a CSV file to analyze.");
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("category", category);
      if (textColumn) {
        formData.append("textColumn", textColumn);
      }

      const response = await fetch("/api/runs", { method: "POST", body: formData });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Analysis failed.");
      }

      navigate(`/runs/${data.id}`);
    } catch (submissionError) {
      setError(submissionError.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="scene">
      <header className="scene-header scene-enter">
        <div>
          <div className="eyebrow">New analysis</div>
          <h2>Prepare a review dataset for sentiment and aspect analysis.</h2>
        </div>
        <p>
          The first pass stays focused: upload one CSV, confirm the review column, choose a product category,
          and run the analysis locally.
        </p>
      </header>

      <form className="analysis-grid scene-enter scene-enter-delay" onSubmit={handleSubmit}>
        <section className="upload-stage">
          <label className="file-drop">
            <span className="file-drop-label">CSV source</span>
            <strong>{file ? file.name : "Drop a review dataset here or browse from disk"}</strong>
            <small>Accepted format: .csv</small>
            <input type="file" accept=".csv,text/csv" onChange={handleFileChange} />
          </label>

          <div className="controls-row">
            <label>
              <span>Product category</span>
              <select value={category} onChange={(event) => setCategory(event.target.value)}>
                {categories.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span>Review column</span>
              <select
                value={textColumn}
                onChange={(event) => setTextColumn(event.target.value)}
                disabled={columns.length === 0}
              >
                {columns.length === 0 ? <option value="">Upload a CSV first</option> : null}
                {columns.map((column) => (
                  <option key={column} value={column}>
                    {column}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="action-row">
            <button type="submit" className="primary-button" disabled={submitting}>
              {submitting ? "Running analysis..." : "Run analysis"}
            </button>
            {error ? <div className="error-copy">{error}</div> : null}
          </div>
        </section>

        <section className="preview-stage">
          <div className="section-heading">
            <span>Detected preview</span>
            <small>{columns.length > 0 ? `${columns.length} columns found` : "Waiting for file"}</small>
          </div>

          <div className="column-pill-row">
            {columns.map((column) => (
              <span
                key={column}
                className={column === textColumn ? "column-pill active" : "column-pill"}
              >
                {column}
              </span>
            ))}
          </div>

          <div className="preview-table-shell">
            <table className="preview-table">
              <thead>
                <tr>
                  {columns.map((column) => (
                    <th key={column}>{column}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {previewRows.length === 0 ? (
                  <tr>
                    <td colSpan={Math.max(columns.length, 1)}>Preview rows will appear here.</td>
                  </tr>
                ) : (
                  previewRows.map((row, index) => (
                    <tr key={index}>
                      {columns.map((column) => (
                        <td key={`${index}-${column}`}>{row[column]}</td>
                      ))}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </form>
    </section>
  );
}

function HistoryPage() {
  const [runs, setRuns] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/runs")
      .then((response) => response.json())
      .then((data) => setRuns(data))
      .finally(() => setLoading(false));
  }, []);

  return (
    <section className="scene">
      <header className="scene-header">
        <div>
          <div className="eyebrow">History</div>
          <h2>Reopen previous datasets and compare results over time.</h2>
        </div>
      </header>

      <section className="history-list">
        {loading ? <p>Loading saved runs...</p> : null}
        {!loading && runs.length === 0 ? <p>No analysis runs have been saved yet.</p> : null}
        {runs.map((run) => (
          <Link className="history-row" to={`/runs/${run.id}`} key={run.id}>
            <div>
              <strong>{run.filename}</strong>
              <span>
                {run.category} · {new Date(run.createdAt).toLocaleString()}
              </span>
            </div>
            <div className="history-stats">
              <span>{run.validRowCount} valid rows</span>
              <span>{run.summary?.aspectCoverage || 0}% aspect coverage</span>
            </div>
          </Link>
        ))}
      </section>
    </section>
  );
}

function ResultsPage() {
  const { runId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const page = Number(searchParams.get("page") || 1);
  const sentiment = searchParams.get("sentiment") || "ALL";
  const search = searchParams.get("search") || "";

  useEffect(() => {
    setLoading(true);
    const query = new URLSearchParams({
      page: String(page),
      pageSize: "20",
      sentiment,
      search
    });

    fetch(`/api/runs/${runId}?${query.toString()}`)
      .then((response) => response.json())
      .then((payload) => setData(payload))
      .finally(() => setLoading(false));
  }, [page, runId, search, sentiment]);

  const totalPages = useMemo(() => {
    if (!data?.table) {
      return 1;
    }

    return Math.max(1, Math.ceil(data.table.total / data.table.pageSize));
  }, [data]);

  if (loading) {
    return (
      <section className="scene">
        <p>Loading analysis...</p>
      </section>
    );
  }

  if (!data) {
    return (
      <section className="scene">
        <p>Run not found.</p>
      </section>
    );
  }

  return (
    <section className="scene">
      <header className="scene-header">
        <div>
          <div className="eyebrow">Run results</div>
          <h2>{data.filename}</h2>
        </div>
        <div className="header-actions">
          <span>{data.category}</span>
          <a className="primary-button ghost" href={`/api/runs/${data.id}/export`}>
            Export CSV
          </a>
        </div>
      </header>

      <section className="stats-row scene-enter">
        <Stat label="Valid rows" value={data.validRowCount} />
        <Stat label="Positive" value={data.summary.sentimentCounts.POSITIVE} tone="positive" />
        <Stat label="Neutral" value={data.summary.sentimentCounts.NEUTRAL} tone="neutral" />
        <Stat label="Negative" value={data.summary.sentimentCounts.NEGATIVE} tone="negative" />
        <Stat label="Aspect coverage" value={`${data.summary.aspectCoverage}%`} />
      </section>

      <section className="run-details scene-enter">
        <DetailItem label="Detected column" value={data.detectedTextColumn || "Not detected"} />
        <DetailItem label="Used column" value={data.textColumn} />
        <DetailItem label="Total rows in CSV" value={data.rowCount} />
        <DetailItem label="Rows analyzed" value={data.validRowCount} />
        <DetailItem label="Rows removed" value={data.removedCount} />
        <DetailItem label="Model mode" value={data.modelMode} />
      </section>

      <section className="results-grid scene-enter scene-enter-delay">
        <SentimentChart counts={data.summary.sentimentCounts} />
        <AspectChart aspects={data.summary.topAspects} />
      </section>

      <section className="table-stage scene-enter scene-enter-delay-2">
        <div className="table-toolbar">
          <label className="search-field">
            <span>Search rows</span>
            <input
              value={search}
              onChange={(event) => {
                const next = new URLSearchParams(searchParams);
                next.set("search", event.target.value);
                next.set("page", "1");
                setSearchParams(next);
              }}
              placeholder="review text, aspect, or cleaned text"
            />
          </label>

          <label className="search-field narrow">
            <span>Sentiment</span>
            <select
              value={sentiment}
              onChange={(event) => {
                const next = new URLSearchParams(searchParams);
                next.set("sentiment", event.target.value);
                next.set("page", "1");
                setSearchParams(next);
              }}
            >
              <option value="ALL">All</option>
              <option value="POSITIVE">Positive</option>
              <option value="NEUTRAL">Neutral</option>
              <option value="NEGATIVE">Negative</option>
            </select>
          </label>
        </div>

        <div className="results-table-shell">
          <table className="results-table">
            <thead>
              <tr>
                <th>Original text</th>
                <th>Sentiment</th>
                <th>Confidence</th>
                <th>Aspects</th>
              </tr>
            </thead>
            <tbody>
              {data.table.rows.map((row, index) => (
                <tr key={`${row.original_text}-${index}`}>
                  <td>
                    <div className="row-original">{row.original_text}</div>
                    <div className="row-clean">{row.clean_text}</div>
                  </td>
                  <td>
                    <span className={`sentiment-tag ${row.predicted_label.toLowerCase()}`}>
                      {row.predicted_label}
                    </span>
                  </td>
                  <td>{row.confidence}</td>
                  <td>{row.aspects.length > 0 ? row.aspects.join(", ") : "None"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="pagination-row">
          <button
            className="pagination-button"
            onClick={() => {
              const next = new URLSearchParams(searchParams);
              next.set("page", String(Math.max(1, page - 1)));
              setSearchParams(next);
            }}
            disabled={page <= 1}
          >
            Previous
          </button>
          <span>
            Page {page} of {totalPages}
          </span>
          <button
            className="pagination-button"
            onClick={() => {
              const next = new URLSearchParams(searchParams);
              next.set("page", String(Math.min(totalPages, page + 1)));
              setSearchParams(next);
            }}
            disabled={page >= totalPages}
          >
            Next
          </button>
        </div>
      </section>
    </section>
  );
}

export default function App() {
  return (
    <Shell>
      <Routes>
        <Route path="/" element={<UploadPage />} />
        <Route path="/history" element={<HistoryPage />} />
        <Route path="/runs/:runId" element={<ResultsPage />} />
      </Routes>
    </Shell>
  );
}
