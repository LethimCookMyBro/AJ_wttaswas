const byId = (id) => document.getElementById(id);
const state = { recipes: [], selectedId: null, detailRequest: 0, filter: '', search: '', successId: null, session: null, returnTo: '#recipes', detailReady: false, page: 1, limit: 9, sort: 'id_asc', pagination: { total: 0, totalPages: 0 }, listRequest: 0 };
const difficultyNames = { easy: 'ง่าย', medium: 'ปานกลาง', hard: 'ยาก' };
const recipePhotos = { 1: 'pad-krapao', 2: 'mango-rice', 3: 'pepper-chicken' };

function status(id, text, error = false) {
  byId(id).textContent = text;
  byId(id).classList.toggle('error', error);
}

async function api(route, options = {}, envelope = false) {
  const response = await fetch(`/api/v1${route}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(state.session ? { Authorization: `Bearer ${state.session.token}` } : {}), ...options.headers },
    signal: AbortSignal.timeout(route.split('?')[0] === '/external/meal-ideas' ? 12000 : 6000),
  });
  const body = await response.json();
  if (response.status === 401 && state.session && route !== '/auth/login') {
    state.session = null;
    renderSession();
    throw new Error('เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่');
  }
  if (!response.ok) throw new Error(body.error?.message || `API ตอบกลับ ${response.status}`);
  return envelope ? body : body.data;
}

function errorMessage(error) {
  if (error.name === 'TimeoutError') return 'รอนานเกินไป กรุณาลองใหม่';
  if (error instanceof TypeError) return 'เชื่อมต่อ API ไม่ได้ ตรวจว่าเซิร์ฟเวอร์ยังเปิดอยู่ แล้วลองใหม่';
  return error.message;
}

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function listItem(text) { return element('li', '', text); }
function photoFor(id) { return `/assets/${recipePhotos[id] || 'fried-rice'}.webp`; }

function renderRecipes() {
  const visible = state.recipes;
  byId('recipe-list').replaceChildren(...visible.map((recipe) => {
    const item = element('li', 'recipe-card');
    const link = element('a');
    link.href = `#recipe/${recipe.id}`;
    link.setAttribute('aria-label', `ดูสูตร ${recipe.name}`);
    const photo = element('div', 'card-photo');
    const image = element('img');
    image.src = photoFor(recipe.id);
    image.alt = recipePhotos[recipe.id] ? `ภาพประกอบ${recipe.name}` : 'ภาพประกอบอาหารทั่วไป ไม่ใช่ภาพของสูตรนี้';
    image.width = 700;
    image.height = 450;
    image.loading = 'lazy';
    photo.append(image, element('span', 'photo-label', recipePhotos[recipe.id] ? 'ภาพประกอบ' : 'ภาพประกอบทั่วไป'));
    const content = element('div', 'card-content');
    const meta = element('div', 'card-meta');
    meta.append(element('span', '', `${recipe.cook_time_minutes} นาที`), element('span', '', `ระดับ${difficultyNames[recipe.difficulty]}`));
    const arrow = element('span', 'card-direction', '↗');
    arrow.setAttribute('aria-hidden', 'true');
    meta.append(arrow);
    content.append(element('p', 'card-category', recipe.category_name), element('h3', '', recipe.name), meta);
    link.append(photo, content);
    item.append(link);
    return item;
  }));
  if (!visible.length) {
    const empty = element('li', 'empty-state');
    empty.append(element('h3', '', 'ยังไม่เจอสูตรที่คุณหา'), element('p', '', 'ลองเปลี่ยนคำค้นหรือหมวดหมู่ หรือแบ่งปันสูตรแรกของคุณ'));
    const link = element('a', 'button secondary', 'เพิ่มสูตรอาหาร');
    link.href = '#create';
    empty.append(link);
    byId('recipe-list').append(empty);
  }
  for (const chip of byId('category-chips').querySelectorAll('button')) {
    const active = chip.dataset.category === state.filter;
    chip.classList.toggle('active', active);
    chip.setAttribute('aria-pressed', String(active));
  }
  status('list-status', `${visible.length} สูตรในหน้านี้ · ทั้งหมด ${state.pagination.total} สูตร${state.search ? 'ที่ตรงกับคำค้น' : ''}`);
  byId('page-status').textContent = state.pagination.totalPages ? `หน้า ${state.page} จาก ${state.pagination.totalPages}` : 'ไม่มีรายการ';
  byId('previous-page').disabled = state.page <= 1;
  byId('next-page').disabled = state.page >= state.pagination.totalPages;
}

