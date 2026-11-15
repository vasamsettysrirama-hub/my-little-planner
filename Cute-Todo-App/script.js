/* ==========================================
   MY LITTLE PLANNER 🌷
   VERSION 15
   Core tasks, themes, activity history,
   calendar, reminders and task notes.
   ========================================== */

"use strict";

/* ---------- STORAGE ---------- */

const STORAGE = {
  tasks: "cuteTodoTasks",
  theme: "plannerTheme",
  mode: "plannerMode",
  notes: "plannerPersonalNotes",
  goals: "plannerDailyGoals",
  habits: "plannerHabits",
  sticky: "plannerStickyNotes",
  focusSessions: "plannerFocusSessions",
  activity: "plannerActivityHistory"
};

function readStorage(key, fallback) {
  try {
    const value = localStorage.getItem(key);
    return value === null ? fallback : JSON.parse(value);
  } catch (error) {
    console.warn("Could not read storage:", key, error);
    return fallback;
  }
}

function writeStorage(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (error) {
    console.error("Could not save:", key, error);
    return false;
  }
}

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, character => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[character]);
}

function makeId() {
  return window.crypto?.randomUUID?.() ||
    "task-" + Date.now() + "-" + Math.random().toString(16).slice(2);
}

function todayString() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function validDateString(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);

  return date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day;
}

function $(id) {
  return document.getElementById(id);
}

/* ---------- APPLICATION DATA ---------- */

function normalizeTask(task) {
  if (!task || typeof task !== "object" || Array.isArray(task)) {
    return null;
  }

  const title = String(task.title || "").trim().slice(0, 100);
  if (!title) return null;

  const subtasks = Array.isArray(task.subtasks)
    ? task.subtasks.slice(0, 50).map(item => {
        if (typeof item === "string") {
          return { text: item.slice(0, 150), completed: false };
        }

        return {
          text: String(item?.text || "").slice(0, 150),
          completed: Boolean(item?.completed)
        };
      }).filter(item => item.text)
    : [];

  return {
    id: String(task.id || makeId()),
    title,
    description: String(task.description || "").slice(0, 1000),
    notes: String(task.notes || "").slice(0, 3000),
    date: validDateString(task.date) ? task.date : "",
    time: /^\d{2}:\d{2}$/.test(task.time || "") ? task.time : "",
    priority: ["Low", "Medium", "High"].includes(task.priority)
      ? task.priority : "Medium",
    category: ["Study", "College", "Personal", "Work", "Other"].includes(task.category)
      ? task.category : "Other",
    repeat: ["none", "daily", "weekly"].includes(task.repeat)
      ? task.repeat : "none",
    alarmTone: ["bell", "chime", "digital"].includes(task.alarmTone)
      ? task.alarmTone : "bell",
    tags: Array.isArray(task.tags)
      ? task.tags.slice(0, 20).map(tag => String(tag).slice(0, 30))
      : [],
    subtasks,
    completed: Boolean(task.completed),
    archived: Boolean(task.archived),
    completedAt: task.completedAt || null,
    createdAt: task.createdAt || new Date().toISOString(),
    reminded: Boolean(task.reminded)
  };
}

let tasks = readStorage(STORAGE.tasks, []);
if (!Array.isArray(tasks)) tasks = [];
tasks = tasks.map(normalizeTask).filter(Boolean);

let activityHistory = readStorage(STORAGE.activity, []);
if (!Array.isArray(activityHistory)) activityHistory = [];
activityHistory = activityHistory
  .filter(item => item && typeof item.message === "string")
  .slice(0, 100);

let editingTaskId = null;
let selectedDate = todayString();
let calendarDate = new Date();
let weekOffset = 0;
let activeFocusTaskId = null;
let focusStartedAt = null;
let focusInterval = null;
let alarmInterval = null;
let currentAlarmTask = null;
let undoDeleteTask = null;
let undoDeleteTimeout = null;

/* ---------- ACTIVITY HISTORY ---------- */

function logActivity(message, emoji = "✨") {
  activityHistory.unshift({
    id: makeId(),
    message: String(message).slice(0, 200),
    emoji,
    time: new Date().toISOString()
  });

  activityHistory = activityHistory.slice(0, 100);
  writeStorage(STORAGE.activity, activityHistory);
  renderActivity();
}

function renderActivity() {
  const list = $("activityList");
  if (!list) return;

  if (!activityHistory.length) {
    list.innerHTML = '<li class="activity-empty">Your planner activity will appear here. 🌷</li>';
    return;
  }

  list.innerHTML = activityHistory.slice(0, 15).map(item => {
    const date = new Date(item.time);
    const timeText = Number.isNaN(date.getTime())
      ? ""
      : date.toLocaleString([], {
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit"
        });

    return `
      <li>
        <span>${escapeHTML(item.emoji || "✨")}</span>
        <span>${escapeHTML(item.message)}</span>
        <time class="activity-time">${escapeHTML(timeText)}</time>
      </li>
    `;
  }).join("");
}

$("clearActivity")?.addEventListener("click", () => {
  if (!activityHistory.length) return;

  if (confirm("Clear your activity history? This will not delete your tasks.")) {
    activityHistory = [];
    writeStorage(STORAGE.activity, activityHistory);
    renderActivity();
  }
});

/* ---------- THEMES ---------- */

function applyTheme() {
  const theme = localStorage.getItem(STORAGE.theme) || "pink";
  const mode = localStorage.getItem(STORAGE.mode) || "light";

  document.documentElement.dataset.theme =
    ["pink", "lavender", "blue", "mint"].includes(theme) ? theme : "pink";

  document.documentElement.dataset.mode =
    mode === "dark" ? "dark" : "light";

  if ($("themeModeButton")) {
    $("themeModeButton").textContent =
      mode === "dark" ? "☀️" : "🌙";
  }
}

document.querySelectorAll("[data-theme-choice]").forEach(button => {
  button.addEventListener("click", () => {
    localStorage.setItem(STORAGE.theme, button.dataset.themeChoice);
    applyTheme();
  });
});

$("themeModeButton")?.addEventListener("click", () => {
  const current = localStorage.getItem(STORAGE.mode) || "light";
  localStorage.setItem(STORAGE.mode, current === "dark" ? "light" : "dark");
  applyTheme();
});

applyTheme();

/* ---------- CLOCK ---------- */

function updateClock() {
  const now = new Date();

  if ($("clock")) {
    $("clock").textContent = now.toLocaleTimeString();
  }

  if ($("todayDate")) {
    $("todayDate").textContent = now.toLocaleDateString([], {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric"
    });
  }
}

updateClock();
setInterval(updateClock, 1000);

/* ---------- TASK STORAGE ---------- */

function saveTasks() {
  const success = writeStorage(STORAGE.tasks, tasks);

  if (!success && $("backupStatus")) {
    $("backupStatus").textContent =
      "Storage is full. Export a backup and remove some data.";
  }

  return success;
}

/* ---------- TASK HELPERS ---------- */

function formatDate(dateString) {
  if (!validDateString(dateString)) return "No date";

  return new Date(dateString + "T00:00:00").toLocaleDateString([], {
    day: "numeric",
    month: "short",
    year: "numeric"
  });
}

