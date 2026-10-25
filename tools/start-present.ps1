$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$envFile = Join-Path $root '.transaction/final-mysql.env'
if (!(Test-Path -LiteralPath $envFile)) { throw 'Run pwsh -File tools/final-mysql-verification.ps1 once to prepare the isolated MySQL fixture.' }
foreach ($line in Get-Content -LiteralPath $envFile) {
    if ($line -match '^([A-Z_]+)=(.*)$') { [Environment]::SetEnvironmentVariable($matches[1], $matches[2], 'Process') }
}
$installed = Get-Command node -ErrorAction SilentlyContinue
$node = if ($installed) { $installed.Source } else { Join-Path $env:USERPROFILE '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe' }
if (!(Test-Path -LiteralPath $node)) { throw 'Install Node.js and run npm ci first.' }
Push-Location -LiteralPath $root
try { & $node tools/demo.js; if ($LASTEXITCODE -ne 0) { throw "Demo exited with code $LASTEXITCODE" } }
finally { Pop-Location }
