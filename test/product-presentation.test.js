const fs = require('node:fs');
const path = require('node:path');
const frontend = path.join(__dirname, '../frontend');
const html = fs.readFileSync(path.join(frontend, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(frontend, 'styles.css'), 'utf8');

test('product keeps one unique target for every static app control', () => {
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
  expect(new Set(ids).size).toBe(ids.length);
  const app = fs.readFileSync(path.join(frontend, 'app.js'), 'utf8');
  const staticControls = [...app.matchAll(/byId\('([^']+)'\)/g)].map(match => match[1]);
  for (const id of staticControls) expect(ids).toContain(id);
});

test('product typography is self-hosted with licensed genuine font assets', () => {
  expect(css).toContain("font-family:'IBM Plex Sans Thai',Tahoma,sans-serif");
  expect(html).toContain('/assets/ibm-plex-sans-thai-400.ttf');
  for (const weight of [400, 500, 600]) {
    const font = fs.readFileSync(path.join(frontend, `assets/ibm-plex-sans-thai-${weight}.ttf`));
    expect(font.subarray(0, 4).toString('hex')).toBe('00010000');
    expect(css).toContain(`/assets/ibm-plex-sans-thai-${weight}.ttf`);
  }
  expect(fs.readFileSync(path.join(frontend, 'assets/IBM-Plex-Sans-Thai-LICENSE.txt'), 'utf8')).toContain('SIL OPEN FONT LICENSE');
});

test('product and presentation entry remain separate without repeated discovery panels', () => {
  expect(html).toMatch(/class="docs-link" href="\/api-docs\/">นำเสนอ<\/a>/);
  expect(html).not.toContain('class="discovery-path"');
  for (const view of ['home', 'detail', 'create', 'ideas', 'login']) expect(html).toContain(`data-view="${view}"`);
  for (const id of ['recipe-form', 'ingredient-form', 'rating-form', 'delete-confirm']) expect(html).toContain(`id="${id}"`);
});
