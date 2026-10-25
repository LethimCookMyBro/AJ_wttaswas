# ครัวแบ่งปัน: Kitchen editorial system

Updated 25 October 2026. Food discovery comes first; developer documentation is a separate, clearly named path. Preserve Express/MySQL, local Thai fonts, real API records, and the existing hash routes. No new frontend framework, fabricated reviews, or fake user statistics.

## Design tokens

- Paper `#f8f5ef`, surface `#fffdf9`, ink `#252b25`, muted `#62675d`.
- Forest hero/action `#243b32`, terracotta accent `#aa3d20`, warm hero button `#f2a273`.
- Rules `#dddcd2`, soft cooking panel `#e7eddf`.
- Local Noto Sans Thai 400/600/700, `font-display: swap`. Body 16px; metadata 12–14px; headings scale by viewport. Food imagery has reserved aspect ratios.
- Mostly 4/8px spacing increments; crisp 5px controls and 8px image corners. Food remains the visual anchor, not decorative dashboard cards.

## Page hierarchy

- Home: editorial hero, API-backed featured recipe, three explicit paths, category/search/difficulty/sort, paged real recipe cards, meal-idea next step.
- Detail: actual recipe metadata, ingredients with native checkboxes, explicitly numbered/newline cooking steps, ratings. Plain instructions stay one step rather than inventing missing content.
- Create: recipe basics → ingredient rows → method. One POST writes the recipe and optional ingredients atomically. Failed saves preserve entered data. Successful saves open the returned ID only if the user has not navigated away.
- Owner tools: only the recipe's chef or an admin sees ingredient assignment and typed-name deletion confirmation; server enforces the same authorization independently.
- Ideas: ingredient examples, loading/empty/error states, real upstream result names with source/degraded labels. Fallbacks never masquerade as upstream results.
- Login: server-authenticated identity, role explanations, token in memory only. Guest/member restrictions are explained at the point of action.
- Documentation: overview → GET-only walkthrough → existing Swagger reference. Writes happen through authenticated app forms or Swagger, not a hidden guide script.

## Interaction and accessibility

Native links, forms, labels, buttons and checkboxes remain the primary interaction model. Hash navigation preserves browser back; status messages use live regions. Request counters prevent stale reads. Save/owner mutations reject duplicate submissions. Numbered steps and ingredient checks support cooking rather than ornamental motion.

Inline SVG replaces unsupported arrow glyphs. Hover movement is brief and restrained; reduced-motion removes animations/transitions. Responsive rules collapse recipe, detail, owner and ingredient layouts, and wrap controls at narrow widths. All user/API content is inserted with `textContent`, not HTML interpolation.

## Image truthfulness

The four existing food WebP files are AI-created illustrations, not evidence that a user cooked a recipe. Existing seed recipes have known illustration mapping. Other recipes receive a generic image and visible illustration label. No generated image is presented as a user upload.

## Reference adaptation

The live reference review covered Apple iPhone comparison (aligned recipe facts), Stripe Payments (clear primary/secondary paths), Stripe Checkout docs (task-led progression), Linear start guide (reading width and next step), and Vercel deployments docs (separate stages). Adapt patterns, not brand styling. Avoid megamenus, dense desktop sidebars, oversized blank marketing sections, and decorative scroll effects.

## Verification status

Nine frontend behavior scenarios pass, including auth/role/expiry, rating refresh failure, atomic ingredient payload, duplicate/precision validation, double-submit suppression and late-write navigation. Twenty guide tests cover sequence/races and network/schema failures. These are automated behavior tests, not rendered UI evidence.

After-change browser screenshots and viewport inspection are pending: headless Chromium could not launch in this execution environment; cloud browser could not reach the local server. Existing screenshots are explicitly before-change evidence. Do not describe the new design as visually verified until the deployment/preview is inspected.
