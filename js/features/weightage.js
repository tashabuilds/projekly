/**
 * Pure business logic for phase and activity weightage calculations.
 */

import { formatPctNum } from '../core/utils.js';

export function computePhaseMetrics(phase) {
  const targetWeight = Math.max(0, Math.min(100, Number(phase.weight) || 0));
  const activities = Array.isArray(phase.activities) ? phase.activities : [];

  let activityWeightSum = 0;
  let completedActivityWeight = 0;

  activities.forEach((act) => {
    const w = Math.max(0, Math.min(100, Number(act.weight) || 0));
    activityWeightSum += w;
    if (act.done) {
      completedActivityWeight += w;
    }
  });

  const hasSubMismatch =
    activities.length > 0 && Math.abs(activityWeightSum - targetWeight) > 0.05;

  const completionRatio =
    activityWeightSum > 0
      ? Math.min(1, completedActivityWeight / activityWeightSum)
      : Math.max(0, Math.min(1, (Number(phase.completionPct) || 0) / 100));

  const achievedWeight = completionRatio * targetWeight;

  return {
    targetWeight,
    activityWeightSum,
    completedActivityWeight,
    hasSubMismatch,
    mismatchLabel: hasSubMismatch
      ? `Σ ${formatPctNum(activityWeightSum)}% ≠ ${formatPctNum(targetWeight)}%`
      : '',
    completionRatio,
    completionPct: completionRatio * 100,
    achievedWeight
  };
}

export function computeProjectWeightSummary(phases) {
  let totalWeight = 0;
  let totalAchieved = 0;

  const phaseBreakdown = (phases || []).map((phase) => {
    const metrics = computePhaseMetrics(phase);
    totalWeight += metrics.targetWeight;
    totalAchieved += metrics.achievedWeight;
    return {
      phaseId: phase.id,
      title: phase.title,
      status: phase.status,
      ...metrics
    };
  });

  return {
    totalWeight,
    totalAchieved,
    isTotalValid: Math.abs(totalWeight - 100) <= 0.05,
    phases: phaseBreakdown
  };
}

export function scaleActivitiesToPhaseWeight(activities, newPhaseWeight) {
  const target = Math.max(0, Math.min(100, Number(newPhaseWeight) || 0));
  if (!Array.isArray(activities) || activities.length === 0) return [];

  const currentSum = activities.reduce((acc, a) => acc + (Number(a.weight) || 0), 0);
  let running = 0;

  return activities.map((act, idx) => {
    if (idx === activities.length - 1) {
      const remainder = Math.max(0, Math.round((target - running) * 10) / 10);
      return { ...act, weight: remainder };
    }
    const scaled =
      currentSum > 0
        ? Math.round(((Number(act.weight) || 0) / currentSum) * target * 10) / 10
        : Math.round((target / activities.length) * 10) / 10;
    running += scaled;
    return { ...act, weight: scaled };
  });
}
