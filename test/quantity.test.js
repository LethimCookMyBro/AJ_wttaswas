const request = require("supertest");
const jwt = require("jsonwebtoken");
const app = require("../src/index");
const bearer = () => `Bearer ${jwt.sign({}, process.env.JWT_SECRET, { algorithm: "HS256", subject: "1", issuer: "recipe-api", audience: "recipe-web", expiresIn: "15m" })}`;

test.each([0.015, 1.005])("quantity %s rejects precision that MySQL would silently round", async (quantity) => {
  const response = await request(app).post("/api/v1/recipes/1/ingredients").set("Authorization", bearer()).send({ ingredientId: 8, quantity, unit: "grams" });
  expect(response.status).toBe(400);
  expect(response.body.error.code).toBe("VALIDATION_ERROR");
});

test("two-decimal quantity 0.29 is accepted without floating-point multiplication rejection", async () => {
  const response = await request(app).post("/api/v1/recipes/1/ingredients").set("Authorization", bearer()).send({ ingredientId: 7, quantity: 0.29, unit: "grams" });
  expect(response.status).toBe(201);
  const detail = await request(app).get("/api/v1/recipes/1");
  expect(detail.body.data.ingredients.find(row => row.ingredient_id === 7).quantity).toBe(0.29);
});
