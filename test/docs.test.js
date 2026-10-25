const fs = require("fs");
const path = require("path");
const request = require("supertest");
const YAML = require("yaml");
const app = require("../src/index");
const spec = YAML.parse(fs.readFileSync(path.join(__dirname, "../openapi.yaml"), "utf8"));

describe("Visual API overview and separate tutorial", () => {
  test.each(["/api-docs", "/api-docs/"])("%s separates the visual overview from technical instructions", async (url) => {
    const response = await request(app).get(url);
    expect(response.status).toBe(200);
    expect(response.text).toContain('lang="th"');
    expect(response.text).toContain('name="viewport"');
    expect(response.text).toContain('data-guide-page="overview"');
    expect(response.text).toContain('id="about"');
    expect(response.text).toContain('href="/api-docs/start/"');
    expect(response.text).toContain('href="/api-docs/reference/"');
    expect(response.text).not.toContain("<pre>");
    expect([...response.text.matchAll(/<img\b/g)].length).toBeGreaterThanOrEqual(3);
    expect(response.text).toContain('/assets/guide-home.png');
    for (const image of response.text.matchAll(/<img\b[^>]*>/g)) {
      expect(image[0]).toMatch(/alt="[^"]+"/);
      expect(image[0]).toMatch(/width="\d+"/);
      expect(image[0]).toMatch(/height="\d+"/);
    }
    expect(response.text).not.toMatch(/<script|\son\w+=/i);
    expect(response.headers["content-security-policy"]).toContain("script-src 'self'");
  });

  test.each(["/api-docs/start", "/api-docs/start/"])("%s teaches read, login and write with matching visuals", async (url) => {
    const response = await request(app).get(url);
    expect(response.status).toBe(200);
    expect(response.text).toContain('data-guide-page="start"');
    expect(response.text).toContain('href="/api-docs/"');
    expect(response.text).toContain('/assets/guide-swagger.png');
    expect(response.text).toContain('/assets/guide-auth.png');
    expect(response.text).toContain("ข้อมูลจริง");
    expect(response.text).toContain("15 นาที");
    expect(response.text).toContain("ไม่ต้องใส่คำว่า Bearer");
    expect(response.text.indexOf("ข้อมูลจริง")).toBeLessThan(response.text.indexOf('"name": "ไข่เจียวทดสอบ"'));
    expect(response.text).not.toMatch(/<script|\son\w+=/i);
    expect(response.headers["content-security-policy"]).toContain("script-src 'self'");
  });

  test("the task reference covers exactly the canonical operations", async () => {
    const page = (await request(app).get("/api-docs/start/")).text;
    const documented = [...page.matchAll(/data-method="(GET|POST|DELETE)" data-path="([^"]+)"/g)].map((match) => `${match[1]} ${match[2]}`).sort();
    const expected = Object.entries(spec.paths).flatMap(([url, item]) => ["get", "post", "delete"].filter((method) => item[method]).map((method) => `${method.toUpperCase()} ${url}`)).sort();
    expect(documented).toEqual(expected);
    expect(documented).toHaveLength(12);
    for (const item of Object.values(spec.paths)) {
      for (const method of ["get", "post", "delete"]) {
        if (item[method]) expect(page).toContain(`/api-docs/reference/#/${item[method].tags[0]}/${item[method].operationId}`);
      }
    }
  });

  test("guide stylesheet is served and uses the site's existing design tokens", async () => {
    const response = await request(app).get("/api-guide.css");
    expect(response.status).toBe(200);
    expect(response.headers["content-type"]).toMatch(/text\/css/);
    expect(response.text).toContain("var(--accent)");
    expect(response.text).toContain("@media");
  });

  test("the explanatory flow diagram is served without scripts or external resources", async () => {
    const response = await request(app).get("/assets/api-flow.svg");
    expect(response.status).toBe(200);
    expect(response.headers["content-type"]).toMatch(/image\/svg\+xml/);
    const svg = response.body.toString("utf8");
    expect(svg).toContain("MySQL");
    expect(svg).toContain("<title");
    expect(svg.match(/<path[^>]*marker-end=/g)).toHaveLength(4);
    expect(svg).not.toMatch(/<script|\son\w+=|https?:\/\/(?!www\.w3\.org)/i);
  });

  test("Swagger reference assets and initializer remain usable on the nested route", async () => {
    for (const file of ["", "swagger-ui.css", "swagger-ui-bundle.js", "swagger-ui-standalone-preset.js", "swagger-ui-init.js"]) {
      const response = await request(app).get(`/api-docs/reference/${file}`);
      expect(response.status).toBe(200);
      if (file.endsWith(".js")) expect(response.headers["content-type"]).toMatch(/javascript/);
      if (file === "swagger-ui-init.js") {
        expect(response.text).toContain('"deepLinking": true');
        expect(response.text).toContain('"persistAuthorization": false');
        for (const item of Object.values(spec.paths)) {
          for (const method of ["get", "post", "delete"]) if (item[method]) expect(response.text).toContain(item[method].operationId);
        }
      }
    }
  });

  test("requested footer notices are removed while useful navigation remains", async () => {
    for (const url of ["/", "/api-docs/", "/api-docs/start/"]) {
      const response = await request(app).get(url);
      expect(response.status).toBe(200);
      const footer = response.text.slice(response.text.indexOf("<footer"));
      expect(footer).toContain("href=");
      expect(footer).not.toMatch(/storage-notice|system-status|demo-notice|project-note|โครงงาน|67160003|ภาพหน้าจอ|ภาพอาหาร|สร้างด้วย AI/);
    }
    expect((await request(app).get("/")).text).toContain('href="/api-docs/"');
    const script = (await request(app).get("/app.js")).text;
    expect(script).not.toMatch(/storage-notice|system-status|api\('\/system'\)/);
    const css = (await request(app).get("/styles.css")).text;
    expect(css).not.toMatch(/\.(?:demo-notice|project-note)\b/);
    expect(css).not.toMatch(/\.footer-top(?: p|>a:last-child)\{[^}]*font-size:(?:9|10|11|12|13)px/);
  });
});