async function loadRecipes() {
  const request = ++state.listRequest;
  status('list-status', 'กำลังโหลดสูตรอาหาร...');
  byId('reload').disabled = true;
  byId('previous-page').disabled = true;
  byId('next-page').disabled = true;
  byId('recipe-list').setAttribute('aria-busy', 'true');
  try {
    const query = new URLSearchParams({ page: state.page, limit: state.limit, sort: state.sort });
    if (state.filter) query.set('categoryId', state.filter);
    if (state.search) query.set('search', state.search);
    const result = await api(`/recipes?${query}`, {}, true);
    if (request !== state.listRequest) return;
    state.recipes = result.data;
    state.pagination = result.pagination;
    renderRecipes();
  } catch (error) {
    if (request === state.listRequest) {
      byId('recipe-list').replaceChildren();
      byId('page-status').textContent = '';
      status('list-status', `${errorMessage(error)} กดโหลดใหม่เพื่อลองอีกครั้ง`, true);
    }
  } finally {
    if (request === state.listRequest) {
      byId('reload').disabled = false;
      byId('recipe-list').setAttribute('aria-busy', 'false');
    }
  }
}

function renderSession() {
  const user = state.session?.user;
  const canCreate = !!user && ['chef', 'admin'].includes(user.role);
  byId('login-link').hidden = !!user;
  byId('logout').hidden = !user;
  byId('session-user').hidden = !user;
  byId('session-user').textContent = user ? `${user.username} · ${user.role}` : '';
  byId('create-fields').disabled = !canCreate;
  byId('create-auth').hidden = canCreate;
  if (user && !canCreate) byId('create-auth').textContent = 'บัญชี member อ่านและให้คะแนนได้ แต่การแบ่งปันสูตรต้องใช้บัญชี chef หรือ admin';
  else if (!user) {
    const link = element('a', '', 'เข้าสู่ระบบ');
    link.href = '#login';
    link.addEventListener('click', () => { state.returnTo = '#create'; });
    byId('create-auth').replaceChildren(document.createTextNode('เข้าสู่ระบบด้วยบัญชี chef หรือ admin เพื่อแบ่งปันสูตร '), link);
  }
  byId('rating-auth').hidden = !!user;
  byId('rating-help').textContent = user ? `รีวิวในชื่อ ${user.username} · ให้คะแนนได้ครั้งเดียวต่อสูตร` : 'เข้าสู่ระบบเพื่อให้คะแนนสูตรนี้';
  byId('rating-fields').disabled = !user || !state.detailReady;
}

async function loadDetail(id) {
  const changed = state.selectedId !== id;
  state.selectedId = id;
  const request = ++state.detailRequest;
  state.detailReady = false;
  byId('detail').setAttribute('aria-busy', 'true');
  byId('rating-fields').disabled = true;
  status('detail-status', 'กำลังโหลดรายละเอียดและคะแนน...');
  status('rating-status', '');
  if (changed) byId('rating-form').reset();
  byId('recipe-success').hidden = state.successId !== id;
  byId('detail-heading').textContent = 'กำลังโหลดสูตรที่เลือก';
  byId('recipe-meta').textContent = '';
  byId('detail-category').textContent = '';
  byId('instructions').textContent = '';
  byId('ingredients').replaceChildren();
  byId('ratings').replaceChildren();
  byId('rating-summary').textContent = '';
  byId('detail-image').src = photoFor(id);
  byId('detail-image').alt = recipePhotos[id] ? 'ภาพประกอบสูตรอาหาร' : 'ภาพประกอบอาหารทั่วไป ไม่ใช่ภาพของสูตรนี้';
  try {
    const [recipe, reviews] = await Promise.all([api(`/recipes/${id}`), api(`/recipes/${id}/ratings`)]);
    if (request !== state.detailRequest) return false;
    byId('detail-heading').textContent = recipe.name;
    document.title = `${recipe.name} | ครัวแบ่งปัน`;
    byId('detail-category').textContent = recipe.category_name;
    byId('recipe-meta').textContent = `${recipe.cook_time_minutes} นาที · ระดับ${difficultyNames[recipe.difficulty]} · สูตร #${id}`;
    byId('instructions').textContent = recipe.instructions;
    byId('ingredients').replaceChildren(...(recipe.ingredients.length
      ? recipe.ingredients.map((ingredient) => listItem(`${ingredient.name} ${ingredient.quantity} ${ingredient.unit}`))
      : [listItem('สูตรนี้ยังไม่ได้เพิ่มวัตถุดิบ')]));
    byId('rating-summary').textContent = reviews.ratingCount ? `${reviews.averageScore}/5 จาก ${reviews.ratingCount} รีวิว` : 'ยังไม่มีคะแนน';
    byId('ratings').replaceChildren(...(reviews.ratings.length ? reviews.ratings.map((review) => {
      const item = element('li');
      item.append(element('strong', '', `${review.username} · ${review.ratingScore}/5`), element('p', '', review.reviewComment || 'ไม่ได้เขียนความคิดเห็น'));
      return item;
    }) : [element('li', 'empty-review', 'ยังไม่มีรีวิว ลองทำแล้วมาเล่าให้ฟังเป็นคนแรกได้เลย')]));
    state.detailReady = true;
    renderSession();
    status('detail-status', '');
    return true;
  } catch (error) {
    if (request === state.detailRequest) {
      byId('detail-heading').textContent = 'เปิดสูตรอาหารไม่ได้';
      status('detail-status', `${errorMessage(error)} กลับไปเลือกสูตรอีกครั้งเพื่อลองใหม่`, true);
    }
    return false;
  } finally {
    if (request === state.detailRequest) byId('detail').setAttribute('aria-busy', 'false');
  }
}

