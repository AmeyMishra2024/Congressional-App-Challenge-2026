"""Relational schema shared by migrations, accounting and HTTP routes."""
from sqlalchemy import Column, Integer, MetaData, String, Table, UniqueConstraint, ForeignKey, ForeignKeyConstraint, CheckConstraint, Index

metadata = MetaData()

def table(name, *columns, constraints=()):
    references = {"family_id": "families.id", "demo_family": "families.id", "user_id": "users.id", "child_id": "users.id", "actor_id": "users.id", "run_id": "runs.id", "order_id": "orders.id"}
    for column in columns:
        if column.name in references:
            column.append_foreign_key(ForeignKey(references[column.name]))
    return Table(name, metadata, Column("id", Integer, primary_key=True), *columns, *constraints)

families = table("families", Column("demo", Integer, nullable=False, default=0), Column("created", String, nullable=False))
users = table("users", Column("family_id", Integer, nullable=False), Column("role", String, nullable=False), Column("name", String, nullable=False), Column("login", String, nullable=False), Column("secret_hash", String, nullable=False), constraints=(UniqueConstraint("family_id", "role", "login"),))
policies = table("policies", Column("child_id", Integer, nullable=False, unique=True), Column("starting", String, nullable=False), Column("per_order", String, nullable=False), Column("daily", String, nullable=False), Column("approval", Integer, nullable=False), Column("paused", Integer, nullable=False))
sessions = table("sessions", Column("token", String, nullable=False, unique=True), Column("user_id", Integer), Column("demo_family", Integer), Column("csrf", String, nullable=False), Column("expires", Integer, nullable=False))
runs = table("runs", Column("child_id", Integer, nullable=False), Column("mode", String, nullable=False), Column("scenario", String, nullable=False), Column("session", Integer, nullable=False), Column("cash", String, nullable=False), Column("starting", String, nullable=False), Column("status", String, nullable=False), Column("created", String, nullable=False))
positions = table("positions", Column("run_id", Integer, nullable=False), Column("ticker", String, nullable=False), Column("quantity", String, nullable=False), Column("basis", String, nullable=False), constraints=(UniqueConstraint("run_id", "ticker"),))
orders = table("orders", Column("run_id", Integer, nullable=False), Column("ticker", String, nullable=False), Column("side", String, nullable=False), Column("amount", String, nullable=False), Column("reason", String, nullable=False), Column("quote", String, nullable=False), Column("status", String, nullable=False), Column("review", String, nullable=False, default=""), Column("created", String, nullable=False))
fills = table("fills", Column("order_id", Integer, nullable=False, unique=True), Column("run_id", Integer, nullable=False), Column("child_id", Integer, nullable=False), Column("side", String, nullable=False), Column("ticker", String, nullable=False), Column("quantity", String, nullable=False), Column("price", String, nullable=False), Column("amount", String, nullable=False), Column("basis_removed", String, nullable=False), Column("policy_day", String, nullable=False), Column("session", Integer, nullable=False), Column("created", String, nullable=False))
progress = table("progress", Column("child_id", Integer, nullable=False), Column("lesson", String, nullable=False), Column("attempts", Integer, nullable=False), Column("completed", Integer, nullable=False), Column("answer", Integer, nullable=False), Column("exercise", String, nullable=False), Column("updated", String, nullable=False), constraints=(UniqueConstraint("child_id", "lesson"),))
reflections = table("reflections", Column("run_id", Integer, nullable=False), Column("child_id", Integer, nullable=False), Column("text", String, nullable=False), Column("created", String, nullable=False))
goals = table("goals", Column("child_id", Integer, nullable=False, unique=True), Column("title", String, nullable=False), Column("target", String, nullable=False))
watchlist = table("watchlist", Column("child_id", Integer, nullable=False), Column("ticker", String, nullable=False), constraints=(UniqueConstraint("child_id", "ticker"),))
events = table("events", Column("child_id", Integer, nullable=False), Column("actor_id", Integer, nullable=False), Column("kind", String, nullable=False), Column("detail", String, nullable=False), Column("created", String, nullable=False))
receipts = table("receipts", Column("user_id", Integer, nullable=False), Column("route", String, nullable=False), Column("key", String, nullable=False), Column("digest", String, nullable=False), Column("result", String, nullable=False), constraints=(UniqueConstraint("user_id", "route", "key"),))
attempts = table("login_attempts", Column("bucket", String, nullable=False, index=True), Column("created", Integer, nullable=False))

