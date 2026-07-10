@echo off
chcp 65001 >nul
echo ==============================
echo Fişten Excel - Durum Kontrolu
echo ===============================
echo.

cd /d "%~dp0"

echo [1] Backend (8002) kontrol ediliyor...
curl -s http://localhost:8002/api/health > backend_health.json 2>nul
if %errorlevel% == 0 (
    type backend_health.json
    echo.
) else (
    echo HATA: Backend 8002 portunda calismiyor!
)
echo.

echo [2] Frontend (5600) kontrol ediliyor...
curl -s -o nul -w "HTTP Durum: %%{http_code}\n" http://localhost:5600 > frontend_status.txt 2>nul
if %errorlevel% == 0 (
    type frontend_status.txt
) else (
    echo HATA: Frontend 5600 portunda calismiyor!
)
echo.

echo [3] Backend .env icerigi (sadece anahtar formati kontrolu):
if exist "backend\.env" (
    findstr /B "GEMINI_API_KEY=" backend\.env
) else (
    echo HATA: backend\.env dosyasi bulunamadi!
)
echo.

echo [4] Node surecleri:
tasklist /FI "IMAGENAME eq node.exe" 2>nul | findstr node.exe
if %errorlevel% neq 0 echo Node sureci calismiyor.
echo.

echo [5] Portlari dinleyen surecler:
netstat -ano | findstr ":8002"
netstat -ano | findstr ":5600"
echo.

echo ===============================
echo Kontrol tamamlandi.
echo.
echo Sorun goruyorsan:
echo - kapat.bat ile tum surecleri kapat, sonra baslat.bat'i calistir.
echo - Google AI Studio'dan yeni API anahtari alip backend\.env'e yapistir.
pause
