# ผลทดสอบ Browser E2E แบบแยกข้อมูล

ผล: **ผ่าน 13 จุดตรวจ**

- ล็อกอินผิด: 401 และข้อความแจ้งผิดพลาด
- ผู้เยี่ยมชม/สมาชิกเพิ่มสูตรไม่ได้
- chef เพิ่มสูตรพร้อมวัตถุดิบ 2 รายการ (รวมทศนิยม 200.25) และอ่านข้อมูลที่บันทึกกลับ
- member ให้คะแนน: 201; ค่าเฉลี่ยบนหน้าจอ 5/5 จาก 1 รีวิว
- รีวิวซ้ำ: 409 พร้อมข้อความผิดพลาด
- ลบต้องพิมพ์ชื่อสูตรถูกต้อง; chef ลบสำเร็จ 200
- อ่านสูตรที่ลบแล้วได้ 404; recipes/recipe_ingredients/ratings กลับมาตรงกับข้อมูลก่อนทดสอบ
- รีเฟรชแล้วออกจากระบบตาม session แบบ memory-only
- ไม่พบ uncaught frontend errors

## ขอบเขต
Playwright Firefox 153.0 (build 1538), default security settings, MariaDB 11.8.6 ใหม่แบบ disposable, Express loopback ใน invocation เดียวกัน; browser ปฏิเสธทุก request นอก origin ทดสอบ ไม่แตะ production

นี่ไม่ใช่การทดสอบเขียนข้อมูลบน live Chrome/MySQL 8. Chromium sandbox launch ถูกจำกัดระดับระบบ จึงใช้ default Firefox ที่ได้รับอนุญาต และแก้เฉพาะ writable HOME/XDG paths โดยไม่ปิด sandbox

## หลักฐาน
report.json: checkpoints และ HTTP method/path/status ไม่มีรหัสผ่านหรือ token
01-created-with-ingredients.png: สูตรและวัตถุดิบที่สร้าง
02-member-review-duplicate.png: รีวิว/ค่าเฉลี่ยและข้อความรีวิวซ้ำ
03-deleted-clean-readback.png: กลับรายการหลังลบ

Browser, Express, DB connections และ MariaDB ถูกปิด และลบ datadir ชั่วคราวหลังทดสอบแล้ว

## การทำซ้ำและประวัติ harness

`isolated-browser-e2e.cjs` เป็นสำเนา byte-identical ของ harness ที่รันผ่าน SHA256 อยู่ใน report.json ไม่มีรหัสผ่าน/JWT จริงฝังไว้ ใช้ค่าสุ่มใน memory. เป็น artifact ของสภาพแวดล้อมทดสอบ: absolute paths ของ repo, Playwright และ binary MariaDB อยู่ใน harness จึงไม่ใช่คำสั่ง portable ที่เปิดรันจาก ZIP ได้ทันที ต้องเตรียม dependencies/path และฐาน disposable เท่านั้น. ไม่ใช้ production credentials หรือปิด browser sandbox.

รอบเตรียม harness เคยตรวจ fieldset ด้วย isDisabled() ไม่ตรงพฤติกรรม และไม่ได้เลือกคะแนนซ้ำหลังฟอร์ม reset จึงถูก native required validation หยุดไว้ แก้เฉพาะ assertion/ลำดับกรอกใน harness ไม่แก้ application runtime. รอบสุดท้ายผ่าน 13 checkpoints และรันผ่านซ้ำหลังรอ lazy image/layout ให้ settled ก่อนเก็บภาพที่ 3. Preliminary debugging artifacts ไม่รวมในชุดส่ง.

ผลนี้ปิดช่องว่าง authenticated browser write E2E สำหรับ isolated Firefox/MariaDB ตาม checkpoints เท่านั้น ไม่ยืนยันการซ้อมของผู้พรีจริง, production Chromium/MySQL 8 write/constraints, touch hardware หรือ full accessibility/security audit. รายงาน Jest184/13 และ VM10 เป็นคนละชุด ไม่เพิ่ม checkpoints นี้เข้าไปในจำนวน tests เดิม.
