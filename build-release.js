const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 Building Task Reminder for release...\n');

try {
    // Clean previous builds
    console.log('🧹 Cleaning previous builds...');
    if (fs.existsSync('dist')) {
        fs.rmSync('dist', { recursive: true, force: true });
    }

    // Build the application
    console.log('📦 Building application...');
    execSync('npm run build', { stdio: 'inherit' });

    console.log('\n✅ Build completed successfully!');
    console.log('📁 Build files are in the "dist" directory');
    console.log('\n📋 Next steps:');
    console.log('1. Create a GitHub release with the built files');
    console.log('2. Upload the installer files from the dist folder');
    console.log('3. The auto-updater will work once the release is published');
    
} catch (error) {
    console.error('❌ Build failed:', error.message);
    process.exit(1);
}

