const request = require("supertest");
const { spawnSync } = require("node:child_process");
const path = require("node:path");
const app = require("../src/index");
const pool = require("../src/db");

test("health checks the actual pool query and does not cache success", async () => {
  const query = jest.spyOn(pool, "query").mockResolvedValueOnce([[{ 1: 1 }]]);
  try {
    const response = await request(app).get("/healthz");
    expect(query).toHaveBeenCalledWith("SELECT 1");
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: "ok" });
    expect(response.headers["cache-control"]).toBe("no-store");
  } finally { query.mockRestore(); }
});
test("health fails closed without exposing database errors", async () => {
  const query = jest.spyOn(pool, "query").mockRejectedValueOnce(new Error("private-db-host password-sensitive"));
  try {
    const response = await request(app).get("/healthz");
    expect(response.status).toBe(503);
    expect(response.body).toEqual({ status: "unavailable" });
    expect(response.text).not.toMatch(/private|password/);
  } finally { query.mockRestore(); }
});
test("health quota rejects excess requests before querying the database", async () => {
  let isolatedApp, isolatedPool;
  jest.isolateModules(() => { isolatedApp = require("../src/index"); isolatedPool = require("../src/db"); });
  const query = jest.spyOn(isolatedPool, "query").mockResolvedValue([[{ 1: 1 }]]);
  try {
    for (let i = 0; i < 60; i++) expect((await request(isolatedApp).get("/healthz")).status).toBe(200);
    const denied = await request(isolatedApp).get("/healthz");
    expect(denied.status).toBe(429);
    expect(denied.body.error.code).toBe("RATE_LIMITED");
    expect(denied.headers.ratelimit).toBeTruthy();
    expect(query).toHaveBeenCalledTimes(60);
  } finally { query.mockRestore(); }
});
test("proxy trust defaults local and accepts only explicit zero, one or two hops", () => {
  expect(app.get("trust proxy")).toBe(0);
  for (const [value, status] of [["1", 0], ["2", 0], ["true", 1], ["3", 1]]) {
    const child = spawnSync(process.execPath, ["-e", "const a=require('./src/index');if(a.get('trust proxy')!==Number(process.env.TRUST_PROXY_HOPS))process.exit(2)"], { cwd: path.join(__dirname, ".."), env: { ...process.env, TRUST_PROXY_HOPS: value, DEMO_PASSWORD: "" }, encoding: "utf8" });
    expect(child.status).toBe(status);
    if (status) expect(child.stderr).toContain("TRUST_PROXY_HOPS must be 0, 1 or 2");
  }
});

test("two trusted Railway hops keep one client quota across edge connections and spoofed prefixes", async () => {
  const previous = process.env.TRUST_PROXY_HOPS;
  process.env.TRUST_PROXY_HOPS = "2";
  try {
    let isolatedApp;
    jest.isolateModules(() => { isolatedApp = require("../src/index"); });
    const remaining = [];
    for (const forwarded of ["198.51.100.42, 192.0.2.1", "198.51.100.42, 192.0.2.2", "203.0.113.99, 198.51.100.42, 192.0.2.3"]) {
      const response = await request(isolatedApp).get("/api/v1/system").set("X-Forwarded-For", forwarded);
      expect(response.status).toBe(200);
      remaining.push(Number(/r=(\d+)/.exec(response.headers.ratelimit)[1]));
    }
    expect(remaining).toEqual([199, 198, 197]);
  } finally {
    if (previous === undefined) delete process.env.TRUST_PROXY_HOPS;
    else process.env.TRUST_PROXY_HOPS = previous;
  }
});
