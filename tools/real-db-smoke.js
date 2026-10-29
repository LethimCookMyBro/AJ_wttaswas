require("dotenv").config();
const assert = require("assert/strict");
if (process.env.USE_REAL_DB !== "1") throw new Error("USE_REAL_DB=1 is required; this script never uses the mock database");
if (!process.env.DEMO_PASSWORD) throw new Error("Set DEMO_PASSWORD for the local fixture");
if (!["127.0.0.1", "localhost", "::1"].includes(process.env.DB_HOST || "localhost")) throw new Error("Real-DB fixture smoke is loopback-only; never point it at a production database");
const pool = require("../src/db");
const app = require("../src/index");

(async () => {
  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening",resolve));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  let recipeId;
  let chef;
  let admin;
  let adminRecipeId;
  async function call(method, route, body, token, status) {
    const response = await fetch(baseUrl+route,{method,headers:{"Content-Type":"application/json",...(token?{Authorization:`Bearer ${token}`}:{})},...(body?{body:JSON.stringify(body)}:{})});
    const data = await response.json();
    assert.equal(response.status,status,`${method} ${route}: ${JSON.stringify(data)}`);
    console.log(`${method} ${route} => ${response.status}`);
    return data;
  }
  try {
    const snapshot = async () => {
      const result = {};
      for (const table of ["categories", "ingredients", "recipes", "recipe_ingredients", "ratings"]) {
        const [rows] = await pool.query(`SELECT * FROM ${table} ORDER BY id`);
        result[table] = JSON.stringify(rows);
      }
      const [users] = await pool.query("SELECT id, username, email, role, created_at FROM users ORDER BY id");
      result.users = JSON.stringify(users);
      return result;
    };
    const before = await snapshot();
    chef = (await call("POST","/api/v1/auth/login",{username:"chef_somchai",password:process.env.DEMO_PASSWORD},null,200)).data.token;
    const member = (await call("POST","/api/v1/auth/login",{username:"foodie_somying",password:process.env.DEMO_PASSWORD},null,200)).data.token;
    admin = (await call("POST","/api/v1/auth/login",{username:"admin_web",password:process.env.DEMO_PASSWORD},null,200)).data.token;
    const adminRecipe = await call("POST", "/api/v1/recipes", {name:"Admin ownership fixture",categoryId:1,instructions:"temporary"}, admin, 201);
    adminRecipeId = adminRecipe.data.id;
    await call("DELETE", `/api/v1/recipes/${adminRecipeId}`, null, chef, 403);
    await call("POST", `/api/v1/recipes/${adminRecipeId}/ingredients`, {ingredientId:1,quantity:1,unit:"g"}, chef, 403);
    await call("DELETE", `/api/v1/recipes/${adminRecipeId}`, null, admin, 200);
    adminRecipeId = null;
    await call("POST","/api/v1/recipes",{name:"anonymous",categoryId:1,instructions:"x"},null,401);
    await call("POST","/api/v1/recipes",{name:"member",categoryId:1,instructions:"x"},member,403);
    const result = await call("POST","/api/v1/recipes",{name:"Real DB smoke fixture",categoryId:1,instructions:"temporary fixture",cookTimeMinutes:20,difficulty:"easy"},chef,201);
    recipeId = result.data.id;
    assert.equal(result.data.authorId,1);
    await call("POST",`/api/v1/recipes/${recipeId}/ingredients`,{ingredientId:1,quantity:1.25,unit:"grams"},chef,201);
    await call("POST",`/api/v1/recipes/${recipeId}/ingredients`,{ingredientId:2,quantity:2,unit:"grams"},admin,201);
    await call("DELETE",`/api/v1/recipes/${recipeId}`,null,member,403);
    await call("POST",`/api/v1/recipes/${recipeId}/ratings`,{ratingScore:4,reviewComment:"real MySQL smoke"},member,201);
    const detail = await call("GET",`/api/v1/recipes/${recipeId}`,null,null,200);
    assert.equal(detail.data.ingredients[0].quantity,1.25);
    const list = await call("GET","/api/v1/recipes?page=1&limit=1&categoryId=1&sort=id_desc",null,null,200);
    assert.equal(list.data[0].id,recipeId);
    assert.ok(list.pagination.total >= 1);
    const ratings = await call("GET",`/api/v1/recipes/${recipeId}/ratings`,null,null,200);
    assert.equal(ratings.data.averageScore,4);
    const denied = await call("POST",`/api/v1/recipes/${recipeId}/ratings`,{userId:1,ratingScore:5},member,403);
    assert.equal(denied.error.code,"IDENTITY_MISMATCH");
    await call("DELETE",`/api/v1/recipes/${recipeId}`,null,chef,200);
    const deleted = recipeId; recipeId = null;
    const [[children]] = await pool.query("SELECT COUNT(*) AS total FROM ratings WHERE recipe_id = ?",[deleted]);
    assert.equal(children.total,0);
    const [[ingredients]] = await pool.query("SELECT COUNT(*) AS total FROM recipe_ingredients WHERE recipe_id = ?",[deleted]);
    assert.equal(ingredients.total,0);
    assert.deepEqual(await snapshot(),before,"All six original tables must retain identical rows after temporary fixture cleanup");
    console.log("REAL SQL DATABASE PASS: login, roles, identities, pagination, quantity, ratings, cascade; all six original table rows preserved");
  } finally {
    if (adminRecipeId) await pool.query("DELETE FROM recipes WHERE id = ?",[adminRecipeId]);
    if (recipeId) await pool.query("DELETE FROM recipes WHERE id = ?",[recipeId]);
    server.closeAllConnections();
    await new Promise((resolve)=>server.close(resolve));
    await pool.end();
  }
})().catch((err)=>{console.error(err.stack);process.exitCode=1;});
