import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Cloud,
  CloudDownload,
  CloudOff,
  CloudUpload,
  LogOut,
  RefreshCw,
  ShieldCheck,
  X,
} from 'lucide-react';
import type { User } from 'firebase/auth';
import {
  DRIVE_SYNC_FILENAME,
  buildSyncPayload,
  checkDriveConnection,
  evaluateCloudSyncState,
  fetchFromDriveFirst,
  getCachedDriveToken,
  initDriveAuth,
  linkGoogleDrive,
  pushSyncPayloadToDrive,
  unlinkGoogleDrive,
  type DriveFileMetadata,
} from '../services/googleDrive';
import type { ExamMasterPayload, Result, Student, Test } from '../types/exam';

interface GoogleDriveSyncProps {
  bilingualMode: boolean;
  students: Student[];
  tests: Test[];
  results: Result[];
  localUpdatedAt: string | null;
  onApplyCloudPayload: (payload: ExamMasterPayload) => void;
}

type SyncStatus =
  | 'disconnected'
  | 'connected'
  | 'checking'
  | 'pulling'
  | 'pushing'
  | 'cloud-available'
  | 'error';

interface PendingActionModal {
  type: 'push' | 'pull-overwrite';
  cloudFile: DriveFileMetadata | null;
  cloudPayload: ExamMasterPayload | null;
  cloudNewerWarning: boolean;
}

