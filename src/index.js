require("dotenv").config();
const fs = require("fs");
const path = require("path");
const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const morgan = require("morgan");
const swaggerUi = require("swagger-ui-express");
const YAML = require("yaml");
const pool = require("./db");
const jwt = require("jsonwebtoken");
const { rateLimit } = require("express-rate-limit");
const { verifyPassword } = require("./password");
const JWT_SECRET = process.env.JWT_SECRET;
if (typeof JWT_SECRET !== "string" || JWT_SECRET.length < 32) throw new Error("JWT_SECRET must contain at least 32 characters");
const { getMealIdeas } = require("./services/external-api");

const app = express();
const PORT = process.env.PORT || 3000;
const proxyHops = process.env.TRUST_PROXY_HOPS || "0";
if (!["0", "1", "2"].includes(proxyHops)) throw new Error("TRUST_PROXY_HOPS must be 0, 1 or 2");
app.set("trust proxy", Number(proxyHops));

// Security and logging middleware
app.use(helmet());
app.use(
  cors({
    origin: process.env.ALLOWED_ORIGIN || "http://localhost:3001",
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
  })
);
if (process.env.NODE_ENV !== "test") {
  app.use(morgan("dev"));
}
app.use(express.json({ limit: "64kb" }));
app.use("/api/v1", rateLimit({ windowMs: 60000, limit: 200, standardHeaders: "draft-8", legacyHeaders: false, message: { error: { code: "RATE_LIMITED", message: "Too many requests" } } }));
app.use(express.static(path.join(__dirname, "..", "frontend")));
app.disable("x-powered-by");

app.get("/healthz", rateLimit({ windowMs: 60000, limit: 60, standardHeaders: "draft-8", legacyHeaders: false, message: { error: { code: "RATE_LIMITED", message: "Too many health checks" } } }), async (req, res) => {
  res.set("Cache-Control", "no-store");
  try {
    await pool.query("SELECT 1");
    res.json({ status: "ok" });
  } catch {
    res.status(503).json({ status: "unavailable" });
  }
});

app.get("/api/v1/system", (req, res) => {
  res.json({
    message: "สถานะระบบสูตรอาหาร",
    data: {
      architecture: "modular-monolith",
      storage: process.env.NODE_ENV === "test" && process.env.USE_REAL_DB !== "1" ? "in-memory" : "mysql",
      contexts: ["recipe-catalog", "community-reviews", "meal-discovery"],
    },
  });
});

// -------------------------------------------------------------
// API Documentation (Phase 2, Part 1)
// Swagger UI อ่านจากไฟล์ openapi.yaml ตัวเดียวกับที่ส่งงาน ไม่ได้เขียนแยกต่างหาก
// -------------------------------------------------------------
const openapiPath = path.join(__dirname, "..", "openapi.yaml");
const openapiText = fs.readFileSync(openapiPath, "utf8");
app.get("/openapi.yaml", (req, res) => res.type("text/yaml").send(openapiText));
const openapiSpec = YAML.parse(openapiText);
const swaggerOptions = { customSiteTitle: "ครัวแบ่งปัน | ทดลอง API", customCssUrl: "/api-guide.css", swaggerOptions: { docExpansion: "list", defaultModelsExpandDepth: -1, persistAuthorization: false, deepLinking: true } };
app.use("/api-docs/reference", swaggerUi.serveFiles(openapiSpec, swaggerOptions), swaggerUi.setup(openapiSpec, swaggerOptions));
app.get("/api-docs/start", (req, res) => res.sendFile(path.join(__dirname, "..", "frontend", "api-start.html")));
app.get("/api-docs", (req, res) => res.sendFile(path.join(__dirname, "..", "frontend", "api-guide.html")));

// -------------------------------------------------------------
// Helpers
// -------------------------------------------------------------
const errorBody = (code, message) => ({ error: { code, message } });
const parseId = (value) => (/^[1-9]\d{0,9}$/.test(String(value)) ? Number(value) : null);
const isPositiveInt = (value) => Number.isInteger(value) && value > 0;
const isText = (value, max) => typeof value === "string" && value.trim().length > 0 && value.length <= max;
const isIngredient = (value) => value && typeof value === "object" && !Array.isArray(value) &&
  isPositiveInt(value.ingredientId) && typeof value.quantity === "number" &&
  value.quantity >= 0.01 && value.quantity <= 999999.99 &&
  Number(value.quantity.toFixed(2)) === value.quantity && isText(value.unit, 50);
