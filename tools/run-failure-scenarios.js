// รันสถานการณ์ที่บริการภายนอกล้มเหลวกับโค้ดจริง (src/services/external-api.js + endpoint ใน src/index.js)
// แล้วเขียนผลลัพธ์จริงลง failure-scenario-results.md   รัน: npm run failure-scenarios
// ใช้ค่า default ของระบบ (timeout 3000ms, retry 2 ครั้ง, backoff 300ms/600ms) ไม่ได้ย่นเวลาเพื่อให้ทดสอบเร็วขึ้น
process.env.NODE_ENV = "test";
process.env.JWT_SECRET = require("crypto").randomBytes(32).toString("hex");
const fs = require("fs");
const http = require("http");
const net = require("net");
const os = require("os");
const path = require("path");
const request = require("supertest");
const app = require("../src/index");
const { getMealIdeas, DEFAULTS } = require("../src/services/external-api");

const OUT = path.join(__dirname, "..", "failure-scenario-results.md");

function fakeServer(handler) {
  const state = { hits: 0 };
  const server = http.createServer((req, res) => { state.hits += 1; handler(req, res, state.hits); });
  return new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve({
    url: `http://127.0.0.1:${server.address().port}`, state,
    close: () => { server.closeAllConnections(); return new Promise((done) => server.close(done)); },
  })));
}
const send = (res, status, body) => { res.writeHead(status, { "Content-Type": "application/json" }); res.end(JSON.stringify(body)); };
async function closedPortUrl() {
  const s = net.createServer();
  await new Promise((r) => s.listen(0, "127.0.0.1", r));
  const { port } = s.address();
  await new Promise((r) => s.close(r));
  return `http://127.0.0.1:${port}`;
}

async function measure(baseUrl) {
  const log = [];
  const logger = { warn: (m) => log.push(m), error: (m) => log.push(m), log: () => {} };
  const startedAt = Date.now();
  const result = await getMealIdeas("chicken_breast", { baseUrl, logger });
  return { result, log, ms: Date.now() - startedAt };
}

