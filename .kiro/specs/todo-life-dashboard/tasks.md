# Implementation Plan: To-Do Life Dashboard

## Overview

Implement a self-contained, client-side web application (`index.html` + `css/style.css` + `js/app.js`) with no build tooling or external dependencies. The app combines a real-time greeting panel, a Pomodoro focus timer, a full-featured task list, and a quick-links panel — all persisted to `localStorage` with a glassmorphism UI supporting Light/Dark themes.

## Tasks

- [ ] 1. Scaffold project structure and HTML skeleton
  - Create `index.html` with semantic HTML5 structure: four panel sections (greeting, timer, task list, quick links), a theme toggle button, and `<link>`/`<script>` tags pointing to `css/style.css` and `js/app.js`
  - Create empty `css/style.css` and `js/app.js` files
  - Add all necessary `id` and `data-*` attributes that JavaScript will target
  - _Requirements: 8.3, 8.4, 10.2, 10.3_

- [ ] 2. Implement CSS styling and theming
  - [ ] 2.1 Define CSS custom properties for the navy/purple/yellow three-tone palette and glassmorphism variables (backdrop-filter, translucent backgrounds) for both `[data-theme="dark"]` (default) and `[data-theme="light"]` on the `<html>` element
    - _Requirements: 7.5, 8.1, 8.2_
  - [ ] 2.2 Implement responsive grid/flex layout covering 320px–2560px viewport widths, panel card styles, typography, and WCAG AA contrast ratios
    - _Requirements: 8.5, 8.6_
  - [ ] 2.3 Add component-level styles: timer display, task list items (including edit/delete/complete controls), quick-link buttons, form inputs, and inline validation messages
    - _Requirements: 3.7, 3.8, 4.2, 4.6, 6.2_

- [ ] 3. Implement Storage module (`js/app.js`)
  - [ ] 3.1 Write `Storage.save(key, value)` and `Storage.load(key, fallback)` with JSON serialization and try/catch error handling; define the four `tld_` key constants
    - _Requirements: 9.1, 9.2, 9.4_
  - [ ]* 3.2 Write property test for localStorage round-trip (Property 11)
    - **Property 11: localStorage round-trip preserves data**
    - **Validates: Requirements 9.2, 9.3**
    - Use `fc.array(taskArbitrary)` and `fc.array(quickLinkArbitrary)`; assert deep equality after `Storage.save` → `Storage.load`
  - [ ]* 3.3 Write property test for localStorage parse error fallback (Property 12)
    - **Property 12: localStorage parse error falls back to default**
    - **Validates: Requirements 9.4**
    - Use `fc.string()` to inject arbitrary non-JSON strings; assert `Storage.load` returns the fallback without throwing

- [ ] 4. Implement AppState and Theme Controller (`js/app.js`)
  - [ ] 4.1 Define the `AppState` object with all fields (`name`, `theme`, `tasks`, `quickLinks`, `filter`, `timer`); implement `applyTheme(theme)` (sets `data-theme` on `<html>`, saves to storage) and `toggleTheme()`
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_
  - [ ] 4.2 Wire the theme toggle button click handler to `toggleTheme()`; on page load, restore theme from `Storage.load("tld_theme", "dark")` and call `applyTheme`
    - _Requirements: 7.4, 7.5_

- [ ] 5. Implement Greeting Panel (`js/app.js`)
  - [ ] 5.1 Implement `getGreetingPrefix(hour)` pure function returning the correct time-of-day string for hours 0–23; implement `updateGreeting()` to format `HH:MM:SS`, the human-readable date, and the full greeting message, then update the DOM; implement `setName(name)` to trim, store, and re-render; implement `initGreeting()` to call `updateGreeting()` immediately and start a 1-second interval
    - _Requirements: 1.1, 1.2, 1.3, 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7_
  - [ ]* 5.2 Write property test for greeting time-of-day mapping (Property 1)
    - **Property 1: Greeting reflects time of day for all hours**
    - **Validates: Requirements 2.1, 2.2, 2.3, 2.4**
    - Use `fc.integer({ min: 0, max: 23 })`; assert `getGreetingPrefix(hour)` returns the correct bucket string
  - [ ]* 5.3 Write property test for greeting name fallback (Property 2)
    - **Property 2: Greeting uses stored name or "Friend" fallback**
    - **Validates: Requirements 2.5, 2.6**
    - Use `fc.string()`; assert greeting contains the trimmed name verbatim or "Friend" when blank/whitespace-only

- [ ] 6. Implement Focus Timer (`js/app.js`)
  - [ ] 6.1 Implement `initTimer()`, `startTimer()`, `stopTimer()`, `resetTimer()`, `onTimerTick()`, `notifyTimerEnd()`, `updateTimerDisplay()`, and `updateTimerControls()`; wire Start/Stop/Reset button click handlers; call `initTimer()` on page load
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8_
  - [ ]* 6.2 Write property test for timer countdown monotonicity and bounds (Property 14)
    - **Property 14: Timer countdown is monotonically decreasing and bounded**
    - **Validates: Requirements 3.2, 3.3, 3.6**
    - Use `fc.integer({ min: 1, max: 1500 })` for starting value and tick count; assert `remaining` decreases by exactly N ticks and never goes below 0
  - [ ]* 6.3 Write property test for timer reset (Property 15)
    - **Property 15: Timer reset always restores initial state**
    - **Validates: Requirements 3.5**
    - Use `fc.record({ remaining: fc.integer({ min: 0, max: 1500 }), running: fc.boolean() })`; assert reset sets `remaining` to 1500 and `running` to false

