/* js/app.js — To-Do Life Dashboard application logic */

/* ─── Storage Keys ─────────────────────────────────────────────────────────── */

const STORAGE_KEYS = {
  NAME: 'tld_name',
  THEME: 'tld_theme',
  TASKS: 'tld_tasks',
  QUICK_LINKS: 'tld_quicklinks',
};

/* ─── Storage Module ───────────────────────────────────────────────────────── */

const Storage = {
  /**
   * Serialize `value` to JSON and write it to localStorage under `key`.
   * Silently no-ops if localStorage is unavailable or the write fails
   * (e.g. private browsing mode, storage quota exceeded).
   *
   * @param {string} key
   * @param {*} value
   */
  save(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (_e) {
      // localStorage unavailable or quota exceeded — continue in-memory
    }
  },

  /**
   * Read the value stored under `key` from localStorage, parse it as JSON,
   * and return it. Returns `fallback` if the key is absent, localStorage is
   * unavailable, or the stored string is not valid JSON.
   *
   * @param {string} key
   * @param {*} fallback
   * @returns {*}
   */
  load(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      if (raw === null) return fallback;
      return JSON.parse(raw);
    } catch (_e) {
      return fallback;
    }
  },
};

/* ─── AppState ─────────────────────────────────────────────────────────────── */

/**
 * Central in-memory state object. All functions read from and write to this
 * object. It is the single source of truth for the application.
 */
const AppState = {
  /** @type {string} User's display name */
  name: "",

  /** @type {"light"|"dark"} Active theme */
  theme: "dark",

  /** @type {Array<{id: number, description: string, completed: boolean, createdAt: number}>} */
  tasks: [],

  /** @type {Array<{id: number, label: string, url: string}>} */
  quickLinks: [],

  /** @type {"all"|"active"|"completed"} Current task filter mode */
  filter: "all",

  timer: {
    /** @type {number} Seconds remaining (25 * 60 = 1500) */
    remaining: 1500,

    /** @type {boolean} Whether the timer is actively counting down */
    running: false,

    /** @type {number|null} setInterval handle, or null when not running */
    intervalId: null,
  },
};

/* ─── Theme Controller ─────────────────────────────────────────────────────── */

/**
 * Apply `theme` to the UI by setting the `data-theme` attribute on the
 * `<html>` element, then persist the choice to localStorage.
 *
 * @param {"light"|"dark"} theme
 */
function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  AppState.theme = theme;
  Storage.save(STORAGE_KEYS.THEME, theme);
}

/**
 * Toggle the current theme between "light" and "dark".
 * Delegates to `applyTheme` so the attribute update and persistence
 * always go through a single code path.
 */
function toggleTheme() {
  const next = AppState.theme === "dark" ? "light" : "dark";
  applyTheme(next);
}

/* ─── Name Prompt ──────────────────────────────────────────────────────────── */

/**
 * Show a browser prompt asking the user for their name on first visit.
 * Only fires when no name is stored yet. Stores and applies the result
 * immediately so the greeting is personalised from the first render.
 *
 * Requirements: 2.6, 2.7
 */
function promptForName() {
  if (AppState.name.trim().length > 0) return; // already have a name

  const entered = window.prompt("Welcome to Life Dashboard!\n\nWhat's your name?", "");
  if (entered !== null) {
    // null means the user pressed Cancel — leave name as empty ("Friend")
    const trimmed = entered.trim();
    if (trimmed.length > 0) {
      AppState.name = trimmed;
      Storage.save(STORAGE_KEYS.NAME, trimmed);

      // Pre-fill the name input in the panel so it reflects the prompted value.
      const nameInput = document.getElementById("name-input");
      if (nameInput) nameInput.value = trimmed;
    }
  }
}

/* ─── Settings Modal ───────────────────────────────────────────────────────── */

/**
 * Open the settings modal, set aria-expanded on the trigger, and trap focus
 * inside the panel. The first focusable element (name input) receives focus.
 */
