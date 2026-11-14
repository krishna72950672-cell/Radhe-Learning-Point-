import type {
  Result,
  Student,
  StudentResultModel,
  SubmissionReason,
  Test,
  ViolationEvent,
  ViolationType,
} from '../types/exam';

export type EligibilityStatus =
  | 'eligible'
  | 'invalid_id_format'
  | 'not_allowed_for_test'
  | 'not_found'
  | 'blocked'
  | 'already_attempted'
  | 'test_inactive';

export interface StudentEligibilityCheck {
  eligible: boolean;
  status: EligibilityStatus;
  student?: Student;
  existingResult?: Result;
  reasonEn: string;
  reasonHi: string;
}

export function parseAllowedStudentIds(rawInput: string): {
  validIds: string[];
  invalidTokens: string[];
} {
  const tokens = rawInput
    .split(/[\s,;]+/)
    .map((t) => t.trim())
    .filter(Boolean);

  const validIds: string[] = [];
  const invalidTokens: string[] = [];
  const seen = new Set<string>();

  for (const token of tokens) {
    const cleaned = token.replace(/-/g, '');
    if (/^\d{8}$/.test(cleaned)) {
      if (!seen.has(cleaned)) {
        seen.add(cleaned);
        validIds.push(cleaned);
      }
    } else {
      invalidTokens.push(token);
    }
  }

  return { validIds, invalidTokens };
}

export function verifyStudentEligibility(params: {
  rawStudentId: string;
  test: Test;
  students: Student[];
  results: Result[];
}): StudentEligibilityCheck {
  const { rawStudentId, test, students, results } = params;
  const cleanedId = rawStudentId.replace(/\D/g, '');

  if (test.status !== 'active' || test.questions.length === 0) {
    return {
      eligible: false,
      status: 'test_inactive',
      reasonEn: 'This exam is currently inactive or has no questions.',
      reasonHi: 'यह परीक्षा वर्तमान में सक्रिय नहीं है या इसमें कोई प्रश्न नहीं है।',
    };
  }

  if (cleanedId.length !== 8) {
    return {
      eligible: false,
      status: 'invalid_id_format',
      reasonEn: 'Please enter a valid 8-digit numeric Student ID.',
      reasonHi: 'कृपया 8 अंकों की मान्य संख्यात्मक छात्र ID दर्ज करें।',
    };
  }

  const allowedList = Array.isArray(test.allowedStudentIds)
    ? test.allowedStudentIds.filter((id) => /^\d{8}$/.test(id))
    : [];

  if (allowedList.length > 0 && !allowedList.includes(cleanedId)) {
    return {
      eligible: false,
      status: 'not_allowed_for_test',
      reasonEn: `Access Restricted: Student ID ${cleanedId} is not authorized for this specific test.`,
      reasonHi: `प्रवेश प्रतिबंधित: छात्र ID ${cleanedId} इस विशेष परीक्षा के लिए अधिकृत नहीं है।`,
    };
  }

  const student = students.find((s) => s.studentId === cleanedId);
  if (!student) {
    return {
      eligible: false,
      status: 'not_found',
      reasonEn: `No student found in the directory with ID ${cleanedId}.`,
      reasonHi: `छात्र निर्देशिका में ID ${cleanedId} से कोई छात्र नहीं मिला।`,
    };
  }

  if (student.isBlocked) {
    return {
      eligible: false,
      status: 'blocked',
      student,
      reasonEn: student.blockedReason
        ? `Access Blocked: ${student.blockedReason}`
        : `Student ${student.name} (${student.studentId}) is currently blocked from taking exams.`,
      reasonHi: student.blockedReason
        ? `प्रवेश अवरुद्ध: ${student.blockedReason}`
        : `छात्र ${student.name} (${student.studentId}) को वर्तमान में परीक्षा देने से अवरुद्ध किया गया है।`,
    };
  }

  const existingResult = results.find(
    (r) => r.testId === test.id && r.studentId === student.studentId,
  );
  if (existingResult) {
    return {
      eligible: false,
      status: 'already_attempted',
      student,
      existingResult,
      reasonEn: `Attempt Locked: ${student.name} (${student.studentId}) has already submitted this exam (Score: ${existingResult.score}/${existingResult.totalMarks}).`,
      reasonHi: `प्रयास लॉक है: ${student.name} (${student.studentId}) ने यह परीक्षा पहले ही जमा कर दी है (अंक: ${existingResult.score}/${existingResult.totalMarks})।`,
    };
  }

  return {
    eligible: true,
    status: 'eligible',
    student,
    reasonEn: 'Student verified and eligible to start the examination.',
    reasonHi: 'छात्र सत्यापित है और परीक्षा शुरू करने के लिए पात्र है।',
  };
}

