require("dotenv").config();
const pool = require("../src/db");
const { migrate } = require("./migrate");
const { hashPassword } = require("../src/password");

async function setupDemo() {
  const password = process.env.DEMO_PASSWORD;
  if (typeof password !== "string" || password.length < 12 || password.length > 256) throw new Error("DEMO_PASSWORD must contain 12 to 256 characters");
  await migrate();
  for (const [id, username] of [[1, "chef_somchai"], [2, "foodie_somying"], [3, "admin_wittawas"]]) {
    const [result] = await pool.query("UPDATE users SET password_hash = ? WHERE id = ? AND username = ?", [await hashPassword(password), id, username]);
    if (result.affectedRows !== 1) throw new Error(`Fixture user missing: ${username}`);
  }
  console.log("Demo passwords set for the three existing fixture users only");
}
if (require.main === module) setupDemo().catch((err) => { console.error(err.message); process.exitCode = 1; }).finally(() => pool.end());
module.exports = { setupDemo };
