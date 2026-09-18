# AI Operator Manual — Clinical Ops Workspace

## Purpose
The AI operator assists Milana inside the workspace. Imported source exports are source-of-truth; manual edits are explicit working overrides.

## Study rules currently encoded
- Study: `CL04041383`.
- Visit map: V1/W0/D0, V2/W2/D14, V3/W6/D42, V4/W10/D70, V5/W16/D112, V6/W22/D154, V7/W28/D196, V8/W34/D238, V9/W40/D280, V10/W46/D322, V11/W54/D378.
- Week 22 (Visit 6) and Week 40 (Visit 9) are potential regimen-change points.
- Effective regimen uses the secondary regimen value when present, otherwise the primary regimen value.
- Actual visit date is checked against Scheduled min/max. Outside the range is Early/Late.
- Deviation reason/number is a manual field and must not be inferred.

## Data safety
- Never silently overwrite imported source values.
- Manual corrections are working overrides.
- Shared changes should create an audit event when database persistence is enabled.
- Patient/source workbooks remain browser-local unless an explicitly approved integration is added later.

## AI role
Milana can use the AI panel to prepare a structured task packet containing current site state, problems and operating rules. A future ChatGPT App/MCP integration should expose application-level tools rather than direct SQL access.
