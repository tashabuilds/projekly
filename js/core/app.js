/**
 * Main application bootstrapper: loads baseline template, restores/migrates state,
 * wires centralised event listeners, and coordinates UI rendering.
 */

import { initState, setDefaultTemplate, subscribe } from './state.js';
import { debouncedSaveState, loadDriveConfig, loadSavedState, saveDriveConfig } from './storage.js';
import { isEmbeddedInIframe } from './utils.js';

import { bindProjectEvents, createNewProjectFromForm, renderProjectHeaderAndRemarks, resetToMasterTemplate } from '../features/project.js';
import { bindScopeEvents, renderScopeSection } from '../features/scope.js';
import { bindBudgetEvents, renderBudgetSection } from '../features/budget.js';
import { bindMilestonesEvents, renderMilestonesSection } from '../features/milestones.js';
import {
  addDelayBadge,
  addGanttBar,
  addHolidayPill,
  addKeyGate,
  bindGanttEvents,
  renderGanttChart,
  setTimelineMarkerPercent
} from '../features/gantt.js';
import { cycleRagStatus, renderRagBadge } from '../features/status.js';

import { saveProjectToGoogleDrive } from '../services/google-drive.js';
import { exportToPdf } from '../exports/pdf.js';
import { exportToGoogleSlides } from '../exports/pptx.js';
import { exportStandaloneHtml } from '../exports/html.js';

function setSaveStatus(text) {
  const el = document.getElementById('saveStatus');
  if (el) el.innerText = text;
}

function openModal(id) {
  const modal = document.getElementById(id);
  if (modal) modal.classList.add('open');
}

function closeModal(id) {
  const modal = document.getElementById(id);
  if (modal) modal.classList.remove('open');
}

function renderAll(state, reason) {
  renderProjectHeaderAndRemarks();
  renderRagBadge();
  renderScopeSection(reason);
  renderBudgetSection(reason);
  renderMilestonesSection(reason);
  renderGanttChart(reason);

  if (reason !== 'init') {
    debouncedSaveState(state, () => {
      const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      setSaveStatus(`Autosaved ${timeStr}`);
    });
  }
}

async function loadTemplateJson() {
  // Support embedded state if opened from a standalone HTML snapshot
  const embeddedEl = document.getElementById('embeddedProjectState');
  if (embeddedEl && embeddedEl.textContent.trim()) {
    try {
      return JSON.parse(embeddedEl.textContent);
    } catch (e) {}
  }

  const response = await fetch('data/template.json');
  if (!response.ok) {
    throw new Error(`Failed to load data/template.json (${response.status})`);
  }
  return response.json();
}

