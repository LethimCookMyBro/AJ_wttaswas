# Design reference review — 25 October 2026

## Evidence and limits

Read-only review in the assistant's cloud Chromium browser, 05:28–05:30 UTC. Inspected rendered screenshots and accessibility structure, including selected secondary pages/actions, at the existing narrow desktop window size. This is not a mobile-device, performance, complete accessibility, or motion-FPS audit. No accounts, forms, purchases, or subscriptions were used. No brand assets or code were copied.

Five distinct brands were visited; Stripe documentation was also inspected separately. This records current observations rather than relying only on the earlier summary in DESIGN.md.

## What to adapt

| Reference and visited surface | Observed structure/interaction | Apply to Krua | Do not copy |
|---|---|---|---|
| [Apple](https://www.apple.com/) and linked [product detail](https://www.apple.com/iphone-duo/) | Large product image, short headline, primary and secondary actions. Detail separates overview, highlights, design, cameras and technical specifications; local navigation exposes named sections. | Let food imagery lead; keep title and one clear discovery action. Separate recipe overview, ingredients, method and optional technical explanation. | Huge full-screen marketing sections and long feature galleries would slow recipe lookup; do not copy Apple's branding or imagery. |
| [NVIDIA AI on RTX](https://www.nvidia.com/en-us/ai-on-rtx/) | Contrasting hero with one main action; named benefits navigation; accessibility structure separates benefits, use cases and supporting examples. Hero carousel visibly changed content between observations. | Explain the system purpose first, then show the use case and evidence. Use an explicit demo sequence instead of multiple equal-priority boxes. | Rotating hero content and promotional performance figures are inappropriate for a timed classroom demo. Benefits-area pixels remained obscured by a cookie overlay, so only its accessibility structure was confirmed. |
| [Stripe](https://stripe.com/) | Primary action is visually stronger than secondary. Selecting the payments feature expanded a detailed panel with its own close control, supporting images and deeper links; the updated accessibility tree confirmed the expanded content. | Disclose request/response and implementation details only when requested; keep the beginner route concise. | Dense bento feature menus, decorative gradients and extensive customer-logo walls would add noise to this small product. |
| [Stripe Checkout docs](https://docs.stripe.com/payments/checkout) and [quickstart](https://docs.stripe.com/checkout/quickstart) | Task-led title, short explanation and a clear start-building link. Quickstart provides frontend/backend choices and numbered server setup steps. On the narrow window it explicitly recommends a text guide and its split code panel visibly overflows horizontally. | Use a short heading, one next action, numbered steps and honest warnings about real requests. Keep advanced API reference separate. | Do not copy the wide split-pane code layout onto small screens. Krua's request/response should stack or scroll inside its own container, not widen the whole page. |
| [Linear](https://linear.app/) and linked [Intake](https://linear.app/intake) | Concise purpose statement followed by product examples and named workflow sections. Intake visibly presents a short feature heading, section divider and subordinate explanation. Some homepage content was still visually entering during the first screenshot. | Use workflow verbs and consistent heading levels; replace repetitive boxed explanations with sections and whitespace. | Do not delay useful content behind long entrance motion or reproduce a complex application screenshot as decoration. |
| [Vercel](https://vercel.com/) | Sparse hero with one primary and one secondary action. Accessibility structure groups two distinct outcomes, each with supporting feature names and imagery. | Give each page one job and keep technical details subordinate to the user's task. | Avoid oversized branding and rotating marketing text in the presentation path. Below-fold structure was read from the accessibility tree; the attempted scroll did not yield a new below-fold screenshot. |

## Decisions for this revision

1. Product pages help people find and cook recipes. Presentation pages help Win explain one end-to-end flow. Neither should lead with implementation jargon.
2. Use readable Thai typography, a restrained hierarchy, whitespace and dividers before adding more cards.
3. Guide the demo in one direction: purpose → browse → authenticate/create → verify → optional API reference. Keep technical evidence reachable without placing all of it in the first viewport.
4. Motion must support state changes, not delay reading or navigation. Preserve reduced-motion behavior and visible keyboard focus.
5. Keep real API responses and data-source labels. Do not borrow performance numbers, testimonials or branding from references.

## Separate work still required

This review does not establish that GSAP Skills, transitions.dev or make-interfaces-feel-better were studied or installed. Impeccable skill guidance was available, but its launcher availability and execution are separate from this reference review. Final redesigned Krua pages need their own screenshots, behavior checks and deployment verification; these reference visits do not substitute for that QA.
