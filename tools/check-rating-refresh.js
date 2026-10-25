const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const sourcePath = process.argv[2] || path.resolve(__dirname, '../frontend/app.js');
const source = fs.readFileSync(sourcePath, 'utf8').replace(/start\(\);\s*$/, '');

function node(id = '') {
  return {
    id, textContent: '', value: '', hidden: false, disabled: false,
    dataset: {}, children: [], handlers: {},
    classList: { toggle() {} }, setAttribute() {}, removeAttribute() {},
    append(...children) { this.children.push(...children); },
    replaceChildren(...children) { this.children = children; },
    addEventListener(type, handler) { this.handlers[type] = handler; },
    querySelector() { return node(); }, querySelectorAll() { return []; },
    reset() {}, focus() {}, scrollIntoView() {},
  };
}
function harness(respond) {
  const nodes = new Map(), requests = [], timeouts = [];
  const document = {
    title: '', getElementById(id) { if (!nodes.has(id)) nodes.set(id, node(id)); return nodes.get(id); },
    createElement: node, createTextNode: (textContent) => ({ textContent }),
    querySelector() { return node(); }, querySelectorAll() { return []; },
  };
  const context = vm.createContext({
    document, location: { hash: '#recipe/3' }, window: { addEventListener() {}, scrollTo() {} },
    AbortSignal: { timeout(ms) { timeouts.push(ms); return AbortSignal.timeout(ms); } }, TextEncoder, URLSearchParams, setTimeout, clearTimeout, console,
    fetch: async (url, options) => { requests.push({ url, ...options }); return respond(url, options); },
  });
  vm.runInContext(source, context, { filename: sourcePath });
  const run = (code) => vm.runInContext(code, context);
  const get = document.getElementById.bind(document);
  const submit = (id) => get(id).handlers.submit({ preventDefault() {}, target: get(id) });
  return { run, get, submit, requests, context, timeouts };
}
const ok = (data, extra = {}) => ({ ok: true, status: 200, json: async () => ({ data, ...extra }) });
const denied = (status, message) => ({ ok: false, status, json: async () => ({ error: { message } }) });
const recipe = { id: 3, name: 'fixture recipe', category_name: 'fixture category', cook_time_minutes: 15, difficulty: 'easy', instructions: 'test', ingredients: [] };
const session = "state.session = { token: 'fixture-token', user: { id: 1, username: 'fixture', role: 'chef' } };";

