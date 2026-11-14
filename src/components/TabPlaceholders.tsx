import React from 'react';
import {
  MapPin,
  Phone,
  UserCheck,
  BookOpenCheck,
} from 'lucide-react';
import {
  DirectorSignatureSVG,
  InstitutionLogo,
  InstitutionWatermark,
  OfficialSealSVG,
} from './BrandingSVGs';
import { StudentManagement } from './StudentManagement';
import { QuestionBuilder } from './QuestionBuilder';
import { ActiveExamsPortal } from './ActiveExamsPortal';
import { ResultsLeaderboard } from './ResultsLeaderboard';
import { INSTITUTION_INFO, NAV_TABS } from '../constants/institution';
import type { Result, Student, StudentResultModel, Test } from '../types/exam';

interface TabPlaceholdersProps {
  selectedTab: number;
  bilingualMode: boolean;
  students: Student[];
  tests: Test[];
  results: Result[];
  initialExamToken?: string | null;
  onClearInitialExamToken?: () => void;
  onAddStudent: (student: Student) => void;
  onUpdateStudent: (student: Student) => void;
  onDeleteStudent: (studentRecordId: string) => void;
  onPublishTest: (test: Test) => void;
  onDeleteTest: (testId: string) => void;
  onSaveResult: (result: StudentResultModel) => void;
  onDeleteResult: (resultId: string) => void;
  onImportOfflineResult?: (imported: { result: Result; extractedStudent?: Student }) => void;
}

