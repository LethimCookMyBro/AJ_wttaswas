# Frontend verification, 25 October 2026

## Current revision and implementation

Verified deployed runtime: `3ebf76ed9a5b5f15f76c6e9a99e6695b1f26fa4a`. Remote main and Railway SUCCESS were confirmed by the release check. Final refinement is now deployed and live-retested. `docs/deployment-3ebf76e.json` records tree `943f089f7a63c7d4f033c4b1e2456855bf85e8eb`, nine exact source/asset matches and eight public HTTP 200 probes, with health OK and storage reported as mysql. This storage label does not establish the exact database server version.

- Self-hosted IBM Plex Sans Thai, shorter copy and open sections replace the rejected font and competing boxes.
- Product pages retain real search/filter/sort/pagination, recipe detail, permissions, atomic ingredient creation, ratings and external-source labels.
- Presentation is four stages: select a recipe → read its ingredients → create through the authenticated app → read back the recipe and reviews. Technical detail is optional disclosure.
- The guide itself sends GET requests only. Changing the verification ID clears the previous result; pending requests block duplicate actions and browser Back is handled without issuing a new request.
- Numbered/newline cooking instructions remain structured; the server remains the authorization authority.

## Automated evidence

Latest aggregate log `/tmp/krua-final212.log`: **212 tests, 14 suites passed** after the stale-image removal and Swagger-font fix. Ten additional VM UI behavior scenarios passed in the preceding UI run. These are test doubles, not rendered-browser end-to-end tests.

Backend coverage remains statements 93.32%, branches 85.79%, functions 98.46%, lines 94.19%; see `backend-coverage-summary.json`. This is the unchanged backend coverage baseline, not a newly measured browser metric. Prior disposable MariaDB 11.8.6 verification passed 14 checkpoint groups and recorded 15 HTTP examples with a controlled localhost upstream. The backend is unchanged since that run; exact MySQL 8 was not tested.

Prior failure-scenario evidence: S1–S8 passed, but live TheMealDB S0 degraded to fallback, so the overall report is not all-green. Keep the initial report separate from the final scenario report.

## Live browser checks completed

The release reviewer inspected the actual cloud Chromium rendering, not only test results:

- Home, recipe detail, guest create form and login.
- All four presentation stages; selected recipe 1 and read its real ingredients.
- Stage 4 real GET recipe/review readback; changing the ID clears stale output.
- Empty-search recovery resets the list.
- Browser Back from stage 4 returned to stage 3. Tab from its heading focused the create link with a visible solid outline; this is a focused keyboard check, not a full keyboard audit.
- Swagger GET Execute returned HTTP 200; expanded content did not widen the page at 320 and 390 CSS pixels.
- Main page and guide were measured at 320, 390, 768, 1280 and 1440 CSS pixels using ordinary desktop window resizing and browser zoom.

These are desktop responsive checks, not mobile hardware or touch tests. Do not infer complete keyboard, reduced-motion or animation-performance coverage from the viewport checks. Final screenshot selection uses only `*-viewport.png` from `krua-evidence/redesign-fcac037`; the directory name is a capture-batch label, not proof of a single release. Cropped full-page captures taken at non-100% zoom are excluded. Earlier `final-*` screenshots and `browser-viewport-measurements.json` identify the earlier e89f2c5 release and must not be relabeled as current.

## Remaining limits and acceptance gates

- Final affected-view retest passed: old login screenshot link count is zero; Swagger computed font and rendered screenshot show IBM Plex Sans Thai. Expanded GET at 320 CSS pixels measured scrollWidth 311, without overflow; the preceding Execute check returned HTTP 200.
- Authenticated browser write E2E was **not executed**: the isolated local preview was refused by the browser network. API/database mutation tests are separate evidence. No production data was changed to fill this gap.
- Exact MySQL 8, touch hardware, full accessibility and load/penetration testing remain unverified.
- Final source/screenshot packaging remains a separate handover step; do not declare the whole project complete from test counts alone.
