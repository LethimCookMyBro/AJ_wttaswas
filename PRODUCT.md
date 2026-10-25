# ครัวแบ่งปัน

<!-- impeccable:product-schema 1 -->

## Platform

Thai recipe web application with a public deployed service and a separate classroom demonstration workflow.

## Stack

Existing Express 4, MySQL, and plain HTML/CSS/JavaScript. Preserve the shared API contract and schema; no framework migration for visual novelty.

## Users and jobs

- Visitors discover recipes and follow ingredients/instructions without an account.
- Members rate and review recipes.
- Chefs create recipes with ingredients and manage their own recipes.
- Admins manage recipes across authors.
- The student presenter explains the same real product to the instructor in 3–5 minutes; documentation serves beginner, guided-demo and technical-reference audiences separately.

## Product purpose

Help someone answer “มื้อนี้ทำอะไรดี?”, choose a recipe, cook it, and share a recipe or review through the actual API. The homepage is a food product, not a coursework report. The API guide explains the product without forcing ordinary users to read technical detail.

## Operating context and evidence

Public deployment uses MySQL. Test mutations use only isolated fixtures. The 25 October 2026 verification includes 196 tests, 10 VM frontend scenarios and 14 real disposable MariaDB11.8.6 checkpoints; exact MySQL8 compatibility is not newly established by that run. A separate in-memory demo discards edits on restart. Recorded HTTP examples and limitations are in docs/.

## Capabilities and constraints

Six primary use cases: browse, detail, create, assign ingredients, rate/review, delete. Optional recipe ingredients save atomically. JWT identity, roles and ownership are server-enforced. Search, category/difficulty filters, sorting and pagination operate through the API. TheMealDB is supplementary and bounded by timeout/retries with explicitly labeled fallback.

Week13 requires a microservices design, not a deployed distributed rewrite. Runtime remains a modular monolith; proposed service boundaries are clearly labeled design only.

## Visual and content truthfulness

Existing food images are AI-created illustrations, not photographs submitted by users. Real recipe names, quantities and ratings come from the API. Generic illustrations are labeled. Screenshots must identify the actual version captured; old screenshots are not final-release evidence.

## Accessibility and inclusion

Thai labels, clear role guidance, native form controls, meaningful focus, announced request states, reduced motion, and responsive layouts. Automated source/VM checks do not substitute for actual browser/keyboard/mobile inspection. See DESIGN.md for tokens and the release checklist for verified versus pending checks.
