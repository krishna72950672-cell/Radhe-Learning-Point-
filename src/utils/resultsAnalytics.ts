import { INSTITUTION_INFO } from '../constants/institution';
import { tryNormalizeClass } from './studentId';
import type { QuestionModel, Result, Student, SubmissionReason, Test } from '../types/exam';

export const DEFAULT_PASS_PERCENTAGE = 33;

export interface LeaderboardRow {
  rank: number;
  result: Result;
  student?: Student;
  test?: Test;
  studentName: string;
  fatherName: string;
  motherName: string;
  className: string;
  rollNumber: string;
  whatsappMobile: string;
  address: string;
  photoDataUrl?: string;
  examLocationMode: 'online' | 'offline_html';
  testTitle: string;
  testToken: string;
  subject: string;
  totalQuestions: number;
  attemptedCount: number;
  passed: boolean;
}

export interface MeritAnalytics {
  totalSubmissions: number;
  averagePercentage: number;
  highestPercentage: number;
  highestScoreLabel: string;
  passCount: number;
  passRate: number;
}

export type ReviewFilterMode = 'all' | 'correct' | 'wrong' | 'unattempted';

export interface QuestionReviewItem {
  index: number;
  question: QuestionModel;
  selectedOption: number | null;
  status: 'correct' | 'wrong' | 'unattempted';
  marksAwarded: number;
}

export function isResultPass(
  percentage: number,
  passThreshold: number = DEFAULT_PASS_PERCENTAGE,
): boolean {
  return percentage >= passThreshold;
}

export function buildLeaderboardRows(params: {
  results: Result[];
  students: Student[];
  tests: Test[];
  searchQuery?: string;
  classFilter?: string;
  testIdFilter?: string;
}): LeaderboardRow[] {
  const {
    results,
    students,
    tests,
    searchQuery = '',
    classFilter = 'ALL',
    testIdFilter = 'ALL',
  } = params;

  const studentById = new Map<string, Student>();
  for (const s of students) {
    studentById.set(s.studentId, s);
  }

  const testById = new Map<string, Test>();
  for (const t of tests) {
    testById.set(t.id, t);
  }

  const enriched = results.map((result) => {
    const student = studentById.get(result.studentId);
    const test = testById.get(result.testId);

    const totalQuestions =
      test?.questions.length ??
      result.correctCount + result.wrongCount + result.unansweredCount;
    const attemptedCount = result.correctCount + result.wrongCount;

    return {
      rank: 1,
      result,
      student,
      test,
      studentName: student?.name ?? result.studentName ?? `Student ${result.studentId}`,
      fatherName: student?.fatherName || result.fatherName || '—',
      motherName: student?.motherName || result.motherName || '—',
      className: student?.className ?? result.className ?? test?.className ?? '—',
      rollNumber: student?.rollNumber || result.rollNumber || '—',
      whatsappMobile: student?.whatsappMobile || result.whatsappMobile || '',
      address: student?.address || result.address || '—',
      photoDataUrl: student?.photoDataUrl || result.photoDataUrl,
      examLocationMode: result.examLocationMode ?? 'online',
      testTitle: test?.title ?? result.testTitle ?? 'Assessment',
      testToken: test?.token ?? result.testToken ?? '—',
      subject: test?.subject ?? result.subject ?? '—',
      totalQuestions,
      attemptedCount,
      passed: isResultPass(result.percentage),
    };
  });

  const q = searchQuery.trim().toLowerCase();
  const filtered = enriched.filter((row) => {
    if (classFilter !== 'ALL' && row.className !== classFilter) {
      return false;
    }
    if (testIdFilter !== 'ALL' && row.result.testId !== testIdFilter) {
      return false;
    }
    if (!q) return true;
    return (
      row.studentName.toLowerCase().includes(q) ||
      row.result.studentId.includes(q) ||
      row.rollNumber.toLowerCase().includes(q) ||
      row.testTitle.toLowerCase().includes(q) ||
      row.testToken.toLowerCase().includes(q) ||
      row.subject.toLowerCase().includes(q)
    );
  });

  // Sort strictly by percentage desc, score desc, time taken asc, earliest submission asc
  filtered.sort((a, b) => {
    if (b.result.percentage !== a.result.percentage) {
      return b.result.percentage - a.result.percentage;
    }
    if (b.result.score !== a.result.score) {
      return b.result.score - a.result.score;
    }
    const timeA = a.result.timeTakenSeconds ?? Number.MAX_SAFE_INTEGER;
    const timeB = b.result.timeTakenSeconds ?? Number.MAX_SAFE_INTEGER;
    if (timeA !== timeB) {
      return timeA - timeB;
    }
    return a.result.submittedAt.localeCompare(b.result.submittedAt);
  });

  // Standard competition ranking (1, 2, 2, 4) for tied percentage & score
  let currentRank = 1;
  return filtered.map((row, index) => {
    if (index > 0) {
      const prev = filtered[index - 1];
      const isTie =
        prev.result.percentage === row.result.percentage &&
        prev.result.score === row.result.score;
      if (!isTie) {
        currentRank = index + 1;
      }
    }
    return { ...row, rank: currentRank };
  });
}