function isOverdue(task) {
  return Boolean(
    task.date &&
    !task.completed &&
    !task.archived &&
    task.date < todayString()
  );
}

function getPriorityValue(priority) {
  return { High: 3, Medium: 2, Low: 1 }[priority] || 0;
}

function getVisibleTasks() {
  const filter = $("filterTasks")?.value || "all";
  const search = ($("searchTasks")?.value || "").toLowerCase().trim();
  const sort = $("sortTasks")?.value || "date";

  let result = tasks.filter(task => {
    if (filter === "archived" && !task.archived) return false;
    if (filter !== "archived" && task.archived) return false;
    if (filter === "pending" && task.completed) return false;
    if (filter === "completed" && !task.completed) return false;

    const searchable = [
      task.title,
      task.description,
      task.category,
      ...(task.tags || [])
    ].join(" ").toLowerCase();

    return searchable.includes(search);
  });

  result.sort((a, b) => {
    if (sort === "priority") {
      return getPriorityValue(b.priority) - getPriorityValue(a.priority);
    }

    if (sort === "category") {
      return a.category.localeCompare(b.category);
    }

    return (a.date || "9999-12-31").localeCompare(
      b.date || "9999-12-31"
    ) || (a.time || "").localeCompare(b.time || "");
  });

  return result;
}

/* ---------- TASK RENDERING ---------- */

function renderTasks() {
  const list = $("taskList");
  if (!list) return;

  const visibleTasks = getVisibleTasks();

  $("emptyTasks").classList.toggle("hidden", visibleTasks.length > 0);

  list.innerHTML = visibleTasks.map(task => {
    const tags = (task.tags || []).map(tag =>
      `<span class="tag">#${escapeHTML(tag)}</span>`
    ).join("");

    const subtasks = (task.subtasks || []).map((subtask, index) => `
      <label>
        <input
          type="checkbox"
          data-action="subtask"
          data-id="${escapeHTML(task.id)}"
          data-index="${index}"
          ${subtask.completed ? "checked" : ""}
        >
        <span>${escapeHTML(subtask.text)}</span>
      </label>
    `).join("");

    const taskDateTime = [
      task.date ? formatDate(task.date) : "",
      task.time || ""
    ].filter(Boolean).join(" · ");

    return `
      <article class="task-card
        ${task.completed ? "completed" : ""}
        ${task.archived ? "archived" : ""}"
        data-task-id="${escapeHTML(task.id)}">

        <div class="task-top">
          <div>
            <div class="task-title">${escapeHTML(task.title)}</div>
            <p class="task-description">${escapeHTML(task.description)}</p>
          </div>
          <span class="pill priority-${task.priority.toLowerCase()}">
            ${escapeHTML(task.priority)}
          </span>
        </div>

        <div class="task-meta">
          <span class="pill">${escapeHTML(task.category)}</span>
          ${taskDateTime ? `<span class="pill">📅 ${escapeHTML(taskDateTime)}</span>` : ""}
          ${task.repeat !== "none" ? `<span class="pill">🔁 ${escapeHTML(task.repeat)}</span>` : ""}
        </div>

        ${tags ? `<div class="tag-list">${tags}</div>` : ""}

        ${subtasks ? `<div class="subtask-list">${subtasks}</div>` : ""}

        <details class="task-notes">
          <summary>📝 Personal task notes</summary>
          <textarea
            data-action="task-notes"
            data-id="${escapeHTML(task.id)}"
            maxlength="3000"
            placeholder="Write notes for this task..."
          >${escapeHTML(task.notes)}</textarea>
        </details>

        <div class="task-actions">
          ${!task.archived ? `
            <button data-action="complete" data-id="${escapeHTML(task.id)}">
              ${task.completed ? "↩ Undo" : "✓ Complete"}
            </button>
            <button data-action="edit" data-id="${escapeHTML(task.id)}">✏️ Edit</button>
            <button data-action="focus" data-id="${escapeHTML(task.id)}">🎯 Focus</button>
            <button data-action="archive" data-id="${escapeHTML(task.id)}">📦 Archive</button>
          ` : `
            <button data-action="restore" data-id="${escapeHTML(task.id)}">↩ Restore</button>
          `}
          <button data-action="duplicate" data-id="${escapeHTML(task.id)}">📋 Duplicate</button>
          <button data-action="delete" data-id="${escapeHTML(task.id)}">🗑️ Delete</button>
        </div>
      </article>
    `;
  }).join("");
}

/* ---------- TASK COUNTERS ---------- */

function renderStats() {
  const active = tasks.filter(task => !task.archived);
  const completed = active.filter(task => task.completed).length;
  const pending = active.length - completed;
  const rate = active.length ? Math.round(completed / active.length * 100) : 0;

  $("totalTasks").textContent = active.length;
  $("pendingTasks").textContent = pending;
  $("completedTasks").textContent = completed;
  $("completionRate").textContent = rate + "%";

  const overdue = active.filter(isOverdue).length;
  const dueToday = active.filter(task =>
    !task.completed && task.date === todayString()
  ).length;

  const upcoming = active.filter(task =>
    !task.completed && task.date > todayString()
  ).length;

  $("overdueCount").textContent = overdue;
  $("todayCount").textContent = dueToday;
  $("upcomingCount").textContent = upcoming;

  $("progressFill").style.width = rate + "%";
  $("progressText").textContent =
    `${rate}% completed. ${rate === 100 ? "Amazing work! 🎉" : "Keep going! 💗"}`;
}

function renderAll() {
  renderTasks();
  renderStats();
  renderCalendar();
  renderSelectedDateTasks();
  renderWeeklyAgenda();
  renderWeeklyReview();
  renderWeeklyChart();
  renderActivity();
}

/* ---------- TASK FORM ---------- */

function resetTaskForm() {
  $("taskForm").reset();
  editingTaskId = null;
  $("taskSubmit").textContent = "Add task 💗";
  $("cancelEdit").classList.add("hidden");
}

function fillTaskForm(task) {
  editingTaskId = task.id;

  $("taskTitle").value = task.title;
  $("taskDescription").value = task.description;
  $("taskSubtasks").value = task.subtasks.map(item => item.text).join("\n");
  $("taskDate").value = task.date;
  $("taskTime").value = task.time;
  $("taskPriority").value = task.priority;
  $("taskCategory").value = task.category;
  $("taskRepeat").value = task.repeat;
  $("alarmTone").value = task.alarmTone;
  $("taskTags").value = task.tags.join(", ");

  $("taskSubmit").textContent = "Save changes 💗";
  $("cancelEdit").classList.remove("hidden");

  $("taskTitle").focus();
  $("taskForm").scrollIntoView({ behavior: "smooth", block: "center" });
}

$("cancelEdit")?.addEventListener("click", resetTaskForm);

