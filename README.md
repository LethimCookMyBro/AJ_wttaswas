# ครัวแบ่งปัน

เว็บสูตรอาหารสำหรับโครงงานวิชา 88736065 API for Back-End Development รหัสนิสิต 67160003 ใช้ Express, MySQL และ HTML/CSS/JavaScript เป็น modular monolith ไม่ใช่ microservices ที่แยก deploy แล้ว

- [เว็บไซต์](https://krua-web-production.up.railway.app/)
- [ภาพรวมการทำงาน](https://krua-web-production.up.railway.app/api-docs/)
- [คู่มือทดลอง API](https://krua-web-production.up.railway.app/api-docs/start/)
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
- chef และ admin เพิ่มสูตรได้ เจ้าของสูตรที่มีสิทธิ์หรือ admin จัดการวัตถุดิบและลบสูตรได้
- สมาชิกที่เข้าสู่ระบบให้คะแนนได้ครั้งเดียวต่อสูตร ระบบผูกผู้เขียนกับ JWT ไม่รับตัวตนจาก client
- Token มีอายุ 15 นาที หน้าเว็บเก็บไว้ในหน่วยความจำ รีเฟรชแล้วต้องเข้าสู่ระบบใหม่ การเข้าเว็บไม่ได้ทำให้ Swagger เข้าสู่ระบบด้วย
- ภาพรวมแยกจากคู่มือทดลองและ Swagger ภาพหน้าจอเป็นภาพประกอบแบบคงที่ ไม่ใช่หน้าจอสด ภาพอาหารเป็นภาพที่สร้างด้วย AI

Swagger เรียกเซิร์ฟเวอร์เดียวกับหน้าเอกสาร หากเปิดเว็บออนไลน์แล้วกด Execute สำหรับคำสั่งเขียน จะเปลี่ยนข้อมูลจริง

## โครงสร้าง

```text
frontend/        หน้าเว็บ คู่มือ ภาพประกอบ และฟอนต์
src/             API, authentication, validation และ database adapter
migrations/      schema migration และ rollback SQL
test/            ชุดทดสอบอัตโนมัติ
tools/           demo, migration, cloud bootstrap และเครื่องมือตรวจ
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

ก่อนเผยแพร่รอบนี้ ชุดทดสอบหลักผ่าน 140 tests ใน 11 suites และ UI assertions 6 กลุ่ม ผลนี้ไม่ใช่การรับรอง production security หรือการทดสอบกับผู้ใช้จริง npm run test:real และสคริปต์ MySQL verification ต้องเตรียมฐานข้อมูลทดสอบแยกก่อน ไม่ใช้ฐานข้อมูลออนไลน์ในการทดสอบลบหรือ migration rollback

tools/verify-browser.js เป็นเครื่องมือทางเลือกที่ต้องมี Playwright เพิ่ม ไม่ใช่ dependency ของ quick start ด้านบน npm test และ npm run test:ui ไม่ต้องใช้เครื่องมือนี้

## Railway

Dockerfile และ .railwayignore จำกัดไฟล์ที่ใช้ build มี /healthz สำหรับ readiness ระบบฐานข้อมูลออนไลน์แยกจากเครื่องนักพัฒนา ใช้ตัวแปร environment ส่วนตัวของ Railway ไม่เก็บค่าจริงไว้ใน repo

tools/cloud-bootstrap.js เป็น pre-deploy สำหรับฐานข้อมูลใหม่ที่เตรียมไว้โดยเฉพาะ เมื่อถอดตัวแปรเริ่มต้นแล้วจะตรวจ schema เดิมโดยไม่ seed ซ้ำ อย่ารันขั้นตอนเริ่มต้นกับฐานข้อมูลอื่น รายละเอียดตัวแปรที่รองรับอยู่ในสคริปต์และ .env.example ไม่มีรหัสผ่าน deploy รวมอยู่ที่นี่

## ไฟล์ที่ไม่เผยแพร่

ไม่รวม node_modules, .env จริง, credentials, private login files, logs, audit/transaction records, database dumps, ZIP ส่งงาน, PPTX หรือไฟล์ตั้งค่าเฉพาะเครื่อง .gitignore ป้องกันไฟล์เหล่านี้ ส่วน .env.example, source, tests, migrations, ภาพที่เว็บใช้ และ license ของฟอนต์ต้องเก็บไว้

ยังไม่มี registration, password reset, token revocation, high availability, production load/penetration test หรือ backup restore drill และไม่ได้เชื่อม repo นี้ให้ deploy อัตโนมัติ
