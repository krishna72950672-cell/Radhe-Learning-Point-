import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyViolationEvent,
  evaluateExamSubmission,
  formatCountdown,
  parseAllowedStudentIds,
  verifyStudentEligibility,
} from './examEvaluation';
import type { Result, Student, Test } from '../types/exam';

const sampleStudent: Student = {
  id: '48291047',
  studentId: '48291047',
  name: 'Aarav Kumar',
  fatherName: 'Rajesh Kumar',
  motherName: 'Sunita Devi',
  className: 'Class 10',
  rollNumber: '12',
  whatsappMobile: '9876543210',
  address: 'Durgapur, Raghopur',
  createdAt: '2026-11-10T00:00:00.000Z',
  updatedAt: '2026-11-10T00:00:00.000Z',
};

const blockedStudent: Student = {
  ...sampleStudent,
  id: '59283741',
  studentId: '59283741',
  name: 'Blocked Student',
  isBlocked: true,
  blockedReason: 'Disciplinary hold',
};

const sampleTest: Test = {
  id: 'test-1',
  token: 'SRSS-ABCD-1234',
  title: 'Science Assessment',
  className: 'Class 10',
  subject: 'Science',
  marksPerQuestion: 4,
  negativeMarking: 1,
  durationMinutes: 30,
  maxViolations: 3,
  totalMarks: 12,
  status: 'active',
  createdAt: '2026-11-10T00:00:00.000Z',
  publishedAt: '2026-11-10T00:00:00.000Z',
  questions: [
    {
      id: 'q1',
      questionText: 'Q1',
      options: ['A', 'B', 'C', 'D'],
      correctOption: 1,
    },
    {
      id: 'q2',
      questionText: 'Q2',
      options: ['A', 'B', 'C', 'D'],
      correctOption: 2,
    },
    {
      id: 'q3',
      questionText: 'Q3',
      options: ['A', 'B', 'C', 'D'],
      correctOption: 0,
    },
  ],
};

test('verifyStudentEligibility enforces 8-digit format, directory match, blocked check, and attempt lock', () => {
  const invalid = verifyStudentEligibility({
    rawStudentId: '1234',
    test: sampleTest,
    students: [sampleStudent, blockedStudent],
    results: [],
  });
  assert.equal(invalid.eligible, false);
  assert.equal(invalid.status, 'invalid_id_format');

  const missing = verifyStudentEligibility({
    rawStudentId: '99998888',
    test: sampleTest,
    students: [sampleStudent, blockedStudent],
    results: [],
  });
  assert.equal(missing.eligible, false);
  assert.equal(missing.status, 'not_found');

  const blocked = verifyStudentEligibility({
    rawStudentId: '59283741',
    test: sampleTest,
    students: [sampleStudent, blockedStudent],
    results: [],
  });
  assert.equal(blocked.eligible, false);
  assert.equal(blocked.status, 'blocked');

  const eligible = verifyStudentEligibility({
    rawStudentId: '4829-1047',
    test: sampleTest,
    students: [sampleStudent, blockedStudent],
    results: [],
  });
  assert.equal(eligible.eligible, true);
  assert.equal(eligible.status, 'eligible');
  assert.equal(eligible.student?.studentId, '48291047');

  const lockedResult: Result = {
    id: 'res-1',
    testId: 'test-1',
    studentId: '48291047',
    score: 8,
    totalMarks: 12,
    correctCount: 2,
    wrongCount: 0,
    unansweredCount: 1,
    percentage: 66.67,
    submittedAt: '2026-11-11T00:00:00.000Z',
  };
  const locked = verifyStudentEligibility({
    rawStudentId: '48291047',
    test: sampleTest,
    students: [sampleStudent, blockedStudent],
    results: [lockedResult],
  });
  assert.equal(locked.eligible, false);
  assert.equal(locked.status, 'already_attempted');
});

test('formatCountdown formats seconds cleanly in MM:SS and HH:MM:SS', () => {
  assert.equal(formatCountdown(0), '00:00');
  assert.equal(formatCountdown(65), '01:05');
  assert.equal(formatCountdown(1800), '30:00');
  assert.equal(formatCountdown(3665), '01:01:05');
});

test('applyViolationEvent counts warnings and triggers auto-submit at maxViolations', () => {
  const step1 = applyViolationEvent({
    existingLogs: [],
    type: 'tab_switch',
    maxViolations: 3,
  });
  assert.equal(step1.violationsCount, 1);
  assert.equal(step1.shouldAutoSubmit, false);

  const step2 = applyViolationEvent({
    existingLogs: step1.nextLogs,
    type: 'window_blur',
    maxViolations: 3,
  });
  assert.equal(step2.violationsCount, 2);
  assert.equal(step2.shouldAutoSubmit, false);

  const step3 = applyViolationEvent({
    existingLogs: step2.nextLogs,
    type: 'fullscreen_exit',
    maxViolations: 3,
  });
  assert.equal(step3.violationsCount, 3);
  assert.equal(step3.shouldAutoSubmit, true);
});

