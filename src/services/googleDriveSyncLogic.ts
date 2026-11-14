import { INSTITUTION_INFO } from '../constants/institution';
import type { ExamMasterPayload, Result, Student, Test } from '../types/exam';

export type CloudComparisonOutcome =
  | 'no-cloud-file'
  | 'in-sync'
  | 'cloud-has-data-local-empty'
  | 'cloud-newer'
  | 'local-newer';

export function buildSyncPayload(
  students: Student[],
  tests: Test[],
  results: Result[],
  updatedAt = new Date().toISOString(),
): ExamMasterPayload {
  return {
    schemaVersion: 1,
    updatedAt,
    institution: INSTITUTION_INFO.nameEn,
    students,
    tests,
    results,
  };
}

export function parseSyncPayload(raw: unknown): ExamMasterPayload | null {
  if (!raw || typeof raw !== 'object') return null;
  const candidate = raw as Partial<ExamMasterPayload>;
  if (
    !Array.isArray(candidate.students) ||
    !Array.isArray(candidate.tests) ||
    !Array.isArray(candidate.results)
  ) {
    return null;
  }

  return {
    schemaVersion: typeof candidate.schemaVersion === 'number' ? candidate.schemaVersion : 1,
    updatedAt:
      typeof candidate.updatedAt === 'string' && candidate.updatedAt
        ? candidate.updatedAt
        : new Date(0).toISOString(),
    institution:
      typeof candidate.institution === 'string'
        ? candidate.institution
        : INSTITUTION_INFO.nameEn,
    students: candidate.students,
    tests: candidate.tests,
    results: candidate.results,
  };
}

export function evaluateCloudSyncState(params: {
  cloudPayload: ExamMasterPayload | null;
  localUpdatedAt: string | null;
  localCount: number;
  lastSyncedAt: string | null;
}): CloudComparisonOutcome {
  const { cloudPayload, localUpdatedAt, localCount, lastSyncedAt } = params;
  if (!cloudPayload) return 'no-cloud-file';

  const cloudCount =
    cloudPayload.students.length +
    cloudPayload.tests.length +
    cloudPayload.results.length;

  if (localCount === 0 && cloudCount > 0) {
    return 'cloud-has-data-local-empty';
  }

  const cloudTime = Date.parse(cloudPayload.updatedAt) || 0;
  const syncedTime = lastSyncedAt ? Date.parse(lastSyncedAt) || 0 : 0;
  const localTime = localUpdatedAt ? Date.parse(localUpdatedAt) || 0 : 0;

  if (cloudTime > syncedTime && cloudTime > localTime) {
    return 'cloud-newer';
  }

  if (localTime > cloudTime) {
    return 'local-newer';
  }

  return 'in-sync';
}
