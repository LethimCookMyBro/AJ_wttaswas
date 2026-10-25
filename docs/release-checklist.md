# Release readiness, 25 October 2026

## Verified release and recovery

Runtime release `3ebf76ed9a5b5f15f76c6e9a99e6695b1f26fa4a` is verified on remote main with Railway SUCCESS. Final refinement is now deployed and live-retested. `docs/deployment-3ebf76e.json` records tree `943f089f7a63c7d4f033c4b1e2456855bf85e8eb`, nine exact source/asset matches and eight public HTTP 200 probes, with health OK and storage reported as mysql. This storage label does not establish the exact database server version. No schema, production credentials, environment variables or infrastructure settings were changed in this UI revision.

Historical recovery evidence: the initial candidate patch was applied and reversed in a disposable clean baseline export; all 71 original tracked files were byte-identical after reversal. This proves source reversibility for that candidate, not an actual platform rollback drill. Recovery for a bad release is a normal targeted git revert followed by the authorized deployment flow, never force push or a production database reset. Verify restored health and assets after any actual recovery. No production data should be deleted by a source rollback.

## Automated evidence

- Latest local aggregate: **212 tests across 14 suites passed**, from `/tmp/krua-final212.log` after stale-image removal and Swagger-font fix.
- Ten VM UI behavior scenarios passed separately. Neither suite is proof of browser write E2E.
- Backend coverage baseline: statements 93.32%, branches 85.79%, functions 98.46%, lines 94.19%.
- Prior unchanged-backend integration: disposable MariaDB 11.8.6 passed 14 checkpoint groups, including real constraints, migrations, atomic rollback and concurrent failure isolation. Exact MySQL 8 was not tested.
- Fifteen Postman request/response examples were recorded against that MariaDB instance with controlled localhost external upstream; secrets were redacted.
- Failure scenarios S1–S8 passed. Live TheMealDB baseline S0 degraded; do not report all scenarios green.

## Browser evidence

Actual cloud browser review covered home/detail/login/guest-create and the four-step guide. Real recipe/ingredient/review GETs and Swagger Execute returned expected data; changing readback ID clears old output; empty-search reset works. Main/guide were checked at 320, 390, 768, 1280 and 1440 CSS pixels. Expanded Swagger did not widen the page at 320 or 390. Measurements used desktop window resizing and zoom, not mobile hardware or touch input. Browser Back from stage 4 to 3 worked; Tab from the stage-3 heading visibly outlined the create link. This is not a full keyboard audit.

## Remaining release gates

1. Final refinement verified: zero old login screenshot links; Swagger computed/rendered font is IBM Plex Sans Thai; expanded GET at width 320 has scrollWidth 311 and no overflow. Deployment/asset checks are recorded above.
2. Finish source packaging and select only `*-viewport.png` from `krua-evidence/redesign-fcac037`. Exclude cropped full-page captures taken at non-100% zoom. Earlier e89f2c5 evidence is historical and may be omitted from the final package.
3. Authenticated browser write E2E remains blocked by isolated-preview network refusal. Do not substitute production writes or claim the API/database tests cover rendered browser behavior.
4. The actual PPTX is prepared and verified as nine slides, five main plus four hidden supporting slides, with notes. Final screenshot/source packaging is separate from PPTX readiness.
5. Preserve exact MySQL 8, touch-device, full accessibility/performance and load/penetration-test limitations in the handover.

No production mutation was performed during browser QA. This checklist is evidence and remaining work, not a universal completion claim.
