/**
 * Lazy-loaded client-side PDF export using html2canvas and jsPDF,
 * with automatic fallback to browser print dialog.
 */

import { getState } from '../core/state.js';
import { loadExternalScript } from '../core/utils.js';
import { getCleanProjectFileName } from './html.js';

const HTML2CANVAS_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
const JSPDF_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';

async function ensurePdfLibraries() {
  await Promise.all([
    typeof window.html2canvas === 'undefined' ? loadExternalScript(HTML2CANVAS_CDN) : Promise.resolve(),
    typeof window.jspdf === 'undefined' ? loadExternalScript(JSPDF_CDN) : Promise.resolve()
  ]);
}

export async function exportToPdf() {
  document.body.classList.add('exporting-mode');

  try {
    if (document.activeElement && typeof document.activeElement.blur === 'function') {
      document.activeElement.blur();
    }

    const element = document.getElementById('slideContainer');
    if (!element) throw new Error('Slide container not found.');

    await ensurePdfLibraries();

    if (typeof window.html2canvas !== 'undefined' && typeof window.jspdf !== 'undefined') {
      const canvas = await window.html2canvas(element, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff'
      });

      const imgData = canvas.toDataURL('image/png');
      const { jsPDF } = window.jspdf;
      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'pt',
        format: [canvas.width * 0.5, canvas.height * 0.5]
      });

      const fileName = getCleanProjectFileName(getState(), 'pdf');
      pdf.addImage(imgData, 'PNG', 0, 0, canvas.width * 0.5, canvas.height * 0.5);
      pdf.save(fileName);
      return { ok: true, fileName };
    }

    window.print();
    return { ok: true, fallback: 'print' };
  } catch (err) {
    console.error('PDF export error, falling back to print:', err);
    window.print();
    return { ok: false, error: err.message, fallback: 'print' };
  } finally {
    document.body.classList.remove('exporting-mode');
  }
}
