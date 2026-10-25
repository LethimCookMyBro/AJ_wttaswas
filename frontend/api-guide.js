'use strict';

// This walkthrough is deliberately read-only. Authentication and writes stay in the app.
(() => {
  const $ = (id) => document.getElementById(id);
  if (!$('live-lab')) return;
  const steps = [...document.querySelectorAll('[data-live-step]')];
  const state = { step: 'recipes', recipes: [], selected: null, detailRead: false, busy: false };
  const labels = {
    recipes: ['เริ่มจากสูตรในระบบ', 'อ่านรายการสูตร 3 รายการ แล้วเลือกสูตรเพื่อดูข้อมูลที่ API ส่งกลับ', 'อ่านรายการสูตร'],
    detail: ['เปิดสูตรที่คุณเลือก', 'คำขอนี้อ่านวิธีทำและวัตถุดิบของสูตรที่เลือก โดยไม่เปลี่ยนข้อมูล', 'อ่านรายละเอียดสูตร'],
    ingredients: ['ดูวัตถุดิบทั้งคลัง', 'คลังวัตถุดิบใช้เป็นรายการให้เลือกตอนสร้างสูตร ไม่ใช่วัตถุดิบของสูตรเดียว', 'อ่านคลังวัตถุดิบ'],
  };
  function endpoint() {
    if (state.step === 'detail') return `/api/v1/recipes/${state.selected}`;
    return state.step === 'ingredients' ? '/api/v1/ingredients' : '/api/v1/recipes?limit=3';
  }
  function controls() {
    steps.forEach((button) => {
      const step = button.dataset.liveStep;
      button.disabled = state.busy || (step === 'detail' && !state.selected) || (step === 'ingredients' && !state.detailRead);
      if (step === state.step) button.setAttribute('aria-current', 'step');
      else button.removeAttribute('aria-current');
    });
    $('live-run').disabled = state.busy;
    $('live-recipe').disabled = state.busy;
    $('live-continue').disabled = state.busy;
    $('live-lab').setAttribute('aria-busy', String(state.busy));
  }
  function selectStep(step) {
    if (state.busy || !labels[step]) return;
    if (step === 'detail' && !state.selected) return;
    if (step === 'ingredients' && !state.detailRead) return;
    state.step = step;
    const [heading, instruction, action] = labels[step];
    $('live-heading').textContent = heading;
    $('live-instruction').textContent = instruction;
    $('live-run').textContent = action;
    $('live-path').textContent = endpoint();
    $('live-request-code').textContent = `GET ${endpoint()}`;
    $('recipe-choice').hidden = step !== 'detail';
    $('live-response').textContent = 'ยังไม่ได้ส่งคำขอนี้';
    $('live-response-code').textContent = '';
    $('live-status').textContent = 'พร้อมอ่านข้อมูล กดปุ่มเพื่อส่งคำขอ';
    $('live-result').hidden = true;
    $('live-next').hidden = true;
    controls();
  }
  function element(tag, text) {
    const node = document.createElement(tag);
    node.textContent = text;
    return node;
  }
  function resultList(items) {
    const list = document.createElement('ul');
    list.className = 'live-items';
    items.forEach((text) => list.append(element('li', text)));
    return list;
  }
  function ingredientText(item) {
    const units = { grams: 'กรัม', gram: 'กรัม', ml: 'มล.', pieces: 'ชิ้น', piece: 'ชิ้น', cloves: 'กลีบ', clove: 'กลีบ' };
    return `${item.name} · ${item.quantity} ${units[item.unit] || item.unit}`;
  }
  function instructionList(instructions) {
    const list = document.createElement('ol');
    list.className = 'live-instructions';
    const parts = String(instructions || '').split(/(?:\r?\n)+|(?:^|\s)(?=\d+[.)]\s)/u)
      .map((part) => part.replace(/^\s*\d+[.)]\s*/, '').trim()).filter(Boolean);
    (parts.length ? parts : ['ยังไม่มีวิธีทำ']).forEach((part) => list.append(element('li', part)));
    return list;
  }
  function updateAppLinks() {
    const href = state.selected ? `/#recipe/${state.selected}` : '/#recipes';
    ['live-app-link', 'review-app-link', 'ingredients-app-link'].forEach((id) => { $(id).href = href; });
  }
  function showData(body) {
    const result = $('live-result');
    result.replaceChildren();
    if (state.step === 'recipes') {
      if (!Array.isArray(body.data)) throw new Error('รูปแบบรายการสูตรไม่ถูกต้อง');
      state.recipes = body.data.filter((recipe) => Number.isSafeInteger(recipe.id) && recipe.id > 0);
      state.selected = state.recipes[0]?.id || null;
      state.detailRead = false;
      $('live-recipe').replaceChildren();
      state.recipes.forEach((recipe) => {
        const option = element('option', recipe.name);
        option.value = String(recipe.id);
        $('live-recipe').append(option);
      });
      result.append(element('h4', state.recipes.length ? `ได้รับ ${state.recipes.length} สูตรในหน้านี้` : 'ยังไม่มีสูตรในระบบ'));
      result.append(resultList(state.recipes.map((recipe) => `${recipe.name} · ${recipe.cook_time_minutes} นาที`)));
      if (!state.recipes.length) result.append(element('p', 'ลองใหม่ภายหลัง หรือเปิดหน้าเว็บเพื่อสร้างสูตรด้วยบัญชี chef หรือ admin'));
      $('live-continue').textContent = 'เลือกสูตรและดูรายละเอียด';
      $('live-next').hidden = !state.selected;
    } else if (state.step === 'detail') {
      const recipe = body.data;
      if (!recipe || !Array.isArray(recipe.ingredients) || !recipe.name) throw new Error('รูปแบบรายละเอียดสูตรไม่ถูกต้อง');
      state.detailRead = true;
      result.append(element('h4', recipe.name));
      result.append(element('p', `${recipe.category_name || 'ไม่ระบุหมวดหมู่'} · ${recipe.cook_time_minutes} นาที`));
      result.append(element('h4', 'วิธีทำ'), instructionList(recipe.instructions));
      result.append(element('h4', 'วัตถุดิบของสูตรนี้'));
      result.append(recipe.ingredients.length ? resultList(recipe.ingredients.map(ingredientText)) : element('p', 'สูตรนี้ยังไม่มีวัตถุดิบที่ผูกไว้'));
      $('live-continue').textContent = 'ต่อไป ดูคลังวัตถุดิบ';
      $('live-next').hidden = false;
    } else {
      if (!Array.isArray(body.data)) throw new Error('รูปแบบคลังวัตถุดิบไม่ถูกต้อง');
      result.append(element('h4', `คลังมีวัตถุดิบ ${body.data.length} รายการ`));
      result.append(body.data.length ? resultList(body.data.map((item) => `${item.name} · รหัส ${item.id}`)) : element('p', 'คลังยังไม่มีวัตถุดิบ'));
      result.append(element('p', 'อ่านครบแล้ว เมื่อต้องการสร้างสูตรหรือรีวิว ให้ใช้หน้าเว็บตามสิทธิ์ของบัญชี'));
      $('live-continue').textContent = 'กลับไปอ่านรายการสูตร';
      $('live-next').hidden = false;
    }
    updateAppLinks();
    result.hidden = false;
  }
  async function run() {
    if (state.busy) return;
    state.busy = true;
    controls();
    $('live-result').hidden = true;
    $('live-next').hidden = true;
    $('live-status').textContent = 'กำลังอ่านข้อมูลจากเซิร์ฟเวอร์…';
    $('live-response').textContent = 'กำลังรอผลตอบกลับ…';
    $('live-response-code').textContent = '';
    // Reset dependencies before refresh so an unsuccessful request cannot leave stale steps enabled.
    if (state.step === 'recipes') { state.selected = null; state.detailRead = false; state.recipes = []; }
    if (state.step === 'detail') state.detailRead = false;
    try {
      const response = await fetch(endpoint(), { method: 'GET', credentials: 'omit', headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(15000) });
      $('live-response-code').textContent = `HTTP ${response.status}`;
      let body;
      try { body = await response.json(); }
      catch { throw new Error('เซิร์ฟเวอร์ไม่ได้ส่ง JSON กลับมา'); }
      $('live-response').textContent = JSON.stringify(body, null, 2);
      if (!response.ok) throw new Error(body.error?.message || `เซิร์ฟเวอร์ตอบกลับ ${response.status}`);
      showData(body);
      $('live-status').textContent = `อ่านสำเร็จ · HTTP ${response.status} · ${new Date().toLocaleTimeString('th-TH')} · ไม่ได้แก้ไขข้อมูล`;
    } catch (error) {
      const message = ['TimeoutError', 'AbortError'].includes(error.name) ? 'เซิร์ฟเวอร์ใช้เวลานานเกินไป' : error.message || 'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้';
      $('live-status').textContent = `อ่านไม่สำเร็จ: ${message} ลองกดอ่านอีกครั้ง`;
      if ($('live-response').textContent === 'กำลังรอผลตอบกลับ…') $('live-response').textContent = 'ไม่มีผลตอบกลับ JSON';
      updateAppLinks();
    } finally {
      state.busy = false;
      controls();
    }
  }
  steps.forEach((button) => button.addEventListener('click', () => selectStep(button.dataset.liveStep)));
  $('live-run').addEventListener('click', run);
  $('live-continue').addEventListener('click', () => {
    selectStep(state.step === 'recipes' ? 'detail' : state.step === 'detail' ? 'ingredients' : 'recipes');
    $('live-heading').setAttribute('tabindex', '-1');
    $('live-heading').focus();
  });
  $('live-recipe').addEventListener('change', () => {
    if (state.busy) return;
    const id = Number($('live-recipe').value);
    if (!state.recipes.some((recipe) => recipe.id === id)) return;
    state.selected = id;
    state.detailRead = false;
    updateAppLinks();
    selectStep('detail');
  });
  let verifying = false;
  $('verify-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    if (verifying) return;
    const value = $('verify-id').value.trim();
    const id = Number(value);
    if (!/^[1-9]\d*$/.test(value) || !Number.isSafeInteger(id)) {
      $('verify-result').hidden = true;
      $('verify-app-link').hidden = true;
      $('verify-status').textContent = 'ใส่รหัสสูตรเป็นจำนวนเต็มบวก เช่น 12';
      return;
    }
    verifying = true;
    $('verify-run').disabled = true;
    $('verify-id').disabled = true;
    $('verify-form').setAttribute('aria-busy', 'true');
    $('verify-result').hidden = true;
    $('verify-app-link').hidden = true;
    $('verify-status').textContent = `กำลังอ่านสูตร #${id} และรีวิวล่าสุด…`;
    const records = [];
    $('verify-response').textContent = 'กำลังรอผลตอบกลับ…';
    async function read(path) {
      records.push(`GET ${path}`);
      $('verify-response').textContent = records.join('\n\n');
      const response = await fetch(path, { method: 'GET', credentials: 'omit', headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(15000) });
      records.push(`HTTP ${response.status}`);
      let body;
      try { body = await response.json(); }
      catch { records.push('ไม่มีผลตอบกลับ JSON'); throw new Error('เซิร์ฟเวอร์ไม่ได้ส่ง JSON กลับมา'); }
      records.push(JSON.stringify(body, null, 2));
      if (!response.ok) throw new Error(body.error?.message || `เซิร์ฟเวอร์ตอบกลับ ${response.status}`);
      return body.data;
    }
    try {
      const recipe = await read(`/api/v1/recipes/${id}`);
      if (!recipe?.name || !Array.isArray(recipe.ingredients)) throw new Error('รูปแบบรายละเอียดสูตรไม่ถูกต้อง');
      const reviews = await read(`/api/v1/recipes/${id}/ratings`);
      if (!reviews || !Array.isArray(reviews.ratings) || !Number.isFinite(Number(reviews.ratingCount))) throw new Error('รูปแบบข้อมูลรีวิวไม่ถูกต้อง');
      const result = $('verify-result');
      result.replaceChildren(element('h3', recipe.name), element('p', `สูตร #${id} · ${recipe.cook_time_minutes} นาที`), element('h4', `วัตถุดิบ ${recipe.ingredients.length} รายการ`));
      result.append(recipe.ingredients.length ? resultList(recipe.ingredients.map(ingredientText)) : element('p', 'สูตรนี้ยังไม่มีวัตถุดิบที่ผูกไว้'));
      result.append(element('h4', Number(reviews.ratingCount) ? `คะแนนเฉลี่ย ${reviews.averageScore}/5 · ${reviews.ratingCount} รีวิว` : 'ยังไม่มีรีวิว'));
      if (reviews.ratings.length) {
        result.append(element('p', `แสดง ${Math.min(5, reviews.ratings.length)} รีวิวจากผลตอบกลับล่าสุด`));
        result.append(resultList(reviews.ratings.slice(0, 5).map((review) => `${review.username} · ${review.ratingScore}/5 · ${review.reviewComment || 'ไม่ได้เขียนความคิดเห็น'}`)));
      }
      result.hidden = false;
      $('verify-app-link').href = `/#recipe/${id}`;
      $('verify-app-link').hidden = false;
      $('verify-status').textContent = `อ่านสูตรและรีวิวสำเร็จ · ${new Date().toLocaleTimeString('th-TH')} · เปรียบเทียบกับข้อมูลที่คุณบันทึกบนเว็บ`;
    } catch (error) {
      const message = ['TimeoutError', 'AbortError'].includes(error.name) ? 'เซิร์ฟเวอร์ใช้เวลานานเกินไป' : error.message || 'เชื่อมต่อไม่ได้';
      $('verify-status').textContent = `ตรวจผลไม่ครบ: ${message} ตรวจรหัสสูตรแล้วลองอีกครั้ง`;
      records.push(`อ่านไม่สำเร็จ: ${message}`);
    } finally {
      $('verify-response').textContent = records.join('\n\n');
      verifying = false;
      $('verify-run').disabled = false;
      $('verify-id').disabled = false;
      $('verify-form').setAttribute('aria-busy', 'false');
    }
  });
  controls();
})();
