import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  Check,
  ClipboardCheck,
  Copy,
  Download,
  KeyRound,
  Link2,
  Lock,
  PlayCircle,
  Trash2,
} from 'lucide-react';
import {
  buildStrictOnlineExamHTML,
  loadInstitutionLogoDataUrl,
} from '../utils/offlineExamBuilder';
import { InstitutionWatermark } from './BrandingSVGs';
import { ExamPortalModal } from './ExamPortalModal';
import type { Result, Student, StudentResultModel, Test } from '../types/exam';

interface ActiveExamsPortalProps {
  bilingualMode: boolean;
  tests: Test[];
  students: Student[];
  results: Result[];
  initialExamToken?: string | null;
  onClearInitialExamToken?: () => void;
  onSaveResult: (result: StudentResultModel) => void;
  onDeleteTest: (testId: string) => void;
  onRegisterStudent?: (student: Student) => void;
}

export const ActiveExamsPortal: React.FC<ActiveExamsPortalProps> = ({
  bilingualMode,
  tests,
  students,
  results,
  initialExamToken,
  onClearInitialExamToken,
  onSaveResult,
  onDeleteTest,
  onRegisterStudent,
}) => {
  const [tokenInput, setTokenInput] = useState<string>('');
  const [tokenLookupError, setTokenLookupError] = useState<string>('');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [launchedTest, setLaunchedTest] = useState<Test | null>(null);
  const [pendingDeleteTest, setPendingDeleteTest] = useState<Test | null>(null);
  const [deleteFeedback, setDeleteFeedback] = useState<string>('');

  // Support opening an active exam directly via ?exam=<TOKEN> link
  useEffect(() => {
    if (!initialExamToken) return;
    const cleaned = initialExamToken.trim().toUpperCase();
    setTokenInput(cleaned);
    const matched = tests.find((t) => t.token.toUpperCase() === cleaned);
    if (matched) {
      setLaunchedTest(matched);
      setTokenLookupError('');
    } else {
      setTokenLookupError(
        bilingualMode
          ? `टोकन "${cleaned}" से कोई सक्रिय परीक्षा नहीं मिली।`
          : `No active exam found matching token "${cleaned}".`,
      );
    }
    onClearInitialExamToken?.();
  }, [bilingualMode, initialExamToken, onClearInitialExamToken, tests]);

  const handleCopyText = async (value: string, key: string) => {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      // Clipboard fallback
    }
    setCopiedKey(key);
    window.setTimeout(() => {
      setCopiedKey((prev) => (prev === key ? null : prev));
    }, 1800);
  };

  const handleCopyExamLink = async (token: string) => {
    const baseUrl =
      typeof window !== 'undefined'
        ? `${window.location.origin}${window.location.pathname}`
        : '';
    const link = `${baseUrl}?exam=${encodeURIComponent(token)}`;
    await handleCopyText(link, `link-${token}`);
  };

  const handleDownloadOfflineExamHtml = async (testItem: Test) => {
    const logoDataUrl = await loadInstitutionLogoDataUrl();
    const html = buildStrictOnlineExamHTML(testItem, {
      bilingualMode,
      logoDataUrl,
      students,
    });
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `SRSS-Offline-Exam-${testItem.token}.html`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleOpenByToken = (event: React.FormEvent) => {
    event.preventDefault();
    const cleaned = tokenInput.trim().toUpperCase();
    if (!cleaned) {
      setTokenLookupError(
        bilingualMode
          ? 'कृपया परीक्षा टोकन दर्ज करें (जैसे SRSS-XXXX-XXXX)।'
          : 'Please enter an exam token (e.g. SRSS-XXXX-XXXX).',
      );
      return;
    }

    const matched = tests.find((t) => t.token.toUpperCase() === cleaned);
    if (!matched) {
      setTokenLookupError(
        bilingualMode
          ? `टोकन "${cleaned}" से कोई सक्रिय परीक्षा नहीं मिली।`
          : `No active exam found matching token "${cleaned}".`,
      );
      return;
    }

    setTokenLookupError('');
    setLaunchedTest(matched);
  };

  const handleConfirmDeleteTest = () => {
    if (!pendingDeleteTest) return;
    const deletedTitle = pendingDeleteTest.title;
    const deletedToken = pendingDeleteTest.token;
    const deletedId = pendingDeleteTest.id;

    onDeleteTest(deletedId);

    if (launchedTest?.id === deletedId) {
      setLaunchedTest(null);
    }
    if (tokenInput.trim().toUpperCase() === deletedToken.toUpperCase()) {
      setTokenInput('');
      setTokenLookupError('');
    }
    setPendingDeleteTest(null);
    setDeleteFeedback(
      bilingualMode
        ? `परीक्षा "${deletedTitle}" (${deletedToken}) स्थायी रूप से हटा दी गई और सक्रिय लिंक निष्क्रिय हो गया।`
        : `Deleted test "${deletedTitle}" (${deletedToken}) and deactivated its exam link.`,
    );
    window.setTimeout(() => setDeleteFeedback(''), 3000);
  };

  return (
    <div
      id="panel-active-exams"
      role="tabpanel"
      aria-labelledby="tab-active-exams"
      data-testid="tab-panel-active-exams"
      className="space-y-6"
    >
      {/* Exam Token Portal Launcher */}
      <section className="relative overflow-hidden bg-white border border-indigo-100 rounded-3xl shadow-xl shadow-blue-950/10 p-6 sm:p-8 space-y-5">
        <InstitutionWatermark className="w-40 h-40 -right-8 -top-8 opacity-[0.06]" />
        <div className="relative pb-4 border-b border-slate-200">
          <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900">
            {bilingualMode ? 'सक्रिय परीक्षाएं एवं लाइव प्रॉक्टर्ड पोर्टल' : 'Active Exams & Proctored Student Portal'}
          </h2>
          <p className="text-sm text-slate-600 mt-1 max-w-3xl">
            {bilingualMode
              ? 'परीक्षा टोकन या लिंक खोलें, 8-अंकीय छात्र ID सत्यापित करें, और एंटी-चीट निगरानी के साथ लाइव परीक्षा शुरू करें।'
              : 'Open an exam by token or card below. Students must verify their 8-digit Student ID before entering the timed, anti-cheat proctored examination interface.'}
          </p>
        </div>

        <form onSubmit={handleOpenByToken} noValidate className="space-y-3">
          <label
            htmlFor="active-exam-token-input"
            className="block text-xs font-semibold text-slate-700"
          >
            {bilingualMode
              ? 'परीक्षा टोकन द्वारा पोर्टल खोलें (Exam Token Lookup)'
              : 'Launch Exam Portal by Token'}
          </label>
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <KeyRound
                className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                aria-hidden="true"
              />
              <input
                id="active-exam-token-input"
                type="text"
                value={tokenInput}
                onChange={(e) => {
                  setTokenInput(e.target.value);
                  setTokenLookupError('');
                }}
                placeholder="SRSS-XXXX-XXXX"
                className="w-full pl-10 pr-4 py-2.5 min-h-[42px] rounded-lg border border-slate-300 text-sm font-mono uppercase text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0D47A1]"
              />
            </div>
            <button
              type="submit"
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 min-h-[42px] rounded-lg bg-[#0D47A1] hover:bg-[#083275] text-white text-sm font-semibold transition-colors cursor-pointer whitespace-nowrap"
            >
              <PlayCircle className="w-4 h-4 text-[#F5DC7F]" aria-hidden="true" />
              <span>{bilingualMode ? 'परीक्षा पोर्टल खोलें' : 'Open Exam Portal'}</span>
            </button>
          </div>
          {tokenLookupError && (
            <p role="alert" className="text-xs font-medium text-red-600">
              {tokenLookupError}
            </p>
          )}
        </form>
      </section>

      {/* Published Active Exams List */}
      <section className="bg-white border border-indigo-100 rounded-3xl shadow-xl shadow-blue-950/10 p-6 sm:p-8 space-y-5">
        <div className="pb-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-lg font-extrabold text-slate-900">
            {bilingualMode ? 'प्रकाशित सक्रिय परीक्षाएं' : 'Published Active Exams'}
          </h3>
          <span className="text-xs font-bold text-indigo-700 tabular-nums" data-testid="active-tests-count">
            {tests.length} {bilingualMode ? 'परीक्षाएं' : 'Test(s)'}
          </span>
        </div>

        {deleteFeedback && (
          <p
            role="status"
            data-testid="delete-test-feedback"
            className="text-xs sm:text-sm font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-2xl px-4 py-2.5"
          >
            {deleteFeedback}
          </p>
        )}

        {tests.length === 0 ? (
          <div className="py-10 text-center space-y-2">
            <ClipboardCheck className="w-10 h-10 text-slate-300 mx-auto" aria-hidden="true" />
            <p className="text-sm font-semibold text-slate-700">
              {bilingualMode ? 'अभी कोई सक्रिय परीक्षा प्रकाशित नहीं है' : 'No published exams yet'}
            </p>
            <p className="text-xs text-slate-500">
              {bilingualMode
                ? 'नई परीक्षा बनाने और प्रकाशित करने के लिए "प्रश्न निर्माता" टैब पर जाएं।'
                : 'Create and publish a test in the Question Builder tab to list it here.'}
            </p>
          </div>
        ) : (
          <div
            className="grid grid-cols-1 md:grid-cols-2 gap-5"
            data-testid="published-tests-grid"
          >
            {tests.map((testItem) => {
              const tokenCopied = copiedKey === `tok-${testItem.token}`;
              const linkCopied = copiedKey === `link-${testItem.token}`;
              const submissionsCount = results.filter((r) => r.testId === testItem.id).length;
              const restrictedIds = testItem.allowedStudentIds ?? [];

              return (
                <article
                  key={testItem.id}
                  data-testid={`published-test-${testItem.token}`}
                  className="border border-indigo-100 rounded-3xl p-5 space-y-4 bg-gradient-to-br from-white via-blue-50/30 to-indigo-50/40 shadow-lg shadow-blue-950/5 flex flex-col justify-between"
                >
                  <div className="space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2.5 sm:gap-3">
                      <div className="min-w-0">
                        <h4 className="text-base font-bold text-slate-900">
                          {testItem.title}
                        </h4>
                        <p className="text-xs text-slate-500 tabular-nums mt-0.5">
                          {testItem.className} · {testItem.subject} · {testItem.questions.length}{' '}
                          {bilingualMode ? 'प्रश्न' : 'Questions'} · {testItem.totalMarks}{' '}
                          {bilingualMode ? 'अंक' : 'Marks'}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleCopyText(testItem.token, `tok-${testItem.token}`)}
                        aria-label={`Copy exam token ${testItem.token}`}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[36px] rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs font-mono font-bold text-[#0D47A1] self-start shrink-0 cursor-pointer"
                      >
                        {tokenCopied ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-600" aria-hidden="true" />
                            <span className="text-emerald-700">
                              {bilingualMode ? 'कॉपी' : 'Copied'}
                            </span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5 text-slate-500" aria-hidden="true" />
                            <span>{testItem.token}</span>
                          </>
                        )}
                      </button>
                    </div>

                    <div className="text-xs text-slate-600 pt-2 border-t border-slate-200 flex flex-wrap gap-x-4 gap-y-1 tabular-nums">
                      <span>
                        {bilingualMode ? 'अवधि:' : 'Duration:'} {testItem.durationMinutes} min
                      </span>
                      <span>
                        {bilingualMode ? 'नकारात्मक:' : 'Negative:'}{' '}
                        {testItem.negativeMarking > 0
                          ? `-${testItem.negativeMarking}`
                          : bilingualMode
                            ? 'नहीं (0)'
                            : 'None (0)'}
                      </span>
                      <span>
                        {bilingualMode ? 'अधिकतम उल्लंघन:' : 'Max Violations:'}{' '}
                        {testItem.maxViolations}
                      </span>
                      <span>
                        {bilingualMode ? 'सबमिशन:' : 'Attempts:'} {submissionsCount}
                      </span>
                    </div>

                    {restrictedIds.length > 0 && (
                      <div
                        data-testid={`test-restriction-${testItem.token}`}
                        className="flex items-start gap-2 rounded-xl bg-violet-50 border border-violet-200 px-3 py-2 text-xs text-violet-900 font-semibold tabular-nums"
                      >
                        <Lock className="w-3.5 h-3.5 text-violet-700 shrink-0 mt-0.5" aria-hidden="true" />
                        <span>
                          {bilingualMode
                            ? `केवल चयनित ID (${restrictedIds.length}): ${restrictedIds.join(', ')}`
                            : `Restricted to ID(s): ${restrictedIds.join(', ')}`}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-2.5 pt-3 border-t border-slate-200">
                    <button
                      type="button"
                      onClick={() => handleCopyExamLink(testItem.token)}
                      aria-label={`Copy exam link for ${testItem.token}`}
                      className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 min-h-[42px] rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 cursor-pointer whitespace-nowrap"
                    >
                      {linkCopied ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-600" aria-hidden="true" />
                          <span className="text-emerald-700">
                            {bilingualMode ? 'लिंक कॉपी' : 'Link Copied'}
                          </span>
                        </>
                      ) : (
                        <>
                          <Link2 className="w-3.5 h-3.5 text-slate-500" aria-hidden="true" />
                          <span>{bilingualMode ? 'लिंक कॉपी करें' : 'Copy Exam Link'}</span>
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      data-testid={`download-offline-html-${testItem.token}`}
                      onClick={() => handleDownloadOfflineExamHtml(testItem)}
                      aria-label={`Download offline HTML exam for ${testItem.title}`}
                      className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 min-h-[42px] rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 cursor-pointer whitespace-nowrap"
                    >
                      <Download className="w-3.5 h-3.5 text-[#0D47A1]" aria-hidden="true" />
                      <span>{bilingualMode ? 'ऑफ़लाइन HTML' : 'Offline HTML'}</span>
                    </button>

                    <button
                      type="button"
                      data-testid={`launch-exam-${testItem.token}`}
                      onClick={() => setLaunchedTest(testItem)}
                      className="sm:flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 min-h-[42px] rounded-lg bg-[#0D47A1] hover:bg-[#083275] text-white text-xs sm:text-sm font-semibold transition-colors cursor-pointer whitespace-nowrap"
                    >
                      <PlayCircle className="w-4 h-4 text-[#F5DC7F]" aria-hidden="true" />
                      <span>
                        {bilingualMode ? 'छात्र परीक्षा पोर्टल खोलें' : 'Launch Exam Portal'}
                      </span>
                    </button>

                    <button
                      type="button"
                      data-testid={`delete-test-${testItem.token}`}
                      onClick={() => setPendingDeleteTest(testItem)}
                      aria-label={`Delete test ${testItem.title} (${testItem.token})`}
                      className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 min-h-[42px] rounded-lg border border-red-200 bg-white hover:bg-red-50 text-xs font-semibold text-red-700 transition-colors cursor-pointer whitespace-nowrap"
                    >
                      <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>{bilingualMode ? 'हटाएं' : 'Delete Test'}</span>
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {launchedTest && (
        <ExamPortalModal
          test={launchedTest}
          bilingualMode={bilingualMode}
          students={students}
          results={results}
          onSaveResult={onSaveResult}
          onRegisterStudent={onRegisterStudent}
          onClose={() => setLaunchedTest(null)}
        />
      )}

      {pendingDeleteTest && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="confirm-delete-test-title"
          data-testid="confirm-delete-test-modal"
        >
          <div className="bg-white rounded-xl border border-slate-200 max-w-md w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-red-50 text-red-700 shrink-0">
                <AlertTriangle className="w-5 h-5" aria-hidden="true" />
              </div>
              <div className="space-y-1">
                <h3
                  id="confirm-delete-test-title"
                  className="text-base font-bold text-slate-900"
                >
                  {bilingualMode
                    ? 'क्या आप यह सक्रिय परीक्षा हटाना चाहते हैं?'
                    : 'Delete Published Test?'}
                </h3>
                <p className="text-xs sm:text-sm text-slate-600">
                  {bilingualMode
                    ? 'यह परीक्षा सूची और लोकल स्टोरेज से स्थायी रूप से हट जाएगी तथा इसका सक्रिय टोकन व लिंक तुरंत बंद हो जाएगा।'
                    : 'This permanently removes the test from your active list and local storage, immediately deactivating its exam link and token.'}
                </p>
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs space-y-1 tabular-nums">
              <p className="font-bold text-slate-900">{pendingDeleteTest.title}</p>
              <p className="text-slate-600">
                {pendingDeleteTest.className} · {pendingDeleteTest.subject} ·{' '}
                {pendingDeleteTest.questions.length}{' '}
                {bilingualMode ? 'प्रश्न' : 'Questions'}
              </p>
              <p className="font-mono font-bold text-[#0D47A1]">
                {pendingDeleteTest.token}
              </p>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setPendingDeleteTest(null)}
                className="px-4 py-2 min-h-[40px] rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 cursor-pointer"
              >
                {bilingualMode ? 'रद्द करें' : 'Cancel'}
              </button>
              <button
                type="button"
                data-testid="confirm-delete-test-btn"
                onClick={handleConfirmDeleteTest}
                className="inline-flex items-center gap-1.5 px-4 py-2 min-h-[40px] rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-semibold cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                <span>{bilingualMode ? 'हां, परीक्षा हटाएं' : 'Delete Test'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
