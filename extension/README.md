# Cloakroom browser extension

Mask PII/PHI/PFI **before** it reaches ChatGPT or Claude, and unmask the reply
locally. The model only ever sees tokens; you see the real values.

## Install (Chrome / Edge, unpacked)

1. Go to `chrome://extensions`, turn on **Developer mode**.
2. **Load unpacked** → select this `extension/` folder.
3. (Optional) Click the Cloakroom toolbar icon to set the API base or session id.
   Default API: `https://cloakroom-mu.vercel.app/api`.

## Use

1. Open **chatgpt.com** or **claude.ai**.
2. Type your message normally (with real names, accounts, etc.).
3. Click **🛡 Cloak input** (bottom-right) or press **Ctrl/Cmd + Shift + M**.
   The composer text is replaced with tokens like `[PFI_ACCOUNT_1]`.
4. Send it. The reply comes back referring to tokens — the extension swaps them
   back to your real values right in the page.

## How it works

- The masked text + a `token → value` map come from Cloakroom's `/mask` endpoint.
- **Unmasking happens locally** in your browser using that map, so the mapping
  never persists on the server.
- The raw text does go to the Cloakroom server once (to detect + tokenize), so
  point the API base at a server you trust (self-host for production).

## Limits

- The free hosted backend uses the **regex** detector, so it catches IDs,
  accounts, amounts, PAN/Aadhaar/IFSC, etc. — **names need NER** (run a backend
  with the `presidio` or `comprehend` detector for those).
- Selectors target the current ChatGPT/Claude composer; if their UI changes, the
  composer detection in `content.js` may need a tweak.
