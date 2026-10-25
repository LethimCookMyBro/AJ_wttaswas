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
- Documentation: separate presentation-first guided flow with optional API reference. Product pages do not ask ordinary visitors to understand backend terminology.

## Interaction and accessibility

Native links, forms, labels, buttons and checkboxes remain the primary interaction model. Hash navigation preserves browser back; status messages use live regions. Request counters prevent stale reads. Save/owner mutations reject duplicate submissions. Numbered steps and ingredient checks support cooking rather than ornamental motion.

Inline SVG replaces unsupported arrow glyphs. Hover movement is brief and restrained; reduced-motion removes animations/transitions. Responsive rules collapse recipe, detail, owner and ingredient layouts, and wrap controls at narrow widths. All user/API content is inserted with `textContent`, not HTML interpolation.

## Image truthfulness

The four existing food WebP files are AI-created illustrations, not evidence that a user cooked a recipe. Existing seed recipes have known illustration mapping. Other recipes receive a generic image and visible illustration label. No generated image is presented as a user upload.

## Reference adaptation

The live reference review covered Apple iPhone comparison (aligned recipe facts), Stripe Payments (clear primary/secondary paths), Stripe Checkout docs (task-led progression), Linear start guide (reading width and next step), and Vercel deployments docs (separate stages). Adapt patterns, not brand styling. Avoid megamenus, dense desktop sidebars, oversized blank marketing sections, and decorative scroll effects.

## Verification status

Ten frontend behavior scenarios pass, including auth/role/expiry, rating refresh failure, atomic ingredient payload, duplicate/precision validation, double-submit suppression and late-write navigation. Thirty-one guide tests cover sequence/races and network/schema failures. These are automated behavior tests, not rendered UI evidence.

Release9aaac60 is deployed and its exact assets/health/API were verified. Actual desktop home/detail/create/login screenshots were inspected. Ordinary browser window resizing and zoom exposed a500px navigation/grid issue and an empty-filter recovery gap; both are fixed in the follow-up and require live retesting.390CSS-pixel layout had no observed horizontal overflow; this is desktop responsive testing, not a touch-device claim. The complete viewport/keyboard matrix is still being finalized.