$("taskForm")?.addEventListener("submit", event => {
  event.preventDefault();

  const title = $("taskTitle").value.trim();
  if (!title) {
    alert("Please enter a task title.");
    return;
  }

  const existingTask = editingTaskId ? findTask(editingTaskId) : null;
  const previousSubtasks = existingTask?.subtasks || [];

  const subtasks = $("taskSubtasks").value
    .split("\n")
    .map(text => text.trim())
    .filter(Boolean)
    .slice(0, 50)
    .map(text => {
      const cleanText = text.slice(0, 150);
      const previous = previousSubtasks.find(
        item => item.text.toLowerCase() === cleanText.toLowerCase()
      );
      return { text: cleanText, completed: previous ? previous.completed : false };
    });

  const taskData = {
    title,
    description: $("taskDescription").value.trim(),
    date: $("taskDate").value,
    time: $("taskTime").value,
    priority: $("taskPriority").value,
    category: $("taskCategory").value,
    repeat: $("taskRepeat").value,
    alarmTone: $("alarmTone").value,
    tags: $("taskTags").value.split(",")
      .map(tag => tag.trim())
      .filter(Boolean)
      .slice(0, 20),
    subtasks
  };

  if (taskData.date && !validDateString(taskData.date)) {
    alert("Please choose a valid date.");
    return;
  }

  if (editingTaskId) {
    const task = tasks.find(item => item.id === editingTaskId);
    if (!task) {
      resetTaskForm();
      return;
    }

    const savedNotes = task.notes || "";
    Object.assign(task, taskData);
    task.notes = savedNotes;
    task.reminded = false;
    delete task.snoozeUntil;
    logActivity(`Edited task: ${title}`, "✏️");
  } else {
    tasks.push({
      id: makeId(),
      ...taskData,
      notes: "",
      completed: false,
      archived: false,
      completedAt: null,
      createdAt: new Date().toISOString(),
      reminded: false
    });

    logActivity(`Added task: ${title}`, "🌱");
  }

  saveTasks();
  resetTaskForm();
  renderAll();
});

/* ---------- TASK ACTIONS ---------- */

function findTask(id) {
  return tasks.find(task => task.id === id);
}

function completeTask(id) {
  const task = findTask(id);
  if (!task || task.archived) return;

  task.completed = !task.completed;
  task.completedAt = task.completed ? new Date().toISOString() : null;

  logActivity(
    `${task.completed ? "Completed" : "Reopened"} task: ${task.title}`,
    task.completed ? "🎉" : "↩️"
  );

  if (task.completed) showCelebration();

  saveTasks();
  renderAll();
}

function archiveTask(id) {
  const task = findTask(id);
  if (!task) return;

  task.archived = true;
  logActivity(`Archived task: ${task.title}`, "📦");

  saveTasks();
  renderAll();
}

function restoreTask(id) {
  const task = findTask(id);
  if (!task) return;

  task.archived = false;
  logActivity(`Restored task: ${task.title}`, "↩️");

  saveTasks();
  renderAll();
}

function duplicateTask(id) {
  const task = findTask(id);
  if (!task) return;

  const copy = normalizeTask({
    ...task,
    id: makeId(),
    title: task.title + " (Copy)",
    completed: false,
    archived: false,
    completedAt: null,
    createdAt: new Date().toISOString(),
    reminded: false
  });

  tasks.push(copy);
  logActivity(`Duplicated task: ${task.title}`, "📋");

  saveTasks();
  renderAll();
}

/* ---------- UNDO DELETE ---------- */

function deleteTask(id) {
  const index = tasks.findIndex(task => task.id === id);
  if (index < 0) return;

  const deleted = tasks[index];

  if (!confirm(`Delete "${deleted.title}"? You can undo this for 10 seconds.`)) {
    return;
  }

  tasks.splice(index, 1);

  undoDeleteTask = {
    task: deleted,
    index
  };

  clearTimeout(undoDeleteTimeout);

  $("undoDeleteText").textContent =
    `"${deleted.title}" deleted.`;

  $("undoDeleteBar").classList.remove("hidden");

  undoDeleteTimeout = setTimeout(() => {
    undoDeleteTask = null;
    $("undoDeleteBar").classList.add("hidden");
  }, 10000);

  logActivity(`Deleted task: ${deleted.title}`, "🗑️");

  saveTasks();
  renderAll();
}

$("undoDeleteButton")?.addEventListener("click", () => {
  if (!undoDeleteTask) return;

  const { task, index } = undoDeleteTask;
  tasks.splice(Math.min(index, tasks.length), 0, task);

  undoDeleteTask = null;
  clearTimeout(undoDeleteTimeout);
  $("undoDeleteBar").classList.add("hidden");

  logActivity(`Restored deleted task: ${task.title}`, "↩️");

  saveTasks();
  renderAll();
});

/* ---------- TASK LIST EVENTS ---------- */

$("taskList")?.addEventListener("click", event => {
  const button = event.target.closest("button[data-action]");
  if (!button) return;

  const id = button.dataset.id;
  const action = button.dataset.action;
  const task = findTask(id);

  if (!task && action !== "delete") return;

  if (action === "complete") completeTask(id);
  if (action === "edit") fillTaskForm(task);
  if (action === "archive") archiveTask(id);
  if (action === "restore") restoreTask(id);
  if (action === "duplicate") duplicateTask(id);
  if (action === "delete") deleteTask(id);

  if (action === "focus") {
    activeFocusTaskId = id;
    $("focusTaskName").textContent = task.title;
    $("focusStatus").textContent = "Ready to focus on this task.";
    $("focusStart").disabled = false;
  }
});

$("taskList")?.addEventListener("change", event => {
  const input = event.target;

  if (input.dataset.action !== "subtask") return;

  const task = findTask(input.dataset.id);
  const index = Number(input.dataset.index);

  if (!task || !task.subtasks[index]) return;

  task.subtasks[index].completed = input.checked;
  saveTasks();
});

$("taskList")?.addEventListener("input", event => {
  const input = event.target;

  if (input.dataset.action !== "task-notes") return;

  const task = findTask(input.dataset.id);
  if (!task) return;

  task.notes = input.value.slice(0, 3000);
  saveTasks();
});

$("filterTasks")?.addEventListener("change", renderTasks);
$("sortTasks")?.addEventListener("change", renderTasks);
$("searchTasks")?.addEventListener("input", renderTasks);

/* ---------- TASK TEMPLATES ---------- */

document.querySelectorAll("[data-template]").forEach(button => {
  button.addEventListener("click", () => {
    $("taskTitle").value = button.dataset.template;
    $("taskCategory").value =
      button.dataset.template === "Workout" ? "Personal" : "Study";

    $("taskTitle").focus();
  });
});

/* ---------- CELEBRATION ---------- */

let celebrationTimeout;

function showCelebration() {
  const element = $("celebration");
  if (!element) return;

  element.classList.remove("hidden");
  clearTimeout(celebrationTimeout);

  celebrationTimeout = setTimeout(() => {
    element.classList.add("hidden");
  }, 2500);
}

/* ---------- CALENDAR ---------- */

function moveCalendarMonth(amount) {
  const currentDay = calendarDate.getDate();

  const targetMonth = new Date(
    calendarDate.getFullYear(),
    calendarDate.getMonth() + amount,
    1
  );

  const lastDay = new Date(
    targetMonth.getFullYear(),
    targetMonth.getMonth() + 1,
    0
  ).getDate();

  calendarDate = new Date(
    targetMonth.getFullYear(),
    targetMonth.getMonth(),
    Math.min(currentDay, lastDay)
  );

  renderCalendar();
}

