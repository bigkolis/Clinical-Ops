# ChatGPT / Semyon integration plan

Milana has a privileged operator layer in the web app. The current UI prepares a structured task packet from the live workspace state; the next integration step is a ChatGPT App / MCP connector.

## Intended permissions

### Staff
- Import source exports locally in the browser.
- Review patients and visits.
- Add deviation notes and working overrides.
- Generate labels and reports.
- Export operational views.

### Milana
Everything Staff can do, plus:
- Semyon / AI operator console.
- Diagnostics and audit visibility.
- Administrative templates and rules as they are added.
- Future ChatGPT connector authorization.

## Connector design
The connector should expose application-level tools rather than SQL, for example:
- `get_site_summary`
- `get_patient_timeline`
- `list_actions`
- `save_deviation_note`
- `save_working_override`
- `prepare_labels`
- `prepare_report`
- `get_operator_manual`

Imported XLSX source files should remain browser-local unless an explicitly approved source integration is introduced later.
