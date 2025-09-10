const { ipcRenderer } = require('electron');

class TaskManager {
    constructor() {
        this.tasks = [];
        this.countdownIntervals = new Map();
        this.init();
    }

    async init() {
        await this.loadTasks();
        this.setupEventListeners();
        this.renderTasks();
        this.updateStats();
        this.startCountdownUpdates();
    }

    setupEventListeners() {
        // Add task button
        document.getElementById('addTaskBtn').addEventListener('click', () => {
            this.addTask();
        });

        // Alarm toggle
        document.getElementById('alarmEnabled').addEventListener('change', (e) => {
            const alarmInputs = document.getElementById('alarmInputs');
            const alarmMode = document.getElementById('alarmMode');
            const datetimeInputs = document.getElementById('datetimeInputs');
            if (e.target.checked) {
                alarmMode.style.display = 'block';
                const selectedMode = (document.querySelector('input[name="alarmMode"]:checked') || {}).value || 'duration';
                if (selectedMode === 'duration') {
                    alarmInputs.classList.add('show');
                    datetimeInputs.classList.remove('show');
                } else {
                    alarmInputs.classList.remove('show');
                    datetimeInputs.classList.add('show');
                    this.ensureDateTimeDefaults();
                }
            } else {
                alarmInputs.classList.remove('show');
                alarmMode.style.display = 'none';
                datetimeInputs.classList.remove('show');
            }
        });

        // Alarm mode switch
        document.querySelectorAll('input[name="alarmMode"]').forEach(r => {
            r.addEventListener('change', (e) => {
                const mode = e.target.value;
                const alarmInputs = document.getElementById('alarmInputs');
                const datetimeInputs = document.getElementById('datetimeInputs');
                if (mode === 'duration') {
                    alarmInputs.classList.add('show');
                    datetimeInputs.classList.remove('show');
                } else {
                    alarmInputs.classList.remove('show');
                    datetimeInputs.classList.add('show');
                    this.ensureDateTimeDefaults();
                }
            });
        });

        // Enter key to add task
        document.getElementById('taskTitle').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.addTask();
            }
        });

        // Alarm modal
        document.getElementById('closeAlarmModal').addEventListener('click', () => {
            this.closeAlarmModal();
        });

        document.getElementById('dismissAlarm').addEventListener('click', () => {
            this.closeAlarmModal();
        });

        // Listen for alarm notifications from main process
        ipcRenderer.on('alarm-triggered', (event, data) => {
            this.showAlarmModal(data);
        });

        // Listen for open-settings event from main process
        ipcRenderer.on('open-settings', () => {
            this.showSettingsModal();
        });

        // Auto-updater event listeners
        ipcRenderer.on('update-available', (event, info) => {
            this.showUpdateAvailableModal(info);
        });

        // Confirm modal events
        const closeConfirm = document.getElementById('closeConfirmModal');
        const cancelConfirm = document.getElementById('cancelConfirm');
        const okConfirm = document.getElementById('okConfirm');
        if (closeConfirm) closeConfirm.addEventListener('click', () => this.hideConfirmModal(false));
        if (cancelConfirm) cancelConfirm.addEventListener('click', () => this.hideConfirmModal(false));
        if (okConfirm) okConfirm.addEventListener('click', () => this.hideConfirmModal(true));

        // Clear all button
        const clearAllBtn = document.getElementById('clearAllBtn');
        if (clearAllBtn) {
            clearAllBtn.addEventListener('click', async () => {
                const confirmed = await this.showConfirmModal('Delete ALL tasks? This cannot be undone.');
                if (!confirmed) return;
                const ok = await ipcRenderer.invoke('clear-all-tasks');
                if (ok) {
                    this.tasks = [];
                    this.renderTasks();
                    this.updateStats();
                    this.refocusInputs();
                }
            });
        }

        // Check for updates button
        const checkUpdatesBtn = document.getElementById('checkUpdatesBtn');
        if (checkUpdatesBtn) {
            checkUpdatesBtn.addEventListener('click', () => {
                this.checkForUpdates();
            });
        }

        // Settings button
        const settingsBtn = document.getElementById('settingsBtn');
        if (settingsBtn) {
            settingsBtn.addEventListener('click', () => {
                this.showSettingsModal();
            });
        }

        // Settings modal events
        const closeSettingsModal = document.getElementById('closeSettingsModal');
        const cancelSettings = document.getElementById('cancelSettings');
        const saveSettings = document.getElementById('saveSettings');
        
        if (closeSettingsModal) closeSettingsModal.addEventListener('click', () => this.hideSettingsModal());
        if (cancelSettings) cancelSettings.addEventListener('click', () => this.hideSettingsModal());
        if (saveSettings) saveSettings.addEventListener('click', () => this.saveSettings());

        // Load saved theme and settings
        this.loadTheme();
        this.loadSettings();
    }

    async loadTasks() {
        try {
            this.tasks = await ipcRenderer.invoke('get-tasks');
        } catch (error) {
            console.error('Error loading tasks:', error);
            this.tasks = [];
        }
    }

    async addTask() {
        const title = document.getElementById('taskTitle').value.trim();
        const description = document.getElementById('taskDescription').value.trim();
        const alarmEnabled = document.getElementById('alarmEnabled').checked;
        const mode = (document.querySelector('input[name="alarmMode"]:checked') || {}).value || 'duration';
        const alarmHours = parseInt(document.getElementById('alarmHours').value) || 0;
        const alarmMinutes = parseInt(document.getElementById('alarmMinutes').value) || 0;
        const alarmSeconds = parseInt(document.getElementById('alarmSeconds').value) || 0;
        const alarmDateTimeEl = document.getElementById('alarmDateTime');
        const alarmDateTimeValue = alarmDateTimeEl ? alarmDateTimeEl.value : '';

        if (alarmEnabled && mode === 'datetime') {
            if (!alarmDateTimeValue) {
                alert('Please choose a date and time for the alarm');
                this.ensureDateTimeDefaults();
                return;
            }
            const ts = new Date(alarmDateTimeValue).getTime();
            if (isNaN(ts) || ts <= Date.now()) {
                alert('Please pick a future date and time for the alarm');
                this.ensureDateTimeDefaults();
                return;
            }
        }

        if (!title) {
            alert('Please enter a task title');
            await ipcRenderer.invoke('refocus-window');
            this.refocusInputs();
            return;
        }

        try {
            const taskData = {
                title,
                description,
                alarm: mode === 'duration' ? {
                    enabled: alarmEnabled,
                    mode: 'duration',
                    hours: alarmHours,
                    minutes: alarmMinutes,
                    seconds: alarmSeconds
                } : {
                    enabled: alarmEnabled,
                    mode: 'datetime',
                    timestamp: alarmDateTimeValue ? new Date(alarmDateTimeValue).getTime() : null
                }
            };

            const newTask = await ipcRenderer.invoke('add-task', taskData);
            this.tasks.push(newTask);
            
            // Set alarm if enabled
            const shouldSet = alarmEnabled && (
                (mode === 'duration' && (alarmHours > 0 || alarmMinutes > 0 || alarmSeconds > 0)) ||
                (mode === 'datetime' && taskData.alarm.timestamp && taskData.alarm.timestamp > Date.now())
            );
            if (shouldSet) {
                const updatedTask = await ipcRenderer.invoke('set-alarm', newTask.id, taskData.alarm);
                // Update the task in our local array with the alarm timing info
                const taskIndex = this.tasks.findIndex(t => t.id === newTask.id);
                if (taskIndex !== -1) {
                    this.tasks[taskIndex] = updatedTask;
                }
            }

            this.clearForm();
            this.renderTasks();
            this.updateStats();
            
            // Start countdown immediately for new tasks with alarms
            if (shouldSet) {
                setTimeout(() => {
                    this.updateTaskCountdown(newTask.id);
                }, 100);
            }
        } catch (error) {
            console.error('Error adding task:', error);
            alert('Error adding task. Please try again.');
            await ipcRenderer.invoke('refocus-window');
            this.refocusInputs();
        }
    }

    clearForm() {
        document.getElementById('taskTitle').value = '';
        document.getElementById('taskDescription').value = '';
        document.getElementById('alarmEnabled').checked = false;
        document.getElementById('alarmHours').value = '0';
        document.getElementById('alarmMinutes').value = '0';
        document.getElementById('alarmSeconds').value = '0';
        document.getElementById('alarmInputs').classList.remove('show');
        this.refocusInputs();
    }

    async toggleTask(taskId) {
        try {
            const updatedTask = await ipcRenderer.invoke('toggle-task', taskId);
            if (updatedTask) {
                const taskIndex = this.tasks.findIndex(t => t.id === taskId);
                if (taskIndex !== -1) {
                    this.tasks[taskIndex] = updatedTask;
                    this.renderTasks();
                    this.updateStats();
                    // Hide countdown if completed; refresh if reopened
                    const taskElement = document.querySelector(`[data-task-id="${taskId}"]`);
                    if (taskElement) {
                        const countdown = taskElement.querySelector('.countdown-display');
                        if (countdown) {
                            countdown.style.display = updatedTask.completed ? 'none' : 'flex';
                        }
                        if (!updatedTask.completed && updatedTask.alarm && updatedTask.alarm.enabled) {
                            setTimeout(() => this.updateTaskCountdown(taskId), 100);
                        }
                    }
                }
            }
        } catch (error) {
            console.error('Error toggling task:', error);
        }
    }

    async deleteTask(taskId) {
        const confirmed = await this.showConfirmModal('Are you sure you want to delete this task?');
        if (!confirmed) {
            this.refocusInputs();
            return;
        }
        try {
            const success = await ipcRenderer.invoke('delete-task', taskId);
            if (success) {
                this.tasks = this.tasks.filter(t => t.id !== taskId);
                this.renderTasks();
                this.updateStats();
                this.refocusInputs();
            }
        } catch (error) {
            console.error('Error deleting task:', error);
            alert('Error deleting task. Please try again.');
            this.refocusInputs();
        }
    }

    async updateAlarm(taskId, alarmConfig) {
        try {
            const updatedTask = await ipcRenderer.invoke('set-alarm', taskId, alarmConfig);
            if (updatedTask) {
                const taskIndex = this.tasks.findIndex(t => t.id === taskId);
                if (taskIndex !== -1) {
                    this.tasks[taskIndex] = updatedTask;
                    this.renderTasks();
                    this.updateStats();
                    // Immediately refresh countdown for this task
                    setTimeout(() => {
                        this.updateTaskCountdown(taskId);
                    }, 100);
                }
            }
        } catch (error) {
            console.error('Error updating alarm:', error);
        }
    }

    renderTasks() {
        const container = document.getElementById('tasksContainer');
        
        if (this.tasks.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-clipboard-list"></i>
                    <h3>No tasks yet</h3>
                    <p>Add your first task above to get started!</p>
                </div>
            `;
            return;
        }

        container.innerHTML = this.tasks.map(task => this.renderTask(task)).join('');
    }

    renderTask(task) {
        const createdDate = new Date(task.createdAt).toLocaleDateString();
        const alarmDisplay = task.alarm.enabled ? 
            this.formatAlarmTime(task.alarm) : '';

        return `
            <div class="task-item ${task.completed ? 'completed' : ''}" data-task-id="${task.id}">
                <div class="task-header">
                    <div>
                        <div class="task-title">${this.escapeHtml(task.title)}</div>
                        ${task.description ? `<div class="task-description">${this.escapeHtml(task.description)}</div>` : ''}
                    </div>
                    <div class="task-actions">
                        <button class="btn btn-${task.completed ? 'secondary' : 'success'}" 
                                onclick="taskManager.toggleTask('${task.id}')">
                            <i class="fas fa-${task.completed ? 'undo' : 'check'}"></i>
                            ${task.completed ? 'Undo' : 'Complete'}
                        </button>
                        <button class="btn btn-danger" onclick="taskManager.deleteTask('${task.id}')">
                            <i class="fas fa-trash"></i>
                            Delete
                        </button>
                    </div>
                </div>
                
                <div class="task-meta">
                    <span class="task-created">Created: ${createdDate}</span>
                </div>
                
                ${task.alarm.enabled ? `
                    <div class="task-alarm">
                        <div class="alarm-info">
                            <i class="fas fa-clock"></i>
                            <span>Alarm set for:</span>
                            <span class="alarm-time">${alarmDisplay}</span>
                        </div>
                    </div>
                    <div class="countdown-display" style="display: none;">
                        <span class="countdown-label">Time remaining:</span>
                        <span class="countdown-time">--:--:--</span>
                    </div>
                ` : ''}
            </div>
        `;
    }

    formatAlarmTime(alarm) {
        if (!alarm) return '';
        if (alarm.mode === 'datetime' && alarm.timestamp) {
            try {
                return new Date(alarm.timestamp).toLocaleString();
            } catch (_) {
                return '';
            }
        }
        const parts = [];
        if (alarm.hours > 0) parts.push(`${alarm.hours}h`);
        if (alarm.minutes > 0) parts.push(`${alarm.minutes}m`);
        if (alarm.seconds > 0) parts.push(`${alarm.seconds}s`);
        return parts.join(' ') || '0s';
    }

    showAlarmDialog(taskId) {
        const task = this.tasks.find(t => t.id === taskId);
        if (!task) return;

        const hours = prompt('Enter hours (0-23):', task.alarm.hours || 0);
        if (hours === null) return;

        const minutes = prompt('Enter minutes (0-59):', task.alarm.minutes || 0);
        if (minutes === null) return;

        const seconds = prompt('Enter seconds (0-59):', task.alarm.seconds || 0);
        if (seconds === null) return;

        const h = Math.max(0, Math.min(23, parseInt(hours) || 0));
        const m = Math.max(0, Math.min(59, parseInt(minutes) || 0));
        const s = Math.max(0, Math.min(59, parseInt(seconds) || 0));

        if (h === 0 && m === 0 && s === 0) {
            alert('Alarm time must be greater than 0');
            return;
        }

        this.updateAlarm(taskId, {
            enabled: true,
            hours: h,
            minutes: m,
            seconds: s
        });
    }

    showAlarmModal(data) {
        const modal = document.getElementById('alarmModal');
        const message = document.getElementById('alarmMessage');
        
        message.textContent = `Time's up for: ${data.title}`;
        modal.classList.add('show');
        
        // Auto-close after 10 seconds
        setTimeout(() => {
            this.closeAlarmModal();
        }, 10000);
    }

    closeAlarmModal() {
        const modal = document.getElementById('alarmModal');
        modal.classList.remove('show');
    }

    ensureDateTimeDefaults() {
        try {
            const el = document.getElementById('alarmDateTime');
            if (!el) return;
            if (!el.value) {
                const now = new Date();
                now.setMinutes(now.getMinutes() + 5);
                const pad = (n) => n.toString().padStart(2, '0');
                const yyyy = now.getFullYear();
                const MM = pad(now.getMonth() + 1);
                const dd = pad(now.getDate());
                const hh = pad(now.getHours());
                const mm = pad(now.getMinutes());
                el.value = `${yyyy}-${MM}-${dd}T${hh}:${mm}`;
            }
            el.min = new Date().toISOString().slice(0,16);
        } catch (_) {}
    }

    showConfirmModal(message) {
        return new Promise((resolve) => {
            const modal = document.getElementById('confirmModal');
            const messageEl = document.getElementById('confirmMessage');
            modal.classList.add('show');
            if (messageEl) messageEl.textContent = message || 'Are you sure?';
            this._confirmResolver = resolve;
        });
    }

    hideConfirmModal(confirmed) {
        const modal = document.getElementById('confirmModal');
        modal.classList.remove('show');
        if (this._confirmResolver) {
            this._confirmResolver(confirmed);
            this._confirmResolver = null;
        }
    }

    updateStats() {
        const total = this.tasks.length;
        const completed = this.tasks.filter(t => t.completed).length;
        const pending = total - completed;

        document.getElementById('totalTasks').textContent = total;
        document.getElementById('completedTasks').textContent = completed;
        document.getElementById('pendingTasks').textContent = pending;
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    startCountdownUpdates() {
        // Update countdowns every second
        setInterval(() => {
            this.updateAllCountdowns();
        }, 1000);
    }

    async updateAllCountdowns() {
        for (const task of this.tasks) {
            if (task.completed) continue; // skip completed tasks
            if (task.alarm && task.alarm.enabled) {
                // If alarm is enabled but no start time, try to get countdown info
                if (!task.alarmStartTime) {
                    const countdownInfo = await ipcRenderer.invoke('get-countdown-info', task.id);
                    if (countdownInfo) {
                        await this.updateTaskCountdown(task.id);
                    }
                } else {
                    await this.updateTaskCountdown(task.id);
                }
            } else {
                // Hide countdown if alarm disabled
                const taskElement = document.querySelector(`[data-task-id="${task.id}"]`);
                if (taskElement) {
                    const cd = taskElement.querySelector('.countdown-display');
                    if (cd) cd.style.display = 'none';
                }
            }
        }
    }

    async updateTaskCountdown(taskId) {
        try {
            const countdownInfo = await ipcRenderer.invoke('get-countdown-info', taskId);
            if (countdownInfo) {
                const taskElement = document.querySelector(`[data-task-id="${taskId}"]`);
                if (taskElement) {
                    this.updateTaskElementCountdown(taskElement, countdownInfo);
                    this.updateTaskElementExpiredState(taskElement, countdownInfo.isExpired);
                }
            }
        } catch (error) {
            console.error('Error updating countdown:', error);
        }
    }

    updateTaskElementCountdown(taskElement, countdownInfo) {
        let countdownDisplay = taskElement.querySelector('.countdown-display');
        
        if (!countdownDisplay) {
            countdownDisplay = document.createElement('div');
            countdownDisplay.className = 'countdown-display';
            taskElement.appendChild(countdownDisplay);
        }

        // Hide countdown if task is completed
        if (taskElement.classList.contains('completed')) {
            countdownDisplay.style.display = 'none';
            return;
        }

        // Show the countdown display
        countdownDisplay.style.display = 'flex';

        const timeRemaining = Math.abs(countdownInfo.remaining);
        const isExpired = countdownInfo.isExpired;
        
        const hours = Math.floor(timeRemaining / (1000 * 60 * 60));
        const minutes = Math.floor((timeRemaining % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((timeRemaining % (1000 * 60)) / 1000);

        const timeString = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        const prefix = isExpired ? '-' : '';
        
        countdownDisplay.innerHTML = `
            <span class="countdown-label ${isExpired ? 'expired' : ''}">
                ${isExpired ? 'Overdue by:' : 'Time remaining:'}
            </span>
            <span class="countdown-time ${isExpired ? 'expired' : ''}">
                ${prefix}${timeString}
            </span>
        `;
    }

    updateTaskElementExpiredState(taskElement, isExpired) {
        if (isExpired) {
            taskElement.classList.add('expired');
        } else {
            taskElement.classList.remove('expired');
        }
    }

    refocusInputs() {
        try {
            window.focus();
            const titleEl = document.getElementById('taskTitle');
            if (titleEl) {
                setTimeout(() => titleEl.focus(), 0);
            }
        } catch (_) {}
    }

    formatCountdownTime(milliseconds) {
        const isNegative = milliseconds < 0;
        const absMs = Math.abs(milliseconds);
        
        const hours = Math.floor(absMs / (1000 * 60 * 60));
        const minutes = Math.floor((absMs % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((absMs % (1000 * 60)) / 1000);
        
        const timeString = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        return isNegative ? `-${timeString}` : timeString;
    }


    loadTheme() {
        const savedTheme = localStorage.getItem('theme') || 'light';
        document.documentElement.setAttribute('data-theme', savedTheme);
    }

    // Auto-updater methods
    showUpdateAvailableModal(info) {
        const modal = document.createElement('div');
        modal.className = 'modal show';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3><i class="fas fa-download"></i> Update Available</h3>
                    <button class="close-btn" onclick="this.closest('.modal').remove()">&times;</button>
                </div>
                <div class="modal-body">
                    <p>A new version (${info.version}) is available for download.</p>
                    <p>Would you like to download and install it now?</p>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-secondary" onclick="this.closest('.modal').remove()">Later</button>
                    <button class="btn btn-primary" onclick="taskManager.downloadUpdate()">Download Update</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    }


    async downloadUpdate() {
        try {
            // Open the GitHub releases page in the browser
            await ipcRenderer.invoke('open-download-page');
        } catch (error) {
            console.error('Error opening download page:', error);
        }
    }


    async checkForUpdates() {
        try {
            await ipcRenderer.invoke('check-for-updates');
        } catch (error) {
            console.error('Error checking for updates:', error);
        }
    }

    // Settings functionality
    showSettingsModal() {
        const modal = document.getElementById('settingsModal');
        if (modal) {
            modal.classList.add('show');
            this.loadSettingsToModal();
        }
    }

    hideSettingsModal() {
        const modal = document.getElementById('settingsModal');
        if (modal) {
            modal.classList.remove('show');
        }
    }

    loadSettingsToModal() {
        // Load current settings into modal
        const darkModeToggle = document.getElementById('darkModeToggle');
        const minimizeToTrayToggle = document.getElementById('minimizeToTrayToggle');
        const closeToTrayToggle = document.getElementById('closeToTrayToggle');
        const autoUpdateToggle = document.getElementById('autoUpdateToggle');

        if (darkModeToggle) {
            const currentTheme = document.documentElement.getAttribute('data-theme');
            darkModeToggle.checked = currentTheme === 'dark';
        }

        if (minimizeToTrayToggle) {
            minimizeToTrayToggle.checked = localStorage.getItem('minimizeToTray') === 'true';
        }

        if (closeToTrayToggle) {
            closeToTrayToggle.checked = localStorage.getItem('closeToTray') === 'true';
        }

        if (autoUpdateToggle) {
            autoUpdateToggle.checked = localStorage.getItem('autoUpdate') !== 'false'; // Default to true
        }
    }

    saveSettings() {
        const darkModeToggle = document.getElementById('darkModeToggle');
        const minimizeToTrayToggle = document.getElementById('minimizeToTrayToggle');
        const closeToTrayToggle = document.getElementById('closeToTrayToggle');
        const autoUpdateToggle = document.getElementById('autoUpdateToggle');

        // Save dark mode setting
        if (darkModeToggle) {
            const isDarkMode = darkModeToggle.checked;
            const newTheme = isDarkMode ? 'dark' : 'light';
            document.documentElement.setAttribute('data-theme', newTheme);
            localStorage.setItem('theme', newTheme);
        }

        // Save tray settings
        if (minimizeToTrayToggle) {
            localStorage.setItem('minimizeToTray', minimizeToTrayToggle.checked.toString());
        }

        if (closeToTrayToggle) {
            localStorage.setItem('closeToTray', closeToTrayToggle.checked.toString());
        }

        // Save auto-update setting
        if (autoUpdateToggle) {
            localStorage.setItem('autoUpdate', autoUpdateToggle.checked.toString());
        }

        // Send settings to main process
        ipcRenderer.invoke('update-settings', {
            minimizeToTray: minimizeToTrayToggle ? minimizeToTrayToggle.checked : false,
            closeToTray: closeToTrayToggle ? closeToTrayToggle.checked : false,
            autoUpdate: autoUpdateToggle ? autoUpdateToggle.checked : true
        });

        this.hideSettingsModal();
    }

    loadSettings() {
        // Load settings from localStorage
        const minimizeToTray = localStorage.getItem('minimizeToTray') === 'true';
        const closeToTray = localStorage.getItem('closeToTray') === 'true';
        const autoUpdate = localStorage.getItem('autoUpdate') !== 'false'; // Default to true

        // Send initial settings to main process
        ipcRenderer.invoke('update-settings', {
            minimizeToTray: minimizeToTray,
            closeToTray: closeToTray,
            autoUpdate: autoUpdate
        });
    }
}

// Initialize the task manager when the page loads
let taskManager;
document.addEventListener('DOMContentLoaded', () => {
    taskManager = new TaskManager();
});
