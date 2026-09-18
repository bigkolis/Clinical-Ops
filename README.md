# Clinical Ops Workspace

A Vercel-ready clinical operations workspace that turns recurring Excel/Word workflows into a modern browser UI.

## What it does

- Parses `UNBLINDED_CL04041383_(PMR_OLE)_SelectControls.xlsx` and `Visits completion by subject.xlsx` locally in the browser.
- Builds patient timelines, Week 22/40 regimen-change views and visit-window checks.
- Gives Staff full operational access: imports, working corrections, deviation notes, labels, reports and exports.
- Gives Milana the same tools plus an AI/operator workspace, diagnostics and audit visibility.
- Generates 20×40 and 80×60 label previews/print layouts.
- Keeps source XLSX files browser-local. Optional Postgres stores only notes, overrides and audit events.

## Deploy to Vercel

1. Import `bigkolis/Clinical-Ops` into Vercel.
2. Vercel detects Vite automatically.
3. Add the environment variables from `.env.example`.
4. Deploy.
5. Check `/api/health`.

Required variables: `SESSION_SECRET`, `MILANA_LOGIN`, `MILANA_PASSWORD`, `STAFF_LOGIN`, `STAFF_PASSWORD`. `DATABASE_URL` is optional.

See `docs/DEPLOYMENT.md` and `docs/AI_OPERATOR_MANUAL.md`.
