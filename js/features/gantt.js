/**
 * Interactive Gantt chart: draggable/resizable baseline & actual bars,
 * key gates, delay variance badges, holiday strip, and red timeline marker.
 */

import { getState, updateState } from '../core/state.js';
import { escapeHtml, formatMonthRange, generateId } from '../core/utils.js';

let activeDragState = null;
let isDraggingMarker = false;

export function addGanttBar(phaseId, type) {
  updateState((s) => {
    const lane = s.timeline.lanes.find((l) => l.phaseId === phaseId);
    if (!lane) return;
    if (type === 'baseline') {
      lane.baselineBars.push({
        id: generateId(`b${phaseId}`),
        label: `Phase ${phaseId}: New Baseline Task`,
        start: 1,
        span: 2.5
      });
    } else {
      lane.actualBars.push({
        id: generateId(`a${phaseId}`),
        label: `Phase ${phaseId}: New Actual Task`,
        start: 1,
        span: 2.5,
        delayBadge: null
      });
    }
  }, 'gantt-add');
}

export function addKeyGate(phaseId) {
  updateState((s) => {
    const lane = s.timeline.lanes.find((l) => l.phaseId === phaseId);
    if (!lane) return;
    const totalGates = s.timeline.lanes.reduce((acc, l) => acc + l.gates.length, 0);
    lane.gates.push({
      id: generateId('g'),
      code: `G${totalGates + 1}`,
      label: 'New Gate',
      start: 6
    });
  }, 'gantt-add');
}

export function addDelayBadge(phaseId) {
  const state = getState();
  const lane = state?.timeline?.lanes?.find((l) => l.phaseId === phaseId);
  if (!lane || lane.actualBars.length === 0) {
    return { ok: false, message: 'Add an Actual arrow to this phase first before attaching a Schedule Variance badge.' };
  }
  if (lane.actualBars[0].delayBadge) {
    return { ok: true };
  }
  updateState((s) => {
    const targetLane = s.timeline.lanes.find((l) => l.phaseId === phaseId);
    if (targetLane && targetLane.actualBars[0]) {
      targetLane.actualBars[0].delayBadge = '⚠ Delay';
    }
  }, 'gantt-add');
  return { ok: true };
}

export function addHolidayPill() {
  updateState((s) => {
    const count = s.timeline.holidays.length;
    s.timeline.holidays.push({
      id: generateId('hol'),
      label: `Holiday ${count + 1}`,
      start: 2,
      span: 1
    });
  }, 'gantt-add');
}

export function removeGanttEntity(entityType, id, phaseId = null) {
  updateState((s) => {
    if (entityType === 'holiday') {
      s.timeline.holidays = s.timeline.holidays.filter((h) => h.id !== id);
      return;
    }
    const lane = s.timeline.lanes.find((l) => l.phaseId === phaseId);
    if (!lane) return;
    if (entityType === 'baseline') {
      lane.baselineBars = lane.baselineBars.filter((b) => b.id !== id);
    } else if (entityType === 'actual') {
      lane.actualBars = lane.actualBars.filter((a) => a.id !== id);
    } else if (entityType === 'gate') {
      lane.gates = lane.gates.filter((g) => g.id !== id);
    } else if (entityType === 'delay') {
      const bar = lane.actualBars.find((a) => a.id === id);
      if (bar) bar.delayBadge = null;
    }
  }, 'gantt-remove');
}

export function setTimelineMarkerPercent(percent) {
  const clamped = Math.max(0.5, Math.min(99.5, Number(percent) || 62.5));
  updateState((s) => {
    s.timeline.markerPercent = Number(clamped.toFixed(1));
  }, 'gantt-marker');
}

