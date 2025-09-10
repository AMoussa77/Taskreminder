const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🧪 Testing Update Functionality...\n');

// Step 1: Enable auto-updater for testing
console.log('1. Setting up test environment...');
process.env.ENABLE_AUTO_UPDATER = 'true';

// Step 2: Start the app with auto-updater enabled
console.log('2. Starting app with auto-updater enabled...');
console.log('   - Auto-updater will be enabled for testing');
console.log('   - You can test the update flow now');
console.log('   - Press Ctrl+C to stop when done testing\n');

try {
    execSync('npm start', { stdio: 'inherit' });
} catch (error) {
    console.log('\n✅ Test completed');
}

