const path = require("path");
const request = require("supertest");
const jestOpenAPI = require("jest-openapi").default;
const app = require("../src/index");
const jwt = require("jsonwebtoken");
const bearer = (id = 1) => `Bearer ${jwt.sign({}, process.env.JWT_SECRET, { algorithm: "HS256", subject: String(id), issuer: "recipe-api", audience: "recipe-web", expiresIn: "15m" })}`;
const { startFakeServer, json } = require("./helpers");

// ทุก response ต้องผ่านการตรวจกับ openapi.yaml จริง (status code, header, body schema)
jestOpenAPI(path.join(__dirname, "..", "openapi.yaml"));

const errorCode = (res) => res.body.error.code;

describe("Recipes", () => {
  test("GET /api/v1/recipes 200", async () => {
    const res = await request(app).get("/api/v1/recipes");
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(3);
    expect(res).toSatisfyApiSpec();
  });

  test("GET /api/v1/recipes/1 200 พร้อมวัตถุดิบ", async () => {
    const res = await request(app).get("/api/v1/recipes/1");
    expect(res.status).toBe(200);
    expect(res.body.data.ingredients).toHaveLength(5);
    expect(res).toSatisfyApiSpec();
  });

  test.each(["abc", "0", "-1", "1.5"])("GET /api/v1/recipes/%s 400 INVALID_ID", async (id) => {
    const res = await request(app).get(`/api/v1/recipes/${id}`);
    expect(res.status).toBe(400);
    expect(errorCode(res)).toBe("INVALID_ID");
    expect(res).toSatisfyApiSpec();
  });

  test("GET /api/v1/recipes/999 404", async () => {
    const res = await request(app).get("/api/v1/recipes/999");
    expect(res.status).toBe(404);
    expect(errorCode(res)).toBe("RECIPE_NOT_FOUND");
    expect(res).toSatisfyApiSpec();
  });

  test("POST /api/v1/recipes 201 และใช้ค่าเริ่มต้น", async () => {
    const res = await request(app).post("/api/v1/recipes").set("Authorization", bearer()).send({ name: "ต้มยำกุ้ง", categoryId: 1, authorId: 1, instructions: "ต้มน้ำ ใส่กุ้ง" });
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ id: expect.any(Number), cookTimeMinutes: 15, difficulty: "easy" });
    expect(res).toSatisfyApiSpec();
  });

  test.each([
    ["ขาดฟิลด์บังคับ", { name: "x" }],
    ["difficulty ไม่อยู่ใน enum", { name: "x", categoryId: 1, authorId: 1, instructions: "y", difficulty: "insane" }],
    ["categoryId ไม่ใช่จำนวนเต็ม", { name: "x", categoryId: "1", authorId: 1, instructions: "y" }],
    ["cookTimeMinutes ติดลบ", { name: "x", categoryId: 1, authorId: 1, instructions: "y", cookTimeMinutes: -5 }],
    ["name ยาวเกิน 150", { name: "x".repeat(151), categoryId: 1, authorId: 1, instructions: "y" }],
  ])("POST /api/v1/recipes 400: %s", async (_label, body) => {
    const res = await request(app).post("/api/v1/recipes").set("Authorization", bearer()).send(body);
    expect(res.status).toBe(400);
    expect(errorCode(res)).toBe("VALIDATION_ERROR");
    expect(res).toSatisfyApiSpec();
  });

  test("POST /api/v1/recipes 400 เมื่อ JSON ผิดรูปแบบ", async () => {
    const res = await request(app).post("/api/v1/recipes").set("Content-Type", "application/json").set("Authorization", bearer()).send("{bad json");
    expect(res.status).toBe(400);
    expect(errorCode(res)).toBe("INVALID_JSON");
    expect(res).toSatisfyApiSpec();
  });

  test("POST /api/v1/recipes 404 เมื่อไม่พบหมวดหมู่ (FK)", async () => {
    const res = await request(app).post("/api/v1/recipes").set("Authorization", bearer()).send({ name: "x", categoryId: 99, authorId: 1, instructions: "y" });
    expect(res.status).toBe(404);
    expect(errorCode(res)).toBe("REFERENCE_NOT_FOUND");
    expect(res).toSatisfyApiSpec();
  });

  test("POST /api/v1/recipes 413 เมื่อ body เกิน 64kb", async () => {
    const res = await request(app).post("/api/v1/recipes").set("Authorization", bearer()).send({ name: "x", categoryId: 1, authorId: 1, instructions: "y".repeat(66000) });
    expect(res.status).toBe(413);
    expect(errorCode(res)).toBe("PAYLOAD_TOO_LARGE");
    expect(res).toSatisfyApiSpec();
  });
});

