require("dotenv").config();
const mysql = require("mysql2/promise");
const { hashPassword } = require("./password");

let pool;

// ข้อมูลตั้งต้นตรงกับ seed.sql และจำลอง constraint หลักของ schema.sql (UNIQUE, FK, CASCADE)
function createMockPool() {
  const dupEntry = (message) => Object.assign(new Error(message), { code: "ER_DUP_ENTRY", errno: 1062 });
  const noRef = (message) => Object.assign(new Error(message), { code: "ER_NO_REFERENCED_ROW_2", errno: 1452 });
  const now = () => new Date().toISOString();

  const categories = [
    { id: 1, name: "อาหารคาวไทย", description: "สูตรอาหารไทยรสชาติต้นตำรับ เข้มข้น กลมกล่อม" },
    { id: 2, name: "ของหวานและเบเกอรี่", description: "ขนมหวาน ขนมไทย และเบเกอรี่ทำง่าย" },
    { id: 3, name: "อาหารเพื่อสุขภาพ", description: "เมนูอาหารคลีน แคลอรี่ต่ำ อุดมไปด้วยโปรตีน" },
  ];
  const users = [
    { id: 1, username: "chef_somchai", email: "somchai.chef@example.com", role: "chef" },
    { id: 2, username: "foodie_somying", email: "somying.eat@example.com", role: "member" },
    { id: 3, username: "admin_web", email: "admin@example.com", role: "admin" },
  ];
  const passwordsReady = process.env.DEMO_PASSWORD
    ? Promise.all(
        users.map(async (user) => {
          user.password_hash = await hashPassword(process.env.DEMO_PASSWORD);
        })
      )
    : Promise.resolve();
  const ingredients = [
    { id: 1, name: "หมูสับ", unit_type: "grams" },
    { id: 2, name: "ใบกะเพรา", unit_type: "grams" },
    { id: 3, name: "พริกขี้หนู", unit_type: "pieces" },
    { id: 4, name: "กระเทียม", unit_type: "cloves" },
    { id: 5, name: "ไข่ไก่", unit_type: "pieces" },
    { id: 6, name: "กะทิ", unit_type: "ml" },
    { id: 7, name: "ข้าวเหนียว", unit_type: "grams" },
    { id: 8, name: "มะม่วงน้ำดอกไม้", unit_type: "pieces" },
  ];
  let recipes = [
    { id: 1, name: "ผัดกะเพราหมูสับไข่ดาว", category_id: 1, author_id: 1, instructions: "ผัดหมูกะเพรา ทอดไข่ดาว", cook_time_minutes: 15, difficulty: "easy" },
    { id: 2, name: "ข้าวเหนียวมะม่วงกะทิสด", category_id: 2, author_id: 1, instructions: "มูนข้าวเหนียว จัดใส่จาน", cook_time_minutes: 30, difficulty: "medium" },
    { id: 3, name: "อกไก่ผัดพริกไทยดำคลีน", category_id: 3, author_id: 2, instructions: "ผัดอกไก่คลีน", cook_time_minutes: 20, difficulty: "easy" },
  ];
  let recipeIngredients = [
    { id: 1, recipe_id: 1, ingredient_id: 1, quantity: 200, unit: "grams" },
    { id: 2, recipe_id: 1, ingredient_id: 2, quantity: 30, unit: "grams" },
    { id: 3, recipe_id: 1, ingredient_id: 3, quantity: 5, unit: "pieces" },
    { id: 4, recipe_id: 1, ingredient_id: 4, quantity: 4, unit: "cloves" },
    { id: 5, recipe_id: 1, ingredient_id: 5, quantity: 1, unit: "piece" },
    { id: 6, recipe_id: 2, ingredient_id: 6, quantity: 250, unit: "ml" },
    { id: 7, recipe_id: 2, ingredient_id: 7, quantity: 300, unit: "grams" },
    { id: 8, recipe_id: 2, ingredient_id: 8, quantity: 1, unit: "piece" },
  ];
  let ratings = [
    { id: 1, recipe_id: 1, user_id: 2, rating_score: 5, review_comment: "สูตรนี้อร่อยมาก รสชาติจัดจ้านกำลังดี!", created_at: "2026-09-01T10:00:00.000Z" },
    { id: 2, recipe_id: 2, user_id: 2, rating_score: 5, review_comment: "ข้าวเหนียวมูนหวานมัน มะม่วงหวานฉ่ำ", created_at: "2026-09-02T10:00:00.000Z" },
    { id: 3, recipe_id: 1, user_id: 3, rating_score: 4, review_comment: "ผัดง่าย รวดเร็ว เหมาะกับมื้อด่วน", created_at: "2026-09-03T10:00:00.000Z" },
  ];
  let nextRecipeId = 4;
  let nextRecipeIngredientId = 9;
  let nextRatingId = 4;

  const categoryName = (id) => categories.find((c) => c.id === id)?.name ?? null;

  // แต่ละ handler ตรงกับ SQL หนึ่งคำสั่งใน src/index.js (จับคู่จากข้อความ SQL)
  const filteredRecipes = (sql, params) => {
    let i = 0;
    let rows = [...recipes];
    if (sql.includes("r.category_id = ?")) {
      const id = params[i++];
      rows = rows.filter((r) => r.category_id === id);
    }
    if (sql.includes("r.difficulty = ?")) {
      const difficulty = params[i++];
      rows = rows.filter((r) => r.difficulty === difficulty);
    }
    if (sql.includes("r.name like ?")) {
      const search = params[i++].slice(1, -1).replace(/!([!%_])/g, "$1");
      rows = rows.filter((r) => r.name.toLocaleLowerCase("th").includes(search.toLocaleLowerCase("th")));
    }
    return { rows, i };
  };

  const projectRecipe = (r, sql) => {
    const fields = ["id", "name", "cook_time_minutes", "difficulty", "category_id"];
    if (sql.includes("r.instructions")) fields.push("instructions");
    if (sql.includes("r.author_id")) fields.push("author_id");
    return {
      ...Object.fromEntries(fields.map((key) => [key, r[key]])),
      category_name: categoryName(r.category_id),
    };
  };

  const handlers = [
    {
      match: (sql) => sql === "select 1",
      run: () => [[{ 1: 1 }]],
    },
    {
      match: (sql) => sql.includes("from users where username = ?"),
      run: ([username]) => [users.filter((u) => u.username === username)],
    },
    {
      match: (sql) => sql.includes("from users where id = ?"),
      run: ([id]) => [users.filter((u) => u.id === id)],
    },
    {
      match: (sql) => sql.startsWith("select id, author_id from recipes"),
      run: ([id]) => [recipes.filter((r) => r.id === id).map((r) => ({ id: r.id, author_id: r.author_id }))],
    },
    {
      match: (sql) => sql.startsWith("select count(*) as total from recipes r"),
      run: (params, sql) => [[{ total: filteredRecipes(sql, params).rows.length }]],
    },
    {
      match: (sql) => sql.includes("from recipes r") && sql.includes("join categories") && sql.includes("where r.id = ?"),
      run: ([id], sql) => {
        const r = recipes.find((item) => item.id === Number(id));
        return [r ? [projectRecipe(r, sql)] : []];
      },
    },
    {
      match: (sql) => sql.includes("from recipes r") && sql.includes("join categories"),
      run: (params, sql) => {
        const { rows, i } = filteredRecipes(sql, params);
        if (sql.includes("order by r.id desc")) rows.sort((a, b) => b.id - a.id);
        if (sql.includes("order by r.name asc")) rows.sort((a, b) => a.name.localeCompare(b.name, "th"));
        if (sql.includes("order by r.cook_time_minutes asc")) rows.sort((a, b) => a.cook_time_minutes - b.cook_time_minutes || a.id - b.id);
        return [rows.slice(params[i + 1], params[i + 1] + params[i]).map((r) => projectRecipe(r, sql))];
      },
    },
    {
      match: (sql) => sql.includes("from recipe_ingredients ri") && sql.includes("join ingredients"),
      run: ([recipeId]) => [
        recipeIngredients
          .filter((ri) => ri.recipe_id === Number(recipeId))
          .map((ri) => ({
            ingredient_id: ri.ingredient_id,
            name: ingredients.find((i) => i.id === ri.ingredient_id)?.name ?? "Unknown",
            quantity: ri.quantity,
            unit: ri.unit,
          })),
      ],
    },
    { match: (sql) => sql.startsWith("select * from categories"), run: () => [categories] },
    { match: (sql) => sql.startsWith("select id, name, unit_type from ingredients"), run: () => [ingredients] },
    {
      match: (sql) => sql.startsWith("select id from recipes where id = ?"),
      run: ([id]) => [recipes.filter((r) => r.id === Number(id)).map((r) => ({ id: r.id }))],
    },
    {
      match: (sql) => sql.startsWith("insert into recipes"),
      run: ([name, categoryId, authorId, instructions, cookTime, difficulty]) => {
        if (!categories.some((c) => c.id === Number(categoryId))) throw noRef("FK category_id");
        if (!users.some((u) => u.id === Number(authorId))) throw noRef("FK author_id");
        const recipe = {
          id: nextRecipeId++, name, category_id: Number(categoryId), author_id: Number(authorId),
          instructions, cook_time_minutes: Number(cookTime), difficulty,
        };
        recipes.push(recipe);
        return [{ insertId: recipe.id }];
      },
    },
    {
      match: (sql) => sql.startsWith("delete from recipes where id = ?"),
      run: ([id]) => {
        const index = recipes.findIndex((r) => r.id === Number(id));
        if (index === -1) return [{ affectedRows: 0 }];
        recipes.splice(index, 1);
        recipeIngredients = recipeIngredients.filter((ri) => ri.recipe_id !== Number(id)); // ON DELETE CASCADE
        ratings = ratings.filter((rt) => rt.recipe_id !== Number(id)); // ON DELETE CASCADE
        return [{ affectedRows: 1 }];
      },
    },
    {
      match: (sql) => sql.startsWith("insert into recipe_ingredients"),
      run: ([recipeId, ingredientId, quantity, unit]) => {
        if (!recipes.some((r) => r.id === Number(recipeId))) throw noRef("FK recipe_id");
        if (!ingredients.some((i) => i.id === Number(ingredientId))) throw noRef("FK ingredient_id");
        if (recipeIngredients.some((ri) => ri.recipe_id === Number(recipeId) && ri.ingredient_id === Number(ingredientId))) {
          throw dupEntry("unique_recipe_ingredient");
        }
        const row = { id: nextRecipeIngredientId++, recipe_id: Number(recipeId), ingredient_id: Number(ingredientId), quantity: Number(quantity), unit };
        recipeIngredients.push(row);
        return [{ insertId: row.id }];
      },
    },
    {
      match: (sql) => sql.startsWith("insert into ratings"),
      run: ([recipeId, userId, score, comment]) => {
        if (!recipes.some((r) => r.id === Number(recipeId))) throw noRef("FK recipe_id");
        if (!users.some((u) => u.id === Number(userId))) throw noRef("FK user_id");
        if (ratings.some((rt) => rt.recipe_id === Number(recipeId) && rt.user_id === Number(userId))) {
          throw dupEntry("unique_user_recipe_rating");
        }
        const row = { id: nextRatingId++, recipe_id: Number(recipeId), user_id: Number(userId), rating_score: Number(score), review_comment: comment, created_at: now() };
        ratings.push(row);
        return [{ insertId: row.id }];
      },
    },
    {
      match: (sql) => sql.includes("from ratings rt") && sql.includes("join users u"),
      run: ([recipeId]) => [
        ratings
          .filter((rt) => rt.recipe_id === Number(recipeId))
          .map((rt) => ({
            id: rt.id,
            user_id: rt.user_id,
            username: users.find((u) => u.id === rt.user_id)?.username ?? null,
            rating_score: rt.rating_score,
            review_comment: rt.review_comment,
            created_at: rt.created_at,
          })),
      ],
    },
  ];

  const query = async (sql, params = []) => {
    await passwordsReady;
    const normalized = sql.replace(/\s+/g, " ").trim().toLowerCase();
    const handler = handlers.find((h) => h.match(normalized));
    if (!handler) throw new Error(`Mock DB: unsupported SQL: ${normalized}`);
    return handler.run(params, normalized);
  };

  // Serialize the test double's transactions and ordinary queries so a rollback
  // cannot erase another request's committed writes. This is not a MySQL emulator.
  let tail = Promise.resolve();
  const lock = async () => {
    const previous = tail;
    let unlock;
    tail = new Promise((resolve) => { unlock = resolve; });
    await previous;
    return unlock;
  };
  const pooledQuery = async (...args) => {
    const unlock = await lock();
    try {
      return await query(...args);
    } finally {
      unlock();
    }
  };
  const getConnection = async () => {
    let unlock;
    let snapshot;
    const finish = () => {
      snapshot = null;
      if (unlock) {
        unlock();
        unlock = null;
      }
    };
    const rollback = async () => {
      if (snapshot) ({ recipes, recipeIngredients, ratings } = snapshot);
      finish();
    };
    return {
      query: (...args) => (unlock ? query(...args) : pooledQuery(...args)),
      beginTransaction: async () => {
        if (unlock) throw new Error("Transaction already started");
        unlock = await lock();
        snapshot = structuredClone({ recipes, recipeIngredients, ratings });
      },
      commit: async () => {
        finish();
      },
      rollback,
      release: () => {
        if (snapshot) {
          ({ recipes, recipeIngredients, ratings } = snapshot);
        }
        finish();
      },
    };
  };
  return { query: pooledQuery, end: async () => {}, getConnection };
}

if (process.env.NODE_ENV === "test" && process.env.USE_REAL_DB !== "1") {
  pool = createMockPool();
} else {
  pool = mysql.createPool({
    host: process.env.DB_HOST || "localhost",
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME || "recipe_api",
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    decimalNumbers: true, // DECIMAL (เช่น quantity) คืนเป็น number ตรงกับ openapi.yaml ไม่ใช่ string
  });
}

module.exports = pool;