function openSettings() {
  const modal   = document.getElementById("settings-modal");
  const trigger = document.getElementById("settings-toggle");
  if (!modal) return;

  modal.hidden = false;
  if (trigger) trigger.setAttribute("aria-expanded", "true");

  // Focus the name input so the user can start typing immediately.
  const nameInput = document.getElementById("name-input");
  if (nameInput) nameInput.focus();
}

/**
 * Close the settings modal and return focus to the gear button.
 */
function closeSettings() {
  const modal   = document.getElementById("settings-modal");
  const trigger = document.getElementById("settings-toggle");
  if (!modal) return;

  modal.hidden = true;
  if (trigger) {
    trigger.setAttribute("aria-expanded", "false");
    trigger.focus();
  }
}

/**
 * Initialise the settings modal: wire the gear button, close button,
 * backdrop click, and Escape key.
 */
function initSettings() {
  const trigger  = document.getElementById("settings-toggle");
  const closeBtn = document.getElementById("settings-close");
  const backdrop = document.getElementById("settings-backdrop");
  const modal    = document.getElementById("settings-modal");

  if (trigger)  trigger.addEventListener("click", openSettings);
  if (closeBtn) closeBtn.addEventListener("click", closeSettings);
  if (backdrop) backdrop.addEventListener("click", closeSettings);

  // Close on Escape key when modal is open.
  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape" && modal && !modal.hidden) {
      closeSettings();
    }
  });
}

/* ─── Greeting Controller ──────────────────────────────────────────────────── */


/**
 * Pure function — maps an hour value (0–23) to the appropriate time-of-day
 * greeting prefix.
 *
 * | Hour range  | Prefix           |
 * |-------------|------------------|
 * | 05 – 11     | "Good Morning"   |
 * | 12 – 17     | "Good Afternoon" |
 * | 18 – 21     | "Good Evening"   |
 * | 22 – 23, 0–4| "Good Night"     |
 *
 * Requirements: 2.1, 2.2, 2.3, 2.4
 *
 * @param {number} hour — integer in the range 0–23
 * @returns {string}
 */
function getGreetingPrefix(hour) {
  if (hour >= 5 && hour <= 11) return "Good Morning";
  if (hour >= 12 && hour <= 17) return "Good Afternoon";
  if (hour >= 18 && hour <= 21) return "Good Evening";
  return "Good Night"; // 22–23 and 0–4
}

/**
 * Read the current time, format the clock and date strings, build the full
 * greeting message, and push all three values into the DOM.
 *
 * - Clock:   HH:MM:SS (zero-padded)
 * - Date:    e.g. "Monday, July 14, 2025"
 * - Greeting: e.g. "Good Morning, Alex!" / "Good Night, Friend!"
 *
 * Requirements: 1.1, 1.2, 2.1–2.6
 */
function updateGreeting() {
  const now = new Date();

  // ── Clock (HH:MM:SS) ──────────────────────────────────────────────────────
  const hh = String(now.getHours()).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");
  const ss = String(now.getSeconds()).padStart(2, "0");
  const clockStr = `${hh}:${mm}:${ss}`;

  // ── Human-readable date ───────────────────────────────────────────────────
  const dateStr = now.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  // ── Greeting message ──────────────────────────────────────────────────────
  const trimmedName = AppState.name.trim();
  const displayName = trimmedName.length > 0 ? trimmedName : "Friend";
  const prefix = getGreetingPrefix(now.getHours());
  const greetingStr = `${prefix}, ${displayName}!`;

  // ── DOM updates ───────────────────────────────────────────────────────────
  const clockEl = document.getElementById("clock-display");
  const dateEl = document.getElementById("date-display");
  const greetingEl = document.getElementById("greeting-message");

  if (clockEl) clockEl.textContent = clockStr;
  if (dateEl) dateEl.textContent = dateStr;
  if (greetingEl) greetingEl.textContent = greetingStr;
}

/**
 * Trim and store the user's name, persist it to localStorage, then
 * immediately re-render the greeting.
 *
 * Requirements: 2.6, 2.7
 *
 * @param {string} name — raw value from the name input field
 */
