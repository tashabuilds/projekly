# Project Summary Master Template

A modular, zero-build, static web application for executive project tracking, weighted Scope of Work & Milestones synchronization, live Budget & Utilisation calculation, interactive Gantt scheduling, and multi-format export (PDF, editable PowerPoint `.pptx`, standalone HTML, and Google Drive).

Designed for effortless deployment on **GitHub Pages** and **Cloudflare Pages**, and seamless URL embedding inside **Google Sites**.

---

## Features Preserved & Enhanced

- **Executive Slide Layout:** Clean 16:9-proportioned slide card with inline `contenteditable` fields and print-optimized stylesheet.
- **Weighted Scope of Work & Activity Management:** 4 configurable phases with per-activity weightages, completion checkboxes, mismatch alerts (`Σ != Phase Wt`), and automatic recalculation of **Milestones & Output**.
- **Live Budget & Monthly Utilisation Tracker:** Automatic parsing of `RM`, `k`, `m`, `-`, and `TBD` entries across 12 monthly cells, remaining balance calculation, overrun alerts, and manual percentage override.
- **Interactive Gantt Chart:** Draggable and resizable Baseline and Actual chevron bars (snapping to 0.5-month increments), draggable Key Gates (`G1`–`Gn`), inline schedule variance badges, draggable Public Holiday strip, and draggable vertical red Timeline Marker.
- **RAG Health Status:** One-click status cycling (`GREEN` / `AMBER` / `RED`).
- **Project Lifecycle & Autosave:** `+ New Project` wizard, `Reset Template` restore, debounced `localStorage` autosave, and automatic backward-compatible migration from legacy `v1`/`v2` HTML-snapshot drafts.
- **Multi-Format Export:**
  - **Export / Save PDF:** Lazy-loads `html2canvas` + `jsPDF` with browser print fallback.
  - **Export to Google Slides (`.pptx`):** Lazy-loads `PptxGenJS` to generate an editable native PowerPoint/Google Slides deck.
  - **Export HTML:** Bundles all modular CSS and JSON state into a single self-contained `.html` file.
  - **Save to Google Drive:** Direct Google Drive API v3 upload via Google Identity Services OAuth 2.0, with automatic standalone HTML download + Drive tab fallback when unconfigured or restricted inside an iframe.

---

## Repository Structure

```text
project-summary/
├── index.html                  # Application shell and modal templates
├── css/
│   ├── base.css                # Design tokens, resets, iframe embed rules
│   ├── layout.css              # Grid layout, responsive breakpoints, toolbar
│   ├── components.css          # Buttons, RAG pills, modals, tooltips
│   ├── scope.css               # Scope of Work cards and activity rows
│   ├── budget.css              # Budget cards, monthly grid, milestone bars
│   ├── gantt.css               # Gantt swimlanes, chevrons, gates, marker
│   └── print.css               # Print and PDF capture rules
├── js/
│   ├── core/
│   │   ├── app.js              # Bootstrapper, centralised UI event wiring
│   │   ├── state.js            # Centralised JSON state store & pub/sub
│   │   ├── storage.js          # Debounced autosave & legacy v1/v2 migration
│   │   └── utils.js            # Parsers, formatters, sanitizers, script loader
│   ├── features/
│   │   ├── project.js          # Metadata editing, New Project, Template Reset
│   │   ├── scope.js            # Scope rendering & phase-level actions
│   │   ├── activities.js       # Per-activity CRUD & completion toggling
│   │   ├── weightage.js        # Pure weightage & completion math
│   │   ├── budget.js           # Budget & monthly utilisation math + UI
│   │   ├── milestones.js       # Milestones & Output sync + manual override
│   │   ├── gantt.js            # Gantt rendering, drag/resize, marker sync
│   │   └── status.js           # RAG badge state & rendering
│   ├── services/
│   │   ├── google-auth.js      # Google Identity Services OAuth 2.0 handler
│   │   └── google-drive.js     # Google Drive API v3 multipart upload & fallback
│   └── exports/
│       ├── pdf.js              # Lazy-loaded PDF export
│       ├── pptx.js             # Lazy-loaded editable .pptx export
│       └── html.js             # Self-contained standalone HTML bundler
├── data/
│   └── template.json           # Default baseline template data
├── assets/                     # Static assets directory
├── tests/
│   ├── unit.test.mjs           # Zero-dependency Node.js unit tests
│   └── e2e.spec.js             # Playwright end-to-end test suite
├── playwright.config.js        # Playwright runner configuration
├── .github/workflows/
│   └── deploy.yml              # GitHub Actions test & GitHub Pages deploy
├── .gitignore
├── .nojekyll
├── .env.example
├── package.json
├── README.md
├── ARCHITECTURE.md
├── AGENTS.md
├── GEMINI.md
└── CHANGELOG.md
```

