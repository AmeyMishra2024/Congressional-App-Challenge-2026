import {
  useCallback,
  useEffect,
  useRef,
  useState,
  lazy,
  Suspense,
} from "react";
import {
  HashRouter,
  NavLink,
  Link,
  Routes,
  Route,
  Navigate,
  useParams,
  useLocation,
} from "react-router-dom";
import { api, security } from "./api.js";
import Icon from "./components/Icon.jsx";
import PortfolioAnalysis from "./components/PortfolioAnalysis.jsx";
import LearningHistory from "./components/LearningHistory.jsx";
import AccountHistory from "./components/AccountHistory.jsx";
import {
  LearningWelcome,
  ChildHome,
  Definitions,
  Term,
  Tutorial,
  TutorialDestination,
  TutorialPage,
  LessonVisual,
} from "./components/LearningExperience.jsx";
import InstallApp from "./components/InstallApp.jsx";
import WorkspaceHeader from "./components/WorkspaceHeader.jsx";
import InvestmentCard from "./components/InvestmentCard.jsx";
const PriceChart = lazy(() => import("./components/PriceChart.jsx"));

const dollars = (value) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
    Number(value || 0),
  );
const pct = (value) =>
  `${Number(value || 0) > 0 ? "+" : ""}${Number(value || 0).toFixed(2)}%`;
const links = [
  ["/dashboard", "Home", "overview"],
  ["/lessons", "Lessons", "lessons"],
  ["/explore", "Explore", "explore"],
  ["/portfolio", "Portfolio", "portfolio"],
  ["/scenarios", "Market replay", "replay"],
  ["/tools", "Learning tools", "tools"],
];

function Chart({ asset }) {
  return (
    <Suspense fallback={<p role="status">Loading the visible-price chart…</p>}>
      <PriceChart asset={asset} dollars={dollars} pct={pct} />
    </Suspense>
  );
}