test('evaluateExamSubmission computes positive, negative, skipped, and percentage accurately', () => {
  const result = evaluateExamSubmission({
    test: sampleTest,
    student: sampleStudent,
    answers: {
      q1: 1, // correct (+4)
      q2: 0, // wrong (-1)
      q3: null, // skipped (0)
    },
    submissionReason: 'manual',
    violationLogs: [],
    timeTakenSeconds: 420,
    submittedAt: '2026-11-13T10:00:00.000Z',
  });

  assert.equal(result.correctCount, 1);
  assert.equal(result.wrongCount, 1);
  assert.equal(result.unansweredCount, 1);
  assert.equal(result.score, 3);
  assert.equal(result.totalMarks, 12);
  assert.equal(result.percentage, 25);
  assert.equal(result.submissionReason, 'manual');
  assert.equal(result.violationsCount, 0);
  assert.equal(result.timeTakenSeconds, 420);
});

test('evaluateExamSubmission handles timer_expired and violation_limit with clamped 0% floor', () => {
  const result = evaluateExamSubmission({
    test: { ...sampleTest, marksPerQuestion: 1, negativeMarking: 2, totalMarks: 3 },
    student: sampleStudent,
    answers: {
      q1: 0, // wrong (-2)
      q2: 0, // wrong (-2)
    },
    submissionReason: 'violation_limit',
    violationLogs: [
      { type: 'tab_switch', message: 'Tab switched', timestamp: '2026-11-13T10:00:00.000Z' },
      { type: 'blur' as never, message: 'Focus lost', timestamp: '2026-11-13T10:00:01.000Z' },
      { type: 'back_button', message: 'Back pressed', timestamp: '2026-11-13T10:00:02.000Z' },
    ],
    timeTakenSeconds: 95,
  });

  assert.equal(result.correctCount, 0);
  assert.equal(result.wrongCount, 2);
  assert.equal(result.unansweredCount, 1);
  assert.equal(result.score, -4);
  assert.equal(result.percentage, 0);
  assert.equal(result.submissionReason, 'violation_limit');
  assert.equal(result.violationsCount, 3);
});

test('parseAllowedStudentIds parses single, comma-separated, and hyphenated 8-digit IDs and flags invalid tokens', () => {
  const empty = parseAllowedStudentIds('   ');
  assert.deepEqual(empty.validIds, []);
  assert.deepEqual(empty.invalidTokens, []);

  const parsed = parseAllowedStudentIds('48291047, 5928-3741; 48291047 1234');
  assert.deepEqual(parsed.validIds, ['48291047', '59283741']);
  assert.deepEqual(parsed.invalidTokens, ['1234']);
});

test('verifyStudentEligibility enforces allowedStudentIds restriction when set on a test', () => {
  const otherStudent: Student = {
    ...sampleStudent,
    id: '77889900',
    studentId: '77889900',
    name: 'Priya Kumari',
  };

  const restrictedTest: Test = {
    ...sampleTest,
    allowedStudentIds: ['48291047'],
  };

  const allowedCheck = verifyStudentEligibility({
    rawStudentId: '48291047',
    test: restrictedTest,
    students: [sampleStudent, otherStudent],
    results: [],
  });
  assert.equal(allowedCheck.eligible, true);
  assert.equal(allowedCheck.status, 'eligible');

  const rejectedOther = verifyStudentEligibility({
    rawStudentId: '77889900',
    test: restrictedTest,
    students: [sampleStudent, otherStudent],
    results: [],
  });
  assert.equal(rejectedOther.eligible, false);
  assert.equal(rejectedOther.status, 'not_allowed_for_test');

  const rejectedUnknown = verifyStudentEligibility({
    rawStudentId: '11223344',
    test: restrictedTest,
    students: [sampleStudent, otherStudent],
    results: [],
  });
  assert.equal(rejectedUnknown.eligible, false);
  assert.equal(rejectedUnknown.status, 'not_allowed_for_test');

  const openCheck = verifyStudentEligibility({
    rawStudentId: '77889900',
    test: { ...sampleTest, allowedStudentIds: [] },
    students: [sampleStudent, otherStudent],
    results: [],
  });
  assert.equal(openCheck.eligible, true);
});

