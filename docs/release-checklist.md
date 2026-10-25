# Release readiness, 25 October 2026

## Current teacher-aligned candidate — not yet deployed

The new candidate replaces the four-step companion app with one static project-evidence page at `/api-docs/`. Demo happens in the normal application: authenticate as chef, create a recipe with ingredients, validate, save and view the automatically opened detail. Old walkthrough URLs redirect to the evidence page. No manual ID entry, duplicate app flow or four-stage guide remains in this candidate. Root evidence includes coverage-report.md, clo-requirements-checklist.md, erd.png and observed postman_collection.json. Deployment and browser QA of this candidate must be recorded separately from the passing aggregate tests below; the preceding release checks below do not establish acceptance of this new design.

## Previous verified release and recovery

Runtime release `3ebf76ed9a5b5f15f76c6e9a99e6695b1f26fa4a` is verified on remote main with Railway SUCCESS. That earlier refinement was deployed and live-retested. `docs/deployment-3ebf76e.json` records tree `943f089f7a63c7d4f033c4b1e2456855bf85e8eb`, nine exact source/asset matches and eight public HTTP 200 probes, with health OK and storage reported as mysql. This storage label does not establish the exact database server version. No schema, production credentials, environment variables or infrastructure settings were changed in this UI revision.

Historical recovery evidence: the initial candidate patch was applied and reversed in a disposable clean baseline export; all 71 original tracked files were byte-identical after reversal. This proves source reversibility for that candidate, not an actual platform rollback drill. Recovery for a bad release is a normal targeted git revert followed by the authorized deployment flow, never force push or a production database reset. Verify restored health and assets after any actual recovery. No production data should be deleted by a source rollback.

## Automated evidence

- Current candidate: **184 tests / 13 suites passed** with `npm run coverage`; durable docs/test-results.txt and docs/test-run-summary.json. Historical212/14 included the removed companion guide.
- Ten VM UI behavior scenarios passed separately. Neither suite is proof of browser write E2E.
- New measured backend coverage: statements93.34%, branches85.79%, functions98.47%, lines94.21%. Prior MariaDB integration remains separate.
- Prior unchanged-backend integration: disposable MariaDB 11.8.6 passed 14 checkpoint groups, including real constraints, migrations, atomic rollback and concurrent failure isolation. Exact MySQL 8 was not tested.
- Fifteen Postman request/response examples were recorded against that MariaDB instance with controlled localhost external upstream; secrets were redacted.
- Failure scenarios S1–S8 passed. Live TheMealDB baseline S0 degraded; do not report all scenarios green.

## Historical browser evidence — previous release only

Actual cloud browser review covered home/detail/login/guest-create and the four-step guide. Real recipe/ingredient/review GETs and Swagger Execute returned expected data; changing readback ID clears old output; empty-search reset works. Main/guide were checked at 320, 390, 768, 1280 and 1440 CSS pixels. Expanded Swagger did not widen the page at 320 or 390. Measurements used desktop window resizing and zoom, not mobile hardware or touch input. Browser Back from stage 4 to 3 worked; Tab from the stage-3 heading visibly outlined the create link. This is not a full keyboard audit.

## Remaining release gates

1. Deploy and test the teacher-aligned candidate before claiming it live. Historical final refinement verified: zero old login screenshot links; Swagger computed/rendered font is IBM Plex Sans Thai; expanded GET at width 320 has scrollWidth 311 and no overflow. Deployment/asset checks are recorded above.
2. Finish source packaging and select only `*-viewport.png` from `krua-evidence/redesign-fcac037`. Exclude cropped full-page captures taken at non-100% zoom. Earlier e89f2c5 evidence is historical and may be omitted from the final package.
3. Authenticated browser write E2E remains blocked by isolated-preview network refusal. Do not substitute production writes or claim the API/database tests cover rendered browser behavior.
4. The actual PPTX is prepared and verified as nine slides, five main plus four hidden supporting slides, with notes. Final screenshot/source packaging is separate from PPTX readiness.
5. Preserve exact MySQL 8, touch-device, full accessibility/performance and load/penetration-test limitations in the handover.

No production mutation was performed during browser QA. This checklist is evidence and remaining work, not a universal completion claim.
