import React, { useEffect, useMemo, useState } from "react";
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
import { AspectChart, SentimentChart } from "./components/Charts.jsx";
import { authClient } from "./lib/authClient.js";
import { autoDetectTextColumn, previewCsv } from "./lib/csvPreview.js";

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
          <span className="brand-kicker">Sentiment workspace</span>
          <strong>Review intelligence</strong>
        </div>
        <div className="marketing-actions">
          <Link className="ghost-link" to="/sign-in">
            Sign in
          </Link>
          <Link className="primary-button" to="/sign-up">
            Create account
          </Link>
        </div>
      </header>

      <main className="landing-grid">
        <section className="hero-panel scene-enter">
          <div className="eyebrow">Email-password auth enabled</div>
          <h1>Turn product reviews into owned, private analysis workspaces.</h1>
          <p>
            Upload CSVs, run sentiment and aspect analysis, and keep every run scoped to the signed-in user who
            created it.
          </p>
          <div className="hero-actions">
            <Link className="primary-button" to="/sign-up">
              Start free
            </Link>
            <Link className="ghost-link" to="/sign-in">
              I already have an account
            </Link>
          </div>
        </section>

        <section className="feature-panel scene-enter scene-enter-delay">
          <div className="section-heading">
            <span>What the app does</span>
          </div>
          <div className="feature-list">
            <div className="feature-item">
              <strong>Private run history</strong>
              <p>Every analysis run belongs to the signed-in user and stays scoped to that account.</p>
            </div>
            <div className="feature-item">
              <strong>CSV-first workflow</strong>
              <p>Upload reviews, confirm the right text column, and analyze the whole dataset quickly.</p>
            </div>
            <div className="feature-item">
              <strong>Actionable outputs</strong>
              <p>Review sentiment mix, top aspects, row-level results, and export the enriched CSV anytime.</p>
            </div>
          </div>
        </section>
      </main>
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
          Back to landing
        </Link>
        <div className="eyebrow">{isSignUp ? "Create account" : "Sign in"}</div>
        <h2>{isSignUp ? "Start your private analysis workspace." : "Return to your analysis workspace."}</h2>
        <p>
          {isSignUp
            ? "Use a name, email, and password to create your account."
            : "Sign in with the email and password you used when creating your account."}
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
          <div className="brand-kicker">Sentiment workspace</div>
          <h1>Review intelligence</h1>
          <p>Private runs, Mongo-backed history, and review analysis scoped to your account.</p>
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
      .catch((loadError) => setError(loadError.message));
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

      const data = await apiFetch("/api/runs", {
        method: "POST",
        body: formData
      });

      navigate(`/app/runs/${data.id}`);
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
          Upload one CSV, confirm the review column, choose a product category, and save the run under your
          account.
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
  const [error, setError] = useState("");

  useEffect(() => {
    apiFetch("/api/runs")
      .then((data) => setRuns(data))
      .catch((loadError) => setError(loadError.message))
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
        {error ? <p>{error}</p> : null}
        {!loading && !error && runs.length === 0 ? <p>No analysis runs have been saved yet.</p> : null}
        {runs.map((run) => (
          <Link className="history-row" to={`/app/runs/${run.id}`} key={run.id}>
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
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const page = Number(searchParams.get("page") || 1);
  const sentiment = searchParams.get("sentiment") || "ALL";
  const search = searchParams.get("search") || "";

  useEffect(() => {
    setLoading(true);
    setError("");
    const query = new URLSearchParams({
      page: String(page),
      pageSize: "20",
      sentiment,
      search
    });

    apiFetch(`/api/runs/${runId}?${query.toString()}`)
      .then((payload) => setData(payload))
      .catch((loadError) => {
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
      })
      .finally(() => setLoading(false));
  }, [page, runId, search, sentiment, navigate]);

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

  if (error || !data) {
    return (
      <section className="scene">
        <p>{error || "Run not found."}</p>
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
        <DetailItem label="Model name" value={data.modelName} />
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
