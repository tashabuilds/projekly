/**
 * Core utility functions for formatting, parsing, debouncing, and DOM safety.
 */

export const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

export function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

export function debounce(fn, delay = 300) {
  let timer = null;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

export function formatPctNum(val) {
  const num = Number(val) || 0;
  const rounded = Math.round(num * 10) / 10;
  return Number.isInteger(rounded) ? rounded.toString() : rounded.toFixed(1);
}

export function parseNumeric(rawText, min = 0, max = 100) {
  if (rawText === null || rawText === undefined) return 0;
  const cleaned = String(rawText).replace(/[^0-9.]/g, '');
  const num = parseFloat(cleaned);
  if (isNaN(num)) return 0;
  return Math.max(min, Math.min(max, num));
}

export function parseMoney(rawText) {
  if (!rawText) return 0;
  const cleaned = String(rawText).replace(/[\[\],RMrm\s]/g, '').toLowerCase();
  if (!cleaned || cleaned === '-' || cleaned === 'tbd' || cleaned === 'n/a') return 0;
  if (cleaned.endsWith('k')) {
    const val = parseFloat(cleaned.slice(0, -1));
    return isNaN(val) ? 0 : val * 1000;
  }
  if (cleaned.endsWith('m')) {
    const val = parseFloat(cleaned.slice(0, -1));
    return isNaN(val) ? 0 : val * 1000000;
  }
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

export function formatRM(amount, currency = 'RM') {
  const sign = amount < 0 ? '-' : '';
  const absVal = Math.abs(Math.round(amount));
  return `${sign}${currency} ${absVal.toLocaleString('en-US')}`;
}

export function formatMonthRange(start, span = 0.5) {
  const startIdx = Math.min(11, Math.max(0, Math.floor(start)));
  const endIdx = Math.min(11, Math.max(startIdx, Math.ceil(start + span) - 1));
  return startIdx === endIdx ? MONTHS[startIdx] : `${MONTHS[startIdx]} – ${MONTHS[endIdx]}`;
}

export function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function sanitizeInlineHtml(str) {
  // Allow safe <br> and basic formatting while stripping script/event vectors
  const div = document.createElement('div');
  div.innerHTML = String(str ?? '');
  div.querySelectorAll('script, style, iframe, object, embed').forEach((el) => el.remove());
  div.querySelectorAll('*').forEach((el) => {
    Array.from(el.attributes).forEach((attr) => {
      if (attr.name.startsWith('on') || attr.value.toLowerCase().startsWith('javascript:')) {
        el.removeAttribute(attr.name);
      }
    });
  });
  return div.innerHTML;
}

export function generateId(prefix = 'id') {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

export function isEmbeddedInIframe() {
  try {
    return window.self !== window.top;
  } catch (e) {
    return true;
  }
}

export function loadExternalScript(src) {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing) {
      if (existing.dataset.loaded === 'true') {
        resolve();
        return;
      }
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new Error(`Failed to load ${src}`)), { once: true });
      return;
    }
    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.onload = () => {
      script.dataset.loaded = 'true';
      resolve();
    };
    script.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(script);
  });
}
