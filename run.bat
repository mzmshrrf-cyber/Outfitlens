@echo off
title Teachable Machine Clone - Local Launcher
color 0B
echo ========================================================
echo        TEACHABLE MACHINE CLONE LOCAL LAUNCHER
echo ========================================================
echo.
echo [1/3] Starting Backend ML Engine on http://localhost:8001...
start "Teachable Machine Backend" cmd /c "cd backend && set PORT=8001 && .\venv\Scripts\activate.bat && python app/main.py"

echo [2/3] Starting Frontend Dashboard on http://localhost:3000...
start "Teachable Machine Frontend" cmd /c "cd frontend && npm run dev"

echo.
echo [3/3] Waiting for servers to initialize...
echo (PyTorch and MobileNetV3 small weights are preloading)
timeout /t 8 >nul

echo Opening application in default browser...
start http://localhost:3000

echo.
echo --------------------------------------------------------
echo Both servers have been launched in separate windows.
echo - Frontend: http://localhost:3000
echo - Backend:  http://localhost:8001
echo.
echo Keep the backend and frontend command windows open while using.
echo You can close this launcher window now!
echo ========================================================
timeout /t 5 >nul
exit
