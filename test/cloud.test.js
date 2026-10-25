const fs = require("node:fs");
const path = require("node:path");
jest.mock("mysql2/promise", () => ({ createConnection: jest.fn() }));
jest.mock("node:child_process", () => ({ spawnSync: jest.fn() }));
const mysql = require("mysql2/promise");
const { spawnSync } = require("node:child_process");
const { bootstrap, databaseSql } = require("../tools/cloud-bootstrap");
const env = {
  DB_HOST: "mysql.railway.internal", DB_PORT: "3306", DB_NAME: "railway", DB_USER: "recipe_app", DB_PASSWORD: "private-runtime-fixture-password",
  INIT_DB_USER: "root", INIT_DB_PASSWORD: "private-root-fixture-password",
  CLOUD_CHEF_PASSWORD: "private-chef-fixture-password", CLOUD_MEMBER_PASSWORD: "private-member-fixture-password", CLOUD_ADMIN_PASSWORD: "private-admin-fixture-password",
};
const tables = ["categories", "users", "recipes", "ingredients", "recipe_ingredients", "ratings"];
const encoded = "scrypt$" + "a".repeat(32) + "$" + "b".repeat(128);
function database({ existing = tables, initialized = true, missingVersion = false, wrongIdentity = false } = {}) {
  const users = ["chef_somchai", "foodie_somying", "admin_wittawas"].map((username, i) => ({ id: i + 1, username, password_hash: initialized ? encoded : null }));
  if (wrongIdentity) users[0].username = "unrelated";
  const connection = { end: jest.fn(), query: jest.fn(async (sql, params) => {
    if (sql.startsWith("SELECT TABLE_NAME")) return [existing.map(TABLE_NAME => ({ TABLE_NAME }))];
    if (sql.includes("FROM schema_migrations")) return [missingVersion ? [] : [{ version: "001-password-hash" }]];
    if (sql.startsWith("SELECT id, username")) return [users];
    if (sql.startsWith("UPDATE users")) users.find(user => user.id === params[1]).password_hash = params[0];
    return [[]];
  }) };
  mysql.createConnection.mockResolvedValue(connection);
  spawnSync.mockReturnValue({ status: 0 });
  return connection;
}
beforeEach(() => { jest.clearAllMocks(); });

test("bootstrap strips only known database selectors and refuses unexpected directives", () => {
  for (const name of ["schema.sql", "seed.sql"]) {
    const sql = databaseSql(fs.readFileSync(path.join(__dirname, "..", name), "utf8"));
    expect(sql).not.toMatch(/^\s*(CREATE DATABASE|USE )/im);
  }
  expect(() => databaseSql("USE unrelated;\nSELECT 1;")).toThrow("Unexpected database directive");
});
test.each([{ DB_NAME: "railway;DROP DATABASE x" }, { DB_USER: "root" }, { DB_PASSWORD: "short" }, { INIT_DB_PASSWORD: "" }])("bootstrap rejects invalid boundary configuration %j before connecting", async (extra) => {
  await expect(bootstrap({ ...env, ...extra })).rejects.toThrow();
  expect(mysql.createConnection).not.toHaveBeenCalled();
});
test("bootstrap seeds an empty database, hashes unique accounts and gives runtime DML only", async () => {
  const connection = database({ existing: [], initialized: false });
  await bootstrap(env);
  const queries = connection.query.mock.calls;
  expect(queries.filter(([sql]) => sql.startsWith("UPDATE users"))).toHaveLength(3);
  expect(new Set(queries.filter(([sql]) => sql.startsWith("UPDATE users")).map(([, p]) => p[0])).size).toBe(3);
  expect(queries.some(([sql]) => sql.startsWith("CREATE TABLE IF NOT EXISTS categories" ) || sql.includes("CREATE TABLE IF NOT EXISTS categories"))).toBe(true);
  expect(queries.find(([sql]) => sql.startsWith("GRANT"))[0]).toBe("GRANT SELECT, INSERT, UPDATE, DELETE ON `railway`.* TO ?@'%'");
  expect(spawnSync.mock.calls[0][2].env.DB_USER).toBe("root");
  expect(mysql.createConnection.mock.calls.at(-1)[0].user).toBe("recipe_app");
});
test("repeat bootstrap preserves all existing password hashes and does not reseed", async () => {
  const connection = database();
  await bootstrap(env);
  expect(connection.query.mock.calls.some(([sql]) => sql.startsWith("UPDATE users") || sql.includes("INSERT INTO categories"))).toBe(false);
});
test.each([[], ["categories"], [...tables, "unrelated_table"]].map(existing => ({ existing })))("bootstrap refuses missing credentials or partial/unrelated tables $existing", async ({ existing }) => {
  const connection = database({ existing, initialized: false });
  await expect(bootstrap({ ...env, CLOUD_MEMBER_PASSWORD: "" })).rejects.toThrow();
  expect(connection.query.mock.calls.some(([sql]) => sql.startsWith("UPDATE") || sql.includes("CREATE TABLE"))).toBe(false);
});
test("fixture identity mismatch is refused before migration", async () => {
  database({ wrongIdentity: true });
  await expect(bootstrap(env)).rejects.toThrow("unexpected fixture identities");
  expect(spawnSync).not.toHaveBeenCalled();
});
test("runtime-only subsequent predeploy verifies schema without changing any data", async () => {
  const connection = database();
  await bootstrap({ ...env, INIT_DB_USER: "", INIT_DB_PASSWORD: "" });
  expect(connection.query.mock.calls.every(([sql]) => sql.startsWith("SELECT"))).toBe(true);
  expect(spawnSync).not.toHaveBeenCalled();
});
test("runtime-only predeploy rejects missing migration", async () => {
  database({ missingVersion: true });
  await expect(bootstrap({ ...env, INIT_DB_USER: "", INIT_DB_PASSWORD: "" })).rejects.toThrow("Required migration");
});
test("container copies an explicit runtime allowlist and runs as nonroot", () => {
  const docker = fs.readFileSync(path.join(__dirname, "../Dockerfile"), "utf8");
  expect(docker).toContain("USER node");
  expect(docker).not.toMatch(/COPY\s+\.\s+/);
  expect(docker).toContain("npm ci --omit=dev --ignore-scripts");
  for (const file of [".dockerignore", ".railwayignore"]) {
    const ignore = fs.readFileSync(path.join(__dirname, "..", file), "utf8");
    expect(ignore.startsWith("**\n") || ignore.startsWith("**\r\n")).toBe(true);
    expect(ignore).toContain("**/.env.*");
    expect(ignore).not.toContain("!test");
  }
});
