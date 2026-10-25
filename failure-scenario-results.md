# ผลการทดสอบ Failure Scenario ของการเชื่อมต่อ API ภายนอก

รหัสนิสิต 67160003 · Pno 4 · ระบบสูตรอาหาร · บริการภายนอก: TheMealDB (`GET /api/v1/external/meal-ideas`)

ไฟล์นี้สร้างโดย `npm run failure-scenarios` (`tools/run-failure-scenarios.js`) จากการรันโค้ดจริงของ `src/services/external-api.js` เมื่อ 2026-10-25T04:42:05.164Z บน Node v24.22.1 (linux) ตัวเลขเวลาและจำนวนครั้งทั้งหมดมาจากการรันครั้งนั้น ไม่ได้เขียนขึ้นเอง

## ค่าที่ออกแบบไว้

| กลไก | ค่า |
| --- | --- |
| Timeout | 3000 ms ต่อครั้ง |
| Retry | 2 ครั้ง (รวมครั้งแรกเป็น 3 ครั้ง) เฉพาะ network error, timeout, 5xx |
| Backoff | exponential: 300 ms แล้ว 600 ms |
| ไม่ลองซ้ำ | 4xx และข้อมูลตอบกลับรูปแบบผิด |
| Fallback | ตอบ 200 พร้อม `source = fallback`, `degraded = true` และรายการสำรอง 3 เมนูของระบบ แทนการตอบ error หรือค้าง |

เวลาสูงสุดที่ผู้ใช้ต้องรอเมื่อบริการภายนอกล่มหรือช้าทุกครั้ง = 3 × 3000 + 300 + 600 = 9900 ms

## สรุปผล

| # | สถานการณ์ | ผลที่คาดไว้ | ผลที่ได้จริง | ผ่าน |
| --- | --- | --- | --- | --- |
| S0 | บริการจริง TheMealDB ปกติ (baseline) | source = themealdb, attempts = 1 | source = themealdb, attempts = 2, ใช้เวลา 5439 ms | ไม่ผ่าน |
| S1 | เรียกโฮสต์ที่เข้าถึงไม่ได้ (DNS/proxy อาจคืน network error หรือ timeout) | source = fallback, reason = NETWORK_ERROR,TIMEOUT, attempts = 3, ใช้เวลา 900-12000 ms | source = fallback, reason = TIMEOUT, attempts = 3, ใช้เวลา 8308 ms | ผ่าน |
| S2 | เชื่อมต่อไม่ได้ (พอร์ตปลายทางปิด จำลองเครือข่ายใช้ไม่ได้) | source = fallback, reason = NETWORK_ERROR, attempts = 3, ใช้เวลา 900-4000 ms | source = fallback, reason = NETWORK_ERROR, attempts = 3, ใช้เวลา 908 ms | ผ่าน |
| S3 | บริการภายนอกตอบ 500 ทุกครั้ง | source = fallback, reason = UPSTREAM_5XX, attempts = 3, เซิร์ฟเวอร์ถูกเรียก 3 ครั้ง, ใช้เวลา 900-4000 ms | source = fallback, reason = UPSTREAM_5XX, attempts = 3, เซิร์ฟเวอร์ถูกเรียก 3 ครั้ง, ใช้เวลา 913 ms | ผ่าน |
| S4 | ล้มสองครั้งแล้วฟื้น (retry ช่วยให้สำเร็จ) | source = themealdb, attempts = 3, เซิร์ฟเวอร์ถูกเรียก 3 ครั้ง, ใช้เวลา 900-4000 ms | source = themealdb, attempts = 3, เซิร์ฟเวอร์ถูกเรียก 3 ครั้ง, ใช้เวลา 906 ms | ผ่าน |
| S5 | บริการภายนอกตอบช้ากว่า timeout | source = fallback, reason = TIMEOUT, attempts = 3, เซิร์ฟเวอร์ถูกเรียก 3 ครั้ง, ใช้เวลา 9000-12000 ms | source = fallback, reason = TIMEOUT, attempts = 3, เซิร์ฟเวอร์ถูกเรียก 3 ครั้ง, ใช้เวลา 9906 ms | ผ่าน |
| S6 | บริการตอบ 404 (คำขอผิด ไม่ควรลองซ้ำ) | source = fallback, reason = UPSTREAM_4XX, attempts = 1, เซิร์ฟเวอร์ถูกเรียก 1 ครั้ง, ใช้เวลา 0-1000 ms | source = fallback, reason = UPSTREAM_4XX, attempts = 1, เซิร์ฟเวอร์ถูกเรียก 1 ครั้ง, ใช้เวลา 2 ms | ผ่าน |
| S7 | บริการตอบ 200 แต่รูปแบบข้อมูลไม่ตรงที่คาด | source = fallback, reason = INVALID_RESPONSE, attempts = 1, เซิร์ฟเวอร์ถูกเรียก 1 ครั้ง, ใช้เวลา 0-1000 ms | source = fallback, reason = INVALID_RESPONSE, attempts = 1, เซิร์ฟเวอร์ถูกเรียก 1 ครั้ง, ใช้เวลา 2 ms | ผ่าน |
| S8 | เรียกผ่าน endpoint จริงตอนบริการภายนอกล่ม | HTTP 200, header X-Data-Source = fallback, degraded = true และ endpoint อื่นยังตอบปกติ | HTTP 200, X-Data-Source = fallback, degraded = true, attempts = 3, ใช้เวลา 9479 ms, หลังจากนั้น GET /api/v1/recipes ตอบ 200 | ผ่าน |

