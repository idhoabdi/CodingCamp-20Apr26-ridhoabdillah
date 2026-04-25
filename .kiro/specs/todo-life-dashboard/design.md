# Design Document: To-Do Life Dashboard

## Overview

The To-Do Life Dashboard is a self-contained, client-side web application delivered as a single HTML file (`index.html`) with one CSS file (`css/style.css`) and one JavaScript file (`js/app.js`). It requires no build tooling, no backend, and no external dependencies — it opens directly from the file system via the `file://` protocol.

The application combines four functional panels in a single viewport:

1. **Greeting Panel** — real-time clock, date, and a time-of-day greeting personalized with the user's name.
2. **Focus Timer** — a 25-minute Pomodoro countdown with start, stop, and reset controls.
3. **Task List** — full CRUD task management with filter/sort controls (All / Active / Completed).
4. **Quick Links Panel** — user-defined shortcut buttons that open URLs in new tabs.

All state (tasks, quick links, user name, theme preference) is persisted to `localStorage`. The UI uses a glassmorphism aesthetic with a navy / purple / yellow three-tone palette and supports Light and Dark themes.

---

## Architecture

The application follows a simple **Model → View → Controller (MVC-lite)** pattern implemented entirely in vanilla JavaScript. There are no reactive frameworks; the DOM is updated imperatively in response to user events and timer ticks.

```
┌─────────────────────────────────────────────────────────────┐
│                        index.html                           │
│  ┌──────────────┐   ┌──────────────┐   ┌────────────────┐  │
│  │  css/style.css│   │  js/app.js   │   │  localStorage  │  │
│  │  (all styles) │   │  (all logic) │   │  (persistence) │  │
│  └──────────────┘   └──────┬───────┘   └────────┬───────┘  │
│                             │                    │           │
│                    ┌────────▼────────────────────▼───────┐  │
│                    │           AppState (in-memory)       │  │
│                    │  tasks[], quickLinks[], name,        │  │
│                    │  theme, timerState, filterMode       │  │
│                    └────────────────┬────────────────────┘  │
│                                     │                        │
│                    ┌────────────────▼────────────────────┐  │
│                    │           DOM Rendering              │  │
│                    │  renderTasks(), renderQuickLinks(),  │  │
│                    │  renderGreeting(), renderTimer()     │  │
│                    └─────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### Key Architectural Decisions

- **No framework**: Keeps the file count to three (HTML, CSS, JS) and eliminates any build step or CDN dependency, satisfying the `file://` protocol requirement.
- **Single source of truth**: All mutable state lives in one `AppState` object. Every user action mutates `AppState`, persists to `localStorage`, then re-renders the affected DOM section.
- **Immutable IDs**: Tasks and quick links are assigned a `Date.now()` timestamp ID at creation time. This avoids index-based identity bugs when items are deleted.
- **CSS custom properties for theming**: Light and Dark themes are implemented by toggling a `data-theme` attribute on `<html>`. All color values are CSS variables, so a single attribute swap repaints the entire UI.

---

## Components and Interfaces

### 1. AppState

The central in-memory state object. All functions read from and write to this object.

```js
const AppState = {
  name: "",            // string — user's display name
  theme: "dark",       // "light" | "dark"
  tasks: [],           // Task[]
  quickLinks: [],      // QuickLink[]
  filter: "all",       // "all" | "active" | "completed"
  timer: {
    remaining: 1500,   // seconds remaining (25 * 60)
    running: false,    // boolean
    intervalId: null,  // number | null — setInterval handle
  },
};
```

### 2. Storage Module

Thin wrapper around `localStorage` with JSON serialization and error handling.

```js
// Public interface
Storage.save(key, value)   // serializes value to JSON and writes to localStorage
Storage.load(key, fallback) // reads and parses; returns fallback on error or absence
```

Keys used:
| Key | Value type | Default |
|-----|-----------|---------|
| `tld_name` | string | `""` |
| `tld_theme` | `"light"` \| `"dark"` | `"dark"` |
| `tld_tasks` | `Task[]` | `[]` |
| `tld_quicklinks` | `QuickLink[]` | `[]` |

