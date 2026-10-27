"""Sprout: server-authorized educational portfolios. All amounts are virtual."""
import hashlib
import hmac
import json
import os
import re
import secrets
import time
from datetime import datetime, timezone
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP, ROUND_DOWN
from functools import wraps
from pathlib import Path

from dotenv import load_dotenv
from flask import Flask, g, jsonify, request, send_from_directory
from itsdangerous import URLSafeTimedSerializer, BadSignature, SignatureExpired
from sqlalchemy import create_engine, event, select, insert, update, delete
from sqlalchemy.exc import IntegrityError
from werkzeug.exceptions import HTTPException
from werkzeug.security import generate_password_hash, check_password_hash
from werkzeug.middleware.proxy_fix import ProxyFix

from .content import ASSETS, LESSONS, GLOSSARY
from .db import (families, users, policies, sessions, runs, positions, orders,
                 fills, progress, reflections, goals, watchlist, events, receipts, attempts,
                 datasets, ledger, lesson_attempts, decision_events, tutorials)
from .migrations import migrate, LATEST_VERSION
from .accounting import open_account, record_fill, reconcile
from .replay import ReplayMarket, scenario_catalog, DEFAULT_DATASET
from .analytics import analyze

ROOT = Path(__file__).resolve().parents[1]
CENT = Decimal("0.01")
SHARE = Decimal("0.00000001")

class APIError(Exception):
    def __init__(self, message, status=400, code="invalid_request"):
        self.message, self.status, self.code = message, status, code

def fail(message, status=400, code="invalid_request"):
    raise APIError(message, status, code)

def utc():
    return datetime.now(timezone.utc).isoformat()

def money(value):
    return str(Decimal(value).quantize(CENT, rounding=ROUND_HALF_UP))

def amount(value, zero=False):
    try:
        if isinstance(value, bool) or len(str(value)) > 24:
            raise InvalidOperation
        number = Decimal(str(value))
        if not number.is_finite() or number < (0 if zero else CENT) or number > 1000000 or number != number.quantize(CENT):
            raise InvalidOperation
        return money(number)
    except (InvalidOperation, ValueError, TypeError):
        fail("Enter a finite dollar amount with at most two decimal places (maximum $1,000,000).")

def text(value, minimum=1, maximum=1000):
    if not isinstance(value, str) or not minimum <= len(value.strip()) <= maximum:
        fail(f"Enter text between {minimum} and {maximum} characters.")
    return value.strip()

def integer(value):
    if isinstance(value, bool) or not isinstance(value, int):
        fail("An integer value is required.")
    return value

def one(tbl, **filters):
    row = g.db.execute(select(tbl).filter_by(**filters)).mappings().first()
    return dict(row) if row else None

def rows(tbl, **filters):
    return [dict(r) for r in g.db.execute(select(tbl).filter_by(**filters).order_by(tbl.c.id)) .mappings()]

def add(tbl, **values):
    return g.db.execute(insert(tbl).values(**values)).inserted_primary_key[0]

def change(tbl, row_id, **values):
    g.db.execute(update(tbl).where(tbl.c.id == row_id).values(**values))

def auth(role=None):
    user = one(users, id=g.session["user_id"]) if g.session.get("user_id") else None
    if not user:
        fail("Sign in to continue.", 401)
    if role and user["role"] != role:
        fail("This action is available to the parent only." if role == "parent" else "Switch to a child profile to continue.", 403)
    return user

def child_access(child_id):
    user = auth()
    child = one(users, id=child_id)
    if not child or child["role"] != "child" or child["family_id"] != user["family_id"] or (user["role"] == "child" and child["id"] != user["id"]):
        fail("Profile not found.", 404)
    return child

def run_access(run_id, active=False):
    run = one(runs, id=run_id)
    if not run:
        fail("Practice run not found.", 404)
    child_access(run["child_id"])
    if active and run["status"] != "active":
        fail("This run is archived. Select an active practice run.", 409)
    return run

def run_market(run):
    cache = g.setdefault("markets", {})
    key = (run["id"], run["scenario"], run["session"])
    if key not in cache:
        cache[key] = ReplayMarket(g.db, run)
    return cache[key]

def policy_day(run):
    return run_market(run).date if run["mode"] == "replay" else datetime.now(timezone.utc).date().isoformat()

def spent(run):
    values = g.db.execute(select(fills.c.amount).join(runs, runs.c.id == fills.c.run_id).where(
        fills.c.child_id == run["child_id"], fills.c.side == "buy", fills.c.policy_day == policy_day(run), runs.c.mode == run["mode"])).scalars()
    return sum((Decimal(value) for value in values), Decimal(0))

def create_run(child_id, mode, scenario=None):
    if mode not in ("replay", "sandbox"):
        fail("Choose replay or sandbox.")
    starting = one(policies, child_id=child_id)["starting"]
    dataset = scenario or DEFAULT_DATASET
    if mode == "replay" and not one(datasets, key=dataset):
        fail("Choose an available practice scenario.")
    rid = add(runs, child_id=child_id, mode=mode, scenario=dataset if mode == "replay" else "offline-sandbox", session=0, cash=starting, starting=starting, status="active", created=utc())
    open_account(g.db, one(runs, id=rid))
    return rid

