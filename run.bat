@echo off
title Video Downloader Web
cd /d "%~dp0"

if not exist venv (
    echo  First run: setting up...
    call setup.bat
)

echo  Starting server at http://localhost:8000
echo  Press Ctrl+C to stop.
echo.

start "" http://localhost:8000
venv\Scripts\uvicorn main:app --host 127.0.0.1 --port 8000
