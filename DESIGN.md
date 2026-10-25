# ครัวแบ่งปัน: Kitchen editorial system

Updated 25 October 2026. Food discovery comes first; developer documentation is a separate, clearly named path. Preserve Express/MySQL, local Thai fonts, real API records, and the existing hash routes. No new frontend framework, fabricated reviews, or fake user statistics.

## Design tokens

- White page `#ffffff`, light botanical hero `#f4f6f0`, ink `#24332d`, muted `#606a64`.
- Forest primary hero action `#244c3b`, terracotta product action `#a43d22`; quiet rules `#e1e5e0`.
- Self-hosted IBM Plex Sans Thai 400/500/600, `font-display: swap`; 17px desktop body and 16px narrow body. Headings use 600, recipe titles 500. This replaces the rejected Noto Sans Thai appearance for product surfaces.
- Controls use 6px corners, food images 8px corners. Forms, reviews and ingredient sections are open layouts divided with spacing and thin rules, not nested cards.

## Page hierarchy

- Home: compact food-led hero → recipe search/filter/list. Removed the three competing discovery paths and repeated marketing copy. A separate “นำเสนอ” navigation entry leads to the guided presentation, not to ordinary product tasks.
- Detail: image and actual title/metadata → ingredient checklist and ordered cooking steps → ratings. Decorative invitation and repeated section labels are removed.
- Create: one continuous form, numbered “1. ข้อมูลสูตร”, “2. วัตถุดิบ”, “3. วิธีทำ”, then save. Preserve atomic save, entered values on failure and navigation-race protections.
- Owner tools: only the recipe's chef or an admin sees ingredient assignment and typed-name deletion confirmation; server enforces the same authorization independently.
- Ideas: ingredient selection → real upstream names and source/degraded labels. Fallbacks never masquerade as upstream results.
- Login: a direct “เข้าสู่ระบบ” heading and account form. Keep concise role and 15-minute/refresh session guidance.
- Documentation: a single static teacher-evidence reference page, with links to API, DB/design and test/CLO artifacts. The normal product app is the live demo; no four-step companion app or manual-ID readback. Swagger remains separate. Product pages do not ask ordinary visitors to understand backend terminology.

## Interaction and accessibility

Native links, forms, labels, buttons and checkboxes remain the primary interaction model. Hash navigation preserves browser back; status messages use live regions. Request counters prevent stale reads. Save/owner mutations reject duplicate submissions. Numbered steps and ingredient checks support cooking rather than ornamental motion.

Inline SVG replaces unsupported arrow glyphs. Hover movement is brief and restrained; reduced-motion removes animations/transitions. Responsive rules collapse recipe, detail, owner and ingredient layouts, and wrap controls at narrow widths. All user/API content is inserted with `textContent`, not HTML interpolation.

## Image truthfulness

The four existing food WebP files are AI-created illustrations, not evidence that a user cooked a recipe. Existing seed recipes have known illustration mapping. Other recipes receive a generic image and visible illustration label. No generated image is presented as a user upload.

## Reference adaptation

The live reference review covered Apple iPhone comparison (aligned recipe facts), Stripe Payments (clear primary/secondary paths), Stripe Checkout docs (task-led progression), Linear start guide (reading width and next step), and Vercel deployments docs (separate stages). Adapt patterns, not brand styling. Avoid megamenus, dense desktop sidebars, oversized blank marketing sections, and decorative scroll effects.

## Verification status

The teacher-aligned runtime fed4b12/tree1e4ff465 is verified by historical Railway SUCCESS/public and desktop Chromium observations in docs/deployment-fed4b12.json. Separate isolated Firefox/MariaDB write E2E now passes13checkpoints. The four-stage guide checks below remain previous-release history; later evidence-only edits are not automatically deployed.

Runtime release `3ebf76ed9a5b5f15f76c6e9a99e6695b1f26fa4a` is confirmed on remote main with Railway SUCCESS. That historical revision passed 212 tests in 14 suites. The new teacher-aligned candidate passes 184 tests in 13 suites and ten VM UI scenarios; measured coverage is statements93.34%, branches85.79%, functions98.47%, lines94.21% (docs/test-run-summary.json). These checks are not rendered browser write tests.

Actual cloud browser review covered home/detail/guest-create/login and all four guide stages, live ingredient/review reads, stale readback clearing, empty-search reset and Swagger GET Execute 200. Main/guide were measured at 320, 390, 768, 1280 and 1440 CSS pixels using desktop resizing and zoom; expanded Swagger did not widen 320/390 layouts. This is not touch-device testing or a complete animation/accessibility audit.

Final live refinement retest passed: zero old login screenshot links; Swagger uses IBM Plex Sans Thai in computed style and the actual screenshot, and expanded GET at width 320 measures scrollWidth 311 without overflow. Deployment evidence in docs/deployment-3ebf76e.json records nine exact asset matches, eight HTTP 200 public probes, health OK and mysql storage. Final screenshots select only *-viewport.png from krua-evidence/redesign-fcac037; cropped non-100%-zoom full-page captures are excluded. Final source/screenshot packaging is separate. Authenticated browser write E2E was not run because the isolated local preview was refused by the browser network; production was never mutated. Prior MariaDB integration covers the unchanged backend separately, not exact MySQL 8. See docs/frontend-verification.md for scope and limits.

## Isolated browser E2E — 25 October 2026

ผ่าน authenticated browser write E2E แบบแยกข้อมูล 13 checkpoints ด้วย default Playwright Firefox 153.0 + MariaDB 11.8.6 + local Express; ดู docs/browser-e2e/SUMMARY.md และ report.json. ไม่ใช่ production Chromium/MySQL 8 หรือการซ้อมของผู้พรีจริง ไม่มี production writes

หลักฐานตรวจ wrong-password401, guest/member guards, chef create2ingredients+decimal readback, member review201/average refresh, duplicate409, typed-name deletion, GET404 และ recipes/recipe_ingredients/ratings กลับตรงข้อมูลก่อนทดสอบ, reload logout และ frontend uncaught errors0. เก็บ source/harness/screenshot SHA256 และ cleanup ใน report.json. ข้อความ “ยังไม่ได้รัน” ในบันทึก release เดิมข้างต้นเป็นประวัติก่อนรอบนี้ ไม่ใช่สถานะปัจจุบัน.
