# AGENTS.md — AI Coding Assistant Guidelines

This repository follows a modular, zero-build vanilla HTML/CSS/ES-Module architecture. Any automated coding agent operating in this workspace must adhere to the following rules:

## Core Directives

1. **Understand Existing Architecture:** Consult `ARCHITECTURE.md` before modifying code to respect module boundaries and prevent circular dependencies.
2. **Scope Changes to Affected Modules:**
   - Styling / layout / responsive tweaks → `css/*.css`
   - State / persistence / migration → `js/core/state.js`, `js/core/storage.js`
   - Scope & activity weightage logic → `js/features/weightage.js`, `js/features/activities.js`, `js/features/scope.js`
   - Budget & monthly tracking → `js/features/budget.js`
   - Milestones & output bars → `js/features/milestones.js`
   - Gantt timeline, gates, holidays, marker → `js/features/gantt.js`
   - Google OAuth & Drive integration → `js/services/google-auth.js`, `js/services/google-drive.js`
   - PDF / PPTX / Standalone HTML exports → `js/exports/pdf.js`, `js/exports/pptx.js`, `js/exports/html.js`
3. **Modify Only Relevant Files:** Never regenerate the entire codebase or overwrite unrelated modules for a focused feature request.
4. **Preserve All Existing Functionality:** Ensure zero regressions across interactive editing, drag/resize, autosave, and exports.
5. **Reuse Shared Utilities:** Import formatters, parsers, sanitizers, and script loaders from `js/core/utils.js`.
6. **Eliminate Duplication:** Share domain calculation functions across UI features and `js/exports/pptx.js`.
7. **Maintain Backward Compatibility:** Keep `data/template.json` fields backward-compatible and maintain `localStorage` migration in `js/core/storage.js`.
8. **Security Hygiene:** Never hardcode API secrets, OAuth client secrets, or tokens in source files.
9. **Run Regression Tests:** Execute `node --test tests/*.test.mjs` (and Playwright E2E tests when available) before finalizing changes.
10. **Update `CHANGELOG.md`:** Append a clear entry describing the changes made.
11. **Concise Reporting:** Summarize only the modified files and verification results; avoid pasting unchanged code.
12. **Direct File Operations:** Modify repository files directly in place when supported by the environment.
