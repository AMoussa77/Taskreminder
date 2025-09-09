#!/bin/bash

echo "Installing Task Reminder..."
echo

echo "Installing dependencies..."
npm install

if [ $? -ne 0 ]; then
    echo "Error installing dependencies. Please make sure Node.js is installed."
    exit 1
fi

echo
echo "Installation complete!"
echo
echo "To run the app, use: npm start"
echo




