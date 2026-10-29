const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const mysql = require("mysql2/promise");
const { hashPassword } = require("../src/password");

const tables = ["categories", "users", "recipes", "ingredients", "recipe_ingredients", "ratings"];
const accounts = [
  { id: 1, username: "chef_somchai", key: "CLOUD_CHEF_PASSWORD" },
  { id: 2, username: "foodie_somying", key: "CLOUD_MEMBER_PASSWORD" },
  { id: 3, username: "admin_web", key: "CLOUD_ADMIN_PASSWORD" },
];

function databaseSql(text) {
  const result = text.split(/\r?\n/).filter((line) => !/^\s*(CREATE DATABASE IF NOT EXISTS recipe_api\b.*;|USE recipe_api;)\s*$/.test(line)).join("\n");
  if (/^\s*(CREATE\s+DATABASE|USE\s+)/im.test(result)) throw new Error("Unexpected database directive in bootstrap SQL");
  return result;
}

async function verifyReady(connection) {
  for (const table of tables) await connection.query(`SELECT 1 FROM ${table} LIMIT 1`);
  const [versions] = await connection.query("SELECT version FROM schema_migrations WHERE version = ?", ["001-password-hash"]);
  if (versions.length !== 1) throw new Error("Required migration is missing");
  const [users] = await connection.query("SELECT id, username, password_hash FROM users WHERE id IN (1,2,3)");
  if (accounts.some((account) => !users.some((user) => user.id === account.id && user.username === account.username && /^scrypt\$[a-f0-9]{32}\$[a-f0-9]{128}$/.test(user.password_hash)))) throw new Error("Private fixture credentials are not initialized");
}

async function bootstrap(env = process.env) {
  if (!/^[A-Za-z0-9_]+$/.test(env.DB_NAME || "")) throw new Error("DB_NAME must be a database identifier");
  if (!/^[a-z][a-z0-9_]{0,31}$/.test(env.DB_USER || "") || env.DB_USER === "root") throw new Error("DB_USER must be a non-root application user");
  if (!env.DB_PASSWORD || env.DB_PASSWORD.length < 20) throw new Error("DB_PASSWORD must contain at least 20 characters");
  if (Boolean(env.INIT_DB_USER) !== Boolean(env.INIT_DB_PASSWORD)) throw new Error("Supply both initial database credentials or neither");
  const initialize = Boolean(env.INIT_DB_USER);
  const connection = await mysql.createConnection({
    host: env.DB_HOST, port: Number(env.DB_PORT || 3306), database: env.DB_NAME,
    user: initialize ? env.INIT_DB_USER : env.DB_USER,
    password: initialize ? env.INIT_DB_PASSWORD : env.DB_PASSWORD,
    multipleStatements: initialize,
  });
  try {
    if (!initialize) {
      await verifyReady(connection);
      console.log("Cloud schema and private accounts ready; no initialization changes.");
      return;
    }
    const [existing] = await connection.query("SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_TYPE = 'BASE TABLE'");
    if (existing.length === 0) {
      const passwords = accounts.map((account) => env[account.key]);
      if (passwords.some((password) => typeof password !== "string" || password.length < 20) || new Set(passwords).size !== accounts.length) throw new Error("Supply three unique private account passwords, each at least 20 characters");
      for (const file of ["schema.sql", "seed.sql"]) await connection.query(databaseSql(fs.readFileSync(path.join(__dirname, "..", file), "utf8")));
      console.log("Initialized synthetic schema and seed in the new cloud database.");
    } else if (tables.some((table) => !existing.some((row) => row.TABLE_NAME === table)) || existing.some((row) => ![...tables, "schema_migrations"].includes(row.TABLE_NAME))) {
      throw new Error("Refusing to initialize a partially populated or unrelated database");
    }
    const [identities] = await connection.query("SELECT id, username FROM users WHERE id IN (1,2,3)");
    if (accounts.some((account) => !identities.some((user) => user.id === account.id && user.username === account.username))) throw new Error("Refusing migration of a database with unexpected fixture identities");
    const migration = spawnSync(process.execPath, [path.join(__dirname, "migrate.js"), "up"], {
      env: { ...process.env, ...env, NODE_ENV: "production", USE_REAL_DB: "1", DB_USER: env.INIT_DB_USER, DB_PASSWORD: env.INIT_DB_PASSWORD },
      stdio: ["ignore", "pipe", "pipe"], encoding: "utf8",
    });
    if (migration.error || migration.status !== 0) throw new Error("Cloud migration failed");
    const [users] = await connection.query("SELECT id, username, password_hash FROM users WHERE id IN (1,2,3)");
    const pending = accounts.filter((account) => {
      const user = users.find((row) => row.id === account.id && row.username === account.username);
      if (!user) throw new Error("Cloud fixture identity does not match expected seed");
      return !user.password_hash;
    });
    if (pending.some((account) => typeof env[account.key] !== "string" || env[account.key].length < 20) || new Set(pending.map((account) => env[account.key])).size !== pending.length) throw new Error("Missing unique private account credentials for uninitialized users");
    for (const account of pending) await connection.query("UPDATE users SET password_hash = ? WHERE id = ? AND username = ? AND password_hash IS NULL", [await hashPassword(env[account.key]), account.id, account.username]);
    await connection.query("CREATE USER IF NOT EXISTS ?@'%' IDENTIFIED BY ?", [env.DB_USER, env.DB_PASSWORD]);
    await connection.query(`GRANT SELECT, INSERT, UPDATE, DELETE ON \`${env.DB_NAME}\`.* TO ?@'%'`, [env.DB_USER]);
    const runtime = await mysql.createConnection({ host: env.DB_HOST, port: Number(env.DB_PORT || 3306), database: env.DB_NAME, user: env.DB_USER, password: env.DB_PASSWORD });
    try { await verifyReady(runtime); } finally { await runtime.end(); }
    console.log("Cloud migration ready; private account hashes initialized without replacing existing hashes; runtime user has DML privileges only.");
  } finally { await connection.end(); }
}

if (require.main === module) bootstrap().catch((error) => { console.error(error.code || error.message); process.exitCode = 1; });
module.exports = { bootstrap, databaseSql, verifyReady };
