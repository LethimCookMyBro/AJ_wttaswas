// Read-only supplement to previously recorded MariaDB examples. Never seeds/resets a DB.
const fs = require('node:fs');
const net = require('node:net');
const { spawn } = require('node:child_process');
const assert = require('node:assert/strict');
const mysql = require('mysql2/promise');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
(async () => {
  const reservation = net.createServer();
  await new Promise(r => reservation.listen(0, '127.0.0.1', r));
  const port = reservation.address().port;
  await new Promise(r => reservation.close(r));
  const binaries = '/tmp/krua-mariadb-root/usr';
  const db = spawn(`${binaries}/sbin/mariadbd`, ['--no-defaults', `--basedir=${binaries}`, '--datadir=/tmp/krua-isolated-db', '--socket=', `--port=${port}`, '--bind-address=127.0.0.1', '--skip-name-resolve', '--pid-file=/tmp/krua-postman-supplement.pid', '--innodb-buffer-pool-size=32M'], {env: {...process.env, LD_LIBRARY_PATH: `${binaries}/lib/x86_64-linux-gnu`}, stdio: ['ignore','ignore','ignore']});
  let connection, pool, server;
  try {
    for(let i=0;i<100;i++) {
      if(db.exitCode !== null) throw new Error(`Isolated DB exited ${db.exitCode}`);
      try {connection=await mysql.createConnection({host:'127.0.0.1',port,user:'root',password:'',database:'recipe_api'});break;}catch{await new Promise(r=>setTimeout(r,100));}
    }
    assert.ok(connection, 'Isolated database unavailable');
    const [[version]] = await connection.query('SELECT VERSION() AS version');
    Object.assign(process.env, {NODE_ENV:'test', USE_REAL_DB:'1', DB_HOST:'127.0.0.1', DB_PORT:String(port), DB_USER:'root', DB_PASSWORD:'', DB_NAME:'recipe_api', JWT_SECRET:require('node:crypto').randomBytes(32).toString('hex'), TRUST_PROXY_HOPS:'0'});
    pool = require('../src/db');
    const app = require('../src/index');
    server=await new Promise(r=>{const s=app.listen(0,'127.0.0.1',()=>r(s));});
    const base=`http://127.0.0.1:${server.address().port}`;
    const health=await fetch(base+'/healthz'); assert.equal(health.status,200);
    const {recordCollection}=require('../tools/record-postman');
    const supplement={info:{name:'Read-only system supplement',description:''},item:[{name:'Read system architecture and storage',request:{method:'GET',header:[],auth:{type:'noauth'},url:'{{baseUrl}}/api/v1/system'},event:[{listen:'test',script:{type:'text/javascript',exec:["pm.test('HTTP 200', () => pm.response.to.have.status(200));"]}}]}]};
    await recordCollection(supplement,base,'unused-no-login-request');
    const result=JSON.parse(fs.readFileSync(path.join(__dirname,'postman-observed-mariadb.json'),'utf8'));
    result.item.push(supplement.item[0]);
    result.info.description += ` Supplement: GET /api/v1/system observed at ${new Date().toISOString()} on isolated ${version.version}, health GET 200. Existing 15 examples retained unchanged; supplement uses no login, mutation, seed or reset. System response reports configuration; successful health establishes DB connectivity, not a system-route SQL query.`;
    fs.writeFileSync(path.join(root,'postman_collection.json'),JSON.stringify(result,null,2)+'\n');
    console.log('Recorded missing GET system; root collection contains '+result.item.length+' observed responses');
  } finally {
    if(server) await new Promise(r=>server.close(r));
    if(pool) await pool.end();
    if(connection) await connection.end();
    if(db.exitCode===null) {const stopped=new Promise(r=>db.once('exit',r));db.kill('SIGTERM');await stopped;}
  }
})().catch(e=>{console.error(e);process.exitCode=1;});
