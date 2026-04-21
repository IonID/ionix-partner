@echo off
title Ionix Partner — Dev Servers
echo ==========================================
echo   Ionix Partner - Pornire Servere Dev
echo ==========================================
echo.

:: Opreste orice server vechi pe porturile 3000 si 4000
echo Opresc serverele vechi...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3000 "') do (
    taskkill /PID %%a /F >nul 2>&1
)
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":4000 "') do (
    taskkill /PID %%a /F >nul 2>&1
)
timeout /t 2 /nobreak >nul

:: Porneste API (NestJS) intr-un terminal nou
echo Pornesc API pe portul 4000...
start "Ionix API :4000" cmd /k "cd /d D:\Partener\ionix-partner\apps\api && npm run start:dev"

:: Asteapta 3 secunde apoi porneste Web
timeout /t 3 /nobreak >nul

:: Porneste Web (Next.js) intr-un terminal nou
echo Pornesc Web pe portul 3000...
start "Ionix Web :3000" cmd /k "cd /d D:\Partener\ionix-partner\apps\web && npm run dev"

:: Porneste ngrok tunel pentru Telegram webhook
echo Pornesc ngrok (tunel Telegram)...
start "Ionix ngrok :4000" cmd /k "%USERPROFILE%\ngrok.exe http 4000"

echo.
echo ==========================================
echo  API   -> http://localhost:4000
echo  Web   -> http://localhost:3000
echo  ngrok -> https://unmoral-endnote-smirk.ngrok-free.dev
echo ==========================================
echo.
echo Toate serviciile pornite. Poti inchide aceasta fereastra.
pause
