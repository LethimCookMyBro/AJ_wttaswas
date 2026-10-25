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
    expect(response.text).not.toMatch(/<pre\b/);
    expect([...response.text.matchAll(/<img\b/g)].length).toBeGreaterThanOrEqual(3);
    expect(response.text).toContain('/assets/guide-home.jpg');
    for (const image of response.text.matchAll(/<img\b[^>]*>/g)) {
      expect(image[0]).toMatch(/alt="[^"]+"/);
      expect(image[0]).toMatch(/width="\d+"/);
      expect(image[0]).toMatch(/height="\d+"/);
    }
    expect(response.text).not.toMatch(/<script(?! src="\/api-guide\.js" defer><\/script>)|\son\w+=/i);
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
    expect(response.text).toContain('src="/api-guide.js" defer');
    expect(response.text).toContain('id="live-lab"');
    expect(response.text).toContain('href="/#create"');
    expect(response.text).toContain('href="/#login"');
    expect(response.text).not.toMatch(/<input[^>]*type="password"/i);
    expect(response.text).toContain("15 นาที");
    expect(response.text).toContain("ไม่ต้องใส่คำว่า Bearer");
    expect(response.text.indexOf("ข้อมูลจริง")).toBeLessThan(response.text.indexOf('"name": "ไข่เจียวทดสอบ"'));
    expect(response.text).not.toMatch(/<script(?! src="\/api-guide\.js" defer><\/script>)|\son\w+=/i);
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

  test("guide links, local anchors, and asset paths resolve", async () => {
    const pages = ["api-guide.html", "api-start.html"];
    const destinations = new Set();
    for (const file of pages) {
      const html = fs.readFileSync(path.join(__dirname, "../frontend", file), "utf8");
      const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]);
      expect(new Set(ids).size).toBe(ids.length);
      for (const [, url] of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
        if (url.startsWith("#")) expect(ids).toContain(url.slice(1));
        else if (url.startsWith("/")) destinations.add(url.split("#")[0]);
      }
    }
    for (const url of destinations) {
      const response = await request(app).get(url);
      expect({ url, status: response.status }).toEqual({ url, status: 200 });
      if (/\/guide-(home|recipe|login)\.jpg$/.test(url)) {
        expect(response.headers["content-type"]).toMatch(/image\/jpeg/);
        expect(response.body[0]).toBe(0xff);
        expect(response.body[1]).toBe(0xd8);
      }
    }
  });

  test("beginner flow uses native keyboard-accessible disclosures and no font arrows", async () => {
    for (const route of ["/api-docs/", "/api-docs/start/"]) {
      const html = (await request(app).get(route)).text;
      expect(html).not.toMatch(/[↗↓←]/);
      expect(html).toContain('class="guide-arrow"');
    }
    const overview = (await request(app).get("/api-docs/")).text;
    expect(overview).toContain('flow-disclosures');
    expect(overview).toContain('ไม่ได้ส่งคำขอจริง');
    const start = (await request(app).get("/api-docs/start/")).text;
    expect(start).toContain('id="verify-form"');
    expect(start).toContain('6. ตรวจจาก API อีกครั้ง');
    expect(start).not.toMatch(/<details[^>]*request-inspector[^>]*\bopen\b/);
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

describe('Read-only API walkthrough', () => {
  const vm = require('node:vm');
  const source = fs.readFileSync(path.join(__dirname, '../frontend/api-guide.js'), 'utf8');
  function node() {
    return { textContent: '', value: '', hidden: false, disabled: false, children: [], dataset: {}, attributes: {}, handlers: {},
      append(...children) { this.children.push(...children); },
      replaceChildren(...children) { this.children = children; },
      setAttribute(name, value) { this.attributes[name] = value; },
      removeAttribute(name) { delete this.attributes[name]; },
      addEventListener(name, handler) { this.handlers[name] = handler; },
      focus() {},
    };
  }
  function harness(respond) {
    const nodes = new Map();
    const get = (id) => { if (!nodes.has(id)) nodes.set(id, node()); return nodes.get(id); };
    const steps = ['recipes', 'detail', 'ingredients'].map((step) => Object.assign(node(), { dataset: { liveStep: step } }));
    const fetch = jest.fn(respond);
    vm.runInNewContext(source, { document: { getElementById: get, querySelectorAll: () => steps, createElement: node }, fetch, AbortSignal, Date });
    return { get, steps, fetch, click: (id) => get(id).handlers.click() };
  }
  const ok = (data) => ({ ok: true, status: 200, json: async () => ({ data }) });
  const recipes = [{ id: 7, name: '<img src=x onerror=alert(1)>', cook_time_minutes: 8 }];

  test('served external script performs only explicit GET requests and never reads credentials', async () => {
    const response = await request(app).get('/api-guide.js');
    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toMatch(/javascript/);
    expect(response.text).toContain("method: 'GET'");
    expect(response.text).toContain("credentials: 'omit'");
    expect(response.text).not.toMatch(/innerHTML|localStorage|sessionStorage|Authorization|method:\s*['"](?:POST|DELETE|PUT|PATCH)/);
  });

  test('walks from live list to chosen detail to catalog, with no automatic requests', async () => {
    const h = harness((url) => Promise.resolve(ok(url.includes('?') ? recipes : url.endsWith('/7') ? { ...recipes[0], instructions: 'ทอดไข่', ingredients: [{ name: 'ไข่', quantity: 2, unit: 'ฟอง' }] } : [{ id: 5, name: 'ไข่' }])));
    expect(h.fetch).not.toHaveBeenCalled();
    expect(h.steps[1].disabled).toBe(true);
    await h.click('live-run');
    expect(h.get('live-response').textContent).toContain(recipes[0].name);
    expect(h.get('live-recipe').children[0].textContent).toBe(recipes[0].name);
    expect(h.steps[1].disabled).toBe(false);
    h.click('live-continue');
    expect(h.get('live-path').textContent).toBe('/api/v1/recipes/7');
    await h.click('live-run');
    expect(h.steps[2].disabled).toBe(false);
    expect(h.get('live-app-link').href).toBe('/#recipe/7');
    h.click('live-continue');
    await h.click('live-run');
    expect(h.fetch.mock.calls.map(([url]) => url)).toEqual(['/api/v1/recipes?limit=3', '/api/v1/recipes/7', '/api/v1/ingredients']);
    for (const [, options] of h.fetch.mock.calls) { expect(options.method).toBe('GET'); expect(options.credentials).toBe('omit'); }
    expect(h.get('live-status').textContent).toContain('อ่านสำเร็จ');
  });

  test('empty lists do not enable nonexistent detail steps', async () => {
    const h = harness(() => Promise.resolve(ok([])));
    await h.click('live-run');
    expect(h.steps[1].disabled).toBe(true);
    expect(h.get('live-next').hidden).toBe(true);
    expect(h.get('live-result').children[0].textContent).toBe('ยังไม่มีสูตรในระบบ');
  });

  test('network errors are retryable and do not show stale results', async () => {
    const h = harness(jest.fn().mockResolvedValueOnce(ok(recipes)).mockRejectedValueOnce(new Error('offline')));
    await h.click('live-run');
    await h.click('live-run');
    expect(h.get('live-result').hidden).toBe(true);
    expect(h.get('live-status').textContent).toContain('offline');
    expect(h.get('live-response').textContent).toBe('ไม่มีผลตอบกลับ JSON');
    expect(h.get('live-run').disabled).toBe(false);
    expect(h.steps[1].disabled).toBe(true);
    expect(h.get('live-app-link').href).toBe('/#recipes');
  });

  test('HTTP errors expose the actual response without advancing', async () => {
    const h = harness(() => Promise.resolve({ ok: false, status: 429, json: async () => ({ error: { message: 'ส่งคำขอถี่เกินไป' } }) }));
    await h.click('live-run');
    expect(h.get('live-response-code').textContent).toBe('HTTP 429');
    expect(h.get('live-status').textContent).toContain('ส่งคำขอถี่เกินไป');
    expect(h.steps[1].disabled).toBe(true);
  });

  test('detail renders explicit cooking steps and Thai units while retaining raw JSON', async () => {
    const recipe = { ...recipes[0], instructions: '1. เตรียมไข่\n2. ทอดให้สุก', ingredients: [{ name: 'ไข่', quantity: 2, unit: 'pieces' }, { name: 'น้ำมัน', quantity: 1, unit: 'ช้อนโต๊ะ' }] };
    const h = harness((url) => Promise.resolve(ok(url.includes('?') ? recipes : recipe)));
    await h.click('live-run');
    h.click('live-continue');
    await h.click('live-run');
    const content = h.get('live-result').children;
    const steps = content.find((item) => item.className === 'live-instructions');
    expect(steps.children.map((item) => item.textContent)).toEqual(['เตรียมไข่', 'ทอดให้สุก']);
    const ingredients = content.find((item) => item.className === 'live-items');
    expect(ingredients.children.map((item) => item.textContent)).toEqual(['ไข่ · 2 ชิ้น', 'น้ำมัน · 1 ช้อนโต๊ะ']);
    expect(h.get('live-response').textContent).toContain('pieces');
  });

  test('verification reads real recipe and ratings and never mutates', async () => {
    const h = harness((url) => Promise.resolve(ok(url.endsWith('/ratings') ? { ratingCount: 1, averageScore: 4, ratings: [{ username: 'fixture', ratingScore: 4, reviewComment: 'ทดสอบ' }] } : { ...recipes[0], ingredients: [{ name: 'ไข่', quantity: 2, unit: 'ฟอง' }] })));
    h.get('verify-id').value = '7';
    await h.get('verify-form').handlers.submit({ preventDefault() {} });
    expect(h.fetch.mock.calls.map(([url]) => url)).toEqual(['/api/v1/recipes/7', '/api/v1/recipes/7/ratings']);
    expect(h.get('verify-result').hidden).toBe(false);
    expect(h.get('verify-status').textContent).toContain('อ่านสูตรและรีวิวสำเร็จ');
    expect(h.get('verify-response').textContent).toContain('HTTP 200');
    expect(h.get('verify-app-link').href).toBe('/#recipe/7');
    for (const [, options] of h.fetch.mock.calls) { expect(options.method).toBe('GET'); expect(options.credentials).toBe('omit'); }
  });

  test.each(['0', '-2', '1.5', '1e2', '9007199254740992', 'x'])('verification rejects invalid recipe ID %s without requesting', async (value) => {
    const h = harness(() => Promise.resolve(ok({})));
    h.get('verify-id').value = value;
    await h.get('verify-form').handlers.submit({ preventDefault() {} });
    expect(h.fetch).not.toHaveBeenCalled();
    expect(h.get('verify-status').textContent).toContain('จำนวนเต็มบวก');
  });

  test('verification hides earlier result if reviews fail and retains the actual request log', async () => {
    const h = harness((url) => Promise.resolve(url.endsWith('/ratings') ? { ok: false, status: 503, json: async () => ({ error: { message: 'unavailable' } }) } : ok({ ...recipes[0], ingredients: [] })));
    h.get('verify-id').value = '7';
    await h.get('verify-form').handlers.submit({ preventDefault() {} });
    expect(h.get('verify-result').hidden).toBe(true);
    expect(h.get('verify-app-link').hidden).toBe(true);
    expect(h.get('verify-status').textContent).toContain('ตรวจผลไม่ครบ');
    expect(h.get('verify-response').textContent).toContain('HTTP 503');
    expect(h.get('verify-run').disabled).toBe(false);
  });

  test('verification blocks duplicate submissions until both reads finish', async () => {
    let resolve;
    const h = harness(jest.fn().mockImplementationOnce(() => new Promise((done) => { resolve = done; })).mockResolvedValueOnce(ok({ ratingCount: 0, ratings: [] })));
    h.get('verify-id').value = '7';
    const pending = h.get('verify-form').handlers.submit({ preventDefault() {} });
    await h.get('verify-form').handlers.submit({ preventDefault() {} });
    expect(h.fetch).toHaveBeenCalledTimes(1);
    expect(h.get('verify-id').disabled).toBe(true);
    resolve(ok({ ...recipes[0], ingredients: [] }));
    await pending;
    expect(h.fetch).toHaveBeenCalledTimes(2);
    expect(h.get('verify-id').disabled).toBe(false);
  });

  test('changing recipe invalidates earlier detail and catalog access', async () => {
    const h = harness((url) => Promise.resolve(ok(url.includes('?') ? [...recipes, { id: 9, name: 'สูตรที่สอง', cook_time_minutes: 20 }] : { ...recipes[0], ingredients: [] })));
    await h.click('live-run');
    h.click('live-continue');
    await h.click('live-run');
    expect(h.steps[2].disabled).toBe(false);
    h.get('live-recipe').value = '9';
    h.get('live-recipe').handlers.change();
    expect(h.steps[2].disabled).toBe(true);
    expect(h.get('live-result').hidden).toBe(true);
    expect(h.get('live-path').textContent).toBe('/api/v1/recipes/9');
    expect(h.get('review-app-link').href).toBe('/#recipe/9');
  });

  test.each(['TimeoutError', 'AbortError'])('%s leaves a retryable timeout message', async (name) => {
    const error = new Error('timeout'); error.name = name;
    const h = harness(() => Promise.reject(error));
    await h.click('live-run');
    expect(h.get('live-status').textContent).toContain('เซิร์ฟเวอร์ใช้เวลานานเกินไป');
    expect(h.get('live-run').disabled).toBe(false);
  });

  test('non-JSON and unexpected response shapes do not enable steps', async () => {
    for (const response of [
      { ok: true, status: 200, json: async () => { throw new Error('invalid JSON'); } },
      ok({ unexpected: true }),
    ]) {
      const h = harness(() => Promise.resolve(response));
      await h.click('live-run');
      expect(h.get('live-status').textContent).toContain('อ่านไม่สำเร็จ');
      expect(h.get('live-result').hidden).toBe(true);
      expect(h.steps[1].disabled).toBe(true);
    }
  });

  test('in-flight requests disable controls and duplicate clicks do not request twice', async () => {
    let resolve;
    const h = harness(() => new Promise((done) => { resolve = done; }));
    const pending = h.click('live-run');
    expect(h.get('live-run').disabled).toBe(true);
    h.steps[1].handlers.click();
    h.get('live-recipe').value = '999';
    h.get('live-recipe').handlers.change();
    expect(h.get('live-path').textContent).not.toContain('999');
    await h.click('live-run');
    expect(h.fetch).toHaveBeenCalledTimes(1);
    resolve(ok(recipes));
    await pending;
    expect(h.get('live-run').disabled).toBe(false);
  });
});