- [ ] 7. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 8. Implement Task List — core CRUD (`js/app.js`)
  - [ ] 8.1 Implement `addTask(description)`: trim input, reject blank (return `false` + show validation message), otherwise push a new `Task` object (`id: Date.now()`, `completed: false`, `createdAt: Date.now()`), persist, and re-render; implement `deleteTask(id)` and `toggleTask(id)`; implement `renderTasks()` and `getFilteredTasks()`; restore tasks from storage on page load
    - _Requirements: 4.1, 4.2, 4.3, 4.7, 4.8, 4.9_
  - [ ]* 8.2 Write property test for task addition round-trip (Property 3)
    - **Property 3: Task addition round-trip**
    - **Validates: Requirements 4.1, 4.8, 4.9**
    - Use `fc.string({ minLength: 1 })` (trimmed non-empty); assert serialized/deserialized list contains exactly one task with matching description and `completed: false`
  - [ ]* 8.3 Write property test for whitespace task rejection (Property 4)
    - **Property 4: Whitespace task descriptions are rejected**
    - **Validates: Requirements 4.2**
    - Use `fc.stringOf(fc.constantFrom(' ', '\t', '\n'), { minLength: 1 })`; assert `addTask` returns `false` and list length is unchanged
  - [ ]* 8.4 Write property test for task completion toggle involution (Property 5)
    - **Property 5: Task completion toggle is an involution**
    - **Validates: Requirements 4.3**
    - Use `fc.record({ completed: fc.boolean() })`; assert double-toggle restores original `completed` and all other fields are unchanged

- [ ] 9. Implement Task List — edit flow (`js/app.js`)
  - [ ] 9.1 Implement `beginEditTask(id)` (renders an editable input pre-populated with current description) and `confirmEditTask(id, newDescription)` (trims, rejects blank, updates description, persists, re-renders)
    - _Requirements: 4.4, 4.5, 4.6_
  - [ ]* 9.2 Write property test for valid edit preserving other fields (Property 6)
    - **Property 6: Valid edit updates description, preserves other fields**
    - **Validates: Requirements 4.5**
    - Use `fc.record({ desc: fc.string({ minLength: 1 }), newDesc: fc.string({ minLength: 1 }) })`; assert `id`, `completed`, and `createdAt` are unchanged after edit
  - [ ]* 9.3 Write property test for whitespace edit rejection (Property 7)
    - **Property 7: Whitespace edit description is rejected**
    - **Validates: Requirements 4.6**
    - Use `fc.stringOf(fc.constantFrom(' ', '\t', '\n'), { minLength: 1 })`; assert `confirmEditTask` returns `false` and description is unchanged

- [ ] 10. Implement Task List — filter/sort (`js/app.js`)
  - [ ] 10.1 Implement `setFilter(mode)` to update `AppState.filter`, persist if needed, and call `renderTasks()`; wire the filter control buttons; ensure `getFilteredTasks()` correctly handles "all", "active", and "completed" modes
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_
  - [ ]* 10.2 Write property test for "All" filter preserving insertion order (Property 8)
    - **Property 8: "All" filter preserves all tasks in insertion order**
    - **Validates: Requirements 5.2**
    - Use `fc.array(taskArbitrary)`; assert `getFilteredTasks()` with filter "all" returns all tasks in the same order
  - [ ]* 10.3 Write property test for "Active" filter (Property 9)
    - **Property 9: "Active" filter returns only incomplete tasks**
    - **Validates: Requirements 5.3**
    - Use `fc.array(fc.record({ completed: fc.boolean() }))`; assert result contains only `completed === false` tasks and all incomplete tasks are present
  - [ ]* 10.4 Write property test for "Completed" filter (Property 10)
    - **Property 10: "Completed" filter returns only complete tasks**
    - **Validates: Requirements 5.4**
    - Use `fc.array(fc.record({ completed: fc.boolean() }))`; assert result contains only `completed === true` tasks and all complete tasks are present

- [ ] 11. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 12. Implement Quick Links Panel (`js/app.js`)
  - [ ] 12.1 Implement `addQuickLink(label, url)`: trim both fields, validate non-empty and URL format via `URL` constructor, reject invalid input with inline message, otherwise push a new `QuickLink` object, persist, and re-render; implement `deleteQuickLink(id)` and `openQuickLink(url)` (`window.open(url, "_blank")`); implement `renderQuickLinks()`; restore quick links from storage on page load
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6_
  - [ ]* 12.2 Write property test for quick link addition round-trip (Property 13)
    - **Property 13: Quick link addition round-trip**
    - **Validates: Requirements 6.1, 6.5, 6.6**
    - Use `fc.record({ label: fc.string({ minLength: 1 }), url: fc.webUrl() })`; assert serialized/deserialized list contains a quick link with matching label and URL

- [ ] 13. Wire application initialization (`js/app.js`)
  - [ ] 13.1 Implement the top-level `init()` function that: loads all state from `localStorage`, calls `applyTheme`, `initGreeting`, `initTimer`, `renderTasks`, and `renderQuickLinks`; attach `init` to `DOMContentLoaded`
    - _Requirements: 1.3, 2.7, 3.1, 4.9, 6.6, 7.4, 9.3_
  - [ ] 13.2 Verify all event listeners (name form, task form, task list delegation, filter buttons, quick-link form, quick-link list delegation, theme toggle, timer controls) are attached and functional end-to-end
    - _Requirements: 2.6, 3.2, 3.4, 3.5, 4.1, 4.3, 4.4, 4.7, 5.1, 6.1, 6.4, 7.1_

- [ ] 14. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP
- Property tests use **fast-check** (UMD bundle, no build step required); tag each test with `// Feature: todo-life-dashboard, Property N: <property text>`
- Run property tests with a minimum of 100 iterations per property
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation at logical milestones
- Property tests validate universal correctness properties
- Unit tests validate specific examples and edge cases
