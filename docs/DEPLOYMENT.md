# Deployment checklist

## GitHub → Vercel

1. Import `bigkolis/Clinical-Ops` into Vercel.
2. Framework: Vite (auto-detected).
3. Add the variables from `.env.example`.
4. Deploy.
5. Verify `/api/health` returns `ok: true`.

## Environment variables

Required:
- `SESSION_SECRET` — long random value, 32+ characters recommended.
- `MILANA_LOGIN`, `MILANA_PASSWORD`, `MILANA_DISPLAY_NAME`.
- `STAFF_LOGIN`, `STAFF_PASSWORD`, `STAFF_DISPLAY_NAME`.

Optional:
- `DATABASE_URL` — enables shared notes/overrides/audit. Tables are created automatically on first authenticated workspace request.

Source Excel workbooks are parsed in the browser and are not uploaded to Vercel by the application.
