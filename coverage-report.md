# Test Coverage Baseline — ครัวแบ่งปัน 67160003

## ผลที่วัดจริงและขอบเขต

Snapshot coverage: [docs/backend-coverage-summary.json](docs/backend-coverage-summary.json), อธิบายรอบวัดและ regression ใน [docs/backend-verification.md](docs/backend-verification.md). วัด backend `src/**/*.js` ด้วย Jest โดยใช้ database test double ไม่ใช่ browser coverage หรือ production/MySQL integration coverage.

| Metric | ผลวัด |
|---|---:|
| Statements | 93.34% (505/541) |
| Branches | 85.79% (314/366) |
| Functions | 98.47% (129/131) |
| Lines | 94.21% (407/432) |

ผลวัด candidate ล่าสุด 25 ต.ค. 2026 เวลา 06:01 UTC: `npm run coverage` ผ่าน **184 tests / 13 suites** และ `npm run test:ui` ผ่าน **10 สถานการณ์** แยกต่างหาก. หลักฐานคงทน: [test-run-summary.json](docs/test-run-summary.json), [raw coverage/test log](docs/test-results.txt), [VM UI log](docs/ui-test-results.txt). ตัวเลข 212/14 เป็นรุ่นคู่มือสี่ขั้นเดิม ไม่ใช่ candidate นี้ ซึ่งเอาคู่มือซ้ำออก. ตารางนี้เป็น coverage ที่วัดใหม่จริง ไม่ใช่ snapshot เดิม.

## สามไฟล์ coverage ต่ำสุดตาม line coverage พร้อมเหตุผล

| ไฟล์ | Lines | Branches | เหตุผลและความเสี่ยงที่ยังไม่ครอบคลุม |
|---|---:|---:|---|
| `src/index.js` | 91.56% | 89.04% | defensive DB-error/race branches และ direct process startup/logging บางเส้นทาง; suite ไม่ฉีดทุก failure ของ DB/การเริ่ม process จึงไม่รับรองทุกกรณี operational failure |
| `src/services/external-api.js` | 94.00% | 96.49% | exhausted-loop และ unexpected internal-error fallback บางเส้นทาง; ทดสอบ network/5xx/timeout หลักไม่ได้ครอบคลุม internal exception ทุกแบบ |
| `src/db.js` | 99.17% | 69.76% | mock lifecycle/alternate constraint branches และ real connection path ไม่ครอบคลุมด้วย mock suite; line สูงไม่ได้พิสูจน์ transaction/isolation ของ server จริง |

`src/password.js` ได้ 100% ทั้งสี่ metric ใน snapshot นี้. ไม่มีเกณฑ์ minimum percentage ในใบงาน Phase 3 ที่อ้างอิง; ไม่ถือ coverage สูงเป็นการรับรองระบบปลอดข้อผิดพลาด.

## หลักฐานแยกที่ไม่ควรรวมเป็น coverage

- [MariaDB integration](docs/mariadb-integration-results.json): 14 checkpoint groups ผ่านบน disposable MariaDB 11.8.6 รวม schema/seed, migration, role/ownership, atomic commit/rollback/concurrency และ constraints. ไม่ใช่ exact MySQL 8.
- [Postman collection](postman_collection.json): 16 observed examples ครบ 12 OpenAPI method/path operations; 15 ตัวอย่างเดิมกับ isolated MariaDB และ localhost external fixture, เพิ่ม GET system แบบ read-only บน isolated DB. ไม่ใช่ทุก error/status permutation.
- [Failure scenarios](failure-scenario-results.md): S1–S8 ผ่าน แต่ live TheMealDB S0 degraded/fallback; ไม่รายงาน all-green.
- [Browser scope](docs/frontend-verification.md): desktop responsive/read-only/guest checks; authenticated browser write E2E ยังไม่ได้รันเพราะ browser network เข้า isolated preview ไม่ได้. ไม่เขียน production เพื่อแทนการทดสอบ.

## รันซ้ำ

`npm ci` แล้ว `npm run coverage` บนสภาพแวดล้อมพัฒนา/ทดสอบ; อ่านรายงาน `coverage/coverage-summary.json` และ lowest-three ใหม่. ใช้ฐานแยกสำหรับ integration เท่านั้น ไม่ตั้ง DB credentials เป็น production. รอบนี้ยังไม่มี exact MySQL 8, load/penetration test หรือ full hardware/accessibility audit.

แหล่งเกณฑ์: [Phase 3](https://staff.informatics.buu.ac.th/~wittawas/691/88736065/wk15-project-phase3.md), [W15: lowest-three files + reasons](https://staff.informatics.buu.ac.th/~wittawas/691/88736065/wk15.md).
