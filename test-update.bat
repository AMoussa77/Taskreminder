@echo off
echo Testing auto-updater in development mode...
echo.
echo This will enable auto-updater for testing purposes.
echo Note: Auto-updater only works with actual GitHub releases.
echo.
set ENABLE_AUTO_UPDATER=true
npm start

