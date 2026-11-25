/**
 * Scope of Work UI rendering and phase-level actions (title, weightage, status cycle).
 */

import { getState, updateState } from '../core/state.js';
import { escapeHtml, formatPctNum, parseNumeric } from '../core/utils.js';
import {
  addActivityToPhase,
  removeActivityFromPhase,
  toggleActivityCompletion,
  updateActivityText,
  updateActivityWeight
} from './activities.js';
import { computePhaseMetrics, computeProjectWeightSummary, scaleActivitiesToPhaseWeight } from './weightage.js';

const SCOPE_STATUS_STATES = [
  { label: 'COMPLETED', tagClass: 'tag-done', ratio: 1.0 },
  { label: 'IN PROGRESS', tagClass: 'tag-active', ratio: 0.6 },
  { label: 'DELAYED', tagClass: 'tag-delay', ratio: 0.5 },
  { label: 'UPCOMING', tagClass: 'tag-upcoming', ratio: 0.0 }
];

function getTagClassForStatus(statusLabel) {
  const found = SCOPE_STATUS_STATES.find((s) => s.label === statusLabel);
  return found ? found.tagClass : 'tag-upcoming';
}

export function cyclePhaseStatus(phaseId) {
  updateState((state) => {
    const phase = state.phases.find((p) => p.id === phaseId);
    if (!phase) return;

    const currentIdx = SCOPE_STATUS_STATES.findIndex((s) => s.label === phase.status);
    const next = SCOPE_STATUS_STATES[(currentIdx + 1) % SCOPE_STATUS_STATES.length];
    phase.status = next.label;

    if (next.label === 'COMPLETED') {
      phase.activities.forEach((a) => {
        a.done = true;
      });
    } else if (next.label === 'UPCOMING') {
      phase.activities.forEach((a) => {
        a.done = false;
      });
    } else {
      const doneCount = phase.activities.filter((a) => a.done).length;
      if (phase.activities.length > 0 && (doneCount === 0 || doneCount === phase.activities.length)) {
        phase.activities.forEach((a, idx) => {
          a.done = idx === 0;
        });
      }
    }

    const metrics = computePhaseMetrics(phase);
    phase.completionPct = metrics.completionPct;
  }, 'scope-status');
}

export function updatePhaseTargetWeight(phaseId, rawWeight) {
  updateState((state) => {
    const phase = state.phases.find((p) => p.id === phaseId);
    if (!phase) return;

    const newWeight = parseNumeric(rawWeight, 0, 100);
    phase.weight = newWeight;
    phase.activities = scaleActivitiesToPhaseWeight(phase.activities, newWeight);

    const metrics = computePhaseMetrics(phase);
    phase.completionPct = metrics.completionPct;
  }, 'scope-weight');
}

export function syncPhaseWeightToActivitySum(phaseId) {
  updateState((state) => {
    const phase = state.phases.find((p) => p.id === phaseId);
    if (!phase) return;

    const metrics = computePhaseMetrics(phase);
    phase.weight = Math.round(metrics.activityWeightSum * 10) / 10;
    phase.completionPct = metrics.completionPct;
  }, 'scope-weight-sync');
}

export function updatePhaseTitle(phaseId, newTitle) {
  updateState((state) => {
    const phase = state.phases.find((p) => p.id === phaseId);
    if (phase) {
      phase.title = newTitle;
    }
  }, 'scope-title');
}

