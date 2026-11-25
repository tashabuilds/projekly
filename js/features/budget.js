/**
 * Budget allocation, monthly expenditure tracking, and utilisation percentage logic.
 */

import { getState, updateState } from '../core/state.js';
import { escapeHtml, formatRM, parseMoney } from '../core/utils.js';

export function computeBudgetSummary(budget) {
  const allocation = Math.max(0, Number(budget.allocation) || 0);
  const monthlyItems = (budget.monthly || []).map((m) => {
    const amount = parseMoney(m.raw);
    return {
      month: m.month,
      raw: m.raw,
      amount,
      hasSpend: amount > 0
    };
  });

  const monthlySum = monthlyItems.reduce((acc, m) => acc + m.amount, 0);

  let utilised = monthlySum;
  if (budget.manualUtilisedPct !== null && budget.manualUtilisedPct !== undefined && allocation > 0) {
    utilised = (Number(budget.manualUtilisedPct) / 100) * allocation;
  }

  const remaining = allocation - utilised;
  const pct = allocation > 0 ? (utilised / allocation) * 100 : 0;

  return {
    currency: budget.currency || 'RM',
    allocation,
    utilised,
    remaining,
    pct,
    isOverBudget: remaining < 0,
    monthly: monthlyItems
  };
}

export function renderBudgetSection(reason = 'init') {
  const state = getState();
  if (!state) return;

  const summary = computeBudgetSummary(state.budget);

  const allocEl = document.getElementById('budgetAllocation');
  if (allocEl && document.activeElement !== allocEl) {
    allocEl.innerText = formatRM(summary.allocation, summary.currency);
  }

  const utilEl = document.getElementById('budgetUtilised');
  if (utilEl) {
    utilEl.innerText = formatRM(summary.utilised, summary.currency);
  }

  const remEl = document.getElementById('budgetRemaining');
  if (remEl) {
    remEl.innerText = formatRM(summary.remaining, summary.currency);
    remEl.style.color = summary.isOverBudget ? '#dc2626' : '#2e7d32';
  }

  const pctEl = document.getElementById('budgetPctValue');
  if (pctEl && document.activeElement !== pctEl) {
    pctEl.innerText = summary.pct.toFixed(1);
  }

  const barEl = document.getElementById('budgetBarFill');
  if (barEl) {
    const clampedBar = Math.max(0, Math.min(100, summary.pct));
    barEl.style.width = `${clampedBar}%`;
    barEl.style.background = summary.isOverBudget
      ? '#dc2626'
      : 'linear-gradient(90deg, var(--primary-blue), var(--accent-teal))';
  }

  const gridEl = document.getElementById('monthlyGrid');
  if (!gridEl) return;

  if (reason === 'budget-monthly') {
    // Update spend highlight classes in place without disrupting typing cursor
    const cells = gridEl.querySelectorAll('.m-cell');
    summary.monthly.forEach((m, idx) => {
      if (cells[idx]) {
        cells[idx].classList.toggle('has-spend', m.hasSpend);
      }
    });
    return;
  }

  gridEl.innerHTML = summary.monthly
    .map(
      (m, idx) => `
        <div class="m-cell${m.hasSpend ? ' has-spend' : ''}" data-month-idx="${idx}">
          <div class="m-name">${escapeHtml(m.month)}</div>
          <div class="m-amt" contenteditable="true" data-field="monthly-amt">${escapeHtml(m.raw)}</div>
        </div>
      `
    )
    .join('');
}

export function bindBudgetEvents() {
  const allocEl = document.getElementById('budgetAllocation');
  const pctEl = document.getElementById('budgetPctValue');
  const gridEl = document.getElementById('monthlyGrid');

  if (allocEl) {
    allocEl.addEventListener('input', () => {
      updateState((s) => {
        s.budget.allocation = parseMoney(allocEl.innerText);
        s.budget.manualUtilisedPct = null;
      }, 'budget-alloc');
    });

    allocEl.addEventListener('blur', () => {
      const state = getState();
      if (state) {
        allocEl.innerText = formatRM(state.budget.allocation, state.budget.currency);
      }
    });
  }

  if (pctEl) {
    pctEl.addEventListener('input', () => {
      const cleaned = pctEl.innerText.replace(/[^0-9.]/g, '');
      const val = parseFloat(cleaned);
      if (!isNaN(val)) {
        updateState((s) => {
          s.budget.manualUtilisedPct = Math.max(0, val);
        }, 'budget-pct');
      }
    });

    pctEl.addEventListener('blur', () => {
      updateState((s) => {
        s.budget.manualUtilisedPct = null;
      }, 'budget-recalc');
    });
  }

  if (gridEl) {
    gridEl.addEventListener('input', (e) => {
      if (e.target.dataset.field !== 'monthly-amt') return;
      const cell = e.target.closest('.m-cell');
      if (!cell) return;
      const idx = parseInt(cell.dataset.monthIdx, 10);

      updateState((s) => {
        if (s.budget.monthly[idx]) {
          s.budget.monthly[idx].raw = e.target.innerText.trim();
          s.budget.manualUtilisedPct = null;
        }
      }, 'budget-monthly');
    });
  }
}
