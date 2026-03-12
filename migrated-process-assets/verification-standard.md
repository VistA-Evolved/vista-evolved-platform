# Verification Standard

> **What counts as proof and what evidence is required.** COPIED FROM ARCHIVE. Normalize into docs/reference/ when adding verification gates.

## Proof definition

**Proof** means: exact files changed, exact commands run, exact outputs observed, exact pass/fail per step. Not proof: "should work," "looks correct," "verification deferred."

## Evidence

- Terminal: commands, stdout/stderr or path to log, exit code, pass/fail.
- RPC/API: request, response body or key fields, pass/fail.
- Browser: URL, steps, screenshot or test log, pass/fail.

All verification outputs go under `artifacts/` (gitignored). Never commit to docs or reports.
