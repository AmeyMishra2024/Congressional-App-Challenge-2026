/* Public, device-local demonstration. This is NOT the Flask authorization/database layer.
   Arithmetic uses integer cents and 1e-8 share units. Only synthetic fixtures are bundled. */
import fixtures from "./fixtures.json";

const STORE = "sprout-public-preview-v1";
const Q = 100000000n;
const clone = (v) => structuredClone(v);
const now = () => new Date().toISOString();
const fresh = () => ({
  version: 1,
  next: 1,
  user: null,
  children: [],
  runs: [],
  events: [],
  receipts: {},
});
const id = (s) => s.next++;
function fail(message, code = "invalid_request") {
  const e = new Error(message);
  e.code = code;
  throw e;
}
function cents(value) {
  if (!/^-?\d+(\.\d{1,2})?$/.test(String(value)))
    fail("Enter a dollar amount with at most two decimal places.");
  const [whole, fraction = ""] = String(value).replace("-", "").split(".");
  return (
    (BigInt(whole) * 100n + BigInt(fraction.padEnd(2, "0"))) *
    (String(value).startsWith("-") ? -1n : 1n)
  );
}
function fmt(n) {
  const sign = n < 0n ? "-" : "";
  n = n < 0n ? -n : n;
  return `${sign}${n / 100n}.${String(n % 100n).padStart(2, "0")}`;
}
function qty(n) {
  return `${n / Q}.${String(n % Q).padStart(8, "0")}`;
}
function units(value) {
  const [w, f = ""] = value.split(".");
  return BigInt(w) * Q + BigInt(f.padEnd(8, "0"));
}
function round(n, d) {
  return n < 0n ? -((-n + d / 2n) / d) : (n + d / 2n) / d;
}
function dollars(value, zero = false) {
  const c = cents(value);
  if (c < (zero ? 0n : 1n) || c > 100000000n)
    fail("Enter virtual funds between $0.01 and $1,000,000.");
  return fmt(c);
}
function text(value, min, max) {
  if (
    typeof value !== "string" ||
    value.trim().length < min ||
    value.trim().length > max
  )
    fail(`Enter text between ${min} and ${max} characters.`);
  return value.trim();
}
function auth(s, role) {
  if (!s.user || (role && s.user.role !== role))
    fail(
      role === "parent"
        ? "Switch to the demo parent to continue."
        : "Switch to the demo child to continue.",
    );
}
function child(s, cid) {
  auth(s);
  const c = s.children.find((c) => c.id === cid);
  if (!c || (s.user.role === "child" && s.user.id !== cid))
    fail("Profile not found.");
  return c;
}
function run(s, rid, active = false) {
  const r = s.runs.find((r) => r.run.id === rid);
  if (!r) fail("Practice run not found.");
  child(s, r.run.child_id);
  if (active && r.run.status !== "active")
    fail("Select an active practice run.");
  return r;
}
function scenario(r) {
  return fixtures.scenarios.find(
    (s) =>
      s.id === (r.run.mode === "replay" ? r.run.scenario : "changing-market"),
  );
}
function publicScenario(s) {
  const { prices: _prices, dates: _dates, news: _news, ...meta } = s;
  return meta;
}
function price(r, ticker, session = r.run.session) {
  if (!fixtures.assets[ticker]) fail("Choose a curated asset.");
  return cents(scenario(r).prices[ticker][session]);
}
function ended(r) {
  return r.run.mode === "replay" && r.run.session === scenario(r).sessions - 1;
}
function policyDay(r) {
  return r.run.mode === "replay"
    ? scenario(r).dates[r.run.session]
    : now().slice(0, 10);
}
function spent(s, r) {
  return s.runs
    .filter(
      (x) => x.run.child_id === r.run.child_id && x.run.mode === r.run.mode,
    )
    .flatMap((x) => x.fills)
    .filter((f) => f.side === "buy" && f.policy_day === policyDay(r))
    .reduce((sum, f) => sum + cents(f.amount), 0n);
}
function makeRun(s, c, mode, dataset = "changing-market") {
  const rid = id(s);
  const r = {
    run: {
      id: rid,
      child_id: c.id,
      mode,
      scenario: mode === "replay" ? dataset : "offline-sandbox",
      session: 0,
      cash: c.policy.starting,
      starting: c.policy.starting,
      status: "active",
      created: now(),
    },
    holdings: [],
    orders: [],
    fills: [],
    reflections: [],
    entries: [],
    decisions: [],
  };
  r.entries.push({
    id: id(s),
    run_id: rid,
    fill_id: null,
    source: `opening:${rid}`,
    kind: "opening",
    ticker: null,
    session: 0,
    cash_delta: c.policy.starting,
    quantity_delta: "0.00000000",
    basis_delta: "0.00",
    created: now(),
  });
  s.runs.push(r);
  return r;
}
function makeChild(s, name, starting = "1000.00") {
  if (!/^[A-Za-z0-9_-]{2,24}$/.test(name))
    fail(
      "Use a fictional nickname with 2–24 letters, numbers, hyphens or underscores.",
    );
  if (s.children.some((c) => c.name.toLowerCase() === name.toLowerCase()))
    fail("This demo nickname is already in use.");
  const cid = id(s);
  const c = {
    id: cid,
    name,
    policy: {
      id: id(s),
      child_id: cid,
      starting,
      per_order: "200.00",
      daily: "300.00",
      approval: 1,
      paused: 0,
    },
    progress: [],
    attempts: [],
    watches: [],
    goal: null,
  };
  s.children.push(c);
  makeRun(s, c, "sandbox");
  return c;
}
function session(s) {
  return {
    user: s.user,
    csrf: "public-device-demo",
    demo: !!s.user,
    public_preview: true,
    app_name: "Sprout",
    family_code: s.user?.role === "parent" ? "device-local demo" : null,
    children: s.children
      .filter((c) => s.user?.role === "parent" || c.id === s.user?.id)
      .map(({ id, name }) => ({ id, name })),
  };
}
function quote(r, ticker) {
  return {
    price: fmt(price(r, ticker)),
    valid_seconds: 600,
    token: `${r.run.id}:${ticker}:${r.run.session}:${fmt(price(r, ticker))}:${Date.now()}`,
  };
}
function quoted(order) {
  const parts = order.quote.split(":");
  return { ...order, quoted_price: parts[3], quoted_session: Number(parts[2]) };
}
function decision(s, r, order, kind, detail = {}) {
  r.decisions.push({
    id: id(s),
    order_id: order.id,
    actor_id: s.user.id,
    kind,
    session: r.run.session,
    detail: JSON.stringify(detail),
    created: now(),
  });
}
function market(r) {
  const sc = scenario(r);
  return {
    assets: Object.entries(fixtures.assets).map(([ticker, details]) => ({
      ticker,
      ...details,
      history: sc.dates
        .slice(0, r.run.session + 1)
        .map((date, i) => ({ date, close: fmt(price(r, ticker, i)) })),
      quote: quote(r, ticker),
      change_pct: fmt(
        round(
          (price(r, ticker) - price(r, ticker, 0)) * 10000n,
          price(r, ticker, 0),
        ),
      ),
    })),
    session: r.run.session,
    date: sc.dates[r.run.session],
    news:
      r.run.mode === "replay"
        ? sc.news[r.run.session]
        : "Static offline practice snapshot. Start a replay to advance market sessions.",
    provenance: sc.provenance,
    scenario: publicScenario(sc),
  };
}
function portfolio(s, r) {
  const c = child(s, r.run.child_id);
  const held = r.holdings.filter((p) => units(p.quantity) > 0n);
  const valueQ = held.reduce(
    (n, p) => n + units(p.quantity) * price(r, p.ticker),
    0n,
  );
  const basis = held.reduce((n, p) => n + cents(p.basis), 0n);
  const totalQ = cents(r.run.cash) * Q + valueQ;
  const starting = cents(r.run.starting);
  const benchmark = round(starting * price(r, "VTI"), price(r, "VTI", 0));
  const bought = spent(s, r);
  return {
    run: clone(r.run),
    holdings: held.map((p) => ({
      ...p,
      name: fixtures.assets[p.ticker].name,
      value: fmt(round(units(p.quantity) * price(r, p.ticker), Q)),
      gain: fmt(
        round(units(p.quantity) * price(r, p.ticker), Q) - cents(p.basis),
      ),
    })),
    holdings_value: fmt(round(valueQ, Q)),
    total: fmt(round(totalQ, Q)),
    gain: fmt(round(totalQ - starting * Q, Q)),
    return_pct: fmt(round((totalQ - starting * Q) * 10000n, starting * Q)),
    benchmark_value: fmt(benchmark),
    benchmark_return_pct: fmt(round((benchmark - starting) * 10000n, starting)),
    difference: fmt(round(totalQ, Q) - benchmark),
    unrealized: fmt(round(valueQ - basis * Q, Q)),
    daily_spent: fmt(bought),
    daily_remaining: fmt(
      cents(c.policy.daily) > bought ? cents(c.policy.daily) - bought : 0n,
    ),
    policy_day: policyDay(r),
    policy: clone(c.policy),
    orders: r.orders.map(quoted),
    fills: clone(r.fills),
    reflections: clone(r.reflections),
    ended: ended(r),
    scenario: publicScenario(scenario(r)),
  };
}
function analysis(s, r) {
  let cash = cents(r.run.starting),
    realized = 0n,
    peak = cash * Q,
    maxDrawdown = 0n;
  const quantities = {};
  const sc = scenario(r);
  const history = sc.dates.slice(0, r.run.session + 1).map((date, session) => {
    for (const f of r.fills.filter((f) => f.session === session)) {
      const sign = f.side === "buy" ? 1n : -1n;
      cash -= cents(f.amount) * sign;
      quantities[f.ticker] =
        (quantities[f.ticker] || 0n) + units(f.quantity) * sign;
      if (f.side === "sell")
        realized += cents(f.amount) - cents(f.basis_removed);
    }
    const heldQ = Object.entries(quantities).reduce(
      (n, [t, q]) => n + q * price(r, t, session),
      0n,
    );
    const totalQ = cash * Q + heldQ;
    if (totalQ > peak) peak = totalQ;
    const drawdown = round((peak - totalQ) * 10000n, peak);
    if (drawdown > maxDrawdown) maxDrawdown = drawdown;
    return {
      session,
      date,
      cash: fmt(cash),
      holdings: fmt(round(heldQ, Q)),
      total: fmt(round(totalQ, Q)),
      benchmark: fmt(
        round(
          cents(r.run.starting) * price(r, "VTI", session),
          price(r, "VTI", 0),
        ),
      ),
      return_pct: fmt(
        round(
          (totalQ - cents(r.run.starting) * Q) * 10000n,
          cents(r.run.starting) * Q,
        ),
      ),
      drawdown_pct: fmt(drawdown),
    };
  });
  const p = portfolio(s, r);
  const totalQ =
    cents(r.run.cash) * Q +
    r.holdings.reduce((n, h) => n + units(h.quantity) * price(r, h.ticker), 0n);
  const allocation = p.holdings
    .map((h) => ({
      ticker: h.ticker,
      name: h.name,
      kind: fixtures.assets[h.ticker].kind,
      value: h.value,
      weight_pct: fmt(
        round(units(h.quantity) * price(r, h.ticker) * 10000n, totalQ),
      ),
    }))
    .sort((a, b) => Number(b.value) - Number(a.value));
  return {
    history,
    allocation,
    cash_pct: fmt(round(cents(r.run.cash) * Q * 10000n, totalQ)),
    max_drawdown_pct: fmt(maxDrawdown),
    realized_gain: fmt(realized),
    unrealized_gain: fmt(cents(p.gain) - realized),
    largest_holding_pct: allocation[0]?.weight_pct || "0.00",
    method:
      "Values reflect each session's closing prices after completed trades, and the current session updates after each trade. The calculation excludes contributions, dividends, fees, taxes, and interest. Drawdown uses the starting balance as the first portfolio peak.",
    scenario: p.scenario,
  };
}
function journal(r) {
  const cash = r.entries.reduce((n, e) => n + cents(e.cash_delta), 0n);
  const quantity = {},
    basis = {};
  for (const e of r.entries.filter((e) => e.ticker)) {
    quantity[e.ticker] =
      (quantity[e.ticker] || 0n) +
      (e.quantity_delta.startsWith("-")
        ? -units(e.quantity_delta.slice(1))
        : units(e.quantity_delta));
    basis[e.ticker] = (basis[e.ticker] || 0n) + cents(e.basis_delta);
  }
  const ok =
    fmt(cash) === r.run.cash &&
    r.entries.length === r.fills.length + 1 &&
    r.holdings.every(
      (h) =>
        (quantity[h.ticker] || 0n) === units(h.quantity) &&
        (basis[h.ticker] || 0n) === cents(h.basis),
    );
  return {
    entries: clone(r.entries),
    decisions: clone(r.decisions),
    reconciliation: {
      ok,
      cash: fmt(cash),
      entries: r.entries.length,
      issues: ok ? [] : ["Accounting mismatch."],
    },
  };
}
function check(s, r, order) {
  if (r.run.status !== "active" || ended(r))
    fail(
      "This practice run has ended. Reflect or ask the demo parent to reset it.",
    );
  const c = child(s, r.run.child_id);
  if (c.policy.paused) fail("Trading is paused. Lessons remain available.");
  const parts = order.quote.split(":");
  if (
    parts[0] !== String(r.run.id) ||
    parts[1] !== order.ticker ||
    parts[2] !== String(r.run.session) ||
    parts[3] !== fmt(price(r, order.ticker)) ||
    Date.now() - Number(parts[4]) > 600000
  )
    fail(
      "The quote changed or expired. The child must reconfirm at the current price.",
      "stale_quote",
    );
  const proposed = cents(order.amount),
    quantity = (proposed * Q) / price(r, order.ticker),
    cost = round(quantity * price(r, order.ticker), Q);
  if (cost < 1n || quantity < 1n) fail("The amount is too small.");
  const pos = r.holdings.find((h) => h.ticker === order.ticker);
  if (order.side === "buy") {
    if (proposed > cents(c.policy.per_order))
      fail("This buy exceeds the parent's per-order limit.");
    if (spent(s, r) + cost > cents(c.policy.daily))
      fail("This buy exceeds today's gross buying limit.");
    if (cost > cents(r.run.cash)) fail("Not enough available virtual cash.");
  } else if (!pos || quantity > units(pos.quantity))
    fail("You cannot sell more shares than you hold.");
  return { quantity, cost, pos };
}
function fill(s, r, order) {
  if (!journal(r).reconciliation.ok)
    fail("This practice account needs an accounting review.");
  const { quantity, cost, pos } = check(s, r, order);
  const held = pos ? units(pos.quantity) : 0n,
    basis = pos ? cents(pos.basis) : 0n,
    buy = order.side === "buy";
  const removed = buy
    ? 0n
    : quantity === held
      ? basis
      : round(basis * quantity, held);
  const newPos = {
    id: pos?.id || id(s),
    run_id: r.run.id,
    ticker: order.ticker,
    quantity: qty(held + quantity * (buy ? 1n : -1n)),
    basis: fmt(buy ? basis + cost : basis - removed),
  };
  if (pos) Object.assign(pos, newPos);
  else r.holdings.push(newPos);
  r.run.cash = fmt(cents(r.run.cash) + cost * (buy ? -1n : 1n));
  const f = {
    id: id(s),
    order_id: order.id,
    run_id: r.run.id,
    child_id: r.run.child_id,
    side: order.side,
    ticker: order.ticker,
    quantity: qty(quantity),
    price: fmt(price(r, order.ticker)),
    amount: fmt(cost),
    basis_removed: fmt(removed),
    policy_day: policyDay(r),
    session: r.run.session,
    created: now(),
  };
  r.fills.push(f);
  r.entries.push({
    id: id(s),
    run_id: r.run.id,
    fill_id: f.id,
    source: `fill:${f.id}`,
    kind: order.side,
    ticker: order.ticker,
    session: r.run.session,
    cash_delta: fmt(cost * (buy ? -1n : 1n)),
    quantity_delta: `${buy ? "" : "-"}${qty(quantity)}`,
    basis_delta: fmt(buy ? cost : -removed),
    created: now(),
  });
  order.status = "filled";
  decision(s, r, order, "filled", { fill_id: f.id });
  if (!journal(r).reconciliation.ok)
    fail("Accounting invariant failed; the trade was not saved.");
  return clone(order);
}
function learning(c) {
  const lessons = fixtures.lessons.map((l) => {
    const attempts = c.attempts.filter((a) => a.lesson === l.id),
      p = c.progress.find((p) => p.lesson === l.id);
    return {
      id: l.id,
      title: l.title,
      completed: !!p?.completed,
      attempts: attempts.length,
      recorded_attempts: attempts.length,
      quiz_correct: attempts.filter((a) => a.quiz_correct).length,
      exercise_correct: attempts.filter((a) => a.exercise_correct).length,
      last_attempt: attempts.at(-1) || null,
    };
  });
  return {
    lessons,
    recent_attempts: clone(c.attempts.slice(-20).reverse()),
    completed: lessons.filter((l) => l.completed).length,
    unrecorded_legacy_attempts: 0,
  };
}
function route(s, path, data, method) {
  const parts = path.split("/").filter(Boolean);
  if (path === "/session") return session(s);
  if (path === "/demo") {
    if (data.resume && s.children.length) {
      s.user = { id: 1, name: "Demo parent", role: "parent" };
      return session(s);
    }
    Object.assign(s, fresh());
    s.user = { id: id(s), name: "Demo parent", role: "parent" };
    makeChild(s, "Alex");
    return session(s);
  }
  if (path === "/logout") {
    s.user = null;
    return session(s);
  }
  if (path === "/demo/switch") {
    auth(s);
    s.user =
      data.role === "parent"
        ? { id: 1, name: "Demo parent", role: "parent" }
        : {
            id: child(s, data.child_id).id,
            name: child(s, data.child_id).name,
            role: "child",
          };
    return session(s);
  }
  auth(s);
  if (path === "/scenarios") return fixtures.scenarios.map(publicScenario);
  if (path === "/glossary") return fixtures.glossary;
  if (path === "/lessons")
    return fixtures.lessons.map(
      ({ answer: _answer, feedback: _feedback, exercise, ...l }) => {
        const { answer: _ignored, ...ex } = exercise;
        return { ...l, exercise: ex };
      },
    );
  if (path.startsWith("/market/history"))
    fail(
      "Live exploration is unavailable in the public preview. Synthetic practice is available.",
    );
  if (path === "/predict")
    return { available: false, reason: "No reviewed model is included." };
  if (path === "/children" && method === "POST") {
    auth(s, "parent");
    return makeChild(s, text(data.name, 2, 24), dollars(data.starting));
  }
  if (parts[0] === "children") {
    const c = child(s, Number(parts[1])),
      all = s.runs.filter((r) => r.run.child_id === c.id);
    if (parts[2] === "runs") return all.map((r) => r.run);
    if (parts[2] === "progress") return c.progress;
    if (parts[2] === "tutorial") {
      const previous = c.tutorial || {
        child_id: c.id,
        status: "not_started",
        step: 0,
        revision: 0,
        updated: null,
      };
      if (method === "PUT") {
        auth(s, "child");
        if (
          !["in_progress", "skipped", "completed"].includes(data.status) ||
          !Number.isInteger(data.step) ||
          data.step < 0 ||
          data.step > 6 ||
          (data.status === "completed") !== (data.step === 6)
        )
          fail("Choose a valid tutorial step.");
        if (data.expected_revision !== previous.revision)
          fail(
            "Your tour changed in another tab. Refresh to continue from its saved step.",
          );
        c.tutorial = {
          child_id: c.id,
          status: data.status,
          step: data.step,
          revision: previous.revision + 1,
          updated: now(),
        };
      }
      return c.tutorial || previous;
    }
    if (parts[2] === "learning") return learning(c);
    if (parts[2] === "policy") {
      if (method === "PUT") {
        auth(s, "parent");
        for (const k of ["starting", "per_order", "daily"])
          c.policy[k] = dollars(data[k], k !== "starting");
        c.policy.approval = Number(!!data.approval);
        c.policy.paused = Number(!!data.paused);
        s.events.push({
          id: id(s),
          child_id: c.id,
          actor_id: s.user.id,
          kind: "policy",
          detail: JSON.stringify(c.policy),
          created: now(),
        });
      }
      return c.policy;
    }
    if (parts[2] === "watchlist") {
      if (method === "PUT") {
        auth(s, "child");
        if (
          !Array.isArray(data.tickers) ||
          data.tickers.some((t) => !fixtures.assets[t])
        )
          fail("Choose curated assets.");
        c.watches = [...new Set(data.tickers)].sort();
      }
      return c.watches;
    }
    if (parts[2] === "goal") {
      if (method === "PUT") {
        auth(s, "child");
        c.goal = {
          id: c.goal?.id || id(s),
          child_id: c.id,
          title: text(data.title, 3, 80),
          target: dollars(data.target),
        };
      }
      return c.goal;
    }
    if (parts[2] === "review") {
      auth(s, "parent");
      return {
        progress: c.progress,
        events: s.events.filter((e) => e.child_id === c.id),
        reflections: all.flatMap((r) => r.reflections),
        fills: all.flatMap((r) => r.fills),
        orders: all.flatMap((r) =>
          r.orders.map((o) => ({
            ...quoted(o),
            run_title:
              r.run.mode === "replay" ? scenario(r).title : "Offline sandbox",
          })),
        ),
        learning: learning(c),
      };
    }
  }
  if (parts[0] === "lessons" && parts[2] === "complete") {
    auth(s, "child");
    const c = child(s, s.user.id),
      l = fixtures.lessons.find((l) => l.id === parts[1]);
    if (!l) fail("Lesson not found.");
    if (!Number.isInteger(data.answer) || !l.options[data.answer])
      fail("Choose an answer.");
    const exercise = text(String(data.exercise ?? ""), 1, 1000),
      quiz = data.answer === l.answer,
      correctExercise =
        l.exercise.type === "text"
          ? exercise.length >= 20
          : Number(exercise) === Number(l.exercise.answer);
    c.attempts.push({
      id: id(s),
      child_id: c.id,
      lesson: l.id,
      answer: data.answer,
      exercise,
      quiz_correct: Number(quiz),
      exercise_correct: Number(correctExercise),
      created: now(),
    });
    let p = c.progress.find((p) => p.lesson === l.id);
    if (!p) {
      p = {
        id: id(s),
        child_id: c.id,
        lesson: l.id,
        attempts: 0,
        completed: 0,
      };
      c.progress.push(p);
    }
    Object.assign(p, {
      attempts: p.attempts + 1,
      completed: Number(!!p.completed || (quiz && correctExercise)),
      answer: data.answer,
      exercise,
      updated: now(),
    });
    return {
      correct: quiz && correctExercise,
      completed: !!p.completed,
      feedback: l.feedback,
      exercise_feedback: correctExercise
        ? "Exercise correct."
        : "Revisit the worked example and try again.",
    };
  }
  if (path === "/runs" && method === "POST") {
    auth(s, "child");
    const c = child(s, s.user.id);
    if (
      data.mode !== "replay" ||
      !fixtures.scenarios.some((sc) => sc.id === data.scenario)
    )
      fail("Choose an available scenario.");
    const existing = s.runs.find(
      (r) =>
        r.run.child_id === c.id &&
        r.run.scenario === data.scenario &&
        r.run.status === "active",
    );
    return {
      run_id: (existing || makeRun(s, c, "replay", data.scenario)).run.id,
    };
  }
  if (parts[0] === "runs") {
    const r = run(s, Number(parts[1])),
      action = parts[2];
    if (!action) return portfolio(s, r);
    if (action === "market") return market(r);
    if (action === "analysis") return analysis(s, r);
    if (action === "journal") return journal(r);
    if (action === "report") {
      const p = portfolio(s, r);
      p.orders = p.orders.map(({ quote: _quote, ...o }) => o);
      return {
        report_version: 1,
        generated_at: now(),
        money_type: "virtual",
        preview_storage: "this browser only",
        portfolio: p,
        analysis: analysis(s, r),
        visible_market: scenario(r)
          .dates.slice(0, r.run.session + 1)
          .map((date, session) => ({
            session,
            date,
            closes: Object.fromEntries(
              Object.keys(fixtures.assets).map((t) => [
                t,
                fmt(price(r, t, session)),
              ]),
            ),
          })),
        cash_journal: r.entries,
        decision_history: r.decisions.map((e) => ({
          ...e,
          detail: JSON.parse(e.detail),
        })),
        reconciliation: journal(r).reconciliation,
      };
    }
    if (action === "orders") {
      auth(s, "child");
      if (!["buy", "sell"].includes(data.side)) fail("Choose buy or sell.");
      const o = {
        id: id(s),
        run_id: r.run.id,
        ticker: data.ticker,
        side: data.side,
        amount: dollars(data.amount),
        reason: text(data.reason, 20, 1000),
        quote: text(data.quote, 10, 2000),
        status: "pending",
        review: "",
        created: now(),
      };
      check(s, r, o);
      r.orders.push(o);
      decision(s, r, o, "proposed", {
        amount: o.amount,
        ticker: o.ticker,
        side: o.side,
      });
      return child(s, r.run.child_id).policy.approval ? o : fill(s, r, o);
    }
    if (action === "advance") {
      auth(s, "child");
      if (r.run.status !== "active" || ended(r) || r.run.mode !== "replay")
        fail("This scenario cannot advance.");
      if (data.expected_session !== r.run.session)
        fail("The session already advanced. Refresh the view.");
      r.run.session++;
      return { session: r.run.session };
    }
    if (action === "reflection") {
      auth(s, "child");
      const ref = {
        id: id(s),
        run_id: r.run.id,
        child_id: r.run.child_id,
        text: text(data.text, 30, 2000),
        created: now(),
      };
      r.reflections.push(ref);
      return ref;
    }
    if (action === "reset") {
      auth(s, "parent");
      if (r.run.status !== "active") fail("This run is already archived.");
      const reason = text(data.reason, 10, 300);
      r.run.status = "archived";
      for (const o of r.orders.filter((o) => o.status === "pending")) {
        o.status = "cancelled";
        o.review = "Practice run reset by parent";
        decision(s, r, o, "cancelled_by_reset");
      }
      const next = makeRun(
        s,
        child(s, r.run.child_id),
        r.run.mode,
        r.run.scenario,
      );
      s.events.push({
        id: id(s),
        child_id: r.run.child_id,
        actor_id: s.user.id,
        kind: "reset",
        detail: JSON.stringify({
          old_run: r.run.id,
          new_run: next.run.id,
          reason,
        }),
        created: now(),
      });
      return { run_id: next.run.id };
    }
  }
  if (parts[0] === "orders") {
    const r = s.runs.find((r) =>
      r.orders.some((o) => o.id === Number(parts[1])),
    );
    if (!r) fail("Proposal not found.");
    run(s, r.run.id);
    const o = r.orders.find((o) => o.id === Number(parts[1])),
      action = parts[2];
    if (action === "review") {
      auth(s, "parent");
      if (!["approve", "reject"].includes(data.action))
        fail("Choose approve or reject.");
      if (o.status !== "pending") return o;
      o.review = text(data.review, 5, 500);
      decision(s, r, o, data.action === "approve" ? "approved" : "rejected", {
        feedback: o.review,
      });
      if (data.action === "reject") {
        o.status = "rejected";
        return o;
      }
      return fill(s, r, o);
    }
    auth(s, "child");
    if (action === "cancel") {
      if (o.status === "pending") {
        o.status = "cancelled";
        decision(s, r, o, "cancelled");
      }
      return o;
    }
    if (action === "reconfirm") {
      if (o.status !== "pending")
        fail("Only pending proposals can be reconfirmed.");
      o.quote = text(data.quote, 10, 2000);
      check(s, r, o);
      decision(s, r, o, "reconfirmed", { price: fmt(price(r, o.ticker)) });
      return o;
    }
  }
  fail("This action is unavailable in the public interactive preview.");
}

export async function previewApi(path, body, method = "POST", retryKey) {
  const execute = () => {
    let state;
    try {
      state = JSON.parse(localStorage.getItem(STORE)) || fresh();
    } catch {
      fail(
        "Browser storage is unavailable. Enable site storage to use the interactive preview.",
      );
    }
    const mutating = body !== undefined,
      verb = mutating ? method : "GET";
    const receiptKey = `${state.user?.id}:${path}:${retryKey || crypto.randomUUID()}`;
    const digest = JSON.stringify(body);
    if (mutating && state.receipts[receiptKey]) {
      if (state.receipts[receiptKey].digest !== digest)
        fail("This retry key was used with different details.");
      return clone(state.receipts[receiptKey].result);
    }
    const result = clone(route(state, path, body || {}, verb));
    if (mutating) {
      state.receipts[receiptKey] = { digest, result };
      try {
        localStorage.setItem(STORE, JSON.stringify(state));
      } catch {
        fail(
          "This device could not save the practice data. Free browser storage and try again.",
        );
      }
    }
    return result;
  };
  return navigator.locks ? navigator.locks.request(STORE, execute) : execute();
}
