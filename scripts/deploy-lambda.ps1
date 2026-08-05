# Compiles server/*.ts and deploys server/dist to an existing Lambda function.
#
# Prerequisites:
#   - AWS CLI configured (`aws configure`)
#   - Lambda already created (Node.js 20+, handler = handler.handler)
#
# Usage:
#   npm run deploy:lambda
#   powershell -ExecutionPolicy Bypass -File scripts/deploy-lambda.ps1 -FunctionName sw-intranet-api -Region us-east-1

param(
  [Parameter(Mandatory = $true)]
  [string]$FunctionName,

  [string]$Region = $env:AWS_REGION
)

$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $PSScriptRoot
$serverDir = Join-Path $repoRoot 'server'
$distDir = Join-Path $serverDir 'dist'

Write-Host "Compiling server TypeScript..."
Push-Location $repoRoot
try {
  npm run build:tv-api
  if ($LASTEXITCODE -ne 0) { throw "npm run build:tv-api failed (exit $LASTEXITCODE)" }
} finally {
  Pop-Location
}

if (-not (Test-Path (Join-Path $distDir 'handler.js'))) {
  throw "Expected $distDir\handler.js after build — compile failed?"
}

$zipPath = Join-Path $env:TEMP 'sw-intranet-api.zip'
if (Test-Path $zipPath) { Remove-Item $zipPath -Force }

Write-Host "Zipping $distDir -> $zipPath"
# Zip contents at archive root so Lambda resolves handler.handler
Compress-Archive -Path (Join-Path $distDir '*') -DestinationPath $zipPath -Force

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
Write-Host "Remember to set Lambda env vars (SF_*, POWERBI_*, TENANT_ID/CLIENT_ID/CLIENT_SECRET)."
