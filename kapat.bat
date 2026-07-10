@echo off
chcp 65001 >nul
echo Uygulama surecleri kapatiliyor (8002 ve 5600 portlari)...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":8002" ^| findstr "LISTENING"') do taskkill /F /PID %%a >nul 2>&1
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":5600" ^| findstr "LISTENING"') do taskkill /F /PID %%a >nul 2>&1
echo Tamamlandi.
pause
