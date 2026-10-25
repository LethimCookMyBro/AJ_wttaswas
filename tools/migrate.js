const fs = require("fs");
const path = require("path");
require("dotenv").config();
const pool = require("../src/db");

async function migrate(direction = "up") {
  if (!["up", "down"].includes(direction)) throw new Error("Migration direction must be up or down");
  const connection = await pool.getConnection();
  try {
    await connection.query("CREATE TABLE IF NOT EXISTS schema_migrations (version VARCHAR(100) PRIMARY KEY, applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)");
    const [columns] = await connection.query("SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'password_hash'");
    if (direction === "up") {
      if (!columns.length) await connection.query(fs.readFileSync(path.join(__dirname, "../migrations/001-password-hash.sql"), "utf8"));
      await connection.query("INSERT IGNORE INTO schema_migrations (version) VALUES (?)", ["001-password-hash"]);
      console.log("Migration UP 001-password-hash applied; existing business rows preserved");
    } else {
      if (columns.length) await connection.query(fs.readFileSync(path.join(__dirname, "../migrations/001-password-hash.down.sql"), "utf8"));
      await connection.query("DELETE FROM schema_migrations WHERE version = ?", ["001-password-hash"]);
      console.log("Migration DOWN 001-password-hash applied; password hashes removed, business rows preserved; rerun UP and setup-demo before login");
    }
  } finally { connection.release(); }
}
if (require.main === module) migrate(process.argv[2] || "up").catch((err) => { console.error(err.message); process.exitCode = 1; }).finally(() => pool.end());
module.exports = { migrate };
