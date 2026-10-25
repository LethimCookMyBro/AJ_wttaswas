const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const sourcePath = process.argv[2] || path.resolve(__dirname, '../frontend/app.js');
const source = fs.readFileSync(sourcePath, 'utf8').replace(/start\(\);\s*$/, '');

function node(id = '') {
  return {
    id, textContent: '', value: '', hidden: false, disabled: false,
    get firstChild() { return this.children[0]; },
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
    createElement: node, createElementNS: (_ns, tag) => node(tag), createTextNode: (textContent) => ({ textContent }),
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
async function ingredientWorkflow() {
  let resolvePost;
  const h = harness((url, options) => options.method === 'POST'
    ? new Promise((resolve) => { resolvePost = resolve; })
    : ok([], { pagination: { page: 1, limit: 9, total: 0, totalPages: 0 } }));
  h.run(session);
  const rows = [{ ingredientId: '1', quantity: '2.5', unit: 'กรัม' }];
  h.get('ingredient-rows').querySelectorAll = () => rows.map((row) => ({
    querySelector: (selector) => ({ value: row[selector.includes('ingredient') ? 'ingredientId' : selector.includes('quantity') ? 'quantity' : 'unit'] }),
  }));
  for (const [id, value] of Object.entries({ name: 'atomic fixture', category: '1', steps: 'test steps', minutes: '10', difficulty: 'easy' })) h.get(id).value = value;
  rows.push({ ...rows[0] });
  await h.submit('recipe-form');
  assert.equal(h.requests.length, 0, 'duplicate ingredients are rejected before network');
  assert.match(h.get('create-status').textContent, /ซ้ำ/);
  rows.pop(); rows[0].quantity = '1.234';
  await h.submit('recipe-form');
  assert.equal(h.requests.length, 0, 'precision mismatch is rejected before network');
  rows[0].quantity = '2.5';
  const pending = h.submit('recipe-form');
  await h.submit('recipe-form');
  assert.equal(h.requests.length, 1, 'double submit sends one atomic write');
  assert.equal(h.get('create-fields').disabled, true);
  assert.deepEqual(JSON.parse(h.requests[0].body).ingredients, [{ ingredientId: 1, quantity: 2.5, unit: 'กรัม' }]);
  h.run("location.hash = '#ideas'");
  resolvePost(ok({ id: 11, name: 'atomic fixture' }));
  await pending;
  assert.equal(h.run('location.hash'), '#ideas', 'late write must not steal navigation');
  assert.match(h.get('app-notice').textContent, /atomic fixture/);
  assert.equal(h.get('create-fields').disabled, false);
  console.log('PASS atomic ingredient payload, duplicate/precision validation, double-submit and navigation race');
}
async function detailSemantics() {
  const h = harness(() => ok([]));
  h.run("renderInstructions('1. เตรียมของ 2. ผัด 3. เสิร์ฟ')");
  assert.deepEqual(h.get('instructions').children.map((item) => item.textContent), ['เตรียมของ', 'ผัด', 'เสิร์ฟ']);
  h.run("renderInstructions('คำอธิบายธรรมดา ไม่มีเลขขั้นตอน')");
  assert.equal(h.get('instructions').children.length, 1, 'plain content is never fabricated into extra steps');
  h.run(`${session} state.currentRecipe = { author_id: 1 };`);
  assert.equal(h.run('canManageRecipe()'), true);
  h.run('state.currentRecipe.author_id = 2');
  assert.equal(h.run('canManageRecipe()'), false);
  h.run("state.session.user.role = 'admin'");
  assert.equal(h.run('canManageRecipe()'), true);
  h.run("state.session.user.role = 'member'; state.currentRecipe.author_id = 1");
  assert.equal(h.run('canManageRecipe()'), false);
  h.run('state.session = null');
  assert.equal(h.run('canManageRecipe()'), false);
  console.log('PASS explicit step segmentation and owner/admin/member/guest management guards');
}
async function ownerNavigationRace() {
  let finishDelete;
  const h = harness((url, options) => options.method === 'DELETE' ? new Promise((resolve) => { finishDelete = resolve; }) : ok([], { pagination: { page: 1, limit: 9, total: 0, totalPages: 0 } }));
  h.run(`${session} state.selectedId = 3; state.detailRequest = 1; state.currentRecipe = { id: 3, author_id: 1, name: 'recipe A' }; location.hash = '#recipe/3';`);
  h.get('delete-name').value = 'recipe A';
  const pending = h.get('delete-recipe').handlers.click();
  h.run("state.selectedId = 4; state.detailRequest = 2; state.currentRecipe = { id: 4, author_id: 1, name: 'recipe B' }; location.hash = '#recipe/4';");
  finishDelete(ok({})); await pending;
  assert.equal(h.run('state.currentRecipe.id'), 4);
  assert.equal(h.run('canManageRecipe()'), true);
  assert.equal(h.run('location.hash'), '#recipe/4');
  const catalog = harness(() => denied(503, 'catalog unavailable'));
  await catalog.run('loadCatalog()');
  assert.equal(catalog.get('retry-detail-catalog').hidden, false);
  assert.match(catalog.get('detail-catalog-status').textContent, /catalog unavailable/);
  console.log('PASS owner delete completion preserves another recipe and catalog failure offers detail retry');
}
async function emptyRecovery() {
  const h = harness((url) => {
    const query = new URL(url, 'http://fixture').searchParams;
    const filtered = query.has('difficulty') || query.has('search') || query.has('categoryId');
    return ok(filtered ? [] : [recipe], { pagination: { page: 1, limit: 9, total: filtered ? 0 : 1, totalPages: filtered ? 0 : 1 } });
  });
  await h.run('loadRecipes()');
  h.run("state.difficulty = 'hard'; state.search = 'ไม่มี'; state.filter = '1'; state.page = 2;");
  await h.run('loadRecipes()');
  assert.equal(h.get('featured-recipe').hidden, false, 'filtering does not erase the real featured recipe');
  const empty = h.get('recipe-list').children[0];
  const reset = empty.children.find((item) => item.textContent.includes('ล้างตัวกรอง'));
  assert.ok(reset, 'empty filtered result has direct recovery');
  assert.equal(empty.children.some((item) => item.textContent === 'แบ่งปันสูตรอาหาร'), false, 'guest sees no role-forbidden empty CTA');
  await reset.handlers.click();
  const query = new URL(h.requests.at(-1).url, 'http://fixture').searchParams;
  assert.equal(query.has('search'), false); assert.equal(query.has('difficulty'), false); assert.equal(query.has('categoryId'), false);
  assert.equal(query.get('page'), '1'); assert.equal(h.get('recipe-list').children.length, 1);
  console.log('PASS empty result clears all filters and preserves real featured context without guest write CTA');
}
(async () => { await rating(true); await rating(false); await auth(); await create(); await pagination(); await timeoutBudget(); await ingredientWorkflow(); await detailSemantics(); await ownerNavigationRace(); await emptyRecovery(); })().catch((error) => { console.error(error); process.exitCode = 1; });
