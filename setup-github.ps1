Write-Host "Setting up Git and GitHub upload for Task Reminder..." -ForegroundColor Green
Write-Host ""

# Check if Git is installed
try {
    $gitVersion = git --version 2>$null
    if ($LASTEXITCODE -ne 0) {
        throw "Git not found"
    }
    Write-Host "Git found: $gitVersion" -ForegroundColor Green
} catch {
    Write-Host "Git is not found in PATH. Please ensure Git is installed and restart your terminal." -ForegroundColor Red
    Write-Host ""
    Write-Host "You can download Git from: https://git-scm.com/download/win" -ForegroundColor Yellow
    Write-Host "After installation, restart your terminal and run this script again." -ForegroundColor Yellow
    Read-Host "Press Enter to exit"
    exit 1
}

Write-Host "Proceeding with setup..." -ForegroundColor Green
Write-Host ""

# Initialize Git repository
Write-Host "Initializing Git repository..." -ForegroundColor Cyan
git init

# Add all files
Write-Host "Adding files to Git..." -ForegroundColor Cyan
git add .

# Create initial commit
Write-Host "Creating initial commit..." -ForegroundColor Cyan
git commit -m "Initial commit: Task Reminder with auto-update functionality"

# Set main branch
Write-Host "Setting main branch..." -ForegroundColor Cyan
git branch -M main

Write-Host ""
Write-Host "Git repository initialized successfully!" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "1. Go to https://github.com and create a new repository named 'task-reminder'" -ForegroundColor White
Write-Host "2. Copy the repository URL (it will look like: https://github.com/YOUR_USERNAME/task-reminder.git)" -ForegroundColor White
Write-Host "3. Run the following commands (replace YOUR_USERNAME with your GitHub username):" -ForegroundColor White
Write-Host ""
Write-Host "   git remote add origin https://github.com/YOUR_USERNAME/task-reminder.git" -ForegroundColor Cyan
Write-Host "   git push -u origin main" -ForegroundColor Cyan
Write-Host ""
Write-Host "4. Update package.json with your GitHub username in the publish section" -ForegroundColor White
Write-Host "5. Create your first release:" -ForegroundColor White
Write-Host "   git tag v1.0.0" -ForegroundColor Cyan
Write-Host "   git push origin v1.0.0" -ForegroundColor Cyan
Write-Host ""
Read-Host "Press Enter to continue"
