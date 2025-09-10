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

        // Auto-updater event listeners
        ipcRenderer.on('update-checking', () => {
            console.log('Checking for updates...');
        });

        ipcRenderer.on('update-available', (event, info) => {
            console.log('Update available:', info);
            this.showUpdateAvailableModal(info);
        });

        ipcRenderer.on('update-not-available', (event, info) => {
            console.log('No updates available:', info);
            // Close any progress modal if it exists
            const progressModal = document.getElementById('downloadProgressModal');
            if (progressModal) {
                progressModal.remove();
            }
            this.showUpdateErrorModal('No updates available. You are already running the latest version.');
        });

        ipcRenderer.on('download-progress', (event, progressObj) => {
            console.log('Download progress:', progressObj);
            this.updateDownloadProgress(progressObj);
        });

        ipcRenderer.on('update-downloaded', (event, info) => {
            console.log('Update downloaded:', info);
            this.showUpdateDownloadedModal(info);
        });

        ipcRenderer.on('update-error', (event, error) => {
            console.error('Update error:', error);
            this.showUpdateErrorModal(error);
        });

        ipcRenderer.on('update-check-timeout', () => {
            console.log('Update check timeout');
            this.showUpdateTimeoutModal();
        });

        ipcRenderer.on('download-timeout', () => {
            console.log('Download timeout');
            this.showDownloadTimeoutModal();
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

        // Theme toggle
        const themeToggle = document.getElementById('themeToggle');
        if (themeToggle) {
            themeToggle.addEventListener('click', () => {
                this.toggleTheme();
            });
        }

        // Load saved theme
        this.loadTheme();
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

    toggleTheme() {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        
        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);
        
        // Update icon
        const themeIcon = document.getElementById('themeIcon');
        if (themeIcon) {
            themeIcon.className = newTheme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
        }
    }

    loadTheme() {
        const savedTheme = localStorage.getItem('theme') || 'light';
        document.documentElement.setAttribute('data-theme', savedTheme);
        
        // Update icon
        const themeIcon = document.getElementById('themeIcon');
        if (themeIcon) {
            themeIcon.className = savedTheme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
        }
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

    showDownloadProgressModal() {
        const modal = document.createElement('div');
        modal.className = 'modal show';
        modal.id = 'downloadProgressModal';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3><i class="fas fa-download"></i> Downloading Update</h3>
                </div>
                <div class="modal-body">
                    <div class="progress-container">
                        <div class="progress-bar">
                            <div class="progress-fill" style="width: 0%"></div>
                        </div>
                        <div class="progress-text">0%</div>
                    </div>
                    <div class="download-info">
                        <div class="download-speed">Speed: 0 KB/s</div>
                        <div class="download-size">0 MB / 0 MB</div>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    }

    showUpdateDownloadedModal(info) {
        // Remove download progress modal if it exists
        const progressModal = document.getElementById('downloadProgressModal');
        if (progressModal) {
            progressModal.remove();
        }

        const modal = document.createElement('div');
        modal.className = 'modal show';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3><i class="fas fa-check-circle"></i> Update Downloaded</h3>
                    <button class="close-btn" onclick="this.closest('.modal').remove()">&times;</button>
                </div>
                <div class="modal-body">
                    <p>Update downloaded successfully!</p>
                    <p>The application will restart to install the update.</p>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-primary" onclick="taskManager.installUpdate()">Install & Restart</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    }

    updateDownloadProgress(progressObj) {
        // Find existing progress modal or create one
        let progressModal = document.getElementById('updateProgressModal');
        if (!progressModal) {
            progressModal = document.createElement('div');
            progressModal.id = 'updateProgressModal';
            progressModal.className = 'modal show';
            progressModal.innerHTML = `
                <div class="modal-content">
                    <div class="modal-header">
                        <h3><i class="fas fa-download"></i> Downloading Update</h3>
                    </div>
                    <div class="modal-body">
                        <div class="progress-container">
                            <div class="progress-bar">
                                <div class="progress-fill" style="width: 0%"></div>
                            </div>
                            <div class="progress-text">0%</div>
                        </div>
                        <div class="download-info">
                            <div class="download-speed">Speed: 0 KB/s</div>
                            <div class="download-size">0 MB / 0 MB</div>
                        </div>
                    </div>
                </div>
            `;
            document.body.appendChild(progressModal);
        }

        const progressFill = progressModal.querySelector('.progress-fill');
        const progressText = progressModal.querySelector('.progress-text');
        const downloadSpeed = progressModal.querySelector('.download-speed');
        const downloadSize = progressModal.querySelector('.download-size');

        if (progressFill) progressFill.style.width = `${progressObj.percent}%`;
        if (progressText) progressText.textContent = `${Math.round(progressObj.percent)}%`;
        if (downloadSpeed) downloadSpeed.textContent = `Speed: ${Math.round(progressObj.bytesPerSecond / 1024)} KB/s`;
        if (downloadSize) downloadSize.textContent = `${Math.round(progressObj.transferred / 1024 / 1024)} MB / ${Math.round(progressObj.total / 1024 / 1024)} MB`;
    }

    async downloadUpdate() {
        try {
            console.log('Starting update download...');
            // Close the update available modal
            const modal = document.querySelector('.modal.show');
            if (modal) {
                modal.remove();
            }
            
            // Show download progress modal
            this.showDownloadProgressModal();
            
            // First try the normal download process
            const result = await ipcRenderer.invoke('download-update');
            console.log('Download result:', result);
            
            if (!result.success) {
                // Show specific error message for disabled auto-updater
                if (result.error && result.error.includes('development mode')) {
                    this.showUpdateErrorModal(result.error);
                } else {
                    throw new Error(result.error || 'Download failed to start');
                }
                return;
            }
            
            // Set a fallback timeout to show error if no progress after 15 seconds
            setTimeout(() => {
                const progressModal = document.getElementById('downloadProgressModal');
                if (progressModal && progressModal.querySelector('.progress-text').textContent === '0%') {
                    console.log('No progress detected, trying force download...');
                    this.forceDownloadUpdate();
                }
            }, 15000);
            
        } catch (error) {
            console.error('Error downloading update:', error);
            this.showUpdateErrorModal('Failed to download update: ' + error.message);
        }
    }

    async forceDownloadUpdate() {
        try {
            console.log('Force downloading update...');
            const result = await ipcRenderer.invoke('force-download-update');
            console.log('Force download result:', result);
            
            if (!result.success) {
                this.showDownloadTimeoutModal();
            }
        } catch (error) {
            console.error('Error force downloading:', error);
            this.showDownloadTimeoutModal();
        }
    }

    async installUpdate() {
        try {
            await ipcRenderer.invoke('quit-and-install');
        } catch (error) {
            console.error('Error installing update:', error);
        }
    }

    async checkForUpdates() {
        try {
            await ipcRenderer.invoke('check-for-updates');
        } catch (error) {
            console.error('Error checking for updates:', error);
            this.showUpdateErrorModal('Failed to check for updates. Please try again later.');
        }
    }

    showUpdateErrorModal(error) {
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3><i class="fas fa-exclamation-triangle"></i> Update Error</h3>
                    <button class="close-btn" onclick="this.closest('.modal').remove()">&times;</button>
                </div>
                <div class="modal-body">
                    <p>An error occurred while checking for updates:</p>
                    <p style="color: #e74c3c; font-size: 0.9em;">${error}</p>
                    <p>This might be because:</p>
                    <ul style="text-align: left; margin: 10px 0;">
                        <li>No internet connection</li>
                        <li>GitHub repository doesn't have a release yet</li>
                        <li>You're running in development mode</li>
                    </ul>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-primary" onclick="this.closest('.modal').remove()">OK</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    }

    showUpdateTimeoutModal() {
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3><i class="fas fa-clock"></i> Update Check Timeout</h3>
                    <button class="close-btn" onclick="this.closest('.modal').remove()">&times;</button>
                </div>
                <div class="modal-body">
                    <p>The update check is taking longer than expected.</p>
                    <p>This might be because:</p>
                    <ul style="text-align: left; margin: 10px 0;">
                        <li>Slow internet connection</li>
                        <li>GitHub servers are busy</li>
                        <li>No releases available yet</li>
                    </ul>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-primary" onclick="this.closest('.modal').remove()">OK</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    }

    showDownloadTimeoutModal() {
        // Remove download progress modal if it exists
        const progressModal = document.getElementById('downloadProgressModal');
        if (progressModal) {
            progressModal.remove();
        }

        const modal = document.createElement('div');
        modal.className = 'modal show';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3><i class="fas fa-exclamation-triangle"></i> Download Timeout</h3>
                    <button class="close-btn" onclick="this.closest('.modal').remove()">&times;</button>
                </div>
                <div class="modal-body">
                    <p>The download is taking longer than expected to start.</p>
                    <p>This might be because:</p>
                    <ul style="text-align: left; margin: 10px 0;">
                        <li>No internet connection</li>
                        <li>GitHub servers are busy</li>
                        <li>No update available</li>
                        <li>Firewall blocking the download</li>
                    </ul>
                    <p>Please try again later or check your internet connection.</p>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-secondary" onclick="this.closest('.modal').remove()">Cancel</button>
                    <button class="btn btn-primary" onclick="taskManager.downloadUpdate(); this.closest('.modal').remove();">Try Again</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    }
}

// Initialize the task manager when the page loads
let taskManager;
document.addEventListener('DOMContentLoaded', () => {
    taskManager = new TaskManager();
});
