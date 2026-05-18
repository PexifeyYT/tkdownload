@echo off
title Video Downloader Web — Setup
echo.
echo  Setting up Video Downloader Web...
echo.

python -m venv venv
if %errorlevel% neq 0 (
    echo  ERROR: Python not found. Install from https://python.org
    pause
    exit /b 1
)

echo  Installing dependencies (this may take a minute)...
venv\Scripts\pip install -r requirements.txt -q

echo.
echo  Setup complete. Run: run.bat
echo.
pause
