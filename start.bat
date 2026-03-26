@echo off
REM GPRTool-Demo — start.bat
REM Starts the local frontend server and opens the browser.
REM No backend required (browser-only app on Vercel).

echo Starting GPRTool-Demo...

REM Start frontend dev server
start "GPRTool Frontend" cmd /k "cd /d %~dp0frontend && python server.py"

REM Brief pause for server to start
timeout /t 2 /nobreak >nul

REM Open in default browser
start "" http://localhost:8000

echo GPRTool running at http://localhost:8000
echo Close the terminal window to stop the server.
