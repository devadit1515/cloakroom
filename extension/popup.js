const DEFAULT_API = "https://cloakroom-mu.vercel.app/api";

const $ = (id) => document.getElementById(id);

chrome.storage.local.get(["enabled", "apiBase", "sessionId"]).then((c) => {
  $("enabled").checked = c.enabled !== false;
  $("apiBase").value = c.apiBase || DEFAULT_API;
  $("sessionId").value = c.sessionId || "cloak-ext";
});

$("save").addEventListener("click", async () => {
  await chrome.storage.local.set({
    enabled: $("enabled").checked,
    apiBase: $("apiBase").value.trim() || DEFAULT_API,
    sessionId: $("sessionId").value.trim() || "cloak-ext",
  });
  $("save").textContent = "Saved ✓";
  setTimeout(() => ($("save").textContent = "Save"), 1200);
});