describe("Categories and ingredients", () => {
  test("GET /api/v1/categories 200", async () => {
    const res = await request(app).get("/api/v1/categories");
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(3);
    expect(res).toSatisfyApiSpec();
  });

  test("GET /api/v1/ingredients 200", async () => {
    const res = await request(app).get("/api/v1/ingredients");
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(8);
    expect(res).toSatisfyApiSpec();
  });
});

describe("Recipe ingredients (UC-04)", () => {
  test("POST /api/v1/recipes/1/ingredients 201", async () => {
    const res = await request(app).post("/api/v1/recipes/1/ingredients").set("Authorization", bearer()).send({ ingredientId: 6, quantity: 50.5, unit: "ml" });
    expect(res.status).toBe(201);
    expect(res).toSatisfyApiSpec();
    const detail = await request(app).get("/api/v1/recipes/1");
    const added = detail.body.data.ingredients.find((i) => i.ingredient_id === 6);
    expect(added).toMatchObject({ quantity: 50.5, unit: "ml" });
  });

  test("POST ซ้ำ 409 (วัตถุดิบซ้ำในสูตรเดียว)", async () => {
    const res = await request(app).post("/api/v1/recipes/1/ingredients").set("Authorization", bearer()).send({ ingredientId: 6, quantity: 1, unit: "ml" });
    expect(res.status).toBe(409);
    expect(errorCode(res)).toBe("INGREDIENT_ALREADY_IN_RECIPE");
    expect(res).toSatisfyApiSpec();
  });

  test("POST 404 เมื่อไม่พบวัตถุดิบ", async () => {
    const res = await request(app).post("/api/v1/recipes/1/ingredients").set("Authorization", bearer()).send({ ingredientId: 99, quantity: 1, unit: "grams" });
    expect(res.status).toBe(404);
    expect(errorCode(res)).toBe("INGREDIENT_NOT_FOUND");
    expect(res).toSatisfyApiSpec();
  });

  test("POST 404 เมื่อไม่พบสูตรอาหาร", async () => {
    const res = await request(app).post("/api/v1/recipes/999/ingredients").set("Authorization", bearer()).send({ ingredientId: 1, quantity: 1, unit: "grams" });
    expect(res.status).toBe(404);
    expect(errorCode(res)).toBe("RECIPE_NOT_FOUND");
    expect(res).toSatisfyApiSpec();
  });

  test.each([
    ["quantity เป็น 0", { ingredientId: 1, quantity: 0, unit: "grams" }],
    ["quantity เป็น string", { ingredientId: 1, quantity: "5", unit: "grams" }],
    ["quantity น้อยกว่า 0.01", { ingredientId: 1, quantity: 0.001, unit: "grams" }],
    ["quantity เกิน 999999.99", { ingredientId: 1, quantity: 1000000, unit: "grams" }],
    ["ไม่มี unit", { ingredientId: 1, quantity: 5 }],
  ])("POST 400: %s", async (_label, body) => {
    const res = await request(app).post("/api/v1/recipes/2/ingredients").set("Authorization", bearer()).send(body);
    expect(res.status).toBe(400);
    expect(errorCode(res)).toBe("VALIDATION_ERROR");
    expect(res).toSatisfyApiSpec();
  });

  test("POST 400 เมื่อ id ไม่ถูกต้อง", async () => {
    const res = await request(app).post("/api/v1/recipes/abc/ingredients").set("Authorization", bearer()).send({ ingredientId: 1, quantity: 1, unit: "grams" });
    expect(res.status).toBe(400);
    expect(errorCode(res)).toBe("INVALID_ID");
    expect(res).toSatisfyApiSpec();
  });
});

