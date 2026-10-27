"""Local database diagnostics. Prints integrity results, never credentials or session tokens."""
import argparse
import json
from .app import create_app
from .accounting import reconcile_all
from .migrations import LATEST_VERSION

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("command", choices=["check-db"])
    parser.parse_args()
    app = create_app()
    with app.extensions["db"].connect() as db:
        integrity = db.exec_driver_sql("PRAGMA integrity_check").scalar_one()
        foreign_keys = db.exec_driver_sql("PRAGMA foreign_key_check").fetchall()
        accounts = reconcile_all(db)
        ok = integrity == "ok" and not foreign_keys and all(r["ok"] for r in accounts)
        print(json.dumps({"ok": ok, "schema_version": LATEST_VERSION, "integrity": integrity,
                          "foreign_key_errors": len(foreign_keys), "runs": accounts}, indent=2))
    app.extensions["db"].dispose()
    return 0 if ok else 1

if __name__ == "__main__":
    raise SystemExit(main())
