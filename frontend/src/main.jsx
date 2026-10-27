import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import "./style.css";
import "./modern.css";
import "./learning.css";
import "./workspace-header.css";
import "./student.css";
import "./clarity.css";
createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
if ("serviceWorker" in navigator && window.isSecureContext) {
  window.addEventListener("load", () =>
    navigator.serviceWorker.register("/sw.js").catch(() => {
      /* Installation is optional; online app remains available. */
    }),
  );
}