export function computeMeritAnalytics(rows: LeaderboardRow[]): MeritAnalytics {
  if (rows.length === 0) {
    return {
      totalSubmissions: 0,
      averagePercentage: 0,
      highestPercentage: 0,
      highestScoreLabel: '0 / 0',
      passCount: 0,
      passRate: 0,
    };
  }

  let pctSum = 0;
  let passCount = 0;
  const topRow = rows[0];

  for (const row of rows) {
    pctSum += row.result.percentage;
    if (row.passed) {
      passCount += 1;
    }
  }

  const averagePercentage = Math.round((pctSum / rows.length) * 100) / 100;
  const passRate = Math.round(((passCount / rows.length) * 100) * 100) / 100;

  return {
    totalSubmissions: rows.length,
    averagePercentage,
    highestPercentage: topRow.result.percentage,
    highestScoreLabel: `${topRow.result.score} / ${topRow.result.totalMarks}`,
    passCount,
    passRate,
  };
}

export function buildQuestionReviewItems(
  test: Test | undefined,
  result: Result,
): QuestionReviewItem[] {
  if (!test || test.questions.length === 0) return [];
  const answers = result.answers ?? {};

  return test.questions.map((question, index) => {
    const rawSelected = answers[question.id];
    const selectedOption =
      rawSelected === 0 || rawSelected === 1 || rawSelected === 2 || rawSelected === 3
        ? rawSelected
        : null;

    const qMarks =
      typeof question.marks === 'number' && question.marks > 0
        ? question.marks
        : test.marksPerQuestion;
    const qNeg =
      typeof question.negativeMarks === 'number' && question.negativeMarks >= 0
        ? question.negativeMarks
        : test.negativeMarking;

    if (selectedOption === null) {
      return {
        index,
        question,
        selectedOption: null,
        status: 'unattempted',
        marksAwarded: 0,
      };
    }

    if (selectedOption === question.correctOption) {
      return {
        index,
        question,
        selectedOption,
        status: 'correct',
        marksAwarded: qMarks,
      };
    }

    return {
      index,
      question,
      selectedOption,
      status: 'wrong',
      marksAwarded: qNeg > 0 ? -qNeg : 0,
    };
  });
}

