# Task Reminder - Update Testing Guide

## 🧪 How to Test Updates

### Prerequisites
1. **GitHub Repository**: You need a GitHub repository with releases
2. **Two Versions**: At least 2 different versions to test the update flow
3. **GitHub Release**: The newer version must be published as a GitHub release

### Step 1: Create GitHub Release
1. Go to your GitHub repository: https://github.com/AMoussa77/Taskreminder
2. Click "Releases" → "Create a new release"
3. Tag: `v0.0.8`
4. Title: `Task Reminder v0.0.8`
5. Upload these files from the `dist` folder:
   - `Task Reminder-0.0.8-win.exe`
   - `Task Reminder-0.0.8-win-x64.exe`
   - `Task Reminder-0.0.8-win-ia32.exe`
   - `latest.yml`

### Step 2: Test Update Flow

#### Option A: Test with Built App (Recommended)
1. **Install v0.0.7**: Run `Task Reminder-0.0.7-win.exe` from dist folder
2. **Check for Updates**: Click "Check Updates" button
3. **Download Update**: Click "Download Update" when prompted
4. **Verify Progress**: Watch the download progress bar
5. **Install Update**: Click "Install & Restart" when download completes

#### Option B: Test in Development Mode
1. **Run Test Script**: Double-click `test-update-flow.bat`
2. **Or Manual**: Run `set ENABLE_AUTO_UPDATER=true && npm start`
3. **Check Console**: Look for update-related messages
4. **Test Update**: Click "Check Updates" button

### Step 3: What to Look For

#### ✅ Success Indicators
- Console shows: "🚀 Auto-updater enabled"
- Console shows: "🔍 Checking for updates..."
- Console shows: "✅ Update available!"
- Update modal appears with correct version
- Download progress bar shows progress
- Download completes successfully

#### ❌ Error Indicators
- Console shows: "❌ Auto-updater disabled in development mode"
- Console shows: "ℹ️ No updates available"
- Download gets stuck at 0%
- Timeout modal appears

### Step 4: Troubleshooting

#### If Update Not Detected
- Check if GitHub release exists
- Verify `latest.yml` file is uploaded
- Check console for error messages
- Ensure version numbers are different

#### If Download Stuck
- Check internet connection
- Verify GitHub servers are accessible
- Look for firewall blocking
- Check console for specific errors

#### If Development Mode Issues
- Use `test-update-flow.bat` script
- Or set `ENABLE_AUTO_UPDATER=true`
- Check console for auto-updater status

### Step 5: Console Messages to Watch

```
🚀 Auto-updater enabled
📦 App is packaged: true/false
🔧 Environment: true
📋 Current version: 0.0.7
🔍 Checking for updates...
✅ Update available!
📋 Version: 0.0.8
📝 Release notes: ...
📦 Release date: ...
```

## 🐛 Common Issues

1. **"Auto-updater disabled"**: Run with test script or set environment variable
2. **"No updates available"**: Check GitHub release and version numbers
3. **Download stuck at 0%**: Check internet connection and GitHub access
4. **Timeout errors**: Increase timeout or check network connectivity

## 📝 Testing Checklist

- [ ] GitHub release created with correct files
- [ ] Auto-updater enabled (console shows "🚀 Auto-updater enabled")
- [ ] Update detection works (console shows "✅ Update available!")
- [ ] Download starts (progress bar shows progress)
- [ ] Download completes successfully
- [ ] Install prompt appears
- [ ] App restarts with new version

