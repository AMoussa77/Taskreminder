# GitHub Setup Guide for Task Reminder

This guide will help you upload your Task Reminder project to GitHub and set up automatic updates.

## Prerequisites

- Git installed on your system
- GitHub account
- Terminal/Command Prompt access

## Step 1: Verify Git Installation

Open a new terminal/command prompt and run:
```bash
git --version
```

If Git is not recognized, you may need to:
1. Restart your terminal after installing Git
2. Or add Git to your system PATH manually

## Step 2: Run the Setup Script

### Option A: Run the Batch File
Double-click `setup-github.bat` or run it from command prompt:
```cmd
setup-github.bat
```

### Option B: Run the PowerShell Script
Right-click on `setup-github.ps1` and select "Run with PowerShell", or run:
```powershell
.\setup-github.ps1
```

## Step 3: Create GitHub Repository

1. Go to [GitHub.com](https://github.com) and sign in
2. Click the "+" icon in the top right corner
3. Select "New repository"
4. Name it `task-reminder`
5. Make it **Public** (required for auto-updates to work)
6. **DO NOT** initialize with README, .gitignore, or license (we already have these)
7. Click "Create repository"

## Step 4: Connect Local Repository to GitHub

After creating the repository, GitHub will show you commands. Run these in your terminal:

```bash
git remote add origin https://github.com/YOUR_USERNAME/task-reminder.git
git push -u origin main
```

Replace `YOUR_USERNAME` with your actual GitHub username.

## Step 5: Update Package.json

Open `package.json` and replace `YOUR_GITHUB_USERNAME` with your actual GitHub username in the publish section:

```json
"publish": {
  "provider": "github",
  "owner": "YOUR_ACTUAL_USERNAME",
  "repo": "task-reminder"
}
```

## Step 6: Create Your First Release

1. Update the version in `package.json` (e.g., change "1.0.0" to "1.0.1")
2. Commit and push the changes:
   ```bash
   git add package.json
   git commit -m "Update version to 1.0.1"
   git push
   ```
3. Create and push a tag:
   ```bash
   git tag v1.0.1
   git push origin v1.0.1
   ```

## Step 7: Verify Auto-Update Setup

1. GitHub Actions will automatically build your app when you push a tag
2. Go to your repository's "Actions" tab to see the build progress
3. Once complete, go to "Releases" to see your published release
4. Users can now download and install your app, and it will auto-update!

## How Auto-Updates Work

- **Automatic**: App checks for updates when launched
- **Manual**: Users can click "Check Updates" button
- **GitHub Releases**: Updates are distributed through GitHub Releases
- **Cross-platform**: Builds for Windows, macOS, and Linux automatically

## Troubleshooting

### Git Not Found
- Restart your terminal after installing Git
- Check if Git is in your PATH: `echo $PATH` (Linux/Mac) or `echo %PATH%` (Windows)
- Try running Git with full path: `"C:\Program Files\Git\bin\git.exe" --version`

### Push Rejected
- Make sure you've created the repository on GitHub first
- Check that the repository URL is correct
- Ensure you have write permissions to the repository

### Auto-Updates Not Working
- Verify the repository is public
- Check that the `publish` section in `package.json` has the correct GitHub username
- Ensure GitHub Actions completed successfully

## Next Steps

Once everything is set up:

1. **Test the app**: Download the release and test auto-updates
2. **Make changes**: Update your code and create new releases
3. **Monitor usage**: Check GitHub Insights for download statistics
4. **User feedback**: Users can report issues through GitHub Issues

## Support

If you encounter any issues:
1. Check the GitHub Actions logs
2. Verify all configuration files are correct
3. Ensure your GitHub repository is public
4. Test with a simple version bump first

Happy coding! 🚀
