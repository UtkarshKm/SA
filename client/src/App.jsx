import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Link,
  Navigate,
  NavLink,
  Route,
  Routes,
  useLocation,
  useNavigate,
  useParams,
  useSearchParams
} from "react-router-dom";
import {
  AspectChart,
  AspectCoverageChart,
  AspectSentimentChart,
  KeywordBreakdownChart,
  ReviewLengthChart,
  SentimentChart,
  WordCloudPanel
} from "./components/Charts.jsx";
import { authClient } from "./lib/authClient.js";
import { autoDetectTextColumn, previewCsv } from "./lib/csvPreview.js";
const ACTIVE_STATUSES = new Set(["queued", "processing"]);
const RUN_POLL_INTERVAL_MS = 2000;
const HISTORY_POLL_INTERVAL_MS = 8000;

async function apiFetch(path, options = {}) {
  const response = await fetch(path, {
    credentials: "include",
    ...options
  });

  const contentType = response.headers.get("content-type") || "";
  const data = contentType.includes("application/json") ? await response.json() : null;

  if (!response.ok) {
    const error = new Error(data?.error || "Request failed.");
    error.status = response.status;
    throw error;
  }

  return data;
}

function formatStageLabel(stage) {
  return String(stage || "queued")
    .split(/\s+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatStatusLabel(status) {
  return formatStageLabel(status);
}

function isRunActive(run) {
  return ACTIVE_STATUSES.has(run?.status);
}

function PublicOnlyRoute({ children }) {
  const { data: session, isPending } = authClient.useSession();

  if (isPending) {
    return <div className="page-state">Checking session...</div>;
  }

  if (session?.user) {
    return <Navigate to="/app" replace />;
  }

  return children;
}

function ProtectedRoute({ children }) {
  const { data: session, isPending } = authClient.useSession();
  const location = useLocation();

  if (isPending) {
    return <div className="page-state">Loading workspace...</div>;
  }

  if (!session?.user) {
    return <Navigate to="/sign-in" replace state={{ from: location.pathname }} />;
  }

  return children;
}

function LandingPage() {
  return (
    <div className="public-shell">
      <header className="marketing-nav">
        <div className="brand-line">
          <span className="brand-kicker">ReviewScope</span>
          <strong>Review Intelligence Platform</strong>
        </div>
        <div className="marketing-actions">
          <Link className="ghost-link" to="/sign-in">
            Sign in
          </Link>
          <Link className="primary-button" to="/sign-up">
            Get started
          </Link>
        </div>
      </header>

      <section className="landing-hero scene-enter">
        <div className="eyebrow">Review Intelligence Platform</div>
        <h1>Turn customer feedback into your competitive edge.</h1>
        <p className="landing-hero-sub">
          Upload product reviews, analyze sentiment at scale, and extract the insights your team needs
          to improve products, fix issues faster, and protect your brand reputation.
        </p>
        <div className="hero-actions">
          <Link className="primary-button" to="/sign-up">
            Analyze your reviews
          </Link>
          <a className="ghost-link" href="#how-it-works">
            See how it works
          </a>
        </div>
      </section>

      <section className="landing-value-grid scene-enter scene-enter-delay">
        <div className="value-card">
          <span className="value-number">01</span>
          <strong>Instant feedback intelligence</strong>
          <p>
            See what customers love and hate about your products at a glance.
            Spot quality issues, recurring complaints, and top-praised features in seconds.
          </p>
        </div>
        <div className="value-card">
          <span className="value-number">02</span>
          <strong>Save days of manual review reading</strong>
          <p>
            Upload thousands of reviews and get a complete sentiment and aspect breakdown
            in minutes — no more reading feedback one by one.
          </p>
        </div>
        <div className="value-card">
          <span className="value-number">03</span>
          <strong>Understand your reputation</strong>
          <p>
            Track sentiment trends across product lines and categories.
            Understand how customers perceive your brand and where to invest next.
          </p>
        </div>
      </section>

      <section className="landing-how scene-enter scene-enter-delay" id="how-it-works">
        <div className="section-heading">
          <span>How it works</span>
        </div>
        <div className="how-steps">
          <div className="how-step">
            <span className="how-step-num">1</span>
            <strong>Upload</strong>
            <p>Collect your product reviews into a CSV and upload them to your private workspace.</p>
          </div>
          <div className="how-step-connector" aria-hidden="true" />
          <div className="how-step">
            <span className="how-step-num">2</span>
            <strong>Analyze</strong>
            <p>The engine detects sentiment — positive, neutral, or negative — and extracts key product aspects automatically.</p>
          </div>
          <div className="how-step-connector" aria-hidden="true" />
          <div className="how-step">
            <span className="how-step-num">3</span>
            <strong>Decide</strong>
            <p>Browse visual dashboards, filter by sentiment, and export enriched results to drive product and strategy decisions.</p>
          </div>
        </div>
      </section>

      <section className="landing-metrics scene-enter scene-enter-delay-2">
        <div className="metric-item">
          <strong>98%+</strong>
          <span>Sentiment accuracy</span>
        </div>
        <div className="metric-item">
          <strong>15+</strong>
          <span>Aspects per analysis</span>
        </div>
        <div className="metric-item">
          <strong>1,000+</strong>
          <span>Reviews per minute</span>
        </div>
        <div className="metric-item">
          <strong>~4 hrs</strong>
          <span>Time saved per run</span>
        </div>
      </section>

      <section className="landing-cta scene-enter scene-enter-delay-2">
        <h2>Stop guessing. Start analyzing.</h2>
        <p>Upload your first review dataset and discover what your customers are really saying about your products.</p>
        <Link className="primary-button" to="/sign-up">
          Create free account
        </Link>
      </section>
    </div>
  );
}

function AuthPage({ mode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const redirectTarget = location.state?.from || "/app";
  const isSignUp = mode === "sign-up";

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitting(true);
    setError("");

    try {
      if (isSignUp) {
        const result = await authClient.signUp.email({
          name,
          email,
          password
        });

        if (result.error) {
          throw new Error(result.error.message || "Sign up failed.");
        }
      } else {
        const result = await authClient.signIn.email({
          email,
          password
        });

        if (result.error) {
          throw new Error(result.error.message || "Sign in failed.");
        }
      }

      navigate(redirectTarget, { replace: true });
    } catch (authError) {
      setError(authError.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="public-shell auth-shell">
      <div className="auth-card scene-enter">
        <Link className="back-link" to="/">
          Back to home
        </Link>
        <div className="eyebrow">{isSignUp ? "Create account" : "Welcome back"}</div>
        <h2>{isSignUp ? "Start analyzing product reviews." : "Pick up where you left off."}</h2>
        <p>
          {isSignUp
            ? "Create your free account to start analyzing customer feedback with sentiment detection, aspect extraction, and exportable reports."
            : "Sign in to access your review analyses and saved results."}
        </p>

        <form className="auth-form" onSubmit={handleSubmit}>
          {isSignUp ? (
            <label>
              <span>Name</span>
              <input value={name} onChange={(event) => setName(event.target.value)} required />
            </label>
          ) : null}

          <label>
            <span>Email</span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </label>

          <label>
            <span>Password</span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              minLength={8}
              required
            />
          </label>

          {error ? <div className="error-copy">{error}</div> : null}

          <button className="primary-button" disabled={submitting} type="submit">
            {submitting ? "Working..." : isSignUp ? "Create account" : "Sign in"}
          </button>
        </form>

        <div className="auth-switch">
          {isSignUp ? "Already have an account?" : "Need an account?"}{" "}
          <Link to={isSignUp ? "/sign-in" : "/sign-up"}>{isSignUp ? "Sign in" : "Create one"}</Link>
        </div>
      </div>
    </div>
  );
}

function PrivateShell({ children }) {
  const navigate = useNavigate();
  const { data: session } = authClient.useSession();

  async function handleSignOut() {
    await authClient.signOut();
    navigate("/", { replace: true });
  }

  return (
    <div className="app-shell">
      <aside className="nav-rail">
        <div className="brand-block">
          <div className="brand-kicker">ReviewScope</div>
          <h1>Review Intelligence</h1>
          <p>Analyze product reviews, extract sentiment and key aspects, and export actionable insights.</p>
        </div>

        <nav className="nav-links">
          <NavLink to="/app" end>
            New analysis
          </NavLink>
          <NavLink to="/app/history">History</NavLink>
        </nav>

        <div className="user-panel">
          <span>Signed in as</span>
          <strong>{session?.user?.email || "Unknown user"}</strong>
          <button className="ghost-button" onClick={handleSignOut} type="button">
            Sign out
          </button>
        </div>
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

function StatusChip({ status }) {
  return <span className={`status-chip status-${status}`}>{formatStatusLabel(status)}</span>;
}

function ProgressPanel({ run, onCancel, canceling }) {
  const events = [...(run.progressEvents || [])].slice(-7).reverse();
  const active = isRunActive(run);

  return (
    <section className="progress-shell scene-enter">
      <div className="progress-head">
        <div>
          <div className="eyebrow">Run progress</div>
          <h3>{run.progressMessage || "Waiting for the next step."}</h3>
        </div>
        <div className="progress-actions">
          <StatusChip status={run.status} />
          {active ? (
            <button className="ghost-button danger-button" onClick={onCancel} disabled={canceling || run.cancelRequested} type="button">
              {canceling || run.cancelRequested ? "Cancel requested..." : "Cancel run"}
            </button>
          ) : null}
        </div>
      </div>

      <div className="progress-meter">
        <div className="progress-track" aria-hidden="true">
          <div className="progress-fill" style={{ width: `${Math.max(0, Math.min(100, run.progressPercent || 0))}%` }} />
        </div>
        <div className="progress-caption">
          <span>{formatStageLabel(run.progressStage)}</span>
          <strong>{run.progressPercent || 0}%</strong>
        </div>
      </div>

      <div className="timeline-list">
        {events.length === 0 ? <p className="muted-copy">Stage updates will appear here as the run progresses.</p> : null}
        {events.map((event, index) => (
          <div className="timeline-item" key={`${event.stage}-${event.createdAt}-${index}`}>
            <span className="timeline-dot" />
            <div>
              <strong>{formatStageLabel(event.stage)}</strong>
              <p>{event.message}</p>
            </div>
            <time>{new Date(event.createdAt).toLocaleTimeString()}</time>
          </div>
        ))}
      </div>
    </section>
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
    apiFetch("/api/config")
      .then((data) => setCategories(data.categories || ["CLOTHING"]))
      .catch((loadError) => {
        if (loadError.status === 401) {
          navigate("/sign-in", { replace: true });
          return;
        }

        setError(loadError.message);
      });
  }, [navigate]);

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

      const data = await apiFetch("/api/runs", {
        method: "POST",
        body: formData
      });

      navigate(`/app/runs/${data.id}`);
    } catch (submissionError) {
      if (submissionError.status === 401) {
        navigate("/sign-in", { replace: true });
        return;
      }

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
          <h2>Upload product reviews and uncover what your customers really think.</h2>
        </div>
        <p>
          Import a CSV of your collected reviews.
          Select the review column, pick a category, and we'll analyze sentiment and key product aspects for you.
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
              {submitting ? "Queueing analysis..." : "Run analysis"}
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
  const [error, setError] = useState("");
  const intervalRef = useRef(null);

  useEffect(() => {
    let cancelled = false;

    async function loadRuns() {
      try {
        const data = await apiFetch("/api/runs");
        if (!cancelled) {
          setRuns(data);
          setError("");
        }
      } catch (loadError) {
        if (!cancelled) {
          if (loadError.status === 401) {
            navigate("/sign-in", { replace: true });
            return;
          }

          setError(loadError.message);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    function stopPolling() {
      if (intervalRef.current) {
        window.clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }

    function startPolling() {
      if (document.visibilityState !== "visible" || intervalRef.current) {
        return;
      }

      intervalRef.current = window.setInterval(loadRuns, HISTORY_POLL_INTERVAL_MS);
    }

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        loadRuns();
        startPolling();
        return;
      }

      stopPolling();
    }

    loadRuns();
    startPolling();
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      cancelled = true;
      stopPolling();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [navigate]);

  return (
    <section className="scene">
      <header className="scene-header">
        <div>
          <div className="eyebrow">Analysis history</div>
          <h2>All your past review analyses in one place.</h2>
        </div>
      </header>

      <section className="history-list">
        {loading ? <p>Loading saved runs...</p> : null}
        {error ? <p>{error}</p> : null}
        {!loading && !error && runs.length === 0 ? <p>No analysis runs have been saved yet.</p> : null}
        {runs.map((run) => (
          <Link className="history-row" to={`/app/runs/${run.id}`} key={run.id}>
            <div>
              <div className="history-title-row">
                <strong>{run.filename}</strong>
                <StatusChip status={run.status} />
              </div>
              <span>
                {run.category} · {new Date(run.createdAt).toLocaleString()}
              </span>
            </div>
            <div className="history-stats">
              <span>{run.progressPercent || 0}% complete</span>
              <span>{run.progressMessage || `${run.validRowCount} valid rows`}</span>
            </div>
          </Link>
        ))}
      </section>
    </section>
  );
}

function ResultsPage() {
  const { runId } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [canceling, setCanceling] = useState(false);
  const [wordCloudSentiment, setWordCloudSentiment] = useState("NEGATIVE");

  const page = Number(searchParams.get("page") || 1);
  const sentiment = searchParams.get("sentiment") || "ALL";
  const search = searchParams.get("search") || "";

  useEffect(() => {
    let cancelled = false;

    async function loadRun() {
      try {
        const query = new URLSearchParams({
          page: String(page),
          pageSize: "20",
          sentiment,
          search
        });

        const payload = await apiFetch(`/api/runs/${runId}?${query.toString()}`);
        if (!cancelled) {
          setData(payload);
          setError("");
        }
      } catch (loadError) {
        if (cancelled) {
          return;
        }

        if (loadError.status === 404) {
          setData(null);
          setError("Run not found.");
          return;
        }

        if (loadError.status === 401) {
          navigate("/sign-in", { replace: true });
          return;
        }

        setError(loadError.message);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadRun();
    return () => {
      cancelled = true;
    };
  }, [page, runId, search, sentiment, navigate]);

  useEffect(() => {
    if (!data || !isRunActive(data)) {
      return undefined;
    }

    const intervalId = window.setInterval(async () => {
      try {
        const query = new URLSearchParams({
          page: String(page),
          pageSize: "20",
          sentiment,
          search
        });

        const payload = await apiFetch(`/api/runs/${runId}?${query.toString()}`);
        setData(payload);
        setError("");
      } catch (pollError) {
        if (pollError.status === 401) {
          navigate("/sign-in", { replace: true });
          return;
        }

        setError(pollError.message);
      }
    }, RUN_POLL_INTERVAL_MS);

    return () => window.clearInterval(intervalId);
  }, [data, page, runId, search, sentiment]);

  useEffect(() => {
    if (!data) {
      return;
    }

    if (!data.cancelRequested) {
      setCanceling(false);
    }
  }, [data]);

  const totalPages = useMemo(() => {
    if (!data?.table) {
      return 1;
    }

    return Math.max(1, Math.ceil(data.table.total / data.table.pageSize));
  }, [data]);

  async function handleCancel() {
    if (!data) {
      return;
    }

    setCanceling(true);
    try {
      const updated = await apiFetch(`/api/runs/${data.id}/cancel`, { method: "POST" });
      setData((current) => ({ ...(current || {}), ...updated }));
      setError("");
    } catch (cancelError) {
      setError(cancelError.message);
      setCanceling(false);
    }
  }

  if (loading) {
    return (
      <section className="scene">
        <p>Loading analysis...</p>
      </section>
    );
  }

  if (error || !data) {
    return (
      <section className="scene">
        <p>{error || "Run not found."}</p>
      </section>
    );
  }

  const hasCompletedResults = Boolean(data.hasCompletedResults);

  return (
    <section className="scene">
      <header className="scene-header">
        <div>
          <div className="eyebrow">Review analysis results</div>
          <h2>{data.filename}</h2>
        </div>
        <div className="header-actions">
          <StatusChip status={data.status} />
          <span>{data.category}</span>
          {hasCompletedResults ? (
            <a className="primary-button ghost" href={`/api/runs/${data.id}/export`}>
              Export CSV
            </a>
          ) : (
            <button className="primary-button ghost" disabled type="button">
              Export after completion
            </button>
          )}
        </div>
      </header>

      <ProgressPanel run={data} onCancel={handleCancel} canceling={canceling} />

      <section className="run-details scene-enter scene-enter-delay">
        <DetailItem label="Detected column" value={data.detectedTextColumn || "Not detected"} />
        <DetailItem label="Used column" value={data.textColumn} />
        <DetailItem label="Total rows in CSV" value={data.rowCount} />
        <DetailItem label="Rows analyzed" value={data.validRowCount} />
        <DetailItem label="Rows removed" value={data.removedCount} />
        <DetailItem label="Model mode" value={data.modelMode} />
        <DetailItem label="Model name" value={data.modelName} />
      </section>

      {hasCompletedResults ? (
        <>
          <section className="stats-row scene-enter scene-enter-delay">
            <Stat label="Valid rows" value={data.validRowCount} />
            <Stat label="Positive" value={data.summary.sentimentCounts.POSITIVE} tone="positive" />
            <Stat label="Neutral" value={data.summary.sentimentCounts.NEUTRAL} tone="neutral" />
            <Stat label="Negative" value={data.summary.sentimentCounts.NEGATIVE} tone="negative" />
            <Stat label="Aspect coverage" value={`${data.summary.aspectCoverage}%`} />
          </section>

          <section className="results-grid scene-enter scene-enter-delay-2 results-grid-primary">
            <SentimentChart counts={data.summary.sentimentCounts} />
            <AspectSentimentChart data={data.aspectSentiment} />
          </section>

          <section className="results-grid scene-enter scene-enter-delay-2 results-grid-secondary">
            <AspectChart aspects={data.summary.topAspects} />
            <AspectCoverageChart data={data.aspectCoverageBreakdown} />
            <ReviewLengthChart data={data.reviewLengthStats} />
          </section>

          <section className="results-grid scene-enter scene-enter-delay-2 results-grid-exploratory">
            <KeywordBreakdownChart frequencies={data.tokenFrequencies} />
            <WordCloudPanel
              cloud={data.wordCloud}
              sentiment={wordCloudSentiment}
              onSentimentChange={setWordCloudSentiment}
            />
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
        </>
      ) : (
        <section className="empty-state scene-enter scene-enter-delay-2">
          <h3>
            {data.status === "canceled"
              ? "This run was canceled before results were saved."
              : data.status === "failed"
                ? "This run failed before results were saved."
                : "Results will appear here when processing finishes."}
          </h3>
          <p>
            {data.status === "failed"
              ? data.errorMessage || "Check the server logs for the exact failure and try again with another CSV."
              : data.status === "canceled"
                ? "Start a new run from the upload workspace when you are ready to analyze again."
                : "Keep this page open to watch the progress bar and timeline update live."}
          </p>
        </section>
      )}
    </section>
  );
}

function PrivateApp() {
  return (
    <PrivateShell>
      <Routes>
        <Route index element={<UploadPage />} />
        <Route path="history" element={<HistoryPage />} />
        <Route path="runs/:runId" element={<ResultsPage />} />
      </Routes>
    </PrivateShell>
  );
}

export default function App() {
  return (
    <Routes>
      <Route
        path="/"
        element={
          <PublicOnlyRoute>
            <LandingPage />
          </PublicOnlyRoute>
        }
      />
      <Route
        path="/sign-in"
        element={
          <PublicOnlyRoute>
            <AuthPage mode="sign-in" />
          </PublicOnlyRoute>
        }
      />
      <Route
        path="/sign-up"
        element={
          <PublicOnlyRoute>
            <AuthPage mode="sign-up" />
          </PublicOnlyRoute>
        }
      />
      <Route
        path="/app/*"
        element={
          <ProtectedRoute>
            <PrivateApp />
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}
