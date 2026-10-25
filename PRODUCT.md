# Recipe management

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Existing Express 4 backend. Plain HTML/CSS/JavaScript frontend, per the Phase 3 assignment.

## Users

Course presenter demonstrates the recipe system to the instructor. Inferred secondary audience from requirement.md is people browsing and sharing recipes.

## Product purpose

Read a recipe, create a recipe, and submit a review through the project's actual HTTP API.

## Operating context

Local classroom demonstration lasting 3 to 4 minutes. Final verification uses synthetic fixtures in isolated MySQL on loopback33317. A separate in-memory fallback demo resets on restart. This is not a production service.

## Capabilities and constraints

Categories, recipes, ingredients, ratings and TheMealDB integration remain. One process serves the browser and API. Login uses JWT and server-side roles/ownership. Search, filters, sorting and pagination operate through the API. MySQL migration and restart persistence were verified separately from mocked Jest coverage.

## Evidence on hand

schema.sql, seed.sql, migrations, requirement.md, openapi.yaml and112passingtests. Images are AI-generated illustrations with disclosure, not supplied photographs of real dishes.

## Accessibility and inclusion

Thai labels, native form controls, keyboard focus, announced request status and a single-column mobile layout.