$("prevMonth")?.addEventListener("click", () => moveCalendarMonth(-1));
$("nextMonth")?.addEventListener("click", () => moveCalendarMonth(1));

function renderCalendar() {
  const year = calendarDate.getFullYear();
  const month = calendarDate.getMonth();

  $("monthYear").textContent = calendarDate.toLocaleDateString([], {
    month: "long",
    year: "numeric"
  });

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = todayString();

  let html = "";

  for (let i = 0; i < firstDay; i++) {
    html += `<span></span>`;
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const dateString = [
      year,
      String(month + 1).padStart(2, "0"),
      String(day).padStart(2, "0")
    ].join("-");

    const hasTask = tasks.some(task =>
      task.date === dateString && !task.archived
    );

    const classes = [
      "calendar-day",
      dateString === today ? "today" : "",
      dateString === selectedDate ? "selected" : "",
      hasTask ? "has-task" : ""
    ].filter(Boolean).join(" ");

    html += `
      <button
        type="button"
        class="${classes}"
        data-calendar-date="${dateString}"
        aria-label="${dateString}"
        aria-pressed="${dateString === selectedDate}"
      >${day}</button>
    `;
  }

  $("calendarDays").innerHTML = html;
}

$("calendarDays")?.addEventListener("click", event => {
  const button = event.target.closest("[data-calendar-date]");
  if (!button) return;

  selectedDate = button.dataset.calendarDate;
  renderCalendar();
  renderSelectedDateTasks();
});

function renderSelectedDateTasks() {
  const container = $("selectedDateTasks");
  if (!container) return;

  $("selectedDateTitle").textContent =
    "Tasks for " + formatDate(selectedDate);

  const selectedTasks = tasks.filter(task =>
    task.date === selectedDate && !task.archived
  );

  if (!selectedTasks.length) {
    container.innerHTML = '<p class="muted">No tasks planned for this date.</p>';
    return;
  }

  container.innerHTML = selectedTasks.map(task => `
    <div class="agenda-task">
      <strong>${escapeHTML(task.title)}</strong>
      <span>${task.completed ? " ✓ Completed" : " · Pending"}</span>
    </div>
  `).join("");
}

$("addForDate")?.addEventListener("click", () => {
  $("taskDate").value = selectedDate;
  $("taskTitle").focus();
  $("taskForm").scrollIntoView({ behavior: "smooth", block: "center" });
});

/* ---------- WEEKLY AGENDA ---------- */

function getWeekStart(date) {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  result.setDate(result.getDate() - result.getDay());
  return result;
}

function renderWeeklyAgenda() {
  const container = $("weeklyAgenda");
  if (!container) return;

  const base = getWeekStart(new Date());
  base.setDate(base.getDate() + weekOffset * 7);

  const end = new Date(base);
  end.setDate(end.getDate() + 6);

  $("weekRange").textContent =
    base.toLocaleDateString([], { day: "numeric", month: "short" }) +
    " – " +
    end.toLocaleDateString([], { day: "numeric", month: "short" });

  let html = "";

  for (let i = 0; i < 7; i++) {
    const day = new Date(base);
    day.setDate(base.getDate() + i);

    const dateString = [
      day.getFullYear(),
      String(day.getMonth() + 1).padStart(2, "0"),
      String(day.getDate()).padStart(2, "0")
    ].join("-");

    const dayTasks = tasks.filter(task =>
      task.date === dateString && !task.archived
    );

    html += `
      <div class="agenda-day">
        <strong>${day.toLocaleDateString([], {
          weekday: "long",
          day: "numeric",
          month: "short"
        })}</strong>
        ${
          dayTasks.length
            ? dayTasks.map(task => `
                <div class="agenda-task">
                  ${task.completed ? "✓ " : ""}
                  ${escapeHTML(task.title)}
                </div>
              `).join("")
            : '<p class="muted">Nothing planned 🌷</p>'
        }
      </div>
    `;
  }

  container.innerHTML = html;
}

$("previousWeek")?.addEventListener("click", () => {
  weekOffset--;
  renderWeeklyAgenda();
});

$("nextWeek")?.addEventListener("click", () => {
  weekOffset++;
  renderWeeklyAgenda();
});

/* ---------- WEEKLY REVIEW ---------- */

function renderWeeklyReview() {
  const start = getWeekStart(new Date());
  const end = new Date(start);
  end.setDate(end.getDate() + 7);

  const completedThisWeek = tasks.filter(task => {
    if (!task.completedAt) return false;

    const completedDate = new Date(task.completedAt);
    return completedDate >= start && completedDate < end;
  }).length;

  const pendingThisWeek = tasks.filter(task => {
    if (!task.date || task.archived || task.completed) return false;

    const date = new Date(task.date + "T00:00:00");
    return date >= start && date < end;
  }).length;

  const overdue = tasks.filter(isOverdue).length;

  $("weekCompleted").textContent = completedThisWeek;
  $("weekPending").textContent = pendingThisWeek;
  $("weekOverdue").textContent = overdue;

  $("weeklyReviewMessage").textContent =
    completedThisWeek > 0
      ? `You completed ${completedThisWeek} task(s) this week. Keep shining! ✨`
      : "A fresh week is a fresh opportunity. Start with one small task! 🌱";
}

/* ---------- DAILY GOALS ---------- */

let dailyGoals = readStorage(STORAGE.goals, []);
if (!Array.isArray(dailyGoals)) dailyGoals = [];

dailyGoals = dailyGoals
  .filter(goal => goal && typeof goal === "object")
  .map(goal => ({
    id: String(goal.id || makeId()),
    text: String(goal.text || "").slice(0, 100),
    date: validDateString(goal.date) ? goal.date : todayString(),
    completed: Boolean(goal.completed)
  }))
  .filter(goal => goal.text);

function saveGoals() {
  writeStorage(STORAGE.goals, dailyGoals);
}

function renderGoals() {
  const todayGoals = dailyGoals.filter(goal => goal.date === todayString());
  const completed = todayGoals.filter(goal => goal.completed).length;

  $("goalDateLabel").textContent =
    "Your goals for " + formatDate(todayString());

  $("goalProgressText").textContent =
    `${completed} of ${todayGoals.length} goals completed`;

  const percentage = todayGoals.length
    ? completed / todayGoals.length * 100
    : 0;

  $("goalProgressFill").style.width = percentage + "%";

  $("goalList").innerHTML = todayGoals.length
    ? todayGoals.map(goal => `
        <div class="goal-item">
          <label>
            <input
              type="checkbox"
              data-goal-toggle="${escapeHTML(goal.id)}"
              ${goal.completed ? "checked" : ""}
            >
            <span>${escapeHTML(goal.text)}</span>
          </label>
          <button
            type="button"
            class="text-button"
            data-goal-delete="${escapeHTML(goal.id)}"
          >✕</button>
        </div>
      `).join("")
    : '<p class="muted">Add a small goal to get started 🌻</p>';
}

