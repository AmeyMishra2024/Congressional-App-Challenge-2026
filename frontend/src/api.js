let csrf = "";
const pending = new Map();
export const key = () => crypto.randomUUID();
export function security(token) {
  csrf = token;
}
export async function api(path, body, method = "POST", retryKey) {
  // No background mutation queue: reconnect and explicitly retry every change.
  if (body !== undefined && navigator.onLine === false)
    throw new Error(
      "You're offline. Reconnect before saving or making a practice trade. Nothing has been queued.",
    );
  if (import.meta.env.MODE === "public-preview") {
    return (await import("./preview/api.js")).previewApi(
      path,
      body,
      method,
      retryKey,
    );
  }
  const fingerprint = `${method}:${path}:${JSON.stringify(body)}`;
  const requestKey = retryKey || pending.get(fingerprint) || key();
  if (body !== undefined) pending.set(fingerprint, requestKey);
  const response = await fetch(`/api${path}`, {
    method: body === undefined ? "GET" : method,
    credentials: "same-origin",
    headers:
      body === undefined
        ? {}
        : {
            "Content-Type": "application/json",
            "X-CSRF-Token": csrf,
            "Idempotency-Key": requestKey,
          },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  }).catch(() => {
    throw new Error(
      "We couldn't connect. Check your connection and try again. If you were saving a decision, refresh to check whether it arrived before retrying.",
    );
  });
  let result;
  try {
    result = await response.json();
  } catch {
    throw new Error(
      "The server is unavailable. Check that the backend is running.",
    );
  }
  if (response.status < 500) pending.delete(fingerprint);
  if (!response.ok) {
    const error = new Error(result.error || "Request could not be completed.");
    error.code = result.code;
    throw error;
  }
  return result;
}
