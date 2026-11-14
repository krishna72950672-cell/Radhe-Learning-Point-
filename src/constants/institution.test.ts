import test from 'node:test';
import assert from 'node:assert/strict';
import {
  INSTITUTION_INFO,
  NAV_TABS,
  getActiveTabMeta,
  getAppTitle,
  getInstitutionName,
  getTabLabel,
  isValidTabIndex,
} from './institution';

test('INSTITUTION_INFO includes required English, Hindi, address, and mobile fields', () => {
  assert.ok(INSTITUTION_INFO.nameEn.includes('Shri Radhe'));
  assert.ok(INSTITUTION_INFO.nameHi.includes('श्री राधे'));
  assert.equal(INSTITUTION_INFO.addressEn, 'Durgapur, Raghopur - 852111');
  assert.equal(INSTITUTION_INFO.mobile, '7061324142');
  assert.equal(
    INSTITUTION_INFO.sealText,
    'RADHE LEARNING POINT - DURGAPUR, RAGHOPUR - 852111 (SEAL)',
  );
});

test('NAV_TABS defines all 5 required core tabs in exact order', () => {
  assert.equal(NAV_TABS.length, 5);
  assert.deepEqual(
    NAV_TABS.map((t) => t.labelEn),
    ['Dashboard', 'Students', 'Question Builder', 'Active Exams', 'Results/Leaderboard'],
  );
});

test('isValidTabIndex and getActiveTabMeta handle valid and out-of-range indices safely', () => {
  assert.equal(isValidTabIndex(0), true);
  assert.equal(isValidTabIndex(4), true);
  assert.equal(isValidTabIndex(-1), false);
  assert.equal(isValidTabIndex(5), false);
  assert.equal(isValidTabIndex(1.5), false);

  assert.equal(getActiveTabMeta(2).id, 'question-builder');
  assert.equal(getActiveTabMeta(99).id, 'dashboard');
});

test('bilingual helpers switch between English and Hindi labels accurately', () => {
  assert.equal(getTabLabel(NAV_TABS[0], false), 'Dashboard');
  assert.equal(getTabLabel(NAV_TABS[0], true), 'डैशबोर्ड');
  assert.equal(getInstitutionName(false), INSTITUTION_INFO.nameEn);
  assert.equal(getInstitutionName(true), INSTITUTION_INFO.nameHi);
  assert.equal(getAppTitle(false), 'Shri Radhe Exam Master Pro v4.0');
  assert.equal(getAppTitle(true), 'श्री राधे एग्जाम मास्टर प्रो v4.0');
});