function AppContent() {
  const location = useLocation();
  const pageName = location.pathname.startsWith("/tutorial")
    ? "Tutorial"
    : location.pathname.startsWith("/parent")
      ? "Parent controls"
      : links.find(([path]) => location.pathname.startsWith(path))?.[1] ||
        "Home";
  const [session, setSession] = useState(null);
  const [cid, setCid] = useState(null);
  const [rid, setRid] = useState(null);
  const [runList, setRunList] = useState([]);
  const [portfolio, setPortfolio] = useState(null);
  const [market, setMarket] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [learning, setLearning] = useState(null);
  const [tutorial, setTutorial] = useState(null);
  const [lessons, setLessons] = useState([]);
  const [progress, setProgress] = useState([]);
  const [scenarios, setScenarios] = useState([]);
  const [policy, setPolicy] = useState(null);
  const [review, setReview] = useState(null);
  const [watches, setWatches] = useState([]);
  const [goal, setGoal] = useState(null);
  const [glossary, setGlossary] = useState({});
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [version, setVersion] = useState(0);
  const user = session?.user;
  const acceptSession = useCallback((result) => {
    security(result.csrf);
    setSession(result);
    setCid((previous) =>
      result.children.some((c) => c.id === previous)
        ? previous
        : result.children[0]?.id || null,
    );
    setRid(null);
    setPortfolio(null);
    setMarket(null);
    setAnalysis(null);
    setLearning(null);
    setTutorial(null);
    setRunList([]);
    setPolicy(null);
    setProgress([]);
    setReview(null);
    setWatches([]);
    setGoal(null);
    setError("");
  }, []);
  useEffect(() => {
    api("/session")
      .then(acceptSession)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [acceptSession]);
  useEffect(() => {
    if (!user) return;
    let active = true;
    Promise.all([api("/lessons"), api("/scenarios"), api("/glossary")])
      .then(([l, s, g]) => {
        if (active) {
          setLessons(l);
          setScenarios(s);
          setGlossary(g);
        }
      })
      .catch((e) => setError(e.message));
    return () => {
      active = false;
    };
  }, [user?.id]);
  useEffect(() => {
    if (!user || !cid) return;
    let active = true;
    setLoading(true);
    Promise.all([
      api(`/children/${cid}/runs`),
      api(`/children/${cid}/progress`),
      api(`/children/${cid}/policy`),
      api(`/children/${cid}/watchlist`),
      api(`/children/${cid}/goal`),
      user.role === "parent"
        ? api(`/children/${cid}/review`)
        : Promise.resolve(null),
      user.role === "child"
        ? api(`/children/${cid}/learning`)
        : Promise.resolve(null),
      user.role === "child"
        ? api(`/children/${cid}/tutorial`)
        : Promise.resolve(null),
    ])
      .then(([r, p, policyData, w, g, rev, learned, tour]) => {
        if (!active) return;
        setRunList(r);
        setProgress(p);
        setPolicy(policyData);
        setWatches(w);
        setGoal(g);
        setReview(rev);
        setLearning(rev?.learning || learned);
        setTutorial(tour);
        setRid((previous) =>
          r.some((x) => x.id === previous)
            ? previous
            : r.filter((x) => x.status === "active").at(-1)?.id || null,
        );
      })
      .catch((e) => {
        if (active) setError(e.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [user?.id, user?.role, cid, version]);
  useEffect(() => {
    if (!rid) return;
    let active = true;
    setPortfolio((previous) => (previous?.run.id === rid ? previous : null));
    setMarket((previous) => (previous?.run_id === rid ? previous : null));
    setAnalysis((previous) => (previous?.run_id === rid ? previous : null));
    Promise.all([
      api(`/runs/${rid}`),
      api(`/runs/${rid}/market`),
      api(`/runs/${rid}/analysis`),
    ])
      .then(([p, m, a]) => {
        if (active) {
          setPortfolio(p);
          setMarket({ ...m, run_id: rid });
          setAnalysis({ ...a, run_id: rid });
        }
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [rid, version]);
  async function act(fn) {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const result = await fn();
      setVersion((v) => v + 1);
      return result;
    } catch (e) {
      setError(e.message);
      if (e.code === "stale_quote") setVersion((v) => v + 1);
      throw e;
    } finally {
      setBusy(false);
    }
  }
  // Event handlers report errors through the global live region; no unhandled promises.
  const perform = (fn) => act(fn).catch(() => undefined);
  async function refreshSession(selectedChild) {
    const result = await api("/session");
    security(result.csrf);
    setSession(result);
    setCid(selectedChild || cid || result.children[0]?.id || null);
    if (selectedChild && selectedChild !== cid) {
      setRid(null);
      setPortfolio(null);
      setMarket(null);
    }
  }
  const ctx = {
    user,
    cid,
    rid,
    portfolio,
    market,
    analysis,
    learning,
    lessons,
    progress,
    scenarios,
    policy,
    review,
    watches,
    goal,
    glossary,
    tutorial,
    saveTutorial: (status, step) =>
      perform(async () => {
        const saved = await api(
          `/children/${cid}/tutorial`,
          { status, step, expected_revision: tutorial.revision },
          "PUT",
        );
        setTutorial(saved);
        return saved;
      }),
    busy,
    act,
    perform,
    setRid,
    refreshSession,
    familyCode: session?.family_code,
    publicPreview: !!session?.public_preview,
  };
  if (!session)
    return (
      <div className="center card">
        <h1>Sprout</h1>
        <p role={error ? "alert" : "status"}>
          {error || "Opening your learning space…"}
        </p>
        {error && (
          <button onClick={() => window.location.reload()}>
            Retry connection
          </button>
        )}
      </div>
    );
  if (!user)
    return (
      <>
        <LearningWelcome
          session={session}
          accept={acceptSession}
          perform={perform}
          busy={busy}
        />
        <div className="login-error" role="alert">
          {error}
        </div>
      </>
    );
  return (
    <div className={`shell ${user.role}-experience`}>
      <a
        className="skip"
        href="#main"
        onClick={(e) => {
          e.preventDefault();
          const main = document.getElementById("main");
          main.focus();
          main.scrollIntoView({ block: "start" });
        }}
      >
        Skip to content
      </a>
      <aside className="sidebar">
        <Link className="brand" to="/dashboard">
          <span className="brand-icon">
            <Icon name="brand" />
          </span>
          {session.app_name || "Sprout"}
        </Link>
        <nav aria-label="Main navigation">
          {links.map(([path, label, icon]) => (
            <NavLink key={path} to={path}>
              <Icon name={icon} />
              {label}
            </NavLink>
          ))}
          {user.role === "child" && (
            <NavLink to="/tutorial">
              <Icon name="guide" />
              Tutorial
            </NavLink>
          )}
          {user.role === "parent" && (
            <NavLink
              to="/parent"
              className={({ isActive }) =>
                `parent-nav${isActive ? " active" : ""}`
              }
            >
              <Icon name="parent" />
              Parent controls
            </NavLink>
          )}
        </nav>
      </aside>
      <div className="workspace">
        <a
          className="code-banner"
          href="https://github.com/AmeyMishra2024/Congressional-App-Challenge-2026"
          target="_blank"
          rel="noopener noreferrer"
        >
          <strong>VIEW CODE HERE</strong>
          <span>github.com/AmeyMishra2024/Congressional-App-Challenge-2026</span>
        </a>
        <WorkspaceHeader
          session={session}
          pageName={pageName}
          cid={cid}
          rid={rid}
          runs={runList}
          scenarios={scenarios}
          policy={policy}
          busy={busy}
          onSignOut={() =>
            perform(async () => acceptSession(await api("/logout", {})))
          }
          onSwitchRole={() =>
            perform(async () =>
              acceptSession(
                await api(
                  "/demo/switch",
                  user.role === "parent"
                    ? { role: "child", child_id: cid }
                    : { role: "parent" },
                ),
              ),
            )
          }
          onChangeChild={(childId) => {
            setCid(childId);
            setRid(null);
            setPortfolio(null);
            setMarket(null);
            setAnalysis(null);
            setLearning(null);
            setPolicy(null);
            setRunList([]);
            setProgress([]);
            setReview(null);
            setWatches([]);
            setGoal(null);
          }}
          onChangeRun={setRid}
        />
        {error && (
          <div className="error" role="alert">
            {error}
            <button className="quiet" onClick={() => setError("")}>
              Dismiss
            </button>
          </div>
        )}
        <main id="main" tabIndex="-1">
          <TutorialDestination portfolio={portfolio} market={market} />
          {loading && <p role="status">Loading your saved progress…</p>}
          {location.pathname !== "/tutorial" && <Tutorial {...ctx} />}
          <Routes>
            <Route path="/dashboard" element={<Dashboard {...ctx} />} />
            <Route
              path="/tutorial"
              element={
                user.role === "child" ? (
                  <TutorialPage {...ctx} />
                ) : (
                  <Navigate to="/dashboard" replace />
                )
              }
            />
            <Route path="/lessons" element={<Lessons {...ctx} />} />
            <Route path="/lessons/:lessonId" element={<Lesson {...ctx} />} />
            <Route path="/explore" element={<Explore {...ctx} />} />
            <Route path="/portfolio" element={<Portfolio {...ctx} />} />
            <Route path="/scenarios" element={<Scenarios {...ctx} />} />
            <Route
              path="/parent"
              element={
                user.role === "parent" ? (
                  <Parent {...ctx} />
                ) : (
                  <Navigate to="/dashboard" replace />
                )
              }
            />
            <Route path="/tools" element={<Tools {...ctx} />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </main>
        <footer>
          Sprout uses virtual money and made-up market prices for education. It
          does not offer financial advice.{" "}
          <a
            href="https://github.com/AmeyMishra2024/Congressional-App-Challenge-2026"
            target="_blank"
            rel="noopener noreferrer"
          >
            View the source code on GitHub
          </a>
        </footer>
      </div>
    </div>
  );
}

function Heading({ eyebrow, title, children, action, tutorialId }) {
  return (
    <div className="page-heading">
      <div>
        {eyebrow && <span className="eyebrow">{eyebrow}</span>}
        <h1
          id={tutorialId}
          className={tutorialId ? "tutorial-target" : undefined}
          tabIndex={tutorialId ? -1 : undefined}
        >
          {title}
        </h1>
        {children && <p>{children}</p>}
      </div>
      {action}
    </div>
  );
}
function Empty({ children }) {
  return <div className="card empty">{children}</div>;
}
function Stats({ portfolio: p, date }) {
  return (
    <section
      className="portfolio-summary"
      aria-label="Virtual portfolio summary"
    >
      <div className="balance-main">
        <span className="balance-label">
          <Icon name="portfolio" />
          Total practice value
        </span>
        <strong>{dollars(p.total)}</strong>
        <small>
          This includes cash and investments.
          {date ? ` Prices are dated ${date}.` : ""}
        </small>
      </div>
      <div className="balance-detail">
        <span>Available cash</span>
        <strong>{dollars(p.run.cash)}</strong>
      </div>
      <div className="balance-detail">
        <span>Practice gain / loss</span>
        <strong className={Number(p.gain) < 0 ? "negative" : "positive"}>
          {dollars(p.gain)}
        </strong>
        <small>{pct(p.return_pct)} since this run began</small>
      </div>
    </section>
  );
}

function Dashboard(ctx) {
  if (ctx.user.role === "child") return <ChildHome {...ctx} />;
  const pending =
    ctx.review?.orders.filter((o) => o.status === "pending").length || 0;
  const completed = ctx.progress.filter((p) => p.completed).length;
  return (
    <>
      <Heading title="Family overview" />
      {ctx.portfolio ? (
        <Stats portfolio={ctx.portfolio} date={ctx.market?.date} />
      ) : (
        <Empty>
          <h2>Set up your child's learning space</h2>
          <p>
            Create a nickname and a PIN, then share your family code with your
            child.
          </p>
          <Link className="button button-gold" to="/parent">
            Create a child profile →
          </Link>
        </Empty>
      )}
      <div className="parent-home-summary">
        <section className="card">
          <Icon name="parent" />
          <h2>{pending} requests to review</h2>
          <p>
            Open Parent controls to review requests from all of this child's
            practice scenarios and update their spending limits.
          </p>
          <Link className="button" to="/parent">
            Open parent controls →
          </Link>
        </section>
        <section className="card">
          <Icon name="lessons" />
          <h2>
            {completed} of {ctx.lessons.length || 6} lessons completed
          </h2>
          <Link className="text-link" to="/lessons">
            Review their learning →
          </Link>
        </section>
      </div>
      <details className="account-help">
        <summary>
          {ctx.publicPreview
            ? "How to try the student and parent views"
            : "How your child signs in"}
        </summary>
        <p>
          {ctx.publicPreview
            ? "Choose Switch to child to complete lessons or submit a practice request, then choose Switch to parent to review it. These controls belong to the fictional demonstration family. The public preview does not create real accounts, family codes, or PINs."
            : "Open Parent controls to find your family code and create a child profile with a PIN. Your child can then choose Start learning on the sign-in page and enter that code, their nickname, and their PIN. Real family accounts require separate sign-ins rather than a role switch."}
        </p>
      </details>
    </>
  );
}

function Lessons({ lessons, progress, learning }) {
  const completed = progress.filter((item) => item.completed).length;
  const next = lessons.find(
    (item) =>
      !progress.some((result) => result.lesson === item.id && result.completed),
  );
  return (
    <>
      <Heading title="Lessons">
        Begin with the first unfinished lesson, or reopen a completed one to
        review it. Each lesson includes an explanation, an example, and an
        exercise with a knowledge check. Completion is saved when both answers
        are correct.
      </Heading>
      <div className="lesson-progress-summary">
        <strong>{completed} of 6 lessons completed</strong>
        <progress
          max="6"
          value={completed}
          aria-label="Saved lesson completion"
        />
      </div>
      <ol className="lesson-progression" aria-label="Lesson progression">
        {lessons.map((l, i) => {
          const done = progress.some((x) => x.lesson === l.id && x.completed);
          return (
            <li
              key={l.id}
              className={`${done ? "completed" : next?.id === l.id ? "next" : ""}`}
            >
              <Link className="lesson-row" to={`/lessons/${l.id}`}>
                <span className="lesson-number">
                  {done ? (
                    <Icon name="check" />
                  ) : (
                    String(i + 1).padStart(2, "0")
                  )}
                </span>
                <div className="lesson-description">
                  <span className="lesson-meta">
                    {l.category} · {l.minutes} min
                  </span>
                  <h2>{l.title}</h2>
                </div>
                <span
                  className={`pill ${!done && next?.id === l.id ? "learning-status" : "neutral"}`}
                >
                  {done
                    ? "Complete"
                    : next?.id === l.id
                      ? "Up next"
                      : `${l.minutes} min`}
                </span>
                <Icon name="arrow" />
              </Link>
            </li>
          );
        })}
      </ol>
      <LearningHistory learning={learning} />
    </>
  );
}

function Lesson({ lessons, user, progress, act, busy, learning }) {
  const { lessonId } = useParams();
  const lesson = lessons.find((l) => l.id === lessonId);
  const [result, setResult] = useState(null);
  const [step, setStep] = useState(0);
  useEffect(() => {
    setResult(null);
    setStep(0);
  }, [lessonId]);
  if (!lesson) return <Empty>Loading lesson…</Empty>;
  const done = progress.some((p) => p.lesson === lesson.id && p.completed);
  return (
    <>
      <Link className="text-link" to="/lessons">
        ← All lessons
      </Link>
      <Heading
        eyebrow={`${lesson.category} · ${lesson.minutes} minutes`}
        title={lesson.title}
      >
        {done
          ? "You have completed this lesson, and your progress is saved. You can still review the example or try the exercise again."
          : null}
      </Heading>
      <ol className="lesson-step-nav" aria-label="Lesson steps">
        {["The idea", "See an example", "Try it yourself"].map((label, i) => (
          <li key={label}>
            <button
              className={step === i ? "selected" : "quiet"}
              aria-current={step === i ? "step" : undefined}
              onClick={() => setStep(i)}
            >
              {i + 1}. {label}
            </button>
          </li>
        ))}
      </ol>
      <div className="lesson-layout stepped-lesson">
        {step < 2 && (
          <article className="card prose">
            <h2>{step === 0 ? "The idea" : "See an example"}</h2>
            {step === 0 ? (
              <>
                <p>{lesson.explanation}</p>
                <p>
                  Select a term to read its definition and an example:{" "}
                  {lesson.id === "diversification" ? (
                    <Term name="diversification" />
                  ) : ["risk", "compounding"].includes(lesson.id) ? (
                    <Term name="return" />
                  ) : lesson.id === "charts" ? (
                    <Term name="benchmark" />
                  ) : (
                    <>
                      <Term name="stock" /> <Term name="fund" />
                    </>
                  )}
                </p>
              </>
            ) : (
              <>
                <LessonVisual id={lesson.id} />
                <div className="worked">
                  <span className="eyebrow">WORKED EXAMPLE</span>
                  <p>{lesson.example}</p>
                </div>
              </>
            )}
            <a
              className="text-link"
              href={lesson.source}
              target="_blank"
              rel="noreferrer"
            >
              Learn more at Investor.gov ↗
            </a>
            <button className="button-gold" onClick={() => setStep(step + 1)}>
              {step === 0 ? "See an example" : "Try it yourself"} →
            </button>
          </article>
        )}
        {step === 2 && (
          <section className="card">
            <h2>Try it yourself</h2>
            <form
              key={lesson.id}
              onSubmit={async (e) => {
                e.preventDefault();
                const data = Object.fromEntries(new FormData(e.currentTarget));
                try {
                  setResult(
                    await act(() =>
                      api(`/lessons/${lesson.id}/complete`, {
                        exercise: data.exercise,
                        answer: Number(data.answer),
                      }),
                    ),
                  );
                } catch {
                  /* shared error region */
                }
              }}
            >
              <label>
                {lesson.exercise.prompt}
                {lesson.exercise.type === "text" ? (
                  <textarea
                    name="exercise"
                    required
                    minLength="20"
                    maxLength="1000"
                  />
                ) : (
                  <input name="exercise" type="number" step="0.01" required />
                )}
              </label>
              <fieldset>
                <legend>{lesson.question}</legend>
                {lesson.options.map((option, i) => (
                  <label className="radio" key={option}>
                    <input
                      type="radio"
                      name="answer"
                      value={i}
                      required
                      disabled={user.role === "parent"}
                    />
                    {option}
                  </label>
                ))}
              </fieldset>
              {user.role === "child" ? (
                <button disabled={busy}>Check & save my learning</button>
              ) : (
                <p className="notice">
                  You are viewing this lesson as a parent. Your child completes
                  the exercises from their own profile.
                </p>
              )}
            </form>
            {result && (
              <div
                className={`feedback ${result.correct ? "good" : ""}`}
                role="status"
              >
                <strong>
                  {result.correct
                    ? "You have completed this lesson, and your progress is saved."
                    : "Review the explanation below, then try the exercise and knowledge check again."}
                </strong>
                <p>{result.feedback}</p>
                <p>{result.exercise_feedback}</p>
                {result.correct && (
                  <Link className="text-link" to="/explore">
                    Explore investments →
                  </Link>
                )}
              </div>
            )}
          </section>
        )}
      </div>
      <LearningHistory learning={learning} lessonId={lesson.id} />
    </>
  );
}

function Explore(ctx) {
  const { market, portfolio, rid, user, watches, cid, perform, act, busy } =
    ctx;
  const [selectedTicker, setTicker] = useState("VTI");
  const [onlyWatched, setOnlyWatched] = useState(false);
  const [live, setLive] = useState(null);
  const [liveError, setLiveError] = useState("");
  const [confirmation, setConfirmation] = useState(null);
  const detailsHeading = useRef(null);
  const visibleAssets = (market?.assets || []).filter(
    (a) => !onlyWatched || watches.includes(a.ticker),
  );
  // Resolve selection before rendering: a hidden investment must never leave
  // an actionable order form behind. A changed ticker also remounts its draft.
  const asset =
    visibleAssets.find((a) => a.ticker === selectedTicker) || visibleAssets[0];
  const ticker = asset?.ticker;
  useEffect(() => {
    setConfirmation(null);
    setLive(null);
    setLiveError("");
  }, [ticker, rid]);
  if (!market || !portfolio)
    return (
      <Empty>
        {rid
          ? "Loading visible market data…"
          : "Create or choose a child practice space first."}
      </Empty>
    );
  const toggle = (symbol) =>
    perform(() =>
      api(
        `/children/${cid}/watchlist`,
        {
          tickers: watches.includes(symbol)
            ? watches.filter((t) => t !== symbol)
            : [...watches, symbol],
        },
        "PUT",
      ),
    );
  return (
    <>
      <Heading title="Explore investments" />
      <div className="notice">
        <strong>Made-up practice prices</strong> · {market.date} ·{" "}
        {portfolio.run.mode === "replay"
          ? `Session ${market.session + 1} / ${portfolio.scenario.sessions}`
          : "Fixed practice snapshot"}
        . {market.provenance.rule}
      </div>
      <div className="explore-layout">
        <section>
          <div className="exploration-tip">
            <Icon name="explore" />
            <p>
              Tap anywhere on a card to explore.{" "}
              {user.role === "child"
                ? "Use the star to save an investment to your watchlist without placing a trade."
                : "Selecting an investment doesn't make a trade."}
            </p>
          </div>
          <div className="split">
            <h2>Choose an investment to explore</h2>
            <label className="inline-check">
              <input
                type="checkbox"
                checked={onlyWatched}
                onChange={(e) => setOnlyWatched(e.target.checked)}
              />
              Watchlist only
            </label>
          </div>
          <div
            className="asset-grid tutorial-target"
            id="investment-picker"
            tabIndex="-1"
            role="group"
            aria-label="Investment choices"
          >
            {visibleAssets.map((a) => (
              <InvestmentCard
                key={a.ticker}
                asset={a}
                selected={ticker === a.ticker}
                watched={watches.includes(a.ticker)}
                showWatch={user.role === "child"}
                busy={busy}
                onSelect={() => setTicker(a.ticker)}
                onWatch={() => toggle(a.ticker)}
              />
            ))}
            {onlyWatched && !watches.length && (
              <Empty>
                Your watchlist is empty. Uncheck the filter and add an
                investment.
              </Empty>
            )}
          </div>
          {asset && (
            <div className="asset-selection-status">
              <span role="status">
                Exploring{" "}
                <strong>
                  {ticker} · {asset.name}
                </strong>
              </span>
              <button
                className="quiet"
                onClick={() => {
                  detailsHeading.current?.focus();
                  detailsHeading.current?.scrollIntoView({
                    block: "start",
                    behavior: "instant",
                  });
                }}
              >
                See details <Icon name="arrow" />
              </button>
            </div>
          )}
          {asset && (
            <section
              id="investment-details"
              className="card asset-detail"
              aria-labelledby="investment-detail-title"
            >
              <span className="eyebrow">{asset.kind}</span>
              <h2
                id="investment-detail-title"
                ref={detailsHeading}
                tabIndex="-1"
              >
                {asset.name} <span className="muted">· {ticker}</span>
              </h2>
              <p>{asset.description}</p>
              <p>
                Read the definitions for{" "}
                <Term
                  name={
                    asset.kind.toLowerCase().includes("fund") ? "fund" : "stock"
                  }
                />{" "}
                and <Term name="diversification" />.
              </p>
              <Chart asset={asset} />
              <details>
                <summary>Compare visible percentage changes</summary>
                <div className="table-wrap">
                  <table>
                    <caption>
                      Same illustrative start date, same closing-price
                      convention
                    </caption>
                    <thead>
                      <tr>
                        <th>Asset</th>
                        <th>Type</th>
                        <th>Price</th>
                        <th>Since start</th>
                      </tr>
                    </thead>
                    <tbody>
                      {market.assets.map((a) => (
                        <tr key={a.ticker}>
                          <th>
                            {a.name} ({a.ticker})
                          </th>
                          <td>{a.kind}</td>
                          <td>{dollars(a.quote.price)}</td>
                          <td>{pct(a.change_pct)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
              <details>
                <summary>Optional live market exploration</summary>
                <p>
                  This optional view requests market history from a separate
                  provider. It is read-only and never changes the price used for
                  your practice trades.
                </p>
                <button
                  className="secondary"
                  disabled={busy}
                  onClick={async () => {
                    setLiveError("");
                    setLive(null);
                    try {
                      setLive(await api(`/market/history/${ticker}`));
                    } catch (e) {
                      setLiveError(e.message);
                    }
                  }}
                >
                  Request live history
                </button>
                {liveError && <p role="status">{liveError}</p>}
                {live && (
                  <>
                    <p>
                      {live.source} · As of {live.as_of} · Fetched{" "}
                      {live.fetched_at}
                    </p>
                    <p>
                      {live.adjustment}. Last close:{" "}
                      {dollars(live.history.at(-1)?.close)}
                    </p>
                  </>
                )}
              </details>
            </section>
          )}
        </section>
        <section
          className="card trade-card tutorial-target"
          id="practice-decision"
          tabIndex="-1"
          aria-labelledby="practice-decision-title"
        >
          <h2 id="practice-decision-title">Your practice decision</h2>
          {user.role === "child" && asset ? (
            <form
              key={`${rid}-${ticker}-${market.session}`}
              onSubmit={async (e) => {
                e.preventDefault();
                const data = Object.fromEntries(new FormData(e.currentTarget));
                try {
                  const order = await act(() =>
                    api(`/runs/${rid}/orders`, {
                      ...data,
                      ticker,
                      quote: asset.quote.token,
                    }),
                  );
                  setConfirmation(order);
                } catch {
                  /* shared error region */
                }
              }}
            >
              <p>
                <strong>
                  {ticker} at {dollars(asset.quote.price)}
                </strong>
                <br />
                <small>
                  This quote is valid for 10 minutes. If it expires, refresh the
                  price before submitting.
                </small>
              </p>
              <label>
                Action
                <select name="side">
                  <option value="buy">Buy with virtual dollars</option>
                  <option value="sell">Sell for virtual dollars</option>
                </select>
              </label>
              <label>
                Practice amount ($)
                <input
                  name="amount"
                  type="number"
                  min="0.01"
                  max="1000000"
                  step="0.01"
                  required
                  placeholder="100.00"
                />
              </label>
              <p className="muted">
                You can buy part of a share, such as 0.5 shares. Your parent
                allows up to {dollars(portfolio.policy.per_order)} per purchase,
                and you have {dollars(portfolio.daily_remaining)} left in
                today's buying allowance.
              </p>
              <label>
                What's your plan, and what could go wrong?
                <textarea
                  name="reason"
                  required
                  minLength="20"
                  maxLength="1000"
                  placeholder="Explain why you chose this investment, what could cause a loss, and when you will review your decision."
                />
              </label>
              <p className="muted">
                Submitting confirms this displayed price. If it changes or
                expires, refresh and review again.
              </p>
              <button
                className="full"
                disabled={
                  busy ||
                  !!portfolio.policy.paused ||
                  portfolio.ended ||
                  portfolio.run.status !== "active"
                }
              >
                {busy
                  ? "Saving…"
                  : portfolio.run.status !== "active"
                    ? "This archived run is read-only"
                    : portfolio.policy.paused
                      ? "Trading is paused"
                      : portfolio.ended
                        ? "Scenario complete"
                        : portfolio.policy.approval
                          ? "Ask your parent"
                          : "Make practice trade"}
              </button>
            </form>
          ) : (
            <p>
              {user.role === "child"
                ? "Choose an investment to make a practice decision."
                : "Review proposed trades in Parent controls."}
            </p>
          )}
          {confirmation && (
            <div className="feedback good" role="status">
              <strong>
                {confirmation.status === "filled"
                  ? "Your practice trade is complete and appears in your transaction history."
                  : "Your request is saved and is waiting for your parent to review it."}
              </strong>
              <p>
                {confirmation.side} {dollars(confirmation.amount)} of{" "}
                {confirmation.ticker}
              </p>
              <Link
                to={user.role === "parent" ? "/parent" : "/portfolio"}
                className="text-link"
              >
                View decision history →
              </Link>
            </div>
          )}
        </section>
      </div>
    </>
  );
}

function OrderList({
  ctx,
  parent = false,
  filter = "all",
  acrossRuns = false,
}) {
  const { portfolio: p, market, perform, busy } = ctx;
  const [reviewTexts, setReviewTexts] = useState({});
  const decisions = (
    acrossRuns ? ctx.review?.orders || [] : p?.orders || []
  ).filter((order) =>
    filter === "pending"
      ? order.status === "pending"
      : filter === "reviewed"
        ? order.status !== "pending"
        : true,
  );
  if (!decisions.length)
    return (
      <p className={filter === "pending" ? "queue-empty" : "muted"}>
        {filter === "pending"
          ? "There are no requests waiting for review. New requests will appear here when your child submits a practice decision."
          : filter === "reviewed"
            ? "Reviewed decisions will appear here after approval, rejection or cancellation."
            : "You have not submitted a practice decision in this account. You can explore an investment to write a request, or continue with the lessons without making a trade."}
      </p>
    );
  return (
    <div className="order-list">
      {decisions
        .slice()
        .reverse()
        .map((order) => (
          <article
            className={`order${parent && order.status === "pending" ? " review-item" : ""}`}
            key={order.id}
          >
            <div className="order-top">
              <div className="decision-title">
                <span>{order.side === "buy" ? "Buy" : "Sell"}</span>
                <strong>{order.ticker}</strong>
                <span
                  className={`pill ${order.status !== "filled" ? "neutral" : ""}`}
                >
                  {parent
                    ? order.status
                    : {
                        pending: "Waiting for your parent",
                        filled: "Practice trade completed",
                        rejected: "Parent declined",
                        cancelled: "Cancelled",
                        stale: "Price changed: check again",
                      }[order.status] || order.status}
                </span>
              </div>
              <strong className="order-amount">
                {dollars(order.amount)}
                <small>virtual dollars</small>
              </strong>
            </div>
            <div className="decision-reason">
              <span className="field-caption">Decision reason</span>
              <p>{order.reason}</p>
            </div>
            <small>
              {acrossRuns && `${order.run_title} · Run ${order.run_id} · `}
              Proposed close {dollars(order.quoted_price)} · session{" "}
              {(order.quoted_session ?? 0) + 1} · Recorded{" "}
              {order.created.slice(0, 10)} UTC
            </small>
            {order.review && (
              <p className="review-note">Parent feedback: {order.review}</p>
            )}
            {order.status === "pending" && (
              <div className="order-actions">
                {parent ? (
                  <>
                    <label>
                      Feedback for this decision
                      <input
                        value={reviewTexts[order.id] || ""}
                        minLength="5"
                        maxLength="500"
                        onChange={(e) =>
                          setReviewTexts((t) => ({
                            ...t,
                            [order.id]: e.target.value,
                          }))
                        }
                        placeholder="What did you consider together?"
                      />
                    </label>
                    <button
                      disabled={
                        busy || (reviewTexts[order.id] || "").trim().length < 5
                      }
                      onClick={() =>
                        perform(() =>
                          api(`/orders/${order.id}/review`, {
                            action: "approve",
                            review: reviewTexts[order.id],
                          }),
                        )
                      }
                    >
                      Approve & execute
                    </button>
                    <button
                      className="secondary"
                      disabled={
                        busy || (reviewTexts[order.id] || "").trim().length < 5
                      }
                      onClick={() =>
                        perform(() =>
                          api(`/orders/${order.id}/review`, {
                            action: "reject",
                            review: reviewTexts[order.id],
                          }),
                        )
                      }
                    >
                      Reject proposal
                    </button>
                  </>
                ) : ctx.user.role === "child" ? (
                  <>
                    <button
                      className="secondary"
                      disabled={busy}
                      onClick={() =>
                        perform(() => api(`/orders/${order.id}/cancel`, {}))
                      }
                    >
                      Cancel proposal
                    </button>
                    <button
                      className="secondary"
                      disabled={busy || !market}
                      onClick={() =>
                        perform(() =>
                          api(`/orders/${order.id}/reconfirm`, {
                            quote: market.assets.find(
                              (a) => a.ticker === order.ticker,
                            ).quote.token,
                          }),
                        )
                      }
                    >
                      Reconfirm at{" "}
                      {dollars(
                        market?.assets.find((a) => a.ticker === order.ticker)
                          ?.quote.price,
                      )}
                    </button>
                  </>
                ) : null}
              </div>
            )}
          </article>
        ))}
    </div>
  );
}

function ReviewQueue({ ctx }) {
  const pending = (ctx.review?.orders || []).filter(
    (order) => order.status === "pending",
  ).length;
  return (
    <section className="review-queue" aria-label="Pending trade approvals">
      <header className="queue-heading">
        <div>
          <h2>Review queue</h2>
        </div>
        <span className="pill learning-status">{pending} pending</span>
      </header>
      <p className="muted">
        This queue includes requests from all of the selected child's practice
        runs. Read their reason and add feedback before approving or declining.
        Approval checks the current cash, holdings, limits, and quote again; a
        pending request does not reserve any funds.
      </p>
      <OrderList ctx={ctx} parent filter="pending" acrossRuns />
    </section>
  );
}

function Portfolio(ctx) {
  const { portfolio: p } = ctx;
  return (
    <>
      <Heading title="Portfolio" />
      {!p ? (
        <Empty>Loading portfolio or awaiting a child profile…</Empty>
      ) : (
        <>
          <Stats portfolio={p} date={ctx.market?.date} />
          <details className="advanced-analysis">
            <summary>View portfolio charts and analysis</summary>
            <p>
              Learn about <Term name="return" /> and <Term name="benchmark" />{" "}
              before comparing.
            </p>
            <PortfolioAnalysis analysis={ctx.analysis} />
          </details>
          <div className="portfolio-layout">
            <section className="holdings-section">
              <h2>Your investments</h2>
              {p.holdings.length ? (
                <div
                  className="table-wrap"
                  role="region"
                  aria-label="Holdings table"
                  tabIndex="0"
                >
                  <table className="financial-table">
                    <caption>Your shares at the current practice price</caption>
                    <thead>
                      <tr>
                        <th scope="col">Investment</th>
                        <th scope="col" className="numeric">
                          Shares
                        </th>
                        <th scope="col" className="numeric">
                          Value
                        </th>
                        <th scope="col" className="numeric">
                          Gain / loss while held
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {p.holdings.map((h) => (
                        <tr key={h.id}>
                          <th scope="row">
                            {h.ticker}
                            <small>{h.name}</small>
                          </th>
                          <td className="numeric">
                            {Number(h.quantity).toFixed(8)}
                          </td>
                          <td className="numeric">{dollars(h.value)}</td>
                          <td
                            className={`numeric ${Number(h.gain) < 0 ? "negative" : "positive"}`}
                          >
                            {dollars(h.gain)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p>
                  You have practice cash, but no investments yet. Explore an
                  investment or complete a lesson when you're ready.
                </p>
              )}
              <Link to="/explore" className="text-link">
                Explore investments →
              </Link>
            </section>
            <aside className="practice-boundaries">
              <h2>Spending limits</h2>
              <p>
                Maximum buy per order:{" "}
                <strong>{dollars(p.policy.per_order)}</strong>
              </p>
              <p>
                Gross bought today:{" "}
                <strong>
                  {dollars(p.daily_spent)} / {dollars(p.policy.daily)}
                </strong>
              </p>
              <p>
                Policy day: {p.policy_day} ·{" "}
                {p.run.mode === "replay" ? "replay session date" : "UTC"}
              </p>
              <p className="muted">
                Selling doesn't restore your daily buying allowance. Parent
                limits are checked again at approval.
              </p>
            </aside>
          </div>
          <section
            className="plain-section decision-history tutorial-target"
            id="practice-requests"
            tabIndex="-1"
            aria-labelledby="practice-requests-title"
          >
            <h2 id="practice-requests-title">Decisions and parent feedback</h2>
            <OrderList ctx={ctx} />
          </section>
          <section className="plain-section transaction-ledger">
            <h2>Executed transactions</h2>
            {p.fills.length ? (
              <div
                className="table-wrap"
                role="region"
                aria-label="Executed transactions table"
                tabIndex="0"
              >
                <table className="financial-table">
                  <caption>Completed practice purchases and sales</caption>
                  <thead>
                    <tr>
                      <th>Action</th>
                      <th>Investment</th>
                      <th className="numeric">Shares</th>
                      <th className="numeric">Price</th>
                      <th className="numeric">Total</th>
                      <th>Session / date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {p.fills.map((f) => (
                      <tr key={f.id}>
                        <td>{f.side}</td>
                        <th>{f.ticker}</th>
                        <td className="numeric">
                          {Number(f.quantity).toFixed(8)}
                        </td>
                        <td className="numeric">{dollars(f.price)}</td>
                        <td className="numeric">{dollars(f.amount)}</td>
                        <td>
                          {f.session + 1}
                          <small>{f.policy_day}</small>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="muted">
                No simulated transactions have executed yet.
              </p>
            )}
          </section>
          <AccountHistory run={p.run} fills={p.fills} orders={p.orders} />
        </>
      )}
    </>
  );
}

function Scenarios(ctx) {
  const { user, portfolio: p, market, perform, busy, rid } = ctx;
  return (
    <>
      <Heading title="Market replay" tutorialId="market-replay">
        Choose a scenario to see how your practice investments change over
        several market sessions. You can make a decision or keep your cash, then
        advance to reveal the next session's prices. Each scenario keeps its own
        portfolio and saves your place.
      </Heading>
      <ScenarioLibrary ctx={ctx} />
      {p?.run.mode === "replay" && (
        <>
          <div className="card replay-banner">
            <div>
              <span className="eyebrow">
                SYNTHETIC MARKET REPLAY · SESSION {p.run.session + 1} OF{" "}
                {p.scenario.sessions}
              </span>
              <h2>{p.scenario.title}</h2>
              <strong>{market?.date || "Loading session…"}</strong>
              <p>{market?.news}</p>
            </div>
            <div>
              {user.role === "child" && (
                <button
                  disabled={busy || p.ended || p.run.status !== "active"}
                  onClick={() =>
                    perform(() =>
                      api(`/runs/${rid}/advance`, {
                        expected_session: p.run.session,
                      }),
                    )
                  }
                >
                  {p.run.status !== "active"
                    ? "This archived run is read-only"
                    : p.ended
                      ? "Scenario completed"
                      : "See what happened next →"}
                </button>
              )}
              <Link className="text-link" to="/explore">
                Review prices & decisions →
              </Link>
            </div>
          </div>
          <div className="progress-track">
            <div
              style={{
                width: `${((p.run.session + 1) / p.scenario.sessions) * 100}%`,
              }}
            />
          </div>
          <Stats portfolio={p} date={market?.date} />
          <section className="card">
            <h2>Portfolio and benchmark comparison</h2>
            <div className="benchmark">
              <div>
                <span>Your virtual portfolio</span>
                <strong>{dollars(p.total)}</strong>
                <small>{pct(p.return_pct)} since start</small>
              </div>
              <div>
                <span>
                  VTI buy-and-hold <Term name="benchmark" />
                </span>
                <strong>{dollars(p.benchmark_value)}</strong>
                <small>{pct(p.benchmark_return_pct)} since start</small>
              </div>
              <div>
                <span>Difference in value</span>
                <strong>{dollars(p.difference)}</strong>
              </div>
            </div>
            <p className="muted">
              Both portfolios begin with {dollars(p.run.starting)} on the same
              date. The benchmark invests that entire amount in VTI and keeps
              those shares throughout the scenario. Your cash earns no interest,
              and the comparison excludes dividends, fees, taxes, and additional
              contributions. A higher result does not by itself show that a
              decision was well reasoned.
            </p>
          </section>
          <details className="advanced-analysis">
            <summary>View scenario charts and analysis</summary>
            <PortfolioAnalysis analysis={ctx.analysis} />
          </details>
          <div className="two-col">
            <section className="card">
              <h2>Review your reasoning</h2>
              <OrderList ctx={ctx} />
            </section>
            <Reflection ctx={ctx} />
          </div>
          <p className="muted">
            {market?.provenance.source}. {market?.provenance.adjustment}.
          </p>
        </>
      )}
    </>
  );
}

function ScenarioLibrary({ ctx }) {
  const { scenarios, portfolio: p, user, busy, perform, setRid } = ctx;
  return (
    <details
      className="scenario-library"
      key={p?.run.mode || "loading"}
      open={p?.run.mode !== "replay"}
    >
      <summary>Choose a practice scenario</summary>
      <p className="muted">
        These scenarios use made-up prices rather than real market history. Each
        one keeps a separate portfolio and session date, but purchases across
        scenarios count toward the same daily limit when their dates match.
      </p>
      <ol className="scenario-list">
        {scenarios.map((s) => (
          <li key={s.id}>
            <div>
              <span className="eyebrow">
                {s.focus} · {s.sessions} sessions
              </span>
              <h2>{s.title}</h2>
              <p>{s.description}</p>
            </div>
            {user.role === "child" ? (
              <button
                disabled={
                  busy ||
                  (p?.run.scenario === s.id && p.run.status === "active")
                }
                onClick={() =>
                  perform(async () => {
                    const r = await api("/runs", {
                      mode: "replay",
                      scenario: s.id,
                    });
                    setRid(r.run_id);
                  })
                }
              >
                {p?.run.scenario === s.id && p.run.status === "active"
                  ? "Selected scenario"
                  : "Start market replay"}
              </button>
            ) : (
              <span className="muted">Switch to the child to start</span>
            )}
          </li>
        ))}
      </ol>
    </details>
  );
}

function Reflection({ ctx }) {
  const { user, rid, portfolio: p, perform, busy } = ctx;
  const [saved, setSaved] = useState(false);
  return (
    <section className="card">
      <h2>Write a reflection</h2>
      <p>
        Compare the outcome with the reason you wrote before making a decision.
        Describe a risk you noticed and explain whether you would change your
        plan. You can also write about choosing to wait or keep cash instead of
        making a trade.
      </p>
      {user.role === "child" && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const form = e.currentTarget;
            const content = new FormData(form).get("text");
            perform(async () => {
              await api(`/runs/${rid}/reflection`, { text: content });
              setSaved(true);
              form.reset();
            });
          }}
        >
          <label>
            Your reflection
            <textarea name="text" required minLength="30" maxLength="2000" />
          </label>
          <button disabled={busy}>Save reflection</button>
        </form>
      )}
      {saved && (
        <p className="positive" role="status">
          Your reflection has been saved with this practice run.
        </p>
      )}
      {p.reflections.map((r) => (
        <blockquote key={r.id}>
          <p>{r.text}</p>
          <small>Saved {r.created.slice(0, 10)}</small>
        </blockquote>
      ))}
    </section>
  );
}

function Parent(ctx) {
  const { policy, cid, perform, busy, portfolio: p, review } = ctx;
  const [notice, setNotice] = useState("");
  return (
    <>
      <Heading title="Parent controls" />
      {p && <ReviewQueue ctx={ctx} />}
      <div className="two-col family-settings">
        <section className="settings-section">
          <h2>Add a child profile</h2>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const form = e.currentTarget;
              const data = Object.fromEntries(new FormData(form));
              perform(async () => {
                const r = await api("/children", data);
                setNotice(`Profile ${r.name} created and selected.`);
                form.reset();
                await ctx.refreshSession(r.id);
              });
            }}
          >
            <label>
              Fictional nickname
              <input
                name="name"
                required
                pattern="[A-Za-z0-9_-]{2,24}"
                minLength="2"
                maxLength="24"
              />
            </label>
            {!ctx.publicPreview && (
              <label>
                Child PIN
                <input
                  name="pin"
                  type="password"
                  required
                  pattern="[0-9]{6,12}"
                  minLength="6"
                  maxLength="12"
                  autoComplete="new-password"
                />
              </label>
            )}
            {ctx.publicPreview && (
              <input type="hidden" name="pin" value="123456" />
            )}
            <label>
              Starting virtual funds
              <input
                name="starting"
                type="number"
                defaultValue="1000"
                min="0.01"
                max="1000000"
                step="0.01"
                required
              />
            </label>
            <button disabled={busy}>Create child profile</button>
          </form>
          {notice && (
            <p role="status" className="positive">
              {notice}
            </p>
          )}
          <p className="muted">
            {ctx.publicPreview ? (
              "Demo profiles use role switching. No PIN or password is stored, and this device's practice is not shared with other visitors."
            ) : (
              <>
                Family code: <strong>{ctx.familyCode}</strong>. A child signs in
                with this code, their nickname and PIN. Judge demo uses the role
                switch instead.
              </>
            )}
          </p>
        </section>
        <section className="settings-section">
          <h2>Virtual trading limits</h2>
          {!policy ? (
            <p>Create a child profile to set limits.</p>
          ) : (
            <form
              key={`${cid}-${policy.starting}-${policy.per_order}-${policy.daily}-${policy.approval}-${policy.paused}`}
              onSubmit={(e) => {
                e.preventDefault();
                const data = new FormData(e.currentTarget);
                perform(async () => {
                  await api(
                    `/children/${cid}/policy`,
                    {
                      starting: data.get("starting"),
                      per_order: data.get("per_order"),
                      daily: data.get("daily"),
                      approval: data.has("approval"),
                      paused: data.has("paused"),
                    },
                    "PUT",
                  );
                  setNotice(
                    "Your trading limits have been saved. The starting balance applies when you create or reset a practice run, not to the balance in an existing run.",
                  );
                });
              }}
            >
              <label>
                Starting virtual funds for new / reset runs
                <input
                  name="starting"
                  type="number"
                  defaultValue={policy.starting}
                  min="0.01"
                  max="1000000"
                  step="0.01"
                  required
                />
              </label>
              <label>
                Maximum virtual buy per order
                <input
                  name="per_order"
                  type="number"
                  defaultValue={policy.per_order}
                  min="0"
                  max="1000000"
                  step="0.01"
                  required
                />
              </label>
              <label>
                Daily gross virtual buying limit
                <input
                  name="daily"
                  type="number"
                  defaultValue={policy.daily}
                  min="0"
                  max="1000000"
                  step="0.01"
                  required
                />
              </label>
              <label className="inline-check">
                <input
                  name="approval"
                  type="checkbox"
                  defaultChecked={!!policy.approval}
                />
                Require parent approval for buys and sells
              </label>
              <label className="inline-check">
                <input
                  name="paused"
                  type="checkbox"
                  defaultChecked={!!policy.paused}
                />
                Pause trading (keep learning available)
              </label>
              <button disabled={busy}>Save virtual limits</button>
              <p className="muted">
                The daily allowance counts all completed purchases before
                subtracting sales, so selling does not restore it. A market
                replay uses its session date to determine the day; the practice
                wallet uses the current UTC date.
              </p>
            </form>
          )}
        </section>
      </div>
      {p && (
        <>
          <section className="plain-section decision-history">
            <h2>Reviewed decisions</h2>
            <OrderList ctx={ctx} parent filter="reviewed" acrossRuns />
          </section>
          <LearningHistory learning={ctx.learning} parent />
          <div className="two-col">
            <section className="card">
              <h2>Learning & reflection</h2>
              <p>
                {ctx.progress.filter((x) => x.completed).length} / 6 lessons
                completed
              </p>
              {ctx.progress.map((p) => (
                <p key={p.id}>
                  {ctx.lessons.find((l) => l.id === p.lesson)?.title} ·{" "}
                  {p.completed ? "Completed" : "In progress"} · {p.attempts}{" "}
                  attempt(s)
                </p>
              ))}
              {review?.reflections.map((r) => (
                <blockquote key={r.id}>
                  <p>{r.text}</p>
                  <small>Run {r.run_id}</small>
                </blockquote>
              ))}
              <p>
                {review?.fills.length || 0} executed simulated transaction(s)
                across practice runs.
              </p>
            </section>
            <section className="card">
              <h2>Reset this practice run</h2>
              <p>
                Archive this run and start again with the configured virtual
                funds. Decision history remains recorded and lesson progress
                stays saved.
              </p>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const reason = new FormData(e.currentTarget).get("reason");
                  perform(async () => {
                    const result = await api(`/runs/${p.run.id}/reset`, {
                      reason,
                    });
                    ctx.setRid(result.run_id);
                    setNotice(
                      "Practice reset recorded. Your previous run is archived.",
                    );
                  });
                }}
              >
                <label>
                  Why are you resetting?
                  <input
                    name="reason"
                    minLength="10"
                    maxLength="300"
                    required
                  />
                </label>
                <button
                  className="secondary"
                  disabled={busy || p.run.status !== "active"}
                >
                  {p.run.status !== "active"
                    ? "Select an active run to reset it"
                    : "Archive & reset practice"}
                </button>
              </form>
              <details>
                <summary>Recorded family events</summary>
                {review?.events.length ? (
                  review.events.map((ev) => (
                    <p key={ev.id}>
                      {ev.kind === "reset"
                        ? "Practice reset recorded"
                        : "Virtual policies updated"}{" "}
                      · {ev.created.slice(0, 10)}
                      <br />
                      <small>{ev.detail}</small>
                    </p>
                  ))
                ) : (
                  <p>No parent changes recorded yet.</p>
                )}
              </details>
            </section>
          </div>
        </>
      )}
    </>
  );
}

function Tools(ctx) {
  const { glossary, goal, user, cid, perform, busy } = ctx;
  const [search, setSearch] = useState("");
  const terms = Object.entries(glossary).filter(([term, definition]) =>
    `${term} ${definition}`.toLowerCase().includes(search.trim().toLowerCase()),
  );
  const [principal, setPrincipal] = useState("100");
  const [rate, setRate] = useState("5");
  const [years, setYears] = useState("5");
  const [contribution, setContribution] = useState("20");
  const [saved, setSaved] = useState(false);
  const valid =
    [principal, rate, years, contribution].every(
      (x) => x !== "" && Number.isFinite(Number(x)),
    ) &&
    Number(principal) >= 0 &&
    Number(principal) <= 1000000 &&
    Number(contribution) >= 0 &&
    Number(contribution) <= 100000 &&
    Number(rate) >= -50 &&
    Number(rate) <= 50 &&
    Number(years) >= 1 &&
    Number(years) <= 50 &&
    Number.isInteger(Number(years));
  let result = Number(principal);
  if (valid)
    for (let i = 0; i < Number(years) * 12; i++)
      result = result * (1 + Number(rate) / 1200) + Number(contribution);
  return (
    <>
      <Heading title="Learning tools" />
      <div className="two-col">
        <section className="card">
          <h2>Compounding calculator</h2>
          <p>
            Enter a starting amount, an assumed return, and a monthly
            contribution to see how compounding works. The calculation keeps the
            assumed rate fixed, so it illustrates the math rather than
            predicting a market result.
          </p>
          <div className="two-col compact">
            {[
              ["Starting amount ($)", principal, setPrincipal, 0, 1000000],
              ["Assumed annual rate (%)", rate, setRate, -50, 50],
              ["Years", years, setYears, 1, 50],
              [
                "Monthly contribution ($)",
                contribution,
                setContribution,
                0,
                100000,
              ],
            ].map(([label, value, set, min, max]) => (
              <label key={label}>
                {label}
                <input
                  type="number"
                  value={value}
                  onChange={(e) => set(e.target.value)}
                  min={min}
                  max={max}
                  step={label === "Years" ? 1 : "0.01"}
                />
              </label>
            ))}
          </div>
          <output className="calculator-result">
            {valid
              ? dollars(result)
              : "Enter values within the displayed ranges."}
          </output>
          <p className="muted">
            The annual rate is divided by 12 and compounded monthly, with
            contributions added at each month's end. Taxes, fees, and inflation
            are excluded. Actual investment returns vary and can be negative,
            and using this calculator does not change your practice balance.
          </p>
        </section>
        <section className="card">
          <h2>Your illustrative savings goal</h2>
          <p>
            Give a future project a name and an example target so you can
            consider how long you would need to save. This is a learning
            exercise, not a savings account, and your practice money cannot be
            withdrawn.
          </p>
          {user.role === "child" && cid ? (
            <form
              key={goal?.id || "new"}
              onSubmit={(e) => {
                e.preventDefault();
                const data = Object.fromEntries(new FormData(e.currentTarget));
                perform(async () => {
                  await api(`/children/${cid}/goal`, data, "PUT");
                  setSaved(true);
                });
              }}
            >
              <label>
                Goal name
                <input
                  name="title"
                  defaultValue={goal?.title}
                  minLength="3"
                  maxLength="80"
                  required
                  placeholder="A future project"
                />
              </label>
              <label>
                Illustrative target ($)
                <input
                  name="target"
                  type="number"
                  min="0.01"
                  max="1000000"
                  step="0.01"
                  defaultValue={goal?.target || "500"}
                  required
                />
              </label>
              <button disabled={busy}>Save goal</button>
              {saved && (
                <p role="status">
                  Your goal has been saved and is shown on Home.
                </p>
              )}
            </form>
          ) : (
            <p>
              {goal
                ? `${goal.title}: ${dollars(goal.target)}`
                : "The child can set a goal here."}
            </p>
          )}
        </section>
      </div>
      <section
        className="card glossary-section"
        aria-label="Investing glossary"
      >
        <h2>Investing glossary</h2>
        <p>
          Search for a word from a lesson or investment description. You can
          also select one of the terms below to read an example in a separate
          window.
        </p>
        <label>
          Find an investing term
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>
        <p className="definition-links">
          <Term name="stock" /> <Term name="fund" />{" "}
          <Term name="diversification" /> <Term name="return" />{" "}
          <Term name="benchmark" />
        </p>
        <p className="sr-only" role="status">
          {terms.length} matching glossary terms.
        </p>
        <dl className="glossary">
          {terms.map(([term, definition]) => (
            <div key={term}>
              <dt>{term}</dt>
              <dd>{definition}</dd>
            </div>
          ))}
        </dl>
        {!terms.length && (
          <p>
            No glossary entries match this search. Try another word or clear the
            search to see all terms.
          </p>
        )}
      </section>
      <details className="installation-help">
        <summary>Install Sprout on your device</summary>
        <InstallApp />
      </details>
    </>
  );
}

export default function App() {
  return (
    <HashRouter>
      <Definitions>
        <AppContent />
      </Definitions>
    </HashRouter>
  );
}
