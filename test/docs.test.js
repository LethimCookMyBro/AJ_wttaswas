const fs = require("fs");
const path = require("path");
const request = require("supertest");
const YAML = require("yaml");
const app = require("../src/index");
const spec = YAML.parse(fs.readFileSync(path.join(__dirname, "../openapi.yaml"), "utf8"));

describe("Project evidence and real application demo entry", () => {
  test.each(["/api-docs", "/api-docs/"])("%s is a static project reference rather than a second demo app", async (url) => {
    const response = await request(app).get(url).expect(200);
    expect(response.text).toContain('lang="th"');
    expect(response.text).toContain('name="viewport"');
    expect(response.text).toContain('<h1>เอกสารโครงงาน</h1>');
    expect(response.text).toContain('href="/">เปิดเว็บเพื่อสาธิตจริง</a>');
    expect(response.text).toContain('href="/api-docs/reference/"');
    expect(response.text).toContain('เว็บจะเปิดรายละเอียดสูตรที่สร้างให้ทันที');
    expect(response.text).toContain('Modular Monolith');
    expect(response.text).not.toMatch(/<script|<input|<form|data-step|data-stage|verify-id|created-recipe-id|api-guide\.js|api-docs\/start/);
    expect(response.text).not.toMatch(/guide-(?:login|home|recipe)\.(?:jpg|png|webp)/);
    expect(response.headers["content-security-policy"]).toContain("script-src 'self'");
  });

  test.each(["/api-docs/start", "/api-docs/start/", "/api-start.html"])("old walkthrough URL %s redirects to project reference", async (url) => {
    const response = await request(app).get(url).expect(302);
    expect(response.headers.location).toBe('/api-docs/');
  });

  test('dead companion code is removed, not hidden behind a new landing page', async () => {
    for (const file of ['api-guide.js', 'api-start.html']) {
      expect(fs.existsSync(path.join(__dirname, '../frontend', file))).toBe(false);
    }
    await request(app).get('/api-guide.js').expect(404);
  });

  test('every linked repository evidence file exists in the integrated checkout', async () => {
    const page = (await request(app).get('/api-docs/')).text;
    const links = [...page.matchAll(/href="https:\/\/github\.com\/LethimCookMyBro\/AJ_wttaswas\/(blob|tree)\/main\/([^"#]+)"/g)];
    expect(links.length).toBeGreaterThanOrEqual(10);
    for (const [, type, relative] of links) {
      const target = path.join(__dirname, '..', relative);
      expect({ relative, exists: fs.existsSync(target) }).toEqual({ relative, exists: true });
      expect(type === 'tree' ? fs.statSync(target).isDirectory() : fs.statSync(target).isFile()).toBe(true);
    }
    for (const required of ['coverage-report.md', 'clo-requirements-checklist.md', 'requirement.md', 'schema.sql', 'erd.png', 'postman_collection.json', 'failure-scenario-results.md', 'microservices-design.md', 'scalability-design.md']) expect(page).toContain(required);
  });

  test('local links and assets resolve, anchors are unique and valid', async () => {
    const html = fs.readFileSync(path.join(__dirname, '../frontend/api-guide.html'), 'utf8');
    const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]);
    expect(new Set(ids).size).toBe(ids.length);
    for (const [, url] of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
      if (url.startsWith('#')) expect(ids).toContain(url.slice(1));
      else if (url.startsWith('/')) await request(app).get(url.split('#')[0]).expect(200);
    }
  });

  test('main navigation names project documents, not a separate presentation mode', async () => {
    const page = (await request(app).get('/')).text;
    expect(page).toContain('href="/api-docs/">เอกสารโครงงาน');
    expect(page).not.toMatch(/href="\/api-docs\/">นำเสนอ/);
  });

  test('reference styling is restrained, responsive, and scoped away from product layout', async () => {
    const response = await request(app).get('/api-guide.css').expect(200);
    expect(response.headers['content-type']).toMatch(/text\/css/);
    expect(response.text).toContain('var(--accent)');
    expect(response.text).toContain('@media');
    expect(response.text).toContain('prefers-reduced-motion');
    expect(response.text).not.toMatch(/step-navigation|step-cues|recipe-options|entry-rail|presentation-stages/);
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

  test("requested footer notices stay removed while useful navigation remains", async () => {
    for (const url of ["/", "/api-docs/"]) {
      const response = await request(app).get(url).expect(200);
      const footer = response.text.slice(response.text.indexOf("<footer"));
      expect(footer).toContain("href=");
      expect(footer).not.toMatch(/storage-notice|system-status|demo-notice|project-note|67160003|ภาพหน้าจอ|ภาพอาหาร|สร้างด้วย AI/);
    }
    const script = (await request(app).get("/app.js")).text;
    expect(script).not.toMatch(/storage-notice|system-status|api\('\/system'\)/);
  });
});

test('Swagger narrow response tables are locally contained rather than hiding page overflow', async () => {
  const css = await request(app).get('/api-guide.css').expect(200);
  expect(css.text).toMatch(/\.swagger-ui \.responses-inner\{[^}]*max-width:100%[^}]*overflow-x:auto/);
  expect(css.text).toMatch(/\.swagger-ui \.responses-table\{[^}]*table-layout:fixed/);
  expect(css.text).toMatch(/\.response-col_links\{[^}]*width:58px/);
  expect(css.text).not.toMatch(/(?:html|body)\s*\{[^}]*overflow-x:hidden/);
});

test('Swagger reference has self-contained Thai fonts without depending on product CSS', async () => {
  const page = await request(app).get('/api-docs/reference/').expect(200);
  expect(page.text).toContain('/api-guide.css');
  const css = (await request(app).get('/api-guide.css').expect(200)).text;
  for (const weight of [400, 500, 600]) {
    expect(css).toContain(`@font-face{font-family:'IBM Plex Sans Thai';src:url('/assets/ibm-plex-sans-thai-${weight}.ttf')`);
    await request(app).get(`/assets/ibm-plex-sans-thai-${weight}.ttf`).expect(200);
  }
  expect(css).toMatch(/\.swagger-ui,\.swagger-ui \*\{font-family:'IBM Plex Sans Thai',Tahoma,sans-serif!important\}/);
  expect(css).toMatch(/\.swagger-ui code \*\{font-family:ui-monospace/);
});
