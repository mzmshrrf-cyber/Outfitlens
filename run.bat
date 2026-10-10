@echo off
title OutfitLens - Local Launcher
echo Starting OutfitLens...
start "OutfitLens Backend" cmd /c "cd backend && set PORT=8000 && .\venv\Scripts\activate.bat && python -m uvicorn app.main:app --host 127.0.0.1 --port 8000"
start "OutfitLens Frontend" cmd /c "cd frontend && npm run dev"
timeout /t 6 >nul
start http://localhost:3000
