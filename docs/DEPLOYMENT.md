# Deployment checklist

## GitHub → Vercel

1. Import `bigkolis/Clinical-Ops` into Vercel.
2. Framework: Vite (auto-detected).
3. Deploy immediately. No authentication environment variables are required for the first production deployment.
4. Verify `/api/health` returns `ok: true` and `authentication: portable-stateless`.

## GitHub → another Vercel-compatible platform

Import the same repository and deploy with its normal Vite/serverless defaults. Authentication is stateless and does not depend on Vercel cookies, KV, Edge Config or Vercel-only secrets.

Expected frontend build:
- install: `npm install`
- build: `npm run build`
- output: `dist`

Expected API routes:
- `/api/auth`
- `/api/workspace`
- `/api/health`

## Generic Node/container fallback

If a platform does not implement Vercel-style `/api` functions, use the included `Dockerfile`. It builds the Vite frontend and runs `server.mjs` on `PORT` (default 3000), serving both the static app and the same API handlers.

## Optional environment variables

The app already has built-in Milana and Staff accounts whose passwords are verified against strong `scrypt` hashes. Passwords are not stored in this public repository.

You may override the built-in accounts later with:
- `MILANA_LOGIN`, `MILANA_PASSWORD`, `MILANA_DISPLAY_NAME`
- `STAFF_LOGIN`, `STAFF_PASSWORD`, `STAFF_DISPLAY_NAME`

Optional shared persistence:
- `DATABASE_URL` — enables shared notes/overrides/audit. Tables are created automatically on first authenticated workspace request.

Source Excel workbooks are parsed in the browser and are not uploaded to the hosting platform by the application.
