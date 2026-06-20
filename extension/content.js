// Cloakroom content script for ChatGPT / Claude.
//
// Flow:
//   1. You type a normal message and click "Cloak input" (or hit the hotkey).
//   2. We send it to Cloakroom /mask, which returns the masked text + a
//      token->value map. We drop the masked text into the composer; you send it.
//      The model only ever receives tokens like [PFI_ACCOUNT_1].
//   3. A MutationObserver watches the page; whenever a token appears in a
//      rendered message (your sent bubble or the reply), we swap it back to the
//      real value LOCALLY using the stored map. The mapping never persists on
//      the server; unmasking happens entirely in your browser.

const TOKEN_RE = /\[(?:PII|PHI|PFI)_[A-Z]+_\d+\]/g;
const MAP = {};               // token -> real value (this page session)
let ENABLED = true;

// ---- settings ---------------------------------------------------------------
chrome.storage.local.get(["enabled", "cloakMap"]).then((c) => {
  ENABLED = c.enabled !== false;
  if (c.cloakMap) Object.assign(MAP, c.cloakMap);
  unmaskTree(document.body);
  renderStatus();
});
chrome.storage.onChanged.addListener((ch) => {
  if (ch.enabled) {
    ENABLED = ch.enabled.newValue !== false;
    renderStatus();
  }
});

// ---- composer helpers -------------------------------------------------------
function isVisible(el) {
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0;
}

function findComposer() {
  const ce = [...document.querySelectorAll('[contenteditable="true"]')].filter(isVisible);
  if (ce.length) return ce[ce.length - 1];
  const ta = [...document.querySelectorAll("textarea")].filter(isVisible);
  if (ta.length) return ta[ta.length - 1];
  return null;
}

function readComposer(el) {
  return (el.tagName === "TEXTAREA" ? el.value : el.innerText || "").trim();
}

function setComposer(el, text) {
  if (el.tagName === "TEXTAREA") {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value").set;
    setter.call(el, text);
    el.dispatchEvent(new InputEvent("input", { bubbles: true }));
  } else {
    el.focus();
    document.execCommand("selectAll", false, null);
    document.execCommand("insertText", false, text);
    el.dispatchEvent(new InputEvent("input", { bubbles: true }));
  }
}

// ---- mask -------------------------------------------------------------------
async function cloakInput() {
  const el = findComposer();
  if (!el) return setStatus("No input box found");
  const text = readComposer(el);
  if (!text) return setStatus("Type something first");

  setStatus("Masking…");
  const resp = await chrome.runtime.sendMessage({ type: "cloak:mask", text });
  if (!resp || !resp.ok) return setStatus("Error: " + (resp && resp.error));

  const { masked_payload, mapping } = resp.data;
  Object.assign(MAP, mapping);
  chrome.storage.local.set({ cloakMap: MAP });
  setComposer(el, masked_payload);
  const n = Object.keys(mapping).length;
  setStatus(n ? `Masked ${n} value(s) — now send` : "Nothing sensitive found");
}

// ---- unmask (local) ---------------------------------------------------------
function inComposer(node) {
  let el = node.parentElement;
  while (el) {
    if (el.isContentEditable || el.tagName === "TEXTAREA") return true;
    el = el.parentElement;
  }
  return false;
}

function unmaskTree(root) {
  if (!ENABLED || !root || !Object.keys(MAP).length) return;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const hits = [];
  while (walker.nextNode()) {
    const n = walker.currentNode;
    if (n.nodeValue && n.nodeValue.indexOf("[") !== -1 && !inComposer(n)) hits.push(n);
  }
  for (const n of hits) {
    n.nodeValue = n.nodeValue.replace(TOKEN_RE, (t) => (t in MAP ? MAP[t] : t));
  }
}

const observer = new MutationObserver((muts) => {
  if (!ENABLED) return;
  for (const m of muts) {
    for (const node of m.addedNodes) {
      if (node.nodeType === 1) unmaskTree(node);
      else if (node.nodeType === 3 && node.parentNode) unmaskTree(node.parentNode);
    }
  }
});
observer.observe(document.body, { childList: true, subtree: true });

// ---- floating UI ------------------------------------------------------------
let statusEl = null;
function buildUI() {
  const box = document.createElement("div");
  box.style.cssText =
    "position:fixed;right:16px;bottom:16px;z-index:2147483647;display:flex;flex-direction:column;gap:6px;align-items:flex-end;font:13px/1.3 ui-sans-serif,system-ui,sans-serif";
  const btn = document.createElement("button");
  btn.textContent = "🛡 Cloak input";
  btn.style.cssText =
    "cursor:pointer;border:none;border-radius:999px;padding:9px 14px;font-weight:600;color:#0b0d14;background:#dce3ee;box-shadow:0 8px 24px -8px rgba(0,0,0,.5)";
  btn.addEventListener("click", cloakInput);
  statusEl = document.createElement("div");
  statusEl.style.cssText =
    "max-width:240px;padding:4px 10px;border-radius:8px;background:rgba(10,12,18,.85);color:#c8d2e0;backdrop-filter:blur(6px)";
  box.append(statusEl, btn);
  document.body.appendChild(box);
  renderStatus();
}

function setStatus(t) {
  if (statusEl) statusEl.textContent = t;
}
function renderStatus() {
  setStatus(ENABLED ? "Cloakroom on — type, then Cloak" : "Cloakroom off");
}

// Hotkey: Ctrl/Cmd + Shift + M to mask the current input.
window.addEventListener("keydown", (e) => {
  if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === "M" || e.key === "m")) {
    e.preventDefault();
    cloakInput();
  }
});

if (document.body) buildUI();
