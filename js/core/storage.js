/**
 * LocalStorage persistence, debounced autosave, Drive config storage,
 * and backward-compatible migration from legacy v1/v2 HTML-snapshot storage.
 */

import { debounce, deepClone, parseMoney, parseNumeric } from './utils.js';

export const STORAGE_KEY_V3 = 'project_summary_master_state_v3';
export const LEGACY_STORAGE_KEYS = [
  'project_summary_master_state_v2',
  'project_summary_master_state_v1'
];
export const DRIVE_CFG_KEY = 'project_summary_drive_cfg_v1';

export function saveStateImmediate(state) {
  try {
    const payload = {
      schemaVersion: 3,
      updatedAt: new Date().toISOString(),
      data: state
    };
    localStorage.setItem(STORAGE_KEY_V3, JSON.stringify(payload));
    return true;
  } catch (err) {
    console.warn('LocalStorage save failed:', err);
    return false;
  }
}

export const debouncedSaveState = debounce((state, onSaved) => {
  const ok = saveStateImmediate(state);
  if (ok && typeof onSaved === 'function') {
    onSaved();
  }
}, 350);

export function clearSavedState() {
  localStorage.removeItem(STORAGE_KEY_V3);
  LEGACY_STORAGE_KEYS.forEach((k) => localStorage.removeItem(k));
}

export function loadSavedState(fallbackTemplate) {
  // 1. Try current v3 structured JSON state
  try {
    const rawV3 = localStorage.getItem(STORAGE_KEY_V3);
    if (rawV3) {
      const parsed = JSON.parse(rawV3);
      if (parsed && parsed.data && parsed.data.phases) {
        return { state: mergeWithDefaults(parsed.data, fallbackTemplate), migrated: false };
      }
    }
  } catch (err) {
    console.warn('Failed to parse v3 state:', err);
  }

  // 2. Attempt backward-compatible migration from legacy v2 / v1 HTML snapshots
  for (const legacyKey of LEGACY_STORAGE_KEYS) {
    try {
      const rawLegacy = localStorage.getItem(legacyKey);
      if (rawLegacy) {
        const parsedLegacy = JSON.parse(rawLegacy);
        if (parsedLegacy && parsedLegacy.html) {
          const migratedData = migrateLegacyHtmlSnapshot(parsedLegacy, fallbackTemplate);
          saveStateImmediate(migratedData);
          return { state: migratedData, migrated: true };
        }
      }
    } catch (err) {
      console.warn(`Migration from ${legacyKey} failed:`, err);
    }
  }

  return { state: deepClone(fallbackTemplate), migrated: false };
}

function mergeWithDefaults(savedData, defaults) {
  const merged = deepClone(defaults);
  if (savedData.project) Object.assign(merged.project, savedData.project);
  if (savedData.scopeHeader) merged.scopeHeader = savedData.scopeHeader;
  if (savedData.budgetHeader) merged.budgetHeader = savedData.budgetHeader;
  if (savedData.remarksHeader) merged.remarksHeader = savedData.remarksHeader;
  if (savedData.milestonesHeader) merged.milestonesHeader = savedData.milestonesHeader;
  if (Array.isArray(savedData.phases) && savedData.phases.length > 0) {
    merged.phases = savedData.phases;
  }
  if (savedData.budget) {
    merged.budget = { ...merged.budget, ...savedData.budget };
  }
  if (savedData.timeline) {
    merged.timeline = { ...merged.timeline, ...savedData.timeline };
  }
  if (Array.isArray(savedData.remarks)) {
    merged.remarks = savedData.remarks;
  }
  return merged;
}

/**
 * Extracts structured state from legacy innerHTML snapshots (v1/v2).
 */
