import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Camera,
  CheckCircle2,
  Clock,
  Eraser,
  Lock,
  Maximize2,
  Send,
  ShieldAlert,
  ShieldCheck,
  UserCheck,
  UserPlus,
  X,
} from 'lucide-react';
import {
  applyViolationEvent,
  evaluateExamSubmission,
  formatCountdown,
  verifyStudentEligibility,
} from '../utils/examEvaluation';
import {
  CLASS_OPTIONS,
  generateUniqueStudentId,
  normalizeClass,
} from '../utils/studentId';
import { InstitutionWatermark } from './BrandingSVGs';
import type {
  Result,
  Student,
  StudentResultModel,
  SubmissionReason,
  Test,
  ViolationEvent,
  ViolationType,
} from '../types/exam';

interface ExamPortalModalProps {
  test: Test;
  bilingualMode: boolean;
  students: Student[];
  results: Result[];
  onSaveResult: (result: StudentResultModel) => void;
  onRegisterStudent?: (student: Student) => void;
  onClose: () => void;
}

type ExamPhase = 'verify' | 'running' | 'submitted';

const OPTION_LETTERS = ['A', 'B', 'C', 'D'] as const;

async function resizeStudentPhotoToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read photo file.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Invalid image selected.'));
      img.onload = () => {
        const targetW = 220;
        const targetH = 260;
        const scale = Math.min(targetW / img.width, targetH / img.height, 1);
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(String(reader.result));
          return;
        }
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', 0.84));
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

function getStudentInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (!parts[0]) return 'ST';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export const ExamPortalModal: React.FC<ExamPortalModalProps> = ({
  test,
  bilingualMode,
  students,
  results,
  onSaveResult,
  onRegisterStudent,
  onClose,
}) => {
  const [phase, setPhase] = useState<ExamPhase>('verify');
  const [studentIdInput, setStudentIdInput] = useState<string>('');
  const [verifyError, setVerifyError] = useState<string>('');
  const [verifiedStudent, setVerifiedStudent] = useState<Student | null>(null);

  // Remote / New Student Full Profile + Photo Registration State (when ID not yet in local directory)
  const [showRemoteForm, setShowRemoteForm] = useState<boolean>(false);
  const [remoteName, setRemoteName] = useState<string>('');
  const [remoteFather, setRemoteFather] = useState<string>('');
  const [remoteMother, setRemoteMother] = useState<string>('');
  const [remoteClass, setRemoteClass] = useState<string>(test.className || 'Class 10');
  const [remoteRoll, setRemoteRoll] = useState<string>('');
  const [remoteMobile, setRemoteMobile] = useState<string>('');
  const [remoteAddress, setRemoteAddress] = useState<string>('');
  const [remotePhoto, setRemotePhoto] = useState<string>('');
  const [remoteError, setRemoteError] = useState<string>('');

  // Live exam state
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [answers, setAnswers] = useState<Record<string, number | null>>({});
  const [secondsLeft, setSecondsLeft] = useState<number>(
    Math.max(1, test.durationMinutes * 60),
  );
  const [violationLogs, setViolationLogs] = useState<ViolationEvent[]>([]);
  const [activeWarning, setActiveWarning] = useState<ViolationEvent | null>(null);
  const [showSubmitConfirm, setShowSubmitConfirm] = useState<boolean>(false);
  const [finalResult, setFinalResult] = useState<StudentResultModel | null>(null);

  // Refs to ensure atomic submission & anti-cheat callbacks without stale closures
  const answersRef = useRef<Record<string, number | null>>({});
  const violationLogsRef = useRef<ViolationEvent[]>([]);
  const startedAtMsRef = useRef<number>(Date.now());
  const hasSubmittedRef = useRef<boolean>(false);
  const enteredFullscreenRef = useRef<boolean>(false);
  const lastVisibilityTsRef = useRef<number>(0);

  answersRef.current = answers;
  violationLogsRef.current = violationLogs;

  const exitFullscreenSafely = useCallback(() => {
    try {
      if (document.fullscreenElement && document.exitFullscreen) {
        void document.exitFullscreen().catch(() => {});
      }
    } catch {
      // Ignore fullscreen exit errors
    }
  }, []);

  const submitExam = useCallback(
    (reason: SubmissionReason, overrideLogs?: ViolationEvent[]) => {
      if (hasSubmittedRef.current || !verifiedStudent) return;
      hasSubmittedRef.current = true;

      const logsToUse = overrideLogs ?? violationLogsRef.current;
      const elapsedSeconds = Math.max(
        1,
        Math.round((Date.now() - startedAtMsRef.current) / 1000),
      );
      const maxSeconds = Math.max(1, test.durationMinutes * 60);
      const boundedElapsed =
        reason === 'timer_expired' ? maxSeconds : Math.min(elapsedSeconds, maxSeconds);

      const evaluated = evaluateExamSubmission({
        test,
        student: verifiedStudent,
        answers: answersRef.current,
        submissionReason: reason,
        violationLogs: logsToUse,
        timeTakenSeconds: boundedElapsed,
      });

      setActiveWarning(null);
      setShowSubmitConfirm(false);
      setFinalResult(evaluated);
      setPhase('submitted');
      onSaveResult(evaluated);
      exitFullscreenSafely();
    },
    [exitFullscreenSafely, onSaveResult, test, verifiedStudent],
  );

  const registerViolation = useCallback(
    (type: ViolationType) => {
      if (hasSubmittedRef.current || phase !== 'running') return;

      const transition = applyViolationEvent({
        existingLogs: violationLogsRef.current,
        type,
        maxViolations: test.maxViolations,
        bilingualMode,
      });

      violationLogsRef.current = transition.nextLogs;
      setViolationLogs(transition.nextLogs);

      if (transition.shouldAutoSubmit) {
        submitExam('violation_limit', transition.nextLogs);
      } else {
        setActiveWarning(transition.nextLogs[transition.nextLogs.length - 1]);
      }
    },
    [bilingualMode, phase, submitExam, test.maxViolations],
  );

  // Countdown timer tick while exam is running
  useEffect(() => {
    if (phase !== 'running') return;
    const timer = window.setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          window.clearInterval(timer);
          submitExam('timer_expired');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => window.clearInterval(timer);
  }, [phase, submitExam]);

  // Strict Anti-Cheat Monitoring System: visibilitychange, blur, fullscreenchange, popstate
  useEffect(() => {
    if (phase !== 'running') return;

    const handleVisibilityChange = () => {
      if (document.hidden) {
        lastVisibilityTsRef.current = Date.now();
        registerViolation('tab_switch');
      }
    };

    const handleWindowBlur = () => {
      // Coalesce blur firing simultaneously within 150ms of visibilitychange
      if (Date.now() - lastVisibilityTsRef.current < 150) return;
      registerViolation('window_blur');
    };

    const handleFullscreenChange = () => {
      if (document.fullscreenElement) {
        enteredFullscreenRef.current = true;
      } else if (enteredFullscreenRef.current) {
        registerViolation('fullscreen_exit');
      }
    };

    const handlePopState = () => {
      try {
        window.history.pushState({ srssExamLock: true }, '');
      } catch {
        // Ignore history push errors
      }
      registerViolation('back_button');
    };

    try {
      window.history.pushState({ srssExamLock: true }, '');
    } catch {
      // Ignore history push errors
    }

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleWindowBlur);
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    window.addEventListener('popstate', handlePopState);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleWindowBlur);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      window.removeEventListener('popstate', handlePopState);
    };
  }, [phase, registerViolation]);

  const handleVerifyStudent = (event: React.FormEvent) => {
    event.preventDefault();
    const check = verifyStudentEligibility({
      rawStudentId: studentIdInput,
      test,
      students,
      results,
    });

    if (!check.eligible || !check.student) {
      setVerifiedStudent(null);
      setVerifyError(bilingualMode ? check.reasonHi : check.reasonEn);
      if (check.status === 'not_found') {
        setShowRemoteForm(true);
      }
      return;
    }

    setVerifyError('');
    setShowRemoteForm(false);
    setVerifiedStudent(check.student);
  };

  const handleRemotePhotoChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setRemoteError(
        bilingualMode ? 'कृपया मान्य फोटो फ़ाइल (JPG/PNG) चुनें।' : 'Please select a valid photo image (JPG/PNG).',
      );
      return;
    }
    try {
      const dataUrl = await resizeStudentPhotoToDataUrl(file);
      setRemotePhoto(dataUrl);
      setRemoteError('');
    } catch {
      setRemoteError(
        bilingualMode ? 'फोटो प्रोसेस करने में त्रुटि हुई।' : 'Could not process the selected photo.',
      );
    }
  };

  const handleRemoteStudentRegister = (event: React.FormEvent) => {
    event.preventDefault();
    const cleanedInputId = studentIdInput.replace(/\D/g, '');
    if (!remoteName.trim()) {
      setRemoteError(bilingualMode ? 'छात्र का पूरा नाम आवश्यक है।' : 'Full Name is required.');
      return;
    }
    if (!remoteFather.trim()) {
      setRemoteError(bilingualMode ? 'पिता का नाम आवश्यक है।' : "Father's Name is required.");
      return;
    }
    if (!remoteMother.trim()) {
      setRemoteError(bilingualMode ? 'माता का नाम आवश्यक है।' : "Mother's Name is required.");
      return;
    }
    if (!remoteRoll.trim()) {
      setRemoteError(bilingualMode ? 'रोल नंबर आवश्यक है।' : 'Roll Number is required.');
      return;
    }
    const cleanedMobile = remoteMobile.replace(/\D/g, '');
    if (cleanedMobile.length < 10) {
      setRemoteError(
        bilingualMode ? '10 अंकों का मान्य WhatsApp मोबाइल नंबर दर्ज करें।' : 'Enter a valid 10-digit WhatsApp Mobile number.',
      );
      return;
    }
    if (!remoteAddress.trim()) {
      setRemoteError(bilingualMode ? 'पूरा पता आवश्यक है।' : 'Full Address is required.');
      return;
    }

    const assignedId =
      cleanedInputId.length === 8
        ? cleanedInputId
        : generateUniqueStudentId(students.map((s) => s.studentId));

    const allowedList = Array.isArray(test.allowedStudentIds)
      ? test.allowedStudentIds.filter((id) => /^\d{8}$/.test(id))
      : [];
    if (allowedList.length > 0 && !allowedList.includes(assignedId)) {
      setRemoteError(
        bilingualMode
          ? `प्रवेश प्रतिबंधित: छात्र ID ${assignedId} इस विशेष परीक्षा के लिए अधिकृत नहीं है।`
          : `Access Restricted: Student ID ${assignedId} is not authorized for this specific test.`,
      );
      return;
    }

    const existingAttempt = results.find(
      (r) => r.testId === test.id && r.studentId === assignedId,
    );
    if (existingAttempt) {
      setRemoteError(
        bilingualMode
          ? `ID ${assignedId} पहले ही इस परीक्षा को जमा कर चुका है।`
          : `Student ID ${assignedId} has already attempted this exam.`,
      );
      return;
    }

    const now = new Date().toISOString();
    const newStudent: Student = {
      id: assignedId,
      studentId: assignedId,
      name: remoteName.trim(),
      fatherName: remoteFather.trim(),
      motherName: remoteMother.trim(),
      className: normalizeClass(remoteClass),
      rollNumber: remoteRoll.trim(),
      whatsappMobile: cleanedMobile,
      address: remoteAddress.trim(),
      photoDataUrl: remotePhoto || undefined,
      createdAt: now,
      updatedAt: now,
    };

    onRegisterStudent?.(newStudent);
    setStudentIdInput(assignedId);
    setVerifiedStudent(newStudent);
    setVerifyError('');
    setRemoteError('');
    setShowRemoteForm(false);
  };

  const handleBeginExam = async () => {
    if (!verifiedStudent) return;
    hasSubmittedRef.current = false;
    enteredFullscreenRef.current = Boolean(document.fullscreenElement);
    lastVisibilityTsRef.current = 0;
    startedAtMsRef.current = Date.now();
    answersRef.current = {};
    violationLogsRef.current = [];
    setAnswers({});
    setViolationLogs([]);
    setActiveWarning(null);
    setCurrentIndex(0);
    setSecondsLeft(Math.max(1, test.durationMinutes * 60));

    try {
      if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen();
        enteredFullscreenRef.current = true;
      }
    } catch {
      // Headless browsers or sandboxed iframes may reject programmatic fullscreen
      enteredFullscreenRef.current = Boolean(document.fullscreenElement);
    }

    setPhase('running');
  };

  const handleSelectOption = (questionId: string, optionIndex: 0 | 1 | 2 | 3) => {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: optionIndex,
    }));
  };

  const handleClearResponse = (questionId: string) => {
    setAnswers((prev) => {
      const next = { ...prev };
      delete next[questionId];
      return next;
    });
  };

  const answeredCount = useMemo(
    () =>
      test.questions.reduce((acc, q) => {
        const val = answers[q.id];
        return val === 0 || val === 1 || val === 2 || val === 3 ? acc + 1 : acc;
      }, 0),
    [answers, test.questions],
  );
  const unansweredCount = test.questions.length - answeredCount;
  const currentQuestion = test.questions[currentIndex] ?? test.questions[0];
  const isLowTime = secondsLeft <= 120;

  return (
    <div
      className="fixed inset-0 z-50 bg-[#F8FAFC] overflow-y-auto flex flex-col"
      role="dialog"
      aria-modal="true"
      aria-labelledby="exam-portal-heading"
      data-testid="exam-portal-modal"
    >
      {/* Top Proctored Exam Bar */}
      <header className="bg-gradient-to-r from-[#0A367E] via-[#1557C0] to-[#312E81] text-white border-b-4 border-[#D4AF37] shadow-lg sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold text-[#F5DC7F]">
              {test.className} · {test.subject} · {test.token}
            </p>
            <h2
              id="exam-portal-heading"
              className="text-base sm:text-lg font-bold truncate"
            >
              {test.title}
            </h2>
          </div>

          {phase === 'running' && verifiedStudent ? (
            <div className="flex flex-wrap items-center gap-3 sm:gap-5 shrink-0">
              <div className="hidden sm:flex items-center gap-2.5">
                {verifiedStudent.photoDataUrl ? (
                  <img
                    src={verifiedStudent.photoDataUrl}
                    alt={verifiedStudent.name}
                    className="w-9 h-9 rounded-lg object-cover border border-[#D4AF37]"
                  />
                ) : (
                  <div className="w-9 h-9 rounded-lg bg-[#083275] border border-[#D4AF37] text-[#F5DC7F] text-xs font-bold flex items-center justify-center">
                    {getStudentInitials(verifiedStudent.name)}
                  </div>
                )}
                <div className="text-right">
                  <p className="text-xs text-slate-100 font-semibold">{verifiedStudent.name}</p>
                  <p className="text-xs font-mono text-[#F5DC7F] tabular-nums">
                    ID: {verifiedStudent.studentId} · Roll {verifiedStudent.rollNumber}
                  </p>
                </div>
              </div>

              {/* Anti-Cheat Violation Counter */}
              <div
                data-testid="exam-violation-counter"
                className={`px-3 py-1.5 rounded-lg border text-xs font-semibold tabular-nums flex items-center gap-1.5 ${
                  violationLogs.length > 0
                    ? 'bg-red-950/60 border-red-400 text-red-100'
                    : 'bg-[#083275] border-[#1E5BB8] text-slate-100'
                }`}
              >
                <ShieldAlert className="w-4 h-4 text-[#F5DC7F]" aria-hidden="true" />
                <span>
                  {bilingualMode ? 'उल्लंघन:' : 'Violations:'} {violationLogs.length} /{' '}
                  {test.maxViolations}
                </span>
              </div>

              {/* Countdown Clock */}
              <div
                data-testid="exam-countdown-timer"
                className={`px-3.5 py-1.5 rounded-lg border font-mono text-sm sm:text-base font-bold tabular-nums flex items-center gap-2 ${
                  isLowTime
                    ? 'bg-red-600 border-red-300 text-white'
                    : 'bg-white text-[#0D47A1] border-[#D4AF37]'
                }`}
              >
                <Clock className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>{formatCountdown(secondsLeft)}</span>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => {
                exitFullscreenSafely();
                onClose();
              }}
              aria-label={bilingualMode ? 'परीक्षा पोर्टल बंद करें' : 'Close exam portal'}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 min-h-[40px] rounded-lg bg-[#083275] hover:bg-[#06265B] text-white text-xs font-semibold cursor-pointer"
            >
              <X className="w-4 h-4" aria-hidden="true" />
              <span>{bilingualMode ? 'बंद करें' : 'Close'}</span>
            </button>
          )}
        </div>
      </header>

      {/* Main Content Container */}
      <div className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {/* PHASE 1: STUDENT VERIFICATION PORTAL */}
        {phase === 'verify' && (
          <div className="max-w-2xl mx-auto space-y-6">
            <section className="relative overflow-hidden bg-white border border-indigo-100 rounded-3xl shadow-2xl shadow-blue-950/10 p-6 sm:p-8 space-y-6">
              <InstitutionWatermark className="w-48 h-48 -right-10 -top-10 opacity-[0.07]" />
              <div className="relative pb-4 border-b border-slate-200">
                <p className="text-xs font-bold text-[#0D47A1]">
                  {bilingualMode ? 'छात्र परीक्षा पोर्टल एवं सत्यापन' : 'Student Exam Verification Portal'}
                </p>
                <h3 className="text-xl sm:text-2xl font-extrabold text-slate-900 mt-1">
                  {test.title}
                </h3>
                <p className="text-xs sm:text-sm text-slate-600 tabular-nums mt-1">
                  {test.className} · {test.subject} · {test.questions.length}{' '}
                  {bilingualMode ? 'प्रश्न' : 'Questions'} · {test.totalMarks}{' '}
                  {bilingualMode ? 'अंक' : 'Marks'} · {test.durationMinutes}{' '}
                  {bilingualMode ? 'मिनट' : 'min'} ·{' '}
                  {bilingualMode ? 'अधिकतम उल्लंघन:' : 'Max Violations:'} {test.maxViolations}
                </p>
                {Array.isArray(test.allowedStudentIds) && test.allowedStudentIds.length > 0 && (
                  <p
                    data-testid="portal-restriction-notice"
                    className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-violet-50 border border-violet-200 px-3 py-1.5 text-xs font-semibold text-violet-900 tabular-nums"
                  >
                    <Lock className="w-3.5 h-3.5 text-violet-700 shrink-0" aria-hidden="true" />
                    <span>
                      {bilingualMode
                        ? `प्रतिबंधित परीक्षा: केवल अधिकृत छात्र ID ही प्रवेश कर सकते हैं (${test.allowedStudentIds.join(', ')})`
                        : `Restricted Test: Only authorized Student ID(s) can enter (${test.allowedStudentIds.join(', ')})`}
                    </span>
                  </p>
                )}
              </div>

              <form onSubmit={handleVerifyStudent} noValidate className="space-y-4">
                <div>
                  <label
                    htmlFor="exam-student-id"
                    className="block text-xs font-semibold text-slate-700 mb-1.5"
                  >
                    {bilingualMode
                      ? '8-अंकीय छात्र ID दर्ज करें *'
                      : 'Enter 8-Digit Student ID *'}
                  </label>
                  <div className="flex flex-col sm:flex-row gap-3">
                    <input
                      id="exam-student-id"
                      type="text"
                      inputMode="numeric"
                      maxLength={12}
                      value={studentIdInput}
                      onChange={(e) => {
                        setStudentIdInput(e.target.value);
                        setVerifyError('');
                        setVerifiedStudent(null);
                      }}
                      placeholder={bilingualMode ? 'जैसे: 48291047' : 'e.g. 48291047'}
                      className="flex-1 px-4 py-2.5 min-h-[44px] rounded-lg border border-slate-300 text-sm font-mono tabular-nums text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0D47A1]"
                    />
                    <button
                      type="submit"
                      className="inline-flex items-center justify-center gap-2 px-5 py-2.5 min-h-[44px] rounded-lg bg-[#0D47A1] hover:bg-[#083275] text-white text-sm font-semibold transition-colors cursor-pointer whitespace-nowrap"
                    >
                      <UserCheck className="w-4 h-4 text-[#F5DC7F]" aria-hidden="true" />
                      <span>{bilingualMode ? 'ID सत्यापित करें' : 'Verify Student ID'}</span>
                    </button>
                  </div>
                </div>

                {verifyError && (
                  <div
                    role="alert"
                    data-testid="exam-verify-error"
                    className="bg-red-50 border border-red-200 rounded-lg p-3.5 flex items-start gap-2.5 text-xs sm:text-sm font-medium text-red-800"
                  >
                    <Lock className="w-4 h-4 text-red-600 shrink-0 mt-0.5" aria-hidden="true" />
                    <span>{verifyError}</span>
                  </div>
                )}

                {!verifiedStudent &&
                  !(Array.isArray(test.allowedStudentIds) && test.allowedStudentIds.length > 0) && (
                    <div className="flex items-center justify-between pt-1">
                      <button
                        type="button"
                        data-testid="toggle-remote-student-form"
                        onClick={() => {
                          setShowRemoteForm((prev) => !prev);
                          setRemoteError('');
                        }}
                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#0D47A1] hover:underline cursor-pointer"
                      >
                        <UserPlus className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>
                          {showRemoteForm
                            ? bilingualMode
                              ? 'नया छात्र फ़ॉर्म छिपाएं'
                              : 'Hide New / Remote Student Form'
                            : bilingualMode
                              ? 'ID नहीं है या किसी अन्य डिवाइस से परीक्षा दे रहे हैं? पूरा विवरण और फोटो भरें'
                              : 'New or Remote Student? Fill Full Details & Photo to Start'}
                        </span>
                      </button>
                    </div>
                  )}
              </form>

              {/* Remote / New Student Registration Form (Full Details + Photo) */}
              {showRemoteForm && !verifiedStudent && (
                <form
                  onSubmit={handleRemoteStudentRegister}
                  noValidate
                  data-testid="remote-student-form"
                  className="pt-5 border-t border-slate-200 space-y-4"
                >
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="text-sm font-bold text-[#0D47A1] flex items-center gap-2">
                      <UserPlus className="w-4 h-4" aria-hidden="true" />
                      <span>
                        {bilingualMode
                          ? 'छात्र का पूरा विवरण एवं फोटो पंजीकरण'
                          : 'Complete Student Profile & Photo Registration'}
                      </span>
                    </h4>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div>
                      <label htmlFor="remote-name" className="block text-xs font-semibold text-slate-700 mb-1">
                        {bilingualMode ? 'छात्र का पूरा नाम *' : 'Full Name *'}
                      </label>
                      <input
                        id="remote-name"
                        type="text"
                        value={remoteName}
                        onChange={(e) => setRemoteName(e.target.value)}
                        placeholder="e.g. Aarav Kumar"
                        className="w-full px-3 py-2 min-h-[40px] rounded-lg border border-slate-300 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0D47A1]"
                      />
                    </div>
                    <div>
                      <label htmlFor="remote-father" className="block text-xs font-semibold text-slate-700 mb-1">
                        {bilingualMode ? 'पिता का नाम *' : "Father's Name *"}
                      </label>
                      <input
                        id="remote-father"
                        type="text"
                        value={remoteFather}
                        onChange={(e) => setRemoteFather(e.target.value)}
                        placeholder="e.g. Rajesh Kumar"
                        className="w-full px-3 py-2 min-h-[40px] rounded-lg border border-slate-300 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0D47A1]"
                      />
                    </div>
                    <div>
                      <label htmlFor="remote-mother" className="block text-xs font-semibold text-slate-700 mb-1">
                        {bilingualMode ? 'माता का नाम *' : "Mother's Name *"}
                      </label>
                      <input
                        id="remote-mother"
                        type="text"
                        value={remoteMother}
                        onChange={(e) => setRemoteMother(e.target.value)}
                        placeholder="e.g. Sunita Devi"
                        className="w-full px-3 py-2 min-h-[40px] rounded-lg border border-slate-300 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0D47A1]"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2.5">
                      <div>
                        <label htmlFor="remote-class" className="block text-xs font-semibold text-slate-700 mb-1">
                          {bilingualMode ? 'कक्षा *' : 'Class *'}
                        </label>
                        <select
                          id="remote-class"
                          value={remoteClass}
                          onChange={(e) => setRemoteClass(e.target.value)}
                          className="w-full px-2.5 py-2 min-h-[40px] rounded-lg border border-slate-300 bg-white text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0D47A1]"
                        >
                          {CLASS_OPTIONS.map((cls) => (
                            <option key={cls} value={cls}>
                              {cls}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label htmlFor="remote-roll" className="block text-xs font-semibold text-slate-700 mb-1">
                          {bilingualMode ? 'रोल नं. *' : 'Roll No *'}
                        </label>
                        <input
                          id="remote-roll"
                          type="text"
                          value={remoteRoll}
                          onChange={(e) => setRemoteRoll(e.target.value)}
                          placeholder="e.g. 15"
                          className="w-full px-3 py-2 min-h-[40px] rounded-lg border border-slate-300 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0D47A1]"
                        />
                      </div>
                    </div>
                    <div>
                      <label htmlFor="remote-mobile" className="block text-xs font-semibold text-slate-700 mb-1">
                        {bilingualMode ? 'WhatsApp मोबाइल *' : 'WhatsApp Mobile *'}
                      </label>
                      <input
                        id="remote-mobile"
                        type="tel"
                        value={remoteMobile}
                        onChange={(e) => setRemoteMobile(e.target.value)}
                        placeholder="10-digit mobile"
                        className="w-full px-3 py-2 min-h-[40px] rounded-lg border border-slate-300 text-sm text-slate-900 font-mono tabular-nums focus:outline-none focus:ring-2 focus:ring-[#0D47A1]"
                      />
                    </div>
                    <div>
                      <label htmlFor="remote-address" className="block text-xs font-semibold text-slate-700 mb-1">
                        {bilingualMode ? 'पूरा पता *' : 'Full Address *'}
                      </label>
                      <input
                        id="remote-address"
                        type="text"
                        value={remoteAddress}
                        onChange={(e) => setRemoteAddress(e.target.value)}
                        placeholder="Village / Town / Pin"
                        className="w-full px-3 py-2 min-h-[40px] rounded-lg border border-slate-300 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0D47A1]"
                      />
                    </div>
                  </div>

                  {/* Student Photo Upload */}
                  <div className="flex flex-wrap items-center gap-4 pt-1">
                    {remotePhoto ? (
                      <img
                        src={remotePhoto}
                        alt="Student preview"
                        data-testid="remote-photo-preview"
                        className="w-16 h-20 rounded-lg object-cover border-2 border-[#D4AF37]"
                      />
                    ) : (
                      <div className="w-16 h-20 rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 flex items-center justify-center text-slate-400">
                        <Camera className="w-5 h-5" aria-hidden="true" />
                      </div>
                    )}
                    <div className="space-y-1.5">
                      <label
                        htmlFor="remote-student-photo"
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 min-h-[38px] rounded-lg border border-[#0D47A1] bg-blue-50/70 hover:bg-blue-100/70 text-xs font-semibold text-[#0D47A1] cursor-pointer"
                      >
                        <Camera className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>
                          {bilingualMode ? 'छात्र फोटो अपलोड करें' : 'Upload Student Photo'}
                        </span>
                        <input
                          id="remote-student-photo"
                          data-testid="remote-student-photo-input"
                          type="file"
                          accept="image/*"
                          onChange={handleRemotePhotoChange}
                          className="sr-only"
                        />
                      </label>
                      <p className="text-[11px] text-slate-500">
                        {bilingualMode
                          ? 'अंकपत्र और परिणाम में यह फोटो व पूरा विवरण जुड़ेगा।'
                          : 'Your photo and full details will be attached to the marksheet & result.'}
                      </p>
                    </div>
                  </div>

                  {remoteError && (
                    <p role="alert" className="text-xs font-medium text-red-600">
                      {remoteError}
                    </p>
                  )}

                  <div className="flex justify-end">
                    <button
                      type="submit"
                      data-testid="remote-register-submit-btn"
                      className="inline-flex items-center gap-2 px-5 py-2.5 min-h-[42px] rounded-lg bg-[#0D47A1] hover:bg-[#083275] text-white text-xs sm:text-sm font-semibold cursor-pointer"
                    >
                      <UserCheck className="w-4 h-4 text-[#F5DC7F]" aria-hidden="true" />
                      <span>
                        {bilingualMode ? 'विवरण सहेजें और सत्यापित करें' : 'Save Profile & Verify'}
                      </span>
                    </button>
                  </div>
                </form>
              )}

              {/* Verified Student Admit Summary (Full Profile + Photo) */}
              {verifiedStudent && (
                <div
                  data-testid="verified-student-card"
                  className="pt-5 border-t border-slate-200 space-y-4"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 text-emerald-800 font-bold text-sm">
                      <ShieldCheck className="w-5 h-5 text-emerald-600" aria-hidden="true" />
                      <span>
                        {bilingualMode ? 'छात्र सत्यापित — परीक्षा के लिए पात्र' : 'Student Verified — Eligible to Start'}
                      </span>
                    </div>
                    <span className="text-xs font-mono font-bold text-[#0D47A1] tabular-nums">
                      ID: {verifiedStudent.studentId}
                    </span>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-4 py-3 border-y border-slate-200 items-start">
                    <div className="shrink-0">
                      {verifiedStudent.photoDataUrl ? (
                        <img
                          src={verifiedStudent.photoDataUrl}
                          alt={verifiedStudent.name}
                          data-testid="verified-student-photo"
                          className="w-20 h-24 rounded-lg object-cover border-2 border-[#D4AF37]"
                        />
                      ) : (
                        <div className="w-20 h-24 rounded-lg border-2 border-[#D4AF37] bg-slate-100 flex flex-col items-center justify-center text-[#0D47A1]">
                          <span className="text-lg font-bold">
                            {getStudentInitials(verifiedStudent.name)}
                          </span>
                          <span className="text-[10px] text-slate-500">Photo</span>
                        </div>
                      )}
                    </div>

                    <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-slate-700 flex-1 w-full">
                      <div>
                        <dt className="text-slate-500">{bilingualMode ? 'नाम:' : 'Name:'}</dt>
                        <dd className="font-semibold text-slate-900 mt-0.5">{verifiedStudent.name}</dd>
                      </div>
                      <div>
                        <dt className="text-slate-500">{bilingualMode ? 'पिता का नाम:' : "Father's Name:"}</dt>
                        <dd className="font-semibold text-slate-900 mt-0.5">{verifiedStudent.fatherName}</dd>
                      </div>
                      <div>
                        <dt className="text-slate-500">{bilingualMode ? 'माता का नाम:' : "Mother's Name:"}</dt>
                        <dd className="font-semibold text-slate-900 mt-0.5">{verifiedStudent.motherName || '—'}</dd>
                      </div>
                      <div>
                        <dt className="text-slate-500">{bilingualMode ? 'कक्षा एवं रोल:' : 'Class & Roll:'}</dt>
                        <dd className="font-semibold text-slate-900 tabular-nums mt-0.5">
                          {verifiedStudent.className} · Roll {verifiedStudent.rollNumber}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-slate-500">{bilingualMode ? 'WhatsApp मोबाइल:' : 'WhatsApp Mobile:'}</dt>
                        <dd className="font-mono font-semibold text-slate-900 tabular-nums mt-0.5">
                          {verifiedStudent.whatsappMobile}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-slate-500">{bilingualMode ? 'पता:' : 'Address:'}</dt>
                        <dd className="font-semibold text-slate-900 mt-0.5">{verifiedStudent.address || '—'}</dd>
                      </div>
                    </dl>
                  </div>

                  <div className="text-xs text-slate-600 space-y-1">
                    <p className="font-semibold text-slate-800 flex items-center gap-1.5">
                      <ShieldAlert className="w-4 h-4 text-amber-600" aria-hidden="true" />
                      <span>
                        {bilingualMode
                          ? 'सख्त एंटी-चीट निगरानी नियम:'
                          : 'Strict Anti-Cheat Proctoring Rules:'}
                      </span>
                    </p>
                    <p>
                      {bilingualMode
                        ? `टैब बदलना, विंडो फ़ोकस खोना, फ़ुल-स्क्रीन से बाहर निकलना या बैक बटन दबाना उल्लंघन के रूप में गिना जाएगा। ${test.maxViolations} उल्लंघनों पर परीक्षा स्वतः सबमिट हो जाएगी।`
                        : `Tab switches, window focus loss, exiting full-screen, and back-button presses are monitored. Reaching ${test.maxViolations} violations will auto-submit your exam.`}
                    </p>
                  </div>

                  <button
                    type="button"
                    data-testid="start-proctored-exam-btn"
                    onClick={handleBeginExam}
                    className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 min-h-[46px] rounded-lg bg-[#0D47A1] hover:bg-[#083275] text-white text-sm font-bold transition-colors cursor-pointer"
                  >
                    <Maximize2 className="w-4 h-4 text-[#F5DC7F]" aria-hidden="true" />
                    <span>
                      {bilingualMode ? 'प्रॉक्टर्ड परीक्षा शुरू करें' : 'Begin Proctored Exam'}
                    </span>
                  </button>
                </div>
              )}
            </section>
          </div>
        )}

        {/* PHASE 2: LIVE EXAMINATION INTERFACE */}
        {phase === 'running' && currentQuestion && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left/Main Stage: Question & Options A/B/C/D */}
            <section className="lg:col-span-8 bg-white border border-indigo-100 rounded-3xl shadow-xl shadow-blue-950/5 p-6 sm:p-8 space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-2 pb-4 border-b border-slate-200">
                <h3 className="text-base sm:text-lg font-bold text-[#0D47A1] tabular-nums">
                  {bilingualMode
                    ? `प्रश्न ${currentIndex + 1} / ${test.questions.length}`
                    : `Question ${currentIndex + 1} of ${test.questions.length}`}
                </h3>
                <span className="text-xs font-mono font-semibold text-slate-600 tabular-nums">
                  +{currentQuestion.marks ?? test.marksPerQuestion}{' '}
                  {bilingualMode ? 'अंक' : 'Marks'}
                  {(currentQuestion.negativeMarks ?? test.negativeMarking) > 0
                    ? ` · -${currentQuestion.negativeMarks ?? test.negativeMarking} ${
                        bilingualMode ? 'नकारात्मक' : 'Negative'
                      }`
                    : ''}
                </span>
              </div>

              <div className="space-y-4">
                <p
                  data-testid="live-question-text"
                  className="text-base sm:text-lg font-semibold text-slate-900 whitespace-pre-line leading-relaxed"
                >
                  {currentQuestion.questionText}
                </p>

                {currentQuestion.questionImage && (
                  <div className="pt-1">
                    <img
                      src={currentQuestion.questionImage}
                      alt={`Question ${currentIndex + 1} diagram`}
                      referrerPolicy="no-referrer"
                      className="max-h-64 rounded-lg border border-slate-200 object-contain bg-white"
                    />
                  </div>
                )}
              </div>

              {/* Options A, B, C, D */}
              <div
                role="radiogroup"
                aria-label={`Options for Question ${currentIndex + 1}`}
                className="space-y-3"
              >
                {OPTION_LETTERS.map((letter, optIndex) => {
                  const typedIdx = optIndex as 0 | 1 | 2 | 3;
                  const isSelected = answers[currentQuestion.id] === typedIdx;
                  return (
                    <button
                      key={letter}
                      type="button"
                      role="radio"
                      aria-checked={isSelected}
                      data-testid={`live-option-${letter}`}
                      onClick={() => handleSelectOption(currentQuestion.id, typedIdx)}
                      className={`w-full text-left px-4 py-3.5 min-h-[48px] rounded-xl border transition-colors flex items-center gap-3.5 cursor-pointer ${
                        isSelected
                          ? 'bg-[#EFF6FF] border-[#0D47A1] text-slate-950 font-semibold ring-1 ring-[#0D47A1]'
                          : 'bg-white border-slate-300 text-slate-800 hover:bg-slate-50'
                      }`}
                    >
                      <span
                        className={`w-7 h-7 rounded-lg text-xs font-bold flex items-center justify-center shrink-0 ${
                          isSelected
                            ? 'bg-[#0D47A1] text-white'
                            : 'bg-slate-100 text-slate-700 border border-slate-300'
                        }`}
                      >
                        {letter}
                      </span>
                      <span className="text-sm sm:text-base">{currentQuestion.options[typedIdx]}</span>
                    </button>
                  );
                })}
              </div>

              {/* Bottom Navigation Controls */}
              <div className="pt-5 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    disabled={currentIndex === 0}
                    onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))}
                    className="inline-flex items-center gap-1.5 px-4 py-2.5 min-h-[42px] rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs sm:text-sm font-semibold text-slate-700 disabled:opacity-40 cursor-pointer"
                  >
                    <ArrowLeft className="w-4 h-4" aria-hidden="true" />
                    <span>{bilingualMode ? 'पिछला' : 'Previous'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleClearResponse(currentQuestion.id)}
                    disabled={answers[currentQuestion.id] === undefined}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2.5 min-h-[42px] rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs sm:text-sm font-semibold text-slate-600 disabled:opacity-40 cursor-pointer"
                  >
                    <Eraser className="w-4 h-4" aria-hidden="true" />
                    <span>{bilingualMode ? 'उत्तर साफ़ करें' : 'Clear'}</span>
                  </button>
                </div>

                <div className="flex items-center gap-2.5">
                  {currentIndex < test.questions.length - 1 ? (
                    <button
                      type="button"
                      onClick={() =>
                        setCurrentIndex((i) => Math.min(test.questions.length - 1, i + 1))
                      }
                      className="inline-flex items-center gap-1.5 px-5 py-2.5 min-h-[42px] rounded-lg bg-[#0D47A1] hover:bg-[#083275] text-white text-xs sm:text-sm font-semibold cursor-pointer"
                    >
                      <span>{bilingualMode ? 'अगला प्रश्न' : 'Next'}</span>
                      <ArrowRight className="w-4 h-4" aria-hidden="true" />
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setShowSubmitConfirm(true)}
                      className="inline-flex items-center gap-1.5 px-5 py-2.5 min-h-[42px] rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs sm:text-sm font-semibold cursor-pointer"
                    >
                      <Send className="w-4 h-4" aria-hidden="true" />
                      <span>{bilingualMode ? 'परीक्षा जमा करें' : 'Submit Exam'}</span>
                    </button>
                  )}
                </div>
              </div>
            </section>

            {/* Right Control Deck: Question Navigation Palette */}
            <aside className="lg:col-span-4 bg-white border border-indigo-100 rounded-3xl shadow-xl shadow-blue-950/5 p-6 space-y-5">
              <div className="pb-3 border-b border-slate-200">
                <h3 className="text-base font-bold text-slate-900">
                  {bilingualMode ? 'प्रश्न नेविगेशन पैलेट' : 'Question Navigation Palette'}
                </h3>
                <p className="text-xs text-slate-600 tabular-nums mt-1">
                  {bilingualMode
                    ? `उत्तर दिए: ${answeredCount} · शेष: ${unansweredCount}`
                    : `Answered: ${answeredCount} · Unattempted: ${unansweredCount}`}
                </p>
              </div>

              <div
                data-testid="question-palette-grid"
                className="grid grid-cols-5 gap-2.5"
              >
                {test.questions.map((q, idx) => {
                  const isCurrent = idx === currentIndex;
                  const isAnswered =
                    answers[q.id] === 0 ||
                    answers[q.id] === 1 ||
                    answers[q.id] === 2 ||
                    answers[q.id] === 3;

                  return (
                    <button
                      key={q.id}
                      type="button"
                      data-testid={`palette-q-${idx + 1}`}
                      onClick={() => setCurrentIndex(idx)}
                      aria-label={`Question ${idx + 1} (${
                        isCurrent ? 'Current' : isAnswered ? 'Answered' : 'Unattempted'
                      })`}
                      className={`h-10 rounded-lg border text-xs font-mono font-bold tabular-nums transition-colors cursor-pointer ${
                        isCurrent
                          ? 'bg-[#0D47A1] border-[#0D47A1] text-white'
                          : isAnswered
                            ? 'bg-emerald-50 border-emerald-400 text-emerald-900'
                            : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      {idx + 1}
                    </button>
                  );
                })}
              </div>

              <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-slate-600 pt-2 border-t border-slate-100">
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded bg-[#0D47A1] inline-block" aria-hidden="true" />
                  <span>{bilingualMode ? 'वर्तमान' : 'Current'}</span>
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span
                    className="w-3 h-3 rounded bg-emerald-100 border border-emerald-500 inline-block"
                    aria-hidden="true"
                  />
                  <span>{bilingualMode ? 'उत्तर दिया' : 'Answered'}</span>
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span
                    className="w-3 h-3 rounded bg-white border border-slate-400 inline-block"
                    aria-hidden="true"
                  />
                  <span>{bilingualMode ? 'अप्रयासित' : 'Unattempted'}</span>
                </span>
              </div>

              <button
                type="button"
                data-testid="palette-submit-exam-btn"
                onClick={() => setShowSubmitConfirm(true)}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 min-h-[44px] rounded-lg bg-[#0D47A1] hover:bg-[#083275] text-white text-sm font-semibold transition-colors cursor-pointer"
              >
                <Send className="w-4 h-4 text-[#F5DC7F]" aria-hidden="true" />
                <span>{bilingualMode ? 'अंतिम परीक्षा जमा करें' : 'Finish & Submit Exam'}</span>
              </button>
            </aside>
          </div>
        )}

        {/* PHASE 3: SUBMISSION SCORECARD */}
        {phase === 'submitted' && finalResult && (
          <div className="max-w-2xl mx-auto">
            <section
              data-testid="exam-submission-receipt"
              className="relative overflow-hidden bg-white border border-indigo-100 rounded-3xl shadow-2xl shadow-blue-950/10 p-6 sm:p-8 space-y-6"
            >
              <InstitutionWatermark className="w-44 h-44 -right-8 -top-8 opacity-[0.06]" />
              <div className="pb-5 border-b border-slate-200 space-y-2">
                <div className="flex items-center gap-2 text-sm font-bold">
                  {finalResult.submissionReason === 'violation_limit' ? (
                    <>
                      <ShieldAlert className="w-5 h-5 text-red-600" aria-hidden="true" />
                      <span className="text-red-700" data-testid="submission-reason-label">
                        {bilingualMode
                          ? 'एंटी-चीट उल्लंघन सीमा पार — परीक्षा स्वतः जमा हुई'
                          : 'Violation Limit Reached — Exam Auto-Submitted'}
                      </span>
                    </>
                  ) : finalResult.submissionReason === 'timer_expired' ? (
                    <>
                      <Clock className="w-5 h-5 text-amber-600" aria-hidden="true" />
                      <span className="text-amber-800" data-testid="submission-reason-label">
                        {bilingualMode
                          ? 'समय समाप्त — परीक्षा स्वतः जमा हुई'
                          : 'Timer Expired — Exam Auto-Submitted'}
                      </span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-5 h-5 text-emerald-600" aria-hidden="true" />
                      <span className="text-emerald-700" data-testid="submission-reason-label">
                        {bilingualMode
                          ? 'परीक्षा सफलतापूर्वक जमा हुई'
                          : 'Exam Submitted Successfully'}
                      </span>
                    </>
                  )}
                </div>

                <h3 className="text-xl sm:text-2xl font-bold text-slate-900">
                  {finalResult.testTitle}
                </h3>

                {/* Complete Student Snapshot + Photo */}
                <div className="flex flex-col sm:flex-row gap-4 pt-3 items-start">
                  {finalResult.photoDataUrl ? (
                    <img
                      src={finalResult.photoDataUrl}
                      alt={finalResult.studentName || 'Student Photo'}
                      data-testid="receipt-student-photo"
                      className="w-20 h-24 rounded-lg object-cover border-2 border-[#D4AF37] shrink-0"
                    />
                  ) : (
                    <div className="w-20 h-24 rounded-lg border-2 border-[#D4AF37] bg-slate-100 flex items-center justify-center text-[#0D47A1] font-bold text-lg shrink-0">
                      {getStudentInitials(finalResult.studentName || 'Student')}
                    </div>
                  )}

                  <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5 text-xs text-slate-700 flex-1 w-full">
                    <div>
                      <dt className="text-slate-500">{bilingualMode ? 'छात्र का नाम:' : 'Name:'}</dt>
                      <dd className="font-bold text-slate-900">{finalResult.studentName}</dd>
                    </div>
                    <div>
                      <dt className="text-slate-500">{bilingualMode ? '8-अंकीय ID:' : 'Student ID:'}</dt>
                      <dd className="font-mono font-bold text-[#0D47A1] tabular-nums">{finalResult.studentId}</dd>
                    </div>
                    <div>
                      <dt className="text-slate-500">{bilingualMode ? 'पिता का नाम:' : "Father's Name:"}</dt>
                      <dd className="font-semibold text-slate-900">{finalResult.fatherName || '—'}</dd>
                    </div>
                    <div>
                      <dt className="text-slate-500">{bilingualMode ? 'माता का नाम:' : "Mother's Name:"}</dt>
                      <dd className="font-semibold text-slate-900">{finalResult.motherName || '—'}</dd>
                    </div>
                    <div>
                      <dt className="text-slate-500">{bilingualMode ? 'कक्षा / रोल:' : 'Class & Roll:'}</dt>
                      <dd className="font-semibold text-slate-900 tabular-nums">
                        {finalResult.className} · Roll {finalResult.rollNumber || '—'}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-slate-500">{bilingualMode ? 'मोबाइल / पता:' : 'Mobile & Address:'}</dt>
                      <dd className="font-semibold text-slate-900 tabular-nums">
                        {finalResult.whatsappMobile || '—'} · {finalResult.address || '—'}
                      </dd>
                    </div>
                  </dl>
                </div>
              </div>

              {/* Primary Evaluation Metrics (Unboxed Hairline Columns) */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-6 py-2 tabular-nums">
                <div>
                  <p className="text-xs font-medium text-slate-500">
                    {bilingualMode ? 'प्राप्तांक' : 'Final Score'}
                  </p>
                  <p className="text-2xl sm:text-3xl font-bold text-[#0D47A1] mt-1" data-testid="result-score">
                    {finalResult.score} / {finalResult.totalMarks}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium text-slate-500">
                    {bilingualMode ? 'प्रतिशत' : 'Percentage'}
                  </p>
                  <p className="text-2xl sm:text-3xl font-bold text-slate-900 mt-1" data-testid="result-percentage">
                    {finalResult.percentage}%
                  </p>
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <p className="text-xs font-medium text-slate-500">
                    {bilingualMode ? 'एंटी-चीट उल्लंघन' : 'Violations Logged'}
                  </p>
                  <p className="text-2xl sm:text-3xl font-bold text-slate-900 mt-1">
                    {finalResult.violationsCount ?? 0} / {test.maxViolations}
                  </p>
                </div>
              </div>

              <dl className="grid grid-cols-3 gap-3 pt-4 text-center border-t border-slate-200 tabular-nums">
                <div>
                  <dt className="text-xs text-slate-500">{bilingualMode ? 'सही' : 'Correct'}</dt>
                  <dd className="text-lg font-bold text-emerald-700 mt-0.5" data-testid="result-correct">
                    {finalResult.correctCount}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500">{bilingualMode ? 'गलत' : 'Incorrect'}</dt>
                  <dd className="text-lg font-bold text-red-700 mt-0.5" data-testid="result-wrong">
                    {finalResult.wrongCount}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500">{bilingualMode ? 'छोड़े गए' : 'Skipped'}</dt>
                  <dd className="text-lg font-bold text-slate-700 mt-0.5" data-testid="result-skipped">
                    {finalResult.unansweredCount}
                  </dd>
                </div>
              </dl>

              {finalResult.violationLogs && finalResult.violationLogs.length > 0 && (
                <div className="pt-4 border-t border-slate-200 space-y-1.5 text-xs text-amber-900">
                  <p className="font-bold">
                    {bilingualMode ? 'दर्ज किए गए उल्लंघन लॉग:' : 'Recorded Anti-Cheat Violations:'}
                  </p>
                  <ul className="list-disc pl-4 space-y-0.5">
                    {finalResult.violationLogs.map((log, i) => (
                      <li key={i}>{log.message}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="pt-3 border-t border-slate-200 flex justify-end">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-5 py-2.5 min-h-[42px] rounded-lg bg-[#0D47A1] hover:bg-[#083275] text-white text-sm font-semibold cursor-pointer"
                >
                  {bilingualMode ? 'सक्रिय परीक्षाओं पर लौटें' : 'Back to Active Exams'}
                </button>
              </div>
            </section>
          </div>
        )}
      </div>

      {/* Anti-Cheat Warning Dialog (Shown before threshold is exceeded) */}
      {phase === 'running' && activeWarning && (
        <div
          className="fixed inset-0 z-[60] bg-slate-900/70 flex items-center justify-center p-4"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="anticheat-warning-title"
          data-testid="anticheat-warning-dialog"
        >
          <div className="bg-white border border-red-300 rounded-xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-6 h-6 text-red-600 shrink-0 mt-0.5" aria-hidden="true" />
              <div>
                <h4 id="anticheat-warning-title" className="text-base font-bold text-red-700">
                  {bilingualMode
                    ? `एंटी-चीट चेतावनी (${violationLogs.length} / ${test.maxViolations})`
                    : `Anti-Cheat Warning (${violationLogs.length} / ${test.maxViolations})`}
                </h4>
                <p className="text-sm text-slate-700 mt-1">{activeWarning.message}</p>
                <p className="text-xs text-slate-500 mt-2">
                  {bilingualMode
                    ? `चेतावनी: ${test.maxViolations} उल्लंघन पूरे होने पर आपकी परीक्षा स्वतः सबमिट हो जाएगी।`
                    : `Further violations reaching ${test.maxViolations} will automatically submit your exam.`}
                </p>
              </div>
            </div>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={async () => {
                  setActiveWarning(null);
                  try {
                    if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
                      await document.documentElement.requestFullscreen();
                      enteredFullscreenRef.current = true;
                    }
                  } catch {
                    // Ignore fullscreen rejection
                  }
                }}
                className="px-4 py-2 min-h-[40px] rounded-lg bg-[#0D47A1] hover:bg-[#083275] text-white text-xs font-semibold cursor-pointer"
              >
                {bilingualMode ? 'स्वीकार करें और परीक्षा जारी रखें' : 'Acknowledge & Return to Exam'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Manual Submit Confirmation Modal */}
      {phase === 'running' && showSubmitConfirm && (
        <div
          className="fixed inset-0 z-[60] bg-slate-900/60 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-submit-exam-title"
        >
          <div className="bg-white border border-slate-200 rounded-xl max-w-sm w-full p-6 shadow-2xl space-y-4">
            <h4 id="confirm-submit-exam-title" className="text-base font-bold text-slate-900">
              {bilingualMode ? 'परीक्षा सबमिट करने की पुष्टि करें' : 'Confirm Exam Submission'}
            </h4>
            <p className="text-sm text-slate-600 tabular-nums">
              {bilingualMode
                ? `आपने ${test.questions.length} में से ${answeredCount} प्रश्नों के उत्तर दिए हैं (${unansweredCount} शेष)। क्या आप अंतिम सबमिशन करना चाहते हैं?`
                : `You have answered ${answeredCount} of ${test.questions.length} questions (${unansweredCount} unattempted). Submit your exam now?`}
            </p>
            <div className="flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setShowSubmitConfirm(false)}
                className="px-4 py-2 min-h-[40px] rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 cursor-pointer"
              >
                {bilingualMode ? 'वापस जाएं' : 'Cancel'}
              </button>
              <button
                type="button"
                data-testid="confirm-submit-exam-btn"
                onClick={() => submitExam('manual')}
                className="px-4 py-2 min-h-[40px] rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold cursor-pointer"
              >
                {bilingualMode ? 'हाँ, सबमिट करें' : 'Yes, Submit Exam'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
