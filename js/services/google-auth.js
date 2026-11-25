/**
 * Google Identity Services (GIS) OAuth 2.0 client handler with iframe detection
 * and standalone-window fallback when embedded inside Google Sites.
 */

import { isEmbeddedInIframe, loadExternalScript } from '../core/utils.js';

const GIS_SCRIPT_URL = 'https://accounts.google.com/gsi/client';
const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';

let cachedAccessToken = null;
let tokenExpiresAt = 0;

export function hasValidAccessToken() {
  return Boolean(cachedAccessToken && Date.now() < tokenExpiresAt - 15000);
}

export function getCachedAccessToken() {
  return hasValidAccessToken() ? cachedAccessToken : null;
}

export function clearAccessToken() {
  cachedAccessToken = null;
  tokenExpiresAt = 0;
}

export function isValidGoogleClientId(clientId) {
  if (!clientId || typeof clientId !== 'string') return false;
  const trimmed = clientId.trim();
  return /^[0-9]+-[a-zA-Z0-9_-]+\.apps\.googleusercontent\.com$/.test(trimmed);
}

export async function ensureGoogleIdentityLoaded() {
  if (typeof window.google !== 'undefined' && window.google.accounts?.oauth2) {
    return true;
  }
  await loadExternalScript(GIS_SCRIPT_URL);
  return typeof window.google !== 'undefined' && Boolean(window.google.accounts?.oauth2);
}

export async function requestDriveAccessToken(clientId) {
  if (!isValidGoogleClientId(clientId)) {
    throw new Error('Invalid or missing Google OAuth Client ID.');
  }

  if (hasValidAccessToken()) {
    return cachedAccessToken;
  }

  const loaded = await ensureGoogleIdentityLoaded();
  if (!loaded) {
    throw new Error('Google Identity Services script could not be loaded.');
  }

  return new Promise((resolve, reject) => {
    try {
      const tokenClient = window.google.accounts.oauth2.initTokenClient({
        client_id: clientId.trim(),
        scope: DRIVE_SCOPE,
        callback: (response) => {
          if (response && response.access_token) {
            cachedAccessToken = response.access_token;
            const expiresInSec = Number(response.expires_in) || 3500;
            tokenExpiresAt = Date.now() + expiresInSec * 1000;
            resolve(cachedAccessToken);
          } else {
            reject(new Error(response?.error_description || response?.error || 'Authorization cancelled or blocked.'));
          }
        },
        error_callback: (err) => {
          const msg =
            err?.type === 'popup_blocked' || isEmbeddedInIframe()
              ? 'Authentication popup was blocked inside the embedded frame. Open the app in a standalone tab to sign in.'
              : err?.message || 'Google OAuth popup error.';
          reject(new Error(msg));
        }
      });

      tokenClient.requestAccessToken({ prompt: '' });
    } catch (err) {
      reject(err);
    }
  });
}
