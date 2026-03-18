@echo off
REM publish.bat - Push changes to GitHub

echo ========================================
echo Publishing changes to GitHub...
echo ========================================

REM Add all changes
echo.
echo Adding all changes...
git add .

REM Check if there are changes to commit
git diff-index --quiet HEAD
if %errorlevel% equ 0 (
    echo No changes to commit.
    pause
    exit /b 0
)

REM Prompt for commit message
echo.
set /p commit_msg="Enter commit message: "

if "%commit_msg%"=="" (
    echo Commit message cannot be empty!
    pause
    exit /b 1
)

REM Commit changes
echo.
echo Committing changes...
git commit -m "%commit_msg%"

REM Pull latest changes from GitHub first
echo.
echo Pulling latest changes from GitHub...
git pull origin main --rebase

if %errorlevel% neq 0 (
    echo.
    echo ERROR: Failed to pull changes. There might be conflicts.
    echo Please resolve conflicts manually and try again.
    pause
    exit /b 1
)

REM Push to GitHub
echo.
echo Pushing to GitHub...
git push origin main

echo.
echo ========================================
echo Successfully published to GitHub!
echo ========================================
echo.

pause