export const TabPlaceholders: React.FC<TabPlaceholdersProps> = ({
  selectedTab,
  bilingualMode,
  students,
  tests,
  results,
  initialExamToken,
  onClearInitialExamToken,
  onAddStudent,
  onUpdateStudent,
  onDeleteStudent,
  onPublishTest,
  onDeleteTest,
  onSaveResult,
  onDeleteResult,
  onImportOfflineResult,
}) => {
  const activeTab = NAV_TABS[selectedTab] ?? NAV_TABS[0];

  return (
    <div className="space-y-6">
      {/* Tab 0: Vibrant Mobile-App Dashboard */}
      {selectedTab === 0 && (
        <div
          id="panel-dashboard"
          role="tabpanel"
          aria-labelledby="tab-dashboard"
          data-testid="tab-panel-dashboard"
          className="space-y-6"
        >
          {/* Institution Overview Hero Card */}
          <section className="relative overflow-hidden bg-white border border-indigo-100 rounded-3xl shadow-xl shadow-blue-950/10">
            <InstitutionWatermark className="w-56 h-56 -right-10 -top-10 opacity-[0.07]" />

            {/* Top Vibrant Gradient Band */}
            <div className="relative bg-gradient-to-r from-[#0D47A1] via-[#2563EB] to-[#4F46E5] text-white p-6 sm:p-8">
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
                <div className="space-y-2 max-w-2xl">
                  <p className="text-xs font-bold tracking-wide text-[#FDE68A]">
                    {bilingualMode
                      ? `${INSTITUTION_INFO.shortName} · ${INSTITUTION_INFO.mottoHi}`
                      : `${INSTITUTION_INFO.shortName} · ${INSTITUTION_INFO.mottoEn}`}
                  </p>
                  <h2 className="text-2xl sm:text-3xl font-extrabold text-white text-balance">
                    {bilingualMode ? activeTab.labelHi : activeTab.labelEn}
                  </h2>
                  <p className="text-sm sm:text-base text-blue-100 leading-relaxed">
                    {bilingualMode
                      ? activeTab.descriptionHi
                      : activeTab.descriptionEn}
                  </p>
                </div>

                {/* Vibrant Gradient KPI Tiles */}
                <div className="grid grid-cols-3 gap-3 sm:gap-4 shrink-0 tabular-nums">
                  <div className="rounded-2xl bg-white/15 backdrop-blur-md border border-white/25 px-4 py-3 text-center shadow-lg">
                    <p className="text-[11px] font-semibold text-blue-100">
                      {bilingualMode ? 'कुल छात्र' : 'Students'}
                    </p>
                    <p
                      className="text-2xl sm:text-3xl font-extrabold text-white mt-0.5"
                      data-testid="count-students"
                    >
                      {students.length}
                    </p>
                  </div>
                  <div className="rounded-2xl bg-white/15 backdrop-blur-md border border-white/25 px-4 py-3 text-center shadow-lg">
                    <p className="text-[11px] font-semibold text-blue-100">
                      {bilingualMode ? 'कुल परीक्षाएं' : 'Tests'}
                    </p>
                    <p
                      className="text-2xl sm:text-3xl font-extrabold text-[#FDE68A] mt-0.5"
                      data-testid="count-tests"
                    >
                      {tests.length}
                    </p>
                  </div>
                  <div className="rounded-2xl bg-white/15 backdrop-blur-md border border-white/25 px-4 py-3 text-center shadow-lg">
                    <p className="text-[11px] font-semibold text-blue-100">
                      {bilingualMode ? 'कुल परिणाम' : 'Results'}
                    </p>
                    <p
                      className="text-2xl sm:text-3xl font-extrabold text-emerald-300 mt-0.5"
                      data-testid="count-results"
                    >
                      {results.length}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Institution Information Grid */}
            <div className="relative grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 p-6 sm:p-8 bg-gradient-to-b from-white to-slate-50/70">
              <div className="flex items-start gap-3.5 p-4 rounded-2xl bg-blue-50/70 border border-blue-100">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white flex items-center justify-center shrink-0 shadow-md shadow-blue-600/20">
                  <BookOpenCheck className="w-5 h-5" aria-hidden="true" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-blue-700">
                    {bilingualMode ? 'संस्थान का नाम' : 'Institution Name'}
                  </p>
                  <p className="text-sm font-bold text-slate-900 mt-0.5">
                    {bilingualMode
                      ? INSTITUTION_INFO.nameHi
                      : INSTITUTION_INFO.nameEn}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3.5 p-4 rounded-2xl bg-emerald-50/70 border border-emerald-100">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white flex items-center justify-center shrink-0 shadow-md shadow-emerald-600/20">
                  <UserCheck className="w-5 h-5" aria-hidden="true" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-emerald-700">
                    {bilingualMode ? 'निदेशक' : 'Director'}
                  </p>
                  <p className="text-sm font-bold text-slate-900 mt-0.5">
                    {bilingualMode
                      ? INSTITUTION_INFO.directorHi
                      : INSTITUTION_INFO.directorEn}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3.5 p-4 rounded-2xl bg-violet-50/70 border border-violet-100">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-600 to-purple-700 text-white flex items-center justify-center shrink-0 shadow-md shadow-violet-600/20">
                  <MapPin className="w-5 h-5" aria-hidden="true" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-violet-700">
                    {bilingualMode ? 'पता' : 'Address'}
                  </p>
                  <p className="text-sm font-bold text-slate-900 mt-0.5">
                    {bilingualMode
                      ? INSTITUTION_INFO.addressHi
                      : INSTITUTION_INFO.addressEn}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3.5 p-4 rounded-2xl bg-amber-50/80 border border-amber-200/70">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 text-white flex items-center justify-center shrink-0 shadow-md shadow-amber-500/20">
                  <Phone className="w-5 h-5" aria-hidden="true" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-amber-800">
                    {bilingualMode ? 'मोबाइल नंबर' : 'Mobile'}
                  </p>
                  <p className="text-sm font-bold text-slate-900 font-mono tabular-nums mt-0.5">
                    {INSTITUTION_INFO.mobile}
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Official SVG Branding Credentials */}
          <section className="relative overflow-hidden bg-white border border-indigo-100 rounded-3xl shadow-xl shadow-blue-950/10 p-6 sm:p-8">
            <InstitutionWatermark className="w-40 h-40 -left-8 -bottom-8 opacity-[0.05]" />
            <div className="relative pb-5 border-b border-slate-200">
              <h3 className="text-lg sm:text-xl font-extrabold text-slate-900">
                {bilingualMode
                  ? 'आधिकारिक संस्थान ब्रांडिंग एवं प्रमाणन'
                  : 'Official Institution Branding & Verification Assets'}
              </h3>
              <p className="text-sm text-slate-600 mt-1">
                {bilingualMode
                  ? 'प्रवेश पत्र, प्रश्नपत्र और अंकपत्र मुद्रण के लिए आधिकारिक संस्थान लोगो, मुहर और निदेशक हस्ताक्षर।'
                  : 'Official institution crest, rubber stamp seal, and authorized director signature for admit cards and mark sheets.'}
              </p>
            </div>

            <div className="relative grid grid-cols-1 md:grid-cols-3 gap-6 pt-6 items-center">
              <div className="flex flex-col items-center text-center gap-3 p-5 rounded-2xl bg-gradient-to-b from-blue-50/70 to-white border border-blue-100 shadow-sm">
                <InstitutionLogo className="w-32 h-32 shadow-lg shadow-blue-900/15" />
                <div>
                  <p className="text-sm font-bold text-slate-900">
                    {bilingualMode ? 'संस्थान आधिकारिक लोगो' : 'Institution Crest Logo'}
                  </p>
                  <p className="text-xs text-slate-500">
                    {bilingualMode ? 'श्री राधे शिक्षण संस्थान · RLP' : 'Shri Radhe Shikshan Sansthan · RLP'}
                  </p>
                </div>
              </div>

              <div className="flex flex-col items-center text-center gap-3 p-5 rounded-2xl bg-gradient-to-b from-indigo-50/70 to-white border border-indigo-100 shadow-sm">
                <OfficialSealSVG className="w-36 h-36" />
                <div>
                  <p className="text-sm font-bold text-slate-900">
                    {bilingualMode ? 'आधिकारिक संस्थान मुहर' : 'Official Rubber Stamp Seal'}
                  </p>
                  <p className="text-xs text-slate-500">
                    {INSTITUTION_INFO.addressEn}
                  </p>
                </div>
              </div>

              <div className="flex flex-col items-center text-center gap-3 p-5 rounded-2xl bg-gradient-to-b from-amber-50/60 to-white border border-amber-100 shadow-sm">
                <div className="h-36 flex items-center justify-center px-4 border-b border-slate-300">
                  <DirectorSignatureSVG className="w-56 h-20" />
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-900">
                    {bilingualMode
                      ? INSTITUTION_INFO.directorHi
                      : INSTITUTION_INFO.directorEn}
                  </p>
                  <p className="text-xs text-slate-500">
                    {bilingualMode ? 'निदेशक आधिकारिक हस्ताक्षर' : 'Director Authorized Signature'}
                  </p>
                </div>
              </div>
            </div>
          </section>
        </div>
      )}

      {/* Tab 1: Student Management Module */}
      {selectedTab === 1 && (
        <StudentManagement
          bilingualMode={bilingualMode}
          students={students}
          onAddStudent={onAddStudent}
          onUpdateStudent={onUpdateStudent}
          onDeleteStudent={onDeleteStudent}
        />
      )}

      {/* Tab 2: Smart Question Builder & MCQ Parser (kept mounted with hidden to preserve unsaved draft across tab switches) */}
      <div hidden={selectedTab !== 2}>
        <QuestionBuilder
          bilingualMode={bilingualMode}
          existingTests={tests}
          students={students}
          onPublishTest={onPublishTest}
        />
      </div>

      {/* Tab 3: Strict Anti-Cheat Live Exam Engine Module */}
      {selectedTab === 3 && (
        <ActiveExamsPortal
          bilingualMode={bilingualMode}
          tests={tests}
          students={students}
          results={results}
          initialExamToken={initialExamToken}
          onClearInitialExamToken={onClearInitialExamToken}
          onSaveResult={onSaveResult}
          onDeleteTest={onDeleteTest}
          onRegisterStudent={onAddStudent}
        />
      )}

      {/* Tab 4: Official Marksheet, Leaderboard & WhatsApp Delivery Module */}
      {selectedTab === 4 && (
        <ResultsLeaderboard
          bilingualMode={bilingualMode}
          students={students}
          tests={tests}
          results={results}
          onDeleteResult={onDeleteResult}
          onImportOfflineResult={onImportOfflineResult}
        />
      )}
    </div>
  );
};
