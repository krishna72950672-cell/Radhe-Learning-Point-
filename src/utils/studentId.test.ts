import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CLASS_OPTIONS,
  generateUniqueStudentId,
  isStudentIdSafe,
  normalizeClass,
  tryNormalizeClass,
} from './studentId';

test('CLASS_OPTIONS contains Class 01 through Class 12 in order', () => {
  assert.equal(CLASS_OPTIONS.length, 12);
  assert.equal(CLASS_OPTIONS[0], 'Class 01');
  assert.equal(CLASS_OPTIONS[11], 'Class 12');
});

test('normalizeClass standardizes numeric, ordinal, prefixed, and Roman inputs', () => {
  assert.equal(normalizeClass(1), 'Class 01');
  assert.equal(normalizeClass('1'), 'Class 01');
  assert.equal(normalizeClass('05'), 'Class 05');
  assert.equal(normalizeClass('class 9'), 'Class 09');
  assert.equal(normalizeClass('Class-10'), 'Class 10');
  assert.equal(normalizeClass('12th'), 'Class 12');
  assert.equal(normalizeClass('IX'), 'Class 09');
  assert.equal(normalizeClass('xii'), 'Class 12');
  assert.equal(normalizeClass('Std 03'), 'Class 03');
});

test('tryNormalizeClass rejects invalid or out-of-range inputs', () => {
  assert.equal(tryNormalizeClass(0), null);
  assert.equal(tryNormalizeClass(13), null);
  assert.equal(tryNormalizeClass('Class 15'), null);
  assert.equal(tryNormalizeClass(''), null);
  assert.throws(() => normalizeClass('Nursery'));
});

test('isStudentIdSafe enforces 8-digit non-sequential and last-4-digit uniqueness', () => {
  const existing = ['48295104'];

  // Exact match rejected
  assert.equal(isStudentIdSafe('48295104', existing), false);
  // Different prefix, colliding last 4 digits rejected
  assert.equal(isStudentIdSafe('73915104', existing), false);
  // Sequential last 4 digits relative to existing rejected (5105 and 5103)
  assert.equal(isStudentIdSafe('73915105', existing), false);
  assert.equal(isStudentIdSafe('73915103', existing), false);
  // Internally sequential or uniform last 4 digits rejected
  assert.equal(isStudentIdSafe('73911234', existing), false);
  assert.equal(isStudentIdSafe('73916543', existing), false);
  assert.equal(isStudentIdSafe('73917777', existing), false);
  assert.equal(isStudentIdSafe('73914242', existing), false);
  // Leading zero rejected
  assert.equal(isStudentIdSafe('03918472', existing), false);
  // Valid non-colliding, non-sequential ID accepted
  assert.equal(isStudentIdSafe('73918462', existing), true);
});

test('generateUniqueStudentId produces 200 distinct IDs with unique non-sequential last 4 digits', () => {
  const ids: string[] = [];
  const last4Set = new Set<string>();

  for (let i = 0; i < 200; i += 1) {
    const id = generateUniqueStudentId(ids);
    assert.match(id, /^[1-9]\d{7}$/);
    assert.equal(ids.includes(id), false);

    const last4 = id.slice(-4);
    assert.equal(last4Set.has(last4), false);

    ids.push(id);
    last4Set.add(last4);
  }
});
