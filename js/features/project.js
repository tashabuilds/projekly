/**
 * Project metadata editing, New Project creation, and Template Reset.
 */

import { getDefaultTemplate, getState, initState, updateState } from '../core/state.js';
import { clearSavedState } from '../core/storage.js';
import { escapeHtml, sanitizeInlineHtml } from '../core/utils.js';

export function bindProjectEvents() {
  const titleEl = document.getElementById('projectTitle');
  const idEl = document.getElementById('metaProjectId');
  const leadEl = document.getElementById('metaProjectLead');
  const dateEl = document.getElementById('metaReportingDate');
  const remarksEl = document.getElementById('remarksContent');

  if (titleEl) {
    titleEl.addEventListener('input', () => {
      updateState((s) => {
        s.project.title = titleEl.innerText.trim();
      }, 'project-meta', true);
    });
  }

  if (idEl) {
    idEl.addEventListener('input', () => {
      updateState((s) => {
        s.project.id = idEl.innerText.trim();
      }, 'project-meta', true);
    });
  }

  if (leadEl) {
    leadEl.addEventListener('input', () => {
      updateState((s) => {
        s.project.lead = leadEl.innerText.trim();
      }, 'project-meta', true);
    });
  }

  if (dateEl) {
    dateEl.addEventListener('input', () => {
      updateState((s) => {
        s.project.reportingDate = dateEl.innerText.trim();
      }, 'project-meta', true);
    });
  }

  if (remarksEl) {
    remarksEl.addEventListener('input', () => {
      updateState((s) => {
        const lis = Array.from(remarksEl.querySelectorAll('li'));
        if (lis.length > 0) {
          s.remarks = lis.map((li) => {
            const strong = li.querySelector('strong');
            const label = strong ? strong.textContent.trim() : '';
            const fullText = li.textContent.trim();
            const text =
              label && fullText.startsWith(label)
                ? fullText.slice(label.length).trim()
                : fullText;
            return { label, text };
          });
        }
      }, 'remarks', true);
    });
  }

  // Sidebar editable headers
  const headerBindings = [
    ['scopeSidebarHeader', 'scopeHeader'],
    ['budgetSidebarHeader', 'budgetHeader'],
    ['remarksSidebarHeader', 'remarksHeader'],
    ['milestonesSidebarHeader', 'milestonesHeader']
  ];
  headerBindings.forEach(([domId, key]) => {
    const el = document.getElementById(domId);
    if (el) {
      el.addEventListener('input', () => {
        updateState((s) => {
          s[key] = sanitizeInlineHtml(el.innerHTML);
        }, 'headers', true);
      });
    }
  });
}

export function renderProjectHeaderAndRemarks() {
  const state = getState();
  if (!state) return;

  const titleEl = document.getElementById('projectTitle');
  if (titleEl && document.activeElement !== titleEl) {
    titleEl.innerText = state.project.title;
  }

  const idEl = document.getElementById('metaProjectId');
  if (idEl && document.activeElement !== idEl) {
    idEl.innerText = state.project.id;
  }

  const leadEl = document.getElementById('metaProjectLead');
  if (leadEl && document.activeElement !== leadEl) {
    leadEl.innerText = state.project.lead;
  }

  const dateEl = document.getElementById('metaReportingDate');
  if (dateEl && document.activeElement !== dateEl) {
    dateEl.innerText = state.project.reportingDate;
  }

  const scopeHdr = document.getElementById('scopeSidebarHeader');
  if (scopeHdr && document.activeElement !== scopeHdr) {
    scopeHdr.innerHTML = sanitizeInlineHtml(state.scopeHeader);
  }

  const budgetHdr = document.getElementById('budgetSidebarHeader');
  if (budgetHdr && document.activeElement !== budgetHdr) {
    budgetHdr.innerHTML = sanitizeInlineHtml(state.budgetHeader);
  }

  const remHdr = document.getElementById('remarksSidebarHeader');
  if (remHdr && document.activeElement !== remHdr) {
    remHdr.innerHTML = sanitizeInlineHtml(state.remarksHeader);
  }

  const msHdr = document.getElementById('milestonesSidebarHeader');
  if (msHdr && document.activeElement !== msHdr) {
    msHdr.innerHTML = sanitizeInlineHtml(state.milestonesHeader);
  }

  const remarksEl = document.getElementById('remarksContent');
  if (remarksEl && document.activeElement !== remarksEl) {
    const itemsHtml = (state.remarks || [])
      .map((item) => {
        const strongPart = item.label ? `<strong>${escapeHtml(item.label)}</strong> ` : '';
        return `<li>${strongPart}${escapeHtml(item.text)}</li>`;
      })
      .join('');
    remarksEl.innerHTML = `<ul>${itemsHtml}</ul>`;
  }
}

export function createNewProjectFromForm({ name, projectId, lead, allocation }) {
  const fresh = getDefaultTemplate();
  const todayStr = new Date().toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });

  fresh.project.title = `Project Summary: ${(name || '').trim() || 'New Project Initiative'}`;
  fresh.project.id = (projectId || '').trim() || 'PRJ-2026-001';
  fresh.project.lead = (lead || '').trim() || 'TBD';
  fresh.project.reportingDate = todayStr;
  fresh.project.ragStatus = 'green';

  // Reset all 4 phases to UPCOMING with clean starter activities
  fresh.phases = fresh.phases.map((p, idx) => {
    const num = idx + 1;
    return {
      ...p,
      weight: 25,
      status: 'UPCOMING',
      completionPct: 0,
      activities: [
        { id: `p${num}-a1`, text: `Define key deliverables for Phase ${num}`, weight: 15, done: false },
        { id: `p${num}-a2`, text: 'Confirm timeline and resource allocation', weight: 10, done: false }
      ]
    };
  });

  // Reset budget & monthly spend
  fresh.budget.allocation = Math.max(0, Number(allocation) || 0);
  fresh.budget.manualUtilisedPct = null;
  fresh.budget.monthly = fresh.budget.monthly.map((m) => ({ month: m.month, raw: '-' }));

  // Reset Gantt lanes cleanly
  fresh.timeline.markerPercent = 8.5;
  fresh.timeline.lanes = fresh.timeline.lanes.map((lane, idx) => {
    const start = idx * 3;
    return {
      phaseId: lane.phaseId,
      baselineBars: lane.baselineBars.slice(0, 1).map((b) => ({ ...b, start, span: 3 })),
      actualBars: lane.actualBars.slice(0, 1).map((a) => ({ ...a, start, span: 3, delayBadge: null })),
      gates: lane.gates
    };
  });

  fresh.remarks = [
    { label: 'Mandate & Approval:', text: `Pending / Approved on ${todayStr}.` },
    { label: 'Current Progress Summary:', text: 'Project initiated; baseline schedule and budget established.' },
    { label: 'Key Dependencies / Attention Items:', text: 'None at project kick-off.' },
    { label: 'Next Key Milestone:', text: 'Complete Phase 1 Planning & Scoping sign-off.' }
  ];

  initState(fresh);
}

export function resetToMasterTemplate() {
  clearSavedState();
  initState(getDefaultTemplate());
}
