const crypto = require("crypto");
require("dotenv").config();
const realDatabase = process.env.USE_REAL_DB === "1";
if (!realDatabase) {
  process.env.NODE_ENV = "test";
  process.env.USE_REAL_DB = "";
  process.env.JWT_SECRET ||= crypto.randomBytes(32).toString("hex");
  process.env.DEMO_PASSWORD ||= "DemoRecipe67160003!";
}
process.env.EXTERNAL_API_TIMEOUT_MS = "800";
process.env.EXTERNAL_API_MAX_RETRIES = "2";
process.env.EXTERNAL_API_BACKOFF_MS = "100";
const app = require("../src/index");
const port = Number(process.env.PORT || 3000);
const server = app.listen(port, "127.0.0.1", () => {
  const actualPort = server.address().port;
  console.log(`Recipe demo http://127.0.0.1:${actualPort}`);
  console.log(realDatabase ? "Storage: MYSQL from configured DB_* environment. Writes persist across restarts." : "Storage: IN-MEMORY synthetic seed. Restart discards edits; local fixture password is documented in .env.example.");
  console.log(`OpenAPI http://127.0.0.1:${actualPort}/api-docs/`);
});
server.on("error", (error) => {
  console.error(error.message);
  process.exitCode = 1;
});
async function shutdown() {
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
  await require("../src/db").end();
}
process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);
