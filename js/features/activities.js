/**
 * Per-phase activity CRUD, completion toggling, and activity weightage editing.
 */

import { getState, updateState } from '../core/state.js';
import { generateId, parseNumeric } from '../core/utils.js';
import { computePhaseMetrics } from './weightage.js';

export function toggleActivityCompletion(phaseId, activityId) {
  updateState((state) => {
    const phase = state.phases.find((p) => p.id === phaseId);
    if (!phase) return;
    const act = phase.activities.find((a) => a.id === activityId);
    if (!act) return;

    act.done = !act.done;

    const metrics = computePhaseMetrics(phase);
    phase.completionPct = metrics.completionPct;

    if (phase.activities.length > 0) {
      if (metrics.completionRatio >= 0.999) {
        phase.status = 'COMPLETED';
      } else if (metrics.completionRatio > 0) {
        if (phase.status !== 'DELAYED') phase.status = 'IN PROGRESS';
      } else {
        if (phase.status !== 'DELAYED') phase.status = 'UPCOMING';
      }
    }
  }, 'activity-toggle');
}

export function updateActivityText(phaseId, activityId, newText) {
  updateState((state) => {
    const phase = state.phases.find((p) => p.id === phaseId);
    if (!phase) return;
    const act = phase.activities.find((a) => a.id === activityId);
    if (act) {
      act.text = newText;
    }
  }, 'activity-text', true);
}

export function updateActivityWeight(phaseId, activityId, rawWeight) {
  updateState((state) => {
    const phase = state.phases.find((p) => p.id === phaseId);
    if (!phase) return;
    const act = phase.activities.find((a) => a.id === activityId);
    if (!act) return;

    act.weight = parseNumeric(rawWeight, 0, 100);
    const metrics = computePhaseMetrics(phase);
    phase.completionPct = metrics.completionPct;
  }, 'activity-weight');
}

export function addActivityToPhase(phaseId) {
  updateState((state) => {
    const phase = state.phases.find((p) => p.id === phaseId);
    if (!phase) return;
    phase.activities.push({
      id: generateId(`p${phaseId}-a`),
      text: 'New deliverable activity',
      weight: 5,
      done: false
    });
    const metrics = computePhaseMetrics(phase);
    phase.completionPct = metrics.completionPct;
  }, 'activity-add');
}

export function removeActivityFromPhase(phaseId, activityId) {
  updateState((state) => {
    const phase = state.phases.find((p) => p.id === phaseId);
    if (!phase) return;
    phase.activities = phase.activities.filter((a) => a.id !== activityId);
    const metrics = computePhaseMetrics(phase);
    phase.completionPct = metrics.completionPct;
  }, 'activity-remove');
}

export function getActivitiesForPhase(phaseId) {
  const state = getState();
  const phase = state?.phases?.find((p) => p.id === phaseId);
  return phase ? phase.activities : [];
}
