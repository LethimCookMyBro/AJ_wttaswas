// Repeatable evidence capture against a disposable in-memory Express server only.
process.env.NODE_ENV = "test";
process.env.USE_REAL_DB = "";
process.env.JWT_SECRET = require("node:crypto").randomBytes(32).toString("hex");
process.env.DEMO_PASSWORD = require("node:crypto").randomBytes(24).toString("hex");
const fs = require("node:fs");
const path = require("node:path");
const app = require("../src/index");
const { collection, recordCollection } = require("../tools/record-postman");
const { startFakeServer, json } = require("../test/helpers");
(async () => {
  const external = await startFakeServer((req, res) => json(res, 200, { meals: [{ idMeal: "fixture-1", strMeal: "Local upstream fixture", strMealThumb: null }] }));
  process.env.EXTERNAL_API_BASE_URL = external.url;
  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  try {
    const document = await recordCollection(structuredClone(collection), `http://127.0.0.1:${server.address().port}`, process.env.DEMO_PASSWORD);
    document.info.name += " (observed mock/local fixture run)";
    document.info.description += " Database mode: in-memory test fixture, NOT MySQL. MealDB endpoint: controlled local HTTP fixture, NOT live TheMealDB. No production data touched.";
    const serialized = JSON.stringify(document, null, 2);
    if (serialized.includes(process.env.DEMO_PASSWORD) || /eyJ[a-zA-Z0-9_-]+\./.test(serialized)) throw new Error("Secret redaction failed");
    fs.writeFileSync(path.join(__dirname, "postman-observed-mock.json"), serialized + "\n");
    console.log(`Saved ${document.item.length} observed request/response pairs; all expected statuses matched.`);
  } finally {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
    await external.close();
  }
})().catch((error) => { console.error(error.message); process.exitCode = 1; });
