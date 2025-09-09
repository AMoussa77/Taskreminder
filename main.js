const { app, BrowserWindow, ipcMain, Notification, dialog } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');
const fs = require('fs');
const notifier = require('node-notifier');

let mainWindow;
let tasks = [];
let alarms = new Map();
const MAX_TIMEOUT_MS = 0x7fffffff; // Maximum setTimeout delay (~24.8 days)

// Configure auto-updater
// Only enable auto-updater in production (packaged) mode
if (app.isPackaged) {
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.checkForUpdatesAndNotify();
} else {
  console.log('Auto-updater disabled in development mode');
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

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// App event handlers
app.whenReady().then(() => {
  loadTasks();
  createWindow();

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
  console.log('Checking for update...');
  if (mainWindow) {
    mainWindow.webContents.send('update-checking');
  }
});

autoUpdater.on('update-available', (info) => {
  console.log('Update available:', info);
  if (mainWindow) {
    mainWindow.webContents.send('update-available', info);
  }
});

autoUpdater.on('update-not-available', (info) => {
  console.log('Update not available:', info);
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

autoUpdater.on('download-progress', (progressObj) => {
  let log_message = "Download speed: " + progressObj.bytesPerSecond;
  log_message = log_message + ' - Downloaded ' + progressObj.percent + '%';
  log_message = log_message + ' (' + progressObj.transferred + "/" + progressObj.total + ')';
  console.log(log_message);
  
  if (mainWindow) {
    mainWindow.webContents.send('download-progress', progressObj);
  }
});

autoUpdater.on('update-downloaded', (info) => {
  console.log('Update downloaded successfully:', info);
  if (mainWindow) {
    mainWindow.webContents.send('update-downloaded', info);
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

// Auto-updater IPC handlers
ipcMain.handle('check-for-updates', () => {
  return autoUpdater.checkForUpdates();
});

ipcMain.handle('quit-and-install', () => {
  autoUpdater.quitAndInstall();
});
