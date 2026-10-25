# Frontend verification, 25 October 2026

## Current teacher-aligned candidate — not yet deployed

The new candidate replaces the four-step companion app with one static project-evidence page at `/api-docs/`. Demo happens in the normal application: authenticate as chef, create a recipe with ingredients, validate, save and view the automatically opened detail. Old walkthrough URLs redirect to the evidence page. No manual ID entry, duplicate app flow or four-stage guide remains in this candidate. Root evidence includes coverage-report.md, clo-requirements-checklist.md, erd.png and observed postman_collection.json. Deployment and browser QA of this candidate must be recorded separately from the passing aggregate tests below; the preceding release checks below do not establish acceptance of this new design.

## Previous verified release: 3ebf76e (historical implementation)

Verified deployed runtime: `3ebf76ed9a5b5f15f76c6e9a99e6695b1f26fa4a`. Remote main and Railway SUCCESS were confirmed by the release check. That earlier refinement was deployed and live-retested. `docs/deployment-3ebf76e.json` records tree `943f089f7a63c7d4f033c4b1e2456855bf85e8eb`, nine exact source/asset matches and eight public HTTP 200 probes, with health OK and storage reported as mysql. This storage label does not establish the exact database server version.

- Self-hosted IBM Plex Sans Thai, shorter copy and open sections replace the rejected font and competing boxes.
- Product pages retain real search/filter/sort/pagination, recipe detail, permissions, atomic ingredient creation, ratings and external-source labels.
- In this previous release, presentation was four stages: select a recipe → read its ingredients → create through the authenticated app → read back the recipe and reviews. Technical detail is optional disclosure.
- The guide itself sends GET requests only. Changing the verification ID clears the previous result; pending requests block duplicate actions and browser Back is handled without issuing a new request.
- Numbered/newline cooking instructions remain structured; the server remains the authorization authority.

## Automated evidence

Current teacher-candidate run: **184 tests, 13 suites passed**, plus ten VM UI scenarios. Durable evidence: `test-run-summary.json`, `test-results.txt`, `ui-test-results.txt`. The historical 212/14 run included the removed four-stage companion guide. Tests are not rendered-browser write E2E.

Newly measured backend coverage: statements 93.34%, branches 85.79%, functions 98.47%, lines 94.21%; see `backend-coverage-summary.json` and root `coverage-report.md`. Prior isolated MariaDB11.8.6 integration14groups is separate, not re-executed by this Jest run. The root Postman collection now preserves its15observed examples plus a read-only isolated GETsystem supplement:16examples covering12OpenAPI operations. No production writes. Configured Railway source image mysql:8 plus live health/public reads supports deployed integration but does not establish exactpatchversion or full production SQLconstraints/write E2E.

Prior failure-scenario evidence: S1–S8 passed, but live TheMealDB S0 degraded to fallback, so the overall report is not all-green. Keep the initial report separate from the final scenario report.

## Historical live browser checks — previous release only

The release reviewer inspected the actual cloud Chromium rendering, not only test results:

- Home, recipe detail, guest create form and login.
- All four presentation stages; selected recipe 1 and read its real ingredients.
- Stage 4 real GET recipe/review readback; changing the ID clears stale output.
- Empty-search recovery resets the list.
- Browser Back from stage 4 returned to stage 3. Tab from its heading focused the create link with a visible solid outline; this is a focused keyboard check, not a full keyboard audit.
- Swagger GET Execute returned HTTP 200; expanded content did not widen the page at 320 and 390 CSS pixels.
- Main page and guide were measured at 320, 390, 768, 1280 and 1440 CSS pixels using ordinary desktop window resizing and browser zoom.

These are desktop responsive checks, not mobile hardware or touch tests. Do not infer complete keyboard, reduced-motion or animation-performance coverage from the viewport checks. Final screenshot selection uses only `*-viewport.png` from `krua-evidence/redesign-fcac037`; the directory name is a capture-batch label, not proof of a single release. Cropped full-page captures taken at non-100% zoom are excluded. Earlier `final-*` screenshots and `browser-viewport-measurements.json` identify the earlier e89f2c5 release and must not be relabeled as current.

## Remaining limits and candidate acceptance gates

- Previous-release affected-view retest passed: old login screenshot link count is zero; Swagger computed font and rendered screenshot show IBM Plex Sans Thai. Expanded GET at 320 CSS pixels measured scrollWidth 311, without overflow; the preceding Execute check returned HTTP 200.
- Authenticated browser write E2E was **not executed**: the isolated local preview was refused by the browser network. API/database mutation tests are separate evidence. No production data was changed to fill this gap.
- Exact MySQL 8, touch hardware, full accessibility and load/penetration testing remain unverified.
- Final source/screenshot packaging remains a separate handover step; do not declare the whole project complete from test counts alone.