describe("Ratings (UC-05)", () => {
  test("GET /api/v1/recipes/1/ratings 200 พร้อมค่าเฉลี่ย", async () => {
    const res = await request(app).get("/api/v1/recipes/1/ratings");
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ ratingCount: 2, averageScore: 4.5 });
    expect(res).toSatisfyApiSpec();
  });

  test("GET ของสูตรที่ยังไม่มีรีวิว: averageScore เป็น null", async () => {
    const res = await request(app).get("/api/v1/recipes/3/ratings");
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ ratingCount: 0, averageScore: null, ratings: [] });
    expect(res).toSatisfyApiSpec();
  });

  test("GET 404 / 400", async () => {
    const notFound = await request(app).get("/api/v1/recipes/999/ratings");
    expect(notFound.status).toBe(404);
    expect(notFound).toSatisfyApiSpec();
    const invalid = await request(app).get("/api/v1/recipes/x/ratings");
    expect(invalid.status).toBe(400);
    expect(invalid).toSatisfyApiSpec();
  });

  test("POST /api/v1/recipes/3/ratings 201 และค่าเฉลี่ยอัปเดต", async () => {
    const res = await request(app).post("/api/v1/recipes/3/ratings").set("Authorization", bearer()).send({ userId: 1, ratingScore: 5, reviewComment: "อร่อย" });
    expect(res.status).toBe(201);
    expect(res).toSatisfyApiSpec();
    const list = await request(app).get("/api/v1/recipes/3/ratings");
    expect(list.body.data).toMatchObject({ ratingCount: 1, averageScore: 5 });
  });

  test("POST 201 โดยไม่มี reviewComment (เก็บเป็น null)", async () => {
    const res = await request(app).post("/api/v1/recipes/2/ratings").set("Authorization", bearer(3)).send({ userId: 3, ratingScore: 3 });
    expect(res.status).toBe(201);
    expect(res.body.data.reviewComment).toBeNull();
    expect(res).toSatisfyApiSpec();
  });

  test("POST ซ้ำ 409 (ผู้ใช้หนึ่งคนรีวิวสูตรเดียวได้ครั้งเดียว)", async () => {
    const res = await request(app).post("/api/v1/recipes/3/ratings").set("Authorization", bearer()).send({ userId: 1, ratingScore: 4 });
    expect(res.status).toBe(409);
    expect(errorCode(res)).toBe("RATING_ALREADY_EXISTS");
    expect(res).toSatisfyApiSpec();
  });

  test.each([0, 6, 3.5, "5", null])("POST 400 เมื่อ ratingScore = %p", async (score) => {
    const res = await request(app).post("/api/v1/recipes/2/ratings").set("Authorization", bearer()).send({ userId: 1, ratingScore: score });
    expect(res.status).toBe(400);
    expect(errorCode(res)).toBe("VALIDATION_ERROR");
    expect(res).toSatisfyApiSpec();
  });

  test("POST 404 เมื่อไม่พบผู้ใช้หรือสูตร", async () => {
    const noUser = await request(app).post("/api/v1/recipes/2/ratings").set("Authorization", bearer()).send({ userId: 99, ratingScore: 4 });
    expect(noUser.status).toBe(403);
    expect(errorCode(noUser)).toBe("IDENTITY_MISMATCH");
    expect(noUser).toSatisfyApiSpec();
    const noRecipe = await request(app).post("/api/v1/recipes/999/ratings").set("Authorization", bearer()).send({ userId: 1, ratingScore: 4 });
    expect(noRecipe.status).toBe(404);
    expect(errorCode(noRecipe)).toBe("RECIPE_NOT_FOUND");
    expect(noRecipe).toSatisfyApiSpec();
  });
});