function escapeCsvCell(value: string | number): string {
  const str = String(value ?? '');
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function exportResultsToCsv(rows: LeaderboardRow[]): string {
  const headers = [
    'Rank',
    'Student ID',
    'Student Name',
    'Father Name',
    'Mother Name',
    'Class',
    'Roll No',
    'WhatsApp Mobile',
    'Address',
    'Exam Mode',
    'Test Title',
    'Test Token',
    'Subject',
    'Total Questions',
    'Attempted',
    'Correct',
    'Wrong',
    'Skipped',
    'Obtained Marks',
    'Total Marks',
    'Percentage',
    'Result Status',
    'Violations',
    'Submitted At',
  ];

  const lines = [headers.map(escapeCsvCell).join(',')];

  for (const row of rows) {
    const cells = [
      row.rank,
      row.result.studentId,
      row.studentName,
      row.fatherName,
      row.motherName,
      row.className,
      row.rollNumber,
      row.whatsappMobile,
      row.address,
      row.examLocationMode === 'offline_html' ? 'Offline HTML' : 'Online Portal',
      row.testTitle,
      row.testToken,
      row.subject,
      row.totalQuestions,
      row.attemptedCount,
      row.result.correctCount,
      row.result.wrongCount,
      row.result.unansweredCount,
      row.result.score,
      row.result.totalMarks,
      `${row.result.percentage}%`,
      row.passed ? 'PASS' : 'FAIL',
      row.result.violationsCount ?? 0,
      row.result.submittedAt,
    ];
    lines.push(cells.map(escapeCsvCell).join(','));
  }

  return `\uFEFF${lines.join('\r\n')}`;
}

export function formatWhatsAppPhone(rawMobile: string): string {
  const digits = rawMobile.replace(/\D/g, '');
  if (!digits) return '';
  if (digits.length === 10) return `91${digits}`;
  return digits;
}

export function buildWhatsAppResultShare(params: {
  row: LeaderboardRow;
  bilingualMode: boolean;
}): { url: string; message: string; phone: string } {
  const { row, bilingualMode } = params;
  const phone = formatWhatsAppPhone(row.whatsappMobile);
  const statusLabel = row.passed
    ? bilingualMode
      ? 'उत्तीर्ण (PASS)'
      : 'PASS'
    : bilingualMode
      ? 'अनुत्तीर्ण (FAIL)'
      : 'FAIL';

  const message = bilingualMode
    ? [
        `*${INSTITUTION_INFO.nameHi}*`,
        `(${INSTITUTION_INFO.nameEn})`,
        `आधिकारिक परीक्षा परिणाम सूचना`,
        `------------------------------`,
        `छात्र: *${row.studentName}* (ID: ${row.result.studentId})`,
        `कक्षा: ${row.className} | रोल नं.: ${row.rollNumber}`,
        `परीक्षा: ${row.testTitle} (${row.subject})`,
        `प्राप्तांक: *${row.result.score} / ${row.result.totalMarks}* (${row.result.percentage}%)`,
        `परिणाम स्थिति: *${statusLabel}*`,
        `सही: ${row.result.correctCount} | गलत: ${row.result.wrongCount} | छोड़े गए: ${row.result.unansweredCount}`,
        `------------------------------`,
        `निदेशक: ${INSTITUTION_INFO.directorHi} | मो.: ${INSTITUTION_INFO.mobile}`,
      ].join('\n')
    : [
        `*${INSTITUTION_INFO.nameEn}*`,
        `Official Examination Result Summary`,
        `------------------------------`,
        `Student: *${row.studentName}* (ID: ${row.result.studentId})`,
        `Class: ${row.className} | Roll No: ${row.rollNumber}`,
        `Exam: ${row.testTitle} (${row.subject})`,
        `Score: *${row.result.score} / ${row.result.totalMarks}* (${row.result.percentage}%)`,
        `Status: *${statusLabel}*`,
        `Correct: ${row.result.correctCount} | Wrong: ${row.result.wrongCount} | Skipped: ${row.result.unansweredCount}`,
        `------------------------------`,
        `Director: ${INSTITUTION_INFO.directorEn} | Mob: ${INSTITUTION_INFO.mobile}`,
      ].join('\n');

  const base = 'https://api.whatsapp.com/send';
  const url = phone
    ? `${base}?phone=${encodeURIComponent(phone)}&text=${encodeURIComponent(message)}`
    : `${base}?text=${encodeURIComponent(message)}`;

  return { url, message, phone };
}

function normalizeSubmissionReason(raw: unknown): SubmissionReason {
  if (raw === 'timer_expired' || raw === 'violation_limit' || raw === 'manual') {
    return raw;
  }
  return 'manual';
}

/**
 * Parses and validates an Offline HTML result receipt (.json) exported by a student anywhere,
 * preserving full student details + photo and returning both the Result record and an optional
 * Student directory entry if the student is not yet registered locally.
 */
export function parseImportedOfflineResultJson(rawJson: string): {
  result: Result;
  extractedStudent?: Student;
} {
  let parsed: Record<string, unknown>;
  try {
    const raw = JSON.parse(rawJson);
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      throw new Error('Result receipt JSON must be an object.');
    }
    parsed = raw as Record<string, unknown>;
  } catch (err) {
    if (err instanceof Error && err.message.includes('must be an object')) {
      throw err;
    }
    throw new Error('Invalid JSON file. Please select a valid SRSS Result Receipt (.json).');
  }

  const studentId = String(parsed.studentId ?? '').replace(/\D/g, '').trim();
  if (studentId.length !== 8) {
    throw new Error('Invalid or missing 8-digit Student ID in result receipt.');
  }

  const studentName = String(parsed.studentName ?? '').trim();
  if (!studentName) {
    throw new Error('Missing Student Name in result receipt.');
  }

  const testId = String(parsed.testId ?? '').trim() || `offline-${String(parsed.testToken ?? studentId)}`;
  const totalMarks = Number(parsed.totalMarks);
  const score = Number(parsed.score);
  const percentage = Number(parsed.percentage);

  if (!Number.isFinite(score) || !Number.isFinite(totalMarks) || !Number.isFinite(percentage)) {
    throw new Error('Invalid score or percentage metrics in result receipt.');
  }

  const now = new Date().toISOString();
  const normalizedClass =
    tryNormalizeClass(String(parsed.className ?? '')) ??
    (String(parsed.className ?? '').trim() || 'Class 10');
  const fatherName = String(parsed.fatherName ?? '').trim() || undefined;
  const motherName = String(parsed.motherName ?? '').trim() || undefined;
  const rollNumber = String(parsed.rollNumber ?? '').trim() || undefined;
  const whatsappMobile = String(parsed.whatsappMobile ?? '').replace(/\D/g, '').trim() || undefined;
  const address = String(parsed.address ?? '').trim() || undefined;
  const photoRaw = typeof parsed.photoDataUrl === 'string' ? parsed.photoDataUrl.trim() : '';
  const photoDataUrl = photoRaw.startsWith('data:image/') ? photoRaw : undefined;

  const submittedAt =
    typeof parsed.submittedAt === 'string' && parsed.submittedAt.trim()
      ? parsed.submittedAt
      : now;

  const rand = globalThis.crypto?.getRandomValues
    ? globalThis.crypto.getRandomValues(new Uint32Array(1))[0].toString(36)
    : Math.random().toString(36).slice(2, 8);

  const result: Result = {
    id:
      typeof parsed.id === 'string' && parsed.id.trim()
        ? parsed.id.trim()
        : `res-imp-${Date.now().toString(36)}-${rand}`,
    testId,
    testToken: typeof parsed.testToken === 'string' ? parsed.testToken.trim() : undefined,
    testTitle: typeof parsed.testTitle === 'string' ? parsed.testTitle.trim() : 'Offline Exam',
    subject: typeof parsed.subject === 'string' ? parsed.subject.trim() : undefined,
    className: normalizedClass,
    studentId,
    studentName,
    fatherName,
    motherName,
    rollNumber,
    whatsappMobile,
    address,
    photoDataUrl,
    examLocationMode: 'offline_html',
    score,
    totalMarks,
    correctCount: Math.max(0, Math.round(Number(parsed.correctCount) || 0)),
    wrongCount: Math.max(0, Math.round(Number(parsed.wrongCount) || 0)),
    unansweredCount: Math.max(0, Math.round(Number(parsed.unansweredCount) || 0)),
    percentage,
    submissionReason: normalizeSubmissionReason(parsed.submissionReason ?? parsed.submittedReason),
    violationsCount: Math.max(0, Math.round(Number(parsed.violationsCount) || 0)),
    violationLogs: Array.isArray(parsed.violationLogs)
      ? (parsed.violationLogs as Result['violationLogs'])
      : undefined,
    timeTakenSeconds:
      typeof parsed.timeTakenSeconds === 'number' && Number.isFinite(parsed.timeTakenSeconds)
        ? Math.max(0, Math.round(parsed.timeTakenSeconds))
        : undefined,
    answers:
      parsed.answers && typeof parsed.answers === 'object' && !Array.isArray(parsed.answers)
        ? (parsed.answers as Record<string, number | null>)
        : undefined,
    submittedAt,
  };

  const extractedStudent: Student = {
    id: studentId,
    studentId,
    name: studentName,
    fatherName: fatherName ?? '—',
    motherName: motherName ?? '—',
    className: tryNormalizeClass(normalizedClass) ?? 'Class 10',
    rollNumber: rollNumber ?? '—',
    whatsappMobile: whatsappMobile ?? '',
    address: address ?? '—',
    photoDataUrl,
    createdAt: submittedAt,
    updatedAt: now,
  };

  return { result, extractedStudent };
}

