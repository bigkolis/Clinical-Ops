# Clinical Ops Workspace

A production-ready clinical operations workspace that replaces recurring Excel/Word workflows with a modern browser UI.

## What it does

- Parses `UNBLINDED_CL04041383_(PMR_OLE)_SelectControls.xlsx` and `Visits completion by subject.xlsx` locally in the browser.
- Builds patient timelines, Week 22/40 regimen-change views and visit-window checks.
- Gives Staff full operational access: imports, working corrections, deviation notes, labels, reports and exports.
- Gives Milana the same tools plus an AI/operator workspace, diagnostics and audit visibility.
- Generates 20×40 and 80×60 label previews/print layouts.
- Keeps source XLSX files browser-local. Optional Postgres stores only notes, overrides and audit events.

## Authentication

The repository is ready to deploy with no environment variables. Built-in Milana and Staff accounts are verified against strong `scrypt` password hashes; the passwords themselves are not stored in the public repository.

Environment variables can optionally replace the built-in credentials later without changing code. See `.env.example`.

## Deploy

### Vercel

1. Import `bigkolis/Clinical-Ops`.
2. Vercel detects the Vite frontend and `/api` serverless functions.
3. Deploy. No auth environment variables are required for the initial deployment.
4. Check `/api/health`.

### Other Vercel-compatible platforms

Import the same GitHub repository and use the same build settings. The project does not rely on Vercel-only authentication state.

### Generic Node / container hosting

A `Dockerfile` and `server.mjs` are included as a fallback for platforms that run a normal container instead of Vercel-style serverless functions.

`DATABASE_URL` remains optional. Without it, working notes/overrides stay local to each browser; with it, they are shared and audited.

See `docs/DEPLOYMENT.md` and `docs/AI_OPERATOR_MANUAL.md`.