### 3. Greeting Panel Component

Responsible for the clock, date, and greeting message.

```js
// Called once on load; sets up a 1-second interval
initGreeting()

// Called every second by the interval
updateGreeting()

// Called when the user submits the name form
setName(name: string)
```

Greeting logic:
| Hour range | Message prefix |
|-----------|---------------|
| 05:00 – 11:59 | "Good Morning" |
| 12:00 – 17:59 | "Good Afternoon" |
| 18:00 – 21:59 | "Good Evening" |
| 22:00 – 04:59 | "Good Night" |

### 4. Focus Timer Component

```js
initTimer()          // restores timer display to 25:00
startTimer()         // begins setInterval countdown
stopTimer()          // clears interval, retains remaining time
resetTimer()         // clears interval, resets remaining to 1500
onTimerTick()        // decrements remaining; calls notifyTimerEnd() at 0
notifyTimerEnd()     // shows visual notification; optionally plays Audio API beep
updateTimerDisplay() // formats remaining seconds as MM:SS and updates DOM
updateTimerControls()// enables/disables Start/Stop buttons based on running state
```

### 5. Task List Component

```js
addTask(description: string): boolean   // returns false if blank
toggleTask(id: number)
beginEditTask(id: number)
confirmEditTask(id: number, newDescription: string): boolean
deleteTask(id: number)
setFilter(mode: "all" | "active" | "completed")
renderTasks()                           // full re-render of task list DOM
getFilteredTasks(): Task[]              // returns tasks matching current filter
```

### 6. Quick Links Component

```js
addQuickLink(label: string, url: string): boolean  // returns false if blank/invalid
deleteQuickLink(id: number)
openQuickLink(url: string)                          // window.open(url, "_blank")
renderQuickLinks()
```

### 7. Theme Controller

```js
applyTheme(theme: "light" | "dark")  // sets data-theme on <html>, saves to storage
toggleTheme()                         // flips current theme
```

---

## Data Models

### Task

```js
{
  id: number,           // Date.now() at creation — unique identifier
  description: string,  // non-empty task text
  completed: boolean,   // false by default
  createdAt: number,    // Date.now() at creation — used for stable sort order
}
```

### QuickLink

```js
{
  id: number,    // Date.now() at creation
  label: string, // display text on the button
  url: string,   // target URL (validated to be non-empty; opened with window.open)
}
```

### TimerState (in-memory only, not persisted)

```js
{
  remaining: number,   // seconds remaining, 0–1500
  running: boolean,
  intervalId: number | null,
}
```

### localStorage Schema

All keys are prefixed with `tld_` to avoid collisions with other apps on the same origin.

```
tld_name       → JSON string
tld_theme      → JSON string ("light" | "dark")
tld_tasks      → JSON array of Task objects
tld_quicklinks → JSON array of QuickLink objects
```

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Greeting reflects time of day for all hours

*For any* hour value in 0–23, the greeting prefix returned by the greeting logic function SHALL match the correct time-of-day bucket: hours 5–11 → "Good Morning", hours 12–17 → "Good Afternoon", hours 18–21 → "Good Evening", hours 22–23 and 0–4 → "Good Night".

**Validates: Requirements 2.1, 2.2, 2.3, 2.4**

---

### Property 2: Greeting uses stored name or "Friend" fallback

*For any* name string (including the empty string and whitespace-only strings), the greeting message SHALL contain that name verbatim if it is non-empty after trimming, or "Friend" if it is empty or whitespace-only.

**Validates: Requirements 2.5, 2.6**

---

### Property 3: Task addition round-trip

*For any* non-empty task description string, adding it to the task list and then serializing/deserializing the task list to/from JSON SHALL produce a task list that contains exactly one task with the same description and `completed: false`.

**Validates: Requirements 4.1, 4.8, 4.9**

---

### Property 4: Whitespace task descriptions are rejected