## รายละเอียดแต่ละสถานการณ์

### S0: บริการจริง TheMealDB ปกติ (baseline)

- วิธีจำลอง: เรียก https://www.themealdb.com จริง
- ผลที่ได้: `{"source":"themealdb","degraded":false,"attempts":2}` ใช้เวลา 5439 ms
- log ที่ระบบบันทึก:

```text
[external-api] attempt 1/3 failed: TIMEOUT
```

### S1: เรียกโฮสต์ที่เข้าถึงไม่ได้ (DNS/proxy อาจคืน network error หรือ timeout)

- วิธีจำลอง: ตั้ง baseUrl เป็น http://recipe-api-unreachable.invalid
- ผลที่ได้: `{"source":"fallback","degraded":true,"reason":"TIMEOUT","attempts":3}` ใช้เวลา 8308 ms
- log ที่ระบบบันทึก:

```text
[external-api] attempt 1/3 failed: TIMEOUT
[external-api] attempt 2/3 failed: UPSTREAM_5XX (503)
[external-api] attempt 3/3 failed: TIMEOUT
```

### S2: เชื่อมต่อไม่ได้ (พอร์ตปลายทางปิด จำลองเครือข่ายใช้ไม่ได้)

- วิธีจำลอง: ชี้ไปที่พอร์ต localhost ที่ไม่มีบริการรับ (ECONNREFUSED)
- ผลที่ได้: `{"source":"fallback","degraded":true,"reason":"NETWORK_ERROR","attempts":3}` ใช้เวลา 908 ms
- log ที่ระบบบันทึก:

```text
[external-api] attempt 1/3 failed: NETWORK_ERROR ECONNREFUSED
[external-api] attempt 2/3 failed: NETWORK_ERROR ECONNREFUSED
[external-api] attempt 3/3 failed: NETWORK_ERROR ECONNREFUSED
```

### S3: บริการภายนอกตอบ 500 ทุกครั้ง

- วิธีจำลอง: เซิร์ฟเวอร์จำลองตอบ HTTP 500 ทุก request
- ผลที่ได้: `{"source":"fallback","degraded":true,"reason":"UPSTREAM_5XX","attempts":3}` ใช้เวลา 913 ms
- log ที่ระบบบันทึก:

```text
[external-api] attempt 1/3 failed: UPSTREAM_5XX (500)
[external-api] attempt 2/3 failed: UPSTREAM_5XX (500)
[external-api] attempt 3/3 failed: UPSTREAM_5XX (500)
```

### S4: ล้มสองครั้งแล้วฟื้น (retry ช่วยให้สำเร็จ)

