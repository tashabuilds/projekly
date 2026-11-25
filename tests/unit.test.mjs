import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { parseMoney, formatRM, formatPctNum, formatMonthRange, parseNumeric } from '../js/core/utils.js';
import { computePhaseMetrics, computeProjectWeightSummary, scaleActivitiesToPhaseWeight } from '../js/features/weightage.js';
import { computeBudgetSummary } from '../js/features/budget.js';
import { initState, getState, updateState, setDefaultTemplate, getDefaultTemplate } from '../js/core/state.js';

const template = JSON.parse(fs.readFileSync(new URL('../data/template.json', import.meta.url), 'utf8'));

test('Template JSON loads cleanly with 4 phases totaling 100%', () => {
  assert.equal(template.phases.length, 4);
  const summary = computeProjectWeightSummary(template.phases);
  assert.equal(summary.totalWeight, 100);
  assert.equal(summary.isTotalValid, true);
  assert.equal(summary.totalAchieved, 40);
});

test('Currency and numeric parsing handles k, m, TBD, and RM strings', () => {
  assert.equal(parseMoney('RM 100,000'), 100000);
  assert.equal(parseMoney('10k'), 10000);
  assert.equal(parseMoney('1.5m'), 1500000);
  assert.equal(parseMoney('TBD'), 0);
  assert.equal(parseMoney('-'), 0);
  assert.equal(formatRM(50000), 'RM 50,000');
  assert.equal(formatRM(-2500), '-RM 2,500');
  assert.equal(formatPctNum(25), '25');
  assert.equal(formatPctNum(12.34), '12.3');
  assert.equal(parseNumeric('150%', 0, 100), 100);
});

test('Phase and activity weightage calculations & mismatch detection', () => {
  const phase = {
    id: 1,
    title: 'Phase 1',
    weight: 25,
    status: 'IN PROGRESS',
    completionPct: 0,
    activities: [
      { id: 'a1', text: 'Act 1', weight: 15, done: true },
      { id: 'a2', text: 'Act 2', weight: 10, done: false },
      { id: 'a3', text: 'Act 3', weight: 5, done: false }
    ]
  };
  const m = computePhaseMetrics(phase);
  assert.equal(m.activityWeightSum, 30);
  assert.equal(m.hasSubMismatch, true);
  assert.equal(m.mismatchLabel, 'Σ 30% ≠ 25%');
  assert.equal(m.completionRatio, 0.5);
  assert.equal(m.achievedWeight, 12.5);

  const scaled = scaleActivitiesToPhaseWeight(phase.activities, 25);
  const scaledSum = scaled.reduce((acc, a) => acc + a.weight, 0);
  assert.equal(scaledSum, 25);
});

test('Budget allocation, monthly expenditure, and overrun detection', () => {
  const summary = computeBudgetSummary(template.budget);
  assert.equal(summary.allocation, 100000);
  assert.equal(summary.utilised, 50000);
  assert.equal(summary.remaining, 50000);
  assert.equal(summary.pct, 50);
  assert.equal(summary.isOverBudget, false);

  const overBudget = computeBudgetSummary({
    currency: 'RM',
    allocation: 20000,
    manualUtilisedPct: null,
    monthly: [{ month: 'JAN', raw: '25k' }]
  });
  assert.equal(overBudget.remaining, -5000);
  assert.equal(overBudget.isOverBudget, true);
});

test('Timeline month range formatting', () => {
  assert.equal(formatMonthRange(0, 1), 'JAN');
  assert.equal(formatMonthRange(0, 2.5), 'JAN – MAR');
  assert.equal(formatMonthRange(9.5, 1.5), 'OCT – NOV');
});

test('Centralised state store initialization and immutable default template', () => {
  setDefaultTemplate(template);
  initState(template);
  updateState((s) => {
    s.project.title = 'Modified Title';
  });
  assert.equal(getState().project.title, 'Modified Title');
  assert.equal(getDefaultTemplate().project.title, 'Project Summary: [Project Name / Initiative Title]');
});
