# CLO Requirements Checklist — ครัวแบ่งปัน 67160003

รายการนี้เชื่อมข้อกำหนดกับหลักฐาน ไม่รับรองคะแนน/การยอมรับจากผู้สอน และไม่ใช้คำว่า “มีโค้ด” แทน “ทดสอบจริงผ่าน”. ตำแหน่ง function/route เป็นตัวอ้างอิงหลัก เพราะเลขบรรทัดเปลี่ยนได้เมื่อแก้ UI.

## CLO6 — Frontend เรียก API ของตนเองจริง

| ข้อกำหนด | หลักฐานตรวจได้ | สถานะ/ข้อจำกัด |
|---|---|---|
| อย่างน้อย 3 endpoints รวม GET และ mutation | `frontend/app.js`: `loadRecipes` → GET `/api/v1/recipes`; `loadDetail` → GET `/api/v1/recipes/:id`; `recipe-form` submit → POST `/api/v1/recipes`; เพิ่มเติม GET categories/ingredients, POST auth/login/ratings | implementation + API/tests + live reads; isolated Firefox/MariaDB browser E2E ผ่าน 13 checkpoints ดู `docs/browser-e2e/report.json`; ไม่ใช่ production stack หรือการซ้อมผู้พรี |
| เหมาะกับผู้ใช้ อ่านง่าย loading/error ชัด | `frontend/index.html`, `frontend/styles.css`; `app.js` status/errorMessage, aria-busy, disabled controls, try/catch/finally | browser read-only/guest responsive checks มีหลักฐานใน docs/frontend-verification.md; ไม่ใช่ full accessibility audit |
| ฟอร์มและ frontend validation | `frontend/index.html` required/min/max; `app.js` recipe-form, readIngredientRows, rating-form; `src/index.js` ตรวจที่ server | API/VM regression ครอบคลุมหลายกรณี; server เป็นผู้ตัดสิน ไม่พึ่ง client validation อย่างเดียว |

## CLO8 — Backend/DB/Integration

| ข้อกำหนด | หลักฐาน | สถานะ/ข้อจำกัด |
|---|---|---|
| Requirement ≥5 use cases / resources | `requirement.md` UC-01–UC-06 | 6 use cases; ระบบ recipes ตาม Pno 4 |
| ERD, ≥3 related tables, seed ≥3/table, DB constraints | `erd.png`, `schema.sql`, `seed.sql`; FK/UNIQUE/CHECK/CASCADE | 6 ตารางธุรกิจ; MariaDB integration ผ่าน ไม่ใช่ exact MySQL 8 |
| mysql2 pool + actual query | `src/db.js` createPool, `src/index.js` recipes/healthz | มี SQL และ isolated MariaDB evidence; reviewer ตรวจ Railway live config ว่า source image `mysql:8` ไม่มี staged changes พร้อม live health200/API rows. เป็นหลักฐาน configured deployed MySQL8 integration ไม่ใช่ SELECT VERSION หรือ full constraint/write E2E บน production; mock suite แยกจากฐานจริง |
| Authentication/authorization | `src/password.js`; `src/index.js` authenticate/recipeWriter/ownsRecipe และ POST auth/login | JWT+scrypt+role/ownership; API/DB tests และ isolated browser login/guest/member/owner guards ผ่านตาม `docs/browser-e2e/report.json`; ไม่รับรองทุก authorization branch หรือ production write E2E |
| Migration ถูกต้อง | `tools/migrate.js`, `migrations/`, docs/mariadb-integration-results.json | up/up/down/up รักษาข้อมูลเดิมในฐานแยก; ไม่ใช่ production restore drill |
| OpenAPI ตรงโค้ด ≥6 endpoints | `openapi.yaml`, `test/openapi.test.js`, `src/index.js` routes | 12 method/path operations; Swagger GET Execute live 200; ไม่ตีความ parameters เป็น method |
| Swagger และ Postman ตัวอย่างจริงครบ endpoint | `/api-docs/reference/`, `postman_collection.json`, `docs/postman-operation-coverage.json` | 16 observed examples ครบ 12 operations; JWT redacted; localhost external fixture ไม่ใช่ live upstream; ไม่ครบทุก error permutation |
| External API ≥1 + retry ≥2/delay + timeout + fallback | `src/services/external-api.js`, GET `/api/v1/external/meal-ideas`, `test/external-api.test.js` | TheMealDB, attempts/source/degraded ชัด; fallback ไม่อ้างว่าเป็น live result |
| Failure scenario จริง | `failure-scenario-results.md`, `tools/run-failure-scenarios.js` | controlled S1–S8 ผ่าน; live S0 degraded ต้องอธิบายตามจริง |
| W13 microservices design | `microservices-design.md`: contexts, gateway, communication, resilience | แบบออกแบบ ≥3 services ไม่ใช่ runtime แยกบริการ; runtime เป็น modular monolith |
| Coverage baseline + ช่องว่าง + lowest3 | `coverage-report.md`, `docs/backend-coverage-summary.json` | รายงานขอบเขตและเหตุผล ไม่ใช่เปอร์เซ็นต์รับรองคุณภาพทั้งหมด |
| ระบบรวม/เอกสารสอดคล้อง | `src/`, `frontend/`, `package.json`, `openapi.yaml`, `docs/release-checklist.md` | ตรวจ release ที่ระบุในรายงาน; UI รอบใหม่ต้องตรวจแยก ไม่อนุมาน deployment จาก local tests |

