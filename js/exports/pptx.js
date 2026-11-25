/**
 * Lazy-loaded editable PowerPoint (.pptx) export using PptxGenJS,
 * directly driven by the centralised application state.
 */

import { getState } from '../core/state.js';
import { formatPctNum, formatRM, loadExternalScript, MONTHS } from '../core/utils.js';
import { computeBudgetSummary } from '../features/budget.js';
import { RAG_CONFIG } from '../features/status.js';
import { computePhaseMetrics, computeProjectWeightSummary } from '../features/weightage.js';
import { getCleanProjectFileName } from './html.js';

const PPTXGEN_CDN = 'https://cdn.jsdelivr.net/npm/pptxgenjs@3.12.0/dist/pptxgen.bundle.js';

async function ensurePptxLibrary() {
  if (typeof window.PptxGenJS !== 'undefined') return;
  await loadExternalScript(PPTXGEN_CDN);
}

export async function exportToGoogleSlides() {
  if (document.activeElement && typeof document.activeElement.blur === 'function') {
    document.activeElement.blur();
  }

  await ensurePptxLibrary();

  if (typeof window.PptxGenJS === 'undefined') {
    throw new Error('Slide export library could not be loaded. Check network connectivity.');
  }

  const state = getState();
  const pptx = new window.PptxGenJS();
  pptx.layout = 'LAYOUT_16x9';
  const slide = pptx.addSlide();

  const C_BLUE = '0B4A82';
  const C_TEAL = '008B99';
  const C_LIGHT = 'F4F6F9';
  const C_BORDER = 'CBD2DB';
  const C_PINK = 'F5D0D0';
  const C_SKY = 'CCE3F6';

  const titleText = state.project.title;
  const metaText = `Project ID: ${state.project.id}   |   Project Lead (PIC): ${state.project.lead}   |   Reporting Date: ${state.project.reportingDate}`;
  const ragCfg = RAG_CONFIG[state.project.ragStatus] || RAG_CONFIG.green;
  const ragText = `${ragCfg.title} - ${ragCfg.subtitle}`;

  slide.addShape(pptx.ShapeType.rect, { x: 0.3, y: 0.25, w: 0.35, h: 0.08, fill: { color: C_TEAL } });
  slide.addText(titleText, { x: 0.72, y: 0.14, w: 7.4, h: 0.3, fontSize: 16, bold: true, color: C_BLUE, fontFace: 'Arial' });
  slide.addText(metaText, { x: 0.72, y: 0.43, w: 7.4, h: 0.2, fontSize: 8.5, color: '444444', fontFace: 'Arial' });

  const ragColor =
    state.project.ragStatus === 'red'
      ? 'F8D7DA'
      : state.project.ragStatus === 'amber'
      ? 'FFF3CD'
      : 'D4EDDA';
  const ragTxtColor =
    state.project.ragStatus === 'red'
      ? '721C24'
      : state.project.ragStatus === 'amber'
      ? '856404'
      : '155724';

  slide.addShape(pptx.ShapeType.roundRect, {
    x: 8.2,
    y: 0.18,
    w: 1.5,
    h: 0.42,
    fill: { color: ragColor },
    line: { color: ragTxtColor, width: 1 }
  });
  slide.addText(ragText, {
    x: 8.2,
    y: 0.18,
    w: 1.5,
    h: 0.42,
    fontSize: 8.5,
    bold: true,
    color: ragTxtColor,
    align: 'center',
    valign: 'middle',
    fontFace: 'Arial'
  });

  // 1. SCOPE OF WORK
  const weightSummary = computeProjectWeightSummary(state.phases);
  slide.addShape(pptx.ShapeType.rect, { x: 0.3, y: 0.72, w: 0.85, h: 1.38, fill: { color: C_BLUE } });
  slide.addText(`Scope of\nWork\n\n(Total: ${formatPctNum(weightSummary.totalWeight)}%)`, {
    x: 0.32,
    y: 0.76,
    w: 0.81,
    h: 1.3,
    fontSize: 9.5,
    bold: true,
    color: 'FFFFFF',
    fontFace: 'Arial'
  });

  state.phases.forEach((phase, idx) => {
    const boxX = 1.2 + idx * 2.13;
    const items = (phase.activities || [])
      .map((act, aIdx) => {
        const doneMark = act.done ? '✓ ' : '';
        return `${aIdx + 1}. ${doneMark}${act.text} (${formatPctNum(act.weight)}%)`;
      })
      .join('\n');

    slide.addShape(pptx.ShapeType.rect, {
      x: boxX,
      y: 0.72,
      w: 2.08,
      h: 1.38,
      fill: { color: 'FAFBFC' },
      line: { color: C_BORDER, width: 0.75 }
    });
    slide.addText(`${phase.title}\n[Wt: ${formatPctNum(phase.weight)}% | ${phase.status}]`, {
      x: boxX + 0.05,
      y: 0.74,
      w: 1.98,
      h: 0.35,
      fontSize: 7.2,
      bold: true,
      color: C_BLUE,
      fontFace: 'Arial'
    });
    slide.addText(items, {
      x: boxX + 0.05,
      y: 1.09,
      w: 1.98,
      h: 0.96,
      fontSize: 6.4,
      color: '222222',
      valign: 'top',
      fontFace: 'Arial'
    });
  });

  // 2. BUDGET & UTILISATION + GANTT CHART
  const midY = 2.18;
  const midH = 2.25;
  const budgetSummary = computeBudgetSummary(state.budget);

  slide.addShape(pptx.ShapeType.rect, { x: 0.3, y: midY, w: 0.85, h: midH, fill: { color: C_BLUE } });
  slide.addText('Budget &\nUtilisation', {
    x: 0.32,
    y: midY + 0.05,
    w: 0.81,
    h: 0.8,
    fontSize: 9.5,
    bold: true,
    color: 'FFFFFF',
    fontFace: 'Arial'
  });

  const allocTxt = formatRM(budgetSummary.allocation, budgetSummary.currency);
  const utilTxt = formatRM(budgetSummary.utilised, budgetSummary.currency);
  const remTxt = formatRM(budgetSummary.remaining, budgetSummary.currency);
  const pctTxt = `${budgetSummary.pct.toFixed(1)}% Utilised`;

  slide.addShape(pptx.ShapeType.rect, {
    x: 1.15,
    y: midY,
    w: 2.28,
    h: midH,
    fill: { color: 'FFFFFF' },
    line: { color: C_BORDER, width: 0.75 }
  });
  slide.addTable(
    [
      [
        { text: 'ALLOCATION', options: { bold: true, fontSize: 6.5, fill: C_LIGHT } },
        { text: 'UTILISED', options: { bold: true, fontSize: 6.5, fill: C_LIGHT } },
        { text: 'REMAINING', options: { bold: true, fontSize: 6.5, fill: C_LIGHT } }
      ],
      [
        { text: allocTxt, options: { bold: true, fontSize: 7.5, color: C_BLUE } },
        { text: utilTxt, options: { bold: true, fontSize: 7.5, color: C_TEAL } },
        { text: remTxt, options: { bold: true, fontSize: 7.5, color: budgetSummary.isOverBudget ? 'DC2626' : '2E7D32' } }
      ]
    ],
    { x: 1.15, y: midY, w: 2.28, h: 0.42, align: 'center', valign: 'middle', border: { pt: 0.5, color: C_BORDER } }
  );

  const row1M = budgetSummary.monthly
    .slice(0, 6)
    .map((m) => ({ text: `${m.month}\n${m.raw}`, options: { fontSize: 6, align: 'center' } }));
  const row2M = budgetSummary.monthly
    .slice(6, 12)
    .map((m) => ({ text: `${m.month}\n${m.raw}`, options: { fontSize: 6, align: 'center' } }));

  slide.addText(`Monthly Tracker (${pctTxt})`, { x: 1.18, y: midY + 0.45, w: 2.2, h: 0.16, fontSize: 7, bold: true, color: '333333' });
  slide.addTable([row1M, row2M], { x: 1.18, y: midY + 0.62, w: 2.22, h: 0.52, border: { pt: 0.5, color: C_BORDER } });

  let msSummary = `Milestones & Output (Overall: ${formatPctNum(weightSummary.totalAchieved)}% / ${formatPctNum(weightSummary.totalWeight)}%):\n`;
  state.phases.forEach((p) => {
    const pm = computePhaseMetrics(p);
    msSummary += `• ${p.title}: ${formatPctNum(pm.achievedWeight)}% / ${formatPctNum(pm.targetWeight)}%\n`;
  });
  slide.addText(msSummary.trim(), { x: 1.18, y: midY + 1.18, w: 2.22, h: 1.02, fontSize: 6.3, color: '222222', valign: 'top' });

  // Gantt Area
  const gX = 3.43;
  const gW = 6.27;
  slide.addShape(pptx.ShapeType.rect, { x: gX, y: midY, w: gW, h: midH, fill: { color: 'FFFFFF' }, line: { color: C_BORDER, width: 0.75 } });

  const qW = gW / 4;
  (state.timeline.quarters || ['Q1', 'Q2', 'Q3', 'Q4']).forEach((q, idx) => {
    slide.addShape(pptx.ShapeType.rect, { x: gX + idx * qW, y: midY, w: qW, h: 0.22, fill: { color: C_BLUE }, line: { color: 'FFFFFF', width: 0.5 } });
    slide.addText(q, { x: gX + idx * qW, y: midY, w: qW, h: 0.22, fontSize: 8, bold: true, color: 'FFFFFF', align: 'center', valign: 'middle' });
  });

  const mW = gW / 12;
  (state.timeline.months || MONTHS).forEach((m, idx) => {
    slide.addShape(pptx.ShapeType.rect, { x: gX + idx * mW, y: midY + 0.22, w: mW, h: 0.2, fill: { color: 'E2E6EC' }, line: { color: C_BORDER, width: 0.5 } });
    slide.addText(m, { x: gX + idx * mW, y: midY + 0.22, w: mW, h: 0.2, fontSize: 6.5, bold: true, color: '1E293B', align: 'center', valign: 'middle' });
  });

  (state.timeline.lanes || []).forEach((lane, lIdx) => {
    const laneY = midY + 0.48 + lIdx * 0.43;
    (lane.baselineBars || []).forEach((baseBar) => {
      slide.addShape(pptx.ShapeType.homePlate, {
        x: gX + (baseBar.start / 12) * gW,
        y: laneY,
        w: (baseBar.span / 12) * gW,
        h: 0.16,
        fill: { color: C_PINK },
        line: { color: 'D98282', width: 0.5 }
      });
      slide.addText(baseBar.label, {
        x: gX + (baseBar.start / 12) * gW + 0.04,
        y: laneY,
        w: (baseBar.span / 12) * gW - 0.06,
        h: 0.16,
        fontSize: 6,
        bold: true,
        color: '5C1A1A',
        valign: 'middle'
      });
    });

    (lane.actualBars || []).forEach((actBar) => {
      const label = actBar.delayBadge ? `[${actBar.delayBadge}] ${actBar.label}` : actBar.label;
      slide.addShape(pptx.ShapeType.homePlate, {
        x: gX + (actBar.start / 12) * gW,
        y: laneY + 0.18,
        w: (actBar.span / 12) * gW,
        h: 0.16,
        fill: { color: C_SKY },
        line: { color: '1D6FB8', width: 0.5 }
      });
      slide.addText(label, {
        x: gX + (actBar.start / 12) * gW + 0.04,
        y: laneY + 0.18,
        w: (actBar.span / 12) * gW - 0.06,
        h: 0.16,
        fontSize: 6,
        bold: true,
        color: '0A365C',
        valign: 'middle'
      });
    });
  });

  const markerPct = (Number(state.timeline.markerPercent) || 62.5) / 100;
  const markerX = gX + markerPct * gW;
  slide.addShape(pptx.ShapeType.line, { x: markerX, y: midY + 0.22, w: 0, h: midH - 0.22, line: { color: 'DC2626', width: 1.5 } });

  // 3. REMARKS
  const remY = 4.51;
  const remH = 0.92;
  slide.addShape(pptx.ShapeType.rect, { x: 0.3, y: remY, w: 0.85, h: remH, fill: { color: C_BLUE } });
  slide.addText('Remarks', {
    x: 0.32,
    y: remY + 0.04,
    w: 0.81,
    h: remH - 0.08,
    fontSize: 10,
    bold: true,
    color: 'FFFFFF',
    fontFace: 'Arial'
  });

  const remarksLines = (state.remarks || [])
    .map((r) => `• ${r.label ? r.label + ' ' : ''}${r.text}`)
    .join('\n');
  slide.addShape(pptx.ShapeType.rect, { x: 1.15, y: remY, w: 8.55, h: remH, fill: { color: 'F9FBFD' }, line: { color: C_BORDER, width: 0.75 } });
  slide.addText(remarksLines, { x: 1.22, y: remY + 0.03, w: 8.4, h: remH - 0.06, fontSize: 7.2, color: '111111', valign: 'middle', fontFace: 'Arial' });

  const fileName = getCleanProjectFileName(state, 'pptx');
  await pptx.writeFile({ fileName });
  return { ok: true, fileName };
}
