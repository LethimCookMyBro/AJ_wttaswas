# ครัวแบ่งปัน

## ทิศทางใหม่

แอปค้นสูตรอาหารภาษาไทยที่เปิดมาแล้วเห็นอาหารก่อนข้อมูลเทคนิค ใช้พื้นที่ทำงานสีอ่อนกับ hero สี charcoal และปุ่มสีส้ม รวมความสบายตาของหน้า light ความคมของส่วน dark และภาพอาหารขนาดใหญ่ตามความต้องการล่าสุดของผู้ใช้ ไม่เพิ่ม theme toggle หรือเมนูที่ยังไม่มีระบบรองรับ

UI/UX Pro Max ค้นด้วย `recipe discovery photography modern` รอบแรกให้ motion-driven ที่ไม่เหมาะกับแอปนี้ จึงค้นให้แคบเป็น `food recipe editorial` ผลรอบสองเป็น flat design ใช้เส้นแบ่งง่าย พื้นสีทึบ และภาพอาหาร แทน scroll effects และ testimonial ที่ไม่มีข้อมูลจริง

## สีและตัวอักษร

- พื้นหลัก `#fafafa` และพื้นการ์ด `#ffffff`
- ตัวอักษร `#20262c` และข้อความรอง `#626970`
- Hero `#171d23` กับข้อความอ่อน `#c4c9cd`
- ปุ่มหลัก `#c54a25` กับตัวอักษรขาว ปุ่ม hero `#e8683b` กับตัวอักษรเข้ม
- Border `#e2e4e5` และพื้นประกอบสีอ่อน `#fff1e9`
- Noto Sans Thai 400, 600, 700 แบบ local TrueType ใน `/assets` พร้อม `font-display: swap`
- ระยะพื้นฐาน 4/8 px การ์ด radius 16 px ปุ่ม 10 px ไม่ใช้ gradients, glass, emoji, fake avatar หรือคะแนนที่แต่งขึ้น

## โครงสร้างและการนำทาง

- `#recipes` เป็นหน้าแรก มี hero สองส่วน รายการสูตรแบบภาพสามคอลัมน์ หมวดหมู่ และค้นหาชื่อจากรายการที่โหลดแล้ว
- `#recipe/ID` เป็นหน้ารายละเอียด มีรูปประกอบ ข้อมูลจริงจาก API วัตถุดิบ วิธีทำ รีวิวและแบบฟอร์มให้คะแนน
- `#create` เป็นฟอร์มเพิ่มสูตรแยกหน้า กรอกข้อมูลสูตรก่อนวิธีทำ บันทึกสำเร็จไปหน้าสูตรใหม่และแสดงข้อความยืนยันจาก POST จริง
- `#ideas` เป็นการค้น TheMealDB จากวัตถุดิบ แสดงสถานะ loading, empty, error และ degraded fallback ตามผล API
- ลิงก์กลับและ browser back ใช้ hash history ไม่ใช้ modal หรือ focus trap
- เมนู API docs และ OpenAPI ไปปลายทางเดิม

Model the Domain ทำให้หน้าแสดงผลมาจาก URL hash เพียงแหล่งเดียว State เก็บ recipes, selectedId, detailRequest, filter, search และ successId เพื่อคัดผลคำขอเก่าและแสดงข้อความยืนยันเฉพาะสูตรที่เพิ่งสร้าง Laziness Protocol ทำให้ใช้ native HTML และ API เดิม ไม่เพิ่ม framework, dependency, ระบบบัญชี, bookmark หรือฟอร์มอัปโหลดภาพ

## ภาพและขอบเขตข้อมูล

ภาพใน `/assets/pad-krapao.webp`, `/assets/mango-rice.webp`, `/assets/pepper-chicken.webp` และ `/assets/fried-rice.webp` เป็นภาพประกอบที่สร้างด้วย AI ไม่ใช่หลักฐานว่ามีคนทำสูตรจริง สูตรตั้งต้นสามสูตรจับคู่ภาพตาม ID สูตรอื่นใช้ภาพประกอบทั่วไปพร้อมป้าย ไม่อ้างว่าเป็นภาพของสูตรที่ผู้ใช้เพิ่ม

หน้า footer อ่าน storage จาก API และแสดง mysql หรือ in-memory ตามที่รันจริง. หน้า #login แยกงานยืนยันตัวตนจากหน้าแรกและเก็บ token ใน memory. ฟอร์มผูกตัวตนจากบัญชีที่ server ตรวจแล้ว ไม่ใช้ authorId/userId ตายตัว. การแสดง bounded contexts ไม่ได้อ้างว่า deploy เป็นหลายบริการ.

## สถานะและการเข้าถึง

Loading และ error ประกาศผ่าน `role=status` ปิดปุ่มระหว่างคำขอ เก็บข้อมูลฟอร์มไว้เมื่อบันทึกไม่สำเร็จ ข้อมูลที่แสดงจาก API ใช้ `textContent` ไม่ใช้ `innerHTML` การสร้างสูตรตรวจช่องว่างและขนาด UTF-8 10 KB ร่วมกับ native constraint validation

คำขอรายละเอียดใช้ตัวนับ ไม่แสดงผลล่าช้าทับสูตรใหม่ เปลี่ยนหน้าแล้ว focus ที่ h1 เมนูใช้ `aria-current` หมวดหมู่ใช้ `aria-pressed` ทุกช่องมี label และ error/status อ่านได้ รายการภาพสงวนสัดส่วนเพื่อลด layout shift หน้าเล็กเปลี่ยนเป็นหนึ่งคอลัมน์ ปุ่มและช่องกรอกอย่างน้อย 44 px มี focus ring และปิด transition เมื่อ `prefers-reduced-motion`

## การตรวจ

UI regression6กลุ่มผ่าน รวม auth, role, expiry, server-side list และ truthful refresh. การตรวจ CUA กับMySQLจริงและภาพ desktop/mobile อยู่ใน .transaction/final-ui-review.json. ไม่ถือ syntax check หรือ test ที่จำลอง DOM แทน rendered UI หรือ human usability study.
