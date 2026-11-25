# GEMINI.md — Permanent AI Development Rules

You are working on the **Project Summary Master Template** repository. Follow these mandatory rules for every code modification, bug fix, or feature request:

1. **Understand the Architecture First:** Read `ARCHITECTURE.md` and inspect only the relevant modules before making edits.
2. **Identify Affected Modules:** Map the user's request to the specific module(s) responsible (e.g., budget math → `js/features/budget.js`; Gantt drag/render → `js/features/gantt.js`; export formatting → `js/exports/*.js`).
3. **Modify Only Relevant Files:** Edit only the targeted CSS, JS, JSON, or test files required for the task.
4. **Never Regenerate the Entire Application:** Never rewrite `index.html` or unrelated modules for a localized change.
5. **Preserve Unrelated Functionality:** Keep all existing features (weighted Scope/Activities, Budget/Monthly tracker, Milestones, Gantt drag/resize/gates/holidays/marker, RAG status, Autosave, Drive save, PDF/PPTX/HTML exports) intact.
6. **Reuse Existing Components and Utilities:** Use helpers in `js/core/utils.js`, state mutators in `js/core/state.js`, and existing CSS variables in `css/base.css`.
7. **Avoid Duplication:** Do not duplicate calculation logic between UI renderers and export modules; import shared calculation functions (e.g., `computeBudgetSummary`, `computePhaseMetrics`).
8. **Maintain Backward Compatibility:** Preserve `data/template.json` schema compatibility and `js/core/storage.js` migration support for existing `localStorage` drafts.
9. **Execute Relevant Regression Tests:** Run `npm test` (and `npm run test:e2e` when Playwright is available) and add/update tests in `tests/` for changed behavior.
10. **Update `CHANGELOG.md`:** Record every completed change under a versioned or dated entry in `CHANGELOG.md`.
11. **Provide a Concise Summary of Changed Files:** List which files were modified and what changed.
12. **Avoid Unnecessary Chat Output:** Do not reproduce unchanged files or lengthy boilerplate explanations in chat responses.
13. **Work Directly on Repository Files:** Apply edits directly to the repository files whenever the environment supports file operations.