export function migrateLegacyHtmlSnapshot(legacyPayload, fallbackTemplate) {
  const data = deepClone(fallbackTemplate);
  const parser = new DOMParser();
  const doc = parser.parseFromString(`<div>${legacyPayload.html}</div>`, 'text/html');

  // Project header & metadata
  const titleEl = doc.querySelector('#projectTitle');
  if (titleEl) data.project.title = titleEl.textContent.trim();

  const metaSpans = doc.querySelectorAll('#metaStrip span');
  if (metaSpans.length >= 3) {
    data.project.id = metaSpans[0].textContent.replace(/^Project ID:\s*/i, '').trim();
    data.project.lead = metaSpans[1].textContent.replace(/^Project Lead \(PIC\):\s*/i, '').trim();
    data.project.reportingDate = metaSpans[2].textContent.replace(/^Reporting Date:\s*/i, '').trim();
  }

  const ragEl = doc.querySelector('#ragBadge');
  if (ragEl) {
    if (ragEl.classList.contains('rag-red')) data.project.ragStatus = 'red';
    else if (ragEl.classList.contains('rag-amber')) data.project.ragStatus = 'amber';
    else data.project.ragStatus = 'green';
  }

  // Phases & Activities
  for (let i = 1; i <= 4; i++) {
    const phase = data.phases[i - 1];
    const pTitle = doc.querySelector(`#scopeTitle${i}`);
    const pWt = doc.querySelector(`#scopeWeight${i}`);
    const pTag = doc.querySelector(`#scopeTag${i}`);
    if (pTitle) phase.title = pTitle.textContent.trim();
    if (pWt) phase.weight = parseNumeric(pWt.textContent, 0, 100);
    if (pTag) phase.status = pTag.textContent.trim();

    const actItems = doc.querySelectorAll(`#scopeList${i} .activity-item`);
    if (actItems.length > 0) {
      phase.activities = Array.from(actItems).map((li, idx) => ({
        id: `p${i}-a${idx + 1}`,
        text: li.querySelector('.act-text')?.textContent.trim() || '',
        weight: parseNumeric(li.querySelector('.act-wt-val')?.textContent || '0', 0, 100),
        done: li.classList.contains('act-done')
      }));
    } else {
      // Legacy v1 ordered list without sub-activities
      const legacyLis = doc.querySelectorAll(`#scopeList${i} li`);
      if (legacyLis.length > 0) {
        const evenWt = Math.round((phase.weight / legacyLis.length) * 10) / 10;
        phase.activities = Array.from(legacyLis).map((li, idx) => ({
          id: `p${i}-a${idx + 1}`,
          text: li.textContent.trim(),
          weight: idx === legacyLis.length - 1 ? Math.max(0, phase.weight - evenWt * (legacyLis.length - 1)) : evenWt,
          done: phase.status === 'COMPLETED'
        }));
      }
    }
  }

  // Budget
  const allocEl = doc.querySelector('#budgetAllocation');
  if (allocEl) data.budget.allocation = parseMoney(allocEl.textContent);

  const mCells = doc.querySelectorAll('.monthly-grid .m-cell');
  if (mCells.length === 12) {
    data.budget.monthly = Array.from(mCells).map((cell, idx) => ({
      month: cell.querySelector('.m-name')?.textContent.trim() || data.budget.monthly[idx].month,
      raw: cell.querySelector('.m-amt')?.textContent.trim() || '-'
    }));
  }

  // Timeline
  if (legacyPayload.marker) {
    data.timeline.markerPercent = parseFloat(legacyPayload.marker) || 62.5;
  }

  const holPills = doc.querySelectorAll('#holidayStrip .holiday-pill');
  if (holPills.length > 0) {
    data.timeline.holidays = Array.from(holPills).map((pill, idx) => ({
      id: `hol-${idx + 1}`,
      label: pill.querySelector('.holiday-label')?.textContent.trim() || `Holiday ${idx + 1}`,
      start: parseFloat(pill.dataset.start) || 0,
      span: parseFloat(pill.dataset.span) || 1
    }));
  }

  for (let i = 1; i <= 4; i++) {
    const laneEl = doc.querySelector(`#lane${i}`);
    const laneObj = data.timeline.lanes[i - 1];
    if (laneEl && laneObj) {
      laneObj.baselineBars = Array.from(laneEl.querySelectorAll('.bar-baseline')).map((b, idx) => ({
        id: `b${i}-${idx + 1}`,
        label: b.querySelector('.bar-label')?.textContent.trim() || '',
        start: parseFloat(b.dataset.start) || 0,
        span: parseFloat(b.dataset.span) || 1
      }));
      laneObj.actualBars = Array.from(laneEl.querySelectorAll('.bar-actual')).map((a, idx) => ({
        id: `a${i}-${idx + 1}`,
        label: a.querySelector('.bar-label')?.textContent.trim() || '',
        start: parseFloat(a.dataset.start) || 0,
        span: parseFloat(a.dataset.span) || 1,
        delayBadge: a.querySelector('.delay-badge')?.textContent.replace('×', '').trim() || null
      }));
      laneObj.gates = Array.from(laneEl.querySelectorAll('.gate-pill')).map((g, idx) => ({
        id: `g${i}-${idx + 1}`,
        code: g.querySelector('.gate-code')?.textContent.trim() || `G${idx + 1}`,
        label: g.querySelector('.gate-label')?.textContent.trim() || 'Gate',
        start: parseFloat(g.dataset.start) || 0
      }));
    }
  }

  // Remarks
  const remLis = doc.querySelectorAll('#remarksContent li');
  if (remLis.length > 0) {
    data.remarks = Array.from(remLis).map((li) => {
      const strong = li.querySelector('strong');
      const label = strong ? strong.textContent.trim() : '';
      const fullText = li.textContent.trim();
      const text = label && fullText.startsWith(label) ? fullText.slice(label.length).trim() : fullText;
      return { label, text };
    });
  }

  return data;
}

export function loadDriveConfig() {
  try {
    const raw = localStorage.getItem(DRIVE_CFG_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        clientId: parsed.clientId || '',
        folderName: parsed.folderName || 'Project Summaries'
      };
    }
  } catch (e) {}
  return {
    clientId: window.APP_CONFIG?.GOOGLE_CLIENT_ID || '',
    folderName: window.APP_CONFIG?.GOOGLE_DRIVE_FOLDER || 'Project Summaries'
  };
}

export function saveDriveConfig(clientId, folderName) {
  localStorage.setItem(
    DRIVE_CFG_KEY,
    JSON.stringify({
      clientId: (clientId || '').trim(),
      folderName: (folderName || '').trim() || 'Project Summaries'
    })
  );
}
