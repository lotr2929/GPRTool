@echo off
REM deploy.bat - Commit to GitHub and deploy to Vercel
REM Usage: deploy.bat
REM Prompts for a commit message, pushes to GitHub, then deploys to Vercel.

echo ========================================
echo  GPRTool Deploy
echo ========================================

REM -----------------------------------------
REM 1. Stage all changes
REM -----------------------------------------
echo.
echo Staging all changes...
git add -A

REM Check if there is anything to commit
git diff-index --quiet HEAD
if %errorlevel% equ 0 (
    echo.
    echo No changes to commit. Deploying current HEAD to Vercel anyway...
    goto :deploy
)

REM -----------------------------------------
REM 2. Prompt for commit message
REM -----------------------------------------
echo.
set /p commit_msg="Commit message: "

if "%commit_msg%"=="" (
    echo ERROR: Commit message cannot be empty.
    pause
    exit /b 1
)

REM -----------------------------------------
REM 3. Commit
REM -----------------------------------------
echo.
echo Committing...
git commit -m "%commit_msg%"

if %errorlevel% neq 0 (
    echo ERROR: git commit failed.
    pause
    exit /b 1
)

REM -----------------------------------------
REM 4. Pull then push to GitHub
REM -----------------------------------------
echo.
echo Pulling latest from GitHub...
git pull origin main --rebase

if %errorlevel% neq 0 (
    echo ERROR: git pull failed. Resolve conflicts and try again.
    pause
    exit /b 1
)

echo.
echo Pushing to GitHub...
git push origin main

if %errorlevel% neq 0 (
    echo ERROR: git push failed.
    pause
    exit /b 1
)

echo.
echo GitHub: OK

REM -----------------------------------------
REM 5. Deploy to Vercel
REM -----------------------------------------
:deploy
echo.
echo Deploying to Vercel...

REM Check if Vercel CLI is available
where vercel >nul 2>&1
if %errorlevel% neq 0 (
    echo.
    echo NOTE: Vercel CLI not found.
    echo Vercel will auto-deploy via GitHub integration.
    echo Live URL: https://gprtool-demo.vercel.app
    echo.
    goto :done
)

vercel --prod

if %errorlevel% neq 0 (
    echo ERROR: Vercel deploy failed.
    pause
    exit /b 1
)

REM -----------------------------------------
REM 6. Done
REM -----------------------------------------
:done
echo.
echo ========================================
echo  Deploy complete!
echo  https://gprtool-demo.vercel.app
echo ========================================
echo.
pause
