/**
 * Google Drive API v3 folder lookup/creation and multipart file upload,
 * with automatic standalone HTML download + Drive web fallback.
 */

import { getState } from '../core/state.js';
import { loadDriveConfig, saveStateImmediate } from '../core/storage.js';
import { isEmbeddedInIframe } from '../core/utils.js';
import { buildStandaloneHtmlExport, getCleanProjectFileName, triggerFileDownload } from '../exports/html.js';
import { isValidGoogleClientId, requestDriveAccessToken } from './google-auth.js';

async function getOrCreateDriveFolder(accessToken, folderName) {
  const safeFolder = (folderName || 'Project Summaries').replace(/'/g, "\\'");
  const q = encodeURIComponent(
    `name='${safeFolder}' and mimeType='application/vnd.google-apps.folder' and trashed=false`
  );

  const searchRes = await fetch(`https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name)`, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  if (!searchRes.ok) {
    throw new Error(`Google Drive folder search failed (${searchRes.status})`);
  }
  const searchData = await searchRes.json();
  if (searchData.files && searchData.files.length > 0) {
    return searchData.files[0].id;
  }

  const createRes = await fetch('https://www.googleapis.com/drive/v3/files', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      name: folderName || 'Project Summaries',
      mimeType: 'application/vnd.google-apps.folder'
    })
  });
  if (!createRes.ok) {
    throw new Error(`Google Drive folder creation failed (${createRes.status})`);
  }
  const folderData = await createRes.json();
  return folderData.id;
}

async function uploadHtmlMultipart(accessToken, fileName, htmlContent, folderName) {
  const folderId = await getOrCreateDriveFolder(accessToken, folderName);
  const metadata = {
    name: fileName,
    mimeType: 'text/html',
    parents: folderId ? [folderId] : []
  };

  const boundary = '-------314159265358979323846';
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelimiter = `\r\n--${boundary}--`;

  const multipartBody =
    delimiter +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    JSON.stringify(metadata) +
    delimiter +
    'Content-Type: text/html; charset=UTF-8\r\n\r\n' +
    htmlContent +
    closeDelimiter;

  const res = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': `multipart/related; boundary="${boundary}"`
      },
      body: multipartBody
    }
  );

  if (!res.ok) {
    throw new Error(`Google Drive upload failed (${res.status})`);
  }
  return res.json();
}

export async function saveProjectToGoogleDrive({ onStatus } = {}) {
  const state = getState();
  if (!state) return { mode: 'error', message: 'Application state not initialized.' };

  saveStateImmediate(state);

  const fileName = getCleanProjectFileName(state, 'html');
  const htmlContent = await buildStandaloneHtmlExport(state);
  const cfg = loadDriveConfig();

  // Direct API upload when a valid OAuth Client ID is configured
  if (isValidGoogleClientId(cfg.clientId)) {
    try {
      if (onStatus) onStatus('Authorizing with Google Drive...');
      const token = await requestDriveAccessToken(cfg.clientId);
      if (onStatus) onStatus('Uploading snapshot to Drive...');
      const folderName = cfg.folderName || 'Project Summaries';
      const uploaded = await uploadHtmlMultipart(token, fileName, htmlContent, folderName);
      const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      return {
        mode: 'api',
        fileName,
        folderName,
        fileId: uploaded.id,
        statusMessage: `Saved to Drive (${folderName}) at ${timeStr}`
      };
    } catch (err) {
      console.warn('Direct Google Drive API save fell back to local snapshot:', err);
      triggerFileDownload(fileName, htmlContent, 'text/html;charset=utf-8');
      window.open('https://drive.google.com/drive/my-drive', '_blank', 'noopener');
      return {
        mode: 'fallback-after-error',
        fileName,
        error: err.message,
        isIframe: isEmbeddedInIframe(),
        statusMessage: `Downloaded ${fileName} (Drive fallback)`
      };
    }
  }

  // Zero-config mode: download self-contained HTML snapshot and open Google Drive
  triggerFileDownload(fileName, htmlContent, 'text/html;charset=utf-8');
  window.open('https://drive.google.com/drive/my-drive', '_blank', 'noopener');
  return {
    mode: 'fallback',
    fileName,
    statusMessage: `Downloaded ${fileName}`
  };
}
