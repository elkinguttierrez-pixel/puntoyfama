@echo off
title Punto y Fama - Servidor y Juego
chcp 65001 >nul
cls
echo ======================================================
echo   🎯 INICIANDO PUNTO Y FAMA — MULTIJUGADOR EN VIVO
echo ======================================================
echo.
where node >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Node.js no esta instalado o no esta en el PATH.
    echo Por favor descarga e instala Node.js desde https://nodejs.org
    echo.
    echo Nota: Tambien puedes jugar directamente abriendo 'index.html'
    echo en tu navegador para el modo Solitario o Duelo local.
    pause
    exit /b 1
)

echo [1/2] Abriendo el juego en tu navegador web...
start http://localhost:3000

echo [2/2] Servidor activo. Para jugar con celulares, conectalos
echo       a la misma red Wi-Fi y escanea el QR en la pantalla de Sala TV.
echo.
echo Presiona Ctrl + C para detener el servidor cuando termines.
echo ======================================================
echo.
node server.js
pause
