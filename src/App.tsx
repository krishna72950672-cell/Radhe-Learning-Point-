import { useEffect, useState } from 'react';
import { Header } from './components/Header';
import { NavigationTabs } from './components/NavigationTabs';
import { GoogleDriveSync } from './components/GoogleDriveSync';
import { TabPlaceholders } from './components/TabPlaceholders';
import { INSTITUTION_INFO } from './constants/institution';
import { tryNormalizeClass } from './utils/studentId';
import type { ExamMasterPayload, Result, Student, StudentResultModel, Test } from './types/exam';

const LOCAL_STORAGE_KEY = 'srss_exam_master_v4_store';
const TESTS_STORAGE_KEY = 'SRSS_DB_TESTS';
const RESULTS_STORAGE_KEY = 'SRSS_DB_RESULTS';

interface PersistedWorkspace {
  students: Student[];
  tests: Test[];
  results: Result[];
  updatedAt: string | null;
}

function loadInitialWorkspace(): PersistedWorkspace {
  try {
    const raw = window.localStorage.getItem(LOCAL_STORAGE_KEY);
    const rawTests = window.localStorage.getItem(TESTS_STORAGE_KEY);
    const rawResults = window.localStorage.getItem(RESULTS_STORAGE_KEY);
    const parsedTests = rawTests ? (JSON.parse(rawTests) as unknown) : null;
    const parsedResults = rawResults ? (JSON.parse(rawResults) as unknown) : null;

    if (!raw) {
      return {
        students: [],
        tests: Array.isArray(parsedTests) ? (parsedTests as Test[]) : [],
        results: Array.isArray(parsedResults) ? (parsedResults as Result[]) : [],
        updatedAt: null,
      };
    }
    const parsed = JSON.parse(raw) as Partial<PersistedWorkspace>;
    const normalizedStudents: Student[] = Array.isArray(parsed.students)
      ? parsed.students.map((st) => ({
          ...st,
          className: tryNormalizeClass(st.className) ?? 'Class 01',
        }))
      : [];
    const tests = Array.isArray(parsedTests)
      ? (parsedTests as Test[])
      : Array.isArray(parsed.tests)
        ? parsed.tests
        : [];
    const results = Array.isArray(parsedResults)
      ? (parsedResults as Result[])
      : Array.isArray(parsed.results)
        ? parsed.results
        : [];
    return {
      students: normalizedStudents,
      tests,
      results,
      updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : null,
    };
  } catch {
    return { students: [], tests: [], results: [], updatedAt: null };
  }
}

function getInitialExamTokenFromUrl(): string | null {
  try {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('exam')?.trim();
    return token ? token.toUpperCase() : null;
  } catch {
    return null;
  }
}

