const { app, BrowserWindow, ipcMain, Notification, dialog, Tray, Menu, shell } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');
const fs = require('fs');
const notifier = require('node-notifier');

let mainWindow;
let tray = null;
let tasks = [];
let alarms = new Map();
let settings = {
    minimizeToTray: false,
    closeToTray: false,
    autoUpdate: true
};
const MAX_TIMEOUT_MS = 0x7fffffff; // Maximum setTimeout delay (~24.8 days)

// Configure auto-updater
// Enable auto-updater in production (packaged) mode or when forced
if (app.isPackaged || process.env.ENABLE_AUTO_UPDATER === 'true') {
  autoUpdater.autoDownload = false; // Manual download control
  autoUpdater.autoInstallOnAppQuit = true;
  
  console.log('🚀 Auto-updater enabled');
  console.log('📦 App is packaged:', app.isPackaged);
  console.log('🔧 Environment:', process.env.ENABLE_AUTO_UPDATER);
  console.log('📋 Current version:', app.getVersion());
  
  // Force enable auto-updater for testing
  if (process.env.ENABLE_AUTO_UPDATER === 'true') {
    console.log('🧪 Testing mode: Forcing auto-updater to work');
    // Set the feed URL to force update checking
    autoUpdater.setFeedURL({
      provider: 'github',
      owner: 'AMoussa77',
      repo: 'Taskreminder'
    });
  }
  
  // Check for updates based on settings (will be called after settings are loaded)
} else {
  console.log('🧪 Development mode: Auto-updater disabled for automatic checks');
  console.log('💡 Manual update checks will work with simulated updates');
  console.log('💡 To enable real auto-updater, run: .\test-update-flow.bat');
  console.log('💡 Or set ENABLE_AUTO_UPDATER=true');
}

// Load tasks from file
function loadTasks() {
  try {
    const data = fs.readFileSync('tasks.json', 'utf8');
    tasks = JSON.parse(data);
    // Restore alarms
    tasks.forEach(task => {
      if (task.alarm && task.alarm.enabled) {
        setAlarm(task.id, task.alarm);
      }
    });
  } catch (err) {
    tasks = [];
  }
}

// Save tasks to file
function saveTasks() {
  fs.writeFileSync('tasks.json', JSON.stringify(tasks, null, 2));
}

// Set alarm for a task
function setAlarm(taskId, alarmConfig) {
  const { enabled } = alarmConfig;

  // Always clear any existing timer for this task before setting a new one
  if (alarms.has(taskId)) {
    clearTimeout(alarms.get(taskId));
    alarms.delete(taskId);
  }

  if (!enabled) {
    // If disabling, also clear timing metadata
    const taskToClear = tasks.find(t => t.id === taskId);
    if (taskToClear) {
      taskToClear.alarmStartTime = undefined;
      taskToClear.alarmDuration = undefined;
    }
    return;
  }

  const task = tasks.find(t => t.id === taskId);
  if (!task) return;

  let targetTs = 0;
  if (alarmConfig.mode === 'datetime' && alarmConfig.timestamp) {
    targetTs = alarmConfig.timestamp;
    task.alarm = { ...task.alarm, enabled: true, mode: 'datetime', timestamp: targetTs };
  } else {
    const hours = alarmConfig.hours || 0;
    const minutes = alarmConfig.minutes || 0;
    const seconds = alarmConfig.seconds || 0;
    const totalMs = (hours * 3600 + minutes * 60 + seconds) * 1000;
    targetTs = Date.now() + totalMs;
    task.alarm = { ...task.alarm, enabled: true, mode: 'duration', hours, minutes, seconds };
  }

  task.alarmStartTime = Date.now();
  task.alarmTargetTimestamp = targetTs;
  task.alarmDuration = Math.max(0, targetTs - task.alarmStartTime);

  scheduleAlarm(taskId);
}

function scheduleAlarm(taskId) {
  const task = tasks.find(t => t.id === taskId);
  if (!task || !task.alarm || !task.alarm.enabled || !task.alarmTargetTimestamp) return;

  if (alarms.has(taskId)) {
    clearTimeout(alarms.get(taskId));
    alarms.delete(taskId);
  }

  const now = Date.now();
  const remaining = task.alarmTargetTimestamp - now;
  if (remaining <= 0) {
    showAlarmNotification(taskId);
    alarms.delete(taskId);
    return;
  }

  const delay = Math.min(remaining, MAX_TIMEOUT_MS);
  const timeoutId = setTimeout(() => {
    scheduleAlarm(taskId);
  }, delay);
  alarms.set(taskId, timeoutId);
}

