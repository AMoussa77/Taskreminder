@echo off
echo ========================================
echo    Task Reminder - Built App Test
echo ========================================
echo.
echo This will help you test the update functionality
echo with the actual built application.
echo.
echo Prerequisites:
echo 1. GitHub release v0.0.8 must exist
echo 2. Install v0.0.7 first (previous version)
echo 3. Then test updating to v0.0.8
echo.
echo Step 1: Install previous version
echo - Run: Task Reminder-0.0.7-win.exe
echo - This should be the "old" version
echo.
echo Step 2: Test update
echo - Click "Check Updates" button
echo - Should detect v0.0.8 available
echo - Click "Download Update"
echo - Watch download progress
echo - Click "Install & Restart"
echo.
echo Press any key to open the dist folder...
pause >nul

echo.
echo Opening dist folder...
start dist

echo.
echo Instructions:
echo 1. Install Task Reminder-0.0.7-win.exe
echo 2. Open the app and test the update flow
echo 3. Check console output for debugging info
echo.
echo Press any key to exit...
pause >nul