def decision_event(order, kind, detail=None):
    user = auth()
    run = one(runs, id=order["run_id"])
    add(decision_events, order_id=order["id"], actor_id=user["id"], kind=kind,
        session=run["session"], detail=json.dumps(detail or {}), created=utc())

def make_child(family_id, name, pin, starting="1000.00"):
    if not re.fullmatch(r"[A-Za-z0-9_-]{2,24}", name):
        fail("Use a nickname with 2–24 letters, numbers, hyphens or underscores.")
    if not re.fullmatch(r"\d{6,12}", pin):
        fail("Use a 6–12 digit PIN.")
    if one(users, family_id=family_id, role="child", login=name.lower()):
        fail("This nickname is already in use in your family.", 409)
    cid = add(users, family_id=family_id, role="child", name=name, login=name.lower(), secret_hash=generate_password_hash(pin))
    add(policies, child_id=cid, starting=starting, per_order="200.00", daily="300.00", approval=1, paused=0)
    create_run(cid, "sandbox")
    return cid

def idempotent(fn):
    @wraps(fn)
    def wrapped(*args, **kwargs):
        user = auth()
        key = request.headers.get("Idempotency-Key", "")
        if not re.fullmatch(r"[A-Za-z0-9_-]{8,80}", key):
            fail("Supply an Idempotency-Key with 8–80 letters, digits, hyphens or underscores.")
        payload = request.get_json(silent=True) or {}
        digest = hashlib.sha256(json.dumps(payload, sort_keys=True).encode()).hexdigest()
        existing = one(receipts, user_id=user["id"], route=request.path, key=key)
        if existing:
            if existing["digest"] != digest:
                fail("This retry key was already used with different details.", 409)
            return jsonify(json.loads(existing["result"]))
        result = fn(*args, **kwargs)
        add(receipts, user_id=user["id"], route=request.path, key=key, digest=digest, result=json.dumps(result))
        return jsonify(result)
    return wrapped