export function renderScopeSection(reason = 'init') {
  const state = getState();
  const container = document.getElementById('scopeContent');
  if (!state || !container) return;

  const summary = computeProjectWeightSummary(state.phases);

  // Update Total Weight Badge in sidebar
  const totalBadge = document.getElementById('totalWeightBadge');
  if (totalBadge) {
    totalBadge.innerText = `Total: ${formatPctNum(summary.totalWeight)}%`;
    if (!summary.isTotalValid) {
      totalBadge.classList.add('weight-warn');
      totalBadge.title = 'Warning: Total phase weightage does not equal 100%';
    } else {
      totalBadge.classList.remove('weight-warn');
      totalBadge.title = 'Sum of all phase weightages = 100%';
    }
  }

  // Avoid rebuilding DOM if user is actively typing inside an activity or phase input
  if (reason === 'activity-weight' || reason === 'scope-weight') {
    updateScopeMetricsInPlace(state.phases);
    return;
  }

  container.innerHTML = state.phases
    .map((phase) => {
      const metrics = computePhaseMetrics(phase);
      const tagClass = getTagClassForStatus(phase.status);

      const activitiesHtml = phase.activities
        .map((act, idx) => {
          const doneClass = act.done ? ' act-done' : '';
          return `
            <li class="activity-item${doneClass}" data-act-id="${escapeHtml(act.id)}">
              <div class="act-left">
                <span class="act-check" data-action="toggle-act" title="Click to mark activity completed/incomplete">✓</span>
                <span class="act-num">${idx + 1}.</span>
                <span class="act-text" contenteditable="true" data-field="act-text">${escapeHtml(act.text)}</span>
              </div>
              <div class="act-right">
                <span class="act-wt-pill" title="Edit activity weightage (%)"><span class="act-wt-val" contenteditable="true" data-field="act-wt">${formatPctNum(act.weight)}</span>%</span>
                <button class="act-del-btn" type="button" data-action="del-act" title="Remove activity">×</button>
              </div>
            </li>
          `;
        })
        .join('');

      return `
        <div class="scope-block" data-phase="${phase.id}">
          <div class="scope-header-row">
            <div id="scopeTitle${phase.id}" class="scope-title" contenteditable="true" data-field="phase-title">${escapeHtml(phase.title)}</div>
          </div>
          <div class="scope-meta-row">
            <div class="weight-group">
              <span class="weight-pill" title="Edit target phase weightage (%)">Wt: <span id="scopeWeight${phase.id}" contenteditable="true" data-field="phase-wt">${formatPctNum(phase.weight)}</span>%</span>
              <span id="subWarn${phase.id}" class="subweight-warn${metrics.hasSubMismatch ? ' visible' : ''}" data-action="sync-subwt" title="Activity weights do not match phase weightage. Click to update phase weightage to match sum of activities.">${escapeHtml(metrics.mismatchLabel)}</span>
            </div>
            <span id="scopeTag${phase.id}" class="phase-tag ${tagClass}" data-action="cycle-status" title="Click to cycle status & toggle all activities">${escapeHtml(phase.status)}</span>
          </div>
          <ul id="scopeList${phase.id}" class="activity-list">
            ${activitiesHtml}
          </ul>
          <button class="add-act-btn" type="button" data-action="add-act">+ Activity</button>
        </div>
      `;
    })
    .join('');
}

function updateScopeMetricsInPlace(phases) {
  phases.forEach((phase) => {
    const metrics = computePhaseMetrics(phase);
    const warnEl = document.getElementById(`subWarn${phase.id}`);
    if (warnEl) {
      warnEl.innerText = metrics.mismatchLabel;
      warnEl.classList.toggle('visible', metrics.hasSubMismatch);
    }
    const wtEl = document.getElementById(`scopeWeight${phase.id}`);
    if (wtEl && document.activeElement !== wtEl) {
      wtEl.innerText = formatPctNum(phase.weight);
    }
    phase.activities.forEach((act) => {
      const li = document.querySelector(`.activity-item[data-act-id="${act.id}"]`);
      if (li) {
        const valEl = li.querySelector('.act-wt-val');
        if (valEl && document.activeElement !== valEl) {
          valEl.innerText = formatPctNum(act.weight);
        }
      }
    });
  });
}

export function bindScopeEvents() {
  const container = document.getElementById('scopeContent');
  if (!container) return;

  container.addEventListener('click', (e) => {
    const block = e.target.closest('.scope-block');
    if (!block) return;
    const phaseId = parseInt(block.dataset.phase, 10);

    const actionTarget = e.target.closest('[data-action]');
    if (!actionTarget) return;
    const action = actionTarget.dataset.action;

    if (action === 'cycle-status') {
      cyclePhaseStatus(phaseId);
    } else if (action === 'sync-subwt') {
      syncPhaseWeightToActivitySum(phaseId);
    } else if (action === 'add-act') {
      addActivityToPhase(phaseId);
    } else if (action === 'toggle-act') {
      const actItem = e.target.closest('.activity-item');
      if (actItem) toggleActivityCompletion(phaseId, actItem.dataset.actId);
    } else if (action === 'del-act') {
      const actItem = e.target.closest('.activity-item');
      if (actItem) removeActivityFromPhase(phaseId, actItem.dataset.actId);
    }
  });

  container.addEventListener('input', (e) => {
    const block = e.target.closest('.scope-block');
    if (!block) return;
    const phaseId = parseInt(block.dataset.phase, 10);
    const field = e.target.dataset.field;

    if (field === 'phase-title') {
      updatePhaseTitle(phaseId, e.target.innerText.trim());
    } else if (field === 'phase-wt') {
      updatePhaseTargetWeight(phaseId, e.target.innerText);
    } else if (field === 'act-text') {
      const actItem = e.target.closest('.activity-item');
      if (actItem) updateActivityText(phaseId, actItem.dataset.actId, e.target.innerText.trim());
    } else if (field === 'act-wt') {
      const actItem = e.target.closest('.activity-item');
      if (actItem) updateActivityWeight(phaseId, actItem.dataset.actId, e.target.innerText);
    }
  });
}
