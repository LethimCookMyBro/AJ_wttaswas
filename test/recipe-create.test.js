const path = require("node:path");
const request = require("supertest");
const jwt = require("jsonwebtoken");
const jestOpenAPI = require("jest-openapi").default;
const app = require("../src/index");
const pool = require("../src/db");
jestOpenAPI(path.join(__dirname, "..", "openapi.yaml"));
const auth = (id = 1) => `Bearer ${jwt.sign({}, process.env.JWT_SECRET, { algorithm: "HS256", subject: String(id), issuer: "recipe-api", audience: "recipe-web", expiresIn: "15m" })}`;
const recipe = { name: "Atomic test recipe", categoryId: 1, instructions: "Combine and cook." };
const line = { ingredientId: 1, quantity: 0.29, unit: "grams" };
const create = (body, id = 1) => request(app).post("/api/v1/recipes").set("Authorization", auth(id)).send(body);
const count = async () => (await request(app).get("/api/v1/recipes")).body.pagination.total;

test("detail projects author_id in actual SQL and mock; list does not leak detail fields", async () => {
  const query = jest.spyOn(pool, "query");
  try {
    const detail = await request(app).get("/api/v1/recipes/1");
    expect(detail.body.data.author_id).toBe(1);
    expect(query.mock.calls.find(([sql]) => sql.includes("WHERE r.id = ?"))[0]).toMatch(/SELECT[^;]*r\.author_id/);
    expect(detail).toSatisfyApiSpec();
    const list = await request(app).get("/api/v1/recipes");
    expect(list.body.data[0]).not.toHaveProperty("instructions");
    expect(list.body.data[0]).not.toHaveProperty("author_id");
  } finally { query.mockRestore(); }
});

test.each([undefined, []])("legacy create with %j ingredients remains compatible", async (ingredients) => {
  const getConnection = jest.spyOn(pool, "getConnection");
  try {
    const response = await create({ ...recipe, ingredients });
    expect(response.status).toBe(201);
    expect(response).toSatisfyApiSpec();
    expect(getConnection).not.toHaveBeenCalled();
  } finally { getConnection.mockRestore(); }
});

test("create commits recipe and all ingredient lines on one connection", async () => {
  const response = await create({ ...recipe, ingredients: [line, { ingredientId: 2, quantity: 2.5, unit: "grams" }] });
  expect(response.status).toBe(201);
  expect(response).toSatisfyApiSpec();
  const detail = await request(app).get(`/api/v1/recipes/${response.body.data.id}`);
  expect(detail.body.data.author_id).toBe(1);
  expect(detail.body.data.ingredients).toEqual([
    expect.objectContaining({ ingredient_id: 1, quantity: 0.29, unit: "grams" }),
    expect.objectContaining({ ingredient_id: 2, quantity: 2.5, unit: "grams" }),
  ]);
  expect(detail).toSatisfyApiSpec();
});

test.each([null, {}, [null], [line, line], [{ ...line, quantity: 0.015 }], [{ ...line, quantity: 0 }], [{ ...line, ingredientId: "1" }], [{ ...line, unit: " " }], Array.from({ length: 51 }, (_, i) => ({ ...line, ingredientId: i + 1 }))])("reject invalid initial ingredients before acquiring a connection: %j", async (ingredients) => {
  const getConnection = jest.spyOn(pool, "getConnection");
  const before = await count();
  try {
    const response = await create({ ...recipe, ingredients });
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
    expect(getConnection).not.toHaveBeenCalled();
    expect(await count()).toBe(before);
    expect(response).toSatisfyApiSpec();
  } finally { getConnection.mockRestore(); }
});

test("unknown second ingredient rolls back the recipe and earlier ingredient in the mock", async () => {
  const before = await count();
  const response = await create({ ...recipe, ingredients: [line, { ...line, ingredientId: 99999 }] });
  expect(response.status).toBe(404);
  expect(response.body.error.code).toBe("REFERENCE_NOT_FOUND");
  expect(response).toSatisfyApiSpec();
  expect(await count()).toBe(before);
});

test("rollback of one concurrent create cannot erase the successful create in the mock", async () => {
  const before = await count();
  const [bad, good] = await Promise.all([
    create({ ...recipe, ingredients: [line, { ...line, ingredientId: 99999 }] }),
    create({ ...recipe, name: "Successful concurrent recipe", ingredients: [line] }),
  ]);
  expect(bad.status).toBe(404);
  expect(good.status).toBe(201);
  expect(await count()).toBe(before + 1);
  const detail = await request(app).get(`/api/v1/recipes/${good.body.data.id}`);
  expect(detail.body.data.ingredients).toHaveLength(1);
});

test.each(["begin", "insert", "commit"])("%s failure releases the acquired connection and hides internal errors", async (stage) => {
  const failure = new Error("private connection details");
  const connection = {
    beginTransaction: jest.fn().mockResolvedValue(),
    query: jest.fn().mockResolvedValue([{ insertId: 900 }]),
    commit: jest.fn().mockResolvedValue(),
    rollback: jest.fn().mockResolvedValue(),
    release: jest.fn(),
  };
  if (stage === "begin") connection.beginTransaction.mockRejectedValue(failure);
  if (stage === "insert") connection.query.mockRejectedValue(failure);
  if (stage === "commit") connection.commit.mockRejectedValue(failure);
  const spy = jest.spyOn(pool, "getConnection").mockResolvedValue(connection);
  const log = jest.spyOn(console, "error").mockImplementation(() => {});
  try {
    const response = await create({ ...recipe, ingredients: [line] });
    expect(response.status).toBe(500);
    expect(response.text).not.toContain("private");
    expect(connection.release).toHaveBeenCalledTimes(1);
    expect(connection.rollback).toHaveBeenCalledTimes(stage === "begin" ? 0 : 1);
  } finally { spy.mockRestore(); log.mockRestore(); }
});

test("member cannot use atomic create to bypass writer role", async () => {
  const before = await count();
  expect((await create({ ...recipe, ingredients: [line] }, 2)).status).toBe(403);
  expect(await count()).toBe(before);
});

test("mock health succeeds without a query stub", async () => {
  expect((await request(app).get("/healthz")).status).toBe(200);
});

test("failed rollback destroys the connection instead of returning an open transaction to the pool", async () => {
  const connection = {
    beginTransaction: jest.fn().mockResolvedValue(),
    query: jest.fn().mockRejectedValue(new Error("insert failed")),
    rollback: jest.fn().mockRejectedValue(new Error("rollback failed")),
    release: jest.fn(), destroy: jest.fn(),
  };
  const spy = jest.spyOn(pool, "getConnection").mockResolvedValue(connection);
  const log = jest.spyOn(console, "error").mockImplementation(() => {});
  try {
    expect((await create({ ...recipe, ingredients: [line] })).status).toBe(500);
    expect(connection.destroy).toHaveBeenCalledTimes(1);
    expect(connection.release).not.toHaveBeenCalled();
  } finally { spy.mockRestore(); log.mockRestore(); }
});
