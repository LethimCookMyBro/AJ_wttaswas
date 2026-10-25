const fs = require("fs");
const path = require("path");
const request = require("supertest");
const jestOpenAPI = require("jest-openapi").default;
const app = require("../src/index");
const jwt = require("jsonwebtoken");
const auth = (id) => `Bearer ${jwt.sign({}, process.env.JWT_SECRET, { algorithm: "HS256", subject: String(id), issuer: "recipe-api", audience: "recipe-web", expiresIn: "15m" })}`;

jestOpenAPI(path.join(__dirname, "..", "openapi.yaml"));

test("system identifies memory mode and three business contexts", async () => {
  const response = await request(app).get("/api/v1/system");
  expect(response.status).toBe(200);
  expect(response.body.data).toEqual({ architecture: "modular-monolith", storage: "in-memory", contexts: ["recipe-catalog", "community-reviews", "meal-discovery"] });
  expect(response).toSatisfyApiSpec();
});

test("frontend, script and stylesheet are served from the API origin", async () => {
  const page = await request(app).get("/");
  expect(page.status).toBe(200);
  expect(page.text).toContain('lang="th"');
  expect(page.text).toContain('id="recipe-form"');
  expect(page.headers["content-security-policy"]).toContain("script-src 'self'");
  for (const file of ["/app.js", "/styles.css"]) expect((await request(app).get(file)).status).toBe(200);
  expect(fs.readFileSync(path.join(__dirname, "../frontend/app.js"), "utf8")).not.toMatch(/innerHTML|outerHTML|insertAdjacentHTML|eval\(/);
});

test("presenter use case creates, reads and reviews a new recipe", async () => {
  const created = await request(app).post("/api/v1/recipes").set("Authorization", auth(1)).send({
    name: "ไข่เจียวต้นหอมสำหรับสาธิต", categoryId: 1,
    instructions: "ตีไข่ ใส่ต้นหอม ทอดให้สุก", cookTimeMinutes: 8, difficulty: "easy",
  });
  expect(created.status).toBe(201);
  const id = created.body.data.id;
  const details = await request(app).get(`/api/v1/recipes/${id}`);
  expect(details.body.data.name).toBe("ไข่เจียวต้นหอมสำหรับสาธิต");
  expect(details.body.data.ingredients).toEqual([]);
  const review = await request(app).post(`/api/v1/recipes/${id}/ratings`).set("Authorization", auth(2)).send({ ratingScore: 5, reviewComment: "ทำตามได้ง่าย" });
  expect(review.status).toBe(201);
  const ratings = await request(app).get(`/api/v1/recipes/${id}/ratings`);
  expect(ratings.body.data).toMatchObject({ ratingCount: 1, averageScore: 5 });
  const duplicate = await request(app).post(`/api/v1/recipes/${id}/ratings`).set("Authorization", auth(2)).send({ ratingScore: 4 });
  expect(duplicate.status).toBe(409);
  for (const response of [created, details, review, ratings, duplicate]) expect(response).toSatisfyApiSpec();
});
