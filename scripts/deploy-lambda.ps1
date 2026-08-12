# Zips SharePoint TV cards API and updates an existing Lambda function.
#
# Usage:
#   npm run deploy:lambda -- -FunctionName sw-intranet-api -Region us-east-2

param(
  [Parameter(Mandatory = $true)]
  [string]$FunctionName,

  [string]$Region = $env:AWS_REGION
)

$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
$serverDir = Join-Path $repoRoot 'server'
$files = @(
  (Join-Path $serverDir 'handler.js'),
  (Join-Path $serverDir 'sharepoint.js')
)
foreach ($f in $files) {
  if (-not (Test-Path $f)) { throw "Required file not found: $f" }
}

$zipPath = Join-Path $env:TEMP 'sw-intranet-api.zip'
if (Test-Path $zipPath) { Remove-Item $zipPath -Force }

Write-Host "Zipping handler.js + sharepoint.js -> $zipPath"
Compress-Archive -Path $files -DestinationPath $zipPath -Force

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
  if (-not (Test-Path $awsExe)) { throw 'AWS CLI not found. Run aws configure in a new terminal.' }
  & $awsExe @awsArgs
} else {
  aws @awsArgs
}
if ($LASTEXITCODE -ne 0) { throw "aws lambda update-function-code failed (exit $LASTEXITCODE)" }
Write-Host "Deploy complete. Handler: handler.handler" -ForegroundColor Green
Write-Host "Set Lambda env vars from docs/MICROSOFT_SETUP.md (MICROSOFT_*, TV_API_PUBLIC_BASE)."
