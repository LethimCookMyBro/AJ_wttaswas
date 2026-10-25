# ครัวแบ่งปัน

เว็บสูตรอาหารสำหรับโครงงานวิชา 88736065 API for Back-End Development รหัสนิสิต 67160003 ใช้ Express, MySQL และ HTML/CSS/JavaScript เป็น modular monolith ไม่ใช่ microservices ที่แยก deploy แล้ว

- [เว็บไซต์](https://krua-web-production.up.railway.app/)
- [เอกสารโครงงาน](https://krua-web-production.up.railway.app/api-docs/)
- [Swagger](https://krua-web-production.up.railway.app/api-docs/reference/)

## ทดลองบนเครื่องโดยไม่ใช้ฐานข้อมูล

ใช้ Node.js 24 และ npm ติดตั้งตาม package-lock.json แล้วเริ่มโหมดข้อมูลจำลอง

```sh
npm ci
npm run demo
```

เปิด http://127.0.0.1:3000/ โหมดนี้ฟังเฉพาะเครื่องตัวเอง ข้อมูลอยู่ในหน่วยความจำและคืนชุดตั้งต้นเมื่อรีสตาร์ต ไม่เชื่อมฐานข้อมูลออนไลน์ ค่าเข้าสู่ระบบจำลองอธิบายไว้ใน .env.example ใช้กับข้อมูลทดสอบเท่านั้น ห้ามนำไปใช้บนเซิร์ฟเวอร์สาธารณะ

## ใช้ MySQL บนเครื่อง

1. เตรียม MySQL และฐานข้อมูลแยกสำหรับโครงงาน ใช้ schema.sql และ seed.sql เฉพาะฐานข้อมูลใหม่ อย่านำ seed ไปทับข้อมูลใช้งานจริง
2. คัดลอก .env.example เป็น .env แล้วตั้ง DB_*, JWT_SECRET แบบสุ่มอย่างน้อย 32 ตัวอักษร และ DEMO_PASSWORD สำหรับบัญชีจำลองของคุณเอง
3. รัน npm run migrate และ npm run setup-demo ด้วยบัญชีที่มีสิทธิ์จัดการ schema ขั้นตอน setup ตั้งรหัสเฉพาะสามบัญชี fixture ที่มีอยู่แล้ว
4. รัน npm start ด้วยบัญชีฐานข้อมูลที่จำกัดสิทธิ์ตามการใช้งานจริง ไม่ใช้บัญชี root เป็น runtime

.env และไฟล์ที่เครื่องมือสร้างใน .transaction/ เป็นข้อมูลส่วนตัว ไม่ต้อง commit หรือส่งให้ผู้อื่น ชุดข้อมูล SQL ใน repo เป็นข้อมูลจำลอง ไม่ใช่ backup ของฐานข้อมูลออนไลน์

## ความสามารถและสิทธิ์

- ทุกคนอ่านสูตร ค้นหา กรอง เรียงลำดับ และดูไอเดียจาก TheMealDB ได้
- chef และ admin เพิ่มสูตรพร้อมวัตถุดิบได้ในครั้งเดียวแบบ atomic transaction เจ้าของสูตรที่มีสิทธิ์หรือ admin เพิ่มวัตถุดิบและลบสูตรผ่านการยืนยันชื่อสูตรได้
- สมาชิกที่เข้าสู่ระบบให้คะแนนได้ครั้งเดียวต่อสูตร ระบบผูกผู้เขียนกับ JWT ไม่รับตัวตนจาก client
- Token มีอายุ 15 นาที หน้าเว็บเก็บไว้ในหน่วยความจำ รีเฟรชแล้วต้องเข้าสู่ระบบใหม่ การเข้าเว็บไม่ได้ทำให้ Swagger เข้าสู่ระบบด้วย
- ฉบับ candidate เปลี่ยน /api-docs/ เป็นหน้าเอกสารโครงงานแบบเรียบสำหรับเปิดหลักฐานตามเกณฑ์อาจารย์ ไม่ใช่แอปสาธิตซ้ำหรือคู่มือสี่ขั้น ให้สาธิตผ่านเว็บจริง: เข้าสู่ระบบ chef → เพิ่มสูตรพร้อมวัตถุดิบ → ตรวจข้อมูล → บันทึก → เปิดรายละเอียดอัตโนมัติ ส่วน Swagger แยกไว้สำหรับตรวจ API การบันทึกมีผลกับข้อมูลจริง ภาพอาหารเป็นภาพที่สร้างด้วย AI

Swagger เรียกเซิร์ฟเวอร์เดียวกับหน้าเอกสาร หากเปิดเว็บออนไลน์แล้วกด Execute สำหรับคำสั่งเขียน จะเปลี่ยนข้อมูลจริง

## โครงสร้าง

```text
frontend/        หน้าเว็บ คู่มือ ภาพประกอบ และฟอนต์
src/             API, authentication, validation และ database adapter
migrations/      schema migration และ rollback SQL
test/            ชุดทดสอบอัตโนมัติ
tools/           demo, migration, cloud bootstrap และเครื่องมือตรวจ
docs/            ERD, coverage, isolated-DB/API evidence และ release verification
openapi.yaml     API specification ที่ทดสอบเทียบกับ routes จริง
schema.sql       schema ตั้งต้นสำหรับฐานข้อมูลใหม่
seed.sql         ข้อมูลจำลอง
Dockerfile       runtime Node24 แบบ non-root
```

## ตรวจสอบโค้ด

```sh
npm test
npm run test:ui
npm run coverage
npm audit
```

Candidate ตามเกณฑ์อาจารย์ รอบ 25 ตุลาคม 2026 ผ่าน 184 tests / 13 suites และ VM UI 10 สถานการณ์ Coverage วัดใหม่: lines 94.21%, statements 93.34%, branches 85.79%, functions 98.47%. ดู docs/test-run-summary.json, docs/test-results.txt และ coverage-report.md. จำนวน 212/14 เป็นหลักฐานรุ่นคู่มือสี่ขั้นเดิม ไม่ใช่ candidate ปัจจุบัน.

ผลฐานข้อมูลเดิมที่แยกทดสอบด้วย MariaDB 11.8.6 ผ่าน 14 checkpoint groups และบันทึก 15 HTTP request/response examples โดยไม่ใช้ Production ผลนี้ไม่ใช่ exact MySQL 8 และไม่ใช่ browser E2E. npm run test:real และสคริปต์ MySQL verification ต้องเตรียมฐานข้อมูลทดสอบแยกก่อน ห้ามใช้ฐานข้อมูลออนไลน์ในการทดสอบลบหรือ migration rollback

หลักฐานย้อนหลังของ release 3ebf76e: ตรวจเว็บจริงแบบอ่านข้อมูลผ่าน cloud browser แล้ว รวมหน้าแรก รายละเอียด เข้าสู่ระบบ ฟอร์ม guest คู่มือนำเสนอ 4 ขั้น และ Swagger GET ได้ 200 ตรวจความกว้าง 320/390/768/1280/1440 CSS pixels ด้วยการปรับหน้าต่างและ zoom บน desktop ไม่ใช่มือถือจริง ส่วน authenticated browser write E2E ยังไม่ได้รัน เพราะ browser เข้า preview แยกไม่ได้ ไม่มีการเขียนข้อมูล production เพื่อทดแทนการทดสอบนี้

Candidate หน้าหลักฐานตามอาจารย์ยังไม่ deploy/ตรวจ browser ณ การแก้เอกสารนี้; ห้ามใช้ผลคู่มือสี่ขั้นเดิมแทนผลตรวจ candidate. Release ก่อนหน้า 3ebf76ed9a5b5f15f76c6e9a99e6695b1f26fa4a ยืนยัน remote main และ Railway SUCCESS แล้ว การลบภาพ login เก่าและฟอนต์ Swagger ตรวจหลัง deploy แล้ว: ลิงก์ภาพเก่า 0 รายการ, computed font และภาพจริงเป็น IBM Plex Sans Thai, expanded GET ที่กว้าง 320 มี scrollWidth 311 ไม่ล้น หลักฐาน docs/deployment-3ebf76e.json ยืนยัน asset ตรง source 9 ไฟล์และ public HTTP 200 อีก 8 เส้นทาง health OK และ storage=mysql (ไม่ใช่การยืนยัน exact MySQL 8) ส่วน source package ยังจัดส่งแยก ชุดภาพเลือกเฉพาะ *-viewport.png จาก krua-evidence/redesign-fcac037 ไม่รวม fullPage ที่ถูกครอปจาก zoom ไม่ใช่ 100% ดูขอบเขตหลักฐานใน docs/frontend-verification.md และ docs/release-checklist.md ไม่ถือว่าผล test เป็นการรับรองความปลอดภัยหรือความสมบูรณ์ทุกด้าน

tools/verify-browser.js เป็นเครื่องมือทางเลือกที่ต้องมี Playwright เพิ่ม ไม่ใช่ dependency ของ quick start ด้านบน npm test และ npm run test:ui ไม่ต้องใช้เครื่องมือนี้

## Railway

Dockerfile และ .railwayignore จำกัดไฟล์ที่ใช้ build มี /healthz สำหรับ readiness ระบบฐานข้อมูลออนไลน์แยกจากเครื่องนักพัฒนา ใช้ตัวแปร environment ส่วนตัวของ Railway ไม่เก็บค่าจริงไว้ใน repo

tools/cloud-bootstrap.js เป็น pre-deploy สำหรับฐานข้อมูลใหม่ที่เตรียมไว้โดยเฉพาะ เมื่อถอดตัวแปรเริ่มต้นแล้วจะตรวจ schema เดิมโดยไม่ seed ซ้ำ อย่ารันขั้นตอนเริ่มต้นกับฐานข้อมูลอื่น รายละเอียดตัวแปรที่รองรับอยู่ในสคริปต์และ .env.example ไม่มีรหัสผ่าน deploy รวมอยู่ที่นี่

## ไฟล์ที่ไม่เผยแพร่

ไม่รวม node_modules, .env จริง, credentials, private login files, logs, audit/transaction records, database dumps, ZIP ส่งงาน, PPTX หรือไฟล์ตั้งค่าเฉพาะเครื่อง .gitignore ป้องกันไฟล์เหล่านี้ ส่วน .env.example, source, tests, migrations, ภาพที่เว็บใช้ และ license ของฟอนต์ต้องเก็บไว้

ยังไม่มี registration, password reset, token revocation, high availability, production load/penetration test หรือ backup restore drill ส่วน main เชื่อม Railway auto-deploy แล้ว และตรวจ release จริงด้วย GitHub deployment status พร้อม hash ของไฟล์ที่เซิร์ฟเวอร์ส่งกลับ

## หลักฐานส่งอาจารย์และ Postman

เริ่มจาก coverage-report.md, clo-requirements-checklist.md, erd.png และ postman_collection.json. Collection ส่งอาจารย์มี 16 observed examples ครบ 12 OpenAPI operations (ไม่ใช่ทุก error permutation); ตรวจด้วย `node docs/check-postman-operation-coverage.js`.

`npm run postman` สร้าง **postman_template.json** เท่านั้น ไม่มีผลตอบกลับจริง ส่วน `npm run postman -- --record` ใช้ POSTMAN_BASE_URL แบบ localhost และ DEMO_PASSWORD เพื่อ replay บนฐานทดสอบแยก สร้าง **postman_recorded.json** ซึ่งอาจมีการสร้าง/ลบ fixture. ทั้งสองคำสั่งไม่เขียนทับ postman_collection.json ต้องตรวจ provenance/response/operations ก่อนนำผลใหม่มาแทนหลักฐานด้วยตนเอง ห้ามชี้ไป production.