export function formatCountdown(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;
  const mm = String(minutes).padStart(2, '0');
  const ss = String(seconds).padStart(2, '0');
  if (hours > 0) {
    return `${String(hours).padStart(2, '0')}:${mm}:${ss}`;
  }
  return `${mm}:${ss}`;
}

export function getViolationLabel(type: ViolationType, bilingualMode: boolean): string {
  switch (type) {
    case 'tab_switch':
      return bilingualMode
        ? 'टैब बदला गया या ऐप छोटा (Minimize) किया गया'
        : 'Tab switched or application minimized';
    case 'window_blur':
      return bilingualMode
        ? 'विंडो फोकस खो गया या स्प्लिट-स्क्रीन का उपयोग हुआ'
        : 'Window focus lost or split-screen detected';
    case 'fullscreen_exit':
      return bilingualMode
        ? 'पूर्ण-स्क्रीन (Full-Screen) मोड से बाहर निकले'
        : 'Exited full-screen examination mode';
    case 'back_button':
      return bilingualMode
        ? 'ब्राउज़र बैक बटन दबाया गया'
        : 'Browser back button navigation attempted';
  }
}

export interface ViolationTransition {
  nextLogs: ViolationEvent[];
  violationsCount: number;
  shouldAutoSubmit: boolean;
}

export function applyViolationEvent(params: {
  existingLogs: ViolationEvent[];
  type: ViolationType;
  maxViolations: number;
  bilingualMode?: boolean;
  timestamp?: string;
}): ViolationTransition {
  const { existingLogs, type, maxViolations, bilingualMode = false, timestamp } = params;
  const event: ViolationEvent = {
    type,
    message: getViolationLabel(type, bilingualMode),
    timestamp: timestamp ?? new Date().toISOString(),
  };
  const nextLogs = [...existingLogs, event];
  const violationsCount = nextLogs.length;
  const threshold = Math.max(1, maxViolations);
  return {
    nextLogs,
    violationsCount,
    shouldAutoSubmit: violationsCount >= threshold,
  };
}

function roundTwoDecimals(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function evaluateExamSubmission(params: {
  test: Test;
  student: Student;
  answers: Record<string, number | null>;
  submissionReason: SubmissionReason;
  violationLogs: ViolationEvent[];
  timeTakenSeconds: number;
  submittedAt?: string;
  examLocationMode?: 'online' | 'offline_html';
}): StudentResultModel {
  const {
    test,
    student,
    answers,
    submissionReason,
    violationLogs,
    timeTakenSeconds,
    submittedAt,
    examLocationMode = 'online',
  } = params;

  let correctCount = 0;
  let wrongCount = 0;
  let unansweredCount = 0;
  let rawScore = 0;
  let computedTotalMarks = 0;

  for (const q of test.questions) {
    const qMarks = typeof q.marks === 'number' && q.marks > 0 ? q.marks : test.marksPerQuestion;
    const qNeg =
      typeof q.negativeMarks === 'number' && q.negativeMarks >= 0
        ? q.negativeMarks
        : test.negativeMarking;

    computedTotalMarks += qMarks;
    const selected = answers[q.id];

    if (selected === undefined || selected === null) {
      unansweredCount += 1;
    } else if (selected === q.correctOption) {
      correctCount += 1;
      rawScore += qMarks;
    } else {
      wrongCount += 1;
      rawScore -= qNeg;
    }
  }

  const totalMarks = roundTwoDecimals(
    computedTotalMarks > 0 ? computedTotalMarks : test.totalMarks,
  );
  const score = roundTwoDecimals(rawScore);
  const percentage =
    totalMarks > 0 ? roundTwoDecimals(Math.max(0, (score / totalMarks) * 100)) : 0;

  const rand = globalThis.crypto?.getRandomValues
    ? globalThis.crypto.getRandomValues(new Uint32Array(1))[0].toString(36)
    : Math.random().toString(36).slice(2, 8);

  return {
    id: `res-${Date.now().toString(36)}-${rand}`,
    testId: test.id,
    testToken: test.token,
    testTitle: test.title,
    subject: test.subject,
    className: test.className,
    studentId: student.studentId,
    studentName: student.name,
    fatherName: student.fatherName,
    motherName: student.motherName,
    rollNumber: student.rollNumber,
    whatsappMobile: student.whatsappMobile,
    address: student.address,
    photoDataUrl: student.photoDataUrl,
    examLocationMode,
    score,
    totalMarks,
    correctCount,
    wrongCount,
    unansweredCount,
    percentage,
    submissionReason,
    violationsCount: violationLogs.length,
    violationLogs,
    timeTakenSeconds: Math.max(0, Math.round(timeTakenSeconds)),
    answers: { ...answers },
    submittedAt: submittedAt ?? new Date().toISOString(),
  };
}