$("goalForm")?.addEventListener("submit", event => {
  event.preventDefault();

  const text = $("goalInput").value.trim();
  if (!text) return;

  dailyGoals.push({
    id: makeId(),
    text: text.slice(0, 100),
    date: todayString(),
    completed: false
  });

  $("goalInput").value = "";
  saveGoals();
  renderGoals();
});

$("goalList")?.addEventListener("change", event => {
  const id = event.target.dataset.goalToggle;
  if (!id) return;

  const goal = dailyGoals.find(item => item.id === id);
  if (!goal) return;

  goal.completed = event.target.checked;
  saveGoals();
  renderGoals();
});

$("goalList")?.addEventListener("click", event => {
  const button = event.target.closest("[data-goal-delete]");
  if (!button) return;

  dailyGoals = dailyGoals.filter(goal =>
    goal.id !== button.dataset.goalDelete
  );

  saveGoals();
  renderGoals();
});

/* ---------- HABIT TRACKER ---------- */

let habits = readStorage(STORAGE.habits, []);
if (!Array.isArray(habits)) habits = [];

habits = habits
  .filter(habit => habit && typeof habit === "object")
  .map(habit => ({
    id: String(habit.id || makeId()),
    name: String(habit.name || "").slice(0, 80),
    history: Array.isArray(habit.history)
      ? habit.history.filter(validDateString)
      : []
  }))
  .filter(habit => habit.name);

function saveHabits() {
  writeStorage(STORAGE.habits, habits);
}

function calculateStreak(habit) {
  const dates = [...new Set(habit.history)].sort().reverse();

  let streak = 0;
  let current = new Date(todayString() + "T00:00:00");

  if (dates[0] !== todayString()) {
    current.setDate(current.getDate() - 1);
  }

  for (const date of dates) {
    const expected = [
      current.getFullYear(),
      String(current.getMonth() + 1).padStart(2, "0"),
      String(current.getDate()).padStart(2, "0")
    ].join("-");

    if (date !== expected) break;

    streak++;
    current.setDate(current.getDate() - 1);
  }

  return streak;
}

function renderHabits() {
  $("habitList").innerHTML = habits.length
    ? habits.map(habit => {
        const doneToday = habit.history.includes(todayString());
        const streak = calculateStreak(habit);

        return `
          <div class="habit-item">
            <div>
              <strong>${escapeHTML(habit.name)}</strong>
              <div class="habit-streak">🔥 ${streak} day streak</div>
            </div>
            <div>
              <button
                class="secondary-button"
                data-habit-check="${escapeHTML(habit.id)}"
                type="button"
              >${doneToday ? "✓ Done" : "Check in"}</button>
              <button
                class="text-button"
                data-habit-delete="${escapeHTML(habit.id)}"
                type="button"
              >✕</button>
            </div>
          </div>
        `;
      }).join("")
    : '<p class="muted">Your habits will appear here 🌱</p>';
}

$("habitForm")?.addEventListener("submit", event => {
  event.preventDefault();

  const name = $("habitInput").value.trim();
  if (!name) return;

  habits.push({
    id: makeId(),
    name: name.slice(0, 80),
    history: []
  });

  $("habitInput").value = "";
  saveHabits();
  renderHabits();
});

$("habitList")?.addEventListener("click", event => {
  const checkButton = event.target.closest("[data-habit-check]");
  const deleteButton = event.target.closest("[data-habit-delete]");

  if (checkButton) {
    const habit = habits.find(item =>
      item.id === checkButton.dataset.habitCheck
    );

    if (!habit) return;

    if (habit.history.includes(todayString())) {
      habit.history = habit.history.filter(date =>
        date !== todayString()
      );
    } else {
      habit.history.push(todayString());
    }

    saveHabits();
    renderHabits();
  }

  if (deleteButton) {
    habits = habits.filter(habit =>
      habit.id !== deleteButton.dataset.habitDelete
    );

    saveHabits();
    renderHabits();
  }
});

/* ---------- POMODORO TIMER ---------- */

let pomodoroMinutes = 25;
let pomodoroSeconds = 25 * 60;
let pomodoroEndsAt = null;
let pomodoroInterval = null;
let pomodoroRunning = false;
let pomodoroMode = "focus";

let focusSessions = readStorage(STORAGE.focusSessions, []);
if (!Array.isArray(focusSessions)) focusSessions = [];

focusSessions = focusSessions
  .filter(session => session && typeof session === "object")
  .map(session => ({
    date: validDateString(session.date) ? session.date : "",
    minutes: Number(session.minutes),
    completedAt: session.completedAt || null
  }))
  .filter(session =>
    session.date &&
    Number.isFinite(session.minutes) &&
    session.minutes > 0
  );

function saveFocusSessions() {
  writeStorage(STORAGE.focusSessions, focusSessions);
}

