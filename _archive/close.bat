@echo off
echo Closing GPRTool-Demo...

REM --------------------------------------------
REM 1. Close backend terminal (search by title)
REM --------------------------------------------
taskkill /FI "WINDOWTITLE eq Backend*" /T /F >nul 2>&1

REM --------------------------------------------
REM 2. Close frontend terminal (search by title)
REM --------------------------------------------
taskkill /FI "WINDOWTITLE eq Frontend*" /T /F >nul 2>&1

REM --------------------------------------------
REM 3. Close VS Code
REM --------------------------------------------
REM taskkill /IM code.exe /T /F >nul 2>&1

echo All windows closed.
exit /b 0