export function renderGanttChart(reason = 'init') {
  const state = getState();
  if (!state) return;

  const { timeline } = state;

  // Update Red Tracker & Slider
  const tracker = document.getElementById('redTracker');
  const slider = document.getElementById('dateSlider');
  if (tracker) tracker.style.left = `${timeline.markerPercent}%`;
  if (slider) slider.value = timeline.markerPercent;

  if (reason === 'gantt-marker') {
    return;
  }

  // Render Quarters & Months
  const calHeader = document.getElementById('calendarHeader');
  if (calHeader && reason === 'init') {
    const qHtml = (timeline.quarters || ['Q1', 'Q2', 'Q3', 'Q4'])
      .map((q, idx) => `<div class="quarter-block" contenteditable="true" data-q-idx="${idx}">${escapeHtml(q)}</div>`)
      .join('');
    const mHtml = (timeline.months || [])
      .map((m) => `<div class="month-cell">${escapeHtml(m)}</div>`)
      .join('');
    calHeader.innerHTML = qHtml + mHtml;
  }

  // Render Holiday Strip
  const holStrip = document.getElementById('holidayStrip');
  if (holStrip) {
    holStrip.innerHTML = (timeline.holidays || [])
      .map((hol) => {
        const leftPct = (hol.start / 12) * 100;
        const widthPct = (hol.span / 12) * 100;
        return `
          <div class="holiday-pill" data-entity="holiday" data-id="${escapeHtml(hol.id)}" data-start="${hol.start}" data-span="${hol.span}" style="left: calc(${leftPct}% + 3px); width: calc(${widthPct}% - 6px);" title="Drag to move, hover × to delete">
            <span class="holiday-label" contenteditable="true" data-field="hol-label">${escapeHtml(hol.label)}</span>
            <span class="del-btn" data-action="del-entity" title="Delete Holiday">×</span>
          </div>
        `;
      })
      .join('');
  }

  // Render Swimlanes
  const lanesContainer = document.getElementById('ganttLanes');
  if (lanesContainer) {
    lanesContainer.innerHTML = (timeline.lanes || [])
      .map((lane) => {
        const baselineHtml = (lane.baselineBars || [])
          .map((bar) => {
            const leftPct = (bar.start / 12) * 100;
            const widthPct = (bar.span / 12) * 100;
            return `
              <div class="interactive-bar bar-baseline" data-entity="baseline" data-id="${escapeHtml(bar.id)}" data-start="${bar.start}" data-span="${bar.span}" style="left: calc(${leftPct}% + 1px); width: calc(${widthPct}% - 2px);" title="Drag to move, edges to resize, hover × to delete">
                <div class="resize-handle resize-left"></div>
                <span class="bar-label" contenteditable="true" data-field="bar-label">${escapeHtml(bar.label)}</span>
                <span class="del-btn" data-action="del-entity" title="Delete Arrow">×</span>
                <div class="resize-handle resize-right"></div>
              </div>
            `;
          })
          .join('');

        const actualHtml = (lane.actualBars || [])
          .map((bar) => {
            const leftPct = (bar.start / 12) * 100;
            const widthPct = (bar.span / 12) * 100;
            const delayHtml = bar.delayBadge
              ? `<span class="delay-badge" contenteditable="true" data-field="delay-label">${escapeHtml(bar.delayBadge)}<span class="del-btn" contenteditable="false" data-action="del-delay" title="Delete Variance Badge">×</span></span>`
              : '';
            return `
              <div class="interactive-bar bar-actual" data-entity="actual" data-id="${escapeHtml(bar.id)}" data-start="${bar.start}" data-span="${bar.span}" style="left: calc(${leftPct}% + 1px); width: calc(${widthPct}% - 2px);" title="Drag to move, edges to resize, hover × to delete">
                <div class="resize-handle resize-left"></div>
                ${delayHtml}
                <span class="bar-label" contenteditable="true" data-field="bar-label">${escapeHtml(bar.label)}</span>
                <span class="del-btn" data-action="del-entity" title="Delete Arrow">×</span>
                <div class="resize-handle resize-right"></div>
              </div>
            `;
          })
          .join('');

        const gatesHtml = (lane.gates || [])
          .map((gate) => {
            const leftPct = (gate.start / 12) * 100;
            return `
              <div class="gate-pill" data-entity="gate" data-id="${escapeHtml(gate.id)}" data-start="${gate.start}" style="left: calc(${leftPct}% + 4px);" title="Drag to move Key Gate, hover × to delete">
                <span class="gate-code" contenteditable="true" data-field="gate-code">${escapeHtml(gate.code)}</span>
                <span class="gate-label" contenteditable="true" data-field="gate-label">${escapeHtml(gate.label)}</span>
                <span class="del-btn" data-action="del-entity" title="Delete Gate">×</span>
              </div>
            `;
          })
          .join('');

        return `
          <div id="lane${lane.phaseId}" class="track-lane" data-phase-id="${lane.phaseId}">
            <div class="bar-track-row row-baseline">${baselineHtml}</div>
            <div class="bar-track-row row-actual">${actualHtml}${gatesHtml}</div>
          </div>
        `;
      })
      .join('');
  }
}