function updatePomodoroDisplay() {
  const minutes = Math.floor(pomodoroSeconds / 60);
  const seconds = pomodoroSeconds % 60;

  $("pomodoroDisplay").textContent =
    `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function updatePomodoroStats() {
  const todaySessions = focusSessions.filter(session =>
    session.date === todayString()
  );

  $("pomodoroSessions").textContent = todaySessions.length;

  $("focusMinutesToday").textContent = todaySessions.reduce(
    (total, session) => total + session.minutes,
    0
  );
}

function finishPomodoro() {
  clearInterval(pomodoroInterval);
  pomodoroInterval = null;
  pomodoroRunning = false;
  pomodoroEndsAt = null;
  pomodoroSeconds = 0;

  updatePomodoroDisplay();

  $("pomodoroStatus").textContent =
    pomodoroMode === "focus"
      ? "Focus session complete! Time for a little break. 🎉"
      : "Break complete! Ready to focus again? 🌷";

  if (pomodoroMode === "focus") {
    focusSessions.push({
      date: todayString(),
      minutes: pomodoroMinutes,
      completedAt: new Date().toISOString()
    });

    saveFocusSessions();
    updatePomodoroStats();
    logActivity("Completed a Pomodoro focus session", "🍅");
    showCelebration();
  }

  if ("Notification" in window && Notification.permission === "granted") {
    new Notification("My Little Planner 🌷", {
      body: pomodoroMode === "focus"
        ? "Focus session complete! Take a break."
        : "Your break is over. Let's get back to it!"
    });
  }
}

function tickPomodoro() {
  if (!pomodoroEndsAt) return;

  pomodoroSeconds = Math.max(
    0,
    Math.ceil((pomodoroEndsAt - Date.now()) / 1000)
  );

  updatePomodoroDisplay();

  if (pomodoroSeconds <= 0) {
    finishPomodoro();
  }
}

function startPomodoro() {
  if (pomodoroRunning) return;

  if (pomodoroSeconds <= 0) {
    pomodoroSeconds = pomodoroMinutes * 60;
  }

  pomodoroRunning = true;
  pomodoroEndsAt = Date.now() + pomodoroSeconds * 1000;

  $("pomodoroStatus").textContent =
    pomodoroMode === "focus" ? "Focus time! You've got this. 💗" : "Relax and recharge. 🌿";

  tickPomodoro();

  if (pomodoroRunning) {
    pomodoroInterval = setInterval(tickPomodoro, 250);
  }
}

function pausePomodoro() {
  if (!pomodoroRunning) return;

  tickPomodoro();

  if (!pomodoroRunning) return;

  clearInterval(pomodoroInterval);
  pomodoroInterval = null;
  pomodoroRunning = false;
  pomodoroEndsAt = null;

  $("pomodoroStatus").textContent = "Timer paused.";
}

function resetPomodoro() {
  clearInterval(pomodoroInterval);
  pomodoroInterval = null;
  pomodoroRunning = false;
  pomodoroEndsAt = null;
  pomodoroSeconds = pomodoroMinutes * 60;

  updatePomodoroDisplay();
  $("pomodoroStatus").textContent = "Ready when you are!";
}

document.querySelectorAll(".pomodoro-mode").forEach(button => {
  button.addEventListener("click", () => {
    resetPomodoro();

    pomodoroMinutes = Number(button.dataset.minutes) || 25;
    pomodoroMode = pomodoroMinutes === 25 ? "focus" : "break";
    pomodoroSeconds = pomodoroMinutes * 60;

    document.querySelectorAll(".pomodoro-mode").forEach(item =>
      item.classList.toggle("active", item === button)
    );

    updatePomodoroDisplay();
  });
});

$("pomodoroStart")?.addEventListener("click", startPomodoro);
$("pomodoroPause")?.addEventListener("click", pausePomodoro);
$("pomodoroReset")?.addEventListener("click", resetPomodoro);

document.addEventListener("visibilitychange", () => {
  if (pomodoroRunning) tickPomodoro();
});

/* ---------- TASK FOCUS TIMER ---------- */

$("focusStart")?.addEventListener("click", () => {
  if (!activeFocusTaskId) {
    $("focusStatus").textContent = "Choose a task first.";
    return;
  }

  if (focusInterval) return;

  focusStartedAt = Date.now();

  $("focusStatus").textContent = "You're focusing. Keep going! 🎯";

  focusInterval = setInterval(() => {
    if (!focusStartedAt) return;

    const elapsed = Math.floor((Date.now() - focusStartedAt) / 1000);
    const minutes = Math.floor(elapsed / 60);
    const seconds = elapsed % 60;

    $("focusStatus").textContent =
      `Focus time: ${minutes}m ${seconds}s`;
  }, 1000);
});

$("focusStop")?.addEventListener("click", () => {
  if (focusInterval) {
    clearInterval(focusInterval);
    focusInterval = null;
  }

  if (focusStartedAt) {
    const elapsedMinutes = Math.floor(
      (Date.now() - focusStartedAt) / 60000
    );

    if (elapsedMinutes > 0) {
      logActivity(`Focused for ${elapsedMinutes} minute(s)`, "🎯");
    }
  }

  focusStartedAt = null;
  $("focusStatus").textContent = "Focus session stopped.";
});

/* ---------- PRODUCTIVITY CHART ---------- */

function renderWeeklyChart() {
  const container = $("weeklyChart");
  if (!container) return;

  const days = [];

  for (let i = 6; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);

    const dateString = [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, "0"),
      String(date.getDate()).padStart(2, "0")
    ].join("-");

    const count = tasks.filter(task => {
      if (!task.completedAt) return false;
      return task.completedAt.slice(0, 10) === dateString;
    }).length;

    days.push({
      label: date.toLocaleDateString([], { weekday: "short" }),
      count
    });
  }

  const maximum = Math.max(1, ...days.map(day => day.count));

  container.innerHTML = days.map(day => {
    const height = Math.max(3, day.count / maximum * 100);

    return `
      <div class="chart-column">
        <strong>${day.count}</strong>
        <div class="chart-bar" style="height:${height}%"></div>
        <span>${escapeHTML(day.label)}</span>
      </div>
    `;
  }).join("");

  const total = days.reduce((sum, day) => sum + day.count, 0);

  $("insightText").textContent = total
    ? `You completed ${total} task(s) in the last seven days. Lovely progress! 🌷`
    : "Your completed tasks will appear here. Every little win counts!";
}

/* ---------- PERSONAL NOTES ---------- */

$("personalNotes").value =
  localStorage.getItem(STORAGE.notes) || "";

let notesSaveTimeout;

$("personalNotes")?.addEventListener("input", () => {
  $("notesStatus").textContent = "Saving...";

  clearTimeout(notesSaveTimeout);

  notesSaveTimeout = setTimeout(() => {
    try {
      localStorage.setItem(STORAGE.notes, $("personalNotes").value);
      $("notesStatus").textContent = "Saved automatically 💗";
    } catch (error) {
      $("notesStatus").textContent = "Could not save notes. Storage may be full.";
    }
  }, 400);
});

/* ---------- STICKY NOTES ---------- */

let stickyNotes = readStorage(STORAGE.sticky, []);
if (!Array.isArray(stickyNotes)) stickyNotes = [];

stickyNotes = stickyNotes
  .filter(note => note && typeof note === "object")
  .map(note => ({
    id: String(note.id || makeId()),
    title: String(note.title || "").slice(0, 80),
    content: String(note.content || "").slice(0, 1000),
    color: ["pink", "yellow", "blue", "green"].includes(note.color)
      ? note.color
      : "pink"
  }))
  .filter(note => note.title || note.content);

let editingStickyId = null;

function saveStickyNotes() {
  writeStorage(STORAGE.sticky, stickyNotes);
}

function resetStickyForm() {
  $("stickyForm").reset();
  editingStickyId = null;
  $("stickyCancel").classList.add("hidden");
}

function renderStickyNotes() {
  $("stickyNotesList").innerHTML = stickyNotes.length
    ? stickyNotes.map(note => `
        <article class="sticky-note ${note.color}">
          <button
            type="button"
            data-sticky-delete="${escapeHTML(note.id)}"
            aria-label="Delete note"
          >✕</button>
          <h3>${escapeHTML(note.title)}</h3>
          <p>${escapeHTML(note.content)}</p>
          <button
            type="button"
            data-sticky-edit="${escapeHTML(note.id)}"
            aria-label="Edit note"
          >✏️ Edit</button>
        </article>
      `).join("")
    : '<p class="muted">Your little reminders will appear here 💌</p>';
}

$("stickyForm")?.addEventListener("submit", event => {
  event.preventDefault();

  const title = $("stickyTitle").value.trim();
  const content = $("stickyContent").value.trim();

  if (!title || !content) return;

  const noteData = {
    title: title.slice(0, 80),
    content: content.slice(0, 1000),
    color: $("stickyColor").value
  };

  if (editingStickyId) {
    const note = stickyNotes.find(item => item.id === editingStickyId);
    if (note) Object.assign(note, noteData);
  } else {
    stickyNotes.push({
      id: makeId(),
      ...noteData
    });
  }

  saveStickyNotes();
  resetStickyForm();
  renderStickyNotes();
});

$("stickyCancel")?.addEventListener("click", resetStickyForm);

$("stickyNotesList")?.addEventListener("click", event => {
  const deleteButton = event.target.closest("[data-sticky-delete]");
  const editButton = event.target.closest("[data-sticky-edit]");

  if (deleteButton) {
    stickyNotes = stickyNotes.filter(note =>
      note.id !== deleteButton.dataset.stickyDelete
    );

    saveStickyNotes();
    renderStickyNotes();
  }

  if (editButton) {
    const note = stickyNotes.find(item =>
      item.id === editButton.dataset.stickyEdit
    );

    if (!note) return;

    editingStickyId = note.id;
    $("stickyTitle").value = note.title;
    $("stickyContent").value = note.content;
    $("stickyColor").value = note.color;
    $("stickyCancel").classList.remove("hidden");

    $("stickyForm").scrollIntoView({
      behavior: "smooth",
      block: "center"
    });
  }
});

/* ---------- MOTIVATIONAL QUOTES ---------- */

const quotes = [
  "You don't have to do everything today. Just take one small step. 🌷",
  "Progress is progress, no matter how small. 💗",
  "You are allowed to grow at your own pace. 🌱",
  "A little effort every day adds up to something beautiful. ✨",
  "You can do hard things. Believe in yourself. 🦋",
  "Don't forget to celebrate the tiny victories. 🎀",
  "Your future self will thank you for today's effort. 🌻",
  "Rest when you need to. You are not a machine. ☁️",
  "One task at a time. One day at a time. 💜",
  "You are doing better than you think. 🌸"
];

$("newQuote")?.addEventListener("click", () => {
  const current = $("dailyQuote").textContent;
  let quote = current;

  while (quote === current && quotes.length > 1) {
    quote = quotes[Math.floor(Math.random() * quotes.length)];
  }

  $("dailyQuote").textContent = quote;
});

/* ---------- BROWSER NOTIFICATIONS ---------- */

function updateNotificationStatus(message) {
  if ($("notificationStatus")) {
    $("notificationStatus").textContent = message;
  }
}

$("notificationButton")?.addEventListener("click", async () => {
  if (!("Notification" in window)) {
    updateNotificationStatus(
      "Your browser does not support notifications."
    );
    return;
  }

  try {
    const permission = await Notification.requestPermission();

    if (permission === "granted") {
      updateNotificationStatus("Notifications enabled! 🔔");

      new Notification("My Little Planner 🌷", {
        body: "Your reminders are ready!"
      });
    } else {
      updateNotificationStatus(
        "Notifications are blocked. Check your browser settings."
      );
    }
  } catch (error) {
    updateNotificationStatus("Could not enable notifications.");
  }
});

/* ---------- ALARM SOUND ---------- */

let audioContext = null;

function playAlarmSound(tone = "bell") {
  try {
    const AudioContextClass =
      window.AudioContext || window.webkitAudioContext;

    if (!AudioContextClass) return;

    audioContext = audioContext || new AudioContextClass();

    if (audioContext.state === "suspended") {
      audioContext.resume();
    }

    const patterns = {
      bell: [880, 660, 880],
      chime: [523, 659, 784],
      digital: [1000, 1000, 700]
    };

    const frequencies = patterns[tone] || patterns.bell;

    frequencies.forEach((frequency, index) => {
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();

      const startTime = audioContext.currentTime + index * 0.35;

      oscillator.type = tone === "digital" ? "square" : "sine";
      oscillator.frequency.setValueAtTime(frequency, startTime);

      gain.gain.setValueAtTime(0.0001, startTime);
      gain.gain.exponentialRampToValueAtTime(0.18, startTime + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.25);

      oscillator.connect(gain);
      gain.connect(audioContext.destination);

      oscillator.start(startTime);
      oscillator.stop(startTime + 0.27);
    });
  } catch (error) {
    console.warn("Could not play alarm sound:", error);
  }
}

/* ---------- ALARM DISPLAY ---------- */

function showAlarm(task) {
  if (!task) return;

  currentAlarmTask = task;

  $("alarmTaskTitle").textContent = task.title;
  $("alarmTaskTime").textContent =
    `${formatDate(task.date)} ${task.time || ""}`;

  $("alarmModal").classList.remove("hidden");

  playAlarmSound(task.alarmTone);

  if ("Notification" in window && Notification.permission === "granted") {
    try {
      new Notification("Planner reminder ⏰", {
        body: `It's time for: ${task.title}`
      });
    } catch (error) {
      console.warn("Notification could not be displayed.");
    }
  }
}

