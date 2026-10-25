# แบบออกแบบ Microservices ของระบบสูตรอาหาร

รหัสนิสิต 67160003. อ้างขอบเขตใบงาน `wk13-assignment.md` ซึ่งประเมินการออกแบบ ไม่ได้บังคับแยก deployment จริงทุกส่วน. แบบนี้ใช้เป็นแผนแบ่ง bounded context ของโครงงาน ไม่ใช่รายงานว่ามี distributed services รันแล้ว.

## สถานะที่รันจริง

Express เสิร์ฟ frontend และ 12 API operations ใน process เดียว. Recipes, categories, ingredients และ ratings ใช้ pool ร่วมจาก `src/db.js`. `src/services/external-api.js` แยกความรู้เรื่อง TheMealDB และ resilience. Demo เลือก MySQL จริงหรือ in-memory adapterได้. บันทึกเดิมเคยอ้าง MySQL8.0.46 บน loopback33317 แต่รอบ25 ตุลาคม2026 ยังไม่ใช้เป็นหลักฐานใหม่; สถานะทดสอบล่าสุดอยู่ใน docs/backend-verification.md. `/api/v1/system` บอกขอบเขตทางธุรกิจเท่านั้น. ยังไม่มี API Gateway แยก process หรือ message broker.

## ตารางแบ่งบริการตามธุรกิจ

| Bounded context / บริการที่ออกแบบ | ความรับผิดชอบและข้อมูลที่เป็นเจ้าของ | Endpoint หลักปัจจุบัน |
| --- | --- | --- |
| Recipe catalog | วงจรชีวิตสูตร หมวดหมู่ คลังวัตถุดิบ และปริมาณในสูตร. เป็นเจ้าของ recipes, categories, ingredients, recipe_ingredients | GET/POST `/api/v1/recipes`, GET/DELETE `/api/v1/recipes/{id}`, GET `/api/v1/categories`, GET `/api/v1/ingredients`, POST `/api/v1/recipes/{id}/ingredients` |
| Community reviews | คะแนน 1 ถึง 5, ความคิดเห็น, ผู้รีวิว และกติกาหนึ่งคนหนึ่งรีวิวต่อสูตร. เป็นเจ้าของ ratings และโปรไฟล์ผู้ใช้ในแบบออกแบบ | GET/POST `/api/v1/recipes/{id}/ratings` |
| Meal discovery | ค้นไอเดียจาก TheMealDB, map response, จำกัดเวลา/retry และรายการสำรอง. ไม่เป็นเจ้าของสูตรที่ผู้ใช้สร้าง | GET `/api/v1/external/meal-ideas?ingredient=chicken_breast` |

ไม่แบ่งตาม controller/service/database เพราะแต่ละแถวเป็นความสามารถทางธุรกิจ. ในอนาคตต้องแยก ownership ของ users และความหมาย author/member ให้ชัดก่อนย้าย DB จริง. การยืนยันตัวตนจริงใช้ login/JWT และอ่าน role จาก users. การแยก identity provider เป็นบริการยังเป็นแบบออกแบบ.

## แผนภาพสถาปัตยกรรมเป้าหมาย

```text
Browser
   | HTTPS /api/v1/*
   v
API Gateway
   |---- recipes/categories/ingredients ----> Recipe catalog ----> Catalog DB
   |---- recipes/:id/ratings --------------> Community reviews -> Reviews DB
   |---- external/meal-ideas --------------> Meal discovery ----> TheMealDB
                                                   |
                                                   +----> fixed local fallback

Community reviews -- sync recipe lookup --> Recipe catalog
Community reviews -- async RatingSubmitted --> Broker --> Recipe catalog projection
Recipe catalog ---- async RecipeDeleted ----> Broker --> Community reviews cleanup
```

Gateway เก็บเส้นทางภายนอกเดิมเพื่อไม่ให้ browser รู้ host ของแต่ละ service. ตรวจ token, จำกัด request และตั้ง correlation id ที่ขอบระบบในแบบเป้าหมาย. ในโค้ดจริง Express ตรวจ JWT, role, ownership และ quotaแล้ว. การแบ่ง DB และ broker ในรูปเป็นแบบออกแบบเท่านั้น.

## รูปแบบการสื่อสารและเหตุผล

| ผู้เรียก → ผู้รับ | รูปแบบในแบบออกแบบ | เหตุผล | สิ่งที่ทำจริงตอนนี้ |
| --- | --- | --- | --- |
| Browser → Gateway → แต่ละ context | Synchronous HTTP | ผู้ใช้ต้องเห็นผลบันทึกหรือ error ก่อนดำเนินการต่อ | fetch ไป Express origin เดียว |
| Community reviews → Recipe catalog | Synchronous GET ตรวจ recipe id | ปฏิเสธรีวิวสำหรับสูตรที่ไม่มีอยู่ก่อนบันทึก. ถ้าตรวจไม่ได้ต้องไม่แสดงว่าสำเร็จ | query `SELECT id FROM recipes` ใน DB ร่วม ไม่ใช่ inter-service HTTP |
| Community reviews → Recipe catalog | Asynchronous `RatingSubmitted` สำหรับคะแนนสรุป | การบันทึกรีวิวไม่ต้องรออัปเดตทุก read model. คะแนนอาจตามหลังชั่วคราว | GET ratings คำนวณจาก rows โดยตรง ยังไม่มี event |
| Recipe catalog → Community reviews | Asynchronous `RecipeDeleted` | แยก cleanup รีวิวออกจากการลบสูตรในระบบกระจาย | FOREIGN KEY CASCADE ใน schema และจำลองใน memory adapter |
| Meal discovery → TheMealDB | Synchronous HTTP GET | ผู้ใช้รอไอเดียได้ช่วงสั้น แล้วควรเห็น fallback ที่ระบุว่าเป็นข้อมูลสำรอง | axios พร้อม retry/timeout/fallback มีเทสต์จริงกับ local HTTP fixture |
| Recipe catalog ↔ Meal discovery | ไม่ต้องเรียกตรง | ไอเดียภายนอกเป็นข้อมูลเสริม ไม่ควรทำให้การเปิดสูตรล้ม | ไม่มีการเรียกข้ามกัน |

