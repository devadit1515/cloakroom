// Network calls run in the service worker so they use the extension's
// host_permissions (no page CORS issues) and the raw text only ever goes to
// the Cloakroom server you configured.

const DEFAULT_API = "https://cloakroom-mu.vercel.app/api";

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type !== "cloak:mask") return;
  (async () => {
    try {
      const cfg = await chrome.storage.local.get(["apiBase", "sessionId"]);
      const base = (cfg.apiBase || DEFAULT_API).replace(/\/+$/, "");
      const res = await fetch(base + "/mask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          payload: msg.text,
          session_id: cfg.sessionId || "cloak-ext",
          strategy: "token",
        }),
      });
      if (!res.ok) throw new Error("mask HTTP " + res.status);
      sendResponse({ ok: true, data: await res.json() });
    } catch (e) {
      sendResponse({ ok: false, error: String(e && e.message ? e.message : e) });
    }
  })();
  return true; // keep the message channel open for the async response
});