/* ---------- ALARM DISMISS ---------- */

function dismissAlarm() {
  $("alarmModal").classList.add("hidden");
  currentAlarmTask = null;
}

$("dismissButton")?.addEventListener("click", dismissAlarm);

/* ---------- SNOOZE ---------- */

$("snoozeButton")?.addEventListener("click", () => {
  if (!currentAlarmTask) return;

  const task = currentAlarmTask;

  task.snoozeUntil = Date.now() + 5 * 60 * 1000;

  saveTasks();
  dismissAlarm();

  logActivity(`Snoozed reminder: ${task.title}`, "😴");
});

/* ---------- REMINDER CHECK ---------- */

function checkReminders() {
  const now = new Date();
  const currentDate = todayString();
  const currentTime = [
    String(now.getHours()).padStart(2, "0"),
    String(now.getMinutes()).padStart(2, "0")
  ].join(":");

  tasks.forEach(task => {
    if (task.completed || task.archived || !task.date || !task.time) {
      return;
    }

    const taskDateTime = new Date(`${task.date}T${task.time}:00`).getTime();

    if (!Number.isFinite(taskDateTime)) return;

    const dueNow = task.date === currentDate &&
      task.time === currentTime &&
      !task.reminded;

    const snoozedDue = Number(task.snoozeUntil) > 0 &&
      Date.now() >= Number(task.snoozeUntil);

    if (dueNow || snoozedDue) {
      task.reminded = true;
      delete task.snoozeUntil;
      saveTasks();
      showAlarm(task);
    }
  });
}

checkReminders();
alarmInterval = setInterval(checkReminders, 15000);

/* ---------- BACKUP EXPORT ---------- */

function exportBackup() {
  const backup = {
    app: "My Little Planner",
    version: 15,
    exportedAt: new Date().toISOString(),
    tasks,
    activityHistory,
    dailyGoals,
    habits,
    stickyNotes,
    focusSessions,
    personalNotes: $("personalNotes").value,
    theme: localStorage.getItem(STORAGE.theme) || "pink",
    mode: localStorage.getItem(STORAGE.mode) || "light"
  };

  const blob = new Blob(
    [JSON.stringify(backup, null, 2)],
    { type: "application/json" }
  );

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = "my-little-planner-v15-backup.json";

  document.body.appendChild(link);
  link.click();
  link.remove();

  URL.revokeObjectURL(url);

  $("backupStatus").textContent = "Backup exported successfully! 💗";
}

$("exportBackup")?.addEventListener("click", exportBackup);

/* ---------- BACKUP IMPORT ---------- */

function validateBackup(backup) {
  if (!backup || typeof backup !== "object" || Array.isArray(backup)) {
    throw new Error("Invalid backup format.");
  }

  if (!Array.isArray(backup.tasks)) {
    throw new Error("Backup does not contain a valid tasks list.");
  }

  if (backup.tasks.length > 10000) {
    throw new Error("Backup contains too many tasks.");
  }

  const importedTasks = backup.tasks
    .map(normalizeTask)
    .filter(Boolean);

  return importedTasks;
}

