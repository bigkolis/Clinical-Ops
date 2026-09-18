# ONREZA production database

Clinical Ops is prepared for ONREZA Managed PostgreSQL. This avoids an extra Supabase/Neon account and keeps the application and shared database on the same platform.

## One account-side action

1. In the existing ONREZA workspace, open **PostgreSQL**.
2. Choose **Create database** and name it `clinical-ops`.
3. Attach/integrate that database with the Clinical Ops project and enable automatic `DATABASE_URL` injection if offered.
4. Redeploy the project.

No SQL migration command is required: the application creates/updates its own tables on first authenticated database-backed request.

## What moves into the database

- published processed source snapshots used across laptop/mobile;
- visit notes and working overrides;
- structured deviation data;
- change history / undo state;
- operational audit events;
- security login/logout audit.

The original uploaded Word/Excel file bytes are still parsed in the browser and are not automatically uploaded as raw files.

## Sessions

When `DATABASE_URL` is present, the app derives its HttpOnly cookie-session signing key server-side from the private database URL unless an explicit `SESSION_SECRET` is supplied. The browser never needs to store the password after sign-in.

For extra separation, production may later set an independent random `SESSION_SECRET`, but it is not required for the first ONREZA production deployment.

## Hobby suitability

The application uses a small connection pool (`max: 3`) and short idle timeout so the managed PostgreSQL service can auto-suspend between bursts of work. For a small Clinical Ops team this is intentionally lightweight.
