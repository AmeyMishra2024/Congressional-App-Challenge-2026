# Database design and upgrades

Schema version: **3**. SQLAlchemy Core defines relational tables in `backend/db.py`. Python Decimal performs accounting; SQLite stores canonical decimal strings to avoid binary floating-point money. `backend/migrations.py` applies each numbered migration once within an explicit `BEGIN IMMEDIATE` transaction. Startup rejects databases newer than the application or non-contiguous migration history.

## What changed and why

| Need | Records and invariant |
|---|---|
| Keep old practice data during upgrades | `schema_versions`, transactional DDL and backfill, automatic SQLite backup |
| Independent scenarios with reproducible prices | `datasets`, `market_sessions`, `prices`; dataset version, provenance and SHA-256 fixture checksum |
| Prevent a scenario from changing under an existing run | Immutable market tables; run dataset identity cannot change |
| Explain and check every cash/position movement | `ledger`; one opening entry per run and one entry per fill |
| Preserve the whole decision process | `decision_events`; actor, session, event kind, details and recorded time |
| See learning development instead of only the latest answer | `lesson_attempts`; separate quiz and exercise results for each attempt |
| Resume guidance without affecting assessed learning or money | `tutorials`; one child-owned state, optimistic revision, bounded steps and status |
| Keep read paths efficient | Child/run/status, fill/session, gross-buy policy, journal/run and attempt/lesson indexes |

Families own users. Child users own policies, runs, learning and goals. Runs own positions, orders, fills and reflections. Every fill links to exactly one order and one ledger entry. A partial unique index permits one active run for each child/mode/dataset; reset archives the old run before opening another. Prices use a composite foreign key to a dataset's actual session. The run's dataset/session is checked with SQLite triggers, including sandbox session zero and replay's final boundary.

## Upgrade behavior

1. If an existing file needs an upgrade, SQLite's backup API creates a uniquely named adjacent `sprout.db.pre-v3-<UTC timestamp>.bak` for the current target version. This includes committed WAL data. Existing backups are never overwritten. Protect backups like the original database; they contain account data.
2. Migration 1 adopts or creates the original core tables. Migration 2 adds market datasets, attempts, decision events, journal records, indexes and invariant triggers. Migration 3 adds only a child-owned `tutorials` table; it does not rewrite accounts, learning, prices or financial records.
3. Existing runs receive opening entries and their recorded fills become journal entries. Cash, quantities and basis must reconcile before the upgrade commits. A mismatch aborts the entire upgrade; it does not silently rewrite balances.
4. Legacy lesson completion and attempt counts remain unchanged. Past detailed attempts cannot be recovered from the old overwritten row. The UI identifies those missing details instead of creating invented answers.
5. Legacy orders receive an explicitly labeled imported-state event, recorded at upgrade time. Earlier approval or reconfirmation timestamps are not invented.

Concurrent startup serializes on SQLite's write lock and rechecks migration history. Startup after a successful upgrade does not reseed data or repeat journal backfills. Tests exercise existing-account/session preservation, failed-upgrade rollback and concurrent startup.

No automatic downgrade is provided. To restore, stop all application processes, preserve the current database and WAL/SHM files, and restore a consistent backup into a separate database file with the matching application version. Point `DATABASE_URL` to that file. Verify it with `check-db` before reopening access. Do not overwrite a running database or copy only a live main file while WAL writes are active.

## Accounting invariants

An opening entry credits the configured virtual starting funds. A buy debits cash, credits fractional shares and adds executed cost to basis. A sell credits cash, removes shares and removes proportional basis. Eight-decimal shares round down; dollar amounts round half-up to cents. Unique source/fill links prevent duplicate journal posting. Fills, ledger entries, lesson attempts and decision events reject ordinary UPDATE and DELETE operations.

Execution first reconciles the account. The same write transaction updates cash/positions, appends the fill and journal entry, records the terminal decision event and stores the retry receipt. It reconciles again before commit. A failure rolls back all of them. These are independent persisted records for consistency checking; this is not a cryptographic tamper-proof journal or a full double-entry brokerage accounting system.

Run diagnostics from the repository root:

```powershell
.\.venv\Scripts\python.exe -m backend.manage check-db
```

The command performs normal pending migrations with backup, checks SQLite integrity and foreign keys, reconciles every run, and exits nonzero on an error. Its output contains run IDs and accounting results, not credentials, PIN hashes or session tokens. It never repairs discrepancies automatically.

## Dataset versions and reports

Each run stores the exact dataset key. Seeded observations are immutable; a future changed fixture must use a new key/version and a numbered migration, retaining old observations for existing runs. Do not edit the installed price tables or change a run's dataset in place. The checksum identifies the complete original fixture, not a source license or prediction guarantee.

Market and analysis queries bound observations in SQL to the run's visible session. Reports are built within one read transaction and contain only those observations, the virtual portfolio, fill-derived path, cash journal, decisions and reflections. Execution quote capabilities and identity credentials are omitted. Reports are local JSON downloads; no sharing service is involved.

SQLite remains a single-host durable-disk design. Row values written outside the application can still violate Decimal or ownership rules despite foreign keys/triggers. Reconciliation detects accounting drift; a privileged database administrator can replace the entire database. Backups, recovery practice and access controls remain operational responsibilities.

## Tutorial state (schema 3)

One optional row per child records status (`in_progress`, `skipped`, `completed`), the next step, revision and update time. An absent row reads as `not_started`, step 0, revision 0 without mutating an old profile. Completion uses step 6. Parents can read their own child's state; only that child can update it. Foreign keys, range/status constraints, optimistic revisions, CSRF protection and idempotent receipts protect writes. A stale tab gets a conflict rather than silently replacing newer progress. Skipping preserves the step; resuming continues it; replay starts at 0. Tutorial completion grants no funds, lesson completion or trading privileges. The public-preview adapter has the same child-scoped guidance state in its existing local-storage structure, without resetting older fictional profiles.