---

## Local Development

Because the application uses native ES Modules (`<script type="module">`) and `fetch('data/template.json')`, serve it over HTTP rather than opening `index.html` via `file://`:

```bash
# Option 1: Python built-in HTTP server (zero dependencies)
python3 -m http.server 4173

# Option 2: Node.js static server
npm start
```

Open `http://localhost:4173` in your browser.

---

## Deployment Instructions

### Option A: GitHub Pages (Automated via GitHub Actions)

1. Create a new repository on GitHub (e.g., `project-summary`).
2. Extract `PROJECT_SUMMARY_PRODUCTION_READY.zip` and upload all files inside `project-summary/` to the root of your repository (`main` branch).
3. In your GitHub repository, navigate to **Settings → Pages**.
4. Under **Build and deployment → Source**, select **GitHub Actions**.
5. Every push to `main` automatically runs `.github/workflows/deploy.yml` (executes unit tests and publishes to `https://<username>.github.io/<repo-name>/`).
6. All asset paths (`css/...`, `js/...`, `data/template.json`) are strictly relative, so repository subpaths work out of the box without configuration.

### Option B: Cloudflare Pages (Zero-Build Git Integration)

1. Log in to the **Cloudflare Dashboard → Workers & Pages → Create → Pages → Connect to Git**.
2. Select your GitHub repository and configure the exact build settings:
   - **Framework preset:** `None`
   - **Build command:** *(leave empty)*
   - **Build output directory:** `/` *(or `.`)*
   - **Root directory:** `/` *(or leave default)*
   - **Environment variables:** None required at build time (Google OAuth Client ID is configured client-side in the UI `⚙` modal or via `window.APP_CONFIG` if desired).
3. Click **Save and Deploy**. Cloudflare Pages will publish to `https://<project>.pages.dev` and automatically redeploy on every `git push`.

---

## Embedding in Google Sites

1. Open your Google Site editor.
2. In the right-hand panel, select **Insert → Embed → By URL**.
3. Paste your live **GitHub Pages** or **Cloudflare Pages** URL (e.g., `https://<project>.pages.dev`).
4. Choose **Whole page** preview and resize the embed container to full width (recommended minimum height: `760px`).
5. Publish your Google Site. Future updates pushed to GitHub will automatically appear in Google Sites without re-pasting HTML code.

---

## Google OAuth 2.0 Configuration (Optional Direct Drive Save)

By default, clicking **Save to Google Drive** works with zero setup by downloading a self-contained `.html` snapshot and opening Google Drive in a new tab. To enable one-click direct API uploads into a `Project Summaries` folder:

1. Go to [Google Cloud Console](https://console.cloud.google.com/) and create or select a project.
2. Enable the **Google Drive API** under **APIs & Services → Library**.
3. Configure the **OAuth consent screen** (External or Internal) and add the non-sensitive scope `https://www.googleapis.com/auth/drive.file`.
4. Go to **APIs & Services → Credentials → Create Credentials → OAuth client ID → Web application**.
5. Under **Authorized JavaScript origins**, add your exact deployment origins:
   - `https://<username>.github.io`
   - `https://<project>.pages.dev`
   - `http://localhost:4173` (for local testing)
6. Copy the generated **Client ID** (`*.apps.googleusercontent.com`). Do **not** copy or commit any Client Secret.
7. In the live application, click the **`⚙`** button next to **Save to Google Drive**, paste your Client ID, and click **Save Configuration**.
8. **Google Sites Iframe Note:** Google Sites sandboxes embedded iframes and may block OAuth popups. When embedded, click **Open Standalone Tab** inside the `⚙` modal to authorize and save directly to Drive.

---

## Existing Data Migration

If you previously used the monolithic single-file template in the same browser origin, `js/core/storage.js` automatically detects legacy `localStorage` keys (`project_summary_master_state_v2` and `project_summary_master_state_v1`), extracts your project metadata, phases, activity weightages, budget entries, Gantt bars, gates, holidays, and remarks, and migrates them into the structured `project_summary_master_state_v3` JSON schema on first load.

---

## Running Automated Tests

```bash
# Run zero-dependency Node.js unit tests
npm test

# Run Playwright browser E2E suite (requires @playwright/test installed)
npm install
npx playwright install chromium
npm run test:e2e
```
