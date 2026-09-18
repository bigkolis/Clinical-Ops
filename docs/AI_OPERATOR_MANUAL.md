# AI Operator Manual — Clinical Ops Workspace

## Purpose
Clinical Ops is a protocol-aware operational workspace for Milana and Staff. Imported source exports remain the source-of-truth. Human corrections are explicit working overrides with audit/history where shared persistence is enabled.

## Studies currently encoded
### CL04041383 — Olokizumab OLE
- Patient visits, visit windows, regimen changes, deviations, reports and action queues.
- Visit map: V1/W0/D0, V2/W2/D14, V3/W6/D42, V4/W10/D70, V5/W16/D112, V6/W22/D154, V7/W28/D196, V8/W34/D238, V9/W40/D280, V10/W46/D322, V11/W54/D378.
- Week 22 / Visit 6 and Week 40 / Visit 9 are regimen-change checkpoints.
- Effective regimen uses the secondary regimen value when present, otherwise the primary value.
- Actual visit date is checked against Scheduled min/max. Outside the range is Early/Late.
- Upcoming and overdue actions are derived from visit windows when Actual visit date is missing.
- Deviation number, reason, owner and status are human-maintained fields. Never invent them.

### CL04041109 — Medication Labels
- Label Studio is kept as a separate protocol workflow.
- Supported source imports: DOCX, XLSX, XLS.
- Standard layouts: 20×40 mm / one ID and 80×60 mm / ten IDs.
- Custom dimensions, IDs per label, copies, ranges and TSC/TSPL printer output are supported.

## Import Center
- Source spreadsheets are parsed locally in the browser first.
- Files are staged and analyzed before being applied.
- The Import Center shows recognized source type, row count, site count, subject count, columns and warnings.
- Unknown files must not silently replace source data.

## Shared snapshots
- Publishing a shared snapshot is an explicit action.
- A snapshot stores processed rows and source metadata in the configured database; original workbook bytes are not uploaded by this mechanism.
- The latest published snapshot can hydrate another browser/device, enabling phone + desktop continuity.
- If DATABASE_URL is not configured, the app remains local-only and snapshot/operator features stay disabled.

## Working changes, deviations and history
- Imported values are never silently rewritten.
- Manual date/regimen corrections are working overrides.
- Deviation fields: number, reason, status, owner, note.
- Database-backed saves write previous annotation state to version history.
- Undo restores the latest previous annotation version.
- The shared Staff login can optionally provide initials at sign-in; those initials are attached to audit actors.

## Reports
- Reports can import DOCX/XLSX/XLS and export Word, Excel, PDF or Print.
- Normalized Word creates a clean Clinical Ops report.
- Preserve-original Word keeps the imported DOCX package and attempts to replace recognized Site / IMV / Dates / Monitor values in-place; it appends a Clinical Ops working-update page for traceability.
- Preserve-original is not Track Changes and should not be represented as such.

## Semyon operator safety
The app exposes scoped application operations rather than general SQL or shell access.

Read operations:
- study/site summary
- patient timeline
- current action queue
- shared snapshot state
- diagnostics

Write operations:
- Milana-only audited note/deviation/working-override updates through the operator API

Never:
- invent deviation numbers/reasons
- silently alter source export values
- expose unrestricted database or shell access
- claim a live generative ChatGPT model is connected when only the scoped operator API is available
