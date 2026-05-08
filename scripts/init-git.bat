@echo off
REM ============================================================
REM   Initialize a clean local git repo for this project.
REM   Run this ONCE from the project root in a normal Windows
REM   terminal (cmd or PowerShell).
REM
REM   Usage:   scripts\init-git.bat
REM ============================================================

setlocal

REM Wipe any half-initialized .git folder created in the sandbox.
if exist ".git" (
    echo Removing existing .git folder...
    rmdir /S /Q ".git"
)

echo Initializing fresh git repository on branch "main"...
git init -b main
if errorlevel 1 goto :err

REM Optional: set repo-local identity. Comment out if global config is fine.
REM git config user.name  "Your Name"
REM git config user.email "you@example.com"

echo Staging files...
git add .
if errorlevel 1 goto :err

echo Creating initial commit...
git commit -m "Initial commit: AI Job Application Optimizer (React + TS + Vitest)"
if errorlevel 1 goto :err

echo.
echo ============================================================
echo   Local repo ready. To push as a PRIVATE GitHub repo:
echo.
echo     gh repo create ai-job-application --private --source=. --remote=origin --push
echo.
echo   Or, create an empty private repo on github.com first, then:
echo.
echo     git remote add origin git@github.com:YOUR_USERNAME/ai-job-application.git
echo     git push -u origin main
echo ============================================================
goto :eof

:err
echo.
echo *** Git initialization failed. See messages above. ***
exit /b 1
