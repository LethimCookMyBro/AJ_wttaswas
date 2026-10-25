'use strict';

// Read-only presentation companion. All authenticated writes stay in the app.
(() => {
  const $ = (id) => document.getElementById(id);
  if (!$('presentation-stages')) return;
  const tabs = [...document.querySelectorAll('[data-step]')];
  const stages = [...document.querySelectorAll('[data-stage]')];
  const state = { step: 1, recipes: [], selected: null, detailRead: false, busy: false, logs: {}, pendingStep: null };
  const hints = ['เลือกสูตรก่อน แล้วไปขั้นถัดไป', 'อ่านวัตถุดิบก่อน แล้วไปขั้นถัดไป', 'เพิ่มสูตรในแท็บเว็บ แล้วใส่รหัสสูตรใหม่เพื่อไปต่อ', 'เปรียบเทียบผลที่อ่านกลับกับข้อมูลที่คุณบันทึก'];
  const el = (tag, text) => { const node = document.createElement(tag); node.textContent = text; return node; };
  function list(items, tag = 'ul') {
    const node = document.createElement(tag);
    items.forEach((text) => node.append(el('li', text)));
    return node;
  }
  function ingredientText(item) {
    const units = { grams: 'กรัม', gram: 'กรัม', ml: 'มล.', pieces: 'ชิ้น', piece: 'ชิ้น', cloves: 'กลีบ', clove: 'กลีบ' };
    return `${item.name} · ${item.quantity} ${units[item.unit] || item.unit}`;
  }
  function controls() {
    tabs.forEach((tab) => {
      const n = Number(tab.dataset.step);
      tab.disabled = state.busy || (n === 2 && !state.selected);
      if (n === state.step) tab.setAttribute('aria-current', 'step');
      else tab.removeAttribute('aria-current');
    });
    $('step-previous').disabled = state.busy || state.step === 1;
    $('step-next').disabled = state.busy || (state.step === 1 && !state.selected) || (state.step === 2 && !state.detailRead) || (state.step === 3 && !validId($('created-recipe-id').value));
    $('step-next').hidden = state.step === 4;
    $('step-finish').hidden = state.step !== 4;
    ['load-recipes', 'load-detail', 'verify-run', 'verify-id', 'created-recipe-id', 'load-catalog'].forEach((id) => { $(id).disabled = state.busy || (id === 'load-detail' && !state.selected); });
    $('presentation-stages').setAttribute('aria-busy', String(state.busy));
    $('navigation-hint').textContent = hints[state.step - 1];
    $('step-count').textContent = `${state.step} / 4`;
  }
  function selectStep(n, focus = true, record = true) {
    if (state.busy || !Number.isInteger(n) || n < 1 || n > 4 || (n === 2 && !state.selected)) return;
    state.step = n;
    if (record && typeof window !== 'undefined' && window.location.hash !== `#step-${n}`) window.history.pushState(null, '', `#step-${n}`);
    stages.forEach((stage) => { stage.hidden = Number(stage.dataset.stage) !== n; });
    $('request-log').textContent = state.logs[n] || 'ยังไม่ได้ส่งคำขอในขั้นนี้';
    controls();
    if (focus) $(`step-heading-${n}`).focus();
  }
  function renderChoices() {
    $('recipe-options').replaceChildren();
    state.recipes.forEach((recipe) => {
      const li = document.createElement('li');
      const button = document.createElement('button');
      button.type = 'button';
      button.disabled = state.busy;
      button.setAttribute('aria-pressed', String(recipe.id === state.selected));
      button.append(el('span', recipe.name), el('small', recipe.id === state.selected ? 'เลือกแล้ว' : 'เลือกสูตร'));
      button.addEventListener('click', () => {
        if (state.busy) return;
        state.selected = recipe.id;
        state.detailRead = false;
        $('detail-result').hidden = true;
        $('detail-extra').replaceChildren(el('p', 'ยังไม่ได้อ่านวิธีทำ'));
        $('detail-status').textContent = 'พร้อมอ่านวัตถุดิบของสูตรที่เลือก';
        $('selected-recipe-name').textContent = recipe.name;

        // The readback ID comes from the newly saved recipe, not this browsing selection.
        state.logs[2] = '';
        renderChoices();
        controls();
      });
      li.append(button);
      $('recipe-options').append(li);
    });
  }
  function validId(value) { return /^[1-9]\d*$/.test(String(value).trim()) && Number.isSafeInteger(Number(value)); }
  function updateReviewLink() {
    const value = $('verify-id').value.trim();
    $('review-app-link').href = validId(value) ? `/#recipe/${Number(value)}` : '/#recipes';
  }
  const failure = (error) => ['TimeoutError', 'AbortError'].includes(error.name) ? 'เซิร์ฟเวอร์ใช้เวลานานเกินไป' : error.message || 'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้';
  async function task(step, statusId, work) {
    if (state.busy) return;
    state.busy = true;
    controls();
    renderChoices();
    const records = [];
    function log(text) {
      records.push(text);
      state.logs[step] = records.join('\n\n');
      if (state.step === step) $('request-log').textContent = state.logs[step];
    }
    $(statusId).textContent = 'กำลังอ่านข้อมูล…';
    async function read(path) {
      log(`GET ${path}`);
      const response = await fetch(path, { method: 'GET', credentials: 'omit', headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(15000) });
      log(`HTTP ${response.status}`);
      let body;
      try { body = await response.json(); }
      catch { throw new Error('เซิร์ฟเวอร์ไม่ได้ส่ง JSON กลับมา'); }
      log(JSON.stringify(body, null, 2));
      if (!response.ok) throw new Error(body.error?.message || `เซิร์ฟเวอร์ตอบกลับ ${response.status}`);
      return body.data;
    }
    try { await work(read); }
    catch (error) {
      const message = failure(error);
      $(statusId).textContent = `อ่านไม่สำเร็จ: ${message} ลองอีกครั้ง`;
      log(`อ่านไม่สำเร็จ: ${message}`);
    } finally {
      state.busy = false;
      controls();
      renderChoices();
      if (state.pendingStep !== null) {
        const n = state.pendingStep; state.pendingStep = null;
        selectStep(n === 2 && !state.selected ? 1 : n, true, false);
      }
    }
  }
  $('load-recipes').addEventListener('click', () => {
    if (state.busy) return;
    state.selected = null; state.detailRead = false; state.recipes = [];
    $('recipe-options').replaceChildren();
    $('detail-result').hidden = true;
    $('selected-recipe-name').textContent = '';

    // Refreshing the browse list must not erase an independently entered new-recipe ID.
    state.logs[2] = '';
    return task(1, 'recipes-status', async (read) => {
      const data = await read('/api/v1/recipes?limit=3');
      if (!Array.isArray(data)) throw new Error('รูปแบบรายการสูตรไม่ถูกต้อง');
      state.recipes = data.filter((recipe) => Number.isSafeInteger(recipe.id) && recipe.id > 0 && typeof recipe.name === 'string');
      $('recipes-status').textContent = state.recipes.length ? 'เลือกหนึ่งสูตรเพื่อใช้สาธิต' : 'ยังไม่มีสูตร ลองใหม่ภายหลัง หรือไปขั้น 3 เพื่อเพิ่มสูตร';
    });
  });
  $('load-detail').addEventListener('click', () => {
    if (state.busy || !state.selected) return;
    state.detailRead = false;
    $('detail-result').hidden = true;
    $('detail-extra').replaceChildren(el('p', 'ยังไม่ได้อ่านวิธีทำ'));
    return task(2, 'detail-status', async (read) => {
      const recipe = await read(`/api/v1/recipes/${state.selected}`);
      if (!recipe?.name || !Array.isArray(recipe.ingredients)) throw new Error('รูปแบบรายละเอียดสูตรไม่ถูกต้อง');
      $('detail-result').replaceChildren(recipe.ingredients.length ? list(recipe.ingredients.map(ingredientText)) : el('p', 'สูตรนี้ยังไม่มีวัตถุดิบ'));
      const instructions = String(recipe.instructions || '').split(/(?:\r?\n)+|(?:^|\s)(?=\d+[.)]\s)/u).map((part) => part.replace(/^\s*\d+[.)]\s*/, '').trim()).filter(Boolean);
      $('detail-extra').replaceChildren(list(instructions.length ? instructions : ['ยังไม่มีวิธีทำ'], 'ol'));
      $('detail-result').hidden = false;
      state.detailRead = true;
      $('detail-status').textContent = `อ่านสำเร็จ · วัตถุดิบ ${recipe.ingredients.length} รายการ`;
    });
  });
  $('load-catalog').addEventListener('click', () => {
    if (state.busy) return;
    $('catalog-result').replaceChildren();
    return task(state.step, 'catalog-status', async (read) => {
      const data = await read('/api/v1/ingredients');
      if (!Array.isArray(data)) throw new Error('รูปแบบคลังวัตถุดิบไม่ถูกต้อง');
      $('catalog-result').replaceChildren(list(data.map((item) => `${item.name} · รหัส ${item.id}`)));
      $('catalog-status').textContent = `อ่านสำเร็จ · ${data.length} รายการ`;
    });
  });
  $('verify-form').addEventListener('submit', (event) => {
    event.preventDefault();
    if (state.busy) return;
    $('verify-result').hidden = true;
    $('verify-app-link').hidden = true;
    const value = $('verify-id').value.trim();
    const id = Number(value);
    if (!/^[1-9]\d*$/.test(value) || !Number.isSafeInteger(id)) {
      $('verify-status').textContent = 'ใส่รหัสสูตรเป็นจำนวนเต็มบวก เช่น 12';
      return;
    }
    return task(4, 'verify-status', async (read) => {
      const recipe = await read(`/api/v1/recipes/${id}`);
      if (!recipe?.name || !Array.isArray(recipe.ingredients)) throw new Error('รูปแบบรายละเอียดสูตรไม่ถูกต้อง');
      const reviews = await read(`/api/v1/recipes/${id}/ratings`);
      if (!reviews || !Array.isArray(reviews.ratings) || !Number.isFinite(Number(reviews.ratingCount))) throw new Error('รูปแบบข้อมูลรีวิวไม่ถูกต้อง');
      const result = $('verify-result');
      result.replaceChildren(el('h3', recipe.name), el('p', `สูตร #${id} · วัตถุดิบ ${recipe.ingredients.length} รายการ`));
      result.append(list(recipe.ingredients.map(ingredientText)));
      result.append(el('p', Number(reviews.ratingCount) ? `คะแนนเฉลี่ย ${reviews.averageScore}/5 · ${reviews.ratingCount} รีวิว` : 'ยังไม่มีรีวิว'));
      if (reviews.ratings.length) result.append(list(reviews.ratings.slice(0, 5).map((review) => `${review.username} · ${review.ratingScore}/5 · ${review.reviewComment || 'ไม่ได้เขียนความคิดเห็น'}`)));
      result.hidden = false;
      $('verify-app-link').href = `/#recipe/${id}`;
      $('verify-app-link').hidden = false;
      updateReviewLink();
      $('verify-status').textContent = `อ่านสูตรและรีวิวสำเร็จ · ${new Date().toLocaleTimeString('th-TH')} · ตรวจเทียบกับสิ่งที่บันทึก`;
    });
  });
  function invalidateReadback() {
    $('verify-result').hidden = true;
    $('verify-result').replaceChildren();
    $('verify-app-link').hidden = true;
    $('verify-app-link').href = '/#recipes';
    $('verify-status').textContent = 'ยังไม่ได้ตรวจผลของรหัสนี้ กดอ่านผลล่าสุด';
    state.logs[4] = '';
    if (state.step === 4) $('request-log').textContent = 'ยังไม่ได้ส่งคำขอในขั้นนี้';
    updateReviewLink();
  }
  $('created-recipe-id').addEventListener('input', () => {
    if (state.busy) return;
    $('verify-id').value = validId($('created-recipe-id').value) ? String(Number($('created-recipe-id').value)) : '';
    invalidateReadback(); controls();
  });
  $('verify-id').addEventListener('input', () => {
    if (!state.busy) invalidateReadback();
  });
  tabs.forEach((tab) => tab.addEventListener('click', () => selectStep(Number(tab.dataset.step))));
  $('step-next').addEventListener('click', () => { if (!$('step-next').disabled) selectStep(state.step + 1); });
  $('step-previous').addEventListener('click', () => selectStep(state.step - 1));
  if (typeof window !== 'undefined') {
    window.addEventListener('popstate', () => {
      const match = /^#step-([1-4])$/.exec(window.location.hash);
      const n = match ? Number(match[1]) : 1;
      if (state.busy) { state.pendingStep = n; return; }
      selectStep(n === 2 && !state.selected ? 1 : n, true, false);
    });
  }
  const initial = typeof window !== 'undefined' ? /^#step-([1-4])$/.exec(window.location.hash) : null;
  const initialStep = initial ? Number(initial[1]) : 1;
  selectStep(initialStep === 2 ? 1 : initialStep, false, false);
})();
