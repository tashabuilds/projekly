/**
 * Self-contained standalone HTML snapshot generator.
 * Bundles all modular CSS, inline project state JSON, and interactive runtime
 * into a single portable .html file that works offline or when uploaded to Google Drive.
 */

import { getState } from '../core/state.js';

const CSS_FILES = [
  'css/base.css',
  'css/layout.css',
  'css/components.css',
  'css/scope.css',
  'css/budget.css',
  'css/gantt.css',
  'css/print.css'
];

export function getCleanProjectFileName(state, ext = 'html') {
  const rawTitle = (state?.project?.title || 'Project_Summary')
    .replace(/^Project Summary:\s*/i, '')
    .replace(/[\[\]]/g, '')
    .trim() || 'Project_Summary';
  const safeName = rawTitle.replace(/[^a-zA-Z0-9_-]+/g, '_').replace(/^_+|_+$/g, '');
  const dateStamp = new Date().toISOString().slice(0, 10);
  return `${safeName}_${dateStamp}.${ext}`;
}

export function triggerFileDownload(fileName, content, mimeType = 'text/html;charset=utf-8') {
  const blob = content instanceof Blob ? content : new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

async function fetchBundledCss() {
  const results = await Promise.all(
    CSS_FILES.map(async (path) => {
      try {
        const res = await fetch(path);
        if (!res.ok) return '';
        return await res.text();
      } catch (e) {
        return '';
      }
    })
  );
  return results.join('\n\n');
}

export async function buildStandaloneHtmlExport(stateOverride = null) {
  if (document.activeElement && typeof document.activeElement.blur === 'function') {
    document.activeElement.blur();
  }

  const state = stateOverride || getState();
  const bundledCss = await fetchBundledCss();
  const serializedState = JSON.stringify(state).replace(/<\/script>/gi, '<\\/script>');

  const slideContainer = document.getElementById('slideContainer');
  const slideMarkup = slideContainer ? slideContainer.innerHTML : '';
  const sliderVal = state?.timeline?.markerPercent ?? 62.5;
  const pageTitle = (state?.project?.title || 'Project Summary').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${pageTitle}</title>
<style>
${bundledCss}
</style>
</head>
<body>
<div id="barTooltip" class="bar-tooltip"></div>

<div class="toolbar">
  <div class="toolbar-group">
    <strong>Standalone Snapshot</strong>
    <span class="save-status">Self-contained portable export</span>
  </div>
  <div class="toolbar-group">
    <label for="dateSlider"><strong>Timeline Marker:</strong></label>
    <input type="range" id="dateSlider" min="1" max="99" step="0.5" value="${sliderVal}">
    <button class="btn" onclick="window.print()">Print / Save PDF</button>
  </div>
</div>

<div id="slideContainer" class="slide-container">
${slideMarkup}
</div>

<script id="embeddedProjectState" type="application/json">${serializedState}<\/script>
<script>
(function() {
  const slider = document.getElementById('dateSlider');
  const tracker = document.getElementById('redTracker');
  if (slider && tracker) {
    slider.addEventListener('input', function() {
      tracker.style.left = this.value + '%';
    });
  }
  const ragBadge = document.getElementById('ragBadge');
  const states = [
    { cls: 'rag-green', html: 'STATUS: GREEN<br><small style="font-weight:normal;">On Track</small>' },
    { cls: 'rag-amber', html: 'STATUS: AMBER<br><small style="font-weight:normal;">Minor Delay</small>' },
    { cls: 'rag-red', html: 'STATUS: RED<br><small style="font-weight:normal;">At Risk / Blocked</small>' }
  ];
  let idx = 0;
  if (ragBadge) {
    ragBadge.addEventListener('click', function() {
      idx = (idx + 1) % states.length;
      ragBadge.className = 'rag-badge ' + states[idx].cls;
      ragBadge.innerHTML = states[idx].html;
    });
  }
})();
<\/script>
</body>
</html>`;
}

export async function exportStandaloneHtml() {
  const state = getState();
  const fileName = getCleanProjectFileName(state, 'html');
  const html = await buildStandaloneHtmlExport(state);
  triggerFileDownload(fileName, html, 'text/html;charset=utf-8');
  return fileName;
}
