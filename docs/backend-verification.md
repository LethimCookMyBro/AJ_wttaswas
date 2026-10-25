# Backend verification, 25 October 2026

## Scope and environment

Express/MySQL recipe API, working tree based on commit `df157f0`. Tests ran on the assistant server, Node v24.22.1 and npm 11.9.0. No production database was connected or mutated. No schema changes were made.

## Implemented changes

- Recipe detail SQL and OpenAPI now expose `author_id`; the test double now respects selected recipe fields instead of accidentally returning extra fields. Owner controls no longer depend on a mock-only field.
- `POST /api/v1/recipes` accepts an optional `ingredients` array with at most 50 unique ingredient IDs. Each line uses the existing `ingredientId`, `quantity`, and `unit` contract. Empty/omitted arrays preserve the existing one-insert flow. Nonempty arrays use one dedicated connection and transaction; any failing insert rolls everything back. Response shape remains compatible. Unknown referenced entities return `404 REFERENCE_NOT_FOUND`.
- Generic OpenAPI error-code examples no longer label unrelated failures as recipe-not-found; rate-limit and oversized-body responses have explicit matching examples.
- Shared quantity validation retains 0.01–999999.99, at most two decimal places; duplicate/invalid lines fail before opening a transaction.
- A failed rollback destroys its connection rather than returning an uncertain transaction to the pool. Acquired connections are released on ordinary success/failure.
- The test double supports serialized transactions and restores state on rollback without erasing unrelated concurrent writes; it also enforces recipe FK existence and supports the health probe. This is not proof of MySQL isolation behavior.
- External-service configuration rejects disabled/unbounded timeouts and excessive/fractional retry counts. Every attempt now has an absolute AbortSignal deadline in addition to Axios inactivity timeout, preventing continuously trickled bytes from keeping a request open. Upstream response size is bounded to 1 MiB.

## Executed verification

- Baseline `npm test` against a separate clean HEAD export: **140 tests, 11 suites passed**.
- Latest complete `npm run coverage` observed during concurrent frontend work: **185 tests, 12 suites passed**. New backend-focused suites: **52 tests passed**.
- Backend `git diff --check` and Node syntax checks passed.
- Regression proof: new create tests against original HEAD produced **18 failures / 3 passes**, demonstrating the missing functionality. Failed-rollback test failed before connection disposal fix. Trickled-response test failed before absolute deadline fix (received successful upstream response instead of timeout); passed after fix.
- Role/ownership, token validity/identity mismatch, review uniqueness and score validation, duplicate ingredient constraints, JSON/body limits and public error redaction remain covered by the existing suite plus new tests.
- Recorded Postman replay: **15 requests and 15 observed response examples**, all expected statuses matched. File: `postman-observed-mock.json`. It explicitly uses an in-memory DB and controlled localhost upstream. JWTs are redacted and no fixture password is embedded. Re-run with `node docs/record-observed-postman.js`.

## Coverage snapshot

| Metric | Coverage |
| --- | ---: |
| Statements | 93.32% |
| Branches | 85.79% |
| Functions | 98.46% |
| Lines | 94.19% |

Lowest three files by line coverage:

| File | Lines | Statements | Branches | Main remaining gaps |
| --- | ---: | ---: | ---: | --- |
| `src/index.js` | 91.53% | 91.39% | 89.04% | Several defensive DB-error/race branches and direct process startup/logging |
| `src/services/external-api.js` | 94.00% | 94.82% | 96.49% | Defensive exhausted-loop and unexpected internal-error fallbacks |
| `src/db.js` | 99.17% | 95.23% | 69.76% | Mock lifecycle/alternate constraint branches; real connection path not exercised by mock suite |

`src/password.js` has 100% across these four measures. Machine-readable snapshot: `backend-coverage-summary.json`. High coverage does not establish production DB integration correctness.

## Observed failure scenarios and limitations

Initial full runner report is preserved in `failure-scenario-observed-initial.md`, before the absolute-deadline fix. Live TheMealDB baseline succeeded; controlled closed-port, HTTP500, retry recovery, delayed response, HTTP404, invalid response and degraded endpoint cases passed. **S1 did not meet its assertion**: unresolved hostname produced `TIMEOUT` after 3 attempts in 8518ms, while the runner expected `NETWORK_ERROR` within 4000ms. This is not recorded as a pass. A proxy/DNS network can produce timeout rather than immediate DNS failure. The initial report remains historical evidence, not a final all-green claim.

The initial live request also exceeded its 3000ms configured inactivity timeout, which prompted the absolute-deadline regression and fix described above. Final integrated failure-scenario rerun should retain an honest result and distinguish controlled localhost tests from live networking.

## Real relational database verification (follow-through)

**Real MariaDB 11.8.6 integration passed; exact MySQL 8 was not tested.** No database was preinstalled, so official packages were downloaded through the existing signed Debian snapshot source and extracted under `/tmp`, without installing system packages/services or changing security settings. Required packages: `mariadb-server-core`, `mariadb-client-core`, `mariadb-server`, `mariadb-common`, `liburing2`, `libaio1t64`.

A disposable datadir was initialized and the server ran as the existing unprivileged user, bound only to `127.0.0.1` on an ephemeral port. Optional UNIX sockets were unavailable in this execution environment, so that transport was disabled; no permission/security setting was changed. The test harness refuses any pre-existing business database and does not accept a production address.

Final fresh run: **14 checkpoint groups passed**, including schema/seed, migration up/up/down/up with all six business tables preserved, chef/member/admin login, anonymous/member/forged-author rejection, decimal ingredient round-trip, owner ID projection, actual rollback after two ingredient inserts then an invalid FK, concurrent successful and failed transactions, foreign-owner rejection, review uniqueness, database CHECK and FK enforcement, cascade cleanup, existing real-DB smoke script and health probe. All original business-table rows matched exactly after fixture cleanup. Auto-increment counters may advance, as expected. The server was terminated and no DB listener remains.

Evidence: `mariadb-integration-results.json` (`completed: true`), `mariadb-existing-smoke.log`, and the repeatable harness `verify-isolated-mariadb.js`. The harness expects a fresh initialized datadir at `/tmp/krua-isolated-db` and official binaries extracted under `/tmp/krua-mariadb-root`; it deliberately refuses reusing a database containing business tables.

**15 actual Postman request/response examples were also recorded against the real MariaDB instance**, with token/password redaction and before/after fixture preservation checks: `postman-observed-mariadb.json`. Its meal-discovery upstream is a controlled localhost HTTP fixture, not live TheMealDB. Prefer this collection for relational-database integration evidence; retain `postman-observed-mock.json` as the separate lightweight test-fixture run.

Two preliminary attempts are retained transparently: `mariadb-bootstrap-failure.json` records the unavailable optional UNIX socket; `mariadb-initial-constraint-probe.json` records a harness assertion expecting a MySQL error name when MariaDB correctly rejected the CHECK using errno 4025. The assertion was corrected to the actual MariaDB error contract before the final fresh passing runs. Neither was an application data-integrity failure. These failed preliminary records do not replace the final completed report.

Remaining limitation: MariaDB is MySQL-protocol compatible, but these results are not exact MySQL 8 server evidence. Validate the deployed engine separately before treating version-specific behavior as proven. No production data was accessed.
