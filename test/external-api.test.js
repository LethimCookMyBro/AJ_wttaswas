const net = require("net");
const { getMealIdeas, FALLBACK_IDEAS } = require("../src/services/external-api");
const { startFakeServer, json, silentLogger } = require("./helpers");

const MEALS = { meals: [{ idMeal: "1", strMeal: "Chicken Curry", strMealThumb: "http://img/1.jpg" }, { idMeal: "2", strMeal: "Chicken Soup", strMealThumb: null }] };

// ลดเวลารอใน test: ไม่หลับจริง แต่เก็บค่า delay ที่ถูกขอไว้ตรวจ exponential backoff
function options(baseUrl, extra = {}) {
  const delays = [];
  return {
    delays,
    opts: { baseUrl, timeoutMs: 300, maxRetries: 2, backoffMs: 300, logger: silentLogger, sleep: async (ms) => { delays.push(ms); }, ...extra },
  };
}

async function closedPortUrl() {
  const server = net.createServer();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  await new Promise((resolve) => server.close(resolve));
  return `http://127.0.0.1:${port}`;
}

describe("getMealIdeas: สำเร็จ", () => {
  test("บริการภายนอกตอบปกติ เรียกครั้งเดียวและแปลงข้อมูลถูกต้อง", async () => {
    const fake = await startFakeServer((req, res) => json(res, 200, MEALS));
    const { opts, delays } = options(fake.url);
    const result = await getMealIdeas("chicken_breast", opts);
    await fake.close();

    expect(fake.state.hits).toBe(1);
    expect(fake.state.urls[0]).toBe("/filter.php?i=chicken_breast");
    expect(delays).toEqual([]);
    expect(result).toEqual({
      source: "themealdb", degraded: false, attempts: 1,
      ideas: [{ id: "1", name: "Chicken Curry", thumbnail: "http://img/1.jpg" }, { id: "2", name: "Chicken Soup", thumbnail: null }],
    });
  });

  test("ไม่พบเมนู (meals = null) ถือว่าสำเร็จ ได้รายการว่าง ไม่ใช่ fallback", async () => {
    const fake = await startFakeServer((req, res) => json(res, 200, { meals: null }));
    const result = await getMealIdeas("unobtainium", options(fake.url).opts);
    await fake.close();
    expect(result).toMatchObject({ source: "themealdb", degraded: false, ideas: [] });
  });
});

describe("getMealIdeas: retry", () => {
  test("5xx สองครั้งแล้วสำเร็จครั้งที่ 3 เรียกซ้ำตามจำนวนที่กำหนด และรอแบบ exponential backoff", async () => {
    const fake = await startFakeServer((req, res, hit) => (hit < 3 ? json(res, 503, { error: "busy" }) : json(res, 200, MEALS)));
    const { opts, delays } = options(fake.url);
    const result = await getMealIdeas("chicken", opts);
    await fake.close();

    expect(fake.state.hits).toBe(3);
    expect(delays).toEqual([300, 600]);
    expect(result).toMatchObject({ source: "themealdb", degraded: false, attempts: 3 });
  });

  test("5xx ตลอด: เรียกครบ 3 ครั้ง (ลองใหม่ 2 ครั้ง) แล้วใช้ fallback", async () => {
    const fake = await startFakeServer((req, res) => json(res, 500, { error: "boom" }));
    const { opts, delays } = options(fake.url);
    const result = await getMealIdeas("chicken", opts);
    await fake.close();

    expect(fake.state.hits).toBe(3);
    expect(delays).toEqual([300, 600]);
    expect(result).toMatchObject({ source: "fallback", degraded: true, reason: "UPSTREAM_5XX", attempts: 3, ideas: FALLBACK_IDEAS });
  });

  test("4xx ไม่ลองใหม่ (คำขอผิด ลองซ้ำก็ผิดเหมือนเดิม) ใช้ fallback ทันที", async () => {
    const fake = await startFakeServer((req, res) => json(res, 404, { error: "nope" }));
    const { opts, delays } = options(fake.url);
    const result = await getMealIdeas("chicken", opts);
    await fake.close();

    expect(fake.state.hits).toBe(1);
    expect(delays).toEqual([]);
    expect(result).toMatchObject({ source: "fallback", reason: "UPSTREAM_4XX", attempts: 1 });
  });

  test("network error (เชื่อมต่อไม่ได้) ลองใหม่ครบแล้วใช้ fallback", async () => {
    const { opts, delays } = options(await closedPortUrl());
    const result = await getMealIdeas("chicken", opts);
    expect(delays).toEqual([300, 600]);
    expect(result).toMatchObject({ source: "fallback", degraded: true, reason: "NETWORK_ERROR", attempts: 3 });
  });

  test("ตั้ง maxRetries = 0 แล้วเรียกครั้งเดียว", async () => {
    const fake = await startFakeServer((req, res) => json(res, 500, {}));
    const result = await getMealIdeas("chicken", options(fake.url, { maxRetries: 0 }).opts);
    await fake.close();
    expect(fake.state.hits).toBe(1);
    expect(result).toMatchObject({ source: "fallback", attempts: 1 });
  });
});