*For any* string composed entirely of whitespace characters (spaces, tabs, newlines), attempting to add it as a task description SHALL be rejected and the task list SHALL remain unchanged in length and content.

**Validates: Requirements 4.2**

---

### Property 5: Task completion toggle is an involution

*For any* task with any initial `completed` value, toggling its completion state twice SHALL return it to its original `completed` value, and all other task fields SHALL remain unchanged.

**Validates: Requirements 4.3**

---

### Property 6: Valid edit updates description, preserves other fields

*For any* task and any non-empty replacement description, confirming the edit SHALL update the task's `description` to the new value while leaving `id`, `completed`, and `createdAt` unchanged.

**Validates: Requirements 4.5**

---

### Property 7: Whitespace edit description is rejected

*For any* task and any whitespace-only replacement description, confirming the edit SHALL be rejected and the task's `description` SHALL remain unchanged.

**Validates: Requirements 4.6**

---

### Property 8: "All" filter preserves all tasks in insertion order

*For any* task list, applying the "All" filter SHALL return all tasks in the same order they appear in the backing array, with no tasks omitted.

**Validates: Requirements 5.2**

---

### Property 9: "Active" filter returns only incomplete tasks

*For any* task list with any mix of completed and incomplete tasks, applying the "Active" filter SHALL return only tasks where `completed === false`, and every incomplete task in the original list SHALL appear in the result.

**Validates: Requirements 5.3**

---

### Property 10: "Completed" filter returns only complete tasks

*For any* task list with any mix of completed and incomplete tasks, applying the "Completed" filter SHALL return only tasks where `completed === true`, and every complete task in the original list SHALL appear in the result.

**Validates: Requirements 5.4**

---

### Property 11: localStorage round-trip preserves data

*For any* array of Task objects or QuickLink objects, serializing to JSON via `Storage.save` and deserializing back via `Storage.load` SHALL produce an array that is deeply equal to the original.

**Validates: Requirements 9.2, 9.3**

---

### Property 12: localStorage parse error falls back to default

*For any* string that is not valid JSON stored under a known key, calling `Storage.load(key, fallback)` SHALL return the fallback value without throwing an exception.

**Validates: Requirements 9.4**

---

### Property 13: Quick link addition round-trip

*For any* non-empty label string and non-empty URL string, adding a quick link and then serializing/deserializing the quick links list SHALL produce a list containing a quick link with the same label and URL.

**Validates: Requirements 6.1, 6.5, 6.6**

---

### Property 14: Timer countdown is monotonically decreasing and bounded

*For any* starting `remaining` value in 1–1500, applying N timer ticks (where N ≤ remaining) SHALL decrease `remaining` by exactly N, and `remaining` SHALL never go below 0 regardless of how many ticks are applied.

**Validates: Requirements 3.2, 3.3, 3.6**

---

### Property 15: Timer reset always restores initial state

*For any* timer state (any `remaining` value in 0–1500, `running` either true or false), calling reset SHALL set `remaining` to exactly 1500 and `running` to false.

**Validates: Requirements 3.5**

---

## Error Handling

| Scenario | Handling |
|----------|----------|
| `localStorage` unavailable (private browsing, quota exceeded) | `Storage.save` catches the exception and silently no-ops; `Storage.load` returns the provided fallback. The app continues to function in-memory for the session. |
| `localStorage` value is not valid JSON | `JSON.parse` is wrapped in try/catch; the fallback value is returned. |
| Task/QuickLink add with empty/whitespace input | Input is trimmed; if empty after trim, the submission is rejected and an inline validation message is shown. No state mutation occurs. |
| Edit confirmed with empty/whitespace description | Same as above — rejected, original description retained. |
| Timer reaches 00:00 | `onTimerTick` detects `remaining === 0`, clears the interval, sets `running = false`, and triggers `notifyTimerEnd()`. |
| `window.open` blocked by browser popup blocker | The call is made; if blocked, the browser's native UI informs the user. No additional handling is required. |
| Invalid URL in quick link | The URL field is validated to be non-empty before saving. Full URL validation (protocol check) is a best-effort `URL` constructor parse; malformed URLs are rejected with an inline message. |

