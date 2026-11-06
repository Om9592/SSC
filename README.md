# SSC CGL Command Center

A React application for SSC CGL study planning and tracking, powered by AI.

## Features

- User authentication (Sign up / Login)
- Personal study session tracking
- AI-powered planning, mock tests, vocabulary practice, and performance analysis
- PDF and image study-material extraction for mock-test generation (files up to 3 MB)
- Firebase integration for secure data persistence
- Responsive design with Tailwind CSS

AI requests run through an authenticated server endpoint. The Gemini key and Firebase Admin service-account key are server-only secrets and must never use the `VITE_` prefix.

## Setup

1. Clone the repository
2. Use Node.js 24.12 or newer, then install dependencies: `npm install`
3. Configure the environment variables below
4. Run development server: `npm run dev`
5. Build for production: `npm run build`

## Environment Variables

Copy `.env.example` to `.env` in the project root, then fill in your Firebase web app settings and `GEMINI_API_KEY`. Create a Gemini API key in [Google AI Studio](https://aistudio.google.com/apikey); the Gemini API offers a free tier with model-specific quotas. Keep the key server-side and never add a `VITE_` prefix to it.

The local `.env` should contain:

```
VITE_FIREBASE_API_KEY=your_firebase_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_auth_domain
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_APP_ID=your_app_id
VITE_FIREBASE_STORAGE_BUCKET=your_storage_bucket
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_MEASUREMENT_ID=your_measurement_id
FIREBASE_PROJECT_ID=your_project_id
GEMINI_API_KEY=your_gemini_api_key
GEMINI_MODEL=gemini-flash-latest
```

`FIREBASE_SERVICE_ACCOUNT_JSON` is only required for Netlify deployment; do not add a placeholder value locally.

## Deployment

### Netlify (deploy from GitHub)

1. In Firebase Console, enable **Authentication > Email/Password** and create a Firestore database.
2. Deploy the included owner-only Firestore rules:

   ```sh
   npx firebase-tools deploy --only firestore:rules --project YOUR_FIREBASE_PROJECT_ID
   ```

3. In Firebase project settings, create a private key for a service account with Firestore access. Keep the downloaded JSON private.
4. In Netlify, select **Add new project > Import an existing project > GitHub**, authorize GitHub, and select `Om9592/SSC` (or your fork). The included `netlify.toml` configures `npm run build`, `dist`, and the `netlify/functions` directory.
5. In **Site configuration > Environment variables**, add the following server variables. Make sure server secrets are available to **Functions**; on plans with variable scopes, select the Functions scope:
   - `FIREBASE_PROJECT_ID`
   - `FIREBASE_SERVICE_ACCOUNT_JSON` (the complete service-account JSON)
   - `GEMINI_API_KEY`
   - `GEMINI_MODEL` (optional; defaults to `gemini-flash-latest`)
6. Add the Firebase web app settings from the environment variable list above, including the `VITE_` names, with the **Builds** scope. These identify the web app; never put Gemini or service-account secrets under `VITE_`.
7. Set `AWS_LAMBDA_JS_RUNTIME=nodejs24.x` in Netlify's environment variables so Functions use the same compatible Node runtime as the build.
8. In Firebase Authentication's **Authorized domains**, add your Netlify domain (for example, `your-site.netlify.app`). Trigger a fresh deploy after setting the variables.

The Netlify function serves the same authenticated `/api/ai` route used locally. It verifies Firebase ID tokens, caches identical requests per user, limits usage to 8 uncached requests per user and 18 total per UTC day, and validates uploads. If the selected model times out or returns a server error, the endpoint retries once with `gemini-flash-lite-latest`. The Gemini free tier has its own provider quota, so requests can still pause when that quota is exhausted. Usage limits protect the shared quota; they do not increase or bypass Google's limits.

### Credential rotation

If a Gemini key was previously configured as `VITE_GEMINI_API_KEY` or used in the browser, treat it as public. Revoke it in Google AI Studio, create a replacement, set the replacement as Netlify's server-only `GEMINI_API_KEY`, and remove the old `VITE_GEMINI_API_KEY` from local and hosting environment settings.

The Vite dev server exposes the same `/api/ai` endpoint locally and verifies Firebase sign-in. Set `GEMINI_API_KEY` and `FIREBASE_PROJECT_ID` in `.env` in addition to the `VITE_FIREBASE_*` client settings. Local development uses in-memory AI cache/limits; Netlify uses Firestore-backed limits and requires the Admin service-account secret.