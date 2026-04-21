@echo off
echo ==========================================
echo   Ionix Partner - Pornire Tunel Telegram
echo ==========================================
echo.
echo Pornesc ngrok...
start "ngrok" "%USERPROFILE%\ngrok.exe" http 4000
echo.
echo Tunelul este activ la:
echo https://unmoral-endnote-smirk.ngrok-free.dev
echo.
echo Webhook-ul Telegram e deja inregistrat la acest URL.
echo Nu trebuie sa faci nimic altceva.
echo.
echo Inchide aceasta fereastra cand nu mai ai nevoie de tunel.
pause