---

## Testing Strategy

### Overview

Because this is a pure vanilla JavaScript application with no build tooling, tests are written as standalone scripts that can be run in Node.js (for pure logic) or in a browser (for DOM-dependent behavior). The recommended property-based testing library is **[fast-check](https://github.com/dubzzz/fast-check)** (available as a single UMD bundle with no build step required).

### Unit Tests (Example-Based)

Focus on concrete scenarios and edge cases:

- Clock display formats `HH:MM:SS` correctly for midnight, noon, single-digit values.
- Date display produces a human-readable string.
- Greeting prefix is correct at boundary hours (05:00, 12:00, 18:00, 22:00, 04:59).
- Adding a task with a valid description increases the list length by 1.
- Adding a task with only spaces is rejected.
- Toggling a task flips `completed`.
- Deleting a task removes it from the list.
- Filter "All" returns all tasks; "Active" returns only incomplete; "Completed" returns only complete.
- `Storage.load` returns the fallback when the key is absent.
- `Storage.load` returns the fallback when the stored value is malformed JSON.
- Timer starts at 1500 seconds; each tick decrements by 1; stops at 0.
- Timer reset returns to 1500 regardless of current state.

### Property-Based Tests

Using **fast-check** with a minimum of **100 iterations** per property. Each test is tagged with a comment in the format:

```
// Feature: todo-life-dashboard, Property N: <property text>
```

| Property | Description | fast-check arbitraries |
|----------|-------------|----------------------|
| P1 | Greeting reflects time of day for all hours | `fc.integer({ min: 0, max: 23 })` |
| P2 | Greeting uses stored name or "Friend" fallback | `fc.string()` |
| P3 | Task addition round-trip | `fc.string({ minLength: 1 })` (trimmed non-empty) |
| P4 | Whitespace task descriptions rejected | `fc.stringOf(fc.constantFrom(' ', '\t', '\n'), { minLength: 1 })` |
| P5 | Task completion toggle is an involution | `fc.record({ completed: fc.boolean() })` |
| P6 | Valid edit updates description, preserves other fields | `fc.record({ desc: fc.string({ minLength: 1 }), newDesc: fc.string({ minLength: 1 }) })` |
| P7 | Whitespace edit description is rejected | `fc.stringOf(fc.constantFrom(' ', '\t', '\n'), { minLength: 1 })` |
| P8 | "All" filter preserves all tasks in insertion order | `fc.array(taskArbitrary)` |
| P9 | "Active" filter returns only incomplete tasks | `fc.array(fc.record({ completed: fc.boolean() }))` |
| P10 | "Completed" filter returns only complete tasks | `fc.array(fc.record({ completed: fc.boolean() }))` |
| P11 | localStorage round-trip preserves data | `fc.array(taskArbitrary)` |
| P12 | localStorage parse error falls back to default | `fc.string()` (arbitrary non-JSON strings) |
| P13 | Quick link addition round-trip | `fc.record({ label: fc.string({ minLength: 1 }), url: fc.webUrl() })` |
| P14 | Timer countdown is monotonically decreasing and bounded | `fc.integer({ min: 1, max: 1500 })` |
| P15 | Timer reset always restores initial state | `fc.record({ remaining: fc.integer({ min: 0, max: 1500 }), running: fc.boolean() })` |

### Integration / Smoke Tests

- Open `index.html` in Chrome, Firefox, Edge, and Safari via `file://` — verify no console errors on load.
- Verify `localStorage` keys are written after each user action.
- Verify theme toggle applies `data-theme` attribute and persists across page reload.
- Verify tasks and quick links survive a page reload.

### Accessibility

- Verify color contrast ratios meet WCAG AA (4.5:1 for normal text, 3:1 for large text) using a browser DevTools audit or axe-core.
- Verify all interactive controls are keyboard-accessible (Tab, Enter, Space).
- Note: full WCAG compliance requires manual testing with assistive technologies and expert review.