def create_app(config=None):
    load_dotenv(ROOT / ".env")
    app = Flask(__name__, static_folder=None)
    production = os.getenv("APP_ENV") == "production"
    (ROOT / "instance").mkdir(exist_ok=True)
    secret = (config or {}).get("SECRET_KEY") or os.getenv("SECRET_KEY")
    if not secret:
        if production:
            raise RuntimeError("Production requires SECRET_KEY.")
        secret_file = ROOT / "instance" / "secret.key"
        try:
            with secret_file.open("x") as f:
                f.write(secrets.token_hex(32))
        except FileExistsError:
            pass
        secret = secret_file.read_text().strip()
    app.config.update(SECRET_KEY=secret, DATABASE_URL=os.getenv("DATABASE_URL", "sqlite:///instance/sprout.db"), COOKIE_SECURE=os.getenv("SESSION_COOKIE_SECURE", "false").lower() == "true", ENABLE_LIVE_MARKET=os.getenv("ENABLE_LIVE_MARKET", "false").lower() == "true", TESTING=False, MAX_CONTENT_LENGTH=32000)
    if config:
        app.config.update(config)
    if production and (not app.config["COOKIE_SECURE"] or len(app.config["SECRET_KEY"]) < 32):
        raise RuntimeError("Production requires HTTPS and SESSION_COOKIE_SECURE=true.")
    trusted_hosts = [host.strip() for host in os.getenv("TRUSTED_HOSTS", "").split(",") if host.strip()]
    if production and not trusted_hosts:
        raise RuntimeError("Production requires TRUSTED_HOSTS, a comma-separated list of allowed host names.")
    app.config["TRUSTED_HOSTS"] = trusted_hosts or None
    if os.getenv("TRUST_PROXY", "false").lower() == "true":
        app.wsgi_app = ProxyFix(app.wsgi_app, x_for=1, x_proto=1, x_host=1)
    db_url = app.config["DATABASE_URL"]
    if not db_url.startswith("sqlite:///"):
        raise RuntimeError("This release supports SQLite on durable storage. See docs/DEPLOYMENT.md.")
    if db_url == "sqlite:///instance/sprout.db":
        db_url = "sqlite:///" + (ROOT / "instance" / "sprout.db").as_posix()
    engine = create_engine(db_url, connect_args={"check_same_thread": False, "timeout": 30})
    @event.listens_for(engine, "connect")
    def sqlite_setup(connection, _):
        connection.execute("PRAGMA foreign_keys=ON")
        connection.execute("PRAGMA busy_timeout=30000")
        connection.execute("PRAGMA journal_mode=WAL")
    app.extensions["migration_backup"] = migrate(engine)
    app.extensions["db"] = engine
    signer = URLSafeTimedSerializer(app.config["SECRET_KEY"], salt="execution-quote-v1")

    @app.before_request
    def begin():
        if not request.path.startswith("/api/") or request.path == "/api/health":
            return
        g.db = engine.connect()
        # All mutations share one SQLite write lock, including approval and receipt.
        g.db.exec_driver_sql("BEGIN IMMEDIATE" if request.method != "GET" else "BEGIN")
        token = request.cookies.get("sprout_session", "")
        hashed = hashlib.sha256(token.encode()).hexdigest()
        g.session = one(sessions, token=hashed)
        g.new_cookie = None
        if not g.session or g.session["expires"] < time.time():
            if request.method != "GET" or request.path != "/api/session":
                fail("Your session expired. Reload and sign in.", 401)
            token = secrets.token_urlsafe(32)
            sid = add(sessions, token=hashlib.sha256(token.encode()).hexdigest(), user_id=None, demo_family=None, csrf=secrets.token_urlsafe(32), expires=int(time.time()) + 43200)
            g.session = one(sessions, id=sid)
            g.new_cookie = token
        if request.method != "GET":
            if not hmac.compare_digest(request.headers.get("X-CSRF-Token", ""), g.session["csrf"]):
                fail("Security token expired. Reload before trying again.", 403, "csrf")
            origin = request.headers.get("Origin")
            if origin and origin.rstrip("/") != request.host_url.rstrip("/"):
                fail("Cross-origin changes are not allowed.", 403)
            if not request.is_json or not isinstance(request.get_json(silent=True), dict):
                fail("Send a JSON object.")

    @app.after_request
    def finish(response):
        if hasattr(g, "db"):
            # A failed login is deliberately committed to retain rate-limit counters.
            if response.status_code < 400 or getattr(g, "commit_error", False):
                g.db.commit()
            else:
                g.db.rollback()
            if getattr(g, "new_cookie", None):
                response.set_cookie("sprout_session", g.new_cookie, httponly=True, secure=app.config["COOKIE_SECURE"], samesite="Lax", max_age=43200, path="/")
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["Referrer-Policy"] = "same-origin"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Content-Security-Policy"] = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; font-src 'self'; frame-ancestors 'none'"
        if request.path.startswith("/api/"):
            response.headers["Cache-Control"] = "no-store"
        if production:
            response.headers["Strict-Transport-Security"] = "max-age=31536000"
        return response

    @app.teardown_request
    def close(_):
        if hasattr(g, "db"):
            g.db.close()

    @app.errorhandler(APIError)
    def api_error(error):
        return jsonify(error=error.message, code=error.code), error.status

    @app.errorhandler(Exception)
    def safe_error(error):
        if isinstance(error, HTTPException):
            return jsonify(error=error.description), error.code
        if isinstance(error, IntegrityError):
            return jsonify(error="A conflicting update occurred. Reload and try again."), 409
        app.logger.exception("Request failed")
        return jsonify(error="The request could not be completed. Please try again."), 500

    def rotate(user_id, demo=None):
        old_sid = g.session["id"]
        token = secrets.token_urlsafe(32)
        g.db.execute(delete(sessions).where(sessions.c.id == old_sid))
        sid = add(sessions, token=hashlib.sha256(token.encode()).hexdigest(), user_id=user_id, demo_family=demo, csrf=secrets.token_urlsafe(32), expires=int(time.time()) + 43200)
        g.session = one(sessions, id=sid)
        g.new_cookie = token

    def session_view():
        user = one(users, id=g.session["user_id"]) if g.session["user_id"] else None
        children = []
        if user:
            children = [{"id": c["id"], "name": c["name"]} for c in rows(users, family_id=user["family_id"], role="child") if user["role"] == "parent" or c["id"] == user["id"]]
        return {"user": {k: user[k] for k in ("id", "name", "role")} if user else None, "csrf": g.session["csrf"], "demo": bool(g.session["demo_family"]), "children": children, "app_name": os.getenv("APP_NAME", "Sprout"), "family_code": str(user["family_id"]) if user and user["role"] == "parent" else None}

    def login_limit(login):
        # Hash identifiers: do not retain credentials or plain IP addresses.
        buckets = [hashlib.sha256((request.remote_addr or "local").encode()).hexdigest(), hashlib.sha256(login.encode()).hexdigest()]
        for bucket in buckets:
            recent = [a for a in rows(attempts, bucket=bucket) if a["created"] > time.time() - 900]
            if len(recent) >= 10:
                fail("Too many login attempts. Try again in 15 minutes.", 429)
        for bucket in buckets:
            add(attempts, bucket=bucket, created=int(time.time()))
        g.commit_error = True

    @app.get("/api/health")
    def health():
        return jsonify(status="ok", storage="sqlite", model="optional", schema_version=LATEST_VERSION)

    @app.get("/api/session")
    def session_info():
        return jsonify(session_view())

    @app.post("/api/register")
    def register():
        data = request.json
        login = text(data.get("username"), 3, 40).lower()
        password = text(data.get("password"), 10, 128)
        if not re.fullmatch(r"[a-z0-9_-]{3,40}", login):
            fail("Use letters, numbers, hyphens or underscores for the parent username.")
        login_limit(login)
        if one(users, role="parent", login=login):
            fail("That username is unavailable.", 409)
        fid = add(families, demo=0, created=utc())
        uid = add(users, family_id=fid, role="parent", login=login, name=login, secret_hash=generate_password_hash(password))
        rotate(uid)
        return jsonify(session_view())

    @app.post("/api/login")
    def login():
        data = request.json
        role = data.get("role")
        name = text(data.get("username"), 1, 40).lower()
        login_limit(role + ":" + name if role in ("parent", "child") else name)
        candidates = rows(users, role=role, login=name) if role in ("parent", "child") else []
        if role == "child":
            candidates = [u for u in candidates if str(u["family_id"]) == str(data.get("family_code"))]
        user = candidates[0] if len(candidates) == 1 else None
        if user and one(families, id=user["family_id"])["demo"]:
            user = None
        secret_value = data.get("password", "")
        if not isinstance(secret_value, str) or len(secret_value) > 128:
            fail("Sign-in details are incorrect.", 401)
        valid = check_password_hash(user["secret_hash"] if user else generate_password_hash("dummy"), secret_value)
        if not user or not valid:
            fail("Sign-in details are incorrect.", 401)
        rotate(user["id"])
        return jsonify(session_view())

    @app.post("/api/logout")
    def logout():
        rotate(None)
        return jsonify(session_view())

    @app.post("/api/demo")
    def demo():
        fid = add(families, demo=1, created=utc())
        uid = add(users, family_id=fid, role="parent", name="Demo parent", login="demo-parent", secret_hash=generate_password_hash(secrets.token_urlsafe(24)))
        make_child(fid, "Alex", secrets.token_hex(4).translate(str.maketrans("abcdef", "012345")))
        rotate(uid, fid)
        return jsonify(session_view())

    @app.post("/api/demo/switch")
    def demo_switch():
        auth()
        fid = g.session["demo_family"]
        if not fid:
            fail("Role switching is available only in your isolated demo.", 403)
        role = request.json.get("role")
        uid = request.json.get("child_id")
        user = one(users, family_id=fid, role="parent") if role == "parent" else one(users, id=uid, family_id=fid, role="child") if role == "child" else None
        if not user:
            fail("Demo profile not found.", 404)
        rotate(user["id"], fid)
        return jsonify(session_view())

    @app.post("/api/children")
    @idempotent
    def new_child():
        parent = auth("parent")
        data = request.json
        cid = make_child(parent["family_id"], text(data.get("name"), 2, 24), text(data.get("pin"), 6, 12), amount(data.get("starting", "1000")))
        return {"id": cid, "name": data["name"]}

    @app.get("/api/children/<int:cid>/policy")
    def get_policy(cid):
        child_access(cid)
        return jsonify(one(policies, child_id=cid))

    @app.put("/api/children/<int:cid>/policy")
    @idempotent
    def set_policy(cid):
        parent = auth("parent")
        child_access(cid)
        p = one(policies, child_id=cid)
        data = request.json
        if not isinstance(data.get("approval"), bool) or not isinstance(data.get("paused"), bool):
            fail("Approval and pause must be true or false.")
        values = {k: amount(data.get(k), zero=True) for k in ("starting", "per_order", "daily")}
        if Decimal(values["starting"]) < CENT:
            fail("Starting funds must be at least $0.01.")
        values.update(approval=int(data["approval"]), paused=int(data["paused"]))
        change(policies, p["id"], **values)
        add(events, child_id=cid, actor_id=parent["id"], kind="policy", detail=json.dumps(values), created=utc())
        return one(policies, child_id=cid)

    @app.get("/api/children/<int:cid>/runs")
    def get_runs(cid):
        child_access(cid)
        return jsonify(rows(runs, child_id=cid))

    @app.get("/api/scenarios")
    def scenarios():
        auth()
        return jsonify(scenario_catalog(g.db))

    @app.post("/api/runs")
    @idempotent
    def new_run():
        child = auth("child")
        mode = request.json.get("mode")
        scenario = request.json.get("scenario") if mode == "replay" else "offline-sandbox"
        if mode not in ("replay", "sandbox") or (mode == "replay" and (not isinstance(scenario, str) or not one(datasets, key=scenario))):
            fail("Choose an available practice scenario.")
        current = one(runs, child_id=child["id"], mode=mode, scenario=scenario, status="active")
        return {"run_id": current["id"] if current else create_run(child["id"], mode, scenario)}

    @app.post("/api/runs/<int:rid>/reset")
    @idempotent
    def reset(rid):
        parent = auth("parent")
        run = run_access(rid, active=True)
        change(runs, rid, status="archived")
        for order in rows(orders, run_id=rid, status="pending"):
            change(orders, order["id"], status="cancelled", review="Practice run reset by parent")
            decision_event(order, "cancelled_by_reset")
        new_id = create_run(run["child_id"], run["mode"], run["scenario"])
        add(events, child_id=run["child_id"], actor_id=parent["id"], kind="reset", detail=json.dumps({"old_run": rid, "new_run": new_id, "reason": text(request.json.get("reason"), 10, 300)}), created=utc())
        return {"run_id": new_id}

    def price(run, ticker):
        if not isinstance(ticker, str) or ticker not in ASSETS:
            fail("Choose an asset from the curated list.", 404)
        return run_market(run).close(ticker)

    def quote(run, ticker):
        p = price(run, ticker)
        return {"price": money(p), "token": signer.dumps({"run": run["id"], "ticker": ticker, "session": run["session"], "price": str(p)}), "valid_seconds": 600}

    def valid_quote(run, ticker, token):
        try:
            data = signer.loads(token, max_age=600)
        except (BadSignature, SignatureExpired, TypeError):
            fail("Quote expired. The child must refresh and reconfirm the proposal.", 409, "stale_quote")
        if data != {"run": run["id"], "ticker": ticker, "session": run["session"], "price": str(price(run, ticker))}:
            fail("The market session changed. Refresh the quote and reconfirm before trading.", 409, "stale_quote")

    @app.get("/api/runs/<int:rid>/market")
    def market(rid):
        run = run_access(rid)
        visible = run_market(run)
        if "session" in request.args:
            try:
                requested = int(request.args["session"])
            except ValueError:
                fail("Invalid session.")
            if requested < 0 or requested > run["session"]:
                fail("Future session data is unavailable.", 403)
        output = []
        for ticker, details in ASSETS.items():
            close = price(run, ticker)
            history = [{"date": observation["date"], "close": money(visible.close(ticker, i))} for i, observation in visible.observations.items()]
            output.append({"ticker": ticker, **details, "history": history, "quote": quote(run, ticker), "change_pct": money((close / visible.close(ticker, 0) - 1) * 100)})
        return jsonify(assets=output, session=run["session"], date=visible.date, news=visible.observations[run["session"]]["news"] if run["mode"] == "replay" else "Static offline practice snapshot. Start a replay to advance market sessions.", provenance=visible.scenario["provenance"], scenario=visible.scenario)

    def portfolio(run):
        holdings = []
        total_holdings = Decimal(0)
        total_basis = Decimal(0)
        for pos in rows(positions, run_id=run["id"]):
            if Decimal(pos["quantity"]) == 0:
                continue
            value = Decimal(pos["quantity"]) * price(run, pos["ticker"])
            total_holdings += value
            total_basis += Decimal(pos["basis"])
            holdings.append({**pos, "name": ASSETS[pos["ticker"]]["name"], "value": money(value), "gain": money(value - Decimal(pos["basis"]))})
        total = Decimal(run["cash"]) + total_holdings
        visible = run_market(run)
        benchmark = Decimal(run["starting"]) * visible.close(visible.scenario["benchmark"]) / visible.close(visible.scenario["benchmark"], 0)
        starting = Decimal(run["starting"])
        p = one(policies, child_id=run["child_id"])
        decisions = rows(orders, run_id=run["id"])
        for decision in decisions:
            try:
                displayed = signer.loads(decision["quote"])
                decision.update(quoted_price=displayed["price"], quoted_session=displayed["session"])
            except BadSignature:
                decision.update(quoted_price=None, quoted_session=None)
        return {"run": run, "holdings": holdings, "holdings_value": money(total_holdings), "total": money(total), "gain": money(total-starting), "return_pct": money((total/starting-1)*100), "benchmark_value": money(benchmark), "benchmark_return_pct": money((benchmark/starting-1)*100), "difference": money(total-benchmark), "unrealized": money(total_holdings-total_basis), "daily_spent": money(spent(run)), "daily_remaining": money(max(Decimal(0), Decimal(p["daily"])-spent(run))), "policy_day": policy_day(run), "policy": p, "orders": decisions, "fills": rows(fills, run_id=run["id"]), "reflections": rows(reflections, run_id=run["id"]), "ended": run["mode"] == "replay" and visible.ended, "scenario": visible.scenario}

    @app.get("/api/runs/<int:rid>")
    def get_portfolio(rid):
        return jsonify(portfolio(run_access(rid)))

    @app.get("/api/runs/<int:rid>/analysis")
    def get_analysis(rid):
        run = run_access(rid)
        return jsonify(analyze(g.db, run, run_market(run)))

    @app.get("/api/runs/<int:rid>/journal")
    def get_journal(rid):
        run = run_access(rid)
        order_ids = select(orders.c.id).where(orders.c.run_id == rid)
        history = [dict(r) for r in g.db.execute(select(decision_events).where(decision_events.c.order_id.in_(order_ids)).order_by(decision_events.c.id)).mappings()]
        return jsonify(entries=rows(ledger, run_id=rid), decisions=history, reconciliation=reconcile(g.db, run))

    @app.get("/api/runs/<int:rid>/report")
    def practice_report(rid):
        run = run_access(rid)
        visible = run_market(run)
        p = portfolio(run)
        # Execution capabilities and identity credentials never belong in an exported report.
        p["orders"] = [{k: v for k, v in o.items() if k != "quote"} for o in p["orders"]]
        observations = [{"session": i, "date": observation["date"],
                         "closes": {ticker: money(visible.close(ticker, i)) for ticker in ASSETS}}
                        for i, observation in visible.observations.items()]
        order_ids = select(orders.c.id).where(orders.c.run_id == rid)
        history = [{**dict(r), "detail": json.loads(r["detail"])} for r in g.db.execute(select(decision_events).where(decision_events.c.order_id.in_(order_ids)).order_by(decision_events.c.id)).mappings()]
        return jsonify(report_version=1, generated_at=utc(), money_type="virtual", portfolio=p,
                       analysis=analyze(g.db, run, visible), visible_market=observations,
                       cash_journal=rows(ledger, run_id=rid), decision_history=history,
                       reconciliation=reconcile(g.db, run))

    def check_trade(run, order):
        if run["status"] != "active" or (run["mode"] == "replay" and run_market(run).ended):
            fail("This practice run has ended. Reflect on the outcome or ask a parent to reset it.", 409)
        p = one(policies, child_id=run["child_id"])
        if p["paused"]:
            fail("Trading is paused. Lessons and portfolio viewing remain available.", 409)
        valid_quote(run, order["ticker"], order["quote"])
        proposed = Decimal(order["amount"])
        unit_price = price(run, order["ticker"])
        quantity = (proposed / unit_price).quantize(SHARE, rounding=ROUND_DOWN)
        if quantity <= 0:
            fail("The amount is too small for this practice price.")
        cost = Decimal(money(quantity*unit_price))
        if cost <= 0:
            fail("The rounded trade must be at least one cent.")
        pos = one(positions, run_id=run["id"], ticker=order["ticker"])
        held = Decimal(pos["quantity"]) if pos else Decimal(0)
        if order["side"] == "buy":
            if proposed > Decimal(p["per_order"]):
                fail("This buy exceeds the parent's per-order limit.", 409)
            if spent(run) + cost > Decimal(p["daily"]):
                fail("This buy exceeds today's gross buying limit. Selling does not restore the allowance.", 409)
            if cost > Decimal(run["cash"]):
                fail("There is not enough available virtual cash.", 409)
        elif quantity > held:
            fail("You cannot sell more shares than you hold.", 409)
        return quantity, cost, pos

    def fill(run, order):
        if not reconcile(g.db, run)["ok"]:
            fail("This practice account needs an accounting review before another trade.", 409, "accounting_mismatch")
        quantity, cost, pos = check_trade(run, order)
        held = Decimal(pos["quantity"]) if pos else Decimal(0)
        basis = Decimal(pos["basis"]) if pos else Decimal(0)
        removed = Decimal(0)
        if order["side"] == "buy":
            new_quantity, new_basis = held + quantity, basis + cost
            cash = Decimal(run["cash"]) - cost
        else:
            removed = basis if held == quantity else Decimal(money(basis * quantity / held))
            new_quantity, new_basis = held - quantity, basis - removed
            cash = Decimal(run["cash"]) + cost
        values = {"quantity": str(new_quantity), "basis": money(new_basis)}
        change(positions, pos["id"], **values) if pos else add(positions, run_id=run["id"], ticker=order["ticker"], **values)
        change(runs, run["id"], cash=money(cash))
        fid = add(fills, order_id=order["id"], run_id=run["id"], child_id=run["child_id"], side=order["side"], ticker=order["ticker"], quantity=str(quantity), price=money(price(run, order["ticker"])), amount=money(cost), basis_removed=money(removed), policy_day=policy_day(run), session=run["session"], created=utc())
        record_fill(g.db, one(fills, id=fid))
        change(orders, order["id"], status="filled")
        decision_event(order, "filled", {"fill_id": fid})
        if not reconcile(g.db, one(runs, id=run["id"]))["ok"]:
            raise RuntimeError("Accounting invariant failed; fill rolled back.")
        return one(orders, id=order["id"])

    @app.post("/api/runs/<int:rid>/orders")
    @idempotent
    def propose(rid):
        auth("child")
        run = run_access(rid, active=True)
        data = request.json
        if "session" in data and data["session"] != run["session"]:
            fail("Trades must use the currently visible session.", 403)
        if data.get("side") not in ("buy", "sell"):
            fail("Choose buy or sell.")
        order = {"run_id": rid, "ticker": data.get("ticker"), "side": data["side"], "amount": amount(data.get("amount")), "reason": text(data.get("reason"), 20, 1000), "quote": text(data.get("quote"), 10, 2000), "status": "pending", "review": "", "created": utc()}
        check_trade(run, order)
        oid = add(orders, **order)
        order["id"] = oid
        decision_event(order, "proposed", {"amount": order["amount"], "ticker": order["ticker"], "side": order["side"]})
        return order if one(policies, child_id=run["child_id"])["approval"] else fill(run, order)

    @app.post("/api/orders/<int:oid>/review")
    @idempotent
    def review(oid):
        auth("parent")
        order = one(orders, id=oid)
        if not order:
            fail("Order not found.", 404)
        run = run_access(order["run_id"])
        action = request.json.get("action")
        if action not in ("approve", "reject"):
            fail("Choose approve or reject.")
        if order["status"] != "pending":
            return order
        message = text(request.json.get("review", ""), 5, 500)
        change(orders, oid, review=message)
        decision_event(order, "approved" if action == "approve" else "rejected", {"feedback": message})
        if action == "reject":
            change(orders, oid, status="rejected")
            return one(orders, id=oid)
        return fill(run, order)

    @app.post("/api/orders/<int:oid>/cancel")
    @idempotent
    def cancel(oid):
        auth("child")
        order = one(orders, id=oid)
        if not order:
            fail("Order not found.", 404)
        run_access(order["run_id"])
        if order["status"] == "pending":
            change(orders, oid, status="cancelled")
            decision_event(order, "cancelled")
        return one(orders, id=oid)

    @app.post("/api/orders/<int:oid>/reconfirm")
    @idempotent
    def reconfirm(oid):
        auth("child")
        order = one(orders, id=oid)
        if not order:
            fail("Order not found.", 404)
        run = run_access(order["run_id"], active=True)
        if order["status"] != "pending":
            fail("Only pending proposals can be reconfirmed.", 409)
        order["quote"] = text(request.json.get("quote"), 10, 2000)
        check_trade(run, order)
        change(orders, oid, quote=order["quote"])
        decision_event(order, "reconfirmed", {"price": money(price(run, order["ticker"]))})
        return one(orders, id=oid)

    @app.post("/api/runs/<int:rid>/advance")
    @idempotent
    def advance(rid):
        auth("child")
        run = run_access(rid, active=True)
        if run["mode"] != "replay":
            fail("Start a replay to advance sessions.", 409)
        if integer(request.json.get("expected_session")) != run["session"]:
            fail("The session already advanced. Reload to see the current market.", 409)
        if run_market(run).ended:
            fail("This scenario is complete.", 409)
        change(runs, rid, session=run["session"] + 1)
        return {"session": run["session"] + 1}

    @app.post("/api/runs/<int:rid>/reflection")
    @idempotent
    def reflect(rid):
        child = auth("child")
        run_access(rid)
        content = text(request.json.get("text"), 30, 2000)
        ref_id = add(reflections, run_id=rid, child_id=child["id"], text=content, created=utc())
        return one(reflections, id=ref_id)

    @app.get("/api/lessons")
    def lessons():
        auth()
        return jsonify([{k: v for k, v in lesson.items() if k not in ("answer", "feedback")} | {"exercise": {k: v for k, v in lesson["exercise"].items() if k != "answer"}} for lesson in LESSONS])

    @app.get("/api/children/<int:cid>/progress")
    def get_progress(cid):
        child_access(cid)
        return jsonify(rows(progress, child_id=cid))

    @app.get("/api/children/<int:cid>/tutorial")
    def get_tutorial(cid):
        child_access(cid)
        return jsonify(one(tutorials, child_id=cid) or dict(child_id=cid, status="not_started", step=0, revision=0, updated=None))

    @app.put("/api/children/<int:cid>/tutorial")
    @idempotent
    def save_tutorial(cid):
        auth("child")
        child_access(cid)
        data = request.json
        step, revision = integer(data.get("step")), integer(data.get("expected_revision"))
        status = data.get("status")
        if status not in ("in_progress", "skipped", "completed") or not 0 <= step <= 6 or (status == "completed") != (step == 6):
            fail("Choose a valid tutorial step.")
        previous = one(tutorials, child_id=cid)
        if revision != (previous["revision"] if previous else 0):
            fail("Your tour changed in another tab. Refresh to continue from its saved step.", 409, "stale_tutorial")
        values = dict(status=status, step=step, revision=revision + 1, updated=utc())
        change(tutorials, previous["id"], **values) if previous else add(tutorials, child_id=cid, **values)
        return one(tutorials, child_id=cid)

    @app.post("/api/lessons/<lesson_id>/complete")
    @idempotent
    def complete(lesson_id):
        child = auth("child")
        lesson = next((l for l in LESSONS if l["id"] == lesson_id), None)
        if not lesson:
            fail("Lesson not found.", 404)
        answer = integer(request.json.get("answer"))
        if answer not in range(len(lesson["options"])):
            fail("Choose one of the lesson answers.")
        exercise = text(str(request.json.get("exercise", "")), 1, 1000)
        correct_exercise = False
        if lesson["exercise"]["type"] == "text":
            correct_exercise = len(exercise) >= 20
        else:
            try:
                correct_exercise = Decimal(exercise).is_finite() and Decimal(exercise) == Decimal(lesson["exercise"]["answer"])
            except InvalidOperation:
                pass
        correct = answer == lesson["answer"] and correct_exercise
        add(lesson_attempts, child_id=child["id"], lesson=lesson_id, answer=answer, exercise=exercise,
            quiz_correct=int(answer == lesson["answer"]), exercise_correct=int(correct_exercise), created=utc())
        previous = one(progress, child_id=child["id"], lesson=lesson_id)
        values = {"attempts": previous["attempts"] + 1 if previous else 1, "completed": int(bool(correct or (previous and previous["completed"]))), "answer": answer, "exercise": exercise, "updated": utc()}
        change(progress, previous["id"], **values) if previous else add(progress, child_id=child["id"], lesson=lesson_id, **values)
        return {"correct": correct, "completed": bool(values["completed"]), "feedback": lesson["feedback"], "exercise_feedback": "Exercise correct." if correct_exercise else "Revisit the worked example and try the exercise again."}

    @app.get("/api/children/<int:cid>/review")
    def family_review(cid):
        auth("parent")
        child_access(cid)
        child_runs = rows(runs, child_id=cid)
        run_map = {r["id"]: r for r in child_runs}
        all_orders = [dict(o) for o in g.db.execute(select(orders).where(orders.c.run_id.in_(list(run_map))).order_by(orders.c.id)).mappings()]
        for order in all_orders:
            r = run_map[order["run_id"]]
            order["run_title"] = run_market(r).scenario["title"] if r["mode"] == "replay" else "Offline sandbox"
            try:
                displayed = signer.loads(order["quote"])
                order.update(quoted_price=displayed["price"], quoted_session=displayed["session"])
            except BadSignature:
                order.update(quoted_price=None, quoted_session=None)
        return jsonify(progress=rows(progress, child_id=cid), events=rows(events, child_id=cid), reflections=rows(reflections, child_id=cid), fills=rows(fills, child_id=cid),
                       orders=all_orders, learning=learning_view(cid))

    def learning_view(cid):
        completed = {p["lesson"]: p for p in rows(progress, child_id=cid)}
        history = rows(lesson_attempts, child_id=cid)
        summary = []
        for lesson in LESSONS:
            observed = [a for a in history if a["lesson"] == lesson["id"]]
            p = completed.get(lesson["id"])
            summary.append({"id": lesson["id"], "title": lesson["title"], "completed": bool(p and p["completed"]),
                            "attempts": p["attempts"] if p else 0, "recorded_attempts": len(observed),
                            "quiz_correct": sum(a["quiz_correct"] for a in observed),
                            "exercise_correct": sum(a["exercise_correct"] for a in observed),
                            "last_attempt": observed[-1] if observed else None})
        return {"lessons": summary, "recent_attempts": list(reversed(history[-20:])),
                "completed": sum(s["completed"] for s in summary),
                "unrecorded_legacy_attempts": sum(s["attempts"] - s["recorded_attempts"] for s in summary)}

    @app.get("/api/children/<int:cid>/learning")
    def get_learning(cid):
        child_access(cid)
        return jsonify(learning_view(cid))

    @app.get("/api/glossary")
    def glossary():
        auth()
        return jsonify(GLOSSARY)

    @app.route("/api/children/<int:cid>/goal", methods=["GET", "PUT"])
    def goal(cid):
        child_access(cid)
        if request.method == "GET":
            return jsonify(one(goals, child_id=cid))
        auth("child")
        data = {"title": text(request.json.get("title"), 3, 80), "target": amount(request.json.get("target"))}
        existing = one(goals, child_id=cid)
        change(goals, existing["id"], **data) if existing else add(goals, child_id=cid, **data)
        return jsonify(one(goals, child_id=cid))

    @app.route("/api/children/<int:cid>/watchlist", methods=["GET", "PUT"])
    def watches(cid):
        child_access(cid)
        if request.method == "PUT":
            auth("child")
            tickers = request.json.get("tickers")
            if not isinstance(tickers, list) or any(t not in ASSETS for t in tickers):
                fail("Choose curated assets.")
            g.db.execute(delete(watchlist).where(watchlist.c.child_id == cid))
            for ticker in sorted(set(tickers)):
                add(watchlist, child_id=cid, ticker=ticker)
        return jsonify([r["ticker"] for r in rows(watchlist, child_id=cid)])

    @app.get("/api/market/history/<ticker>")
    def live_history(ticker):
        auth()
        if not app.config["ENABLE_LIVE_MARKET"]:
            fail("Live market exploration is disabled. Offline practice and lessons remain available.", 503)
        if ticker not in ASSETS:
            fail("Choose a curated ticker.", 404)
        try:
            try:
                from .market import YahooProvider
            except ImportError:
                from market import YahooProvider
            return jsonify(YahooProvider.history(ticker))
        except Exception:
            fail("Market provider is unavailable. Your offline practice is unaffected.", 503)

    @app.get("/api/predict")
    def prediction():
        auth()
        # No unverifiable artifact is executed or silently relabeled.
        return jsonify(available=False, target="Close gains strictly above 2% over five trading sessions", reason="No reviewed model artifact is bundled. Prediction inference is optional and unavailable in this release.", metrics=None)

    @app.get("/")
    @app.get("/<path:path>")
    def frontend(path="index.html"):
        if path.startswith("api/"):
            fail("Endpoint not found.", 404)
        dist = ROOT / "frontend" / "dist"
        if not (dist / "index.html").exists():
            return "Build the frontend with npm run build in frontend, or use the Vite dev server.", 503
        if (dist / path).is_file():
            return send_from_directory(dist, path)
        return send_from_directory(dist, "index.html")

    return app

if __name__ == "__main__":
    create_app().run(host="127.0.0.1", port=int(os.getenv("PORT", "5000")), debug=False)