$("importBackup")?.addEventListener("change", event => {
  const file = event.target.files?.[0];
  if (!file) return;

  if (file.size > 5 * 1024 * 1024) {
    alert("Backup file is too large. Maximum size is 5 MB.");
    event.target.value = "";
    return;
  }

  const reader = new FileReader();

  reader.onload = () => {
    try {
      const backup = JSON.parse(reader.result);
      const importedTasks = validateBackup(backup);

      if (!confirm(
        `Import ${importedTasks.length} tasks? Your current tasks will be replaced.`
      )) {
        event.target.value = "";
        return;
      }

      tasks = importedTasks;

      if (Array.isArray(backup.activityHistory)) {
        activityHistory = backup.activityHistory
          .filter(item =>
            item &&
            typeof item === "object" &&
            typeof item.message === "string"
          )
          .slice(0, 100);
      }

      if (Array.isArray(backup.dailyGoals)) {
        dailyGoals = backup.dailyGoals
          .filter(goal => goal && typeof goal === "object")
          .map(goal => ({
            id: String(goal.id || makeId()),
            text: String(goal.text || "").slice(0, 100),
            date: validDateString(goal.date) ? goal.date : todayString(),
            completed: Boolean(goal.completed)
          }))
          .filter(goal => goal.text);
      }

      if (Array.isArray(backup.habits)) {
        habits = backup.habits
          .filter(habit => habit && typeof habit === "object")
          .map(habit => ({
            id: String(habit.id || makeId()),
            name: String(habit.name || "").slice(0, 80),
            history: Array.isArray(habit.history)
              ? habit.history.filter(validDateString)
              : []
          }))
          .filter(habit => habit.name);
      }

      if (Array.isArray(backup.stickyNotes)) {
        stickyNotes = backup.stickyNotes
          .filter(note => note && typeof note === "object")
          .map(note => ({
            id: String(note.id || makeId()),
            title: String(note.title || "").slice(0, 80),
            content: String(note.content || "").slice(0, 1000),
            color: ["pink", "yellow", "blue", "green"].includes(note.color)
              ? note.color
              : "pink"
          }))
          .filter(note => note.title || note.content);
      }

      if (Array.isArray(backup.focusSessions)) {
        focusSessions = backup.focusSessions
          .filter(session => session && typeof session === "object")
          .map(session => ({
            date: validDateString(session.date) ? session.date : "",
            minutes: Number(session.minutes),
            completedAt: session.completedAt || null
          }))
          .filter(session =>
            session.date &&
            Number.isFinite(session.minutes) &&
            session.minutes > 0
          );
      }

      if (typeof backup.personalNotes === "string") {
        localStorage.setItem(
          STORAGE.notes,
          backup.personalNotes.slice(0, 10000)
        );
      }

      if (["pink", "lavender", "blue", "mint"].includes(backup.theme)) {
        localStorage.setItem(STORAGE.theme, backup.theme);
      }

      if (["light", "dark"].includes(backup.mode)) {
        localStorage.setItem(STORAGE.mode, backup.mode);
      }

      const saved = writeStorage(STORAGE.tasks, tasks) &&
        writeStorage(STORAGE.activity, activityHistory) &&
        writeStorage(STORAGE.goals, dailyGoals) &&
        writeStorage(STORAGE.habits, habits) &&
        writeStorage(STORAGE.sticky, stickyNotes) &&
        writeStorage(STORAGE.focusSessions, focusSessions);

      if (!saved) {
        throw new Error("Some backup data could not be saved.");
      }

      applyTheme();
      renderAll();
      renderGoals();
      renderHabits();
      renderStickyNotes();
      updatePomodoroStats();

      if ($("personalNotes")) {
        $("personalNotes").value =
          localStorage.getItem(STORAGE.notes) || "";
      }

      $("backupStatus").textContent =
        "Backup imported successfully! 🌷";
    } catch (error) {
      console.error("Backup import error:", error);
      alert(
        "Could not import this backup. Please select a valid planner backup."
      );
      $("backupStatus").textContent = "Import failed.";
    }

    event.target.value = "";
  };

  reader.onerror = () => {
    alert("Could not read the selected backup file.");
    event.target.value = "";
  };

  reader.readAsText(file);
});

/* ---------- INITIALIZATION ---------- */

function initializePlanner() {
  applyTheme();

  renderAll();
  renderGoals();
  renderHabits();
  updatePomodoroDisplay();
  updatePomodoroStats();
  renderStickyNotes();

  if ("Notification" in window) {
    if (Notification.permission === "granted") {
      updateNotificationStatus("Notifications are enabled 🔔");
    } else if (Notification.permission === "denied") {
      updateNotificationStatus("Notifications are blocked in your browser.");
    } else {
      updateNotificationStatus("Notifications have not been enabled yet.");
    }
  } else {
    updateNotificationStatus("Browser notifications are not supported.");
  }
}

initializePlanner();

/* ---------- END OF VERSION 15 ---------- *//* ---------- PAGE NAVIGATION ---------- */

const PAGES = ["home", "tasks", "calendar", "focus", "goals", "settings"];
const LAST_PAGE_KEY = "plannerLastPage";

function showPage(name, { updateHash = true, focusPage = true } = {}) {
  if (!PAGES.includes(name)) name = "home";

  document.querySelectorAll(".app-page").forEach(page => {
    page.hidden = page.dataset.page !== name;
  });

  document.querySelectorAll("[data-nav]").forEach(button => {
    const active = button.dataset.nav === name;
    button.classList.toggle("active", active);
    if (active) button.setAttribute("aria-current", "page");
    else button.removeAttribute("aria-current");
  });

  try { localStorage.setItem(LAST_PAGE_KEY, name); } catch (error) {}

  if (updateHash && location.hash !== "#" + name) {
    history.replaceState(null, "", "#" + name);
  }

  // Refresh data that may have changed while the page was hidden
  renderAll();
  renderGoals();
  renderHabits();

  window.scrollTo(0, 0);
  if (focusPage) {
    document.querySelector(`.app-page[data-page="${name}"]`)?.focus({ preventScroll: true });
  }
}

document.querySelectorAll("[data-nav]").forEach(button => {
  button.addEventListener("click", () => showPage(button.dataset.nav));
});

window.addEventListener("hashchange", () => {
  showPage(location.hash.slice(1), { updateHash: false });
});

/* Calendar "Add task for this date": switch to Tasks BEFORE the existing
   handler runs, so the form is visible when it scrolls and focuses. */
document.addEventListener("click", event => {
  if (event.target.closest("#addForDate")) showPage("tasks", { focusPage: false });
}, true);

/* Task "Focus" button: jump to the Focus page */
$("taskList")?.addEventListener("click", event => {
  if (event.target.closest('button[data-action="focus"]')) showPage("focus");
});

function getStartPage() {
  const fromHash = location.hash.slice(1);
  if (PAGES.includes(fromHash)) return fromHash;
  try {
    const saved = localStorage.getItem(LAST_PAGE_KEY);
    if (PAGES.includes(saved)) return saved;
  } catch (error) {}
  return "home";
}