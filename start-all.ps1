Write-Host "=================================================================" -ForegroundColor Cyan
Write-Host "               Starting Pi Maia Chess Full Stack" -ForegroundColor Yellow
Write-Host "=================================================================" -ForegroundColor Cyan
Write-Host ""

$rootDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$engineDir = Join-Path $rootDir "engine"
$frontendDir = Join-Path $rootDir "frontend"

Write-Host "[1/2] Starting Maia Chess AI Engine (FastAPI on Port 8000)..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$engineDir'; python -m uvicorn server:app --host 127.0.0.1 --port 8000 --reload"

Write-Host "[2/2] Starting Next.js Web Frontend (Port 3000)..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$frontendDir'; npm run dev"

Write-Host ""
Write-Host "=================================================================" -ForegroundColor Cyan
Write-Host "Both services have launched!" -ForegroundColor Yellow
Write-Host "- Web App:   http://localhost:3000" -ForegroundColor White
Write-Host "- Engine API: http://localhost:8000/docs" -ForegroundColor White
Write-Host "=================================================================" -ForegroundColor Cyan