# Additive schema: existing accounts and runs are upgraded without table replacement.
schema_versions = Table("schema_versions", metadata, Column("version", Integer, primary_key=True), Column("applied", String, nullable=False))
datasets = Table("datasets", metadata,
    Column("key", String, primary_key=True), Column("scenario_id", String, nullable=False),
    Column("version", Integer, nullable=False), Column("title", String, nullable=False),
    Column("description", String, nullable=False), Column("focus", String, nullable=False),
    Column("benchmark", String, nullable=False), Column("session_count", Integer, nullable=False),
    Column("provenance", String, nullable=False), Column("checksum", String, nullable=False),
    UniqueConstraint("scenario_id", "version"), CheckConstraint("session_count > 0"))
market_sessions = Table("market_sessions", metadata,
    Column("dataset", String, ForeignKey("datasets.key"), primary_key=True),
    Column("session", Integer, primary_key=True), Column("date", String, nullable=False),
    Column("news", String, nullable=False), UniqueConstraint("dataset", "date"), CheckConstraint("session >= 0"))
prices = Table("prices", metadata,
    Column("dataset", String, ForeignKey("datasets.key"), primary_key=True),
    Column("session", Integer, primary_key=True), Column("ticker", String, primary_key=True),
    Column("close", String, nullable=False), CheckConstraint("session >= 0"),
    CheckConstraint("CAST(close AS REAL) > 0"),
    ForeignKeyConstraint(["dataset", "session"], ["market_sessions.dataset", "market_sessions.session"]))
ledger = table("ledger",
    Column("run_id", Integer, nullable=False), Column("fill_id", Integer, ForeignKey("fills.id"), unique=True),
    Column("source", String, nullable=False, unique=True), Column("kind", String, nullable=False),
    Column("ticker", String), Column("session", Integer, nullable=False),
    Column("cash_delta", String, nullable=False), Column("quantity_delta", String, nullable=False),
    Column("basis_delta", String, nullable=False), Column("created", String, nullable=False),
    constraints=(CheckConstraint("kind IN ('opening', 'buy', 'sell')"), CheckConstraint("session >= 0")))
lesson_attempts = table("lesson_attempts",
    Column("child_id", Integer, nullable=False), Column("lesson", String, nullable=False),
    Column("answer", Integer, nullable=False), Column("exercise", String, nullable=False),
    Column("quiz_correct", Integer, nullable=False), Column("exercise_correct", Integer, nullable=False),
    Column("created", String, nullable=False),
    constraints=(CheckConstraint("quiz_correct IN (0, 1)"), CheckConstraint("exercise_correct IN (0, 1)")))
decision_events = table("decision_events",
    Column("order_id", Integer, nullable=False), Column("actor_id", Integer),
    Column("kind", String, nullable=False), Column("session", Integer, nullable=False),
    Column("detail", String, nullable=False), Column("created", String, nullable=False))

# Guidance is separate from assessed lesson progress and immutable financial records.
tutorials = table("tutorials", Column("child_id", Integer, nullable=False, unique=True),
    Column("status", String, nullable=False), Column("step", Integer, nullable=False),
    Column("revision", Integer, nullable=False), Column("updated", String, nullable=False),
    constraints=(CheckConstraint("status IN ('not_started','in_progress','skipped','completed')"),
                 CheckConstraint("step BETWEEN 0 AND 6"), CheckConstraint("revision > 0"),
                 CheckConstraint("(status='completed' AND step=6) OR (status!='completed' AND step<6)")))

Index("ix_runs_child_mode_status", runs.c.child_id, runs.c.mode, runs.c.status)
Index("ix_orders_run_status", orders.c.run_id, orders.c.status)
Index("ix_fills_daily_policy", fills.c.child_id, fills.c.side, fills.c.policy_day)
Index("ix_fills_run_session", fills.c.run_id, fills.c.session)
Index("ix_ledger_run", ledger.c.run_id)
Index("ix_attempts_child_lesson", lesson_attempts.c.child_id, lesson_attempts.c.lesson)
Index("ix_decision_events_order", decision_events.c.order_id)
