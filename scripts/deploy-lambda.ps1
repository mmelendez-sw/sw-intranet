# Bundles server/handler.ts (plus its npm deps) into one handler.js and deploys it to an existing Lambda.
#
# Prerequisites:
#   - AWS CLI configured (`aws configure`)
#   - Lambda already created (Node.js 22, handler = handler.handler)
#   - npm install run at the repo root (esbuild and the server deps come from node_modules)
#
# Usage:
#   npm run deploy:lambda
#   powershell -ExecutionPolicy Bypass -File scripts/deploy-lambda.ps1 -FunctionName sw-intranet-api -Region us-east-2

param(
  [Parameter(Mandatory = $true)]
  [string]$FunctionName,

  [string]$Region = $env:AWS_REGION
)

$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $PSScriptRoot
$stageDir = Join-Path $env:TEMP ("sw-intranet-lambda-" + [guid]::NewGuid().ToString('n'))
New-Item -ItemType Directory -Path $stageDir | Out-Null

Push-Location $repoRoot
try {
  # esbuild strips types without checking them, so type-check first.
  Write-Host "Type-checking server TypeScript..."
  npx tsc --noEmit -p server
  if ($LASTEXITCODE -ne 0) { throw "tsc type-check failed (exit $LASTEXITCODE)" }

  # One minified CommonJS file: no staging npm install, and nothing stale from server/dist ships.
  Write-Host "Bundling server/handler.ts..."
  npx esbuild server/handler.ts --bundle --platform=node --target=node22 --format=cjs --minify --legal-comments=none "--outfile=$stageDir\handler.js"
  if ($LASTEXITCODE -ne 0) { throw "esbuild bundle failed (exit $LASTEXITCODE)" }
} finally {
  Pop-Location
}

if (-not (Test-Path (Join-Path $stageDir 'handler.js'))) {
  throw "Expected $stageDir\handler.js after bundling - esbuild failed?"
}

$zipPath = Join-Path $env:TEMP 'sw-intranet-api.zip'
if (Test-Path $zipPath) { Remove-Item $zipPath -Force }

Write-Host "Zipping $stageDir -> $zipPath"
Add-Type -AssemblyName System.IO.Compression.FileSystem
[IO.Compression.ZipFile]::CreateFromDirectory($stageDir, $zipPath, [IO.Compression.CompressionLevel]::Optimal, $false)
Remove-Item $stageDir -Recurse -Force
Write-Host ("Package size: {0:N1} MB" -f ((Get-Item $zipPath).Length / 1MB))

$awsArgs = @(
  'lambda', 'update-function-code',
  '--function-name', $FunctionName,
  '--zip-file', "fileb://$zipPath"
)
if ($Region) { $awsArgs += @('--region', $Region) }

Write-Host "Updating Lambda '$FunctionName'..."
$awsCmd = Get-Command aws -ErrorAction SilentlyContinue
if (-not $awsCmd) {
  $awsExe = 'C:\Program Files\Amazon\AWSCLIV2\aws.exe'
  if (-not (Test-Path $awsExe)) { throw 'AWS CLI not found on PATH. Open a new terminal or install AWS CLI.' }
  & $awsExe @awsArgs
} else {
  aws @awsArgs
}

if ($LASTEXITCODE -ne 0) { throw "aws lambda update-function-code failed (exit $LASTEXITCODE)" }

Write-Host "Deploy complete." -ForegroundColor Green
Write-Host "Handler: handler.handler"
Write-Host "Remember to set Lambda env vars (SF_*, POWERBI_*, TENANT_ID/CLIENT_ID/CLIENT_SECRET, NEARMAP_API_KEY)."