export default function App() {
  const [initialWorkspace] = useState<PersistedWorkspace>(() => loadInitialWorkspace());
  const [initialExamToken, setInitialExamToken] = useState<string | null>(() =>
    getInitialExamTokenFromUrl(),
  );
  const [selectedTab, setSelectedTab] = useState<number>(() =>
    getInitialExamTokenFromUrl() ? 3 : 0,
  );
  const [bilingualMode, setBilingualMode] = useState<boolean>(false);
  const [students, setStudents] = useState<Student[]>(initialWorkspace.students);
  const [tests, setTests] = useState<Test[]>(initialWorkspace.tests);
  const [results, setResults] = useState<Result[]>(initialWorkspace.results);
  const [localUpdatedAt, setLocalUpdatedAt] = useState<string | null>(
    initialWorkspace.updatedAt,
  );

  useEffect(() => {
    try {
      const data: PersistedWorkspace = {
        students,
        tests,
        results,
        updatedAt: localUpdatedAt,
      };
      window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(data));
      window.localStorage.setItem(TESTS_STORAGE_KEY, JSON.stringify(tests));
      window.localStorage.setItem(RESULTS_STORAGE_KEY, JSON.stringify(results));
    } catch {
      // Ignore storage quota errors cleanly
    }
  }, [students, tests, results, localUpdatedAt]);

  const touchLocalTimestamp = () => {
    setLocalUpdatedAt(new Date().toISOString());
  };

  const handleAddStudent = (student: Student) => {
    setStudents((prev) => {
      if (prev.some((s) => s.studentId === student.studentId)) {
        return prev;
      }
      return [student, ...prev];
    });
    touchLocalTimestamp();
  };

  const handleUpdateStudent = (updated: Student) => {
    setStudents((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
    touchLocalTimestamp();
  };

  const handleDeleteStudent = (studentRecordId: string) => {
    setStudents((prev) => prev.filter((s) => s.id !== studentRecordId));
    touchLocalTimestamp();
  };

  const handlePublishTest = (newTest: Test) => {
    setTests((prev) => [newTest, ...prev]);
    touchLocalTimestamp();
    setSelectedTab(3);
  };

  const handleDeleteTest = (testId: string) => {
    setTests((prev) => {
      const next = prev.filter((t) => t.id !== testId);
      try {
        window.localStorage.setItem(TESTS_STORAGE_KEY, JSON.stringify(next));
      } catch {
        // Ignore storage errors cleanly
      }
      return next;
    });
    touchLocalTimestamp();
  };

  const handleSaveResult = (newResult: StudentResultModel) => {
    setResults((prev) => [newResult, ...prev]);
    touchLocalTimestamp();
  };

  const handleDeleteResult = (resultId: string) => {
    setResults((prev) => {
      const next = prev.filter((r) => r.id !== resultId);
      try {
        window.localStorage.setItem(RESULTS_STORAGE_KEY, JSON.stringify(next));
      } catch {
        // Ignore storage errors cleanly
      }
      return next;
    });
    touchLocalTimestamp();
  };

  const handleImportOfflineResult = (imported: {
    result: Result;
    extractedStudent?: Student;
  }) => {
    const { result, extractedStudent } = imported;

    setResults((prev) => {
      const exists = prev.some(
        (r) =>
          r.id === result.id ||
          (r.testId === result.testId && r.studentId === result.studentId),
      );
      if (exists) {
        return prev.map((r) =>
          r.id === result.id ||
          (r.testId === result.testId && r.studentId === result.studentId)
            ? { ...r, ...result }
            : r,
        );
      }
      return [result, ...prev];
    });

    if (extractedStudent) {
      setStudents((prev) => {
        const existing = prev.find((s) => s.studentId === extractedStudent.studentId);
        if (!existing) {
          return [extractedStudent, ...prev];
        }
        if (!existing.photoDataUrl && extractedStudent.photoDataUrl) {
          return prev.map((s) =>
            s.studentId === extractedStudent.studentId
              ? { ...s, photoDataUrl: extractedStudent.photoDataUrl, updatedAt: new Date().toISOString() }
              : s,
          );
        }
        return prev;
      });
    }

    touchLocalTimestamp();
  };

  const handleApplyCloudPayload = (payload: ExamMasterPayload) => {
    const normalizedCloudStudents = payload.students.map((st) => ({
      ...st,
      className: tryNormalizeClass(st.className) ?? 'Class 01',
    }));
    setStudents(normalizedCloudStudents);
    setTests(payload.tests);
    setResults(payload.results);
    setLocalUpdatedAt(payload.updatedAt);
  };

  return (
    <div className="min-h-screen flex flex-col text-slate-900">
      <Header
        bilingualMode={bilingualMode}
        onToggleBilingual={() => setBilingualMode((prev) => !prev)}
      />

      <NavigationTabs
        selectedTab={selectedTab}
        bilingualMode={bilingualMode}
        onSelectTab={setSelectedTab}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-8 pb-24 md:pb-8">
        <GoogleDriveSync
          bilingualMode={bilingualMode}
          students={students}
          tests={tests}
          results={results}
          localUpdatedAt={localUpdatedAt}
          onApplyCloudPayload={handleApplyCloudPayload}
        />

        <TabPlaceholders
          selectedTab={selectedTab}
          bilingualMode={bilingualMode}
          students={students}
          tests={tests}
          results={results}
          initialExamToken={initialExamToken}
          onClearInitialExamToken={() => setInitialExamToken(null)}
          onAddStudent={handleAddStudent}
          onUpdateStudent={handleUpdateStudent}
          onDeleteStudent={handleDeleteStudent}
          onPublishTest={handlePublishTest}
          onDeleteTest={handleDeleteTest}
          onSaveResult={handleSaveResult}
          onDeleteResult={handleDeleteResult}
          onImportOfflineResult={handleImportOfflineResult}
        />
      </main>

      <footer className="hidden md:block border-t border-indigo-100 bg-white/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-600">
          <span>
            {bilingualMode
              ? `${INSTITUTION_INFO.nameHi} · सत्र ${INSTITUTION_INFO.session}`
              : `${INSTITUTION_INFO.nameEn} · Session ${INSTITUTION_INFO.session}`}
          </span>
          <span className="tabular-nums">
            {bilingualMode
              ? `${INSTITUTION_INFO.addressHi} · मो. ${INSTITUTION_INFO.mobile}`
              : `${INSTITUTION_INFO.addressEn} · Mob. ${INSTITUTION_INFO.mobile}`}
          </span>
        </div>
      </footer>
    </div>
  );
}
