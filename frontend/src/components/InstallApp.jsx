import { useEffect, useState } from "react";

export default function InstallApp() {
  const [prompt, setPrompt] = useState(null);
  const [instructions, setInstructions] = useState(false);
  const [installed, setInstalled] = useState(
    () => window.matchMedia("(display-mode: standalone)").matches,
  );
  useEffect(() => {
    const ready = (event) => {
      event.preventDefault();
      setPrompt(event);
    };
    const done = () => {
      setInstalled(true);
      setPrompt(null);
    };
    window.addEventListener("beforeinstallprompt", ready);
    window.addEventListener("appinstalled", done);
    return () => {
      window.removeEventListener("beforeinstallprompt", ready);
      window.removeEventListener("appinstalled", done);
    };
  }, []);
  return (
    <section className="card install-app">
      <h2>Install Sprout</h2>
      <p>
        Add the web app to your home screen. You'll still need a connection to
        sign in, save progress, and make practice decisions.
      </p>
      {installed ? (
        <p role="status">You're using the installed web app.</p>
      ) : (
        <button
          className="secondary"
          onClick={async () => {
            if (prompt) {
              try {
                await prompt.prompt();
                const choice = await prompt.userChoice;
                setInstructions(choice.outcome !== "accepted");
              } catch {
                setInstructions(true);
              } finally {
                setPrompt(null);
              }
            } else setInstructions(!instructions);
          }}
        >
          {prompt ? "Install Sprout" : "How to add to home screen"}
        </button>
      )}
      {instructions && (
        <div className="notice">
          <h3>Add from your browser</h3>
          <p>
            On iPhone or iPad, open in Safari, use Share, then Add to Home
            Screen. On Android, open the browser menu and look for Install app
            or Add to home screen. Availability depends on your browser and a
            secure connection.
          </p>
          <p>
            Sprout installs through your browser rather than the App Store or
            Google Play. Installation does not add real accounts or change where
            this version saves your progress.
          </p>
          <p>
            On desktop Chrome or Edge, use the address-bar install icon or the
            browser menu. If installation isn't offered, bookmark this page.
          </p>
        </div>
      )}
    </section>
  );
}
