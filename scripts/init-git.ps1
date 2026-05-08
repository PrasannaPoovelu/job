# ============================================================
#   Initialize a clean local git repo for this project.
#   Run this ONCE from the project root:
#
#     powershell -ExecutionPolicy Bypass -File scripts\init-git.ps1
# ============================================================

$ErrorActionPreference = 'Stop'

if (Test-Path .git) {
    Write-Host "Removing existing .git folder..." -ForegroundColor Yellow
    Remove-Item -Recurse -Force .git
}

Write-Host "Initializing fresh git repository on branch 'main'..." -ForegroundColor Cyan
git init -b main

# Optional: repo-local identity. Uncomment and edit if needed.
# git config user.name  "Your Name"
# git config user.email "you@example.com"

Write-Host "Staging files..." -ForegroundColor Cyan
git add .

Write-Host "Creating initial commit..." -ForegroundColor Cyan
git commit -m "Initial commit: AI Job Application Optimizer (React + TS + Vitest)"

Write-Host ""
Write-Host "============================================================" -ForegroundColor Green
Write-Host "  Local repo ready. To push as a PRIVATE GitHub repo:" -ForegroundColor Green
Write-Host ""
Write-Host "    gh repo create ai-job-application --private --source=. --remote=origin --push"
Write-Host ""
Write-Host "  Or, create an empty private repo on github.com first, then:"
Write-Host ""
Write-Host "    git remote add origin git@github.com:YOUR_USERNAME/ai-job-application.git"
Write-Host "    git push -u origin main"
Write-Host "============================================================" -ForegroundColor Green