describe("getMealIdeas: timeout", () => {
  test("บริการตอบช้ากว่า timeout: ตัดการรอจริง ลองใหม่ แล้วใช้ fallback โดยไม่ค้าง", async () => {
    const pending = [];
    const fake = await startFakeServer((req, res) => { pending.push(setTimeout(() => json(res, 200, MEALS), 2000)); });
    const { opts } = options(fake.url, { timeoutMs: 150 });

    const startedAt = Date.now();
    const result = await getMealIdeas("chicken", opts);
    const elapsed = Date.now() - startedAt;
    pending.forEach(clearTimeout);
    await fake.close();

    expect(result).toMatchObject({ source: "fallback", reason: "TIMEOUT", attempts: 3 });
    expect(fake.state.hits).toBe(3);
    expect(elapsed).toBeGreaterThanOrEqual(3 * 150 - 50);
    expect(elapsed).toBeLessThan(1500); // ไม่รอจนบริการตอบ (2 วินาที)
  });

  test("ครั้งแรก timeout ครั้งที่สองสำเร็จ: ได้ข้อมูลจริง ไม่ใช่ fallback", async () => {
    const pending = [];
    const fake = await startFakeServer((req, res, hit) => {
      if (hit === 1) pending.push(setTimeout(() => json(res, 200, MEALS), 1000));
      else json(res, 200, MEALS);
    });
    const result = await getMealIdeas("chicken", options(fake.url, { timeoutMs: 150 }).opts);
    pending.forEach(clearTimeout);
    await fake.close();
    expect(result).toMatchObject({ source: "themealdb", degraded: false, attempts: 2 });
  });
});

describe("getMealIdeas: fallback", () => {
  test.each([null, {}, { idMeal: "1" }, { idMeal: 1, strMeal: "Soup" }, { idMeal: "1", strMeal: " " }, { idMeal: "", strMeal: "Soup" }, { idMeal: "1", strMeal: 4 }, { idMeal: "1", strMeal: "Soup", strMealThumb: {} }])("malformed meal item %j returns explicit fallback", async (meal) => {
    const fake = await startFakeServer((req, res) => json(res, 200, { meals: [meal] }));
    try {
      expect(await getMealIdeas("chicken", options(fake.url).opts)).toMatchObject({ source: "fallback", degraded: true, reason: "INVALID_RESPONSE", attempts: 1, ideas: FALLBACK_IDEAS });
    } finally { await fake.close(); }
  });
  test("ข้อมูลตอบกลับรูปแบบผิด ใช้ fallback โดยไม่ throw", async () => {
    const fake = await startFakeServer((req, res) => json(res, 200, { unexpected: true }));
    const result = await getMealIdeas("chicken", options(fake.url).opts);
    await fake.close();
    expect(result).toMatchObject({ source: "fallback", reason: "INVALID_RESPONSE" });
  });

  test("fallback ให้รายการสำรองและข้อความอธิบายที่ผู้ใช้อ่านได้", async () => {
    const result = await getMealIdeas("chicken", options(await closedPortUrl()).opts);
    expect(result.ideas.length).toBeGreaterThan(0);
    expect(result.message).toMatch(/ไม่สามารถเชื่อมต่อ/);
  });
});