function showRoute() {
  const hash = location.hash;
  const recipeMatch = /^#recipe\/([1-9]\d*)$/.exec(hash);
  const view = recipeMatch ? 'detail' : hash === '#create' ? 'create' : hash === '#ideas' ? 'ideas' : hash === '#login' ? 'login' : 'home';
  const current = document.querySelector('[data-view]:not([hidden])')?.dataset.view;
  for (const section of document.querySelectorAll('[data-view]')) section.hidden = section.dataset.view !== view;
  for (const link of document.querySelectorAll('[data-nav]')) {
    if (link.dataset.nav === (view === 'detail' ? 'home' : view)) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  }
  const heading = { home: 'page-title', create: 'create-heading', ideas: 'ideas-heading', detail: 'detail-heading', login: 'login-heading' }[view];
  document.title = `${view === 'login' ? 'เข้าสู่ระบบ' : view === 'create' ? 'แบ่งปันสูตรอาหาร' : view === 'ideas' ? 'ไอเดียเมนู' : 'มื้อนี้ทำอะไรดี?'} | ครัวแบ่งปัน`;
  if (recipeMatch) loadDetail(Number(recipeMatch[1]));
  else { state.detailRequest += 1; byId('detail').setAttribute('aria-busy', 'false'); }
  if (current !== view || recipeMatch) {
    window.scrollTo(0, 0);
    byId(heading).focus({ preventScroll: true });
  }
  if (hash === '#collection') byId('collection').scrollIntoView({ block: 'start' });
  if (hash === '#main') byId('main').focus();
}

byId('category-chips').addEventListener('click', (event) => {
  const chip = event.target.closest('button[data-category]');
  if (!chip) return;
  state.filter = chip.dataset.category;
  byId('category-filter').value = state.filter;
  state.page = 1;
  loadRecipes();
});
byId('category-filter').addEventListener('change', () => { state.filter = byId('category-filter').value; state.page = 1; loadRecipes(); });
let searchTimer;
byId('recipe-search').addEventListener('input', () => {
  clearTimeout(searchTimer);
  state.search = byId('recipe-search').value.trim();
  state.page = 1;
  searchTimer = setTimeout(loadRecipes, 300);
});
byId('recipe-sort').addEventListener('change', () => { state.sort = byId('recipe-sort').value; state.page = 1; loadRecipes(); });
byId('previous-page').addEventListener('click', () => { if (state.page > 1) { state.page--; loadRecipes(); } });
byId('next-page').addEventListener('click', () => { if (state.page < state.pagination.totalPages) { state.page++; loadRecipes(); } });
for (const link of document.querySelectorAll('[data-login-return]')) link.addEventListener('click', () => { state.returnTo = location.hash === '#login' ? '#recipes' : location.hash || '#recipes'; });
byId('logout').addEventListener('click', () => { state.session = null; renderSession(); status('login-status', 'ออกจากระบบแล้ว'); });
byId('login-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  byId('login-submit').disabled = true;
  status('login-status', 'กำลังเข้าสู่ระบบ...');
  try {
    state.session = await api('/auth/login', { method: 'POST', body: JSON.stringify({ username: byId('username').value.trim(), password: byId('password').value }) });
    byId('password').value = '';
    renderSession();
    status('login-status', 'เข้าสู่ระบบสำเร็จ');
    location.hash = state.returnTo;
  } catch (error) { status('login-status', errorMessage(error), true); }
  finally { byId('login-submit').disabled = false; }
});
byId('reload').addEventListener('click', loadRecipes);
window.addEventListener('hashchange', showRoute);
document.querySelector('.skip').addEventListener('click', (event) => { event.preventDefault(); byId('main').focus(); });