const DIFFICULTIES = ["easy", "medium", "hard"];

const loginLimiter = rateLimit({ windowMs: 60000, limit: 10, standardHeaders: "draft-8", legacyHeaders: false, message: errorBody("RATE_LIMITED", "Too many login attempts") });
app.post("/api/v1/auth/login", loginLimiter, async (req, res, next) => {
  const { username, password } = req.body || {};
  if (!isText(username, 50) || !isText(password, 256)) return res.status(400).json(errorBody("VALIDATION_ERROR", "username and password are required"));
  try {
    const [rows] = await pool.query("SELECT id, username, role, password_hash FROM users WHERE username = ?", [username]);
    const user = rows[0];
    if (!user || !(await verifyPassword(password, user.password_hash))) return res.status(401).json(errorBody("INVALID_CREDENTIALS", "Invalid username or password"));
    const token = jwt.sign({}, JWT_SECRET, { algorithm: "HS256", subject: String(user.id), issuer: "recipe-api", audience: "recipe-web", expiresIn: "15m" });
    res.set("Cache-Control", "no-store").json({ message: "เข้าสู่ระบบสำเร็จ", data: { token, user: { id: user.id, username: user.username, role: user.role } } });
  } catch (err) { next(err); }
});

async function authenticate(req, res, next) {
  const match = /^Bearer ([^ ]+)$/.exec(req.get("Authorization") || "");
  if (!match) return res.status(401).json(errorBody("UNAUTHORIZED", "Bearer token required"));
  let claims;
  try { claims = jwt.verify(match[1], JWT_SECRET, { algorithms: ["HS256"], issuer: "recipe-api", audience: "recipe-web" }); }
  catch { return res.status(401).json(errorBody("INVALID_TOKEN", "Invalid or expired token")); }
  if (typeof claims.sub !== "string" || parseId(claims.sub) === null) return res.status(401).json(errorBody("INVALID_TOKEN", "Invalid subject"));
  try {
    const [rows] = await pool.query("SELECT id, username, role FROM users WHERE id = ?", [Number(claims.sub)]);
    if (!rows[0]) return res.status(401).json(errorBody("INVALID_TOKEN", "User no longer exists"));
    req.user = rows[0];
    next();
  } catch (err) { next(err); }
}

function recipeWriter(req, res, next) {
  if (!["chef", "admin"].includes(req.user.role)) return res.status(403).json(errorBody("FORBIDDEN", "Chef or admin required"));
  next();
}

async function ownsRecipe(req, res, next) {
  const id = parseId(req.params.id);
  if (id === null) return res.status(400).json(errorBody("INVALID_ID", "id ต้องเป็นจำนวนเต็มบวก"));
  try {
    const [rows] = await pool.query("SELECT id, author_id FROM recipes WHERE id = ?", [id]);
    if (!rows[0]) return res.status(404).json(errorBody("RECIPE_NOT_FOUND", "ไม่พบข้อมูลสูตรอาหาร"));
    if (req.user.role !== "admin" && rows[0].author_id !== req.user.id) return res.status(403).json(errorBody("FORBIDDEN", "Recipe owner or admin required"));
    next();
  } catch (err) { next(err); }
}
const categoryCache = { rows: null, expires: 0 };

// -------------------------------------------------------------
// Core API Endpoints (Project Phase 1: Recipes & Categories)
// -------------------------------------------------------------