export function bindGanttEvents() {
  const timelineInner = document.getElementById('timelineInner');
  const tracker = document.getElementById('redTracker');
  const tooltip = document.getElementById('barTooltip');

  if (!timelineInner) return;

  // Marker drag start
  if (tracker) {
    const startMarkerDrag = (e) => {
      isDraggingMarker = true;
      tracker.classList.add('dragging');
      e.preventDefault();
    };
    tracker.addEventListener('mousedown', startMarkerDrag);
    tracker.addEventListener('touchstart', startMarkerDrag, { passive: false });
  }

  // Delegated delete & inline label editing inside Gantt
  timelineInner.addEventListener('click', (e) => {
    const actionEl = e.target.closest('[data-action]');
    if (!actionEl) return;

    e.stopPropagation();
    const action = actionEl.dataset.action;
    const laneEl = actionEl.closest('.track-lane');
    const phaseId = laneEl ? parseInt(laneEl.dataset.phaseId, 10) : null;

    if (action === 'del-delay') {
      const barEl = actionEl.closest('.interactive-bar');
      if (barEl) removeGanttEntity('delay', barEl.dataset.id, phaseId);
      return;
    }

    if (action === 'del-entity') {
      const itemEl = actionEl.closest('[data-entity]');
      if (itemEl) {
        removeGanttEntity(itemEl.dataset.entity, itemEl.dataset.id, phaseId);
      }
    }
  });

  timelineInner.addEventListener('input', (e) => {
    const field = e.target.dataset.field;
    if (!field) {
      if (e.target.dataset.qIdx !== undefined) {
        const qIdx = parseInt(e.target.dataset.qIdx, 10);
        updateState((s) => {
          s.timeline.quarters[qIdx] = e.target.innerText.trim();
        }, 'gantt-quarter', true);
      }
      return;
    }

    const itemEl = e.target.closest('[data-entity]');
    if (!itemEl) return;
    const entity = itemEl.dataset.entity;
    const id = itemEl.dataset.id;
    const laneEl = itemEl.closest('.track-lane');
    const phaseId = laneEl ? parseInt(laneEl.dataset.phaseId, 10) : null;

    updateState((s) => {
      if (entity === 'holiday' && field === 'hol-label') {
        const hol = s.timeline.holidays.find((h) => h.id === id);
        if (hol) hol.label = e.target.innerText.trim();
        return;
      }
      const lane = s.timeline.lanes.find((l) => l.phaseId === phaseId);
      if (!lane) return;

      if (entity === 'baseline' && field === 'bar-label') {
        const bar = lane.baselineBars.find((b) => b.id === id);
        if (bar) bar.label = e.target.innerText.trim();
      } else if (entity === 'actual') {
        const bar = lane.actualBars.find((a) => a.id === id);
        if (!bar) return;
        if (field === 'bar-label') bar.label = e.target.innerText.trim();
        if (field === 'delay-label') bar.delayBadge = e.target.innerText.replace('×', '').trim();
      } else if (entity === 'gate') {
        const gate = lane.gates.find((g) => g.id === id);
        if (!gate) return;
        if (field === 'gate-code') gate.code = e.target.innerText.trim();
        if (field === 'gate-label') gate.label = e.target.innerText.trim();
      }
    }, 'gantt-text', true);
  });

  // Delegated Drag / Resize start for bars, holidays, and gates
  const startItemDrag = (e) => {
    if (e.target.closest('[data-action]')) return;
    if (e.target.isContentEditable && document.activeElement === e.target) return;

    const itemEl = e.target.closest('[data-entity]');
    if (!itemEl) return;

    const entity = itemEl.dataset.entity;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const isLeft = e.target.classList.contains('resize-left');
    const isRight = e.target.classList.contains('resize-right');
    const mode =
      entity === 'baseline' || entity === 'actual'
        ? isLeft
          ? 'resize-left'
          : isRight
          ? 'resize-right'
          : 'move'
        : 'move';

    const laneEl = itemEl.closest('.track-lane');

    activeDragState = {
      el: itemEl,
      entity,
      id: itemEl.dataset.id,
      phaseId: laneEl ? parseInt(laneEl.dataset.phaseId, 10) : null,
      mode,
      startX: clientX,
      origStart: parseFloat(itemEl.dataset.start) || 0,
      origSpan: parseFloat(itemEl.dataset.span) || 0.5,
      newStart: parseFloat(itemEl.dataset.start) || 0,
      newSpan: parseFloat(itemEl.dataset.span) || 0.5,
      moved: false
    };
  };

  timelineInner.addEventListener('mousedown', startItemDrag);
  timelineInner.addEventListener('touchstart', startItemDrag, { passive: true });

  // Document-level pointer move & up
  const onPointerMove = (e) => {
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;

    if (isDraggingMarker) {
      const rect = timelineInner.getBoundingClientRect();
      const percent = ((clientX - rect.left) / rect.width) * 100;
      setTimelineMarkerPercent(percent);
      return;
    }

    if (!activeDragState) return;

    const dx = clientX - activeDragState.startX;
    if (Math.abs(dx) > 3 && !activeDragState.moved) {
      activeDragState.moved = true;
      activeDragState.el.classList.add('active-drag');
      if (document.activeElement) document.activeElement.blur();
    }

    if (!activeDragState.moved) return;

    const trackWidth = activeDragState.el.parentElement.getBoundingClientRect().width;
    const deltaMonths = (dx / trackWidth) * 12;
    const snap = (val) => Math.round(val * 2) / 2;

    let newStart = activeDragState.origStart;
    let newSpan = activeDragState.origSpan;

    if (activeDragState.mode === 'move') {
      newStart = snap(activeDragState.origStart + deltaMonths);
      const maxStart = activeDragState.entity === 'gate' ? 11.5 : 12 - newSpan;
      newStart = Math.max(0, Math.min(maxStart, newStart));
    } else if (activeDragState.mode === 'resize-right') {
      newSpan = snap(activeDragState.origSpan + deltaMonths);
      newSpan = Math.max(0.5, Math.min(12 - newStart, newSpan));
    } else if (activeDragState.mode === 'resize-left') {
      const origEnd = activeDragState.origStart + activeDragState.origSpan;
      newStart = snap(activeDragState.origStart + deltaMonths);
      newStart = Math.max(0, Math.min(origEnd - 0.5, newStart));
      newSpan = origEnd - newStart;
    }

    activeDragState.newStart = newStart;
    activeDragState.newSpan = newSpan;

    // Immediate visual positioning during drag
    const leftPct = (newStart / 12) * 100;
    if (activeDragState.entity === 'gate') {
      activeDragState.el.style.left = `calc(${leftPct}% + 4px)`;
    } else {
      const widthPct = (newSpan / 12) * 100;
      const margin = activeDragState.entity === 'holiday' ? 3 : 1;
      activeDragState.el.style.left = `calc(${leftPct}% + ${margin}px)`;
      activeDragState.el.style.width = `calc(${widthPct}% - ${margin * 2}px)`;
    }

    if (tooltip) {
      tooltip.style.display = 'block';
      tooltip.style.left = `${clientX + 12}px`;
      tooltip.style.top = `${clientY - 28}px`;

      if (activeDragState.entity === 'holiday' || activeDragState.entity === 'gate') {
        const cleanLabel = activeDragState.el.innerText.replace('×', '').trim();
        tooltip.textContent = `${cleanLabel}: ${formatMonthRange(newStart, 0.5)}`;
      } else {
        tooltip.textContent = `${formatMonthRange(newStart, newSpan)} (${newSpan} mo)`;
      }
    }
  };

  const onPointerUp = () => {
    if (isDraggingMarker) {
      isDraggingMarker = false;
      if (tracker) tracker.classList.remove('dragging');
    }

    if (activeDragState) {
      const drag = activeDragState;
      drag.el.classList.remove('active-drag');
      activeDragState = null;
      if (tooltip) tooltip.style.display = 'none';

      if (drag.moved) {
        updateState((s) => {
          if (drag.entity === 'holiday') {
            const hol = s.timeline.holidays.find((h) => h.id === drag.id);
            if (hol) hol.start = drag.newStart;
            return;
          }
          const lane = s.timeline.lanes.find((l) => l.phaseId === drag.phaseId);
          if (!lane) return;

          if (drag.entity === 'baseline') {
            const bar = lane.baselineBars.find((b) => b.id === drag.id);
            if (bar) {
              bar.start = drag.newStart;
              bar.span = drag.newSpan;
            }
          } else if (drag.entity === 'actual') {
            const bar = lane.actualBars.find((a) => a.id === drag.id);
            if (bar) {
              bar.start = drag.newStart;
              bar.span = drag.newSpan;
            }
          } else if (drag.entity === 'gate') {
            const gate = lane.gates.find((g) => g.id === drag.id);
            if (gate) gate.start = drag.newStart;
          }
        }, 'gantt-drag');
      }
    }
  };

  document.addEventListener('mousemove', onPointerMove);
  document.addEventListener('mouseup', onPointerUp);
  document.addEventListener('touchmove', onPointerMove, { passive: false });
  document.addEventListener('touchend', onPointerUp);
}
