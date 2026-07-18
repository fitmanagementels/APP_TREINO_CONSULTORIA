# Frontend Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve the visual finish of the main XSTeam app without changing functionality.

**Architecture:** This is a CSS-only polish of the existing Apps Script HTML app. A focused visual regression test checks that the main stylesheet contains the agreed visual tokens and keeps the polish separate from functional app regressions already in progress.

**Tech Stack:** HTML, CSS inside Apps Script include files, Node.js built-in `assert` test runner style.

## Global Constraints

- Apply the polish only to the main app in `app/style.html`.
- Keep `docs/index.html` out of scope.
- Do not alter JavaScript, data, events, navigation, selectors, filters, modals or functional layout.
- Do not add dependencies.

---

### Task 1: Add Visual Polish Regression Test

**Files:**
- Create: `tests/frontend-polish.test.js`

**Interfaces:**
- Consumes: `app/style.html` file content.
- Produces: Assertions that fail until the stylesheet exposes the new visual polish tokens and layers.

- [ ] **Step 1: Read `app/style.html` in the focused visual test**

Add:

```js
const style = fs.readFileSync(path.join(root, "app", "style.html"), "utf8");
```

- [ ] **Step 2: Add a failing test for the approved aesthetic direction**

Add one test that asserts `app/style.html` contains:

```js
assert.match(style, /--surface-gradient:/);
assert.match(style, /--shadow-elevated:/);
assert.match(style, /--brand-light-ray:/);
assert.match(style, /body::before/);
assert.match(style, /linear-gradient\(135deg,\s*var\(--neon\),\s*var\(--neon-soft\)/);
```

- [ ] **Step 3: Run the regression test and verify it fails**

Run: `node tests/frontend-polish.test.js`

Expected: FAIL for the new visual polish test because the CSS tokens do not exist yet.

### Task 2: Apply CSS-Only Premium Athletic Polish

**Files:**
- Modify: `app/style.html`

**Interfaces:**
- Consumes: Existing CSS classes and custom properties.
- Produces: Updated theme tokens, background layers, cards, controls, nav, modal, skeleton and toast styling with no functional selector changes.

- [ ] **Step 1: Update root theme tokens**

Add/adjust CSS custom properties for layered dark backgrounds, softened green accents, shadows and gradients.

- [ ] **Step 2: Add global background light treatment**

Use `body::before` and `body::after` pseudo-elements for fixed non-interactive background gradients and a subtle irregular green light ray.

- [ ] **Step 3: Polish existing surfaces and states**

Update existing selectors only: `.global-loader`, `.app-header`, `.sync-badge`, `.exercise-card`, inputs/selects, buttons, week buttons, prescription rows, KPI cards, chart containers, modals, bottom nav, skeletons and toasts.

- [ ] **Step 4: Run the regression test and verify it passes**

Run: `node tests/frontend-polish.test.js`

Expected: PASS for all assertions.

### Task 3: Review Diff and Final Verification

**Files:**
- Review: `app/style.html`
- Review: `tests/frontend-polish.test.js`

**Interfaces:**
- Consumes: Git diff.
- Produces: Confidence that only intended files changed for implementation.

- [ ] **Step 1: Review changed files**

Run: `git --git-dir=.repo.git --work-tree=. diff -- app/style.html tests/frontend-polish.test.js`

Expected: Diff shows CSS polish and one regression test update.

- [ ] **Step 2: Run final regression test**

Run: `node tests/frontend-polish.test.js`

Expected: Exit code 0.