## CLO7 — Project Defense

| ข้อกำหนด | สิ่งเตรียม/หลักฐาน | สิ่งที่ยังต้องทำจริง |
|---|---|---|
| Demo สด 3–4 นาที ≥1 main use case ตั้งแต่ต้นจนจบ | หน้าเว็บจริง + use case เพิ่มสูตรพร้อมวัตถุดิบแล้วเปิดผลที่บันทึก | ต้องซ้อม authenticated browser write ใน environment สาธิตจริง; สไลด์ไม่แทน demo |
| อธิบาย architecture/technical decisions | `microservices-design.md`, `scalability-design.md`, ERD, coverage/failure reports | ต้องอธิบาย monolith ที่รันจริง vs design ที่เสนอ พร้อมเหตุผล/ข้อจำกัด |
| Q&A 2–3 นาที สะท้อนความเข้าใจ | เตรียมเรื่อง DB constraints, transaction, auth, external failure, coverage gaps, 10x scaling | ผู้เรียนต้องตอบเอง; เอกสาร/สไลด์ไม่รับรองความเข้าใจหรือคะแนน |

Phase 3 ระบุ 5–7 นาที (demo3–4 + Q&A2–3); แผน wk15 มี introduction1นาทีเพิ่ม ให้ยึดเวลาที่ผู้สอนประกาศจริง. ซ้อมเครื่องและเครือข่ายเดียวกับวันนำเสนอ ไม่เปิดเผยรหัสผ่าน/JWT บนสไลด์.

## การรักษาหลักฐาน Postman

`postman_collection.json` เป็น observed collection ที่เทียบครบ 12 operations แล้วด้วย `node docs/check-postman-operation-coverage.js`. `npm run postman` เขียน `postman_template.json` โดยไม่มี observed responses; `npm run postman -- --record` เขียน `postman_recorded.json` แยกต่างหาก. ทั้งสองไม่ทับหลักฐานส่งอาจารย์ ต้องตรวจผลและ provenance ก่อนแทนไฟล์นี้ด้วยตนเอง. เก็บ `docs/postman-observed-mariadb.json` เป็น baseline 15 ตัวอย่าง; supplement read-only ที่รันจริงสร้างด้วย `docs/record-system-postman.js` บน isolated datadir ที่ระบุเท่านั้น ไม่ใช่คำสั่งสำหรับ production.

## ชุดส่ง `project-phase3-67160003`

Root มี `src/`, `frontend/`, `openapi.yaml`, `coverage-report.md`, `clo-requirements-checklist.md`, `package.json` ตาม Phase 3 พร้อมหลักฐานต่อเนื่อง `requirement.md`, `erd.png`, SQL, `postman_collection.json`, failure/microservices/migration documents. การสร้าง ZIP/ตรวจ manifest เป็นขั้นตอน packaging แยก; เอกสารนี้ไม่ยืนยันว่าตัว archive ถูกสร้างแล้ว.

แหล่งผู้สอน: [Phase1](https://staff.informatics.buu.ac.th/~wittawas/691/88736065/wk05-project-phase1.md), [Phase2](https://staff.informatics.buu.ac.th/~wittawas/691/88736065/wk10-project-phase2.md), [Phase3](https://staff.informatics.buu.ac.th/~wittawas/691/88736065/wk15-project-phase3.md), [W13 design](https://staff.informatics.buu.ac.th/~wittawas/691/88736065/wk13-assignment.md), [W15](https://staff.informatics.buu.ac.th/~wittawas/691/88736065/wk15.md).