function setName(name) {
  const trimmed = name.trim();
  AppState.name = trimmed;
  Storage.save(STORAGE_KEYS.NAME, trimmed);
  updateGreeting();
}

/**
 * Bootstrap the Greeting panel: render immediately, then schedule a
 * 1-second interval so the clock stays live.
 *
 * Requirements: 1.1, 1.3
 */
function initGreeting() {
  updateGreeting();
  setInterval(updateGreeting, 1000);
}

/* ─── Focus Timer ──────────────────────────────────────────────────────────── */

/**
 * Format a number of seconds as a MM:SS string (zero-padded).
 *
 * @param {number} totalSeconds
 * @returns {string}
 */
function formatTime(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

/**
 * Update the timer display element with the current remaining time.
 *
 * Requirements: 3.1, 3.3
 */
function updateTimerDisplay() {
  const timerDisplay = document.getElementById("timer-display");
  if (timerDisplay) {
    timerDisplay.textContent = formatTime(AppState.timer.remaining);
  }
}

/**
 * Enable/disable the Start and Stop buttons based on the current running state.
 * - Start is disabled while the timer is running (prevents duplicate intervals).
 * - Stop is disabled while the timer is paused or reset.
 *
 * Requirements: 3.7, 3.8
 */
function updateTimerControls() {
  const startBtn = document.getElementById("timer-start");
  const stopBtn = document.getElementById("timer-stop");

  if (startBtn) {
    startBtn.disabled = AppState.timer.running;
  }
  if (stopBtn) {
    stopBtn.disabled = !AppState.timer.running;
  }
}

/**
 * Show a visual notification and optionally play an audible beep when the
 * timer reaches 00:00.
 *
 * Requirements: 3.6
 */
function notifyTimerEnd() {
  // Show the pre-existing notification element in the DOM.
  const notification = document.getElementById("timer-notification");
  if (notification) {
    notification.hidden = false;
  }

  // Optionally play a short beep via the Web Audio API.
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (AudioContext) {
      const ctx = new AudioContext();
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);

      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(880, ctx.currentTime); // A5 note
      gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.0);

      oscillator.start(ctx.currentTime);
      oscillator.stop(ctx.currentTime + 1.0);
    }
  } catch (_e) {
    // Web Audio API unavailable — visual notification is sufficient.
  }
}

/**
 * Called every second by the timer interval. Decrements remaining by 1.
 * If remaining reaches 0, stops the timer and triggers the end notification.
 * Otherwise updates the display.
 *
 * Requirements: 3.2, 3.3, 3.6
 */
function onTimerTick() {
  AppState.timer.remaining -= 1;

  if (AppState.timer.remaining <= 0) {
    AppState.timer.remaining = 0;
    updateTimerDisplay();
    stopTimer();
    notifyTimerEnd();
  } else {
    updateTimerDisplay();
  }
}

/**
 * Start the countdown. If the timer is already running, this is a no-op.
 * Sets running=true, starts a 1-second interval, and updates the controls.
 *
 * Requirements: 3.2, 3.7
 */
function startTimer() {
  if (AppState.timer.running) return;

  // Hide any previous end notification when restarting.
  const notification = document.getElementById("timer-notification");
  if (notification) {
    notification.hidden = true;
  }

  AppState.timer.running = true;
  AppState.timer.intervalId = setInterval(onTimerTick, 1000);
  updateTimerControls();
}

/**
 * Pause the countdown. Clears the interval, sets running=false, and updates
 * the controls. The remaining time is preserved.
 *
 * Requirements: 3.4, 3.8
 */
function stopTimer() {
  clearInterval(AppState.timer.intervalId);
  AppState.timer.running = false;
  AppState.timer.intervalId = null;
  updateTimerControls();
}

/**
 * Stop any active countdown and reset remaining time to 25:00 (1500 s).
 * Updates both the display and the controls.
 *
 * Requirements: 3.5
 */
function resetTimer() {
  stopTimer();
  AppState.timer.remaining = 1500;

  // Hide any end notification on reset.
  const notification = document.getElementById("timer-notification");
  if (notification) {
    notification.hidden = true;
  }

  updateTimerDisplay();
  updateTimerControls();
}

