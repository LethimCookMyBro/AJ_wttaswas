const crypto = require("crypto");
const { promisify } = require("util");
const scrypt = promisify(crypto.scrypt);
const OPTIONS = { N: 16384, r: 8, p: 1 };

async function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const key = await scrypt(password, salt, 64, OPTIONS);
  return `scrypt$${salt}$${key.toString("hex")}`;
}

async function verifyPassword(password, encoded) {
  if (typeof encoded !== "string" || !/^scrypt\$[a-f0-9]{32}\$[a-f0-9]{128}$/.test(encoded)) return false;
  const [, salt, expected] = encoded.split("$");
  const actual = await scrypt(password, salt, 64, OPTIONS);
  return crypto.timingSafeEqual(actual, Buffer.from(expected, "hex"));
}

module.exports = { hashPassword, verifyPassword };