// GET /api/v1/recipes - List all recipes with category names
app.get("/api/v1/recipes", async (req, res, next) => {
  try {
    const allowed = ["page", "limit", "categoryId", "difficulty", "sort", "search"];
    const { page = "1", limit = "10", categoryId, difficulty, sort = "id_asc", search } = req.query;
    const sorts = { id_asc: "r.id ASC", id_desc: "r.id DESC", name_asc: "r.name ASC", cook_time_asc: "r.cook_time_minutes ASC" };
    if (Object.keys(req.query).some((key) => !allowed.includes(key)) ||
        !/^[1-9]\d{0,4}$/.test(String(page)) || !/^[1-9]\d?$|^100$/.test(String(limit)) ||
        (categoryId !== undefined && (typeof categoryId !== "string" || parseId(categoryId) === null)) ||
        (difficulty !== undefined && !DIFFICULTIES.includes(difficulty)) || typeof sort !== "string" || !Object.hasOwn(sorts, sort) ||
        typeof page !== "string" || typeof limit !== "string" ||
        (search !== undefined && (typeof search !== "string" || search.trim().length > 150))) {
      return res.status(400).json(errorBody("VALIDATION_ERROR", "Invalid pagination, filter, or sort"));
    }
    const where = [], params = [];
    if (categoryId !== undefined) { where.push("r.category_id = ?"); params.push(Number(categoryId)); }
    if (difficulty !== undefined) { where.push("r.difficulty = ?"); params.push(difficulty); }
    if (search !== undefined && search.trim()) {
      where.push("r.name LIKE ? ESCAPE '!'");
      params.push(`%${search.trim().replace(/[!%_]/g, "!$&")}%`);
    }
    const filter = where.length ? ` WHERE ${where.join(" AND ")}` : "";
    const [[count]] = await pool.query(`SELECT COUNT(*) AS total FROM recipes r${filter}`, params);
    const sql = `SELECT r.id, r.name, r.cook_time_minutes, r.difficulty, r.category_id, c.name AS category_name
      FROM recipes r JOIN categories c ON r.category_id = c.id${filter} ORDER BY ${sorts[sort]}, r.id ASC LIMIT ? OFFSET ?`;
    const [rows] = await pool.query(sql, [...params, Number(limit), (Number(page) - 1) * Number(limit)]);
    res.status(200).json({ message: "ดึงรายการสูตรอาหารสำเร็จ", data: rows,
      pagination: { page: Number(page), limit: Number(limit), total: count.total, totalPages: Math.ceil(count.total / Number(limit)) } });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/recipes/:id - Get recipe details with ingredients
app.get("/api/v1/recipes/:id", async (req, res, next) => {
  try {
    const recipeId = parseId(req.params.id);
    if (recipeId === null) {
      return res.status(400).json(errorBody("INVALID_ID", "id ต้องเป็นจำนวนเต็มบวก"));
    }
    const sqlRecipe = `
      SELECT r.id, r.name, r.instructions, r.author_id, r.cook_time_minutes, r.difficulty, r.category_id, c.name AS category_name
      FROM recipes r
      JOIN categories c ON r.category_id = c.id
      WHERE r.id = ?
    `;
    const [recipeRows] = await pool.query(sqlRecipe, [recipeId]);

    if (recipeRows.length === 0) {
      return res.status(404).json(errorBody("RECIPE_NOT_FOUND", "ไม่พบข้อมูลสูตรอาหารที่ระบุ"));
    }

    const sqlIngredients = `
      SELECT ri.ingredient_id, i.name, ri.quantity, ri.unit
      FROM recipe_ingredients ri
      JOIN ingredients i ON ri.ingredient_id = i.id
      WHERE ri.recipe_id = ?
    `;
    const [ingredientRows] = await pool.query(sqlIngredients, [recipeId]);

    res.status(200).json({
      message: "ดึงข้อมูลสูตรอาหารสำเร็จ",
      data: { ...recipeRows[0], ingredients: ingredientRows },
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/recipes - Create new recipe
app.post("/api/v1/recipes", authenticate, recipeWriter, async (req, res, next) => {
  const { name, categoryId, instructions, cookTimeMinutes, difficulty, ingredients = [] } = req.body || {};
  const authorId = req.user.id;
  if (req.body?.authorId !== undefined && req.body.authorId !== authorId) return res.status(403).json(errorBody("IDENTITY_MISMATCH", "authorId must match token user"));

  if (!name || !categoryId || !instructions) {
    return res.status(400).json(errorBody("VALIDATION_ERROR", "กรุณาระบุ name, categoryId และ instructions ให้ครบถ้วน"));
  }
  if (
    !isText(name, 150) || !isText(instructions, 10000) ||
    !isPositiveInt(categoryId) ||
    (cookTimeMinutes !== undefined && (!isPositiveInt(cookTimeMinutes) || cookTimeMinutes > 1440)) ||
    (difficulty !== undefined && !DIFFICULTIES.includes(difficulty))
  ) {
    return res.status(400).json(
      errorBody("VALIDATION_ERROR", "ข้อมูลไม่ถูกต้อง: name ยาวไม่เกิน 150 ตัวอักษร, categoryId/authorId/cookTimeMinutes เป็นจำนวนเต็มบวก, difficulty เป็น easy | medium | hard")
    );
  }

  if (!Array.isArray(ingredients) || ingredients.length > 50 || !ingredients.every(isIngredient) ||
      new Set(ingredients.map((line) => line.ingredientId)).size !== ingredients.length) {
    return res.status(400).json(errorBody("VALIDATION_ERROR", "วัตถุดิบต้องเป็นรายการไม่เกิน 50 รายการ ไม่ซ้ำกัน และระบุ ingredientId, quantity (0.01 ถึง 999999.99 ทศนิยมไม่เกิน 2 ตำแหน่ง) และ unit ให้ถูกต้อง"));
  }

  let connection;
  let transactionStarted = false;
  try {
    const sql = `
      INSERT INTO recipes (name, category_id, author_id, instructions, cook_time_minutes, difficulty)
      VALUES (?, ?, ?, ?, ?, ?)
    `;
    // Keep the original one-statement path when no ingredients are supplied.
    // A transaction uses one dedicated connection, never pool-level queries.
    if (ingredients.length) {
      connection = await pool.getConnection();
      await connection.beginTransaction();
      transactionStarted = true;
    }
    const executor = connection || pool;
    const [result] = await executor.query(sql, [name, categoryId, authorId, instructions, cookTimeMinutes || 15, difficulty || "easy"]);
    for (const line of ingredients) {
      await executor.query("INSERT INTO recipe_ingredients (recipe_id, ingredient_id, quantity, unit) VALUES (?, ?, ?, ?)",
        [result.insertId, line.ingredientId, line.quantity, line.unit]);
    }
    if (connection) {
      await connection.commit();
      transactionStarted = false;
    }

    res.status(201).json({
      message: "สร้างสูตรอาหารสำเร็จ",
      data: {
        id: result.insertId,
        name,
        categoryId,
        authorId,
        cookTimeMinutes: cookTimeMinutes || 15,
        difficulty: difficulty || "easy",
      },
    });
  } catch (err) {
    if (transactionStarted) {
      try { await connection.rollback(); }
      catch (rollbackError) {
        console.error("Recipe transaction rollback failed", rollbackError.code || "UNKNOWN");
        // Never lend a connection with an uncertain transaction state to another request.
        connection.destroy();
        connection = null;
      }
    }
    if (err.code === "ER_NO_REFERENCED_ROW_2") {
      return res.status(404).json(errorBody("REFERENCE_NOT_FOUND", "ไม่พบหมวดหมู่ ผู้เขียน หรือวัตถุดิบที่ระบุ"));
    }
    next(err);
  } finally {
    if (connection) connection.release();
  }
});

// DELETE /api/v1/recipes/:id - Delete recipe
app.delete("/api/v1/recipes/:id", authenticate, recipeWriter, ownsRecipe, async (req, res, next) => {
  try {
    const recipeId = parseId(req.params.id);
    if (recipeId === null) {
      return res.status(400).json(errorBody("INVALID_ID", "id ต้องเป็นจำนวนเต็มบวก"));
    }
    const [result] = await pool.query("DELETE FROM recipes WHERE id = ?", [recipeId]);

    if (result.affectedRows === 0) {
      return res.status(404).json(errorBody("RECIPE_NOT_FOUND", "ไม่พบข้อมูลสูตรอาหาร"));
    }

    res.status(200).json({ message: "ลบสูตรอาหารสำเร็จ" });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/categories - List categories
app.get("/api/v1/categories", async (req, res, next) => {
  try {
    const hit = categoryCache.rows !== null && categoryCache.expires > Date.now();
    if (!hit) {
      const [rows] = await pool.query("SELECT * FROM categories ORDER BY id ASC");
      categoryCache.rows = rows;
      categoryCache.expires = Date.now() + 30000;
    }
    res.set("X-Cache", hit ? "HIT" : "MISS").status(200).json({ message: "ดึงรายการหมวดหมู่สำเร็จ", data: categoryCache.rows });
  } catch (err) {
    next(err);
  }
});

// -------------------------------------------------------------
// Phase 2: endpoints เพิ่มเติมให้ครบ use case UC-04, UC-05 ใน requirement.md
// -------------------------------------------------------------

// GET /api/v1/ingredients - List ingredient catalog
app.get("/api/v1/ingredients", async (req, res, next) => {
  try {
    const [rows] = await pool.query("SELECT id, name, unit_type FROM ingredients ORDER BY id ASC");
    res.status(200).json({ message: "ดึงรายการวัตถุดิบสำเร็จ", data: rows });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/recipes/:id/ingredients - Assign an ingredient to a recipe (UC-04)
app.post("/api/v1/recipes/:id/ingredients", authenticate, recipeWriter, ownsRecipe, async (req, res, next) => {
  const recipeId = parseId(req.params.id);
  if (recipeId === null) {
    return res.status(400).json(errorBody("INVALID_ID", "id ต้องเป็นจำนวนเต็มบวก"));
  }
  const { ingredientId, quantity, unit } = req.body || {};
  if (!isIngredient({ ingredientId, quantity, unit })) {
    return res.status(400).json(errorBody("VALIDATION_ERROR", "กรุณาระบุ ingredientId (จำนวนเต็มบวก), quantity (0.01 ถึง 999999.99) และ unit"));
  }

  try {
    const [recipes] = await pool.query("SELECT id FROM recipes WHERE id = ?", [recipeId]);
    if (recipes.length === 0) {
      return res.status(404).json(errorBody("RECIPE_NOT_FOUND", "ไม่พบข้อมูลสูตรอาหารที่ระบุ"));
    }
    const [result] = await pool.query(
      "INSERT INTO recipe_ingredients (recipe_id, ingredient_id, quantity, unit) VALUES (?, ?, ?, ?)",
      [recipeId, ingredientId, quantity, unit]
    );
    res.status(201).json({
      message: "เพิ่มวัตถุดิบในสูตรอาหารสำเร็จ",
      data: { id: result.insertId, recipeId, ingredientId, quantity, unit },
    });
  } catch (err) {
    if (err.code === "ER_DUP_ENTRY") {
      return res.status(409).json(errorBody("INGREDIENT_ALREADY_IN_RECIPE", "วัตถุดิบนี้อยู่ในสูตรอาหารแล้ว"));
    }
    if (err.code === "ER_NO_REFERENCED_ROW_2") {
      return res.status(404).json(errorBody("INGREDIENT_NOT_FOUND", "ไม่พบวัตถุดิบที่ระบุ"));
    }
    next(err);
  }
});

// GET /api/v1/recipes/:id/ratings - List reviews of a recipe with average score
app.get("/api/v1/recipes/:id/ratings", async (req, res, next) => {
  try {
    const recipeId = parseId(req.params.id);
    if (recipeId === null) {
      return res.status(400).json(errorBody("INVALID_ID", "id ต้องเป็นจำนวนเต็มบวก"));
    }
    const [recipes] = await pool.query("SELECT id FROM recipes WHERE id = ?", [recipeId]);
    if (recipes.length === 0) {
      return res.status(404).json(errorBody("RECIPE_NOT_FOUND", "ไม่พบข้อมูลสูตรอาหารที่ระบุ"));
    }
    const [rows] = await pool.query(
      `SELECT rt.id, rt.user_id, u.username, rt.rating_score, rt.review_comment, rt.created_at
       FROM ratings rt
       JOIN users u ON u.id = rt.user_id
       WHERE rt.recipe_id = ?
       ORDER BY rt.id ASC`,
      [recipeId]
    );
    const total = rows.reduce((sum, row) => sum + row.rating_score, 0);
    res.status(200).json({
      message: "ดึงรีวิวสูตรอาหารสำเร็จ",
      data: {
        recipeId,
        ratingCount: rows.length,
        averageScore: rows.length ? Math.round((total / rows.length) * 100) / 100 : null,
        ratings: rows.map((row) => ({
          id: row.id,
          userId: row.user_id,
          username: row.username,
          ratingScore: row.rating_score,
          reviewComment: row.review_comment,
          createdAt: row.created_at,
        })),
      },
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/recipes/:id/ratings - Rate and review a recipe (UC-05)
app.post("/api/v1/recipes/:id/ratings", authenticate, async (req, res, next) => {
  const recipeId = parseId(req.params.id);
  if (recipeId === null) {
    return res.status(400).json(errorBody("INVALID_ID", "id ต้องเป็นจำนวนเต็มบวก"));
  }
  const { ratingScore, reviewComment } = req.body || {};
  const userId = req.user.id;
  if (req.body?.userId !== undefined && req.body.userId !== userId) return res.status(403).json(errorBody("IDENTITY_MISMATCH", "userId must match token user"));
  if (
    !Number.isInteger(ratingScore) || ratingScore < 1 || ratingScore > 5 ||
    (reviewComment !== undefined && !isText(reviewComment, 2000))
  ) {
    return res.status(400).json(errorBody("VALIDATION_ERROR", "กรุณาระบุ ratingScore (จำนวนเต็ม 1-5) reviewComment ยาวไม่เกิน 2000 ตัวอักษร"));
  }

  try {
    const [recipes] = await pool.query("SELECT id FROM recipes WHERE id = ?", [recipeId]);
    if (recipes.length === 0) {
      return res.status(404).json(errorBody("RECIPE_NOT_FOUND", "ไม่พบข้อมูลสูตรอาหารที่ระบุ"));
    }
    const [result] = await pool.query(
      "INSERT INTO ratings (recipe_id, user_id, rating_score, review_comment) VALUES (?, ?, ?, ?)",
      [recipeId, userId, ratingScore, reviewComment ?? null]
    );
    res.status(201).json({
      message: "บันทึกรีวิวสำเร็จ",
      data: { id: result.insertId, recipeId, userId, ratingScore, reviewComment: reviewComment ?? null },
    });
  } catch (err) {
    if (err.code === "ER_DUP_ENTRY") {
      return res.status(409).json(errorBody("RATING_ALREADY_EXISTS", "ผู้ใช้นี้รีวิวสูตรอาหารนี้ไปแล้ว"));
    }
    if (err.code === "ER_NO_REFERENCED_ROW_2") {
      return res.status(404).json(errorBody("USER_NOT_FOUND", "ไม่พบผู้ใช้ที่ระบุ"));
    }
    next(err);
  }
});

// -------------------------------------------------------------
// Phase 2, Part 2: External API Integration & Resilience
// GET /api/v1/external/meal-ideas?ingredient=chicken_breast
// เรียก TheMealDB ผ่าน src/services/external-api.js (retry + timeout + fallback)
// -------------------------------------------------------------
app.get("/api/v1/external/meal-ideas", async (req, res) => {
  const ingredient = req.query.ingredient;
  if (typeof ingredient !== "string" || !/^[A-Za-z][A-Za-z _-]{0,49}$/.test(ingredient.trim())) {
    return res.status(400).json(errorBody("VALIDATION_ERROR", "กรุณาระบุ ingredient เป็นภาษาอังกฤษ เช่น chicken_breast (ตัวอักษร ช่องว่าง _ - ยาวไม่เกิน 50)"));
  }

  const { message, ...data } = await getMealIdeas(ingredient.trim().replace(/ +/g, "_"));
  res.set("X-Data-Source", data.source);
  res.status(200).json({ message: message || "ดึงไอเดียเมนูจากบริการภายนอกสำเร็จ", data });
});

// Centralized 404 handler
app.use((req, res) => {
  res.status(404).json(errorBody("ROUTE_NOT_FOUND", "ไม่พบเส้นทางที่ร้องขอ"));
});

// Centralized Error handler
app.use((err, req, res, next) => {
  if (err.type === "entity.parse.failed") {
    return res.status(400).json(errorBody("INVALID_JSON", "รูปแบบ JSON ใน request body ไม่ถูกต้อง"));
  }
  if (err.type === "entity.too.large") {
    return res.status(413).json(errorBody("PAYLOAD_TOO_LARGE", "request body ใหญ่เกิน 64kb"));
  }
  console.error(err.stack || err.message);
  res.status(500).json(errorBody("INTERNAL_SERVER_ERROR", "เกิดข้อผิดพลาดภายในระบบฐานข้อมูล"));
});

if (require.main === module) {
  const host = process.env.HOST || "127.0.0.1";
  app.listen(PORT, host, () => {
    console.log(`Recipe Management API running on port ${PORT} (Database: ${process.env.DB_NAME || "recipe_api"})`);
    console.log(`API docs: http://${host}:${PORT}/api-docs`);
  });
}

module.exports = app;
