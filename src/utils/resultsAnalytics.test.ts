import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildLeaderboardRows,
  buildQuestionReviewItems,
  buildWhatsAppResultShare,
  computeMeritAnalytics,
  exportResultsToCsv,
  formatWhatsAppPhone,
  isResultPass,
  parseImportedOfflineResultJson,
} from './resultsAnalytics';
import type { Result, Student, Test } from '../types/exam';

const students: Student[] = [
  {
    id: '48291047',
    studentId: '48291047',
    name: 'Aarav Kumar',
    fatherName: 'Rajesh Kumar',
    motherName: 'Sunita Devi',
    className: 'Class 10',
    rollNumber: '101',
    whatsappMobile: '9876543210',
    address: 'Durgapur, Raghopur',
    createdAt: '2026-11-10T00:00:00.000Z',
    updatedAt: '2026-11-10T00:00:00.000Z',
  },
  {
    id: '59283741',
    studentId: '59283741',
    name: 'Priya Sharma',
    fatherName: 'Mahesh Sharma',
    motherName: 'Kiran Devi',
    className: 'Class 10',
    rollNumber: '102',
    whatsappMobile: '9123456789',
    address: 'Raghopur',
    createdAt: '2026-11-10T00:00:00.000Z',
    updatedAt: '2026-11-10T00:00:00.000Z',
  },
  {
    id: '73829164',
    studentId: '73829164',
    name: 'Rohan Das',
    fatherName: 'Anil Das',
    motherName: 'Rekha Devi',
    className: 'Class 09',
    rollNumber: '15',
    whatsappMobile: '9988776655',
    address: 'Supaul',
    createdAt: '2026-11-10T00:00:00.000Z',
    updatedAt: '2026-11-10T00:00:00.000Z',
  },
];

const testPaper: Test = {
  id: 'test-sci-1',
  token: 'SRSS-AB12-CD34',
  title: 'Mid-Term Science Test',
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
      questionText: 'SI unit of current?',
      options: ['Volt', 'Ampere', 'Ohm', 'Watt'],
      correctOption: 1,
      explanation: 'Ampere is the SI unit.',
    },
    {
      id: 'q2',
      questionText: '2 + 2 = ?',
      options: ['3', '4', '5', '6'],
      correctOption: 1,
    },
    {
      id: 'q3',
      questionText: 'Water formula?',
      options: ['H2O', 'CO2', 'O2', 'NaCl'],
      correctOption: 0,
    },
  ],
};

const results: Result[] = [
  {
    id: 'res-1',
    testId: 'test-sci-1',
    studentId: '48291047',
    score: 7,
    totalMarks: 12,
    correctCount: 2,
    wrongCount: 1,
    unansweredCount: 0,
    percentage: 58.33,
    timeTakenSeconds: 400,
    answers: { q1: 1, q2: 0, q3: 0 },
    submittedAt: '2026-11-12T10:00:00.000Z',
  },
  {
    id: 'res-2',
    testId: 'test-sci-1',
    studentId: '59283741',
    score: 12,
    totalMarks: 12,
    correctCount: 3,
    wrongCount: 0,
    unansweredCount: 0,
    percentage: 100,
    timeTakenSeconds: 320,
    answers: { q1: 1, q2: 1, q3: 0 },
    submittedAt: '2026-11-12T10:05:00.000Z',
  },
  {
    id: 'res-3',
    testId: 'test-sci-1',
    studentId: '73829164',
    score: 3,
    totalMarks: 12,
    correctCount: 1,
    wrongCount: 1,
    unansweredCount: 1,
    percentage: 25,
    timeTakenSeconds: 200,
    answers: { q1: 1, q2: 2 },
    submittedAt: '2026-11-12T10:10:00.000Z',
  },
];

test('isResultPass applies 33% pass threshold cleanly', () => {
  assert.equal(isResultPass(33), true);
  assert.equal(isResultPass(100), true);
  assert.equal(isResultPass(32.99), false);
});

test('buildLeaderboardRows sorts by percentage/score and assigns ranks accurately', () => {
  const rows = buildLeaderboardRows({ results, students, tests: [testPaper] });
  assert.equal(rows.length, 3);
  assert.equal(rows[0].studentName, 'Priya Sharma');
  assert.equal(rows[0].rank, 1);
  assert.equal(rows[0].passed, true);
  assert.equal(rows[1].studentName, 'Aarav Kumar');
  assert.equal(rows[1].rank, 2);
  assert.equal(rows[1].passed, true);
  assert.equal(rows[2].studentName, 'Rohan Das');
  assert.equal(rows[2].rank, 3);
  assert.equal(rows[2].passed, false);

  const class9Only = buildLeaderboardRows({
    results,
    students,
    tests: [testPaper],
    classFilter: 'Class 09',
  });
  assert.equal(class9Only.length, 1);
  assert.equal(class9Only[0].result.studentId, '73829164');
});

