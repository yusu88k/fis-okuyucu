@echo off
chcp 65001 >nul
echo.
echo === Fişten Excel - Baslat ===
echo.

cd /d "%~dp0"

echo [1] Eski surecleri kapatiyorum (sadece 8002 ve 5600 portlari)...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":8002" ^| findstr "LISTENING"') do taskkill /F /PID %%a >nul 2>&1
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":5600" ^| findstr "LISTENING"') do taskkill /F /PID %%a >nul 2>&1
timeout /t 2 /nobreak >nul

echo [2] Backend aciliyor (8002)...
start "Backend - 8002" cmd /k "cd /d "%~dp0backend" && echo Backend basliyor... && npm run dev"

echo [3] Frontend aciliyor (5600)...
start "Frontend - 5600" cmd /k "cd /d "%~dp0frontend" && echo Frontend basliyor... && set PORT=5600 && npm start"

echo.
echo Backend:  http://localhost:8002
echo Frontend: http://localhost:5600
echo.
echo Pencereler acildi. Kapatmak icin kapat.bat calistir.
echo Bu pencereyi kapatmak icin bir tusa bas...
pause >nul
