# Architecture Documentation

## Overview

The **Project Summary Master Template** is structured as a modular, client-side ES Module application built with vanilla HTML5, CSS3, and JavaScript (ES2022). It requires no bundler, transpiler, or backend server, ensuring immediate deployment on static hosts (GitHub Pages, Cloudflare Pages) while maintaining clean separation of concerns.

---

## Architectural Layers

```text
┌──────────────────────────────────────────────────────────────────────┐
│                           index.html (View Shell)                    │
└──────────────────────────────────┬───────────────────────────────────┘
                                   │
┌──────────────────────────────────▼───────────────────────────────────┐
│                         js/core/app.js (Controller)                  │
│   Bootstraps template, wires toolbar/modals, subscribes renderers    │
└──────┬───────────────────────────┬───────────────────────────┬───────┘
       │                           │                           │
┌──────▼──────────┐     ┌──────────▼──────────┐     ┌──────────▼───────┐
│  js/core/state  │     │    js/features/*    │     │  js/services/*   │
│  (JSON Store)   │◄────┤  (Domain Logic & UI)│     │  js/exports/*    │
└──────┬──────────┘     └─────────────────────┘     └──────────────────┘
       │
┌──────▼──────────┐
│ js/core/storage │
│ (Autosave/Migr.)│
└─────────────────┘
```

### 1. Core Layer (`js/core/`)
- **`state.js`**: Single source of truth holding the structured JSON state (`project`, `phases`, `budget`, `timeline`, `remarks`) and an immutable copy of `data/template.json`. Exposes `getState()`, `initState()`, `updateState(mutator, reason, silent)`, and `subscribe(listener)`.
- **`storage.js`**: Handles `localStorage` persistence under `project_summary_master_state_v3`, debounced autosave (`350ms`), Drive configuration storage, and `migrateLegacyHtmlSnapshot()` for backward compatibility with `v1`/`v2` HTML snapshots.
- **`utils.js`**: Stateless helper utilities for currency parsing (`parseMoney`, `formatRM`), percentage formatting (`formatPctNum`), date span formatting (`formatMonthRange`), HTML sanitization (`escapeHtml`, `sanitizeInlineHtml`), iframe detection (`isEmbeddedInIframe`), and on-demand CDN script loading (`loadExternalScript`).
- **`app.js`**: Application entry point. Loads `data/template.json`, initializes state, binds toolbar and modal controls, registers feature event listeners, and dispatches state updates to feature renderers.

### 2. Feature Layer (`js/features/`)
Each feature module owns its domain calculations and DOM rendering:
- **`weightage.js`**: Pure calculation functions (`computePhaseMetrics`, `computeProjectWeightSummary`, `scaleActivitiesToPhaseWeight`) with zero DOM dependencies.
- **`activities.js`**: Mutates per-phase activities (add, remove, toggle completion, edit text/weight) and updates phase completion ratios.
- **`scope.js`**: Renders the 4-column Scope of Work grid, phase weight pills, mismatch badges (`Σ != Phase Wt`), and delegates scope/activity events.
- **`budget.js`**: Computes budget allocation, monthly expenditure sum, remaining balance, overrun status (`computeBudgetSummary`), and renders the budget cards and 12-month tracker.
- **`milestones.js`**: Renders weighted Milestones & Output progress bars synced to `weightage.js`, while supporting direct manual achieved-percentage overrides.
- **`gantt.js`**: Renders the 4-quarter / 12-month calendar, interactive Public Holiday strip, Baseline/Actual chevron bars, Key Gates, variance badges, and vertical red Timeline Marker, including pointer drag-and-resize physics.
- **`status.js`**: Manages the `GREEN` / `AMBER` / `RED` RAG health badge state and rendering.
- **`project.js`**: Manages header metadata, sidebar titles, remarks list, `+ New Project` blank initialization, and `Reset Template`.

### 3. Services Layer (`js/services/`)
- **`google-auth.js`**: Dynamically loads Google Identity Services (`gsi/client`), validates OAuth Client ID format, manages short-lived in-memory access tokens, and detects iframe popup restrictions.
- **`google-drive.js`**: Coordinates Google Drive API v3 folder lookup/creation (`Project Summaries`) and `multipart/related` HTML snapshot upload, falling back gracefully to local download + Drive web tab when no Client ID is configured or iframe auth is blocked.

### 4. Exports Layer (`js/exports/`)
- **`html.js`**: Fetches all 7 modular CSS stylesheets, serializes current JSON state into `<script id="embeddedProjectState" type="application/json">`, and builds a self-contained portable `.html` file.
- **`pdf.js`**: Lazy-loads `html2canvas` and `jsPDF` on first click, captures `#slideContainer` at `2x` scale in landscape orientation, and falls back to `window.print()`.
- **`pptx.js`**: Lazy-loads `PptxGenJS` on first click and generates a native editable `.pptx` slide directly from the structured JSON state.

### 5. Styles Layer (`css/`)
Modular stylesheets loaded in cascade order in `index.html`:
`base.css` → `layout.css` → `components.css` → `scope.css` → `budget.css` → `gantt.css` → `print.css`.

---

## Dependency Rules

1. `js/core/utils.js` and `js/core/state.js` must have **no imports** from `features/`, `services/`, or `exports/`.
2. `js/features/weightage.js` must remain **pure JavaScript** (no DOM access) so it can be unit-tested in Node.js without a browser.
3. `js/exports/pdf.js` and `js/exports/pptx.js` must **never** be loaded eagerly in `<head>`; they are lazy-loaded only when the user triggers an export.
4. No circular imports are permitted between any modules.
