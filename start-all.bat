@echo off
echo =================================================================
echo               Starting Pi Maia Chess Full Stack
echo =================================================================
echo.

echo [1/2] Starting Maia Chess AI Engine (FastAPI on Port 8000)...
start "Maia Chess Engine API" cmd /k "cd engine && python -m uvicorn server:app --host 127.0.0.1 --port 8000 --reload"

echo [2/2] Starting Next.js Web Frontend (Port 3000)...
start "Pi Maia Chess Frontend" cmd /k "cd frontend && npm run dev"

echo.
echo =================================================================
echo Both services are launching in separate windows!
echo - Web App: http://localhost:3000
echo - Engine API: http://localhost:8000/docs
echo =================================================================
pause
