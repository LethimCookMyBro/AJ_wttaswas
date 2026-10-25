param([string]$Node = '', [string]$Docker = '')
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
if (!$Node) {
  $installed = Get-Command node -ErrorAction SilentlyContinue
  $Node = if ($installed) { $installed.Source } else { Join-Path $env:USERPROFILE '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe' }
}
if (!$Docker) {
  $installed = Get-Command docker -ErrorAction SilentlyContinue
  $Docker = if ($installed) { $installed.Source } else { Join-Path $env:ProgramFiles 'Docker/Docker/resources/bin/docker.exe' }
}
if (!(Test-Path -LiteralPath $Node) -or !(Test-Path -LiteralPath $Docker)) { throw 'Install Node and Docker Desktop, or pass -Node and -Docker explicitly.' }
$records = [Collections.Generic.List[object]]::new()
$envPath = Join-Path $root '.transaction/final-mysql.env'
$logPath = Join-Path $root '.transaction/final-mysql-results.json'
New-Item -ItemType Directory -Path (Join-Path $root '.transaction') -Force | Out-Null
if (Test-Path -LiteralPath $logPath) {
  $stamp = [DateTime]::UtcNow.ToString('yyyyMMddTHHmmssfffZ', [Globalization.CultureInfo]::InvariantCulture)
  Copy-Item -LiteralPath $logPath -Destination (Join-Path $root ".transaction/final-mysql-history-$stamp.json")
}
if (!(Test-Path -LiteralPath $envPath)) {
  if (Get-NetTCPConnection -LocalPort 33317 -ErrorAction SilentlyContinue) { throw 'Port33317 is occupied. No existing service was changed.' }
  function New-LocalSecret { $bytes = New-Object byte[] 32; [Security.Cryptography.RandomNumberGenerator]::Fill($bytes); [Convert]::ToHexString($bytes) }
  $password = New-LocalSecret
  @('DB_HOST=127.0.0.1','DB_PORT=33317','DB_USER=recipe_app',"DB_PASSWORD=$password",'DB_NAME=recipe_api','USE_REAL_DB=1','NODE_ENV=development',"JWT_SECRET=$(New-LocalSecret)",'DEMO_PASSWORD=Recipe67160003!','PORT=3000','HOST=127.0.0.1','ALLOWED_ORIGIN=http://127.0.0.1:3000') | Set-Content -LiteralPath $envPath -Encoding utf8
  @("MYSQL_ROOT_PASSWORD=$(New-LocalSecret)",'MYSQL_DATABASE=recipe_api','MYSQL_USER=recipe_app',"MYSQL_PASSWORD=$password") | Set-Content -LiteralPath (Join-Path $root '.transaction/final-mysql-docker.env') -Encoding utf8
}
$container = & $Docker inspect recipe-final-root-67160003 --format '{{index .Config.Labels "codex.owner"}}' 2>$null
if ($LASTEXITCODE -ne 0) {
  & $Docker image inspect mysql:8.0 --format '{{.Id}}' | Out-Null
  if ($LASTEXITCODE -ne 0) { throw 'mysql:8.0 is not installed. Run docker pull mysql:8.0 explicitly, then rerun.' }
  & $Docker run -d --name recipe-final-root-67160003 --label codex.owner=root-final-67160003 --env-file (Join-Path $root '.transaction/final-mysql-docker.env') -p 127.0.0.1:33317:3306 mysql:8.0
  if ($LASTEXITCODE -ne 0) { throw 'Could not create the isolated MySQL fixture.' }
} elseif ($container -ne 'root-final-67160003') { throw 'Container name is owned by another task. Nothing was changed.' }
& $Docker start recipe-final-root-67160003 | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'Could not start the owned MySQL fixture.' }
foreach ($line in Get-Content -LiteralPath $envPath) {
  if ($line -match '^([A-Z_]+)=(.*)$') { [Environment]::SetEnvironmentVariable($matches[1], $matches[2], 'Process') }
}
if ($env:DB_HOST -ne '127.0.0.1' -or $env:DB_PORT -ne '33317' -or $env:DB_NAME -ne 'recipe_api') {
  throw 'This verification only permits the dedicated loopback33317 recipe_api fixture.'
}
$ready = $false
for ($attempt = 0; $attempt -lt 90; $attempt++) {
  & $Docker exec recipe-final-root-67160003 mysqladmin ping --silent 2>$null | Out-Null
  if ($LASTEXITCODE -eq 0) { $ready = $true; break }
  Start-Sleep -Seconds 1
}
if (!$ready) { throw 'Owned MySQL fixture did not become ready.' }
function Invoke-Recorded([string]$Name, [string[]]$Arguments) {
  $info = [Diagnostics.ProcessStartInfo]::new($Node)
  $info.WorkingDirectory = $root
  $info.UseShellExecute = $false
  $info.CreateNoWindow = $true
  $info.RedirectStandardOutput = $true
  $info.RedirectStandardError = $true
  foreach ($argument in $Arguments) { $info.ArgumentList.Add($argument) }
  $process = [Diagnostics.Process]::Start($info)
  $outTask = $process.StandardOutput.ReadToEndAsync()
  $errTask = $process.StandardError.ReadToEndAsync()
  $process.WaitForExit()
  $stdout = $outTask.GetAwaiter().GetResult()
  $stderr = $errTask.GetAwaiter().GetResult()
  $records.Add([ordered]@{ name=$Name; command=@($Node)+$Arguments; cwd=$root; stdout=$stdout; stderr=$stderr; exitCode=$process.ExitCode })
  $records | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $logPath -Encoding utf8
  Write-Output "[$Name] exit=$($process.ExitCode)"
  Write-Output $stdout
  if ($stderr) { Write-Output $stderr }
  if ($process.ExitCode -ne 0) { throw "$Name failed. Literal process output is in $logPath" }
}
$bootstrap = @'
const fs=require('node:fs');
const mysql=require('mysql2/promise');
(async()=>{
 const c=await mysql.createConnection({host:process.env.DB_HOST,port:Number(process.env.DB_PORT),user:process.env.DB_USER,password:process.env.DB_PASSWORD,database:process.env.DB_NAME,multipleStatements:true});
 try {
  const [[v]]=await c.query('SELECT VERSION() AS version, @@max_connections AS maxConnections');
  console.log('MySQL version='+v.version);
  const projectPool=require('./src/db');console.log('CAPACITY max_connections='+v.maxConnections+' root connectionLimit='+projectPool.pool.config.connectionLimit);await projectPool.end();
  const [[n]]=await c.query('SELECT COUNT(*) AS total FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE()');
  if(n.total===0){await c.query(fs.readFileSync('schema.sql','utf8'));await c.query(fs.readFileSync('seed.sql','utf8'));console.log('BOOTSTRAP schema.sql + seed.sql applied to empty isolated database');}
  else console.log('BOOTSTRAP skipped; existing isolated database preserved');
  for(const t of ['categories','users','recipes','ingredients','recipe_ingredients','ratings']){const [[r]]=await c.query('SELECT COUNT(*) AS total FROM '+t);console.log(t+' rows='+r.total);}
 }finally{await c.end();}
})().catch(e=>{console.error(e.stack);process.exitCode=1;});
'@
$schemaCheck = @'
const assert=require('node:assert/strict');const mysql=require('mysql2/promise');
(async()=>{const c=await mysql.createConnection({host:process.env.DB_HOST,port:Number(process.env.DB_PORT),user:process.env.DB_USER,password:process.env.DB_PASSWORD,database:process.env.DB_NAME});try{
const expected=Number(process.argv[1]);const [[col]]=await c.query("SELECT COUNT(*) AS total FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='users' AND COLUMN_NAME='password_hash'");
const [[ledger]]=await c.query("SELECT COUNT(*) AS total FROM schema_migrations WHERE version='001-password-hash'");
assert.equal(col.total,expected);assert.equal(ledger.total,expected);console.log('MIGRATION STATE password_hash='+col.total+' ledger='+ledger.total+' PASS');
}finally{await c.end();}})().catch(e=>{console.error(e.stack);process.exitCode=1;});
'@
$migrationRows = @'
const assert=require('node:assert/strict');const fs=require('node:fs');const crypto=require('node:crypto');const pool=require('./src/db');
(async()=>{try{const data={};for(const t of ['categories','users','recipes','ingredients','recipe_ingredients','ratings']){const [rows]=await pool.query(t==='users'?'SELECT id,username,email,role,created_at FROM users ORDER BY id':'SELECT * FROM '+t+' ORDER BY id');data[t]=rows;}const snapshot=JSON.stringify(data);const file='.transaction/final-mysql-schema-snapshot.json';if(process.argv[1]==='before'){fs.writeFileSync(file,snapshot);console.log('MIGRATION business row baseline captured without password hashes');}else{assert.equal(snapshot,fs.readFileSync(file,'utf8'));console.log('MIGRATION PRESERVATION PASS all six business row snapshots identical sha256='+crypto.createHash('sha256').update(snapshot).digest('hex'));}}finally{await pool.end();}})().catch(e=>{console.error(e.stack);process.exitCode=1;});
'@
$persistence = @'
const assert=require('node:assert/strict');const {spawn}=require('node:child_process');const {once}=require('node:events');const crypto=require('node:crypto');const pool=require('./src/db');
let child;let recipeId;let token;const base='http://127.0.0.1:33318';
async function start(){child=spawn(process.execPath,['--eval',"const app=require('./src/index');app.listen(33318,'127.0.0.1');"],{cwd:process.cwd(),env:process.env,stdio:['ignore','pipe','pipe']});let err='';child.stderr.on('data',d=>err+=d);child.stdout.resume();for(let i=0;i<100;i++){if(child.exitCode!==null)throw Error('API child exited '+child.exitCode+' '+err);try{const r=await fetch(base+'/api/v1/system',{signal:AbortSignal.timeout(400)});if(r.status===200){console.log('API CHILD started pid='+child.pid+' loopback33318');return;}}catch{}await new Promise(r=>setTimeout(r,100));}throw Error('API child startup timeout '+err);}
async function stop(){if(child&&child.exitCode===null){const exited=once(child,'exit');child.kill();await exited;console.log('API CHILD stopped');}child=null;}
async function call(method,path,body,auth,status){const r=await fetch(base+path,{method,headers:{'Content-Type':'application/json',...(auth?{Authorization:'Bearer '+auth}:{})},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(3000)});const d=await r.json();assert.equal(r.status,status,method+' '+path+' '+JSON.stringify(d));console.log(method+' '+path+' => '+r.status);return d;}
async function snapshot(){const data={};for(const t of ['categories','users','recipes','ingredients','recipe_ingredients','ratings']){const [rows]=await pool.query('SELECT * FROM '+t+' ORDER BY id');data[t]=rows;}return JSON.stringify(data);}
(async()=>{let before;try{before=await snapshot();await start();token=(await call('POST','/api/v1/auth/login',{username:'chef_somchai',password:process.env.DEMO_PASSWORD},null,200)).data.token;
const added=await call('POST','/api/v1/recipes',{name:'Persistence %_ restart fixture',categoryId:1,instructions:'temporary isolated test',cookTimeMinutes:12,difficulty:'easy'},token,201);recipeId=added.data.id;
await stop();await start();const found=await call('GET','/api/v1/recipes/'+recipeId,null,null,200);assert.equal(found.data.name,'Persistence %_ restart fixture');console.log('PERSISTENCE PASS recipe survived actual Node process restart');
const search=await call('GET','/api/v1/recipes?search='+encodeURIComponent('%_'),null,null,200);assert.deepEqual(search.data.map(r=>r.id),[recipeId]);console.log('REAL SQL SEARCH PASS percent and underscore matched literally');
await call('DELETE','/api/v1/recipes/'+recipeId,null,token,200);recipeId=null;
assert.equal(await snapshot(),before,'All six tables must preserve exact existing rows');console.log('PRESERVATION PASS all six existing table row snapshots identical sha256='+crypto.createHash('sha256').update(before).digest('hex'));
}finally{if(recipeId)await pool.query('DELETE FROM recipes WHERE id=?',[recipeId]);await stop();await pool.end();}})().catch(e=>{console.error(e.stack);process.exitCode=1;});
'@
Invoke-Recorded 'bootstrap' @('--eval', $bootstrap)
Invoke-Recorded 'migration-business-rows-before' @('--eval', $migrationRows, 'before')
Invoke-Recorded 'migration-up' @('tools/migrate.js', 'up')
Invoke-Recorded 'migration-up-state' @('--eval', $schemaCheck, '1')
Invoke-Recorded 'migration-down' @('tools/migrate.js', 'down')
Invoke-Recorded 'migration-down-state' @('--eval', $schemaCheck, '0')
Invoke-Recorded 'migration-up-again' @('tools/migrate.js', 'up')
Invoke-Recorded 'migration-up-again-state' @('--eval', $schemaCheck, '1')
Invoke-Recorded 'migration-business-rows-after' @('--eval', $migrationRows, 'after')
Invoke-Recorded 'setup-demo' @('tools/setup-demo.js')
Invoke-Recorded 'real-api-smoke' @('tools/real-db-smoke.js')
Invoke-Recorded 'process-restart-persistence' @('--eval', $persistence)
Write-Output "PASS. Literal stdout, stderr, exit statuses and command arrays reopened from $logPath"
$reopened = Get-Content -LiteralPath $logPath -Raw | ConvertFrom-Json
if ($reopened.Count -ne 12 -or @($reopened | Where-Object exitCode -ne 0).Count -ne 0) { throw 'Evidence ledger failed validation' }
