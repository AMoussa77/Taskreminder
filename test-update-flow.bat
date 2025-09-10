@echo off
echo ========================================
echo    Task Reminder Update Test
echo ========================================
echo.
echo This will start the app with auto-updater enabled for testing.
echo.
echo IMPORTANT: For testing to work properly, you need:
echo 1. A GitHub release with the new version
echo 2. The latest.yml file in the release
echo 3. The app to be running the previous version
echo.
echo Press any key to start testing...
pause >nul

echo.
echo Starting app with auto-updater enabled...
set ENABLE_AUTO_UPDATER=true
npm start

echo.
echo Test completed!
pause

