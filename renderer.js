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

        // Title Required modal
        document.getElementById('closeTitleRequiredModal').addEventListener('click', () => {
            this.closeTitleRequiredModal();
        });

        document.getElementById('dismissTitleRequired').addEventListener('click', () => {
            this.closeTitleRequiredModal();
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

        // Download update button
        const downloadUpdateBtn = document.getElementById('downloadUpdateBtn');
        if (downloadUpdateBtn) {
            downloadUpdateBtn.addEventListener('click', () => {
                this.downloadUpdate();
            });
        }

        // Dismiss update button
        const dismissUpdateBtn = document.getElementById('dismissUpdateBtn');
        if (dismissUpdateBtn) {
            dismissUpdateBtn.addEventListener('click', () => {
                this.dismissUpdate();
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
        
        // Setup sound file picker event listeners
        this.setupSoundFilePicker();
        
        // Setup basic sound selection
        this.setupBasicSoundSelection();
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
            this.showTitleRequiredModal();
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
            return;
        }
        try {
            const success = await ipcRenderer.invoke('delete-task', taskId);
            if (success) {
                this.tasks = this.tasks.filter(t => t.id !== taskId);
                this.renderTasks();
                this.updateStats();
            }
        } catch (error) {
            console.error('Error deleting task:', error);
            alert('Error deleting task. Please try again.');
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
        
        // Bring window to front and focus
        if (window.electronAPI) {
            window.electronAPI.bringToFront();
        }
        
        // No auto-close - user must manually dismiss
    }

    closeAlarmModal() {
        const modal = document.getElementById('alarmModal');
        modal.classList.remove('show');
        
        // Stop any playing audio when alarm modal is closed
        this.stopCurrentAudio();
    }

    showTitleRequiredModal() {
        const modal = document.getElementById('titleRequiredModal');
        modal.classList.add('show');
        
        // Focus the modal
        const okBtn = document.getElementById('dismissTitleRequired');
        if (okBtn) {
            setTimeout(() => okBtn.focus(), 100);
        }
    }

    closeTitleRequiredModal() {
        const modal = document.getElementById('titleRequiredModal');
        modal.classList.remove('show');
        
        // Focus back to title input
        this.refocusInputs();
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
                // Always update countdown for tasks with alarms (including expired ones)
                await this.updateTaskCountdown(task.id);
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

    markTaskAsExpired(taskId) {
        const taskElement = document.querySelector(`[data-task-id="${taskId}"]`);
        if (taskElement) {
            // Add expired visual indicator
            taskElement.classList.add('expired');
            
            // Keep countdown display but mark as expired
            const countdownDisplay = taskElement.querySelector('.countdown-display');
            if (countdownDisplay) {
                countdownDisplay.classList.add('expired');
                countdownDisplay.style.color = '#ff6b6b';
            }
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
        // Show the integrated update available section
        const updateSection = document.getElementById('updateAvailableSection');
        if (updateSection) {
            updateSection.style.display = 'block';
            
            // Update the version text
            const versionText = document.getElementById('availableVersionText');
            if (versionText) {
                versionText.textContent = `v${info.version}`;
            }
            
            // Update the notes if available
            const notesText = document.getElementById('updateNotes');
            if (notesText && info.releaseNotes) {
                notesText.textContent = info.releaseNotes;
            }
        }
    }


    async downloadUpdate() {
        try {
            console.log('Open download page button clicked');
            
            // Hide the update available section
            const updateSection = document.getElementById('updateAvailableSection');
            if (updateSection) {
                updateSection.style.display = 'none';
            }
            
            // Open download page in browser
            console.log('Opening download page in browser');
            await ipcRenderer.invoke('open-download-page');
        } catch (error) {
            console.error('Error opening download page:', error);
        }
    }

    dismissUpdate() {
        // Hide the update available section
        const updateSection = document.getElementById('updateAvailableSection');
        if (updateSection) {
            updateSection.style.display = 'none';
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
        const viewModeSelect = document.getElementById('viewModeSelect');
        const soundEnabledToggle = document.getElementById('soundEnabledToggle');
        const soundVolumeSlider = document.getElementById('soundVolumeSlider');
        const basicSoundSelect = document.getElementById('basicSoundSelect');

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

        if (viewModeSelect) {
            const currentViewMode = localStorage.getItem('viewMode') || 'normal';
            viewModeSelect.value = currentViewMode;
        }

        if (soundEnabledToggle) {
            soundEnabledToggle.checked = localStorage.getItem('soundEnabled') !== 'false'; // Default to true
        }

        if (soundVolumeSlider) {
            soundVolumeSlider.value = localStorage.getItem('soundVolume') || '0.7';
        }
        
        if (basicSoundSelect) {
            basicSoundSelect.value = localStorage.getItem('soundType') || 'default';
            this.updateCustomSoundSection();
        }
        
        // Load custom sound file info
        this.loadCustomSoundInfo();
    }

    saveSettings() {
        const darkModeToggle = document.getElementById('darkModeToggle');
        const minimizeToTrayToggle = document.getElementById('minimizeToTrayToggle');
        const closeToTrayToggle = document.getElementById('closeToTrayToggle');
        const autoUpdateToggle = document.getElementById('autoUpdateToggle');
        const viewModeSelect = document.getElementById('viewModeSelect');
        const soundEnabledToggle = document.getElementById('soundEnabledToggle');
        const soundVolumeSlider = document.getElementById('soundVolumeSlider');
        const basicSoundSelect = document.getElementById('basicSoundSelect');

        // Save dark mode setting
        if (darkModeToggle) {
            const isDarkMode = darkModeToggle.checked;
            const newTheme = isDarkMode ? 'dark' : 'light';
            document.documentElement.setAttribute('data-theme', newTheme);
            localStorage.setItem('theme', newTheme);
        }

        // Save view mode setting
        if (viewModeSelect) {
            const viewMode = viewModeSelect.value;
            document.documentElement.setAttribute('data-view-mode', viewMode);
            localStorage.setItem('viewMode', viewMode);
        }

        // Save sound settings
        if (soundEnabledToggle) {
            localStorage.setItem('soundEnabled', soundEnabledToggle.checked.toString());
        }

        if (soundVolumeSlider) {
            localStorage.setItem('soundVolume', soundVolumeSlider.value);
        }
        
        if (basicSoundSelect) {
            localStorage.setItem('soundType', basicSoundSelect.value);
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
            autoUpdate: autoUpdateToggle ? autoUpdateToggle.checked : true,
            viewMode: viewModeSelect ? viewModeSelect.value : 'normal',
            soundEnabled: soundEnabledToggle ? soundEnabledToggle.checked : true,
            soundVolume: soundVolumeSlider ? parseFloat(soundVolumeSlider.value) : 0.7,
            soundType: basicSoundSelect ? basicSoundSelect.value : 'default',
            customSoundFile: localStorage.getItem('customSoundFile') || null
        });

        // Stop any playing audio when settings are saved
        this.stopCurrentAudio();

        this.hideSettingsModal();
    }

    loadSettings() {
        // Load settings from localStorage
        const minimizeToTray = localStorage.getItem('minimizeToTray') === 'true';
        const closeToTray = localStorage.getItem('closeToTray') === 'true';
        const autoUpdate = localStorage.getItem('autoUpdate') !== 'false'; // Default to true
        const viewMode = localStorage.getItem('viewMode') || 'normal';
        const soundEnabled = localStorage.getItem('soundEnabled') !== 'false'; // Default to true
        const soundVolume = parseFloat(localStorage.getItem('soundVolume')) || 0.7;
        const soundType = localStorage.getItem('soundType') || 'default';

        // Apply view mode setting
        document.documentElement.setAttribute('data-view-mode', viewMode);

        // Send initial settings to main process
        ipcRenderer.invoke('update-settings', {
            minimizeToTray: minimizeToTray,
            closeToTray: closeToTray,
            autoUpdate: autoUpdate,
            viewMode: viewMode,
            soundEnabled: soundEnabled,
            soundVolume: soundVolume,
            soundType: soundType,
            customSoundFile: localStorage.getItem('customSoundFile') || null
        });
    }
    
    setupSoundFilePicker() {
        const selectSoundBtn = document.getElementById('selectSoundBtn');
        const previewSoundBtn = document.getElementById('previewSoundBtn');
        const resetSoundBtn = document.getElementById('resetSoundBtn');
        
        if (selectSoundBtn) {
            selectSoundBtn.addEventListener('click', async () => {
                try {
                    const result = await ipcRenderer.invoke('select-sound-file');
                    if (result.success) {
                        localStorage.setItem('customSoundFile', result.filePath);
                        this.loadCustomSoundInfo();
                        this.updateSoundButtons();
                    } else {
                        console.error('Failed to select sound file:', result.error);
                    }
                } catch (error) {
                    console.error('Error selecting sound file:', error);
                }
            });
        }
        
        if (previewSoundBtn) {
            previewSoundBtn.addEventListener('click', async () => {
                try {
                    const result = await ipcRenderer.invoke('preview-sound-file');
                    if (!result.success) {
                        console.error('Failed to preview sound:', result.error);
                    }
                } catch (error) {
                    console.error('Error previewing sound:', error);
                }
            });
        }
        
        if (resetSoundBtn) {
            resetSoundBtn.addEventListener('click', async () => {
                try {
                    const result = await ipcRenderer.invoke('reset-sound-file');
                    if (result.success) {
                        // Stop current audio
                        this.stopCurrentAudio();
                        
                        // Switch to first sound option (default)
                        const basicSoundSelect = document.getElementById('basicSoundSelect');
                        if (basicSoundSelect) {
                            basicSoundSelect.value = 'default';
                        }
                        
                        localStorage.removeItem('customSoundFile');
                        this.loadCustomSoundInfo();
                        this.updateCustomSoundSection();
                        this.updateSoundButtons();
                    }
                } catch (error) {
                    console.error('Error resetting sound file:', error);
                }
            });
        }
    }
    
    loadCustomSoundInfo() {
        const customSoundFile = localStorage.getItem('customSoundFile');
        const soundInfo = document.getElementById('selectedSoundInfo');
        const soundFilename = document.querySelector('.sound-filename');
        const soundDuration = document.querySelector('.sound-duration');
        
        if (customSoundFile && soundInfo && soundFilename && soundDuration) {
            const fileName = customSoundFile.split('\\').pop().split('/').pop();
            soundFilename.textContent = fileName;
            soundDuration.textContent = 'Custom Sound';
            soundInfo.style.display = 'flex';
        } else if (soundInfo) {
            soundInfo.style.display = 'none';
        }
        
        this.updateSoundButtons();
    }
    
    updateSoundButtons() {
        const customSoundFile = localStorage.getItem('customSoundFile');
        const previewSoundBtn = document.getElementById('previewSoundBtn');
        
        if (previewSoundBtn) {
            previewSoundBtn.disabled = !customSoundFile;
        }
    }
    
    setupBasicSoundSelection() {
        const basicSoundSelect = document.getElementById('basicSoundSelect');
        const testSoundBtn = document.getElementById('testSoundBtn');
        
        if (basicSoundSelect) {
            basicSoundSelect.addEventListener('change', (e) => {
                // Stop current audio when switching sounds
                this.stopCurrentAudio();
                this.updateCustomSoundSection();
                this.previewBasicSound(e.target.value);
            });
        }
        
        if (testSoundBtn) {
            testSoundBtn.addEventListener('click', () => {
                this.testCurrentSound();
            });
        }

        // Stop audio button
        const stopAudioBtn = document.getElementById('stopAudioBtn');
        if (stopAudioBtn) {
            stopAudioBtn.addEventListener('click', () => {
                this.stopCurrentAudio();
            });
        }
    }
    
    updateCustomSoundSection() {
        const basicSoundSelect = document.getElementById('basicSoundSelect');
        const customSoundSection = document.getElementById('customSoundSection');
        
        if (basicSoundSelect && customSoundSection) {
            if (basicSoundSelect.value === 'custom') {
                customSoundSection.style.display = 'block';
            } else {
                customSoundSection.style.display = 'none';
            }
        }
    }
    
    async previewBasicSound(soundType) {
        if (soundType === 'custom') return;
        
        try {
            const result = await ipcRenderer.invoke('preview-basic-sound', soundType);
            if (!result.success) {
                console.error('Failed to preview sound:', result.error);
            }
        } catch (error) {
            console.error('Error previewing sound:', error);
        }
    }
    
    async testCurrentSound() {
        const basicSoundSelect = document.getElementById('basicSoundSelect');
        const soundType = basicSoundSelect ? basicSoundSelect.value : 'default';
        
        console.log('Testing sound type:', soundType);
        
        // Stop current audio before testing new sound
        this.stopCurrentAudio();
        
        try {
            if (soundType === 'custom') {
                // Test custom sound
                const result = await ipcRenderer.invoke('preview-sound-file');
                if (!result.success) {
                    console.error('Failed to test custom sound:', result.error);
                    alert('Custom sound test failed: ' + result.error);
                } else {
                    console.log('Custom sound test successful');
                }
            } else {
                // Test basic sound
                const result = await ipcRenderer.invoke('preview-basic-sound', soundType);
                if (!result.success) {
                    console.error('Failed to test basic sound:', result.error);
                    alert('Sound test failed: ' + result.error);
                } else {
                    console.log('Basic sound test successful');
                }
            }
        } catch (error) {
            console.error('Error testing sound:', error);
            alert('Sound test error: ' + error.message);
        }
    }

    // Internal audio player
    playInternalAudio(filePath, volume = 0.7) {
        try {
            console.log('Playing internal audio:', filePath, 'Volume:', volume);
            
            // Stop any currently playing audio
            this.stopCurrentAudio();
            
            // Create audio element
            const audio = new Audio();
            audio.src = filePath;
            audio.volume = volume;
            audio.preload = 'auto';
            
            // Store reference to current audio
            this.currentAudio = audio;
            
            // Play the audio
            audio.play().then(() => {
                console.log('Audio started playing successfully');
                this.updateStopButton(true);
            }).catch((error) => {
                console.error('Error playing audio:', error);
                // Fallback to beep if audio fails
                this.playBeepSound();
            });
            
            // Clean up after audio ends
            audio.addEventListener('ended', () => {
                console.log('Audio finished playing');
                this.stopCurrentAudio();
            });
            
            // Handle errors
            audio.addEventListener('error', (error) => {
                console.error('Audio error:', error);
                this.playBeepSound();
            });
            
        } catch (error) {
            console.error('Error setting up internal audio:', error);
            this.playBeepSound();
        }
    }

    // Stop current audio
    stopCurrentAudio() {
        if (this.currentAudio) {
            console.log('Stopping current audio');
            this.currentAudio.pause();
            this.currentAudio.currentTime = 0;
            this.currentAudio.remove();
            this.currentAudio = null;
            this.updateStopButton(false);
        }
    }

    // Update stop button visibility
    updateStopButton(show) {
        const stopBtn = document.getElementById('stopAudioBtn');
        if (stopBtn) {
            stopBtn.style.display = show ? 'inline-block' : 'none';
        }
    }

    // Fallback beep sound
    playBeepSound() {
        try {
            // Create a simple beep sound using Web Audio API
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);
            
            oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
            oscillator.frequency.setValueAtTime(1000, audioContext.currentTime + 0.1);
            oscillator.frequency.setValueAtTime(1200, audioContext.currentTime + 0.2);
            
            gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
            
            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + 0.5);
            
        } catch (error) {
            console.error('Error playing beep sound:', error);
        }
    }
}

// Initialize the task manager when the page loads
let taskManager;
document.addEventListener('DOMContentLoaded', () => {
    taskManager = new TaskManager();
});

// Listen for audio playback requests from main process
ipcRenderer.on('play-audio', (event, data) => {
    console.log('Received audio play request:', data);
    if (taskManager) {
        taskManager.playInternalAudio(data.filePath, data.volume);
    }
});

// Listen for stop audio requests from main process
ipcRenderer.on('stop-audio', (event) => {
    console.log('Received stop audio request');
    if (taskManager) {
        taskManager.stopCurrentAudio();
    }
});