byId('recipe-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!state.session || !['chef', 'admin'].includes(state.session.user.role)) return status('create-status', 'กรุณาเข้าสู่ระบบด้วยบัญชี chef หรือ admin', true);
  const payload = {
    name: byId('name').value.trim(), categoryId: Number(byId('category').value),
    instructions: byId('steps').value.trim(), cookTimeMinutes: Number(byId('minutes').value), difficulty: byId('difficulty').value,
  };
  if (!payload.name || !payload.instructions) return status('create-status', 'กรุณากรอกชื่อสูตรและวิธีทำ ไม่ใช้ช่องว่างอย่างเดียว', true);
  if (new TextEncoder().encode(JSON.stringify(payload)).length > 10240) return status('create-status', 'ข้อมูลรวมเกิน 10 KB กรุณาลดความยาววิธีทำแล้วลองใหม่', true);
  byId('save-recipe').disabled = true;
  status('create-status', 'กำลังบันทึกสูตรอาหาร...');
  try {
    const created = await api('/recipes', { method: 'POST', body: JSON.stringify(payload) });
    event.target.reset();
    state.filter = '';
    state.search = '';
    state.page = 1;
    state.sort = 'id_desc';
    byId('recipe-sort').value = state.sort;
    byId('category-filter').value = '';
    byId('recipe-search').value = '';
    state.successId = created.id;
    status('recipe-success', `บันทึก "${created.name}" สำเร็จ รหัสสูตร #${created.id} พร้อมให้เปิดอ่านแล้ว`);
    status('create-status', '');
    location.hash = `recipe/${created.id}`;
    await loadRecipes();
  } catch (error) {
    status('create-status', errorMessage(error), true);
  } finally {
    byId('save-recipe').disabled = false;
    renderSession();
  }
});

byId('rating-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const id = state.selectedId;
  if (!id) return;
  if (!state.session) return status('rating-status', 'กรุณาเข้าสู่ระบบเพื่อให้คะแนน', true);
  const request = state.detailRequest;
  const reviewComment = byId('review').value.trim();
  const payload = { ratingScore: Number(byId('score').value), ...(reviewComment ? { reviewComment } : {}) };
  byId('rating-fields').disabled = true;
  status('rating-status', 'กำลังบันทึกคะแนน...');
  try {
    await api(`/recipes/${id}/ratings`, { method: 'POST', body: JSON.stringify(payload) });
    if (state.selectedId === id && state.detailRequest === request) {
      event.target.reset();
      if (await loadDetail(id)) status('rating-status', 'บันทึกคะแนนสำเร็จ คะแนนด้านบนอัปเดตจาก API แล้ว');
      else if (state.selectedId === id && !byId('detail').hidden) status('rating-status', 'บันทึกคะแนนแล้ว แต่ยังโหลดผลล่าสุดไม่ได้ กรุณาเปิดสูตรอีกครั้ง', true);
    }
  } catch (error) {
    if (state.selectedId === id && state.detailRequest === request) status('rating-status', errorMessage(error), true);
  } finally {
    if (state.selectedId === id && state.detailRequest === request && !byId('detail').hidden) renderSession();
  }
});

byId('ideas-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const ingredient = byId('ingredient').value.trim();
  if (!/^[A-Za-z][A-Za-z _-]{0,49}$/.test(ingredient)) return status('ideas-status', 'ใช้ชื่อวัตถุดิบภาษาอังกฤษ เช่น chicken_breast', true);
  const button = event.target.querySelector('button');
  button.disabled = true;
  status('ideas-status', 'กำลังค้นเมนูจากบริการภายนอก กรุณารอสักครู่...');
  byId('ideas-list').replaceChildren();
  try {
    const result = await api(`/external/meal-ideas?ingredient=${encodeURIComponent(ingredient)}`);
    byId('ideas-list').replaceChildren(...result.ideas.map((idea) => listItem(idea.name)));
    status('ideas-status', result.degraded
      ? `บริการภายนอกไม่พร้อม แสดงรายการสำรองของระบบ (${result.reason}, ลอง ${result.attempts} ครั้ง)`
      : `ข้อมูลจาก TheMealDB พบ ${result.ideas.length} ไอเดีย${result.ideas.length ? '' : ' ลองวัตถุดิบอื่นอีกครั้ง'}`, result.degraded);
  } catch (error) {
    status('ideas-status', errorMessage(error), true);
  } finally {
    button.disabled = false;
  }
});

async function start() {
  renderSession();
  showRoute();
  try {
    const categories = await api('/categories');
    for (const id of ['category', 'category-filter']) {
      byId(id).append(...categories.map((category) => {
        const option = element('option', '', category.name);
        option.value = category.id;
        return option;
      }));
    }
    byId('category-chips').append(...categories.map((category) => {
      const chip = element('button', 'chip', category.name);
      chip.type = 'button';
      chip.dataset.category = String(category.id);
      chip.setAttribute('aria-pressed', 'false');
      return chip;
    }));
  } catch (error) {
    status('create-status', `โหลดหมวดหมู่ไม่สำเร็จ ${errorMessage(error)} รีเฟรชหน้าเพื่อลองใหม่`, true);
  }
  await loadRecipes();
}
start();
