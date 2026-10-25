# Release readiness, 25 October 2026

## Verified baseline and recovery

Remote main is `df157f0b8e0a0d5f3e0f832645f7faf6d955b430`. Live app.js, styles.css and api-guide.css match that commit byte-for-byte after CRLF→LF normalization. Current changes do not modify schema, production environment variables, data migrations, credentials or resource configuration.

The tracked candidate patch was applied and reversed in a disposable clean baseline export; all 71 original tracked files were byte-identical after reversal. This verifies source reversibility, not an actual platform rollback execution. After publishing, recovery is a normal `git revert` of the release commit followed by the existing deploy flow, never a force push or production database reset. Recipe/ingredient data created using the new additive payload remains compatible with the old schema/API reads. New source files are removed by the revert automatically; no production data is deleted by source rollback.

## Automated evidence

- 185 tests across 12 suites pass; 9 additional VM UI behavior scenarios pass.
- 20 guide tests cover request sequencing, errors, all static links/assets and anchor consistency.
- Real disposable MariaDB11.8.6:14 checkpoint groups pass, including actual constraints, migrations, atomic create rollback and concurrent failure isolation. Exact MySQL8 is not tested this round.
- 15 Postman request/response examples recorded against real MariaDB with a controlled localhost external upstream. Tokens redacted.
- Failure scenarios S1–S8 pass. The final live TheMealDB baseline S0 degraded, so the overall report is not all-green; earlier live success is historical evidence only.
- Node syntax checks and git whitespace checks pass. Local app responds200 when launched and requested within the same execution network context.

## Release gates / remaining work

- Predeployment browser rendering blocked by execution restrictions and preview connectivity. Do not label source/VM checks as visual QA.
- Confirm deployment decision with owner of this task; main push currently held.
- After deployment, verify health, actual DB storage, API/detail/Swagger, exact asset hashes and deployed commit where platform evidence exists.
- Immediately inspect live desktop/mobile and keyboard behavior; record screenshots with exact viewport limitations. No mutation QA against production.
- If severe runtime regression occurs, revert only the release commit, verify restored baseline hashes/health and report recovery accurately.
