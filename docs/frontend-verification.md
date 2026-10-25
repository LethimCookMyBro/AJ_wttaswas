# Frontend verification, 25 October 2026

## Implemented

- Real server-side category/search/sort/pagination retained; difficulty filter added.
- Featured recipe derives from returned records rather than hard-coded seed identity.
- Ingredients selected from GET catalog and submitted atomically with recipe creation; up to 50 rows, duplicate detection, two-decimal quantities.
- Owner/admin management uses returned `author_id`; server remains the authorization authority.
- Explicit numbered/newline instructions render as separate cooking steps; ingredients become checkable without changing persisted data.
- SVG arrows replace font-dependent direction glyphs. Shared responsive editorial styling and reduced-motion treatment cover all app routes.
- Three documentation levels remain; interactive tutorial performs GET only, with visible dependencies and failures.

## Executed

`npm run test:ui`: 10 behavior scenarios passed. Uses a VM DOM test double, not a browser.

`npm run coverage`: 196 tests, 12 suites passed. Backend lines94.19%, statements93.32%, branches85.79%, functions98.46%. Includes31 documentation tests. See backend report for lowest-covered files and limitations.

`npm run failure-scenarios`: S1–S8 pass. Live S0 did not establish normal upstream availability in this final run; it returned controlled fallback, so the overall report truthfully says SOME FAILED. Initial run (before absolute deadline fix) preserved separately; its S0 succeeded but S1 failed an overstrict fast-DNS assumption. Final S1 accepts network failure or timeout within the bounded retry budget, because DNS/proxy failures are environment-dependent.

## Pending before final acceptance

- Actual browser screenshots at1440,1280,768,390,320 and keyboard/focus/overflow review.
- Exact MySQL8 compatibility remains unverified. Real disposable MariaDB11.8.6 passed14 checkpoint groups, including transaction rollback/concurrency and recorded15HTTP examples; see mariadb-integration-results.json.
- Deployed commit identity, read-only health/API/Swagger smoke and rollback readiness.

No production writes, secrets, or user accounts were used by these tests. Browser launch/network restrictions are not recorded as successful visual QA. Current guide screenshots are labeled static walkthrough illustrations, not evidence of the new layout.

## Post-deployment review

First release9aaac60: Railway success status and five exact deployed asset hashes verified; all nine public smoke routes returned200, system reports MySQL. Actual desktop screenshots inspected. Narrow500px header/grid and zero-result recovery issues found by live review were fixed for the follow-up. Guide snapshots now show the actual cream/forest release and have correct JPEG MIME. Walkthrough now verifies a supplied recipe ID against actual ingredients/reviews without performing writes. Final refined-release browser retest remains pending.
