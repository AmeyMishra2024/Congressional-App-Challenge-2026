import Icon from "./Icon.jsx";

function practiceName(run, runs, scenarios) {
  const title =
    run.mode === "replay"
      ? scenarios.find((scenario) => scenario.id === run.scenario)?.title ||
        "Market replay"
      : "Practice wallet";
  if (run.status !== "archived") return title;
  const earlier = runs.filter(
    (item) =>
      item.mode === run.mode &&
      item.scenario === run.scenario &&
      item.status === "archived",
  );
  return `${title} · past attempt ${earlier.findIndex((item) => item.id === run.id) + 1} (read only)`;
}

export default function WorkspaceHeader({
  session,
  pageName,
  cid,
  rid,
  runs,
  scenarios,
  policy,
  busy,
  onSignOut,
  onSwitchRole,
  onChangeChild,
  onChangeRun,
}) {
  const { user } = session;
  return (
    <header className="workspace-header" aria-label="Workspace toolbar">
      <div className="workspace-header-top">
        <div className="header-heading">
          <span className="header-location">{pageName}</span>
          <span className="header-virtual">
            <Icon name="parent" />
            Practice money only
          </span>
        </div>
        <div className="header-account">
          <div className="header-person">
            <span className="header-avatar" aria-hidden="true">
              {user.name.slice(0, 2).toUpperCase()}
            </span>
            <span className="header-person-copy">
              <strong>{user.name}</strong>
              <small>
                {user.role === "parent" ? "Parent view" : "Student view"}
              </small>
            </span>
          </div>
          <button
            className="header-signout"
            disabled={busy}
            onClick={onSignOut}
          >
            Sign out
          </button>
        </div>
      </div>
      <div className="workspace-toolbar">
        <div className="workspace-context">
          <div className="workspace-selectors">
            {user.role === "parent" && session.children.length > 0 && (
              <label className="toolbar-field header-child-field">
                <span>Child</span>
                <select
                  aria-label="Child profile"
                  value={cid || ""}
                  disabled={busy}
                  onChange={(event) =>
                    onChangeChild(Number(event.target.value))
                  }
                >
                  {session.children.map((child) => (
                    <option key={child.id} value={child.id}>
                      {child.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {runs.length > 0 && (
              <label className="toolbar-field header-practice-field">
                <span>Practice</span>
                <select
                  aria-label="Practice space"
                  value={rid || ""}
                  disabled={busy}
                  onChange={(event) => onChangeRun(Number(event.target.value))}
                >
                  {runs.map((run) => (
                    <option key={run.id} value={run.id}>
                      {practiceName(run, runs, scenarios)}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>
          {policy?.paused ? (
            <span className="header-policy is-paused">
              <Icon name="parent" />
              Trading paused · lessons open
            </span>
          ) : policy?.approval ? (
            <span className="header-policy">
              <Icon name="parent" />
              Parent review on
            </span>
          ) : null}
        </div>
        {session.demo && (
          <div
            className="header-demo-controls"
            role="group"
            aria-label="Preview controls"
          >
            <details className="header-preview-info">
              <summary>Demo preview</summary>
              <div className="header-preview-popover">
                <strong>Fictional family</strong>
                <p>
                  {session.public_preview
                    ? "Practice is saved only in this browser. There are no real accounts or shared family data in this public preview."
                    : "This isolated judge demo is separate from real family accounts. Role switching is only available in the demo."}
                </p>
              </div>
            </details>
            <button
              className="header-role-switch"
              disabled={busy}
              onClick={onSwitchRole}
            >
              Switch to {user.role === "parent" ? "child" : "parent"}
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
