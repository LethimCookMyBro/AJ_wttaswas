const request = require("supertest");
const jwt = require("jsonwebtoken");
const app = require("../src/index");
const pool = require("../src/db");
const { hashPassword, verifyPassword } = require("../src/password");
const token = (id = 1, options = {}) => jwt.sign({}, process.env.JWT_SECRET, { algorithm:"HS256",subject:String(id),issuer:"recipe-api",audience:"recipe-web",expiresIn:"15m",...options });
const auth = (id = 1) => `Bearer ${token(id)}`;

test("anonymous recipe creation is rejected", async () => {
  const response = await request(app).post("/api/v1/recipes").send({name:"x",categoryId:1,authorId:1,instructions:"y"});
  expect(response.status).toBe(401);
});
test("scrypt salts are unique and password verification rejects wrong and malformed hashes", async () => {
  const hash = await hashPassword("fixture password");
  expect(hash).not.toBe(await hashPassword("fixture password"));
  expect(await verifyPassword("fixture password", hash)).toBe(true);
  expect(await verifyPassword("wrong",hash)).toBe(false);
  expect(await verifyPassword("x",null)).toBe(false);
});
test("login reads the user and checks the real password hash", async () => {
  const response = await request(app).post("/api/v1/auth/login").send({username:"chef_somchai",password:process.env.DEMO_PASSWORD});
  expect(response.status).toBe(200);
  expect(response.headers["cache-control"]).toBe("no-store");
  expect(response.body.data.user).toEqual({id:1,username:"chef_somchai",role:"chef"});
  expect(jwt.verify(response.body.data.token,process.env.JWT_SECRET,{algorithms:["HS256"],issuer:"recipe-api",audience:"recipe-web"}).sub).toBe("1");
  for (const credentials of [{username:"chef_somchai",password:"wrong"},{username:"missing",password:"wrong"}]) {
    expect((await request(app).post("/api/v1/auth/login").send(credentials)).status).toBe(401);
  }
  expect((await request(app).post("/api/v1/auth/login").send({})).status).toBe(400);
});
test.each(["garbage",token(1,{expiresIn:-1}),token(99),jwt.sign({},"wrong signing secret",{subject:"1"}),jwt.sign({},process.env.JWT_SECRET,{algorithm:"HS384",subject:"1"})])("bad or expired tokens cannot write", async (bad) => {
  expect((await request(app).delete("/api/v1/recipes/1").set("Authorization",`Bearer ${bad}`)).status).toBe(401);
});
test("verified identity cannot be spoofed in body", async () => {
  const body = {name:"x",instructions:"y",categoryId:1,authorId:3};
  expect((await request(app).post("/api/v1/recipes").set("Authorization",auth()).send(body)).status).toBe(403);
  expect((await request(app).post("/api/v1/recipes/3/ratings").set("Authorization",auth(2)).send({userId:1,ratingScore:5})).status).toBe(403);
});
test("member cannot mutate recipes; chef cannot mutate another author's recipe; admin can", async () => {
  expect((await request(app).post("/api/v1/recipes").set("Authorization",auth(2)).send({name:"x",instructions:"y",categoryId:1})).status).toBe(403);
  expect((await request(app).delete("/api/v1/recipes/3").set("Authorization",auth())).status).toBe(403);
  expect((await request(app).post("/api/v1/recipes/3/ingredients").set("Authorization",auth()).send({ingredientId:1,quantity:1,unit:"g"})).status).toBe(403);
  expect((await request(app).post("/api/v1/recipes/3/ingredients").set("Authorization",auth(3)).send({ingredientId:1,quantity:1,unit:"g"})).status).toBe(201);
});
test("member rates using token identity without userId", async () => {
  const res = await request(app).post("/api/v1/recipes/3/ratings").set("Authorization",auth(2)).send({ratingScore:4});
  expect(res.status).toBe(201);
  expect(res.body.data.userId).toBe(2);
});
test("create derives author and enforces minutes and instruction bounds", async () => {
  const body = {name:"valid",categoryId:1,instructions:"method"};
  const res = await request(app).post("/api/v1/recipes").set("Authorization",auth()).send(body);
  expect(res.status).toBe(201);
  expect(res.body.data.authorId).toBe(1);
  for (const extra of [{cookTimeMinutes:1441},{instructions:"x".repeat(10001)}]) {
    expect((await request(app).post("/api/v1/recipes").set("Authorization",auth()).send({...body,...extra})).status).toBe(400);
  }
});
test.each(["page=0","limit=101","page=1.5","sort=__proto__","sort=id%20DESC;DROP%20TABLE%20users","categoryId=abc","difficulty=bad","page=1&page=2","limit=2&limit=3","offset=1"])("query rejects %s", async (query) => {
  expect((await request(app).get(`/api/v1/recipes?${query}`)).status).toBe(400);
});
test("pagination returns array plus metadata and exact filtered totals", async () => {
  const res = await request(app).get("/api/v1/recipes?page=2&limit=1&sort=id_desc");
  expect(res.body.data).toHaveLength(1);
  expect(res.body.pagination).toMatchObject({page:2,limit:1,total:4,totalPages:4});
  const filtered = await request(app).get("/api/v1/recipes?categoryId=2&difficulty=medium&sort=cook_time_asc");
  expect(filtered.body.data.map((r)=>r.id)).toEqual([2]);
  expect(filtered.body.pagination.total).toBe(1);
  expect((await request(app).get("/api/v1/recipes?page=99&limit=1")).body.data).toEqual([]);
  expect((await request(app).get("/api/v1/recipes?sort=name_asc")).status).toBe(200);
});
test("public category cache hits, then expires without caching errors", async () => {
  const first = await request(app).get("/api/v1/categories");
  const spy = jest.spyOn(pool,"query");
  const hit = await request(app).get("/api/v1/categories");
  expect(hit.headers["x-cache"]).toBe("HIT");
  expect(hit.body.data).toEqual(first.body.data);
  expect(spy).not.toHaveBeenCalled();
  const now = Date.now();
  const clock = jest.spyOn(Date,"now").mockReturnValue(now+31000);
  const expired = await request(app).get("/api/v1/categories");
  clock.mockRestore();
  expect(expired.headers["x-cache"]).toBe("MISS");
  expect(spy).toHaveBeenCalledTimes(1);
  spy.mockRestore();
});
test("database errors are generic and never leak SQL", async () => {
  const spy = jest.spyOn(pool,"query").mockRejectedValueOnce(new Error("private SQL password"));
  const consoleSpy = jest.spyOn(console,"error").mockImplementation(()=>{});
  const res = await request(app).get("/api/v1/ingredients");
  expect(res.status).toBe(500);
  expect(JSON.stringify(res.body)).not.toContain("private SQL");
  spy.mockRestore(); consoleSpy.mockRestore();
});
test("search is a trimmed literal substring and pagination totals use the same filter", async () => {
  const found = await request(app).get("/api/v1/recipes").query({search:" มะม่วง ",limit:"1"});
  expect(found.status).toBe(200);
  expect(found.body.data.map((r)=>r.id)).toEqual([2]);
  expect(found.body.pagination.total).toBe(1);
  const name = "literal%_!recipe";
  const created = await request(app).post("/api/v1/recipes").set("Authorization",auth()).send({name,categoryId:1,instructions:"test"});
  expect(created.status).toBe(201);
  for (const search of ["%", "_", "!", name]) {
    const result = await request(app).get("/api/v1/recipes").query({search});
    expect(result.status).toBe(200);
    expect(result.body.data.map((r)=>r.name)).toEqual([name]);
    expect(result.body.pagination.total).toBe(1);
  }
  for (const query of [{search:"x".repeat(151)},{search:["a","b"]},{search:{nested:"x"}}]) {
    expect((await request(app).get("/api/v1/recipes").query(query)).status).toBe(400);
  }
});
test("failed cache refill is not cached and the next request retries the database", async () => {
  const clock = jest.spyOn(Date,"now").mockReturnValue(Date.now()+62000);
  const query = jest.spyOn(pool,"query").mockRejectedValueOnce(new Error("temporary database failure"));
  const logging = jest.spyOn(console,"error").mockImplementation(()=>{});
  try {
    expect((await request(app).get("/api/v1/categories")).status).toBe(500);
    const recovered = await request(app).get("/api/v1/categories");
    expect(recovered.status).toBe(200);
    expect(recovered.headers["x-cache"]).toBe("MISS");
    expect(query).toHaveBeenCalledTimes(2);
  } finally { query.mockRestore(); logging.mockRestore(); clock.mockRestore(); }
});
test("server refuses missing or short signing secrets", () => {
  const {spawnSync} = require("child_process");
  for (const secret of ["", "short"]) {
    const child = spawnSync(process.execPath,["-e","require('./src/index')"],{cwd:require("path").join(__dirname,".."),env:{...process.env,JWT_SECRET:secret},encoding:"utf8"});
    expect(child.status).toBe(1);
    expect(child.stderr).toContain("JWT_SECRET must contain at least 32 characters");
  }
});
test("login limiter and API limiter return standard 429 envelopes", async () => {
  let login;
  for (let i=0;i<11;i++) login = await request(app).post("/api/v1/auth/login").send({});
  expect(login.status).toBe(429);
  expect(login.body.error.code).toBe("RATE_LIMITED");
  expect(login.headers["retry-after"]).toBeDefined();
  let response;
  for (let i=0;i<201;i++) response = await request(app).get("/api/v1/ingredients");
  expect(response.status).toBe(429);
  expect(response.body.error.code).toBe("RATE_LIMITED");
});
