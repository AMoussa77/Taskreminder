const { app, BrowserWindow, ipcMain, Notification, dialog, Tray, Menu, shell } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');
const fs = require('fs');
const notifier = require('node-notifier');
const { spawn } = require('child_process');

let mainWindow;
let tray = null;
let tasks = [];
let alarms = new Map();
let settings = {
    minimizeToTray: false,
    closeToTray: false,
    autoUpdate: true,
    viewMode: 'normal',
    soundEnabled: true,
    soundVolume: 0.7,
    soundType: 'default', // 'default', 'sinking-island', 'custom'
    customSoundFile: null
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
        // For existing tasks, check if they're already expired before scheduling
        if (task.alarmTargetTimestamp) {
          const now = Date.now();
          const remaining = task.alarmTargetTimestamp - now;
          if (remaining > 0) {
            // Only schedule if not expired
            scheduleAlarm(task.id);
          } else {
            console.log(`Task ${task.id} was already expired when app started, not scheduling alarm`);
          }
        } else {
          // For tasks without timing data, set up new alarm
          setAlarm(task.id, task.alarm);
        }
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

// Play alarm sound
function playAlarmSound() {
  if (!settings.soundEnabled) {
    console.log('Sound is disabled');
    return;
  }
  
  try {
    let soundFile = null;
    
    console.log('Current sound type:', settings.soundType);
    console.log('Custom sound file:', settings.customSoundFile);
    
    // Determine which sound to play based on soundType
    if (settings.soundType === 'sinking-island') {
      soundFile = path.join(__dirname, 'assets', 'Sinking Island.m4a');
      console.log('Sinking Island file path:', soundFile);
    } else if (settings.soundType === 'custom' && settings.customSoundFile) {
      soundFile = settings.customSoundFile;
      console.log('Custom file path:', soundFile);
    }
    
    // If we have a sound file, try to play it
    if (soundFile && fs.existsSync(soundFile)) {
      console.log('Playing sound file:', soundFile);
      if (process.platform === 'win32') {
        // Use internal app audio - send to renderer process
        try {
          console.log('Playing audio file with internal app audio');
          // Send audio file to renderer process to play internally
          if (mainWindow) {
            mainWindow.webContents.send('play-audio', {
              filePath: soundFile,
              volume: settings.soundVolume || 0.7
            });
          }
        } catch (error) {
          console.log('Internal audio error, using beep:', error.message);
          // Fallback to beep
          spawn('powershell', ['-Command', `[console]::beep(800, 500); [console]::beep(1000, 500); [console]::beep(1200, 500)`]);
        }
      } else if (process.platform === 'darwin') {
        // Use macOS afplay command
        console.log('macOS command: afplay', soundFile);
        spawn('afplay', [soundFile]);
      } else {
        // Use Linux aplay command
        console.log('Linux command: aplay', soundFile);
        spawn('aplay', [soundFile]);
      }
    } else {
      console.log('Sound file not found or using default sound');
      // Fallback to default system sounds
      if (process.platform === 'win32') {
        // Use Windows beep command for a simple alarm sound
        console.log('Playing default Windows beep');
        spawn('powershell', ['-Command', `[console]::beep(800, 500); [console]::beep(1000, 500); [console]::beep(1200, 500)`]);
      } else if (process.platform === 'darwin') {
        // Use macOS say command
        console.log('Playing default macOS say');
        spawn('say', ['-v', 'Alex', 'Time is up!']);
      } else {
        // Use Linux beep command
        console.log('Playing default Linux beep');
        spawn('beep', ['-f', '800', '-l', '500']);
      }
    }
  } catch (error) {
    console.log('Could not play alarm sound:', error.message);
  }
}

// Show alarm notification
function showAlarmNotification(taskId) {
  const task = tasks.find(t => t.id === taskId);
  if (task) {
    // Play alarm sound
    playAlarmSound();
    
    // Show system notification
    notifier.notify({
      title: 'Task Reminder',
      message: `Time's up for: ${task.title}`,
      sound: false, // We handle sound ourselves
      wait: true
    });

    // Show in-app notification
    if (mainWindow) {
      // Bring window to front and focus
      mainWindow.show();
      mainWindow.focus();
      mainWindow.moveTop();
      
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
    autoHideMenuBar: true,
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
          version: '1.1.0',
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

// Handle sound file selection
ipcMain.handle('select-sound-file', async () => {
  try {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Select Alarm Sound File',
      filters: [
        { name: 'Audio Files', extensions: ['mp3', 'wav', 'ogg', 'm4a', 'aac'] },
        { name: 'All Files', extensions: ['*'] }
      ],
      properties: ['openFile']
    });
    
    if (!result.canceled && result.filePaths.length > 0) {
      const filePath = result.filePaths[0];
      settings.customSoundFile = filePath;
      return { success: true, filePath: filePath };
    }
    
    return { success: false, error: 'No file selected' };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Handle sound file preview
ipcMain.handle('preview-sound-file', async () => {
  console.log('Custom sound preview requested');
  console.log('Custom sound file:', settings.customSoundFile);
  console.log('File exists:', settings.customSoundFile ? fs.existsSync(settings.customSoundFile) : false);
  
  if (!settings.customSoundFile || !fs.existsSync(settings.customSoundFile)) {
    return { success: false, error: 'No custom sound file selected' };
  }
  
  try {
    // Play custom sound directly without using playAlarmSound()
    const soundFile = settings.customSoundFile;
    console.log('Playing custom sound file:', soundFile);
    
    if (process.platform === 'win32') {
      // Use internal app audio - send to renderer process
      console.log('Playing custom sound with internal app audio');
      if (mainWindow) {
        mainWindow.webContents.send('play-audio', {
          filePath: soundFile,
          volume: settings.soundVolume || 0.7
        });
      }
    } else if (process.platform === 'darwin') {
      spawn('afplay', [soundFile]);
    } else {
      spawn('aplay', [soundFile]);
    }
    
    return { success: true };
  } catch (error) {
    console.log('Custom sound preview error:', error.message);
    return { success: false, error: error.message };
  }
});

// Handle sound file reset
ipcMain.handle('reset-sound-file', () => {
  settings.customSoundFile = null;
  return { success: true };
});

// Handle basic sound preview
ipcMain.handle('preview-basic-sound', async (event, soundType) => {
  console.log('Preview sound requested:', soundType);
  console.log('Sound enabled:', settings.soundEnabled);
  
  if (!settings.soundEnabled) {
    return { success: false, error: 'Sound is disabled' };
  }
  
  try {
    // Play sound directly without changing settings
    if (soundType === 'default') {
      // Play default system sound
      if (process.platform === 'win32') {
        spawn('powershell', ['-Command', `[console]::beep(800, 500); [console]::beep(1000, 500); [console]::beep(1200, 500)`]);
      } else if (process.platform === 'darwin') {
        spawn('say', ['-v', 'Alex', 'Time is up!']);
      } else {
        spawn('beep', ['-f', '800', '-l', '500']);
      }
    } else if (soundType === 'sinking-island') {
      // Play Sinking Island sound
      const soundFile = path.join(__dirname, 'assets', 'Sinking Island.m4a');
      console.log('Preview Sinking Island file:', soundFile);
      
      if (fs.existsSync(soundFile)) {
        if (process.platform === 'win32') {
          // Use internal app audio - send to renderer process
          console.log('Playing preview with internal app audio');
          if (mainWindow) {
            mainWindow.webContents.send('play-audio', {
              filePath: soundFile,
              volume: settings.soundVolume || 0.7
            });
          }
        } else if (process.platform === 'darwin') {
          spawn('afplay', [soundFile]);
        } else {
          spawn('aplay', [soundFile]);
        }
      } else {
        console.log('Sinking Island file not found, using default sound');
        if (process.platform === 'win32') {
          spawn('powershell', ['-Command', `[console]::beep(800, 500); [console]::beep(1000, 500); [console]::beep(1200, 500)`]);
        }
      }
    }
    
    return { success: true };
  } catch (error) {
    console.log('Preview sound error:', error.message);
    return { success: false, error: error.message };
  }
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