/**
 * Initialise the Focus Timer: set state to defaults, render the display and
 * controls, and wire the Start / Stop / Reset button click handlers.
 *
 * Requirements: 3.1, 3.7, 3.8
 */
function initTimer() {
  AppState.timer.remaining = 1500;
  AppState.timer.running = false;
  AppState.timer.intervalId = null;

  updateTimerDisplay();
  updateTimerControls();

  // Wire button event listeners.
  const startBtn = document.getElementById("timer-start");
  const stopBtn = document.getElementById("timer-stop");
  const resetBtn = document.getElementById("timer-reset");

  if (startBtn) startBtn.addEventListener("click", startTimer);
  if (stopBtn) stopBtn.addEventListener("click", stopTimer);
  if (resetBtn) resetBtn.addEventListener("click", resetTimer);
}

/* ─── Timer Initialisation ─────────────────────────────────────────────────── */
// Timer is initialised inside init() — see bottom of file.

/* ─── Task List ────────────────────────────────────────────────────────────── */

/**
 * Return the subset of tasks that match the current filter mode.
 *
 * - "all"       → all tasks in insertion order
 * - "active"    → only tasks where completed === false
 * - "completed" → only tasks where completed === true
 *
 * Requirements: 5.2, 5.3, 5.4
 *
 * @returns {Array<{id: number, description: string, completed: boolean, createdAt: number}>}
 */
function getFilteredTasks() {
  switch (AppState.filter) {
    case "active":
      return AppState.tasks.filter(function (t) { return !t.completed; });
    case "completed":
      return AppState.tasks.filter(function (t) { return t.completed; });
    default: // "all"
      return AppState.tasks.slice();
  }
}

/**
 * Update the visual active state of the filter buttons to reflect
 * the current AppState.filter value.
 *
 * The active button receives the `btn--filter-active` class and
 * `aria-pressed="true"`; all others have those removed/set to false.
 *
 * Requirements: 5.1, 5.5
 */
function updateFilterButtons() {
  const modes = ["all", "active", "completed"];
  modes.forEach(function (mode) {
    const btn = document.getElementById("filter-" + mode);
    if (!btn) return;
    const isActive = AppState.filter === mode;
    btn.classList.toggle("btn--filter-active", isActive);
    btn.setAttribute("aria-pressed", isActive ? "true" : "false");
  });
}

/**
 * Set the current task filter mode, then re-render the task list and
 * update the filter button visual state.
 *
 * Requirements: 5.1, 5.5
 *
 * @param {"all"|"active"|"completed"} mode
 */
function setFilter(mode) {
  AppState.filter = mode;
  updateFilterButtons();
  renderTasks();
}

/**
 * Fully re-render the task list DOM from the current AppState.
 * Uses event delegation on the list container for complete/edit/delete actions.
 *
 * Requirements: 4.1, 4.3, 4.7, 5.2, 5.3, 5.4
 */
function renderTasks() {
  const taskList = document.getElementById("task-list");
  const taskEmpty = document.getElementById("task-empty");
  if (!taskList) return;

  const filtered = getFilteredTasks();

  // Clear existing items.
  taskList.innerHTML = "";

  if (filtered.length === 0) {
    if (taskEmpty) taskEmpty.hidden = false;
    return;
  }

  if (taskEmpty) taskEmpty.hidden = true;

  filtered.forEach(function (task) {
    const li = document.createElement("li");
    li.className = "task-item" + (task.completed ? " task-item--completed" : "");
    li.dataset.taskId = task.id;

    // Checkbox / complete toggle button
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.className = "task-item__checkbox";
    checkbox.checked = task.completed;
    checkbox.setAttribute("aria-label", "Mark task " + (task.completed ? "incomplete" : "complete"));
    checkbox.dataset.action = "toggle";
    checkbox.dataset.taskId = task.id;

    // Description text
    const span = document.createElement("span");
    span.className = "task-item__text";
    span.textContent = task.description;

    // Action buttons container
    const actions = document.createElement("div");
    actions.className = "task-item__actions";

    // Edit button
    const editBtn = document.createElement("button");
    editBtn.type = "button";
    editBtn.className = "btn btn--sm btn--ghost";
    editBtn.textContent = "Edit";
    editBtn.setAttribute("aria-label", "Edit task");
    editBtn.dataset.action = "edit";
    editBtn.dataset.taskId = task.id;

    // Delete button
    const deleteBtn = document.createElement("button");
    deleteBtn.type = "button";
    deleteBtn.className = "btn btn--sm btn--danger";
    deleteBtn.textContent = "Delete";
    deleteBtn.setAttribute("aria-label", "Delete task");
    deleteBtn.dataset.action = "delete";
    deleteBtn.dataset.taskId = task.id;

    actions.appendChild(editBtn);
    actions.appendChild(deleteBtn);

    li.appendChild(checkbox);
    li.appendChild(span);
    li.appendChild(actions);

    taskList.appendChild(li);
  });
}

