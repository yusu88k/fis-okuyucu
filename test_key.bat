@echo off
chcp 65001 >nul
cd /d "%~dp0backend"
npm run test:key
pause