const MEAL = { meals: [{ idMeal: "1", strMeal: "Chicken Curry", strMealThumb: "http://img/1.jpg" }] };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const scenarios = [
  {
    id: "S1", name: "เรียก URL ที่ไม่มีอยู่จริง (DNS ไม่พบโฮสต์)", how: "ตั้ง baseUrl เป็น http://recipe-api-unreachable.invalid",
    expect: { source: "fallback", reason: "NETWORK_ERROR", attempts: 3, minMs: 900, maxMs: 4000 },
    run: () => measure("http://recipe-api-unreachable.invalid"),
  },
  {
    id: "S2", name: "เชื่อมต่อไม่ได้ (พอร์ตปลายทางปิด จำลองเครือข่ายใช้ไม่ได้)", how: "ชี้ไปที่พอร์ต localhost ที่ไม่มีบริการรับ (ECONNREFUSED)",
    expect: { source: "fallback", reason: "NETWORK_ERROR", attempts: 3, minMs: 900, maxMs: 4000 },
    run: async () => measure(await closedPortUrl()),
  },
  {
    id: "S3", name: "บริการภายนอกตอบ 500 ทุกครั้ง", how: "เซิร์ฟเวอร์จำลองตอบ HTTP 500 ทุก request",
    expect: { source: "fallback", reason: "UPSTREAM_5XX", attempts: 3, hits: 3, minMs: 900, maxMs: 4000 },
    run: async () => { const s = await fakeServer((q, r) => send(r, 500, { error: "boom" })); const m = await measure(s.url); m.hits = s.state.hits; await s.close(); return m; },
  },
  {
    id: "S4", name: "ล้มสองครั้งแล้วฟื้น (retry ช่วยให้สำเร็จ)", how: "เซิร์ฟเวอร์จำลองตอบ 503 สองครั้งแรก แล้วตอบ 200",
    expect: { source: "themealdb", reason: undefined, attempts: 3, hits: 3, minMs: 900, maxMs: 4000 },
    run: async () => { const s = await fakeServer((q, r, hit) => (hit < 3 ? send(r, 503, {}) : send(r, 200, MEAL))); const m = await measure(s.url); m.hits = s.state.hits; await s.close(); return m; },
  },
  {
    id: "S5", name: "บริการภายนอกตอบช้ากว่า timeout", how: "เซิร์ฟเวอร์จำลองหน่วงตอบ 8 วินาที (timeout ของระบบ 3 วินาที)",
    expect: { source: "fallback", reason: "TIMEOUT", attempts: 3, hits: 3, minMs: 9000, maxMs: 12000 },
    run: async () => {
      const timers = [];
      const s = await fakeServer((q, r) => { timers.push(setTimeout(() => send(r, 200, MEAL), 8000)); });
      const m = await measure(s.url);
      m.hits = s.state.hits; timers.forEach(clearTimeout); await s.close(); return m;
    },
  },
  {
    id: "S6", name: "บริการตอบ 404 (คำขอผิด ไม่ควรลองซ้ำ)", how: "เซิร์ฟเวอร์จำลองตอบ HTTP 404",
    expect: { source: "fallback", reason: "UPSTREAM_4XX", attempts: 1, hits: 1, minMs: 0, maxMs: 1000 },
    run: async () => { const s = await fakeServer((q, r) => send(r, 404, {})); const m = await measure(s.url); m.hits = s.state.hits; await s.close(); return m; },
  },
  {
    id: "S7", name: "บริการตอบ 200 แต่รูปแบบข้อมูลไม่ตรงที่คาด", how: "เซิร์ฟเวอร์จำลองตอบ {\"unexpected\": true}",
    expect: { source: "fallback", reason: "INVALID_RESPONSE", attempts: 1, hits: 1, minMs: 0, maxMs: 1000 },
    run: async () => { const s = await fakeServer((q, r) => send(r, 200, { unexpected: true })); const m = await measure(s.url); m.hits = s.state.hits; await s.close(); return m; },
  },
];

