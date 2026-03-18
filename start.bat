@echo off

echo Starting GPRTool-Demo...

REM -----------------------------------------
REM 1. Activate virtual environment
REM -----------------------------------------
if not exist .venv (
    echo ERROR: .venv not found
    pause
    exit /b 1
)

call .venv\Scripts\activate.bat
if errorlevel 1 (
    echo ERROR: Failed to activate .venv
    pause
    exit /b 1
)

echo Virtual environment activated.


REM -----------------------------------------
REM 2. Start backend (FastAPI)
REM -----------------------------------------
cd backend
echo Starting backend on port 8000...
start "Backend" cmd /k "uvicorn app:app --reload --host 0.0.0.0 --port 8000"


REM -----------------------------------------
REM 3. Start frontend
REM -----------------------------------------
cd ..\frontend
echo Starting frontend on port 8080...
start "Frontend" cmd /k "python server.py"


REM -----------------------------------------
REM 4. Open VS Code
REM -----------------------------------------
echo Opening VS Code...
start "" code C:\Users\263350F\_myProjects\GPRTool-Demo


REM -----------------------------------------
REM 5. Open browser
REM -----------------------------------------
echo Opening browser...
start "" http://localhost:8080/index.html

echo All systems go...
``
