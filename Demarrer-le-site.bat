@echo off
title Le Grand Pillage - serveur local
cd /d "%~dp0"
where python >nul 2>nul
if errorlevel 1 (
    echo.
    echo [ERREUR] Python n'est pas installe sur ce PC.
    echo Telechargez-le gratuitement sur https://www.python.org/downloads/
    echo (cochez "Add python.exe to PATH" pendant l'installation).
    echo.
    pause
    exit /b 1
)
start "" http://localhost:8471
echo Le Grand Pillage est en ligne : http://localhost:8471
echo (Laissez cette fenetre ouverte ; fermez-la pour arreter le site.)
python -m http.server 8471