(async () => {
  const rows = [];
  const quietWarn = console.warn;

  // S0: บริการจริงปกติ (ถ้าต่ออินเทอร์เน็ตได้)
  const baseline = await measure(DEFAULTS.baseUrl);
  rows.push({
    id: "S0", name: "บริการจริง TheMealDB ปกติ (baseline)", how: "เรียก https://www.themealdb.com จริง",
    expectText: "source = themealdb, attempts = 1", result: baseline.result, log: baseline.log, ms: baseline.ms,
    pass: baseline.result.source === "themealdb" && baseline.result.attempts === 1,
    note: baseline.result.source === "themealdb" ? "" : "ต่ออินเทอร์เน็ตหรือเรียก TheMealDB ไม่ได้ในขณะทดสอบ",
  });

  for (const s of scenarios) {
    process.stdout.write(`${s.id} ${s.name} ... `);
    const out = await s.run();
    const e = s.expect;
    const pass = out.result.source === e.source && out.result.reason === e.reason && out.result.attempts === e.attempts &&
      (e.hits === undefined || out.hits === e.hits) && out.ms >= e.minMs && out.ms <= e.maxMs;
    console.log(`${pass ? "PASS" : "FAIL"} (${out.ms} ms)`);
    rows.push({
      id: s.id, name: s.name, how: s.how, result: out.result, log: out.log, ms: out.ms, hits: out.hits, pass,
      expectText: `source = ${e.source}${e.reason ? `, reason = ${e.reason}` : ""}, attempts = ${e.attempts}${e.hits ? `, เซิร์ฟเวอร์ถูกเรียก ${e.hits} ครั้ง` : ""}, ใช้เวลา ${e.minMs}-${e.maxMs} ms`,
    });
  }

  // S8: ผ่าน HTTP endpoint จริงของระบบ ตอนบริการภายนอกล่ม ระบบต้องตอบผู้ใช้ได้และยังทำงานอื่นต่อได้
  process.env.EXTERNAL_API_BASE_URL = "http://recipe-api-unreachable.invalid";
  console.warn = () => {};
  const startedAt = Date.now();
  const api = await request(app).get("/api/v1/external/meal-ideas").query({ ingredient: "chicken_breast" });
  const apiMs = Date.now() - startedAt;
  const after = await request(app).get("/api/v1/recipes");
  console.warn = quietWarn;
  delete process.env.EXTERNAL_API_BASE_URL;
  const s8pass = api.status === 200 && api.headers["x-data-source"] === "fallback" && api.body.data.degraded === true && after.status === 200;
  console.log(`S8 endpoint ตอนบริการภายนอกล่ม ... ${s8pass ? "PASS" : "FAIL"} (${apiMs} ms)`);

  const lines = [];
  const push = (s = "") => lines.push(s);
  push("# ผลการทดสอบ Failure Scenario ของการเชื่อมต่อ API ภายนอก");
  push();
  push(`รหัสนิสิต 67160003 · Pno 4 · ระบบสูตรอาหาร · บริการภายนอก: TheMealDB (\`GET /api/v1/external/meal-ideas\`)`);
  push();
  push(`ไฟล์นี้สร้างโดย \`npm run failure-scenarios\` (\`tools/run-failure-scenarios.js\`) จากการรันโค้ดจริงของ \`src/services/external-api.js\` เมื่อ ${new Date().toISOString()} บน Node ${process.version} (${os.platform()}) ตัวเลขเวลาและจำนวนครั้งทั้งหมดมาจากการรันครั้งนั้น ไม่ได้เขียนขึ้นเอง`);
  push();
  push("## ค่าที่ออกแบบไว้");
  push();
  push("| กลไก | ค่า |");
  push("| --- | --- |");
  push(`| Timeout | ${DEFAULTS.timeoutMs} ms ต่อครั้ง |`);
  push(`| Retry | ${DEFAULTS.maxRetries} ครั้ง (รวมครั้งแรกเป็น ${DEFAULTS.maxRetries + 1} ครั้ง) เฉพาะ network error, timeout, 5xx |`);
  push(`| Backoff | exponential: ${DEFAULTS.backoffMs} ms แล้ว ${DEFAULTS.backoffMs * 2} ms |`);
  push("| ไม่ลองซ้ำ | 4xx และข้อมูลตอบกลับรูปแบบผิด |");
  push("| Fallback | ตอบ 200 พร้อม `source = fallback`, `degraded = true` และรายการสำรอง 3 เมนูของระบบ แทนการตอบ error หรือค้าง |");
  push();
  push(`เวลาสูงสุดที่ผู้ใช้ต้องรอเมื่อบริการภายนอกล่มหรือช้าทุกครั้ง = ${DEFAULTS.maxRetries + 1} × ${DEFAULTS.timeoutMs} + ${DEFAULTS.backoffMs} + ${DEFAULTS.backoffMs * 2} = ${(DEFAULTS.maxRetries + 1) * DEFAULTS.timeoutMs + DEFAULTS.backoffMs * 3} ms`);
  push();
  push("## สรุปผล");
  push();
  push("| # | สถานการณ์ | ผลที่คาดไว้ | ผลที่ได้จริง | ผ่าน |");
  push("| --- | --- | --- | --- | --- |");
  for (const r of rows) {
    const actual = `source = ${r.result.source}${r.result.reason ? `, reason = ${r.result.reason}` : ""}, attempts = ${r.result.attempts}${r.hits !== undefined ? `, เซิร์ฟเวอร์ถูกเรียก ${r.hits} ครั้ง` : ""}, ใช้เวลา ${r.ms} ms`;
    push(`| ${r.id} | ${r.name} | ${r.expectText} | ${actual} | ${r.pass ? "ผ่าน" : "ไม่ผ่าน"} |`);
  }
  push(`| S8 | เรียกผ่าน endpoint จริงตอนบริการภายนอกล่ม | HTTP 200, header X-Data-Source = fallback, degraded = true และ endpoint อื่นยังตอบปกติ | HTTP ${api.status}, X-Data-Source = ${api.headers["x-data-source"]}, degraded = ${api.body.data?.degraded}, attempts = ${api.body.data?.attempts}, ใช้เวลา ${apiMs} ms, หลังจากนั้น GET /api/v1/recipes ตอบ ${after.status} | ${s8pass ? "ผ่าน" : "ไม่ผ่าน"} |`);
  push();
  push("## รายละเอียดแต่ละสถานการณ์");
  for (const r of rows) {
    push();
    push(`### ${r.id}: ${r.name}`);
    push();
    push(`- วิธีจำลอง: ${r.how}`);
    push(`- ผลที่ได้: \`${JSON.stringify({ source: r.result.source, degraded: r.result.degraded, reason: r.result.reason, attempts: r.result.attempts })}\` ใช้เวลา ${r.ms} ms`);
    if (r.note) push(`- หมายเหตุ: ${r.note}`);
    push("- log ที่ระบบบันทึก:");
    push();
    push("```text");
    push(r.log.length ? r.log.join("\n") : "(ไม่มี attempt ที่ล้มเหลว)");
    push("```");
  }
  push();
  push("### S8: ผลตอบกลับจริงของ endpoint ตอนบริการภายนอกล่ม");
  push();
  push("```json");
  push(JSON.stringify(api.body, null, 2));
  push("```");
  push();
  push("## ข้อสรุป");
  push();
  const allPass = rows.every((r) => r.pass) && s8pass;
  push(allPass
    ? "ทุกสถานการณ์ตอบสนองตามที่ออกแบบไว้: ลองใหม่ตามจำนวนที่กำหนดเฉพาะความผิดพลาดที่ลองซ้ำแล้วมีโอกาสสำเร็จ ตัดการรอเมื่อเกิน timeout และเมื่อล้มเหลวครบทุกครั้งผู้ใช้ได้รับรายการสำรองพร้อมข้อความอธิบาย ระบบไม่ crash และ endpoint อื่นยังทำงานต่อได้"
    : "มีสถานการณ์ที่ไม่ตรงกับที่ออกแบบไว้ ดูคอลัมน์ \"ผ่าน\" ในตารางสรุป");
  push();
  push("## ข้อจำกัดของการทดสอบ");
  push();
  push("- ไม่ได้ปิดอินเทอร์เน็ตของเครื่องจริง ใช้โฮสต์ที่ไม่มีอยู่ (S1) และพอร์ตที่ไม่มีบริการ (S2) เป็นตัวแทนของเครือข่ายที่ใช้ไม่ได้ ซึ่งผ่านเส้นทางโค้ดเดียวกัน (ไม่มี response จากปลายทาง)");
  push("- S3 ถึง S7 ใช้เซิร์ฟเวอร์จำลองในเครื่องแทนบริการจริง เพราะสั่งให้ TheMealDB ตอบ 500 หรือช้าไม่ได้");
  push("- ฐานข้อมูลที่ใช้ทดสอบ endpoint เป็นฐานข้อมูลจำลองในหน่วยความจำ (`src/db.js` โหมด NODE_ENV=test) ส่วนที่ทดสอบนี้ไม่เกี่ยวกับฐานข้อมูล");
  fs.writeFileSync(OUT, lines.join("\n") + "\n");
  console.log(`\nwrote ${path.relative(process.cwd(), OUT)} (${allPass ? "all passed" : "SOME FAILED"})`);
  process.exit(allPass ? 0 : 1);
})().catch((error) => { console.error(error); process.exit(1); });
