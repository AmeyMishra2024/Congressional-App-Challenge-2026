import { createContext, useContext, useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { api } from "../api.js";
import Icon from "./Icon.jsx";
import StudentActivities from "./StudentActivities.jsx";

const money = (v) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
    Number(v || 0),
  );
export const definitions = {
  stock: {
    title: "Stock",
    short: "A stock gives its owner a small ownership interest in a company.",
    example:
      "If a company has 1,000 equal shares, 10 shares represent 1% of those shares.",
    more: "A share's price can fall. Dividends are not guaranteed, and owning shares does not let you withdraw the company's cash.",
    lesson: "ownership",
  },
  fund: {
    title: "Fund",
    short:
      "A fund holds a collection of investments on behalf of the people who own it.",
    example:
      "A broad stock fund may hold shares in hundreds of different companies.",
    more: "Not every fund is broadly spread out. Check what it owns, its costs, and its risks. An ETF is a fund whose shares trade on an exchange.",
    lesson: "ownership",
  },
  diversification: {
    title: "Diversification",
    short:
      "Diversification means spreading money across different investments so the result depends less on any one of them.",
    example:
      "Putting $50 in each of two different investments depends less on one company than putting all $100 there.",
    more: "Different investments can fall together. Two similar technology companies may share many risks; diversification cannot prevent every loss.",
    lesson: "diversification",
  },
  return: {
    title: "Return",
    short:
      "Return measures how much an investment has gained or lost compared with its starting value.",
    example: "$100 becoming $90 is a $10 loss: a −10% return.",
    more: "In this app the return is the change in virtual value divided by starting value. The simplified scenarios exclude fees, dividends, taxes, and added money.",
    lesson: "risk",
  },
  benchmark: {
    title: "Benchmark",
    short:
      "A benchmark provides a reference for comparing an investment's performance over the same period.",
    example:
      "Here we compare with putting the same starting amount in VTI and leaving it invested on matching scenario dates.",
    more: "This is a synthetic buy-and-hold comparison, not a prediction or a target you must beat. Different amounts of cash and risk can explain different outcomes.",
    lesson: "charts",
  },
};
const DefinitionContext = createContext(null);
export function Definitions({ children }) {
  const [term, setTerm] = useState(null);
  const dialog = useRef(null);
  const opener = useRef(null);
  const open = (key) => {
    opener.current = document.activeElement;
    setTerm(key);
  };
  useEffect(() => {
    if (term && !dialog.current.open) dialog.current.showModal();
  }, [term]);
  const d = definitions[term];
  return (
    <DefinitionContext.Provider value={open}>
      {children}
      <dialog
        ref={dialog}
        className="definition-dialog"
        aria-labelledby="definition-title"
        onClose={() => {
          setTerm(null);
          opener.current?.focus();
        }}
      >
        {d && (
          <>
            <div className="split">
              <span>Definition</span>
              <button
                className="quiet"
                onClick={() => dialog.current.close()}
                aria-label="Close definition"
              >
                Close
              </button>
            </div>
            <h2 id="definition-title">{d.title}</h2>
            <p className="definition-short">{d.short}</p>
            <div className="teaching-example">
              <strong>For example</strong>
              <p>{d.example}</p>
            </div>
            <details>
              <summary>A little more detail</summary>
              <p>{d.more}</p>
            </details>
            <Link
              className="text-link"
              to={`/lessons/${d.lesson}`}
              onClick={() => dialog.current.close()}
            >
              Open the related lesson →
            </Link>
          </>
        )}
      </dialog>
    </DefinitionContext.Provider>
  );
}
export function Term({ name, children }) {
  const open = useContext(DefinitionContext);
  return (
    <button
      type="button"
      className="term"
      onClick={() => open(name)}
      aria-label={`Define ${name}`}
    >
      {children || name}
      <span aria-hidden="true"> ?</span>
    </button>
  );
}

