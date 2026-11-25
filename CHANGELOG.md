# Changelog

All notable changes to the **Project Summary Master Template** will be documented in this file.

## [2.0.0] - 2026-11-25

### Added
- Modular repository architecture (`css/`, `js/core/`, `js/features/`, `js/services/`, `js/exports/`, `data/`, `tests/`).
- Centralised JSON state store (`js/core/state.js`) with reactive UI rendering and debounced `localStorage` autosave (`js/core/storage.js`).
- Automatic backward-compatible migration from legacy `v1`/`v2` HTML-snapshot `localStorage` entries.
- Lazy loading for `html2canvas`, `jsPDF`, `PptxGenJS`, and Google Identity Services (`gsi/client`).
- Dedicated standalone HTML exporter (`js/exports/html.js`) bundling all modular CSS and serialized JSON state.
- Google Sites iframe embed detection (`is-embedded` layout mode) and standalone-tab OAuth fallback notice.
- GitHub Actions CI/CD workflow (`.github/workflows/deploy.yml`) for automated testing and GitHub Pages deployment.
- Unit test suite (`tests/unit.test.mjs`) and Playwright E2E test suite (`tests/e2e.spec.js`).
- AI development governance documentation (`GEMINI.md`, `AGENTS.md`, `ARCHITECTURE.md`).

### Changed
- Refactored monolithic single-file HTML/CSS/JS template into cleanly separated ES modules and domain stylesheets while preserving all visual styling and interactive features.
