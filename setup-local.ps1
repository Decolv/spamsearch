param(
	[switch]$NoPause
)

$ErrorActionPreference = "Stop"

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "   Caller - One Click Local Setup" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

function Test-CommandExists {
	param([string]$Name)
	return [bool](Get-Command $Name -ErrorAction SilentlyContinue)
}

if (-not (Test-CommandExists "node")) {
	Write-Host "Node.js not found. Please install Node.js 18+ and retry." -ForegroundColor Red
	exit 1
}

if (-not (Test-CommandExists "npm")) {
	Write-Host "npm not found. Please make sure Node.js is installed correctly." -ForegroundColor Red
	exit 1
}

$nodeVersion = node -v
$npmVersion = npm -v

Write-Host "Detected Node.js: $nodeVersion" -ForegroundColor Green
Write-Host "Detected npm: $npmVersion" -ForegroundColor Green
Write-Host ""

Write-Host "[1/2] Installing project dependencies via npm install" -ForegroundColor Yellow
npm install

Write-Host "" 
Write-Host "[2/2] Installing Playwright Chromium" -ForegroundColor Yellow
npx playwright install chromium

Write-Host ""
Write-Host "Local setup completed. You can now run npm start." -ForegroundColor Green

if (-not $NoPause) {
	Write-Host ""
	Write-Host "Press any key to exit..." -ForegroundColor Gray
	$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
}
