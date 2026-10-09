# Calora AI scanner patch

## What this patch fixes
- Switches the scanner to `/api/analyze` instead of a browser-side API call.
- Clears the previous result before every new photo and does not show the result panel on API failure.
- Uses a server-side Cloudflare Pages Function and does not include a Gemini key in the HTML.
- Requests structured JSON and validates the returned items.

## Apply the patch
1. Replace the scanner section in `index.html` with `scanner-function.js.txt` (instructions follow below).
2. Replace the old hard-coded API key declaration with the contents of `api-constant.js.txt`.
3. Add `functions/api/analyze.js` from this patch to the repository.
4. In Cloudflare Pages, open Settings -> Variables and Secrets, add `GEMINI_API_KEY` as a secret, then redeploy.
5. Delete/revoke the old API key exposed in the current public `index.html`, and create a replacement key before adding it as the Cloudflare secret.

## Exact code replacement areas
- In `index.html`, replace:
  `// Aapki exact Gemini API Key` through the `const AI_TOKEN = ...;` line with `api-constant.js.txt`.
- Replace the whole block starting at `// Real AI Vision Scanner Logic` and ending just before `function renderEditableScannedItems()` with `scanner-function.js.txt`.
- The Cloudflare Pages Functions file path must be exactly `functions/api/analyze.js`.

## Model selection
The function uses `gemini-3.8-flash`, a model name shown in Google's current Generate Content documentation as of this patch. Model access can differ by account/project; if Google returns a model error, use the Models List endpoint for the key to select one supporting `generateContent` and images.