test('computeMeritAnalytics calculates totals, average, highest, and pass rate', () => {
  const rows = buildLeaderboardRows({ results, students, tests: [testPaper] });
  const stats = computeMeritAnalytics(rows);
  assert.equal(stats.totalSubmissions, 3);
  assert.equal(stats.highestPercentage, 100);
  assert.equal(stats.highestScoreLabel, '12 / 12');
  assert.equal(stats.passCount, 2);
  assert.equal(stats.passRate, 66.67);
  assert.equal(stats.averagePercentage, 61.11);
});

test('buildQuestionReviewItems classifies correct, wrong, and unattempted with marks awarded', () => {
  const review = buildQuestionReviewItems(testPaper, results[2]);
  assert.equal(review.length, 3);
  assert.equal(review[0].status, 'correct');
  assert.equal(review[0].marksAwarded, 4);
  assert.equal(review[1].status, 'wrong');
  assert.equal(review[1].marksAwarded, -1);
  assert.equal(review[2].status, 'unattempted');
  assert.equal(review[2].marksAwarded, 0);
});

test('exportResultsToCsv produces RFC-4180 CSV with UTF-8 BOM and all rows', () => {
  const rows = buildLeaderboardRows({ results, students, tests: [testPaper] });
  const csv = exportResultsToCsv(rows);
  assert.ok(csv.startsWith('\uFEFFRank,Student ID,Student Name'));
  const lines = csv.split('\r\n');
  assert.equal(lines.length, 4); // header + 3 rows
  assert.ok(lines[1].includes('Priya Sharma'));
  assert.ok(lines[1].includes('PASS'));
  assert.ok(lines[3].includes('FAIL'));
});

test('buildWhatsAppResultShare normalizes 10-digit Indian mobile and encodes parent summary', () => {
  assert.equal(formatWhatsAppPhone('98765-43210'), '919876543210');
  const rows = buildLeaderboardRows({ results, students, tests: [testPaper] });
  const share = buildWhatsAppResultShare({ row: rows[0], bilingualMode: false });
  assert.ok(share.url.startsWith('https://api.whatsapp.com/send?phone=919123456789&text='));
  assert.ok(share.message.includes('Priya Sharma'));
  assert.ok(share.message.includes('12 / 12'));
  assert.ok(share.message.includes('PASS'));
});

test('parseImportedOfflineResultJson and buildLeaderboardRows preserve full student details and photo even when directory is empty', () => {
  const sampleOfflineJson = JSON.stringify({
    testId: 'test-sci-1',
    testToken: 'SRSS-AB12-CD34',
    testTitle: 'Mid-Term Science Test',
    className: 'Class 10',
    subject: 'Science',
    studentId: '88112233',
    studentName: 'Karan Yadav',
    fatherName: 'Manoj Yadav',
    motherName: 'Sita Devi',
    rollNumber: '45',
    whatsappMobile: '9911223344',
    address: 'Raghopur, Supaul 852111',
    photoDataUrl: 'data:image/jpeg;base64,/9j/4AAQSkZJRg==',
    score: 11,
    totalMarks: 12,
    percentage: 91.67,
    correctCount: 3,
    wrongCount: 1,
    unansweredCount: 0,
    submittedReason: 'manual',
    violationsCount: 0,
    submittedAt: '2026-11-13T10:15:00.000Z',
  });

  const imported = parseImportedOfflineResultJson(sampleOfflineJson);
  assert.equal(imported.result.studentId, '88112233');
  assert.equal(imported.result.examLocationMode, 'offline_html');
  assert.equal(imported.result.photoDataUrl, 'data:image/jpeg;base64,/9j/4AAQSkZJRg==');
  assert.equal(imported.extractedStudent?.fatherName, 'Manoj Yadav');
  assert.equal(imported.extractedStudent?.motherName, 'Sita Devi');

  // Verify buildLeaderboardRows preserves full details + photo even with empty students directory
  const rows = buildLeaderboardRows({
    results: [imported.result],
    students: [],
    tests: [testPaper],
  });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].studentName, 'Karan Yadav');
  assert.equal(rows[0].fatherName, 'Manoj Yadav');
  assert.equal(rows[0].motherName, 'Sita Devi');
  assert.equal(rows[0].rollNumber, '45');
  assert.equal(rows[0].whatsappMobile, '9911223344');
  assert.equal(rows[0].address, 'Raghopur, Supaul 852111');
  assert.equal(rows[0].photoDataUrl, 'data:image/jpeg;base64,/9j/4AAQSkZJRg==');
  assert.equal(rows[0].examLocationMode, 'offline_html');
});