/**
 * Add a new task with the given description.
 * Trims the input; if blank after trim, shows the inline validation message
 * and returns false. Otherwise creates a Task object, appends it to
 * AppState.tasks, persists, re-renders, and returns true.
 *
 * Requirements: 4.1, 4.2, 4.8
 *
 * @param {string} description
 * @returns {boolean}
 */
function addTask(description) {
  const trimmed = (description || "").trim();
  const validationEl = document.getElementById("task-validation");

  if (trimmed.length === 0) {
    if (validationEl) validationEl.hidden = false;
    return false;
  }

  // Hide any previous validation message on success.
  if (validationEl) validationEl.hidden = true;

  const now = Date.now();
  const task = {
    id: now,
    description: trimmed,
    completed: false,
    createdAt: now,
  };

  AppState.tasks.push(task);
  Storage.save(STORAGE_KEYS.TASKS, AppState.tasks);
  renderTasks();
  return true;
}

/**
 * Delete the task with the given id from AppState.tasks, persist, and re-render.
 *
 * Requirements: 4.7, 4.8
 *
 * @param {number} id
 */
function deleteTask(id) {
  AppState.tasks = AppState.tasks.filter(function (t) { return t.id !== id; });
  Storage.save(STORAGE_KEYS.TASKS, AppState.tasks);
  renderTasks();
}

/**
 * Toggle the completed state of the task with the given id, persist, and re-render.
 *
 * Requirements: 4.3, 4.8
 *
 * @param {number} id
 */
function toggleTask(id) {
  const task = AppState.tasks.find(function (t) { return t.id === id; });
  if (!task) return;
  task.completed = !task.completed;
  Storage.save(STORAGE_KEYS.TASKS, AppState.tasks);
  renderTasks();
}

/**
 * Switch a task item into inline-edit mode.
 *
 * Finds the rendered `<li>` for the given task id, replaces the description
 * `<span>` with a text `<input>` pre-populated with the current description,
 * and swaps the Edit button for Save and Cancel buttons. The input is focused
 * automatically so the user can start typing immediately.
 *
 * Pressing Enter in the input confirms the edit; pressing Escape cancels it.
 *
 * Requirements: 4.4
 *
 * @param {number} id
 */
