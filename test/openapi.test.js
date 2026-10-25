const fs = require("fs");
const path = require("path");
const request = require("supertest");
const SwaggerParser = require("@apidevtools/swagger-parser");
const YAML = require("yaml");
const app = require("../src/index");

const specPath = path.join(__dirname, "..", "openapi.yaml");
const spec = YAML.parse(fs.readFileSync(specPath, "utf8"));

// รายการ route ที่ลงทะเบียนจริงใน Express (เฉพาะ /api/v1)
function registeredRoutes() {
  const routes = new Set();
  for (const layer of app._router.stack) {
    if (!layer.route || !layer.route.path.startsWith("/api/v1")) continue;
    for (const method of Object.keys(layer.route.methods)) routes.add(`${method.toUpperCase()} ${layer.route.path}`);
  }
  return routes;
}

function documentedRoutes() {
  const routes = new Set();
  for (const [route, item] of Object.entries(spec.paths)) {
    for (const method of ["get", "post", "put", "patch", "delete"]) {
      if (item[method]) routes.add(`${method.toUpperCase()} ${route.replace(/\{(\w+)\}/g, ":$1")}`);
    }
  }
  return routes;
}

describe("openapi.yaml", () => {
  test("เป็น OpenAPI 3 ที่ถูกต้องตามมาตรฐาน (validate ผ่านและ $ref ครบ)", async () => {
    await expect(SwaggerParser.validate(specPath)).resolves.toBeDefined();
  });

  test("เอกสารกับโค้ดตรงกัน: ทุก route ในโค้ดมีในเอกสาร และทุก path ในเอกสารมีในโค้ด", () => {
    expect([...documentedRoutes()].sort()).toEqual([...registeredRoutes()].sort());
  });

  test("มีอย่างน้อย 6 endpoint และทุก operation ระบุ operationId, summary และ response", () => {
    const routes = documentedRoutes();
    expect(routes.size).toBeGreaterThanOrEqual(6);
    for (const item of Object.values(spec.paths)) {
      for (const method of ["get", "post", "delete"]) {
        if (!item[method]) continue;
        expect(item[method].operationId).toBeTruthy();
        expect(item[method].summary).toBeTruthy();
        expect(Object.keys(item[method].responses).length).toBeGreaterThanOrEqual(2);
      }
    }
  });
});

describe("Swagger UI", () => {
  test("GET /api-docs/reference/ แสดงหน้า Swagger UI", async () => {
    const res = await request(app).get("/api-docs/reference/");
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toMatch(/text\/html/);
    expect(res.text).toMatch(/swagger-ui/i);
  });

  test("GET /openapi.yaml ให้ไฟล์เดียวกับที่ส่งงาน", async () => {
    const res = await request(app).get("/openapi.yaml");
    expect(res.status).toBe(200);
    expect(res.text).toBe(fs.readFileSync(specPath, "utf8"));
  });
});