// Show alarm notification
function showAlarmNotification(taskId) {
  const task = tasks.find(t => t.id === taskId);
  if (task) {
    // Show system notification
    notifier.notify({
      title: 'Task Reminder',
      message: `Time's up for: ${task.title}`,
      sound: true,
      wait: true
    });

    // Show in-app notification
    if (mainWindow) {
      mainWindow.webContents.send('alarm-triggered', {
        taskId: taskId,
        title: task.title
      });
    }
  }
}

// Create system tray
function createTray() {
  const iconPath = path.join(__dirname, 'assets/icon.png');
  tray = new Tray(iconPath);
  
  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Show Task Reminder',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        }
      }
    },
    {
      label: 'Settings',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
          mainWindow.webContents.send('open-settings');
        }
      }
    },
    { type: 'separator' },
    {
      label: 'Exit',
      click: () => {
        // Force exit regardless of close-to-tray setting
        settings.closeToTray = false;
        app.quit();
      }
    }
  ]);
  
  tray.setToolTip('Task Reminder');
  tray.setContextMenu(contextMenu);
  
  // Double click to show window
  tray.on('double-click', () => {
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    }
  });
}

// Create the main window
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    },
    icon: path.join(__dirname, 'assets/icon.ico'),
    titleBarStyle: 'default',
    show: false
  });

  mainWindow.loadFile('index.html');

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.on('minimize', (event) => {
    if (settings.minimizeToTray) {
      event.preventDefault();
      mainWindow.hide();
    }
  });

  mainWindow.on('close', (event) => {
    if (settings.closeToTray) {
      event.preventDefault();
      mainWindow.hide();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// App event handlers
app.whenReady().then(() => {
  loadTasks();
  createWindow();
  createTray();
  
  // Check for updates after a short delay to allow settings to load
  setTimeout(() => {
    checkForUpdatesIfEnabled();
  }, 2000);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Auto-updater event handlers
autoUpdater.on('checking-for-update', () => {
  console.log('🔍 Checking for updates...');
  if (mainWindow) {
    mainWindow.webContents.send('update-checking');
  }
});

autoUpdater.on('update-available', (info) => {
  console.log('✅ Update available!');
  console.log('📋 Version:', info.version);
  console.log('📝 Release notes:', info.releaseNotes);
  console.log('📦 Release date:', info.releaseDate);
  if (mainWindow) {
    mainWindow.webContents.send('update-available', info);
  }
});

autoUpdater.on('update-not-available', (info) => {
  console.log('ℹ️ No updates available');
  console.log('📋 Info:', info);
  if (mainWindow) {
    mainWindow.webContents.send('update-not-available', info);
  }
});

autoUpdater.on('error', (err) => {
  console.error('Error in auto-updater:', err);
  if (mainWindow) {
    mainWindow.webContents.send('update-error', err.message);
  }
});



// Add timeout for update checks
let updateTimeout;
autoUpdater.on('checking-for-update', () => {
  console.log('Checking for update...');
  // Clear any existing timeout
  if (updateTimeout) {
    clearTimeout(updateTimeout);
  }
  // Set a timeout to prevent hanging
  updateTimeout = setTimeout(() => {
    console.log('Update check timeout');
    if (mainWindow) {
      mainWindow.webContents.send('update-check-timeout');
    }
  }, 30000); // 30 seconds timeout
});

// IPC handlers
ipcMain.handle('get-tasks', () => {
  return tasks;
});

ipcMain.handle('add-task', (event, taskData) => {
  const newTask = {
    id: Date.now().toString(),
    title: taskData.title,
    description: taskData.description || '',
    createdAt: new Date().toISOString(),
    completed: false,
    alarm: {
      enabled: false,
      hours: 0,
      minutes: 0,
      seconds: 0
    }
  };
  
  tasks.push(newTask);
  saveTasks();
  return newTask;
});

ipcMain.handle('update-task', (event, taskId, updates) => {
  const taskIndex = tasks.findIndex(t => t.id === taskId);
  if (taskIndex !== -1) {
    tasks[taskIndex] = { ...tasks[taskIndex], ...updates };
    
    // Handle alarm updates
    if (updates.alarm) {
      setAlarm(taskId, updates.alarm);
    }
    
    saveTasks();
    return tasks[taskIndex];
  }
  return null;
});

ipcMain.handle('delete-task', (event, taskId) => {
  const taskIndex = tasks.findIndex(t => t.id === taskId);
  if (taskIndex !== -1) {
    // Clear alarm if exists
    if (alarms.has(taskId)) {
      clearTimeout(alarms.get(taskId));
      alarms.delete(taskId);
    }
    
    tasks.splice(taskIndex, 1);
    saveTasks();
    return true;
  }
  return false;
});

ipcMain.handle('clear-all-tasks', () => {
  try {
    // Clear all timers
    for (const [taskId, timeoutId] of alarms.entries()) {
      clearTimeout(timeoutId);
    }
    alarms.clear();
    // Clear tasks
    tasks = [];
    saveTasks();
    return true;
  } catch (e) {
    return false;
  }
});

ipcMain.handle('toggle-task', (event, taskId) => {
  const task = tasks.find(t => t.id === taskId);
  if (task) {
    task.completed = !task.completed;
    saveTasks();
    return task;
  }
  return null;
});

ipcMain.handle('set-alarm', (event, taskId, alarmConfig) => {
  const task = tasks.find(t => t.id === taskId);
  if (task) {
    task.alarm = { ...task.alarm, ...alarmConfig };
    setAlarm(taskId, task.alarm);
    saveTasks();
    return task;
  }
  return null;
});

ipcMain.handle('get-countdown-info', (event, taskId) => {
  const task = tasks.find(t => t.id === taskId);
  if (task && task.alarm && task.alarm.enabled && task.alarmStartTime != null && task.alarmDuration != null) {
    const now = Date.now();
    const elapsed = now - task.alarmStartTime;
    const remaining = task.alarmDuration - elapsed;
    
    return {
      remaining: remaining,
      isExpired: remaining <= 0,
      totalDuration: task.alarmDuration,
      elapsed: elapsed
    };
  }
  return null;
});

ipcMain.handle('refocus-window', () => {
  try {
    const win = BrowserWindow.getFocusedWindow() || mainWindow;
    if (win) {
      win.show();
      win.focus();
      if (win.webContents) {
        win.webContents.focus();
      }
      return true;
    }
  } catch (err) {
    // ignore
  }
  return false;
});

// Function to check for updates based on settings
function checkForUpdatesIfEnabled() {
  if (settings.autoUpdate && (app.isPackaged || process.env.ENABLE_AUTO_UPDATER === 'true')) {
    console.log('🔍 Checking for updates (auto-update enabled)');
    autoUpdater.checkForUpdatesAndNotify();
  } else {
    console.log('⏸️ Auto-update disabled, skipping update check');
  }
}

// Function to check for updates (always works for manual checks)
function checkForUpdatesManual() {
  if (app.isPackaged || process.env.ENABLE_AUTO_UPDATER === 'true') {
    console.log('🔍 Manual update check triggered');
    return autoUpdater.checkForUpdates();
  } else {
    console.log('🧪 Development mode: Simulating update check');
    return new Promise((resolve) => {
      setTimeout(() => {
        console.log('🔍 Simulated update check completed');
        // Simulate finding an update
        const mockUpdateInfo = {
          version: '0.1.8',
          releaseNotes: 'Test update for development',
          releaseDate: new Date().toISOString()
        };
        
        console.log('✅ Simulated update available:', mockUpdateInfo);
        if (mainWindow) {
          mainWindow.webContents.send('update-available', mockUpdateInfo);
        }
        
        resolve({ updateInfo: mockUpdateInfo });
      }, 2000);
    });
  }
}

// Settings IPC handlers
ipcMain.handle('update-settings', (event, newSettings) => {
  settings = { ...settings, ...newSettings };
  
  // If auto-update setting changed, check for updates if enabled
  if (newSettings.autoUpdate !== undefined) {
    checkForUpdatesIfEnabled();
  }
  
  return settings;
});

ipcMain.handle('get-settings', () => {
  return settings;
});

// Listen for open-settings event from renderer
ipcMain.on('open-settings', () => {
  // This will be handled by the renderer process
});

// Auto-updater IPC handlers
ipcMain.handle('check-for-updates', () => {
  console.log('Manual check for updates triggered');
  return checkForUpdatesManual();
});



ipcMain.handle('open-download-page', () => {
  try {
    console.log('Opening download page in browser...');
    const downloadUrl = 'https://github.com/AMoussa77/Taskreminder/releases/latest';
    shell.openExternal(downloadUrl);
    return { success: true, message: 'Download page opened in browser' };
  } catch (error) {
    console.error('Error opening download page:', error);
    return { success: false, error: error.message };
  }
});