function beginEditTask(id) {
  const task = AppState.tasks.find(function (t) { return t.id === id; });
  if (!task) return;

  const taskList = document.getElementById("task-list");
  if (!taskList) return;

  // Find the rendered list item for this task.
  const li = taskList.querySelector('[data-task-id="' + id + '"]');
  if (!li) return;

  // Replace the description span with an editable input.
  const span = li.querySelector(".task-item__text");
  if (!span) return;

  const input = document.createElement("input");
  input.type = "text";
  input.className = "task-item__edit-input";
  input.value = task.description;
  input.maxLength = 200;
  input.setAttribute("aria-label", "Edit task description");

  li.replaceChild(input, span);

  // Replace the actions container with Save + Cancel buttons.
  const actions = li.querySelector(".task-item__actions");
  if (actions) {
    actions.innerHTML = "";

    const saveBtn = document.createElement("button");
    saveBtn.type = "button";
    saveBtn.className = "btn btn--sm btn--primary";
    saveBtn.textContent = "Save";
    saveBtn.setAttribute("aria-label", "Save task edit");
    saveBtn.dataset.action = "save-edit";
    saveBtn.dataset.taskId = id;

    const cancelBtn = document.createElement("button");
    cancelBtn.type = "button";
    cancelBtn.className = "btn btn--sm btn--ghost";
    cancelBtn.textContent = "Cancel";
    cancelBtn.setAttribute("aria-label", "Cancel task edit");
    cancelBtn.dataset.action = "cancel-edit";
    cancelBtn.dataset.taskId = id;

    actions.appendChild(saveBtn);
    actions.appendChild(cancelBtn);

    // Always show the action buttons while in edit mode.
    actions.style.opacity = "1";
  }

  // Keyboard shortcuts: Enter to confirm, Escape to cancel.
  input.addEventListener("keydown", function (event) {
    if (event.key === "Enter") {
      event.preventDefault();
      confirmEditTask(id, input.value);
    } else if (event.key === "Escape") {
      event.preventDefault();
      renderTasks();
    }
  });

  // Focus the input so the user can start typing immediately.
  input.focus();
  // Place cursor at end of existing text.
  input.setSelectionRange(input.value.length, input.value.length);
}

/**
 * Confirm an inline edit for the task with the given id.
 *
 * Trims `newDescription`. If blank after trimming, shows an inline validation
 * message on the edit input and returns false without mutating state.
 * Otherwise updates the task's description in AppState, persists to Storage,
 * calls renderTasks() to restore the normal view, and returns true.
 *
 * Requirements: 4.5, 4.6
 *
 * @param {number} id
 * @param {string} newDescription
 * @returns {boolean}
 */
function confirmEditTask(id, newDescription) {
  const trimmed = (newDescription || "").trim();

  if (trimmed.length === 0) {
    // Show inline validation on the edit input if it is still in the DOM.
    const taskList = document.getElementById("task-list");
    if (taskList) {
      const input = taskList.querySelector(
        '[data-task-id="' + id + '"] .task-item__edit-input'
      );
      if (input) {
        input.style.borderColor = "#f87171";
        input.setAttribute("aria-invalid", "true");
        input.setAttribute("aria-describedby", "edit-validation-" + id);

        // Create or update an inline validation message next to the input.
        let msg = taskList.querySelector("#edit-validation-" + id);
        if (!msg) {
          msg = document.createElement("span");
          msg.id = "edit-validation-" + id;
          msg.className = "validation-message";
          msg.setAttribute("role", "alert");
          input.insertAdjacentElement("afterend", msg);
        }
        msg.textContent = "Description cannot be empty.";
        input.focus();
      }
    }
    return false;
  }

  const task = AppState.tasks.find(function (t) { return t.id === id; });
  if (!task) return false;

  task.description = trimmed;
  Storage.save(STORAGE_KEYS.TASKS, AppState.tasks);
  renderTasks();
  return true;
}

/* ─── Task List Initialisation ─────────────────────────────────────────────── */
// Task list is initialised inside init() — see bottom of file.

/* ─── Quick Links ──────────────────────────────────────────────────────────── */

/**
 * Fully re-render the quick links list DOM from the current AppState.
 * Uses event delegation on the container for open and delete actions.
 *
 * Requirements: 6.1, 6.3, 6.4
 */
function renderQuickLinks() {
  const container = document.getElementById("quicklinks-container");
  const emptyEl = document.getElementById("quicklinks-empty");
  if (!container) return;

  // Clear existing items.
  container.innerHTML = "";

  if (AppState.quickLinks.length === 0) {
    if (emptyEl) emptyEl.hidden = false;
    return;
  }

  if (emptyEl) emptyEl.hidden = true;

  AppState.quickLinks.forEach(function (link) {
    // Wrapper div — acts as the list item.
    const item = document.createElement("div");
    item.className = "quicklink-item";
    item.setAttribute("role", "listitem");
    item.dataset.linkId = link.id;

    // The clickable label button that opens the URL.
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "quicklink-item__btn";
    btn.textContent = link.label;
    btn.setAttribute("aria-label", "Open " + link.label);
    btn.dataset.action = "open";
    btn.dataset.linkId = link.id;
    btn.dataset.url = link.url;

    // Delete button.
    const deleteBtn = document.createElement("button");
    deleteBtn.type = "button";
    deleteBtn.className = "quicklink-item__delete";
    deleteBtn.textContent = "✕";
    deleteBtn.setAttribute("aria-label", "Delete " + link.label + " quick link");
    deleteBtn.dataset.action = "delete";
    deleteBtn.dataset.linkId = link.id;

    item.appendChild(btn);
    item.appendChild(deleteBtn);
    container.appendChild(item);
  });
}