describe("External meal ideas (retry, timeout, fallback)", () => {
  const saved = { ...process.env };
  afterEach(() => {
    process.env = { ...saved };
  });

  test("บริการภายนอกปกติ: source = themealdb", async () => {
    const fake = await startFakeServer((req, res) => json(res, 200, { meals: [{ idMeal: "7", strMeal: "Chicken Rice", strMealThumb: "http://img/7.jpg" }] }));
    process.env.EXTERNAL_API_BASE_URL = fake.url;
    const res = await request(app).get("/api/v1/external/meal-ideas").query({ ingredient: "chicken breast" });
    await fake.close();

    expect(res.status).toBe(200);
    expect(res.headers["x-data-source"]).toBe("themealdb");
    expect(res.body.data).toMatchObject({ source: "themealdb", degraded: false, attempts: 1 });
    expect(fake.state.urls[0]).toBe("/filter.php?i=chicken_breast");
    expect(res).toSatisfyApiSpec();
  });

  test("บริการภายนอกล้มเหลวทุกครั้ง: ยังตอบ 200 พร้อม fallback ไม่ crash", async () => {
    const fake = await startFakeServer((req, res) => json(res, 500, {}));
    Object.assign(process.env, { EXTERNAL_API_BASE_URL: fake.url, EXTERNAL_API_BACKOFF_MS: "1", EXTERNAL_API_TIMEOUT_MS: "300" });
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
    const res = await request(app).get("/api/v1/external/meal-ideas").query({ ingredient: "chicken" });
    warn.mockRestore();
    await fake.close();

    expect(fake.state.hits).toBe(3);
    expect(res.status).toBe(200);
    expect(res.headers["x-data-source"]).toBe("fallback");
    expect(res.body.data).toMatchObject({ source: "fallback", degraded: true, reason: "UPSTREAM_5XX", attempts: 3 });
    expect(res.body.message).toMatch(/ไม่สามารถเชื่อมต่อ/);
    expect(res).toSatisfyApiSpec();
  });

  test.each([undefined, "", "ไก่", "a".repeat(51), "chicken&x=1"])("400 เมื่อ ingredient = %p", async (ingredient) => {
    const res = await request(app).get("/api/v1/external/meal-ideas").query(ingredient === undefined ? {} : { ingredient });
    expect(res.status).toBe(400);
    expect(errorCode(res)).toBe("VALIDATION_ERROR");
    expect(res).toSatisfyApiSpec();
  });
});

describe("Delete and unknown routes", () => {
  test("DELETE /api/v1/recipes/2 200 แล้วดึงซ้ำได้ 404 และรีวิวถูกลบตาม (CASCADE)", async () => {
    const res = await request(app).delete("/api/v1/recipes/2").set("Authorization", bearer());
    expect(res.status).toBe(200);
    expect(res).toSatisfyApiSpec();
    expect((await request(app).get("/api/v1/recipes/2")).status).toBe(404);
    expect((await request(app).get("/api/v1/recipes/2/ratings")).status).toBe(404);
  });

  test("DELETE สูตรที่ไม่มี 404 และ id ผิดรูปแบบ 400", async () => {
    const notFound = await request(app).delete("/api/v1/recipes/999").set("Authorization", bearer());
    expect(notFound.status).toBe(404);
    expect(notFound).toSatisfyApiSpec();
    const invalid = await request(app).delete("/api/v1/recipes/abc").set("Authorization", bearer());
    expect(invalid.status).toBe(400);
    expect(invalid).toSatisfyApiSpec();
  });

  test("เส้นทางที่ไม่มีอยู่ 404 ROUTE_NOT_FOUND", async () => {
    const res = await request(app).get("/api/v1/nope");
    expect(res.status).toBe(404);
    expect(errorCode(res)).toBe("ROUTE_NOT_FOUND");
  });
});
