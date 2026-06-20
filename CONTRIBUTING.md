# Contributing

Contributions, bug reports and documentation improvements are welcome.

## Before opening an issue

- Check existing issues.
- Test against the latest repository version.
- Review Apps Script Executions for the exact error.
- Remove credentials, customer data and private URLs.

## Bug reports

Include:

- expected behaviour
- actual behaviour
- reproduction steps
- browser and operating system
- Apps Script function name and line number
- relevant redacted logs

## Pull requests

- Keep changes focused.
- Explain why the change is needed.
- Test both a standard booking and any affected payment workflow.
- Keep configuration generic and do not add business-specific data.
- Do not include generated booking records or credentials.
- Update documentation and `CHANGELOG.md` when behaviour changes.

## Coding style

Use readable Apps Script and browser JavaScript, descriptive function names, explicit error handling and comments for non-obvious logic. Preserve exact event-type values where code comparisons depend on them.