/**
 * Open the given URL in a new browser tab.
 * If the browser's popup blocker prevents it, the browser's native UI
 * will inform the user — no additional handling is required.
 *
 * Requirements: 6.3
 *
 * @param {string} url
 */
function openQuickLink(url) {
  window.open(url, "_blank");
}

/**
 * Remove the quick link with the given id from AppState.quickLinks,
 * persist the updated list to localStorage, and re-render.
 *
 * Requirements: 6.4, 6.5
 *
 * @param {number} id
 */
function deleteQuickLink(id) {
  AppState.quickLinks = AppState.quickLinks.filter(function (link) {
    return link.id !== id;
  });
  Storage.save(STORAGE_KEYS.QUICK_LINKS, AppState.quickLinks);
  renderQuickLinks();
}

/**
 * Add a new quick link with the given label and URL.
 *
 * Trims both fields. If either is empty after trimming, or if the URL fails
 * validation via the `URL` constructor, shows the inline validation message
 * and returns false. Otherwise creates a QuickLink object, appends it to
 * AppState.quickLinks, persists to localStorage, calls renderQuickLinks(),
 * and returns true.
 *
 * Requirements: 6.1, 6.2, 6.5
 *
 * @param {string} label
 * @param {string} url
 * @returns {boolean}
 */
function addQuickLink(label, url) {
  const trimmedLabel = (label || "").trim();
  const trimmedUrl = (url || "").trim();
  const validationEl = document.getElementById("quicklink-validation");

  // Validate: both fields must be non-empty and URL must parse successfully.
  let isValid = true;

  if (trimmedLabel.length === 0 || trimmedUrl.length === 0) {
    isValid = false;
  } else {
    try {
      new URL(trimmedUrl); // throws if URL is malformed
    } catch (_e) {
      isValid = false;
    }
  }

  if (!isValid) {
    if (validationEl) validationEl.hidden = false;
    return false;
  }

  // Hide any previous validation message on success.
  if (validationEl) validationEl.hidden = true;

  const link = {
    id: Date.now(),
    label: trimmedLabel,
    url: trimmedUrl,
  };

  AppState.quickLinks.push(link);
  Storage.save(STORAGE_KEYS.QUICK_LINKS, AppState.quickLinks);
  renderQuickLinks();
  return true;
}

/* ─── Quick Links Initialisation ───────────────────────────────────────────── */
// Quick links are initialised inside init() — see bottom of file.

/* ─── Application Entry Point ──────────────────────────────────────────────── */

/**
 * Top-level initialisation function. Loads all persisted state from
 * localStorage, applies the saved theme, and wires every panel's event
 * handlers before handing control to the live-update loops.
 *
 * Called once on DOMContentLoaded.
 *
 * Requirements: 1.3, 2.7, 3.1, 4.9, 6.6, 7.4, 9.3
 */
