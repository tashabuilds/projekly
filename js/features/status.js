/**
 * RAG status badge management and phase status definitions.
 */

import { getState, updateState } from '../core/state.js';

export const RAG_CONFIG = {
  green: {
    className: 'rag-green',
    title: 'STATUS: GREEN',
    subtitle: 'On Track'
  },
  amber: {
    className: 'rag-amber',
    title: 'STATUS: AMBER',
    subtitle: 'Minor Delay'
  },
  red: {
    className: 'rag-red',
    title: 'STATUS: RED',
    subtitle: 'At Risk / Blocked'
  }
};

const RAG_ORDER = ['green', 'amber', 'red'];

export function cycleRagStatus() {
  updateState((state) => {
    const current = state.project.ragStatus || 'green';
    const nextIdx = (RAG_ORDER.indexOf(current) + 1) % RAG_ORDER.length;
    state.project.ragStatus = RAG_ORDER[nextIdx];
  }, 'rag');
}

export function renderRagBadge() {
  const state = getState();
  const badge = document.getElementById('ragBadge');
  if (!badge || !state) return;

  const key = RAG_CONFIG[state.project.ragStatus] ? state.project.ragStatus : 'green';
  const cfg = RAG_CONFIG[key];
  badge.className = `rag-badge ${cfg.className}`;
  badge.innerHTML = `${cfg.title}<br><small style="font-weight:normal;">${cfg.subtitle}</small>`;
}
