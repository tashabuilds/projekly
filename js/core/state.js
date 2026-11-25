/**
 * Centralised JSON-based application state store with reactive subscriptions.
 */

import { deepClone } from './utils.js';

let currentState = null;
let defaultTemplate = null;
const listeners = new Set();

export function setDefaultTemplate(templateObj) {
  defaultTemplate = deepClone(templateObj);
}

export function getDefaultTemplate() {
  return deepClone(defaultTemplate);
}

export function getState() {
  return currentState;
}

export function initState(initialData) {
  currentState = deepClone(initialData);
  notify('init', currentState);
  return currentState;
}

export function updateState(mutatorFn, reason = 'update', silent = false) {
  if (!currentState) return null;
  mutatorFn(currentState);
  if (!silent) {
    notify(reason, currentState);
  }
  return currentState;
}

export function subscribe(listenerFn) {
  listeners.add(listenerFn);
  return () => listeners.delete(listenerFn);
}

function notify(reason, state) {
  listeners.forEach((fn) => {
    try {
      fn(state, reason);
    } catch (err) {
      console.error('State listener error:', err);
    }
  });
}
