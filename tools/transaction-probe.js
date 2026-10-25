process.env.NODE_ENV = "test";
process.env.USE_REAL_DB = "";
process.env.JWT_SECRET = "transaction-only-secret-67160003-at-least-32-characters";
process.env.DEMO_PASSWORD = "TransactionFixture67160003";
const path = require("node:path");
const assert = require("node:assert/strict");
const target = path.resolve(process.argv[2] || path.join(__dirname, ".."));
const app = require(path.join(target, "src/index.js"));
const server = app.listen(0, "127.0.0.1", async () => {
  try {
    const base = `http://127.0.0.1:${server.address().port}`;
    const home = await fetch(base);
    console.log(`GET / => ${home.status}`);
    const system = await fetch(`${base}/api/v1/system`);
    console.log(`GET /api/v1/system => ${system.status} ${JSON.stringify(await system.json())}`);
    const before = await fetch(`${base}/api/v1/recipes`).then((response) => response.json());
    console.log(`GET /api/v1/recipes => count=${before.data.length}`);
    assert.equal(before.data.length, 3);
    const payload = { name: "ไข่เจียวต้นหอม", categoryId: 1, authorId: 1, instructions: "ตีไข่ ใส่ต้นหอม ทอดให้สุก", cookTimeMinutes: 8, difficulty: "easy" };
    const created = await fetch(`${base}/api/v1/recipes`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    console.log(`POST /api/v1/recipes ${JSON.stringify(payload)} => ${created.status} ${JSON.stringify(await created.json())}`);
    assert.ok([201, 401].includes(created.status));
    if (created.status === 401) {
      const login = await fetch(`${base}/api/v1/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: "chef_somchai", password: process.env.DEMO_PASSWORD }) });
      assert.equal(login.status, 200);
      const { data } = await login.json();
      console.log(`POST /api/v1/auth/login => ${login.status} user=${data.user.username} role=${data.user.role} token=[not logged]`);
      const authenticated = await fetch(`${base}/api/v1/recipes`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${data.token}` }, body: JSON.stringify(payload) });
      console.log(`POST /api/v1/recipes authenticated same input => ${authenticated.status} ${JSON.stringify(await authenticated.json())}`);
      assert.equal(authenticated.status, 201);
    }
    const after = await fetch(`${base}/api/v1/recipes`).then((response) => response.json());
    console.log(`GET /api/v1/recipes => count=${after.data.length}`);
    assert.equal(after.data.length, 4);
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  } finally {
    server.closeAllConnections();
    server.close();
  }
});