async function rating(refreshFails) {
  const h = harness((url, options) => {
    if (options.method === 'POST') return ok({});
    if (refreshFails) return denied(503, 'forced GET 503');
    return ok(url.endsWith('/ratings') ? { ratingCount: 1, averageScore: 5, ratings: [{ username: 'fixture', ratingScore: 5, reviewComment: 'test' }] } : recipe);
  });
  h.run(`${session} state.selectedId = 3; state.detailRequest = 1; state.detailReady = true;`);
  h.get('score').value = '5'; h.get('review').value = 'test';
  await h.submit('rating-form');
  const post = h.requests.find((r) => r.method === 'POST');
  assert.equal(post.headers.Authorization, 'Bearer fixture-token');
  assert.equal(Object.hasOwn(JSON.parse(post.body), 'userId'), false);
  if (refreshFails) {
    assert.equal(h.get('detail-heading').textContent, 'เปิดสูตรอาหารไม่ได้');
    assert.match(h.get('detail-status').textContent, /forced GET 503/);
    assert.doesNotMatch(h.get('rating-status').textContent, /อัปเดตจาก API แล้ว/);
    assert.equal(h.get('rating-fields').disabled, true);
  } else {
    assert.equal(h.get('detail-heading').textContent, recipe.name);
    assert.match(h.get('rating-status').textContent, /อัปเดตจาก API แล้ว/);
    assert.equal(h.get('rating-fields').disabled, false);
  }
  console.log(`PASS rating POST success + GET ${refreshFails ? 'failure keeps fields disabled and truthful status' : 'success updates displayed result'}`);
}
async function auth() {
  const h = harness((url, options) => {
    if (url.endsWith('/auth/login')) return JSON.parse(options.body).password === 'correct'
      ? ok({ token: 'fixture-token', user: { id: 1, username: 'fixture', role: 'chef' } }) : denied(401, 'Invalid username or password');
    return ok({ id: 10, name: 'created' });
  });
  h.run('renderSession()');
  assert.equal(h.get('create-fields').disabled, true);
  await h.submit('recipe-form'); await h.submit('rating-form');
  assert.equal(h.requests.length, 0, 'signed-out form handlers cannot send writes');
  h.get('username').value = 'fixture'; h.get('password').value = 'wrong';
  await h.submit('login-form');
  assert.match(h.get('login-status').textContent, /Invalid username/);
  assert.equal(h.run('state.session'), null);
  h.get('password').value = 'correct';
  await h.submit('login-form');
  assert.equal(h.get('password').value, '');
  assert.equal(h.get('create-fields').disabled, false);
  assert.equal(h.get('logout').hidden, false);
  assert.equal(h.get('session-user').textContent, 'fixture · chef');
  h.run("state.session.user.role = 'member'; renderSession()");
  assert.equal(h.get('create-fields').disabled, true);
  h.get('logout').handlers.click();
  assert.equal(h.run('state.session'), null);
  assert.equal(h.get('rating-fields').disabled, true);
  assert.equal(h.get('login-link').hidden, false);
  const expired = harness(() => denied(401, 'expired'));
  expired.run(session);
  await assert.rejects(expired.run("api('/recipes', { method: 'POST' })"), /เซสชันหมดอายุ/);
  assert.equal(expired.run('state.session'), null);
  assert.equal(expired.get('create-fields').disabled, true);
  console.log('PASS login failure, login success, role guard, logout and expired token clear session');
}
async function create() {
  const h = harness((url, options) => options.method === 'POST'
    ? ok({ id: 10, name: 'created' })
    : ok([], { pagination: { page: 1, limit: 9, total: 0, totalPages: 0 } }));
  h.run(session);
  for (const [id, value] of Object.entries({ name: 'created', category: '1', steps: 'test steps', minutes: '10', difficulty: 'easy' })) h.get(id).value = value;
  await h.submit('recipe-form');
  const post = h.requests.find((r) => r.method === 'POST');
  assert.equal(post.headers.Authorization, 'Bearer fixture-token');
  assert.equal(Object.hasOwn(JSON.parse(post.body), 'authorId'), false);
  assert.equal(h.run('location.hash'), 'recipe/10');
  assert.match(h.get('recipe-success').textContent, /created/);
  assert.equal(new URL(h.requests.at(-1).url, 'http://fixture').searchParams.get('sort'), 'id_desc');
  console.log('PASS recipe creation uses token without authorId and opens persisted result');
}
async function pagination() {
  const h = harness((url) => {
    const page = Number(new URL(url, 'http://fixture').searchParams.get('page'));
    return ok([{ ...recipe, id: page }], { pagination: { page, limit: 9, total: 10, totalPages: 2 } });
  });
  await h.run('loadRecipes()');
  assert.equal(h.get('next-page').disabled, false);
  assert.equal(h.get('previous-page').disabled, true);
  h.run("state.page = 2; state.filter = '3'; state.search = 'ไข่ %_'; state.sort = 'cook_time_asc';");
  await h.run('loadRecipes()');
  const query = new URL(h.requests.at(-1).url, 'http://fixture').searchParams;
  assert.equal(query.get('page'), '2'); assert.equal(query.get('limit'), '9');
  assert.equal(query.get('categoryId'), '3'); assert.equal(query.get('search'), 'ไข่ %_');
  assert.equal(query.get('sort'), 'cook_time_asc');
  assert.equal(h.get('page-status').textContent, 'หน้า 2 จาก 2');
  assert.equal(h.get('next-page').disabled, true); assert.equal(h.get('previous-page').disabled, false);
  assert.equal(h.get('recipe-list').children.length, 1);
  assert.match(h.get('list-status').textContent, /ทั้งหมด 10 สูตร/);
  console.log('PASS pagination, server search/category/sort query and navigation boundaries');
}
async function timeoutBudget() {
  const h = harness(() => ok([]));
  await h.run("api('/recipes')");
  await h.run("api('/external/meal-ideas?ingredient=rice')");
  assert.deepEqual(h.timeouts, [6000, 12000], 'external UI must outlast default three attempts plus backoff');
  console.log('PASS external UI timeout covers default 9900ms fallback budget; ordinary API retains 6000ms');
}
(async () => { await rating(true); await rating(false); await auth(); await create(); await pagination(); await timeoutBudget(); })().catch((error) => { console.error(error); process.exitCode = 1; });
