import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildSyncPayload,
  evaluateCloudSyncState,
  parseSyncPayload,
} from './googleDriveSyncLogic';
import type { Student } from '../types/exam';

const sampleStudent: Student = {
  id: 'st-1',
  studentId: '48295104',
  name: 'Aarav Kumar',
  fatherName: 'Rajesh Kumar',
  motherName: 'Sunita Devi',
  className: 'Class 10',
  rollNumber: '101',
  whatsappMobile: '9876543210',
  address: 'Durgapur, Raghopur',
  createdAt: '2026-03-01T10:00:00.000Z',
  updatedAt: '2026-03-01T10:00:00.000Z',
};

test('buildSyncPayload and parseSyncPayload round-trip cleanly', () => {
  const payload = buildSyncPayload([sampleStudent], [], [], '2026-03-01T10:00:00.000Z');
  const parsed = parseSyncPayload(JSON.parse(JSON.stringify(payload)));
  assert.ok(parsed);
  assert.equal(parsed.students.length, 1);
  assert.equal(parsed.students[0].studentId, '48295104');
  assert.equal(parseSyncPayload({ invalid: true }), null);
});

test('evaluateCloudSyncState detects cloud-has-data-local-empty and cloud-newer conflicts', () => {
  const cloudPayload = buildSyncPayload([sampleStudent], [], [], '2026-03-02T12:00:00.000Z');

  assert.equal(
    evaluateCloudSyncState({
      cloudPayload: null,
      localUpdatedAt: null,
      localCount: 0,
      lastSyncedAt: null,
    }),
    'no-cloud-file',
  );

  assert.equal(
    evaluateCloudSyncState({
      cloudPayload,
      localUpdatedAt: null,
      localCount: 0,
      lastSyncedAt: null,
    }),
    'cloud-has-data-local-empty',
  );

  assert.equal(
    evaluateCloudSyncState({
      cloudPayload,
      localUpdatedAt: '2026-03-02T10:00:00.000Z',
      localCount: 1,
      lastSyncedAt: '2026-03-02T09:00:00.000Z',
    }),
    'cloud-newer',
  );

  assert.equal(
    evaluateCloudSyncState({
      cloudPayload,
      localUpdatedAt: '2026-03-02T14:00:00.000Z',
      localCount: 1,
      lastSyncedAt: '2026-03-02T12:00:00.000Z',
    }),
    'local-newer',
  );
});
