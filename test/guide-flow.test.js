const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../frontend/api-guide.js'), 'utf8');
function node() {
  return { textContent: '', value: '', hidden: false, disabled: false, children: [], dataset: {}, attributes: {}, handlers: {},
    append(...children) { this.children.push(...children); }, replaceChildren(...children) { this.children = children; },
    setAttribute(name, value) { this.attributes[name] = value; }, removeAttribute(name) { delete this.attributes[name]; },
    addEventListener(name, handler) { this.handlers[name] = handler; }, focus: jest.fn() };
}
function harness(respond = () => Promise.resolve(ok([])), browser) {
  const html = fs.readFileSync(path.join(__dirname, '../frontend/api-start.html'), 'utf8');
  const nodes = new Map([...html.matchAll(/\bid="([^"]+)"/g)].map((m) => [m[1], node()]));
  const get = (id) => nodes.get(id) || null;
  const tabs = [1, 2, 3, 4].map((n) => Object.assign(node(), { dataset: { step: String(n) } }));
  const stages = [1, 2, 3, 4].map((n) => Object.assign(node(), { dataset: { stage: String(n) } }));
  const fetch = jest.fn(respond);
  vm.runInNewContext(source, { document: { getElementById: get, querySelectorAll: (selector) => selector === '[data-step]' ? tabs : stages, createElement: node }, fetch, AbortSignal, Date, window: browser });
  return { get, tabs, stages, fetch, click: (id) => get(id).handlers.click(), choose: (i = 0) => get('recipe-options').children[i].children[0].handlers.click(), step: (n) => tabs[n - 1].handlers.click(), submit: () => get('verify-form').handlers.submit({ preventDefault() {} }) };
}
const ok = (data) => ({ ok: true, status: 200, json: async () => ({ data }) });
const recipes = [{ id: 7, name: '<img src=x onerror=alert(1)>', cook_time_minutes: 8 }, { id: 9, name: 'ไข่เจียว', cook_time_minutes: 10 }];
const recipe = { ...recipes[0], instructions: '1. เตรียมไข่\n2. ทอดให้สุก', ingredients: [{ name: 'ไข่', quantity: 2, unit: 'pieces' }] };
const reviews = { ratingCount: 1, averageScore: 4, ratings: [{ username: 'fixture', ratingScore: 4, reviewComment: 'ทดสอบ' }] };

test('actual HTML mounts controller without missing elements and no automatic requests', () => {
  const h = harness();
  expect(h.fetch).not.toHaveBeenCalled();
  expect(h.stages.map((s) => s.hidden)).toEqual([false, true, true, true]);
  expect(h.get('step-next').disabled).toBe(true);
  expect(h.tabs[1].disabled).toBe(true);
});
test('controller is GET only and never accesses credentials or interpolates HTML', () => {
  expect(source).toContain("method: 'GET'");
  expect(source).toContain("credentials: 'omit'");
  expect(source).not.toMatch(/innerHTML|localStorage|sessionStorage|Authorization|method:\s*['"](?:POST|DELETE|PUT|PATCH)/);
});
test('read list, explicitly choose recipe, read ingredients, then continue into manual stages', async () => {
  const h = harness((url) => Promise.resolve(ok(url.includes('?') ? recipes : recipe)));
  await h.click('load-recipes');
  expect(h.get('step-next').disabled).toBe(true);
  expect(h.get('recipe-options').children[0].children[0].children[0].textContent).toBe(recipes[0].name);
  h.choose();
  expect(h.get('step-next').disabled).toBe(false);
  h.click('step-next');
  expect(h.get('step-count').textContent).toBe('2 / 4');
  expect(h.get('step-next').disabled).toBe(true);
  await h.click('load-detail');
  expect(h.get('detail-result').hidden).toBe(false);
  expect(h.get('detail-result').children[0].children[0].textContent).toBe('ไข่ · 2 ชิ้น');
  expect(h.get('detail-extra').children[0].children.map((x) => x.textContent)).toEqual(['เตรียมไข่', 'ทอดให้สุก']);
  expect(h.get('request-log').textContent).toContain('pieces');
  h.click('step-next');
  expect(h.get('step-count').textContent).toBe('3 / 4');
  expect(h.get('step-next').disabled).toBe(true);
  h.get('created-recipe-id').value = '22'; h.get('created-recipe-id').handlers.input();
  h.click('step-next');
  expect(h.get('step-finish').hidden).toBe(false);
  expect(h.get('step-next').hidden).toBe(true);
  expect(h.get('verify-id').value).toBe('22');
  expect(h.get('review-app-link').href).toBe('/#recipe/22');
  expect(h.fetch.mock.calls.map(([url]) => url)).toEqual(['/api/v1/recipes?limit=3', '/api/v1/recipes/7']);
});
test('step navigation focuses heading and previous preserves selection', async () => {
  const h = harness(() => Promise.resolve(ok(recipes)));
  await h.click('load-recipes'); h.choose(); h.click('step-next');
  expect(h.get('step-heading-2').focus).toHaveBeenCalled();
  h.click('step-previous');
  expect(h.get('step-count').textContent).toBe('1 / 4');
  expect(h.get('step-next').disabled).toBe(false);
});
test('manual creation and verification remain reachable when list is empty', async () => {
  const h = harness(); await h.click('load-recipes');
  expect(h.tabs[1].disabled).toBe(true);
  expect(h.get('recipes-status').textContent).toContain('ยังไม่มีสูตร');
  h.step(3); expect(h.get('step-count').textContent).toBe('3 / 4');
});
test('changing selected recipe clears old detail and updates app link', async () => {
  const h = harness((url) => Promise.resolve(ok(url.includes('?') ? recipes : recipe)));
  await h.click('load-recipes'); h.choose(); h.step(2); await h.click('load-detail');
  h.step(1); h.choose(1); h.step(2);
  expect(h.get('detail-result').hidden).toBe(true);
  expect(h.get('step-next').disabled).toBe(true);
  expect(h.get('selected-recipe-name').textContent).toBe('ไข่เจียว');
});
test('refresh failure clears stale selection and does not enable detail', async () => {
  const h = harness(jest.fn().mockResolvedValueOnce(ok(recipes)).mockRejectedValueOnce(new Error('offline')));
  await h.click('load-recipes'); h.choose(); await h.click('load-recipes');
  expect(h.get('recipe-options').children).toHaveLength(0);
  expect(h.tabs[1].disabled).toBe(true);
  expect(h.get('step-next').disabled).toBe(true);
  expect(h.get('recipes-status').textContent).toContain('offline');
});
test('HTTP errors retain code and message without enabling next', async () => {
  const h = harness(() => Promise.resolve({ ok: false, status: 429, json: async () => ({ error: { message: 'ส่งคำขอถี่เกินไป' } }) }));
  await h.click('load-recipes');
  expect(h.get('request-log').textContent).toContain('HTTP 429');
  expect(h.get('recipes-status').textContent).toContain('ส่งคำขอถี่เกินไป');
  expect(h.get('step-next').disabled).toBe(true);
});
test.each(['TimeoutError', 'AbortError'])('%s gives retryable error and unlocks controls', async (name) => {
  const error = new Error('timeout'); error.name = name;
  const h = harness(() => Promise.reject(error)); await h.click('load-recipes');
  expect(h.get('recipes-status').textContent).toContain('เซิร์ฟเวอร์ใช้เวลานานเกินไป');
  expect(h.get('load-recipes').disabled).toBe(false);
});
test.each([
  { ok: true, status: 200, json: async () => { throw new Error('invalid'); } },
  ok({ unexpected: true }),
])('bad JSON or schema does not enable next', async (response) => {
  const h = harness(() => Promise.resolve(response)); await h.click('load-recipes');
  expect(h.get('recipes-status').textContent).toContain('อ่านไม่สำเร็จ');
  expect(h.get('step-next').disabled).toBe(true);
});
test('pending reads block duplicate actions and stage changes', async () => {
  let resolve;
  const h = harness(() => new Promise((done) => { resolve = done; }));
  const pending = h.click('load-recipes');
  expect(h.tabs.every((t) => t.disabled)).toBe(true);
  h.step(4); await h.click('load-recipes');
  expect(h.get('step-count').textContent).toBe('1 / 4');
  expect(h.fetch).toHaveBeenCalledTimes(1);
  resolve(ok(recipes)); await pending;
  expect(h.get('load-recipes').disabled).toBe(false);
});
test('optional catalog read retains distinct ingredient IDs', async () => {
  const h = harness(() => Promise.resolve(ok([{ id: 5, name: 'ไข่' }])));
  await h.click('load-catalog');
  expect(h.fetch.mock.calls[0][0]).toBe('/api/v1/ingredients');
  expect(h.get('catalog-result').children[0].children[0].textContent).toBe('ไข่ · รหัส 5');
});
test('verification reads recipe and ratings, logs results, no mutations', async () => {
  const h = harness((url) => Promise.resolve(ok(url.endsWith('/ratings') ? reviews : recipe)));
  h.step(4); h.get('verify-id').value = '7'; await h.submit();
  expect(h.fetch.mock.calls.map(([url]) => url)).toEqual(['/api/v1/recipes/7', '/api/v1/recipes/7/ratings']);
  expect(h.get('verify-result').hidden).toBe(false);
  expect(h.get('verify-status').textContent).toContain('อ่านสูตรและรีวิวสำเร็จ');
  expect(h.get('request-log').textContent).toContain('HTTP 200');
  expect(h.get('verify-app-link').href).toBe('/#recipe/7');
  for (const [, options] of h.fetch.mock.calls) { expect(options.method).toBe('GET'); expect(options.credentials).toBe('omit'); }
});
test.each(['0', '-2', '1.5', '1e2', '9007199254740992', 'x', ''])('invalid ID %s does not request', async (value) => {
  const h = harness(); h.get('verify-id').value = value; await h.submit();
  expect(h.fetch).not.toHaveBeenCalled();
  expect(h.get('verify-status').textContent).toContain('จำนวนเต็มบวก');
});
test('partial verification hides old results and retains actual failed HTTP response', async () => {
  const h = harness((url) => Promise.resolve(url.endsWith('/ratings') ? { ok: false, status: 503, json: async () => ({ error: { message: 'unavailable' } }) } : ok(recipe)));
  h.step(4); h.get('verify-id').value = '7'; await h.submit();
  expect(h.get('verify-result').hidden).toBe(true);
  expect(h.get('verify-app-link').hidden).toBe(true);
  expect(h.get('verify-status').textContent).toContain('อ่านไม่สำเร็จ');
  expect(h.get('request-log').textContent).toContain('HTTP 503');
  expect(h.get('verify-run').disabled).toBe(false);
});
test('duplicate verification is suppressed until both reads finish', async () => {
  let resolve;
  const h = harness(jest.fn().mockImplementationOnce(() => new Promise((done) => { resolve = done; })).mockResolvedValueOnce(ok(reviews)));
  h.step(4); h.get('verify-id').value = '7'; const pending = h.submit(); await h.submit();
  expect(h.fetch).toHaveBeenCalledTimes(1); expect(h.get('verify-id').disabled).toBe(true);
  resolve(ok(recipe)); await pending;
  expect(h.fetch).toHaveBeenCalledTimes(2); expect(h.get('verify-id').disabled).toBe(false);
});
test('step logs stay associated with selected stage', async () => {
  const h = harness(() => Promise.resolve(ok(recipes))); await h.click('load-recipes');
  h.step(3); expect(h.get('request-log').textContent).toContain('ยังไม่ได้');
  h.step(1); expect(h.get('request-log').textContent).toContain('/api/v1/recipes?limit=3');
});
test('newly saved recipe ID is carried to readback and optional review, independently of browse selection', async () => {
  const h = harness(() => Promise.resolve(ok(recipes)));
  await h.click('load-recipes'); h.choose();
  expect(h.get('verify-id').value).toBe('');
  h.step(3); h.get('created-recipe-id').value = '24'; h.get('created-recipe-id').handlers.input();
  expect(h.get('verify-id').value).toBe('24');
  expect(h.get('review-app-link').href).toBe('/#recipe/24');
  h.step(1); await h.click('load-recipes');
  expect(h.get('verify-id').value).toBe('24');
  h.step(3); h.get('created-recipe-id').value = '-1'; h.get('created-recipe-id').handlers.input();
  expect(h.get('step-next').disabled).toBe(true);
  expect(h.get('verify-id').value).toBe('');
  expect(h.get('review-app-link').href).toBe('/#recipes');
});
test('manual verification ID changes keep optional review on that exact recipe', () => {
  const h = harness(); h.step(4);
  h.get('verify-id').value = '41'; h.get('verify-id').handlers.input();
  expect(h.get('review-app-link').href).toBe('/#recipe/41');
  h.get('verify-id').value = 'x'; h.get('verify-id').handlers.input();
  expect(h.get('review-app-link').href).toBe('/#recipes');
});

test('browser Back restores a stage without issuing requests, including after a pending request', async () => {
  const handlers = {};
  const browser = { location: { hash: '' }, history: { pushState: jest.fn((a,b,hash) => { browser.location.hash = hash; }) }, addEventListener: (name, fn) => { handlers[name] = fn; } };
  let resolve;
  const h = harness(() => new Promise((done) => { resolve = done; }), browser);
  h.step(3); expect(browser.location.hash).toBe('#step-3');
  h.step(1); const pending = h.click('load-recipes');
  browser.location.hash = '#step-3'; handlers.popstate();
  expect(h.get('step-count').textContent).toBe('1 / 4');
  resolve(ok(recipes)); await pending;
  expect(h.get('step-count').textContent).toBe('3 / 4');
  browser.location.hash = ''; handlers.popstate();
  expect(h.get('step-count').textContent).toBe('1 / 4');
  expect(h.fetch).toHaveBeenCalledTimes(1);
});
test.each(['verify-id', 'created-recipe-id'])('changing %s invalidates earlier readback evidence without sending another request', async (field) => {
  const h = harness((url) => Promise.resolve(ok(url.endsWith('/ratings') ? reviews : recipe)));
  h.step(4); h.get('verify-id').value = '7'; await h.submit();
  expect(h.get('verify-result').hidden).toBe(false);
  expect(h.get('verify-app-link').hidden).toBe(false);
  expect(h.get('request-log').textContent).toContain('/api/v1/recipes/7');
  if (field === 'created-recipe-id') h.step(3);
  h.get(field).value = '24'; h.get(field).handlers.input();
  expect(h.get('verify-result').hidden).toBe(true);
  expect(h.get('verify-result').children).toHaveLength(0);
  expect(h.get('verify-app-link').hidden).toBe(true);
  expect(h.get('verify-status').textContent).not.toContain('สำเร็จ');
  expect(h.get('verify-status').textContent).toContain('ยังไม่ได้ตรวจผล');
  h.step(4);
  expect(h.get('request-log').textContent).not.toContain('/api/v1/recipes/7');
  expect(h.get('review-app-link').href).toBe('/#recipe/24');
  expect(h.fetch).toHaveBeenCalledTimes(2);
});
