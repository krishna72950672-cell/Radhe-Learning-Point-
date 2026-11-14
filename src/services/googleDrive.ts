import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';
import type { ExamMasterPayload } from '../types/exam';
import {
  buildSyncPayload,
  evaluateCloudSyncState,
  parseSyncPayload,
  type CloudComparisonOutcome,
} from './googleDriveSyncLogic';

export { buildSyncPayload, evaluateCloudSyncState, parseSyncPayload };
export type { CloudComparisonOutcome };

export const DRIVE_SYNC_FILENAME = 'shri_radhe_exam_master_sync.json';
export const DRIVE_SCOPES = ['https://www.googleapis.com/auth/drive.file'] as const;

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);

const provider = new GoogleAuthProvider();
for (const scope of DRIVE_SCOPES) {
  provider.addScope(scope);
}

// In-memory access token cache ONLY (never stored in localStorage/sessionStorage)
let isSigningIn = false;
let cachedAccessToken: string | null = null;

export function initDriveAuth(
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthSignedOut?: () => void,
) {
  return onAuthStateChanged(auth, (user) => {
    if (user && cachedAccessToken) {
      onAuthSuccess?.(user, cachedAccessToken);
    } else if (!isSigningIn) {
      cachedAccessToken = null;
      onAuthSignedOut?.();
    }
  });
}

export async function linkGoogleDrive(): Promise<{
  user: User;
  accessToken: string;
}> {
  isSigningIn = true;
  try {
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Google Drive access permission was not granted.');
    }
    cachedAccessToken = credential.accessToken;
    return { user: result.user, accessToken: cachedAccessToken };
  } finally {
    isSigningIn = false;
  }
}

export async function unlinkGoogleDrive(): Promise<void> {
  cachedAccessToken = null;
  await signOut(auth);
}

export function getCachedDriveToken(): string | null {
  return cachedAccessToken;
}

export interface DriveFileMetadata {
  id: string;
  name: string;
  modifiedTime: string;
}

export interface FetchFirstResult {
  file: DriveFileMetadata | null;
  payload: ExamMasterPayload | null;
}

function requireToken(): string {
  if (!cachedAccessToken) {
    throw new Error('Google Drive session expired or not linked. Please link Google Drive.');
  }
  return cachedAccessToken;
}

export async function checkDriveConnection(): Promise<{
  connected: boolean;
  file: DriveFileMetadata | null;
}> {
  const token = requireToken();
  const q = encodeURIComponent(`name = '${DRIVE_SYNC_FILENAME}' and trashed = false`);
  const url = `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name,modifiedTime)&orderBy=modifiedTime desc&pageSize=1`;

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (response.status === 401) {
    cachedAccessToken = null;
    throw new Error('Google Drive authorization expired. Please sign in again.');
  }
  if (!response.ok) {
    throw new Error(`Drive connection check failed (${response.status}).`);
  }

  const data = (await response.json()) as { files?: DriveFileMetadata[] };
  const file = data.files?.[0] ?? null;
  return { connected: true, file };
}

/**
 * Fetch-First step: inspects Drive for existing sync file and downloads its JSON payload
 * before any local overwrite or push is permitted.
 */
export async function fetchFromDriveFirst(): Promise<FetchFirstResult> {
  const { file } = await checkDriveConnection();
  if (!file) {
    return { file: null, payload: null };
  }

  const token = requireToken();
  const downloadRes = await fetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(file.id)}?alt=media`,
    {
      headers: { Authorization: `Bearer ${token}` },
    },
  );

  if (downloadRes.status === 401) {
    cachedAccessToken = null;
    throw new Error('Google Drive authorization expired. Please sign in again.');
  }
  if (!downloadRes.ok) {
    throw new Error(`Failed to fetch Drive sync file (${downloadRes.status}).`);
  }

  const json = await downloadRes.json();
  return {
    file,
    payload: parseSyncPayload(json),
  };
}

/**
 * Pushes updated local data to Google Drive using multipart upload (POST for new, PATCH for existing).
 * Callers must execute fetchFromDriveFirst() and obtain explicit user confirmation before calling this.
 */
export async function pushSyncPayloadToDrive(
  payload: ExamMasterPayload,
  existingFileId: string | null,
): Promise<DriveFileMetadata> {
  const token = requireToken();
  const boundary = `srss_sync_${Date.now()}`;
  const metadata = existingFileId
    ? { name: DRIVE_SYNC_FILENAME, mimeType: 'application/json' }
    : {
        name: DRIVE_SYNC_FILENAME,
        mimeType: 'application/json',
        description: 'Shri Radhe Exam Master Pro v4.0 Cloud Sync Data',
      };

  const multipartBody = [
    `--${boundary}`,
    'Content-Type: application/json; charset=UTF-8',
    '',
    JSON.stringify(metadata),
    `--${boundary}`,
    'Content-Type: application/json; charset=UTF-8',
    '',
    JSON.stringify(payload, null, 2),
    `--${boundary}--`,
  ].join('\r\n');

  const endpoint = existingFileId
    ? `https://www.googleapis.com/upload/drive/v3/files/${encodeURIComponent(existingFileId)}?uploadType=multipart&fields=id,name,modifiedTime`
    : 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,modifiedTime';

  const response = await fetch(endpoint, {
    method: existingFileId ? 'PATCH' : 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': `multipart/related; boundary=${boundary}`,
    },
    body: multipartBody,
  });

  if (response.status === 401) {
    cachedAccessToken = null;
    throw new Error('Google Drive authorization expired. Please sign in again.');
  }
  if (!response.ok) {
    throw new Error(`Failed to push updates to Google Drive (${response.status}).`);
  }

  return (await response.json()) as DriveFileMetadata;
}
