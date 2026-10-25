const assert = require('node:assert/strict');
if (process.env.USE_REAL_DB !== '1') throw new Error('USE_REAL_DB=1 is required; use the isolated fixture only');
if (process.env.DB_HOST !== '127.0.0.1' || process.env.DB_PORT !== '33317') throw new Error('Only the isolated loopback33317 fixture is allowed');
const pool = require('../src/db');
(async () => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const probes = [
      ['CHECK score1-5', 'INSERT INTO ratings (recipe_id,user_id,rating_score) VALUES (3,2,6)', 3819],
      ['UNIQUE recipe-user', 'INSERT INTO ratings (recipe_id,user_id,rating_score) VALUES (1,2,4)', 1062],
      ['FOREIGN KEY recipe', 'INSERT INTO ratings (recipe_id,user_id,rating_score) VALUES (2147483647,1,4)', 1452],
      ['RESTRICT category', 'DELETE FROM categories WHERE id=1', 1451],
    ];
    for (const [name, sql, errno] of probes) {
      await assert.rejects(connection.query(sql), (error) => error.errno === errno, name);
      console.log(`PASS ${name}: rejected with MySQL errno=${errno}`);
    }
  } finally {
    await connection.rollback();
    connection.release();
    await pool.end();
  }
  console.log('All constraint probes rolled back; no business data committed.');
})().catch((error) => { console.error(error.stack); process.exitCode = 1; });
