// Starts and stops an explicitly disposable, unprivileged MariaDB instance.
// Requires official Debian packages already extracted beneath /tmp/krua-mariadb-root
// and mariadb-install-db initialization at /tmp/krua-isolated-db.
// Never accepts a remote database address or reads production credentials.
const fs = require("node:fs");
const path = require("node:path");
const net = require("node:net");
const assert = require("node:assert/strict");
const { spawn, spawnSync } = require("node:child_process");
const crypto = require("node:crypto");
const mysql = require("mysql2/promise");
const request = require("supertest");
const root = path.resolve(__dirname, "..");
const binaryRoot = "/tmp/krua-mariadb-root/usr";
const datadir = "/tmp/krua-isolated-db";
const results = [];
const record = (name, detail) => { results.push({ name, result: "PASS", detail }); console.log(`PASS: ${name}${detail ? ` (${detail})` : ""}`); };
const pause = (ms) => new Promise(resolve => setTimeout(resolve, ms));
(async () => {
  const reservation = net.createServer();
  await new Promise(resolve => reservation.listen(0, "127.0.0.1", resolve));
  const port = reservation.address().port;
  await new Promise(resolve => reservation.close(resolve));
  const log = fs.openSync("/tmp/krua-isolated-mariadb.log", "a");
  const server = spawn(`${binaryRoot}/sbin/mariadbd`, ["--no-defaults", `--basedir=${binaryRoot}`, `--datadir=${datadir}`, "--socket=", `--port=${port}`, "--bind-address=127.0.0.1", "--skip-name-resolve", "--pid-file=/tmp/krua-isolated-mariadb.pid", "--innodb-buffer-pool-size=32M"], {
    env: { ...process.env, LD_LIBRARY_PATH: `${binaryRoot}/lib/x86_64-linux-gnu` }, stdio: ["ignore", log, log],
  });
  fs.closeSync(log);
  let bootstrap, pool;
  const config = { host: "127.0.0.1", port, user: "root", password: "", multipleStatements: true, decimalNumbers: true };
  let version, completed = false, failure;
  try {
    for (let i = 0; i < 100; i++) {
      if (server.exitCode !== null) throw new Error(`Disposable MariaDB exited ${server.exitCode}; see /tmp/krua-isolated-mariadb.log`);
      try { bootstrap = await mysql.createConnection(config); break; } catch { await pause(100); }
    }
    assert.ok(bootstrap, "Disposable MariaDB did not become ready within 10 seconds");
    [[{ version }]] = await bootstrap.query("SELECT VERSION() AS version");
    // Only the brand-new datadir is reachable through this newly selected port.
    const [databases] = await bootstrap.query("SHOW DATABASES");
    assert.ok(databases.every(row => ["information_schema", "mysql", "performance_schema", "sys"].includes(row.Database)), "Refuse to seed a nonempty business database");
    await bootstrap.query(fs.readFileSync(path.join(root, "schema.sql"), "utf8"));
    await bootstrap.query(fs.readFileSync(path.join(root, "seed.sql"), "utf8"));
    record("official schema and seed execute on real MariaDB", version);
    Object.assign(process.env, { NODE_ENV: "test", USE_REAL_DB: "1", DB_HOST: "127.0.0.1", DB_PORT: String(port), DB_USER: "root", DB_PASSWORD: "", DB_NAME: "recipe_api", JWT_SECRET: crypto.randomBytes(32).toString("hex"), DEMO_PASSWORD: crypto.randomBytes(24).toString("hex"), TRUST_PROXY_HOPS: "0" });
    pool = require("../src/db");
    const { migrate } = require("../tools/migrate");
    const snapshot = async () => {
      const data = {};
      for (const table of ["categories", "ingredients", "recipes", "recipe_ingredients", "ratings"]) {
        const [rows] = await pool.query(`SELECT * FROM ${table} ORDER BY id`); data[table] = rows;
      }
      const [users] = await pool.query("SELECT id, username, email, role, created_at FROM users ORDER BY id"); data.users = users;
      return data;
    };
    const original = await snapshot();
    await migrate("up"); await migrate("up"); await migrate("down"); await migrate("up");
    assert.deepEqual(await snapshot(), original);
    record("migration up/up/down/up preserves all six business tables");
    const { hashPassword } = require("../src/password");
    const hash = await hashPassword(process.env.DEMO_PASSWORD);
    await pool.query("UPDATE users SET password_hash = ?", [hash]);
    const app = require("../src/index");
    const login = async username => {
      const response = await request(app).post("/api/v1/auth/login").send({ username, password: process.env.DEMO_PASSWORD });
      assert.equal(response.status, 200); return response.body.data.token;
    };
    const chef = await login("chef_somchai"), member = await login("foodie_somying"), admin = await login("admin_wittawas");
    record("password login for chef, member and admin");
    const call = async (method, route, body, token, expected) => {
      let req = request(app)[method](route); if (token) req = req.set("Authorization", `Bearer ${token}`); if (body !== undefined) req = req.send(body);
      const response = await req; assert.equal(response.status, expected, `${method} ${route}: ${JSON.stringify(response.body)}`); return response.body;
    };
    const payload = { name: "Disposable atomic recipe", categoryId: 1, instructions: "Mix and cook", ingredients: [{ ingredientId: 1, quantity: 0.29, unit: "grams" }, { ingredientId: 2, quantity: 12.5, unit: "grams" }] };
    await call("post", "/api/v1/recipes", payload, undefined, 401);
    await call("post", "/api/v1/recipes", payload, member, 403);
    await call("post", "/api/v1/recipes", { ...payload, authorId: 3 }, chef, 403);
    record("anonymous, member and forged-author atomic creates rejected");
    const created = await call("post", "/api/v1/recipes", payload, chef, 201);
    const id = created.data.id;
    const detail = await call("get", `/api/v1/recipes/${id}`, undefined, undefined, 200);
    assert.equal(detail.data.author_id, 1);
    assert.equal(detail.data.ingredients.length, 2);
    assert.equal(detail.data.ingredients[0].quantity, 0.29);
    record("atomic recipe and decimal ingredients committed; author_id returned");
    const committed = await snapshot();
    await call("post", "/api/v1/recipes", { ...payload, ingredients: [...payload.ingredients, { ingredientId: 99999, quantity: 1, unit: "g" }] }, chef, 404);
    assert.deepEqual(await snapshot(), committed);
    record("unknown final ingredient rolls back recipe and both earlier ingredient inserts");
    await call("post", "/api/v1/recipes", { ...payload, ingredients: [payload.ingredients[0], payload.ingredients[0]] }, chef, 400);
    await call("post", "/api/v1/recipes", { ...payload, ingredients: [{ ingredientId: 1, quantity: 0.015, unit: "g" }] }, chef, 400);
    assert.deepEqual(await snapshot(), committed);
    record("duplicate ingredients and precision loss rejected without DB changes");
    const outcomes = await Promise.all([
      call("post", "/api/v1/recipes", { ...payload, name: "Concurrent success one" }, chef, 201),
      call("post", "/api/v1/recipes", { ...payload, ingredients: [...payload.ingredients, { ingredientId: 99999, quantity: 1, unit: "g" }] }, chef, 404),
      call("post", "/api/v1/recipes", { ...payload, name: "Concurrent success two" }, admin, 201),
    ]);
    const ids = [outcomes[0].data.id, outcomes[2].data.id];
    for (const createdId of ids) {
      const result = await call("get", `/api/v1/recipes/${createdId}`, undefined, undefined, 200); assert.equal(result.data.ingredients.length, 2);
    }
    await call("delete", `/api/v1/recipes/${ids[1]}`, undefined, chef, 403);
    await call("post", `/api/v1/recipes/${ids[1]}/ingredients`, { ingredientId: 3, quantity: 1, unit: "g" }, chef, 403);
    for (const createdId of ids) await call("delete", `/api/v1/recipes/${createdId}`, undefined, admin, 200);
    assert.deepEqual(await snapshot(), committed);
    record("concurrent successful and failed transactions isolated; foreign-owner writes forbidden");
    await call("post", `/api/v1/recipes/${id}/ratings`, { ratingScore: 5 }, member, 201);
    await call("post", `/api/v1/recipes/${id}/ratings`, { ratingScore: 3 }, member, 409);
    await call("post", `/api/v1/recipes/${id}/ratings`, { ratingScore: 6 }, chef, 400);
    await call("post", `/api/v1/recipes/${id}/ingredients`, payload.ingredients[0], chef, 409);
    await assert.rejects(pool.query("INSERT INTO ratings(recipe_id,user_id,rating_score) VALUES (?,?,?)", [id, 1, 6]), error => error.errno === 4025 && error.sqlState === "23000");
    await assert.rejects(pool.query("INSERT INTO recipe_ingredients(recipe_id,ingredient_id,quantity,unit) VALUES (?,?,?,?)", [99999, 1, 1, "g"]), error => error.code === "ER_NO_REFERENCED_ROW_2");
    record("review uniqueness, score CHECK and ingredient FK enforced on real DB");
    await call("delete", `/api/v1/recipes/${id}`, undefined, member, 403);
    await call("delete", `/api/v1/recipes/${id}`, undefined, chef, 200);
    const [[remaining]] = await pool.query("SELECT (SELECT COUNT(*) FROM recipe_ingredients WHERE recipe_id = ?) + (SELECT COUNT(*) FROM ratings WHERE recipe_id = ?) AS total", [id, id]);
    assert.equal(remaining.total, 0);
    assert.deepEqual(await snapshot(), original);
    record("owner delete cascades ingredients/reviews; original six business tables preserved");
    const smoke = spawnSync(process.execPath, ["tools/real-db-smoke.js"], { cwd: root, env: process.env, encoding: "utf8", timeout: 45000 });
    fs.writeFileSync(path.join(__dirname, "mariadb-existing-smoke.log"), "Database: " + version + ". Existing script labels MYSQL generically; this run is MariaDB, not MySQL 8.\n" + smoke.stdout + smoke.stderr);
    assert.equal(smoke.status, 0, "Existing real DB smoke failed; see mariadb-existing-smoke.log");
    record("existing real-db-smoke.js passes against isolated MariaDB", "Not exact MySQL 8");
    await call("get", "/healthz", undefined, undefined, 200);
    record("health probe succeeds against real database");
    const { startFakeServer, json } = require("../test/helpers");
    const { collection, recordCollection } = require("../tools/record-postman");
    const external = await startFakeServer((req, res) => json(res, 200, { meals: [{ idMeal: "fixture-1", strMeal: "Controlled upstream fixture", strMealThumb: null }] }));
    process.env.EXTERNAL_API_BASE_URL = external.url;
    const httpServer = app.listen(0, "127.0.0.1");
    await new Promise(resolve => httpServer.once("listening", resolve));
    try {
      const document = await recordCollection(structuredClone(collection), `http://127.0.0.1:${httpServer.address().port}`, process.env.DEMO_PASSWORD);
      document.info.name += " (observed isolated MariaDB run)";
      document.info.description += ` Database: ${version}; NOT exact MySQL 8. Meal endpoint uses a controlled local HTTP fixture, NOT live TheMealDB. No production data touched.`;
      const serialized = JSON.stringify(document, null, 2);
      assert.ok(!serialized.includes(process.env.DEMO_PASSWORD) && !/eyJ[a-zA-Z0-9_-]+\./.test(serialized), "Secrets must be redacted");
      fs.writeFileSync(path.join(__dirname, "postman-observed-mariadb.json"), serialized + "\n");
      assert.deepEqual(await snapshot(), original);
      record("15 real MariaDB Postman request/response examples captured; secrets redacted; fixture cleanup verified");
    } finally {
      httpServer.closeAllConnections();
      await new Promise(resolve => httpServer.close(resolve));
      await external.close();
    }
    completed = true;
  } catch (error) {
    failure = error.message;
    throw error;
  } finally {
    if (pool) await pool.end();
    if (bootstrap) await bootstrap.end();
    server.kill("SIGTERM");
    if (server.exitCode === null) await new Promise(resolve => server.once("exit", resolve));
    record("disposable server terminated; no DB listener retained");
    fs.writeFileSync(path.join(__dirname, "mariadb-integration-results.json"), JSON.stringify({ completed, failure: failure || null, database: version || "MariaDB", exactMySQL8: false, source: "Official signed Debian snapshot packages, extracted to /tmp; no system install", scope: "Disposable local loopback process only; no production connection", results }, null, 2) + "\n");
  }
})().catch(error => { console.error(error.stack); process.exitCode = 1; });