- วิธีจำลอง: เซิร์ฟเวอร์จำลองตอบ 503 สองครั้งแรก แล้วตอบ 200
- ผลที่ได้: `{"source":"themealdb","degraded":false,"attempts":3}` ใช้เวลา 906 ms
- log ที่ระบบบันทึก:

```text
[external-api] attempt 1/3 failed: UPSTREAM_5XX (503)
[external-api] attempt 2/3 failed: UPSTREAM_5XX (503)
```

### S5: บริการภายนอกตอบช้ากว่า timeout

- วิธีจำลอง: เซิร์ฟเวอร์จำลองหน่วงตอบ 8 วินาที (timeout ของระบบ 3 วินาที)
- ผลที่ได้: `{"source":"fallback","degraded":true,"reason":"TIMEOUT","attempts":3}` ใช้เวลา 9906 ms
- log ที่ระบบบันทึก:

```text
[external-api] attempt 1/3 failed: TIMEOUT
[external-api] attempt 2/3 failed: TIMEOUT
[external-api] attempt 3/3 failed: TIMEOUT
```

### S6: บริการตอบ 404 (คำขอผิด ไม่ควรลองซ้ำ)

- วิธีจำลอง: เซิร์ฟเวอร์จำลองตอบ HTTP 404
- ผลที่ได้: `{"source":"fallback","degraded":true,"reason":"UPSTREAM_4XX","attempts":1}` ใช้เวลา 2 ms
- log ที่ระบบบันทึก:

```text
[external-api] attempt 1/3 failed: UPSTREAM_4XX (404)
```

### S7: บริการตอบ 200 แต่รูปแบบข้อมูลไม่ตรงที่คาด

- วิธีจำลอง: เซิร์ฟเวอร์จำลองตอบ {"unexpected": true}
- ผลที่ได้: `{"source":"fallback","degraded":true,"reason":"INVALID_RESPONSE","attempts":1}` ใช้เวลา 2 ms
- log ที่ระบบบันทึก:

```text
[external-api] unexpected response shape, using fallback
```

### S8: ผลตอบกลับจริงของ endpoint ตอนบริการภายนอกล่ม

```json
{
  "message": "ไม่สามารถเชื่อมต่อบริการแนะนำเมนูภายนอกได้ในขณะนี้ จึงแสดงรายการสำรองของระบบแทน",
  "data": {
    "source": "fallback",
    "degraded": true,
    "reason": "UPSTREAM_5XX",
    "attempts": 3,
    "ideas": [
      {
        "id": "local-1",
        "name": "ผัดกะเพราหมูสับไข่ดาว",
        "thumbnail": null
      },
      {
        "id": "local-2",
        "name": "ข้าวเหนียวมะม่วงกะทิสด",
        "thumbnail": null
      },
      {
        "id": "local-3",
        "name": "อกไก่ผัดพริกไทยดำคลีน",
        "thumbnail": null
      }
    ]
  }
}
```

## ข้อสรุป

มีสถานการณ์ที่ไม่ตรงกับที่ออกแบบไว้ ดูคอลัมน์ "ผ่าน" ในตารางสรุป

## ข้อจำกัดของการทดสอบ

- ไม่ได้ปิดอินเทอร์เน็ตของเครื่องจริง ใช้โฮสต์ที่ไม่มีอยู่ (S1) และพอร์ตที่ไม่มีบริการ (S2) เป็นตัวแทนของเครือข่ายที่ใช้ไม่ได้ ซึ่งผ่านเส้นทางโค้ดเดียวกัน (ไม่มี response จากปลายทาง)
- S3 ถึง S7 ใช้เซิร์ฟเวอร์จำลองในเครื่องแทนบริการจริง เพราะสั่งให้ TheMealDB ตอบ 500 หรือช้าไม่ได้
- ฐานข้อมูลที่ใช้ทดสอบ endpoint เป็นฐานข้อมูลจำลองในหน่วยความจำ (`src/db.js` โหมด NODE_ENV=test) ส่วนที่ทดสอบนี้ไม่เกี่ยวกับฐานข้อมูล
