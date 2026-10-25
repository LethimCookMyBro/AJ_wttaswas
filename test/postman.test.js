const { collection, recordCollection } = require("../tools/record-postman");
const app = require("../src/index");
const pool = require("../src/db");
const { startFakeServer, json } = require("./helpers");

test("recording replays the full flow and preserves templates without embedding password or JWT", async () => {
  const external = await startFakeServer((req,res)=>json(res,200,{meals:[]}));
  const old = process.env.EXTERNAL_API_BASE_URL;
  process.env.EXTERNAL_API_BASE_URL = external.url;
  const server = app.listen(0,"127.0.0.1");
  await new Promise((resolve)=>server.once("listening",resolve));
  try {
    const result = await recordCollection(structuredClone(collection),`http://127.0.0.1:${server.address().port}`,process.env.DEMO_PASSWORD);
    expect(result.item).toHaveLength(16);
    expect(result.item.every((item)=>item.response.length===1)).toBe(true);
    const text = JSON.stringify(result);
    expect(text).not.toContain(process.env.DEMO_PASSWORD);
    expect(text).not.toMatch(/eyJ[a-zA-Z0-9_-]+\./);
    expect(text).toContain("[REDACTED JWT - observed token omitted]");
    expect(text).toContain("{{demoPassword}}");
    expect(text).toContain("{{token}}");
    const [rows] = await pool.query("SELECT COUNT(*) AS total FROM recipes r",[]);
    expect(rows[0].total).toBe(3);
  } finally {
    if (old === undefined) delete process.env.EXTERNAL_API_BASE_URL; else process.env.EXTERNAL_API_BASE_URL=old;
    server.closeAllConnections();
    await new Promise((resolve)=>server.close(resolve));
    await external.close();
  }
});
test("recording refuses non-local destinations and missing passwords", async () => {
  await expect(recordCollection(structuredClone(collection),"https://example.com","private")).rejects.toThrow("local course fixture");
  await expect(recordCollection(structuredClone(collection),"http://127.0.0.1:3000","")).rejects.toThrow("DEMO_PASSWORD");
});


test("default CLI writes a separate template without overwriting observed teacher evidence", () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const {execFileSync} = require('node:child_process');
  const root = path.resolve(__dirname, '..');
  const observedPath = path.join(root, 'postman_collection.json');
  const templatePath = path.join(root, 'postman_template.json');
  const observed = fs.readFileSync(observedPath);
  const priorTemplate = fs.existsSync(templatePath) ? fs.readFileSync(templatePath) : null;
  try {
    execFileSync(process.execPath, [path.join(root, 'tools/record-postman.js')], {cwd:root});
    expect(fs.readFileSync(observedPath).equals(observed)).toBe(true);
    const template = JSON.parse(fs.readFileSync(templatePath, 'utf8'));
    expect(template.item).toHaveLength(16);
    expect(template.item.every(item => !item.response)).toBe(true);
    expect(template.item.some(item => item.request.url.endsWith('/api/v1/system'))).toBe(true);
  } finally {
    if(priorTemplate) fs.writeFileSync(templatePath, priorTemplate);
    else fs.rmSync(templatePath, {force:true});
  }
});