Event ที่ออกแบบต้องมี `eventId`, `recipeId`, `occurredAt` และ payload ตามชนิด event. Consumer เก็บ eventId ที่ประมวลผลแล้วเพื่อกันข้อมูลซ้ำ. ใช้ transactional outbox สำหรับ publish หลัง commit และ dead-letter queue เมื่อ retry เกินกำหนด. กลไกเหล่านี้ยังไม่ถูก implement. กรณีสูตรถูกลบหลัง lookup ต้องแก้ด้วย tombstone/version และ cleanup event ไม่ใช่อ้างว่า synchronous lookup ป้องกัน race ได้ทั้งหมด.

## Retry, timeout และ fallback

| จุดเรียก | Timeout | Retry | Fallback / พฤติกรรมเมื่อไม่สำเร็จ | สถานะ |
| --- | --- | --- | --- | --- |
| Browser → API | 6000ms ต่อ fetchทั่วไป และ12000ms สำหรับ meal-ideas | ไม่ retry mutation อัตโนมัติ | แจ้งข้อความและให้ผู้ใช้ลองใหม่. คงข้อมูลฟอร์มเมื่อ POST ล้มเหลว | ทำจริง `frontend/app.js` |
| Meal discovery → TheMealDB | 3000ms ต่อ attempt ค่าเดิม | 2 retries เมื่อ network/timeout/5xx, backoff 300/600ms. ไม่ retry 4xx | 200 พร้อม `source=fallback`, `degraded=true`, reason และ 3 รายการสำรอง. ไม่อ้างว่าเป็นเมนูจากวัตถุดิบที่ค้น | ทำจริงและมีเทสต์ |
| เส้นทาง TheMealDB ใน demo | 800ms ต่อ attempt | 2 retries, backoff100/200ms | เหมือนเดิม แต่จำกัดเวลารอสำหรับการสาธิต | ทำจริง `tools/demo.js` |
| Gateway → context ภายใน | เสนอ 2000ms ต่อ request | GET retry ได้สูงสุด 1 ครั้งเฉพาะ network/5xx. POST ต้องมี idempotency key และบันทึกผลก่อนจึง retry ได้ | 503 และข้อความชัดเจน ห้ามคืนผลบันทึกสำเร็จปลอม | แบบออกแบบ ยังไม่แยก process |
| Reviews → Catalog lookup | เสนอ 500ms | GET retry 1 ครั้ง | 503 ให้ลองใหม่ ไม่บันทึกรีวิวเมื่อยืนยัน recipe ไม่ได้ | แบบออกแบบ |
| Event consumers | เสนอ ack ภายใน 5s | exponential backoff และจำกัด 5 attempts | dead-letter queue พร้อมแจ้งผู้ดูแล ไม่ทิ้ง event เงียบ | แบบออกแบบ |

Timeout ในตารางคนละขอบเขต. Demo ภายนอกมี budgetประมาณ2700msและค่าเริ่มต้นประมาณ9900msก่อนoverhead. Browserให้meal-ideas12000msและAPIอื่น6000ms. รอบ25 ตุลาคม2026 controlled HTTP test ยืนยัน fallback TIMEOUT/attempts3 ประมาณ9.9วินาที; VM UI test ตรวจ timeout12000ms แต่ยังไม่ใช่หลักฐาน rendered browser. หากเพิ่มbudgetผ่านenvต้องปรับทั้งเส้นทางและตรวจใหม่. การคำนวณนี้ไม่ใช่ผลloadtest.

## Trade-off และสิ่งที่ยังต้องทำ

Monolith ช่วยให้รันสาธิตได้ด้วยคำสั่งเดียวและคง FK/CASCADE ใน DB เดียว. การแยกบริการทำให้ deploy/scale แยกได้ แต่เพิ่ม network failure, eventual consistency, observability และภาระดูแล. จึงส่งแบบแบ่ง context ที่ตรวจสอบเหตุผลได้ โดยไม่เพิ่ม broker หรือ containers ที่ยังไม่มีหลักฐานใช้งาน. auth/ownership ผ่าน automated tests; isolated real-database integration ของรอบปัจจุบันกำลังตรวจและจะรายงานชนิด DB อย่างชัดเจน ไม่ยกผลเก่ามาอ้างเป็นผลใหม่. ก่อนแยกจริงยังต้องมี service contract tests, outbox/idempotency, tracing และ shared state strategy.