function init() {
  // ── 1. Load all state from localStorage ────────────────────────────────────
  AppState.name       = Storage.load(STORAGE_KEYS.NAME,        "");
  AppState.tasks      = Storage.load(STORAGE_KEYS.TASKS,       []);
  AppState.quickLinks = Storage.load(STORAGE_KEYS.QUICK_LINKS, []);

  // ── 2. Theme ────────────────────────────────────────────────────────────────
  applyTheme(Storage.load(STORAGE_KEYS.THEME, "dark"));

  const themeToggleBtn = document.getElementById("theme-toggle");
  if (themeToggleBtn) {
    themeToggleBtn.addEventListener("click", toggleTheme);
  }

  // ── 3. Settings modal ───────────────────────────────────────────────────────
  initSettings();

  // ── 4. Greeting / Name ──────────────────────────────────────────────────────
  // Prompt for name on first visit (before initGreeting so the clock renders
  // with the correct name from the very first tick).
  promptForName();

  const nameInput = document.getElementById("name-input");
  const nameForm  = document.getElementById("name-form");

  // Pre-fill the name input with the stored value.
  if (nameInput) {
    nameInput.value = AppState.name;
  }

  if (nameForm && nameInput) {
    nameForm.addEventListener("submit", function (event) {
      event.preventDefault();
      setName(nameInput.value);
      closeSettings(); // close the modal after saving
    });
  }

  // Start the live clock / greeting interval.
  initGreeting();

  // ── 5. Focus Timer ──────────────────────────────────────────────────────────
  initTimer();

  // ── 6. Task List ────────────────────────────────────────────────────────────
  // Initialise filter state and sync button visual state.
  AppState.filter = "all";
  updateFilterButtons();

  // Wire filter button click handlers.
  ["all", "active", "completed"].forEach(function (mode) {
    const btn = document.getElementById("filter-" + mode);
    if (btn) {
      btn.addEventListener("click", function () {
        setFilter(mode);
      });
    }
  });

  // Initial task render.
  renderTasks();

  // Wire the task form submit handler.
  const taskForm  = document.getElementById("task-form");
  const taskInput = document.getElementById("task-input");
  if (taskForm && taskInput) {
    taskForm.addEventListener("submit", function (event) {
      event.preventDefault();
      const success = addTask(taskInput.value);
      if (success) {
        taskInput.value = "";
      }
    });
  }

  // Event delegation on the task list for toggle / edit / delete actions.
  const taskList = document.getElementById("task-list");
  if (taskList) {
    taskList.addEventListener("change", function (event) {
      const target = event.target;
      if (target.dataset.action === "toggle") {
        toggleTask(Number(target.dataset.taskId));
      }
    });

    taskList.addEventListener("click", function (event) {
      const target = event.target.closest("[data-action]");
      if (!target) return;

      const action = target.dataset.action;
      const id     = Number(target.dataset.taskId);

      if (action === "delete") {
        deleteTask(id);
      } else if (action === "edit") {
        beginEditTask(id);
      } else if (action === "save-edit") {
        const editInput = taskList.querySelector(
          '[data-task-id="' + id + '"] .task-item__edit-input'
        );
        if (editInput) {
          confirmEditTask(id, editInput.value);
        }
      } else if (action === "cancel-edit") {
        renderTasks();
      }
    });
  }

  // ── 7. Quick Links ──────────────────────────────────────────────────────────
  // Initial quick links render.
  renderQuickLinks();

  // Wire the quick-link form submit handler.
  const quickLinkForm = document.getElementById("quicklink-form");
  const labelInput    = document.getElementById("quicklink-label-input");
  const urlInput      = document.getElementById("quicklink-url-input");

  if (quickLinkForm && labelInput && urlInput) {
    quickLinkForm.addEventListener("submit", function (event) {
      event.preventDefault();
      const success = addQuickLink(labelInput.value, urlInput.value);
      if (success) {
        labelInput.value = "";
        urlInput.value   = "";
      }
    });
  }

  // Event delegation on the quick links container for open / delete actions.
  const quickLinksContainer = document.getElementById("quicklinks-container");
  if (quickLinksContainer) {
    quickLinksContainer.addEventListener("click", function (event) {
      const target = event.target.closest("[data-action]");
      if (!target) return;

      const action = target.dataset.action;
      const id     = Number(target.dataset.linkId);

      if (action === "open") {
        openQuickLink(target.dataset.url);
      } else if (action === "delete") {
        deleteQuickLink(id);
      }
    });
  }
}

// Bootstrap the application once the DOM is fully parsed.
document.addEventListener("DOMContentLoaded", init);