export const GoogleDriveSync: React.FC<GoogleDriveSyncProps> = ({
  bilingualMode,
  students,
  tests,
  results,
  localUpdatedAt,
  onApplyCloudPayload,
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [needsAuth, setNeedsAuth] = useState<boolean>(true);
  const [status, setStatus] = useState<SyncStatus>('disconnected');
  const [cloudFile, setCloudFile] = useState<DriveFileMetadata | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [isLinking, setIsLinking] = useState<boolean>(false);
  const [pendingModal, setPendingModal] = useState<PendingActionModal | null>(null);

  useEffect(() => {
    const unsubscribe = initDriveAuth(
      (authedUser) => {
        setUser(authedUser);
        setNeedsAuth(false);
        setStatus((prev) => (prev === 'disconnected' ? 'connected' : prev));
      },
      () => {
        setUser(null);
        setNeedsAuth(true);
        setStatus('disconnected');
        setCloudFile(null);
      },
    );
    return () => unsubscribe();
  }, []);

  const localTotalCount = students.length + tests.length + results.length;

  const runFetchFirstInspection = async (autoRestoreIfLocalEmpty: boolean) => {
    setStatus('pulling');
    setErrorMessage('');
    try {
      const { file, payload } = await fetchFromDriveFirst();
      setCloudFile(file);

      if (!file || !payload) {
        setStatus('connected');
        setStatusMessage(
          bilingualMode
            ? 'Google Drive जुड़ा है · अभी कोई क्लाउड बैकअप फ़ाइल नहीं है'
            : 'Drive linked · No cloud sync file created yet',
        );
        return { file: null, payload: null };
      }

      const outcome = evaluateCloudSyncState({
        cloudPayload: payload,
        localUpdatedAt,
        localCount: localTotalCount,
        lastSyncedAt,
      });

      if (autoRestoreIfLocalEmpty && outcome === 'cloud-has-data-local-empty') {
        onApplyCloudPayload(payload);
        const now = new Date().toISOString();
        setLastSyncedAt(now);
        setStatus('connected');
        setStatusMessage(
          bilingualMode
            ? `क्लाउड से ${payload.students.length} छात्र सुरक्षित रूप से प्राप्त किए गए`
            : `Pulled ${payload.students.length} student(s) from Google Drive`,
        );
      } else if (outcome === 'cloud-newer' || outcome === 'cloud-has-data-local-empty') {
        setStatus('cloud-available');
        setStatusMessage(
          bilingualMode
            ? `क्लाउड पर नया बैकअप उपलब्ध है (${payload.students.length} छात्र)`
            : `Newer cloud backup found (${payload.students.length} students)`,
        );
      } else {
        setStatus('connected');
        setStatusMessage(
          bilingualMode
            ? 'डेटा Google Drive के साथ समकालीन है'
            : 'Drive connected & synchronized',
        );
      }

      return { file, payload };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unable to fetch from Google Drive.';
      setErrorMessage(msg);
      setStatus('error');
      if (!getCachedDriveToken()) {
        setNeedsAuth(true);
      }
      return null;
    }
  };

  const handleLinkDrive = async () => {
    setIsLinking(true);
    setErrorMessage('');
    try {
      const { user: authedUser } = await linkGoogleDrive();
      setUser(authedUser);
      setNeedsAuth(false);
      setStatus('connected');
      await runFetchFirstInspection(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Google Drive sign-in was cancelled.';
      setErrorMessage(msg);
      setStatus('error');
    } finally {
      setIsLinking(false);
    }
  };

  const handleCheckConnection = async () => {
    setStatus('checking');
    setErrorMessage('');
    try {
      const res = await checkDriveConnection();
      setCloudFile(res.file);
      setStatus('connected');
      setStatusMessage(
        res.file
          ? bilingualMode
            ? `कनेक्शन सक्रिय · फ़ाइल मिली (${new Date(res.file.modifiedTime).toLocaleTimeString()})`
            : `Connection active · Cloud file ready (${new Date(res.file.modifiedTime).toLocaleTimeString()})`
          : bilingualMode
            ? 'कनेक्शन सक्रिय · नई सिंक फ़ाइल बनाने के लिए तैयार'
            : 'Connection active · Ready to create sync file',
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Connection check failed.';
      setErrorMessage(msg);
      setStatus('error');
      if (!getCachedDriveToken()) setNeedsAuth(true);
    }
  };

  const handlePullClick = async () => {
    const fetched = await runFetchFirstInspection(false);
    if (!fetched?.payload) return;

    const cloudTotal =
      fetched.payload.students.length +
      fetched.payload.tests.length +
      fetched.payload.results.length;

    if (localTotalCount === 0 && cloudTotal > 0) {
      onApplyCloudPayload(fetched.payload);
      setLastSyncedAt(new Date().toISOString());
      setStatus('connected');
      setStatusMessage(
        bilingualMode
          ? `क्लाउड से ${fetched.payload.students.length} छात्र सफलतापूर्वक लोड हुए`
          : `Pulled ${fetched.payload.students.length} student(s) from Drive`,
      );
      return;
    }

    setPendingModal({
      type: 'pull-overwrite',
      cloudFile: fetched.file,
      cloudPayload: fetched.payload,
      cloudNewerWarning: false,
    });
  };

  const handlePushClick = async () => {
    // Fetch-First Architecture: always inspect Drive before preparing a push
    const fetched = await runFetchFirstInspection(false);
    if (!fetched) return;

    const outcome = evaluateCloudSyncState({
      cloudPayload: fetched.payload,
      localUpdatedAt,
      localCount: localTotalCount,
      lastSyncedAt,
    });

    setPendingModal({
      type: 'push',
      cloudFile: fetched.file,
      cloudPayload: fetched.payload,
      cloudNewerWarning: outcome === 'cloud-newer' || outcome === 'cloud-has-data-local-empty',
    });
  };

  const handleConfirmPendingAction = async () => {
    if (!pendingModal) return;

    if (pendingModal.type === 'pull-overwrite' && pendingModal.cloudPayload) {
      onApplyCloudPayload(pendingModal.cloudPayload);
      setLastSyncedAt(new Date().toISOString());
      setStatus('connected');
      setStatusMessage(
        bilingualMode
          ? `क्लाउड डेटा (${pendingModal.cloudPayload.students.length} छात्र) स्थानीय रूप से लागू किया गया`
          : `Applied cloud snapshot (${pendingModal.cloudPayload.students.length} students)`,
      );
      setPendingModal(null);
      return;
    }

    if (pendingModal.type === 'push') {
      setPendingModal(null);
      setStatus('pushing');
      setErrorMessage('');
      try {
        const now = new Date().toISOString();
        const payload = buildSyncPayload(students, tests, results, now);
        const saved = await pushSyncPayloadToDrive(payload, pendingModal.cloudFile?.id ?? null);
        setCloudFile(saved);
        setLastSyncedAt(now);
        setStatus('connected');
        setStatusMessage(
          bilingualMode
            ? `Google Drive पर ${students.length} छात्र सुरक्षित रूप से सेव किए गए`
            : `Pushed ${students.length} student(s) securely to Google Drive`,
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Push to Google Drive failed.';
        setErrorMessage(msg);
        setStatus('error');
        if (!getCachedDriveToken()) setNeedsAuth(true);
      }
    }
  };

  const handleUnlink = async () => {
    await unlinkGoogleDrive();
    setUser(null);
    setNeedsAuth(true);
    setCloudFile(null);
    setStatus('disconnected');
    setStatusMessage('');
    setErrorMessage('');
  };

  const isBusy = status === 'checking' || status === 'pulling' || status === 'pushing' || isLinking;

  const renderStatusBadge = () => {
    if (needsAuth || status === 'disconnected') {
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700">
          <CloudOff className="w-4 h-4 text-slate-500 shrink-0" aria-hidden="true" />
          <span>{bilingualMode ? 'Google Drive लिंक नहीं है' : 'Drive Not Linked'}</span>
        </span>
      );
    }
    if (status === 'error') {
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-700">
          <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" aria-hidden="true" />
          <span>{bilingualMode ? 'सिंक त्रुटि' : 'Sync Attention Needed'}</span>
        </span>
      );
    }
    if (status === 'cloud-available') {
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-800">
          <CloudDownload className="w-4 h-4 text-amber-600 shrink-0" aria-hidden="true" />
          <span>{bilingualMode ? 'क्लाउड अपडेट उपलब्ध' : 'Cloud Update Available'}</span>
        </span>
      );
    }
    if (isBusy) {
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#0D47A1]">
          <RefreshCw className="w-4 h-4 animate-spin shrink-0" aria-hidden="true" />
          <span>
            {status === 'pulling'
              ? bilingualMode
                ? 'क्लाउड से पहले डेटा जांचा जा रहा है...'
                : 'Fetch-First: Checking Cloud...'
              : status === 'pushing'
                ? bilingualMode
                  ? 'Drive पर भेजा जा रहा है...'
                  : 'Pushing Updates...'
                : bilingualMode
                  ? 'कनेक्शन जांचा जा रहा है...'
                  : 'Checking Connection...'}
          </span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-800">
        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" aria-hidden="true" />
        <span>{bilingualMode ? 'Google Drive जुड़ा है' : 'Drive Connected'}</span>
      </span>
    );
  };

  return (
    <section
      aria-label={bilingualMode ? 'Google Drive क्लाउड सिंक' : 'Google Drive Cloud Sync'}
      data-testid="google-drive-sync-bar"
      className="bg-white/90 backdrop-blur-md border border-indigo-100 rounded-3xl shadow-xl shadow-blue-950/5 px-4 sm:px-6 py-4 mb-6"
    >
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
        {/* Left: Fetch-First Status Summary */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 min-w-0">
          <div className="flex items-center gap-2 text-[#0D47A1]">
            <div className="w-7 h-7 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white flex items-center justify-center shadow-sm">
              <Cloud className="w-4 h-4 shrink-0" aria-hidden="true" />
            </div>
            <span className="text-xs font-extrabold tracking-wide uppercase">
              {bilingualMode ? 'Fetch-First क्लाउड सिंक' : 'Fetch-First Cloud Sync'}
            </span>
          </div>
          <span className="text-slate-300 hidden sm:inline" aria-hidden="true">
            |
          </span>
          {renderStatusBadge()}

          {user?.email && !needsAuth && (
            <>
              <span className="text-slate-300" aria-hidden="true">
                ·
              </span>
              <span className="text-xs text-slate-600 truncate max-w-[220px]">
                {user.email}
              </span>
            </>
          )}

          {lastSyncedAt && (
            <>
              <span className="text-slate-300" aria-hidden="true">
                ·
              </span>
              <span className="text-xs text-slate-500 tabular-nums">
                {bilingualMode ? 'अंतिम सिंक:' : 'Last sync:'}{' '}
                {new Date(lastSyncedAt).toLocaleTimeString()}
              </span>
            </>
          )}

          {statusMessage && !errorMessage && (
            <>
              <span className="text-slate-300 hidden md:inline" aria-hidden="true">
                ·
              </span>
              <span className="text-xs text-slate-600">{statusMessage}</span>
            </>
          )}
        </div>

        {/* Right: Actions */}
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {needsAuth ? (
            <button
              type="button"
              onClick={handleLinkDrive}
              disabled={isLinking}
              className="gsi-material-button focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0D47A1]"
            >
              <div className="gsi-material-button-content-wrapper">
                <div className="gsi-material-button-icon">
                  <svg
                    version="1.1"
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 48 48"
                    style={{ display: 'block' }}
                  >
                    <path
                      fill="#EA4335"
                      d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
                    />
                    <path
                      fill="#4285F4"
                      d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
                    />
                    <path
                      fill="#34A853"
                      d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
                    />
                  </svg>
                </div>
                <span className="gsi-material-button-contents">
                  {isLinking
                    ? bilingualMode
                      ? 'कनेक्ट हो रहा है...'
                      : 'Linking Drive...'
                    : bilingualMode
                      ? 'Sign in with Google (Drive लिंक करें)'
                      : 'Sign in with Google'}
                </span>
              </div>
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={handleCheckConnection}
                disabled={isBusy}
                className="inline-flex items-center gap-1.5 px-3 py-2 min-h-[40px] rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50"
              >
                <ShieldCheck className="w-3.5 h-3.5 text-[#0D47A1]" aria-hidden="true" />
                <span>{bilingualMode ? 'स्थिति जांचें' : 'Check Status'}</span>
              </button>

              <button
                type="button"
                onClick={handlePullClick}
                disabled={isBusy}
                className="inline-flex items-center gap-1.5 px-3 py-2 min-h-[40px] rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50"
              >
                <CloudDownload className="w-3.5 h-3.5 text-[#0D47A1]" aria-hidden="true" />
                <span>{bilingualMode ? 'क्लाउड से लाएं' : 'Pull from Cloud'}</span>
              </button>

              <button
                type="button"
                onClick={handlePushClick}
                disabled={isBusy}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 min-h-[40px] rounded-lg bg-[#0D47A1] hover:bg-[#083275] text-white text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50"
              >
                <CloudUpload className="w-3.5 h-3.5 text-[#F5DC7F]" aria-hidden="true" />
                <span>{bilingualMode ? 'अपडेट पुश करें' : 'Push Updates'}</span>
              </button>

              <button
                type="button"
                onClick={handleUnlink}
                disabled={isBusy}
                aria-label={bilingualMode ? 'Google Drive से डिस्कनेक्ट करें' : 'Disconnect Google Drive'}
                className="inline-flex items-center gap-1.5 px-3 py-2 min-h-[40px] rounded-lg border border-slate-200 text-slate-600 hover:text-red-700 hover:border-red-200 hover:bg-red-50/50 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" aria-hidden="true" />
                <span>{bilingualMode ? 'अनलिंक' : 'Unlink'}</span>
              </button>
            </>
          )}
        </div>
      </div>

      {errorMessage && (
        <p
          role="alert"
          className="mt-2.5 pt-2.5 border-t border-red-100 text-xs font-medium text-red-700 flex items-center gap-2"
        >
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
          <span>{errorMessage}</span>
        </p>
      )}

      {/* Explicit Confirmation Modal for Drive Push / Pull Overwrite */}
      {pendingModal && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="drive-confirm-title"
        >
          <div className="bg-white border border-slate-200 rounded-xl max-w-md w-full p-6 shadow-xl space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                {pendingModal.cloudNewerWarning ? (
                  <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" aria-hidden="true" />
                ) : (
                  <CloudUpload className="w-5 h-5 text-[#0D47A1] shrink-0" aria-hidden="true" />
                )}
                <h3 id="drive-confirm-title" className="text-base font-bold text-slate-900">
                  {pendingModal.type === 'push'
                    ? bilingualMode
                      ? 'Google Drive पर अपडेट पुश करने की पुष्टि करें'
                      : 'Confirm Push to Google Drive'
                    : bilingualMode
                      ? 'क्लाउड डेटा लागू करने की पुष्टि करें'
                      : 'Confirm Replace Local Data with Cloud'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setPendingModal(null)}
                aria-label="Close confirmation dialog"
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {pendingModal.type === 'push' ? (
              <div className="space-y-3 text-sm text-slate-600">
                <p>
                  {bilingualMode
                    ? `क्या आप वाकई Google Drive फ़ाइल "${DRIVE_SYNC_FILENAME}" को अपडेट करना चाहते हैं?`
                    : `Update "${DRIVE_SYNC_FILENAME}" in your Google Drive with your current records?`}
                </p>
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs text-slate-700 space-y-1 tabular-nums">
                  <p>
                    <span className="font-semibold">
                      {bilingualMode ? 'स्थानीय डेटा:' : 'Local records to push:'}
                    </span>{' '}
                    {students.length} students · {tests.length} tests · {results.length} results
                  </p>
                  <p>
                    <span className="font-semibold">
                      {bilingualMode ? 'क्लाउड फ़ाइल:' : 'Existing cloud snapshot:'}
                    </span>{' '}
                    {pendingModal.cloudPayload
                      ? `${pendingModal.cloudPayload.students.length} students · ${pendingModal.cloudPayload.tests.length} tests`
                      : bilingualMode
                        ? 'नई फ़ाइल बनाई जाएगी'
                        : 'New file will be created'}
                  </p>
                </div>
                {pendingModal.cloudNewerWarning && (
                  <p className="text-xs font-semibold text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-2.5">
                    {bilingualMode
                      ? 'चेतावनी: क्लाउड पर नया डेटा मिला है। पुश करने से क्लाउड डेटा ओवरराइट हो जाएगा। पहले "क्लाउड से लाएं" उपयोग करने पर विचार करें।'
                      : 'Warning: A newer cloud snapshot was detected during Fetch-First check. Pushing now will overwrite the cloud file.'}
                  </p>
                )}
              </div>
            ) : (
              <div className="space-y-3 text-sm text-slate-600">
                <p>
                  {bilingualMode
                    ? 'क्लाउड से डेटा लागू करने पर आपके वर्तमान स्थानीय रिकॉर्ड क्लाउड बैकअप से बदल दिए जाएंगे।'
                    : 'Applying the cloud snapshot will replace your current local records with the saved Google Drive data.'}
                </p>
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs text-slate-700 space-y-1 tabular-nums">
                  <p>
                    <span className="font-semibold">Cloud snapshot:</span>{' '}
                    {pendingModal.cloudPayload?.students.length ?? 0} students ·{' '}
                    {pendingModal.cloudPayload?.tests.length ?? 0} tests ·{' '}
                    {pendingModal.cloudPayload?.results.length ?? 0} results
                  </p>
                  <p>
                    <span className="font-semibold">Current local:</span> {students.length} students ·{' '}
                    {tests.length} tests · {results.length} results
                  </p>
                </div>
              </div>
            )}

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setPendingModal(null)}
                className="px-4 py-2 min-h-[40px] rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold cursor-pointer"
              >
                {bilingualMode ? 'रद्द करें' : 'Cancel'}
              </button>
              <button
                type="button"
                onClick={handleConfirmPendingAction}
                className="px-4 py-2 min-h-[40px] rounded-lg bg-[#0D47A1] hover:bg-[#083275] text-white text-xs font-semibold cursor-pointer"
              >
                {pendingModal.type === 'push'
                  ? bilingualMode
                    ? 'पुष्टि करें और पुश करें'
                    : 'Confirm & Push'
                  : bilingualMode
                    ? 'पुष्टि करें और लागू करें'
                    : 'Confirm & Apply'}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
