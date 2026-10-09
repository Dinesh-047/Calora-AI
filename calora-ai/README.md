# Calora AI — Snap. Track. Transform.

A responsive, mobile-first calorie and nutrition tracker starter project designed for GitHub + Cloudflare Pages.

## What works in the starter
- Responsive dashboard, food diary, progress view, goals/profile view
- Guest mode using browser local storage
- Manual meal entry with calories, protein, carbs, fat, date and meal type
- Daily calorie goal progress and weekly history chart
- Weight logging and target weight display
- Export local data as JSON
- Firebase email/password auth and per-user Firestore sync (after setup)
- AI food-photo estimate endpoint as a Cloudflare Pages Function (after Workers AI binding setup)
- PWA manifest and basic offline shell caching

## Deploy to Cloudflare Pages using GitHub

1. Create a GitHub repository named `calora-ai`.
2. Upload the contents of this folder to the repository root. The `index.html` file must be in the root, not inside another nested folder.
3. In Cloudflare, create/connect a Pages project to that repository.
4. Build settings: **Framework preset: None**, **Build command: leave blank**, **Build output directory: `/`** (or `.` if the dashboard does not accept `/`).
5. Deploy. Guest mode and manual calorie tracking should work immediately.

## Configure Firebase login + cloud sync

1. Open the Firebase Console and create a separate project for Calora AI.
2. Add a Web App and copy its config.
3. In Authentication > Sign-in method, enable **Email/Password**.
4. Create a Cloud Firestore database.
5. Open `firebase-config.js.example`, copy it to a new file named `firebase-config.js`, and replace the sample config values.
6. In `index.html`, add this line **before** `<script defer src="/app.js"></script>`:
   `<script defer src="/firebase-config.js"></script>`
7. Deploy the `firestore.rules` rules in Firebase Console > Firestore Database > Rules.
8. In Firebase Authentication > Settings > Authorized domains, add your deployed `*.pages.dev` domain and your custom domain if you use one.
9. Commit and push the changes. Firebase web config is not a service-account secret; never publish private service-account credentials. Secure access with the rules above.

The project intentionally does not include your real Firebase configuration because it has not been supplied in this build.

## Configure the AI photo scanner

The frontend calls `POST /api/analyze`. The implementation lives at `functions/api/analyze.js`.

1. In Cloudflare Dashboard, open your Pages project > Settings > Functions (or Bindings).
2. Add a **Workers AI binding** named exactly `AI`, pointing to your Cloudflare account's AI binding.
3. Redeploy the project.
4. Test on the live site: choose a food photo > **Estimate with AI**.

The sample function uses the Workers AI model identifier `@cf/meta/llama-3.2-11b-vision-instruct`. Model availability, input schema, and free allowances can change by account/region. If Cloudflare reports the model is unavailable, change the identifier and request shape to a currently enabled vision model in your account. AI requests may incur usage charges beyond available free allowances. Do not expose provider tokens in browser JavaScript.

## Important limitations
- A photo cannot reveal exact ingredients, oil quantity, or true weight. Estimates must be reviewed and corrected before saving.
- Guest data is stored only in the current browser/device. Clearing browser storage may remove it.
- Signing in enables cloud sync after Firebase is configured. This starter merges records by ID; for a production product, consider a more formal sync-conflict strategy.
- PWA offline support caches the app shell, not AI requests. AI photo analysis requires internet.
- This is a starter project, not a medical device or a substitute for professional nutrition advice.

## Suggested first test
1. Deploy before configuring anything else.
2. Add a meal manually and refresh the page.
3. Change the date in Food diary and confirm history.
4. Configure Firebase and test signup/login on your deployed domain.
5. Configure the AI binding and test photo analysis.