function bindToolbarAndModals() {
  // New Project Modal
  document.getElementById('btnNewProject')?.addEventListener('click', () => {
    document.getElementById('newProjName').value = '';
    document.getElementById('newProjId').value = 'PRJ-2026-002';
    document.getElementById('newProjLead').value = '';
    document.getElementById('newProjAlloc').value = '100000';
    openModal('newProjectModal');
    setTimeout(() => document.getElementById('newProjName')?.focus(), 50);
  });

  document.getElementById('btnCancelNewProj')?.addEventListener('click', () => closeModal('newProjectModal'));
  document.getElementById('btnConfirmNewProj')?.addEventListener('click', () => {
    createNewProjectFromForm({
      name: document.getElementById('newProjName').value,
      projectId: document.getElementById('newProjId').value,
      lead: document.getElementById('newProjLead').value,
      allocation: document.getElementById('newProjAlloc').value
    });
    closeModal('newProjectModal');
    setSaveStatus('New project created');
  });

  // Reset Template
  document.getElementById('btnResetTemplate')?.addEventListener('click', () => {
    if (!confirm('Reset the template back to its original default layout and sample data? Any unsaved changes will be overwritten.')) {
      return;
    }
    resetToMasterTemplate();
    setSaveStatus('Template reset');
  });

  // Google Drive Save & Config
  document.getElementById('btnSaveDrive')?.addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    const origText = btn.innerText;
    btn.disabled = true;
    btn.innerText = 'Saving to Drive...';
    try {
      const result = await saveProjectToGoogleDrive({ onStatus: setSaveStatus });
      if (result.statusMessage) setSaveStatus(result.statusMessage);
      if (result.mode === 'fallback-after-error' && result.isIframe) {
        alert(
          'Google sign-in popup was restricted inside the embedded Google Sites frame. A standalone HTML snapshot has been downloaded instead—you can also click "Open Standalone" to sign in directly to Google Drive.'
        );
      }
    } finally {
      btn.disabled = false;
      btn.innerText = origText;
    }
  });

  document.getElementById('btnDriveConfig')?.addEventListener('click', () => {
    const cfg = loadDriveConfig();
    document.getElementById('googleClientIdInput').value = cfg.clientId;
    document.getElementById('driveFolderNameInput').value = cfg.folderName;
    const iframeNotice = document.getElementById('iframeAuthNotice');
    if (iframeNotice) {
      iframeNotice.style.display = isEmbeddedInIframe() ? 'block' : 'none';
    }
    openModal('driveConfigModal');
  });

  document.getElementById('btnCloseDriveCfg')?.addEventListener('click', () => closeModal('driveConfigModal'));
  document.getElementById('btnSaveDriveCfg')?.addEventListener('click', () => {
    saveDriveConfig(
      document.getElementById('googleClientIdInput').value,
      document.getElementById('driveFolderNameInput').value
    );
    closeModal('driveConfigModal');
    setSaveStatus('Drive settings saved');
  });

  document.getElementById('btnOpenStandalone')?.addEventListener('click', () => {
    window.open(window.location.href, '_blank', 'noopener');
  });

  // RAG Status Toggle
  document.getElementById('ragBadge')?.addEventListener('click', cycleRagStatus);

  // Timeline Marker Slider
  document.getElementById('dateSlider')?.addEventListener('input', (e) => {
    setTimelineMarkerPercent(parseFloat(e.target.value));
  });

  // Gantt Add Controls
  const getTargetPhaseId = () => parseInt(document.getElementById('targetLaneSelect')?.value || '1', 10);

  document.getElementById('btnAddBaseline')?.addEventListener('click', () => addGanttBar(getTargetPhaseId(), 'baseline'));
  document.getElementById('btnAddActual')?.addEventListener('click', () => addGanttBar(getTargetPhaseId(), 'actual'));
  document.getElementById('btnAddGate')?.addEventListener('click', () => addKeyGate(getTargetPhaseId()));
  document.getElementById('btnAddDelay')?.addEventListener('click', () => {
    const res = addDelayBadge(getTargetPhaseId());
    if (!res.ok && res.message) alert(res.message);
  });
  document.getElementById('btnAddHoliday')?.addEventListener('click', () => addHolidayPill());

  // Export Buttons
  document.getElementById('btnExportHtml')?.addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    const orig = btn.innerText;
    btn.disabled = true;
    btn.innerText = 'Exporting...';
    try {
      const fileName = await exportStandaloneHtml();
      setSaveStatus(`Exported ${fileName}`);
    } finally {
      btn.disabled = false;
      btn.innerText = orig;
    }
  });

  document.getElementById('btnExportSlides')?.addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    const orig = btn.innerText;
    btn.disabled = true;
    btn.innerText = 'Building Slides...';
    try {
      const res = await exportToGoogleSlides();
      if (res.ok) setSaveStatus(`Exported ${res.fileName}`);
    } catch (err) {
      console.error('Slides export failed:', err);
      alert(err.message || 'Could not generate slide file.');
    } finally {
      btn.disabled = false;
      btn.innerText = orig;
    }
  });

  document.getElementById('btnExportPdf')?.addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    const orig = btn.innerText;
    btn.disabled = true;
    btn.innerText = 'Generating PDF...';
    try {
      const res = await exportToPdf();
      if (res.fileName) setSaveStatus(`Exported ${res.fileName}`);
    } finally {
      btn.disabled = false;
      btn.innerText = orig;
    }
  });
}

async function bootstrap() {
  if (isEmbeddedInIframe()) {
    document.body.classList.add('is-embedded');
  }

  try {
    const template = await loadTemplateJson();
    setDefaultTemplate(template);

    const { state, migrated } = loadSavedState(template);
    subscribe(renderAll);
    initState(state);

    bindToolbarAndModals();
    bindProjectEvents();
    bindScopeEvents();
    bindBudgetEvents();
    bindMilestonesEvents();
    bindGanttEvents();

    if (migrated) {
      setSaveStatus('Migrated previous draft');
    } else if (localStorage.getItem('project_summary_master_state_v3')) {
      setSaveStatus('Restored draft');
    }
  } catch (err) {
    console.error('Application initialization failed:', err);
    setSaveStatus('Error loading template');
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrap);
} else {
  bootstrap();
}
