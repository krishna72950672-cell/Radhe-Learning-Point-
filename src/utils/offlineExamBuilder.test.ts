import assert from 'node:assert/strict';
import test from 'node:test';
import { OFFLINE_AWAY_LIMIT_MS, buildStrictOnlineExamHTML } from './offlineExamBuilder.ts';
import type { Test } from '../types/exam.ts';

function createSampleTest(): Test {
  return {
    id: 'test-offline-1',
    token: 'SRSS-9A2B-7C4D',
    title: 'Class 10 Science Offline Proctored Test </script><script>alert(1)</script>',
    className: 'Class 10',
    subject: 'Science',
    marksPerQuestion: 2,
    negativeMarking: 0.5,
    durationMinutes: 45,
    maxViolations: 3,
    totalMarks: 4,
    status: 'active',
    createdAt: '2026-04-01T10:00:00.000Z',
    publishedAt: '2026-04-01T10:05:00.000Z',
    questions: [
      {
        id: 'q1',
        questionText: 'What is the chemical formula of water?',
        options: ['H2O', 'CO2', 'NaCl', 'O2'],
        correctOption: 0,
        explanation: 'Water consists of two hydrogen atoms and one oxygen atom.',
      },
      {
        id: 'q2',
        questionText: 'SI unit of electric current is?',
        options: ['Volt', 'Ampere', 'Ohm', 'Watt'],
        correctOption: 1,
      },
    ],
  };
}

test('buildStrictOnlineExamHTML produces 100% offline self-contained HTML with zero external URLs', () => {
  const html = buildStrictOnlineExamHTML(createSampleTest());

  assert.match(html, /^<!DOCTYPE html>/i);
  assert.match(html, /<\/html>\s*$/i);
  assert.doesNotMatch(html, /https?:\/\//i, 'Standalone offline HTML must not contain external http/https links or CDNs');
  assert.match(html, /<style>[\s\S]+<\/style>/);
  assert.match(html, /<script>[\s\S]+<\/script>/);
});

test('buildStrictOnlineExamHTML escapes dangerous </script> payloads safely', () => {
  const html = buildStrictOnlineExamHTML(createSampleTest());
  assert.doesNotMatch(
    html,
    /<script>alert\(1\)<\/script>/i,
    'Raw unescaped script injection must not appear in HTML output',
  );
  assert.match(html, /\\u003c\/script\\u003e/);
});

test('buildStrictOnlineExamHTML enforces 5-second blur/visibility timer and violation_limit auto-submit', () => {
  assert.equal(OFFLINE_AWAY_LIMIT_MS, 5000);
  const html = buildStrictOnlineExamHTML(createSampleTest());

  assert.match(html, /AWAY_LIMIT_MS\s*=\s*5000/);
  assert.match(html, /visibilitychange/);
  assert.match(html, /window\.addEventListener\('blur'/);
  assert.match(html, /fullscreenchange/);
  assert.match(html, /popstate/);
  assert.match(html, /finalizeAndSubmit\('violation_limit'\)/);
  assert.match(html, /finalizeAndSubmit\('timer_expired'\)/);
  assert.match(html, /submittedReason/);
});

test('buildStrictOnlineExamHTML embeds student directory and captures full student profile + photo', () => {
  const html = buildStrictOnlineExamHTML(createSampleTest(), {
    students: [
      {
        id: '48291047',
        studentId: '48291047',
        name: 'Ananya Verma',
        fatherName: 'Suresh Verma',
        motherName: 'Geeta Devi',
        className: 'Class 10',
        rollNumber: '22',
        whatsappMobile: '9876543210',
        address: 'Durgapur, Raghopur',
        photoDataUrl: 'data:image/jpeg;base64,AAAA',
        createdAt: '2026-11-10T00:00:00.000Z',
        updatedAt: '2026-11-10T00:00:00.000Z',
      },
    ],
  });

  assert.doesNotMatch(html, /https?:\/\//i);
  assert.match(html, /id="student-father-input"/);
  assert.match(html, /id="student-mother-input"/);
  assert.match(html, /id="student-roll-input"/);
  assert.match(html, /id="student-mobile-input"/);
  assert.match(html, /id="student-address-input"/);
  assert.match(html, /id="student-photo-input"/);
  assert.match(html, /Ananya Verma/);
  assert.match(html, /data:image\/jpeg;base64,AAAA/);
  assert.match(html, /examLocationMode:\s*'offline_html'/);
});

test('buildStrictOnlineExamHTML embeds and enforces allowedStudentIds restriction', () => {
  const restrictedTest = {
    ...createSampleTest(),
    allowedStudentIds: ['48291047', '77889900'],
  };
  const html = buildStrictOnlineExamHTML(restrictedTest);
  assert.doesNotMatch(html, /https?:\/\//i);
  assert.match(html, /"allowedStudentIds":\["48291047","77889900"\]/);
  assert.match(html, /EXAM\.allowedStudentIds\.indexOf\(sid\)\s*===\s*-1/);
});


