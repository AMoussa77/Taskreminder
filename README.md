# Task Reminder - Electron App

A modern task management application built with Electron.js that allows you to create unlimited tasks with custom alarm functionality. Features automatic updates and cross-platform support.

[![GitHub release](https://img.shields.io/github/release/YOUR_GITHUB_USERNAME/task-reminder.svg)](https://github.com/YOUR_GITHUB_USERNAME/task-reminder/releases)
[![GitHub downloads](https://img.shields.io/github/downloads/YOUR_GITHUB_USERNAME/task-reminder/total.svg)](https://github.com/YOUR_GITHUB_USERNAME/task-reminder/releases)

## Features

- ✅ **Unlimited Tasks**: Create as many tasks as you need
- ⏰ **Custom Alarms**: Set alarms with hours, minutes, and seconds precision
- ⏱️ **Live Countdown**: Real-time countdown display for tasks with alarms
- ⚠️ **Overdue Tracking**: Shows negative time when alarm time has passed
- 🎨 **Visual Indicators**: Tasks turn gray when alarm time has expired
- 🔔 **Notifications**: System notifications when alarms trigger
- 💾 **Data Persistence**: Tasks are automatically saved to local storage
- 🎨 **Modern UI**: Beautiful, responsive interface
- 📱 **Cross-Platform**: Works on Windows, macOS, and Linux
- 🔄 **Auto-Updates**: Automatic updates with progress tracking
- 🌙 **Dark Mode**: Toggle between light and dark themes

## Installation

### Option 1: Download Latest Release (Recommended)
1. Go to the [Releases page](https://github.com/YOUR_GITHUB_USERNAME/task-reminder/releases)
2. Download the installer for your operating system
3. Run the installer and follow the setup wizard
4. The app will automatically check for updates when you launch it

### Option 2: Build from Source
1. **Clone the repository**:
   ```bash
   git clone https://github.com/YOUR_GITHUB_USERNAME/task-reminder.git
   cd task-reminder
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Run the application**:
   ```bash
   npm start
   ```

4. **Build for distribution**:
   ```bash
   npm run build
   ```

## Usage

### Creating Tasks
1. Enter a task title (required)
2. Optionally add a description
3. Toggle "Set Alarm" if you want to set a reminder
4. If alarm is enabled, set the hours, minutes, and seconds
5. Click "Add Task"

### Managing Tasks
- **Complete/Undo**: Click the Complete/Undo button to mark tasks as done
- **Delete**: Click the Delete button to remove tasks permanently
- **Set/Edit Alarm**: Click the "Set Alarm" or "Edit Alarm" button to configure reminders

### Alarm System
- Alarms can be set for any duration from 1 second to 23 hours, 59 minutes, 59 seconds
- **Live Countdown**: Tasks with alarms show a real-time countdown display
- **Overdue Tracking**: When alarm time passes, the countdown shows negative time (e.g., "-00:05:30")
- **Visual Feedback**: Tasks turn gray when their alarm time has expired
- When an alarm triggers, you'll see both a system notification and an in-app modal
- Alarms are automatically cleared when tasks are deleted

### Auto-Updates
- The app automatically checks for updates when launched
- You can manually check for updates using the "Check Updates" button in the header
- When an update is available, you'll be notified with an option to download
- Download progress is shown with a progress bar
- Updates are installed automatically when the app restarts

## Project Structure

```
task-reminder/
├── main.js          # Main Electron process
├── index.html       # Main UI
├── styles.css       # Styling
├── renderer.js      # Frontend JavaScript
├── package.json     # Dependencies and scripts
└── tasks.json       # Task data (auto-generated)
```

## Building for Distribution

To build the app for distribution:

```bash
npm run build
```

This will create distributable packages in the `dist` folder.

## Dependencies

- **electron**: Main framework
- **node-notifier**: System notifications
- **electron-builder**: App packaging
- **electron-updater**: Automatic updates

## Development & Deployment

### Setting up GitHub Repository

1. **Create a new repository** on GitHub named `task-reminder`
2. **Update package.json** with your GitHub username:
   ```json
   "publish": {
     "provider": "github",
     "owner": "YOUR_GITHUB_USERNAME",
     "repo": "task-reminder"
   }
   ```
3. **Initialize Git** (if not already done):
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/YOUR_GITHUB_USERNAME/task-reminder.git
   git push -u origin main
   ```

### Creating Releases

1. **Update version** in `package.json`
2. **Create and push a tag**:
   ```bash
   git tag v1.0.1
   git push origin v1.0.1
   ```
3. **GitHub Actions** will automatically build and create a release
4. **Users will receive update notifications** when they launch the app

### Manual Release (Alternative)

```bash
# Build and publish
npm run publish
```

## License

MIT License - feel free to use and modify as needed.

## Troubleshooting

If you encounter any issues:

1. Make sure Node.js is installed on your system
2. Run `npm install` to ensure all dependencies are installed
3. Check that you're running the app with `npm start`
4. For build issues, ensure electron-builder is properly installed

## Contributing

Feel free to submit issues and enhancement requests!