export function LessonVisual({ id }) {
  if (id === "diversification")
    return (
      <figure className="lesson-visual">
        <figcaption>One company vs. a basket</figcaption>
        <div className="basket-compare">
          <div>
            <div className="investment-block single">
              One company
              <br />
              $100 → $80
            </div>
            <strong>$20 loss</strong>
          </div>
          <div>
            <div className="basket">
              <span>$50 → $40</span>
              <span>$50 → $50</span>
            </div>
            <strong>$10 loss</strong>
          </div>
        </div>
        <p>
          Illustration: one company falls 20%; the other stays unchanged. Both
          could fall together.
        </p>
      </figure>
    );
  if (["risk", "charts", "compounding"].includes(id)) {
    const values =
      id === "compounding"
        ? ["$100", "+5% assumed", "$105", "$110.25 after year 2"]
        : id === "charts"
          ? ["$200", "+5%", "$210", "$20 → $21 is also +5%"]
          : ["$100", "−10%", "$90", "$90 needs +11.11% to reach $100 again"];
    return (
      <figure className="lesson-visual">
        <figcaption>Follow the percentage</figcaption>
        <div className="money-sequence">
          <span>
            <small>Start</small>
            <strong>{values[0]}</strong>
          </span>
          <span className="change">{values[1]} →</span>
          <span>
            <small>Result</small>
            <strong>{values[2]}</strong>
          </span>
        </div>
        <p>
          {values[3]}. This calculation illustrates the percentage change and
          does not predict an investment's future value.
        </p>
      </figure>
    );
  }
  if (id === "decisions")
    return (
      <figure className="lesson-visual">
        <figcaption>A decision you can explain</figcaption>
        <ol className="reasoning-path">
          <li>My goal</li>
          <li>What I know</li>
          <li>What could go wrong</li>
          <li>When I'll review</li>
        </ol>
        <p>Choosing not to invest is a valid decision too.</p>
      </figure>
    );
  return (
    <figure className="lesson-visual">
      <figcaption>A share is a piece of ownership</figcaption>
      <div
        className="ownership-grid"
        aria-label="10 of 100 pieces highlighted: 10 percent ownership"
      >
        {Array.from({ length: 100 }, (_, i) => (
          <i key={i} className={i < 10 ? "owned" : ""} />
        ))}
      </div>
      <p>
        10 of 100 equal pieces = 10%. This diagram is a different example from
        the exercise below.
      </p>
    </figure>
  );
}

