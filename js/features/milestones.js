/**
 * Weighted Milestones & Output rendering and manual override synchronization.
 */

import { getState, updateState } from '../core/state.js';
import { escapeHtml, formatPctNum } from '../core/utils.js';
import { computeProjectWeightSummary } from './weightage.js';

export function renderMilestonesSection(reason = 'init') {
  const state = getState();
  const listEl = document.getElementById('deliverablesList');
  const badgeEl = document.getElementById('overallMsBadge');
  if (!state || !listEl) return;

  const summary = computeProjectWeightSummary(state.phases);

  if (badgeEl) {
    badgeEl.innerText = `Overall: ${formatPctNum(summary.totalAchieved)}% / ${formatPctNum(summary.totalWeight)}%`;
  }

  // In-place update when user is typing in msAchieved or scope weight
  if (reason === 'milestone-manual' || reason === 'scope-weight' || reason === 'activity-weight') {
    summary.phases.forEach((p) => {
      const item = listEl.querySelector(`.deliverable-item[data-phase-id="${p.phaseId}"]`);
      if (!item) return;

      const achEl = item.querySelector('.ms-achieved');
      if (achEl && document.activeElement !== achEl) {
        achEl.innerText = formatPctNum(p.achievedWeight);
      }
      const maxEl = item.querySelector('.ms-max');
      if (maxEl) {
        maxEl.innerText = formatPctNum(p.targetWeight);
      }
      const fillEl = item.querySelector('.progress-fill');
      if (fillEl) {
        const barWidth = Math.max(0, Math.min(100, p.completionPct));
        fillEl.style.width = `${barWidth}%`;
        fillEl.style.background = getProgressColor(p.completionRatio, p.status);
      }
    });
    return;
  }

  listEl.innerHTML = summary.phases
    .map((p) => {
      const barWidth = Math.max(0, Math.min(100, p.completionPct));
      const color = getProgressColor(p.completionRatio, p.status);
      return `
        <div class="deliverable-item" data-phase-id="${p.phaseId}" data-phase-completion="${p.completionPct.toFixed(1)}">
          <div class="deliverable-header">
            <span id="msTitle${p.phaseId}" contenteditable="true" data-field="ms-title">${escapeHtml(p.title)}</span>
            <span class="ms-score-wrap" title="Achieved weighted % / Phase weightage %">
              <span id="msAchieved${p.phaseId}" class="ms-achieved" contenteditable="true" data-field="ms-achieved">${formatPctNum(p.achievedWeight)}</span>% / <span id="msMax${p.phaseId}" class="ms-max">${formatPctNum(p.targetWeight)}</span>%
            </span>
          </div>
          <div class="progress-track">
            <div id="msFill${p.phaseId}" class="progress-fill" style="width: ${barWidth}%; background: ${color};"></div>
          </div>
        </div>
      `;
    })
    .join('');
}

function getProgressColor(ratio, status) {
  if (ratio >= 0.999) return '#28a745';
  if (ratio > 0) return status === 'DELAYED' ? '#e0a800' : '#008b99';
  return '#adb5bd';
}

export function bindMilestonesEvents() {
  const listEl = document.getElementById('deliverablesList');
  if (!listEl) return;

  listEl.addEventListener('input', (e) => {
    const item = e.target.closest('.deliverable-item');
    if (!item) return;
    const phaseId = parseInt(item.dataset.phaseId, 10);
    const field = e.target.dataset.field;

    if (field === 'ms-title') {
      updateState((s) => {
        const phase = s.phases.find((p) => p.id === phaseId);
        if (phase) phase.title = e.target.innerText.trim();
      }, 'ms-title', true);
      const scopeTitle = document.getElementById(`scopeTitle${phaseId}`);
      if (scopeTitle) scopeTitle.innerText = e.target.innerText.trim();
    } else if (field === 'ms-achieved') {
      const rawAch = parseFloat(e.target.innerText.replace(/[^0-9.]/g, ''));
      if (!isNaN(rawAch)) {
        updateState((s) => {
          const phase = s.phases.find((p) => p.id === phaseId);
          if (!phase) return;
          const maxWt = Number(phase.weight) || 0;
          const clamped = Math.max(0, Math.min(maxWt, rawAch));
          phase.completionPct = maxWt > 0 ? (clamped / maxWt) * 100 : 0;
        }, 'milestone-manual');
      }
    }
  });
}
