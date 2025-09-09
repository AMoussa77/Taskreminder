@echo off
echo Installing Task Reminder...
echo.

echo Installing dependencies...
npm install

if %errorlevel% neq 0 (
    echo Error installing dependencies. Please make sure Node.js is installed.
    pause
    exit /b 1
)

echo.
echo Installation complete!
echo.
echo To run the app, use: npm start
echo.
pause




