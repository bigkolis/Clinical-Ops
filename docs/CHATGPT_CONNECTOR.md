# ChatGPT / Semyon integration — Clinical Ops v2

Milana has a privileged operator layer in the web app. Clinical Ops now includes a scoped backend API for shared operational context. This is deliberately narrower than direct database or filesystem access.

## Current roles
### Staff
- Import and review source exports.
- Review patients, visits, windows and regimen changes.
- Maintain structured deviations and working overrides.
- Generate labels and reports.
- Export operational views.
- Optionally enter initials at login so the shared Staff account still produces useful audit attribution.

### Milana
Everything Staff can do, plus:
- Semyon operator console.
- Diagnostics and audit visibility.
- Scoped operator writes.
- Administrative/operator workflows.

## Shared-data prerequisite
The scoped operator API reads the latest explicitly published CL04041383 workspace snapshot. `DATABASE_URL` must be configured for shared cross-device state and operator endpoints. Without it, browser-local workflows still work but shared operator calls are unavailable.

## Implemented operator API
All endpoints require the same authenticated Clinical Ops session credentials.

### Read — GET `/api/operator`
- `?action=summary` — all discovered site summaries from the latest shared snapshot.
- `?action=patient&site=<site>&patient=<patient>` — patient timeline plus current annotations.
- `?action=actions&site=<site>` — window exceptions, due/upcoming items and regimen changes.

### Write — POST `/api/operator`
Milana-only. Accepts a scoped patient/visit payload and can update:
- working note
- deviation reason / number / status / owner
- working visit-date override
- working regimen override

Every database-backed operator write records annotation history and an audit event.

## Intended ChatGPT tool mapping
A ChatGPT App / MCP layer should expose application-level tools backed by the endpoints above, for example:
- `get_workspace_summary()`
- `get_patient(site, patient_id)`
- `get_actions(site)`
- `set_deviation(site, patient_id, visit, fields)`
- `set_working_override(site, patient_id, visit, fields)`
- `get_operator_manual()`

Do not expose unrestricted SQL or shell execution.

## Important distinction
The web app currently has the scoped Semyon/operator backend and a UI that can run shared checks / prepare task packets. It does **not** embed an OpenAI API key or pretend that a generative ChatGPT model is already connected. A live model connection requires a proper server-side provider credential or ChatGPT App/MCP authorization and must keep secrets out of the public repository and browser bundle.