export function LearningWelcome({ session, accept, perform, busy }) {
  const [tab, setTab] = useState(null);
  const startDemo = () => perform(async () => accept(await api("/demo", {})));
  const startPreview = () =>
    perform(async () => {
      const family = await api("/demo", { resume: true });
      accept(
        await api("/demo/switch", {
          role: "child",
          child_id: family.children[0].id,
        }),
      );
    });
  return (
    <div className="learning-welcome">
      <header>
        <span className="welcome-brand">
          <Icon name="brand" />
          {session.app_name || "Sprout"}
        </span>
      </header>
      <div className="welcome-columns">
        <section className="learning-intro">
          <h1>Learn about investing with a practice account</h1>
          <p className="welcome-promise">
            Sprout introduces stocks, funds, and investment risk through lessons
            and a practice account. You can explain a decision, see how it
            performs in a made-up market, and review it with a parent without
            using real money.
          </p>
          <details className="welcome-how">
            <summary>How the practice account works</summary>
            <ol className="welcome-example" aria-label="How to get started">
              <li>
                <Icon name="portfolio" />
                <strong>Lessons</strong>
                <span>
                  Begin with an explanation, work through an example, and answer
                  the exercise.
                </span>
              </li>
              <li>
                <Icon name="explore" />
                <strong>Practice account</strong>
                <span>
                  Compare investments and write down your reason before
                  requesting a practice trade.
                </span>
              </li>
              <li>
                <Icon name="replay" />
                <strong>Market replay</strong>
                <span>
                  Advance through a scenario and compare the outcome with the
                  plan you wrote.
                </span>
              </li>
            </ol>
          </details>
        </section>
        <section className="entry-panel">
          <h2>
            {session.public_preview
              ? "Try the public preview"
              : "Open your account"}
          </h2>
          <p>
            {session.public_preview
              ? "The preview uses a fictional family and saves practice in this browser only. You can switch between student and parent views, but real accounts and shared progress are not available here."
              : "If your parent has created a profile for you, choose Start learning and use the family code, nickname, and PIN they gave you. A parent who is setting up the family for the first time should choose Parent setup."}
          </p>
          {session.public_preview ? (
            <button
              className="button-gold preview-entry"
              disabled={busy}
              onClick={startPreview}
            >
              {busy ? "Opening practice app…" : "Open practice app"}{" "}
              <Icon name="arrow" />
            </button>
          ) : (
            <div className="entry-actions">
              <button className="button-gold" onClick={() => setTab("child")}>
                Start learning <Icon name="arrow" />
              </button>
              <button className="secondary" onClick={() => setTab("register")}>
                Parent setup
              </button>
              <button className="quiet" onClick={() => setTab("parent")}>
                Sign in
              </button>
            </div>
          )}
          {tab && !session.public_preview && (
            <div className="account-entry">
              <h3>
                {tab === "register"
                  ? "Create your family"
                  : tab === "child"
                    ? "Open your learning space"
                    : "Welcome back"}
              </h3>
              <p>
                {tab === "child"
                  ? "Use the family code, nickname, and PIN your parent set up. New here? Ask your parent to choose Parent setup first."
                  : tab === "register"
                    ? "Create a parent account, then add a child nickname and PIN. No bank or school details needed."
                    : "Choose your account and sign in."}
              </p>
              <div className="tabs" aria-label="Account type">
                {[
                  ["child", "Child sign in"],
                  ["parent", "Parent sign in"],
                  ["register", "Create family"],
                ].map(([value, label]) => (
                  <button
                    type="button"
                    className={tab === value ? "selected" : "quiet"}
                    key={value}
                    onClick={() => setTab(value)}
                    aria-pressed={tab === value}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <form
                key={tab}
                onSubmit={(e) => {
                  e.preventDefault();
                  const data = Object.fromEntries(
                    new FormData(e.currentTarget),
                  );
                  perform(async () =>
                    accept(
                      await api(tab === "register" ? "/register" : "/login", {
                        ...data,
                        role: tab,
                      }),
                    ),
                  );
                }}
              >
                {tab === "child" && (
                  <label>
                    Family code
                    <input name="family_code" required autoComplete="off" />
                  </label>
                )}
                <label>
                  {tab === "child" ? "Nickname" : "Parent username"}
                  <input
                    name="username"
                    required
                    maxLength="40"
                    autoComplete="username"
                  />
                </label>
                <label>
                  {tab === "child" ? "PIN (6–12 digits)" : "Password"}
                  <input
                    name="password"
                    type="password"
                    required
                    minLength={tab === "register" ? 10 : undefined}
                    maxLength="128"
                    autoComplete={
                      tab === "register" ? "new-password" : "current-password"
                    }
                  />
                </label>
                {tab === "register" && (
                  <p className="muted">
                    Use at least 10 characters. Keep your password separate from
                    your child's PIN.
                  </p>
                )}
                <button disabled={busy}>
                  {busy
                    ? "Opening…"
                    : tab === "register"
                      ? "Create family account"
                      : "Sign in"}
                </button>
              </form>
            </div>
          )}
          {!session.public_preview && (
            <details className="demo-entry">
              <summary>Try a demonstration</summary>
              <p>
                You can try the lessons and parent controls using a fictional
                family without creating an account. Activity in this
                demonstration does not affect a real family's data.
              </p>
              <button className="secondary" disabled={busy} onClick={startDemo}>
                Start judge demo
              </button>
            </details>
          )}
        </section>
      </div>
    </div>
  );
}

export function ChildHome(ctx) {
  const { user, portfolio: p, lessons, progress, market } = ctx;
  const completed = progress.filter((x) => x.completed).length;
  const next = lessons.find(
    (l) => !progress.some((x) => x.lesson === l.id && x.completed),
  );
  const pending = p?.orders.filter((o) => o.status === "pending").length || 0;
  const triedLesson = progress.some((x) => x.attempts);
  const hasInvestment = !!p?.fills.length;
  const showResult =
    p?.run.mode === "replay" && p.run.session > 0 && hasInvestment;
  const target =
    showResult || pending || hasInvestment
      ? "/scenarios"
      : completed
        ? "/explore"
        : next
          ? `/lessons/${next.id}`
          : "/lessons";
  const label = showResult
    ? "Review your result"
    : pending
      ? "Follow your practice scenario"
      : hasInvestment
        ? "See what happened next"
        : completed
          ? "Try a practice investment"
          : triedLesson
            ? "Continue your lesson"
            : "Start your first lesson";
  if (!p) return <p role="status">Opening your saved practice wallet…</p>;
  return (
    <div className="child-home">
      <div className="page-heading">
        <div>
          <h1>Hi, {user.name}.</h1>
        </div>
      </div>
      <section
        id="practice-wallet"
        className="child-wallet tutorial-target"
        tabIndex="-1"
        aria-label="Virtual portfolio summary"
      >
        <div>
          <span className="balance-label">Your practice money</span>
          <strong>{money(p?.total)}</strong>
          <p>
            Cash + your investments{market?.date ? ` · ${market.date}` : ""}
          </p>
        </div>
        <dl>
          <div>
            <dt>Ready to use</dt>
            <dd>{money(p?.run.cash)}</dd>
          </div>
          <div>
            <dt>In investments</dt>
            <dd>
              {money(
                p?.holdings_value ??
                  Number(p?.total || 0) - Number(p?.run.cash || 0),
              )}
            </dd>
          </div>
        </dl>
        <Icon name="portfolio" />
      </section>
      <section className="child-next">
        <div>
          <h2>
            {showResult
              ? "Review your scenario results"
              : pending
                ? "Your parent has a decision to review."
                : hasInvestment
                  ? "Continue your market replay"
                  : completed
                    ? "Explore the practice investments"
                    : next?.title || "Your lessons are loading…"}
          </h2>
          <p>
            {showResult
              ? "Compare the outcome with your original reason. A gain doesn't prove a good decision, and a loss doesn't prove a bad one."
              : pending
                ? "You can keep learning while you wait. Pending requests don't set money aside."
                : hasInvestment
                  ? "Move the scenario forward to see how prices change. You don't need to make another trade."
                  : completed
                    ? "Choose an investment, explain the risk, and ask your parent when review is required."
                    : "Open the next lesson, work through its example, and complete the exercise to save your progress. You can start here without making a practice trade."}
          </p>
          <Link className="button button-gold" to={target}>
            {label} <Icon name="arrow" />
          </Link>
        </div>
        <div className="learning-meter">
          <strong>
            {completed}
            <span> / {lessons.length || 6}</span>
          </strong>
          <span>lessons completed</span>
          <progress
            value={completed}
            max={lessons.length || 6}
            aria-label="Saved lesson completion"
          />
          <p>
            {next
              ? `Learning next: ${next.title}`
              : "You have completed all six lessons and can reopen them whenever you want to review."}
          </p>
        </div>
      </section>
      <StudentActivities
        completed={completed}
        lessons={lessons}
        portfolio={p}
      />
      {!!ctx.policy?.paused && (
        <p className="notice">
          Trading is paused. Lessons and market replay are still available.
        </p>
      )}
      {pending > 0 && (
        <p>
          <Link to="/portfolio">
            {pending} requests waiting for parent review
          </Link>
        </p>
      )}
      {ctx.goal && (
        <section className="saved-goal" aria-label="Saved learning goal">
          <div>
            <strong>{ctx.goal.title}</strong>
            <span>
              Your learning goal is {money(ctx.goal.target)}. Practice funds
              cannot be withdrawn or used to pay for it.
            </span>
          </div>
          <Link to="/tools">
            Edit goal <Icon name="arrow" />
          </Link>
        </section>
      )}
    </div>
  );
}

const tourSteps = [
  [
    "Meet your practice wallet",
    "Your practice balance combines available cash and the current value of your investments. You can use only the cash for a new purchase, and none of these funds are real money.",
    "/dashboard",
    "See my wallet",
  ],
  [
    "Explore one investment",
    "Select a card in Explore to read about an investment and view its practice price. The star saves it to your watchlist without placing a trade, so you can return to it later.",
    "/explore",
    "Explore an investment",
  ],
  [
    "Find a definition",
    "Dotted terms open definitions with an example and a link to the related lesson. Select one below to see how this works, then close the definition to return here.",
  ],
  [
    "Explain a practice decision",
    "The decision form in Explore asks for an amount and your reason for choosing an investment. Explain your goal, a risk, and when you plan to review it. Submitting this form creates an actual request in your practice account, but you do not need to submit one to finish the tutorial.",
    "/explore",
    "Find the practice form",
  ],
  [
    "Understand parent review",
    "When review is required, your request waits for your parent. Your parent signs in separately, reviews the reason and current limits, then approves or declines. Cash is not reserved while you wait.",
    "/portfolio",
    "See my requests",
  ],
  [
    "See what happens next",
    "Choose a scenario in Market replay. Its next prices stay hidden until you choose See what happened next. Then compare the change and save a reflection.",
    "/scenarios",
    "Open market replay",
  ],
];
const tourStages = [
  ["Wallet", "portfolio"],
  ["Explore", "explore"],
  ["Words", "lessons"],
  ["Plan", "tools"],
  ["Review", "parent"],
  ["Reflect", "replay"],
];
const tourTargets = [
  "practice-wallet",
  "investment-picker",
  null,
  "practice-decision",
  "practice-requests",
  "market-replay",
];

// A route change alone is not enough: the destination may already be open or
// still waiting for its saved data. Focus only after its real DOM is mounted.
export function TutorialDestination({ portfolio, market }) {
  const location = useLocation();
  const handled = useRef(null);
  useEffect(() => {
    const id = location.state?.tutorialTarget;
    if (!id || !tourTargets.includes(id) || handled.current === location.key)
      return;
    const target = document.getElementById(id);
    if (!target) return;
    target.focus({ preventScroll: true });
    target.scrollIntoView({ block: "start", behavior: "instant" });
    handled.current = location.key;
  }, [location.key, location.state, portfolio, market]);
  return null;
}

export function TutorialPage(ctx) {
  const navigate = useNavigate();
  const t = ctx.tutorial;
  const step = t?.status === "completed" ? 0 : t?.step || 0;
  return (
    <section className="tutorial-hub" aria-labelledby="tutorial-hub-title">
      <div className="tutorial-hub-intro">
        <span className="activity-icon">
          <Icon name="guide" />
        </span>
        <h1 id="tutorial-hub-title">Getting started with Sprout</h1>
        <p>
          This tutorial shows you where to find your balance, explore
          investments, and review a decision. Your place is saved when you
          pause, and you can finish all six steps without making a trade.
        </p>
        <button
          className="button-gold"
          disabled={ctx.busy || !t}
          onClick={async () => {
            const saved = await ctx.saveTutorial("in_progress", step);
            if (saved) {
              navigate(tourSteps[step][2] || "/explore", {
                state: { tutorialTarget: tourTargets[step] },
              });
            }
          }}
        >
          {t?.status === "completed"
            ? "Restart guided tutorial"
            : t?.status === "not_started"
              ? "Start guided tutorial"
              : "Continue guided tutorial"}
          <Icon name="arrow" />
        </button>
        {t && t.status !== "not_started" && (
          <span className="tutorial-saved-state">
            {t.status === "completed"
              ? "You have visited all six tutorial steps and can restart them without changing your lessons or balance."
              : `Your saved place: Step ${step + 1} · ${tourSteps[step][0]}`}
          </span>
        )}
      </div>
      <ol className="tutorial-roadmap" aria-label="Tutorial overview">
        {tourSteps.map((step, i) => (
          <li
            key={step[0]}
            aria-current={
              t?.status !== "not_started" &&
              t?.status !== "completed" &&
              i === t?.step
                ? "step"
                : undefined
            }
          >
            <span className="roadmap-number">
              {String(i + 1).padStart(2, "0")}
            </span>
            <div>
              <span className="activity-icon">
                <Icon name={tourStages[i][1]} />
              </span>
              <h2>{step[0]}</h2>
              <p>{step[1]}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

export function Tutorial(ctx) {
  const { tutorial: t, saveTutorial, busy, policy, portfolio: p } = ctx;
  const location = useLocation();
  const [openedAt, setOpenedAt] = useState(null);
  if (!t || ctx.user.role !== "child") return null;
  const save = (status, step) => saveTutorial(status, step);
  if (t.status === "not_started") {
    if (location.pathname !== "/dashboard") return null;
    return (
      <section className="start-guide" aria-labelledby="start-guide-title">
        <div>
          <h2 id="start-guide-title">How to use Sprout</h2>
          <p>
            You can begin with the lesson below or follow a guided tutorial that
            shows you around your practice account. The tutorial saves your
            place and does not require a trade.
          </p>
        </div>
        <div className="start-guide-actions">
          <button disabled={busy} onClick={() => save("in_progress", 0)}>
            Start guided tutorial
          </button>
          <button
            className="quiet"
            disabled={busy}
            onClick={() => save("skipped", 0)}
          >
            Skip tutorial
          </button>
        </div>
      </section>
    );
  }
  if (["skipped", "completed"].includes(t.status))
    return location.pathname === "/dashboard" ? (
      <div className="tour-collapsed">
        <span className="tour-collapsed-label">
          <Icon name="guide" />
          {t.status === "completed"
            ? "Getting-started tour completed"
            : "Getting-started tour paused"}
        </span>
        <button
          className="quiet"
          disabled={busy}
          onClick={() =>
            save("in_progress", t.status === "completed" ? 0 : t.step)
          }
        >
          {t.status === "completed" ? "Replay tutorial" : "Resume tutorial"}
        </button>
      </div>
    ) : null;
  const step = tourSteps[t.step];
  const blocked =
    t.step === 3 &&
    (policy?.paused ||
      Number(policy?.per_order) === 0 ||
      Number(policy?.daily) === 0 ||
      p?.run.status !== "active");
  const navigated = !step[2] || location.pathname === step[2];
  return (
    <section
      className="tutorial"
      aria-label="Getting started tutorial"
      data-step={t.step}
    >
      <div className="split">
        <span className="eyebrow">GETTING STARTED · {t.step + 1} OF 6</span>
        <button
          className="quiet"
          disabled={busy}
          onClick={() => save("skipped", t.step)}
        >
          Skip tutorial
        </button>
      </div>
      <ol className="tour-step-track" aria-label="Tutorial steps">
        {tourStages.map(([label, icon], i) => (
          <li
            key={label}
            className={i < t.step ? "visited" : i === t.step ? "current" : ""}
            aria-current={i === t.step ? "step" : undefined}
          >
            <span>
              <Icon name={i < t.step ? "check" : icon} />
            </span>
            <small>{label}</small>
            <span className="sr-only">
              {i < t.step
                ? ", visited"
                : i === t.step
                  ? ", current step"
                  : ", coming up"}
            </span>
          </li>
        ))}
      </ol>
      <h2>{step[0]}</h2>
      <p>{step[1]}</p>
      {t.step === 0 && (
        <p className="tour-wallet">
          Ready-to-use practice cash: <strong>{money(p?.run.cash)}</strong>
        </p>
      )}
      {t.step === 2 && (
        <div onClick={() => setOpenedAt(`${ctx.cid}:${t.revision}`)}>
          <Term name="stock" />
          <Term name="fund" />
        </div>
      )}
      {blocked && (
        <p className="notice">
          New trades aren't available with the current practice limits or
          selected run. You can keep learning and continue this tour without
          submitting anything. Ask your parent to review settings.
        </p>
      )}
      {t.step === 4 && (
        <p className="notice">
          {policy?.approval
            ? `${p?.orders.filter((o) => o.status === "pending").length || 0} requests waiting in this practice space.`
            : "Your parent currently allows trades without individual review. Their spending limits still apply."}
        </p>
      )}
      <div className="tour-actions">
        {t.step > 0 && (
          <button
            className="quiet tour-back"
            disabled={busy}
            onClick={() => {
              setOpenedAt(null);
              save("in_progress", t.step - 1);
            }}
          >
            Previous tour step
          </button>
        )}
        {step[2] && (
          <Link
            className="text-link"
            to={step[2]}
            state={{ tutorialTarget: tourTargets[t.step] }}
          >
            {step[3]} →
          </Link>
        )}
        <button
          disabled={
            busy ||
            (!navigated && !blocked) ||
            (t.step === 2 && openedAt !== `${ctx.cid}:${t.revision}`)
          }
          onClick={() => {
            setOpenedAt(null);
            save(t.step === 5 ? "completed" : "in_progress", t.step + 1);
          }}
        >
          {busy
            ? "Saving progress…"
            : t.step === 5
              ? "Finish tutorial"
              : t.step === 3
                ? "Continue without a trade"
                : t.step === 4
                  ? "I understand parent review"
                  : "Next tour step"}
        </button>
      </div>
      {t.step === 3 && (
        <p className="muted">
          You never need to trade just to finish a tutorial. Try the form when
          you're ready.
        </p>
      )}
    </section>
  );
}
