@echo off
echo Setting up Git and GitHub upload for Task Reminder...
echo.

REM Check if Git is installed
git --version >nul 2>&1
if %errorlevel% neq 0 (
    echo Git is not found in PATH. Please ensure Git is installed and restart your terminal.
    echo.
    echo You can download Git from: https://git-scm.com/download/win
    echo After installation, restart your terminal and run this script again.
    pause
    exit /b 1
)

echo Git found! Proceeding with setup...
echo.

REM Initialize Git repository
echo Initializing Git repository...
git init

REM Add all files
echo Adding files to Git...
git add .

REM Create initial commit
echo Creating initial commit...
git commit -m "Initial commit: Task Reminder with auto-update functionality"

REM Set main branch
echo Setting main branch...
git branch -M main

echo.
echo Git repository initialized successfully!
echo.
echo Next steps:
echo 1. Go to https://github.com and create a new repository named 'task-reminder'
echo 2. Copy the repository URL (it will look like: https://github.com/YOUR_USERNAME/task-reminder.git)
echo 3. Run the following commands (replace YOUR_USERNAME with your GitHub username):
echo.
echo    git remote add origin https://github.com/YOUR_USERNAME/task-reminder.git
echo    git push -u origin main
echo.
echo 4. Update package.json with your GitHub username in the publish section
echo 5. Create your first release:
echo    git tag v1.0.0
echo    git push origin v1.0.0
echo.
pause
