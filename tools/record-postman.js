const fs = require("fs");
const path = require("path");
const collection = {
  info: { name: "Recipe API Phase 3 - authenticated demo", schema: "https://schema.getpostman.com/json/collection/v2.1.0/collection.json", description: "Set baseUrl and demoPassword locally. Run in order against a disposable course database. Secrets and JWT values are never embedded." },
  variable: [{key:"baseUrl",value:"http://127.0.0.1:3000"},{key:"demoPassword",value:""},{key:"token",value:""},{key:"newRecipeId",value:""}],
  item: []
};
function add(name, method, route, body, expected, capture) {
  const scripts = [`pm.test('HTTP ${expected}', () => pm.response.to.have.status(${expected}));`];
  if (capture) scripts.push(`pm.collectionVariables.set('${capture}', pm.response.json().data.${capture === "token" ? "token" : "id"});`);
  collection.item.push({ name, request: { method, header: body ? [{key:"Content-Type",value:"application/json"}] : [], auth: route.endsWith("/login") ? {type:"noauth"} : { type:"bearer",bearer:[{key:"token",value:"{{token}}",type:"string"}] }, url: "{{baseUrl}}"+route, ...(body ? {body:{mode:"raw",raw:JSON.stringify(body,null,2),options:{raw:{language:"json"}}}} : {}) }, event:[{listen:"test",script:{type:"text/javascript",exec:scripts}}] });
}
add("Login chef", "POST", "/api/v1/auth/login", {username:"chef_somchai",password:"{{demoPassword}}"},200,"token");
add("List categories", "GET", "/api/v1/categories",null,200);
add("List ingredients", "GET", "/api/v1/ingredients",null,200);
add("Filter and paginate recipes", "GET", "/api/v1/recipes?page=1&limit=2&difficulty=easy&sort=cook_time_asc",null,200);
add("Reject invalid query", "GET", "/api/v1/recipes?limit=101",null,400);
add("Create owned recipe", "POST", "/api/v1/recipes",{name:"Postman demo",categoryId:1,instructions:"Cook fixture",cookTimeMinutes:15,difficulty:"easy"},201,"newRecipeId");
add("Attach ingredient", "POST", "/api/v1/recipes/{{newRecipeId}}/ingredients",{ingredientId:1,quantity:100,unit:"grams"},201);
add("Read detail", "GET", "/api/v1/recipes/{{newRecipeId}}",null,200);
add("Login member", "POST", "/api/v1/auth/login",{username:"foodie_somying",password:"{{demoPassword}}"},200,"token");
add("Member cannot create recipe", "POST", "/api/v1/recipes",{name:"Denied",categoryId:1,instructions:"No"},403);
add("Member rates", "POST", "/api/v1/recipes/{{newRecipeId}}/ratings",{ratingScore:5,reviewComment:"Course fixture"},201);
add("Read reviews", "GET", "/api/v1/recipes/{{newRecipeId}}/ratings",null,200);
add("Meal ideas with fallback", "GET", "/api/v1/external/meal-ideas?ingredient=chicken_breast",null,200);
add("Login chef to clean up", "POST", "/api/v1/auth/login",{username:"chef_somchai",password:"{{demoPassword}}"},200,"token");
add("Delete created fixture only", "DELETE", "/api/v1/recipes/{{newRecipeId}}",null,200);

async function recordCollection(document, baseUrl, password) {
  const target = new URL(baseUrl);
  if (!["localhost", "127.0.0.1", "[::1]"].includes(target.hostname)) throw new Error("Recording is restricted to the local course fixture");
  if (typeof password !== "string" || !password.length) throw new Error("DEMO_PASSWORD is required for --record");
  const variables = { baseUrl, demoPassword: password, token: "", newRecipeId: "" };
  const resolve = (value) => value.replace(/\{\{(\w+)\}\}/g, (_, key) => variables[key] ?? "");
  let chefToken;
  let pendingRecipe;
  try {
    for (const item of document.item) {
      const input = item.request;
      const route = resolve(input.url);
      const body = input.body ? JSON.parse(input.body.raw, (_, value) => typeof value === "string" ? resolve(value) : value) : undefined;
      const response = await fetch(route, { method: input.method, headers: { "Content-Type": "application/json", ...(input.auth.type === "bearer" ? { Authorization: `Bearer ${variables.token}` } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
      const text = await response.text();
      const expected = Number(item.event[0].script.exec[0].match(/status\((\d+)\)/)[1]);
      if (response.status !== expected) throw new Error(`${item.name}: expected ${expected}, received ${response.status}`);
      const data = JSON.parse(text);
      let redacted = false;
      if (route.endsWith("/auth/login") && response.status === 200) {
        variables.token = data.data.token;
        if (body.username === "chef_somchai") chefToken = variables.token;
        data.data.token = "[REDACTED JWT - observed token omitted]";
        redacted = true;
      }
      if (input.method === "POST" && /\/api\/v1\/recipes$/.test(route) && response.status === 201) {
        variables.newRecipeId = data.data.id;
        pendingRecipe = data.data.id;
      }
      if (input.method === "DELETE" && response.status === 200) pendingRecipe = null;
      const headers = [...response.headers].filter(([key]) => ["content-type", "x-cache", "x-data-source", "retry-after", "ratelimit", "ratelimit-policy"].includes(key)).map(([key, value]) => ({ key, value }));
      item.response = [{ name: "Observed HTTP response; login token redacted", originalRequest: structuredClone(input), status: response.statusText, code: response.status, header: headers, body: redacted ? JSON.stringify(data, null, 2) : text }];
      console.log(`${input.method} ${new URL(route).pathname} => ${response.status}`);
    }
    document.info.description += ` Recorded against ${baseUrl} at ${new Date().toISOString()}. Login JWT values were redacted; all other example bodies are observed server responses.`;
    return document;
  } finally {
    if (pendingRecipe && chefToken) {
      const cleanup = await fetch(`${baseUrl}/api/v1/recipes/${pendingRecipe}`, { method: "DELETE", headers: { Authorization: `Bearer ${chefToken}` } });
      if (cleanup.status !== 200 && cleanup.status !== 404) throw new Error(`Fixture cleanup failed with HTTP ${cleanup.status}`);
    }
  }
}

async function main() {
  require("dotenv").config();
  if (process.argv.includes("--record")) await recordCollection(collection, process.env.POSTMAN_BASE_URL || `http://127.0.0.1:${process.env.PORT || 3000}`, process.env.DEMO_PASSWORD);
  fs.writeFileSync(path.join(__dirname, "../postman_collection.json"), JSON.stringify(collection, null, 2) + "\n");
  console.log(`Wrote ${collection.item.length} ordered requests; ${process.argv.includes("--record") ? "observed examples with login tokens redacted" : "generation only, no observed examples"}`);
}
if (require.main === module) main().catch((err) => { console.error(err.message); process.exitCode = 1; });
module.exports = { collection, recordCollection };
