import type { InstitutionInfo, NavTabConfig } from '../types/exam';

export const INSTITUTION_INFO: InstitutionInfo = {
  appNameEn: 'Shri Radhe Exam Master Pro v4.0',
  appNameHi: 'श्री राधे एग्जाम मास्टर प्रो v4.0',
  nameEn: 'Shri Radhe Shikshan Sansthan — Radhe Learning Point',
  nameHi: 'श्री राधे शिक्षण संस्थान — राधे लर्निंग पॉइंट',
  shortName: 'SRSS 2026',
  mottoEn: 'Learn • Practice • Excel',
  mottoHi: 'सीखें • अभ्यास करें • उत्कृष्ट बनें',
  directorEn: 'Krishna Kumar Sir',
  directorHi: 'कृष्णा कुमार सर',
  addressEn: 'Durgapur, Raghopur - 852111',
  addressHi: 'दुर्गापुर, राघोपुर - 852111',
  mobile: '7061324142',
  session: '2026',
  sealText: 'RADHE LEARNING POINT - DURGAPUR, RAGHOPUR - 852111 (SEAL)',
};

export const NAV_TABS: readonly NavTabConfig[] = [
  {
    index: 0,
    id: 'dashboard',
    labelEn: 'Dashboard',
    labelHi: 'डैशबोर्ड',
    descriptionEn: 'Institution command center, live enrollment overview, and official academic credentials.',
    descriptionHi: 'संस्थान नियंत्रण केंद्र, नामांकन सारांश और आधिकारिक शैक्षणिक प्रमाणन।',
  },
  {
    index: 1,
    id: 'students',
    labelEn: 'Students',
    labelHi: 'छात्र प्रबंधन',
    descriptionEn: 'Student directory, roll number assignment, batch grouping, and admit card registry.',
    descriptionHi: 'छात्र निर्देशिका, रोल नंबर आवंटन, बैच समूह और प्रवेश पत्र पंजीकरण।',
  },
  {
    index: 2,
    id: 'question-builder',
    labelEn: 'Question Builder',
    labelHi: 'प्रश्न निर्माता',
    descriptionEn: 'Bilingual question bank authoring, marking scheme setup, and exam paper assembly.',
    descriptionHi: 'द्विभाषी प्रश्न बैंक निर्माण, अंक योजना और परीक्षा प्रश्नपत्र संयोजन।',
  },
  {
    index: 3,
    id: 'active-exams',
    labelEn: 'Active Exams',
    labelHi: 'सक्रिय परीक्षाएं',
    descriptionEn: 'Live examination runner, timed OMR assessment interface, and instant submission.',
    descriptionHi: 'लाइव परीक्षा संचालन, समयबद्ध ओएमआर मूल्यांकन और त्वरित सबमिशन।',
  },
  {
    index: 4,
    id: 'results-leaderboard',
    labelEn: 'Results/Leaderboard',
    labelHi: 'परिणाम / मेरिट सूची',
    descriptionEn: 'Rankings, scorecards, subject-wise analytics, and printable institutional mark sheets.',
    descriptionHi: 'रैंकिंग, स्कोरकार्ड, विषयवार विश्लेषण और मुद्रण योग्य अंकपत्र।',
  },
] as const;

export function isValidTabIndex(index: number): boolean {
  return Number.isInteger(index) && index >= 0 && index < NAV_TABS.length;
}

export function getActiveTabMeta(selectedTab: number): NavTabConfig {
  return isValidTabIndex(selectedTab) ? NAV_TABS[selectedTab] : NAV_TABS[0];
}

export function getTabLabel(tab: NavTabConfig, bilingualMode: boolean): string {
  return bilingualMode ? tab.labelHi : tab.labelEn;
}

export function getInstitutionName(bilingualMode: boolean): string {
  return bilingualMode ? INSTITUTION_INFO.nameHi : INSTITUTION_INFO.nameEn;
}

export function getAppTitle(bilingualMode: boolean): string {
  return bilingualMode ? INSTITUTION_INFO.appNameHi : INSTITUTION_INFO.appNameEn;
}
