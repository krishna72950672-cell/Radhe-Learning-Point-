import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Award,
  Download,
  FileSpreadsheet,
  FileUp,
  MessageCircle,
  Search,
  Trash2,
  Trophy,
} from 'lucide-react';
import { CLASS_OPTIONS } from '../utils/studentId';
import {
  buildLeaderboardRows,
  buildWhatsAppResultShare,
  computeMeritAnalytics,
  exportResultsToCsv,
  parseImportedOfflineResultJson,
  type LeaderboardRow,
} from '../utils/resultsAnalytics';
import { InstitutionWatermark } from './BrandingSVGs';
import { OfficialMarksheetModal } from './OfficialMarksheetModal';
import type { Result, Student, Test } from '../types/exam';

interface ResultsLeaderboardProps {
  bilingualMode: boolean;
  students: Student[];
  tests: Test[];
  results: Result[];
  onDeleteResult: (resultId: string) => void;
  onImportOfflineResult?: (imported: { result: Result; extractedStudent?: Student }) => void;
}

function getRowInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (!parts[0]) return 'ST';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export const ResultsLeaderboard: React.FC<ResultsLeaderboardProps> = ({
  bilingualMode,
  students,
  tests,
  results,
  onDeleteResult,
  onImportOfflineResult,
}) => {
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [classFilter, setClassFilter] = useState<string>('ALL');
  const [testIdFilter, setTestIdFilter] = useState<string>('ALL');
  const [selectedRow, setSelectedRow] = useState<LeaderboardRow | null>(null);
  const [pendingDeleteRow, setPendingDeleteRow] = useState<LeaderboardRow | null>(null);
  const [exportFeedback, setExportFeedback] = useState<string>('');
  const [importError, setImportError] = useState<string>('');

  const leaderboardRows = useMemo(
    () =>
      buildLeaderboardRows({
        results,
        students,
        tests,
        searchQuery,
        classFilter,
        testIdFilter,
      }),
    [results, students, tests, searchQuery, classFilter, testIdFilter],
  );

  const analytics = useMemo(
    () => computeMeritAnalytics(leaderboardRows),
    [leaderboardRows],
  );

  const handleExportCsv = () => {
    if (leaderboardRows.length === 0) return;
    const csvContent = exportResultsToCsv(leaderboardRows);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `srss-exam-results-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    setExportFeedback(
      bilingualMode
        ? `${leaderboardRows.length} परिणाम Excel/CSV फ़ाइल में निर्यात किए गए।`
        : `Exported ${leaderboardRows.length} result(s) to CSV for Excel.`,
    );
    window.setTimeout(() => setExportFeedback(''), 2500);
  };

  const handleConfirmDeleteResult = () => {
    if (!pendingDeleteRow) return;
    const deletedName = pendingDeleteRow.studentName;
    const deletedId = pendingDeleteRow.result.id;
    onDeleteResult(deletedId);
    if (selectedRow?.result.id === deletedId) {
      setSelectedRow(null);
    }
    setPendingDeleteRow(null);
    setExportFeedback(
      bilingualMode
        ? `${deletedName} का परीक्षा परिणाम हटा दिया गया।`
        : `Deleted exam result record for ${deletedName}.`,
    );
    window.setTimeout(() => setExportFeedback(''), 2500);
  };

  const handleImportOfflineFiles = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const fileList = event.target.files;
    const files = fileList ? Array.from(fileList) : [];
    event.target.value = '';
    if (files.length === 0 || !onImportOfflineResult) return;

    setImportError('');
    let importedCount = 0;

    for (const file of files) {
      try {
        const text = await file.text();
        const parsed = parseImportedOfflineResultJson(text);
        onImportOfflineResult(parsed);
        importedCount += 1;
      } catch (err) {
        setImportError(
          err instanceof Error
            ? `${file.name}: ${err.message}`
            : `Failed to import ${file.name}.`,
        );
      }
    }

    if (importedCount > 0) {
      setExportFeedback(
        bilingualMode
          ? `${importedCount} ऑफ़लाइन परीक्षा परिणाम रसीद (पूरे विवरण व फोटो सहित) जोड़े गए।`
          : `Imported ${importedCount} offline exam result receipt(s) with full student profile & photo.`,
      );
      window.setTimeout(() => setExportFeedback(''), 3500);
    }
  };

  return (
    <div
      id="panel-results-leaderboard"
      role="tabpanel"
      aria-labelledby="tab-results-leaderboard"
      data-testid="tab-panel-results-leaderboard"
      className="space-y-6"
    >
      {/* Merit Analytics Summary Section */}
      <section className="relative overflow-hidden bg-white border border-indigo-100 rounded-3xl shadow-xl shadow-blue-950/10">
        <InstitutionWatermark className="w-48 h-48 -right-10 -top-10 opacity-[0.07]" />
        <div className="relative bg-gradient-to-r from-[#0D47A1] via-[#2563EB] to-[#4F46E5] text-white px-6 py-5 sm:px-8 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 border-b-4 border-[#D4AF37]">
          <div>
            <h2 className="text-xl sm:text-2xl font-extrabold text-white">
              {bilingualMode
                ? 'परिणाम, मेरिट सूची एवं आधिकारिक अंकपत्र'
                : 'Results, Merit Leaderboard & Official Marksheets'}
            </h2>
            <p className="text-xs sm:text-sm text-blue-100 mt-1">
              {bilingualMode
                ? 'रैंकिंग विश्लेषण देखें, Excel/CSV निर्यात करें, ऑफ़लाइन रसीद (.json) आयात करें, प्रश्नवार समीक्षा खोलें और WhatsApp द्वारा परिणाम भेजें।'
                : 'Analyze merit rankings, import offline result receipts (.json), export Excel CSV reports, and print or send official marksheets via WhatsApp.'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 self-start lg:self-auto shrink-0">
            {onImportOfflineResult && (
              <label
                htmlFor="import-offline-result-input"
                data-testid="import-offline-result-label"
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 min-h-[42px] rounded-xl border border-white/30 bg-white/15 hover:bg-white/25 text-white text-xs sm:text-sm font-semibold transition-colors cursor-pointer whitespace-nowrap"
              >
                <FileUp className="w-4 h-4 text-[#FDE68A]" aria-hidden="true" />
                <span>
                  {bilingualMode ? 'ऑफ़लाइन रसीद आयात (.json)' : 'Import Offline Result (.json)'}
                </span>
                <input
                  id="import-offline-result-input"
                  data-testid="import-offline-result-input"
                  type="file"
                  multiple
                  accept=".json,application/json"
                  onChange={handleImportOfflineFiles}
                  className="sr-only"
                />
              </label>
            )}

            <button
              type="button"
              id="export-results-csv-btn"
              onClick={handleExportCsv}
              disabled={leaderboardRows.length === 0}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 min-h-[42px] rounded-xl bg-gradient-to-r from-[#D4AF37] to-[#F59E0B] hover:brightness-105 text-slate-950 text-xs sm:text-sm font-bold shadow-md transition-all cursor-pointer whitespace-nowrap disabled:opacity-50"
            >
              <Download className="w-4 h-4" aria-hidden="true" />
              <span>{bilingualMode ? 'Excel / CSV निर्यात करें' : 'Export Excel / CSV'}</span>
            </button>
          </div>
        </div>

        <div className="relative p-6 sm:p-8 space-y-5">
          {/* Vibrant Tabular Analytics Counters */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 tabular-nums">
            <div className="rounded-2xl bg-gradient-to-br from-blue-50 to-indigo-50/70 border border-blue-100 p-4">
              <p className="text-xs font-semibold text-blue-700">
                {bilingualMode ? 'कुल सबमिशन' : 'Total Attempts'}
              </p>
              <p
                data-testid="analytics-total-attempts"
                className="text-2xl sm:text-3xl font-extrabold text-slate-900 mt-1"
              >
                {analytics.totalSubmissions}
              </p>
            </div>
            <div className="rounded-2xl bg-gradient-to-br from-violet-50 to-purple-50/70 border border-violet-100 p-4">
              <p className="text-xs font-semibold text-violet-700">
                {bilingualMode ? 'औसत प्रतिशत' : 'Average Score'}
              </p>
              <p
                data-testid="analytics-average-pct"
                className="text-2xl sm:text-3xl font-extrabold text-[#0D47A1] mt-1"
              >
                {analytics.averagePercentage}%
              </p>
            </div>
            <div className="rounded-2xl bg-gradient-to-br from-emerald-50 to-teal-50/70 border border-emerald-100 p-4">
              <p className="text-xs font-semibold text-emerald-700">
                {bilingualMode ? 'सर्वोच्च अंक' : 'Top Merit Score'}
              </p>
              <p
                data-testid="analytics-highest-score"
                className="text-2xl sm:text-3xl font-extrabold text-emerald-700 mt-1"
              >
                {analytics.highestPercentage}%
              </p>
              <p className="text-xs text-slate-600 mt-0.5">{analytics.highestScoreLabel}</p>
            </div>
            <div className="rounded-2xl bg-gradient-to-br from-amber-50 to-orange-50/70 border border-amber-200/70 p-4">
              <p className="text-xs font-semibold text-amber-800">
                {bilingualMode ? 'उत्तीर्ण दर' : 'Pass Rate (≥ 33%)'}
              </p>
              <p
                data-testid="analytics-pass-rate"
                className="text-2xl sm:text-3xl font-extrabold text-slate-900 mt-1"
              >
                {analytics.passRate}%
              </p>
              <p className="text-xs text-slate-600 mt-0.5">
                {analytics.passCount} / {analytics.totalSubmissions}{' '}
                {bilingualMode ? 'उत्तीर्ण' : 'passed'}
              </p>
            </div>
          </div>

          {exportFeedback && (
            <div role="status" data-testid="results-feedback" className="text-xs font-semibold text-emerald-700">
              {exportFeedback}
            </div>
          )}
          {importError && (
            <div role="alert" data-testid="results-import-error" className="text-xs font-semibold text-red-700">
              {importError}
            </div>
          )}
        </div>
      </section>

      {/* Filter Toolbar & Rankings Table */}
      <section className="bg-white border border-indigo-100 rounded-3xl shadow-xl shadow-blue-950/10 p-6 sm:p-8 space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 pb-4 border-b border-slate-200">
          <div className="relative flex-1 max-w-md">
            <Search
              className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
              aria-hidden="true"
            />
            <input
              id="results-search-input"
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              aria-label={
                bilingualMode
                  ? 'छात्र ID, नाम या परीक्षा से खोजें'
                  : 'Search by Student ID, name, roll, or test'
              }
              placeholder={
                bilingualMode
                  ? 'छात्र नाम, 8-अंकीय ID, रोल या परीक्षा...'
                  : 'Search Student ID, name, roll, or test...'
              }
              className="w-full pl-9 pr-3.5 py-2 min-h-[42px] rounded-lg border border-slate-300 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0D47A1]"
            />
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <select
              id="results-class-filter"
              value={classFilter}
              onChange={(e) => setClassFilter(e.target.value)}
              aria-label={bilingualMode ? 'कक्षा फ़िल्टर' : 'Filter results by class'}
              className="px-3.5 py-2 min-h-[42px] rounded-lg border border-slate-300 bg-white text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#0D47A1]"
            >
              <option value="ALL">
                {bilingualMode ? 'सभी कक्षाएं (01 - 12)' : 'All Classes (01 - 12)'}
              </option>
              {CLASS_OPTIONS.map((cls) => (
                <option key={cls} value={cls}>
                  {cls}
                </option>
              ))}
            </select>

            <select
              id="results-test-filter"
              value={testIdFilter}
              onChange={(e) => setTestIdFilter(e.target.value)}
              aria-label={bilingualMode ? 'परीक्षा फ़िल्टर' : 'Filter results by test'}
              className="px-3.5 py-2 min-h-[42px] rounded-lg border border-slate-300 bg-white text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#0D47A1]"
            >
              <option value="ALL">
                {bilingualMode ? 'सभी परीक्षाएं' : 'All Tests'}
              </option>
              {tests.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title} ({t.className})
                </option>
              ))}
            </select>
          </div>
        </div>

        {results.length === 0 ? (
          <div className="py-12 text-center space-y-2">
            <Trophy className="w-10 h-10 text-slate-300 mx-auto" aria-hidden="true" />
            <p className="text-base font-semibold text-slate-800">
              {bilingualMode ? 'अभी कोई परीक्षा परिणाम उपलब्ध नहीं है' : 'No exam results recorded yet'}
            </p>
            <p className="text-sm text-slate-500 max-w-md mx-auto">
              {bilingualMode
                ? 'जैसे ही छात्र "सक्रिय परीक्षाएं" पोर्टल में परीक्षा जमा करेंगे, मेरिट सूची और अंकपत्र यहाँ दिखाई देंगे।'
                : 'Once students submit an examination in the Active Exams portal, rankings and official marksheets will appear here.'}
            </p>
          </div>
        ) : leaderboardRows.length === 0 ? (
          <div className="py-10 text-center space-y-3">
            <FileSpreadsheet className="w-9 h-9 text-slate-300 mx-auto" aria-hidden="true" />
            <p className="text-sm font-semibold text-slate-700">
              {bilingualMode
                ? 'वर्तमान फ़िल्टर से कोई परिणाम मेल नहीं खाता।'
                : 'No results match your current search or filters.'}
            </p>
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setClassFilter('ALL');
                setTestIdFilter('ALL');
              }}
              className="px-4 py-2 min-h-[40px] rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 cursor-pointer"
            >
              {bilingualMode ? 'फ़िल्टर साफ़ करें' : 'Clear Filters'}
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table
              data-testid="leaderboard-table"
              className="w-full text-left border-collapse text-xs sm:text-sm"
            >
              <thead>
                <tr className="border-b border-slate-200 text-slate-500 font-semibold">
                  <th className="py-3 pr-3">{bilingualMode ? 'रैंक' : 'Rank'}</th>
                  <th className="py-3 px-3">{bilingualMode ? 'छात्र / ID' : 'Student & ID'}</th>
                  <th className="py-3 px-3">{bilingualMode ? 'कक्षा / रोल' : 'Class & Roll'}</th>
                  <th className="py-3 px-3">{bilingualMode ? 'परीक्षा' : 'Test & Subject'}</th>
                  <th className="py-3 px-3 text-right">{bilingualMode ? 'अंक' : 'Score'}</th>
                  <th className="py-3 px-3 text-right">{bilingualMode ? 'प्रतिशत' : '%'}</th>
                  <th className="py-3 px-3">{bilingualMode ? 'स्थिति' : 'Status'}</th>
                  <th className="py-3 pl-3 text-right">{bilingualMode ? 'कार्रवाई' : 'Actions'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {leaderboardRows.map((row) => {
                  const whatsappShare = buildWhatsAppResultShare({ row, bilingualMode });
                  return (
                    <tr
                      key={row.result.id}
                      data-testid={`leaderboard-row-${row.result.studentId}`}
                      className="hover:bg-slate-50/80 transition-colors"
                    >
                      <td className="py-3.5 pr-3 font-mono font-bold text-[#0D47A1] tabular-nums whitespace-nowrap">
                        #{row.rank}
                      </td>
                      <td className="py-3.5 px-3">
                        <div className="flex items-center gap-2.5">
                          {row.photoDataUrl ? (
                            <img
                              src={row.photoDataUrl}
                              alt={row.studentName}
                              data-testid={`leaderboard-photo-${row.result.studentId}`}
                              className="w-9 h-10 rounded-md object-cover border border-[#D4AF37] shrink-0"
                            />
                          ) : (
                            <div className="w-9 h-10 rounded-md bg-slate-100 border border-slate-300 text-[#0D47A1] text-xs font-bold flex items-center justify-center shrink-0">
                              {getRowInitials(row.studentName)}
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="font-bold text-slate-900">{row.studentName}</p>
                            <p className="text-xs font-mono text-slate-500 tabular-nums">
                              {row.result.studentId} · {row.fatherName}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-3 text-slate-700 tabular-nums whitespace-nowrap">
                        <p>{row.className} · {bilingualMode ? 'रोल' : 'Roll'} {row.rollNumber}</p>
                        <p className="text-[11px] text-slate-500 font-mono">
                          {row.whatsappMobile || '—'}
                        </p>
                      </td>
                      <td className="py-3.5 px-3">
                        <p className="font-semibold text-slate-800">{row.testTitle}</p>
                        <p className="text-xs text-slate-500">
                          {row.subject} · {row.examLocationMode === 'offline_html' ? 'Offline HTML' : 'Online'}
                        </p>
                      </td>
                      <td className="py-3.5 px-3 text-right font-mono font-bold text-slate-900 tabular-nums whitespace-nowrap">
                        {row.result.score} / {row.result.totalMarks}
                      </td>
                      <td className="py-3.5 px-3 text-right font-mono font-bold text-[#0D47A1] tabular-nums whitespace-nowrap">
                        {row.result.percentage}%
                      </td>
                      <td className="py-3.5 px-3 whitespace-nowrap">
                        <span
                          className={`text-xs font-bold ${
                            row.passed ? 'text-emerald-700' : 'text-red-700'
                          }`}
                        >
                          {row.passed
                            ? bilingualMode
                              ? 'उत्तीर्ण (PASS)'
                              : 'PASS'
                            : bilingualMode
                              ? 'अनुत्तीर्ण (FAIL)'
                              : 'FAIL'}
                        </span>
                      </td>
                      <td className="py-3.5 pl-3 text-right whitespace-nowrap">
                        <div className="inline-flex items-center justify-end gap-2">
                          <a
                            href={whatsappShare.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label={`Send result on WhatsApp for ${row.studentName}`}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 min-h-[36px] rounded-lg border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-semibold transition-colors"
                          >
                            <MessageCircle className="w-3.5 h-3.5" aria-hidden="true" />
                            <span>WhatsApp</span>
                          </a>
                          <button
                            type="button"
                            data-testid={`open-marksheet-${row.result.studentId}`}
                            onClick={() => setSelectedRow(row)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[36px] rounded-xl bg-gradient-to-r from-[#0D47A1] to-[#2563EB] hover:brightness-110 text-white text-xs font-semibold shadow-sm transition-all cursor-pointer"
                          >
                            <Award className="w-3.5 h-3.5 text-[#FDE68A]" aria-hidden="true" />
                            <span>{bilingualMode ? 'अंकपत्र' : 'Marksheet'}</span>
                          </button>
                          <button
                            type="button"
                            data-testid={`delete-result-${row.result.studentId}`}
                            onClick={() => setPendingDeleteRow(row)}
                            aria-label={
                              bilingualMode
                                ? `${row.studentName} का परिणाम हटाएं`
                                : `Delete result for ${row.studentName}`
                            }
                            title={bilingualMode ? 'परिणाम हटाएं' : 'Delete Result'}
                            className="inline-flex items-center justify-center p-2 min-h-[36px] min-w-[36px] rounded-lg border border-red-200 bg-white hover:bg-red-50 text-red-700 transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <OfficialMarksheetModal
        row={selectedRow}
        bilingualMode={bilingualMode}
        onClose={() => setSelectedRow(null)}
      />

      {pendingDeleteRow && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="confirm-delete-result-title"
          data-testid="confirm-delete-result-modal"
        >
          <div className="bg-white rounded-3xl border border-indigo-100 max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-red-50 text-red-700 shrink-0">
                <AlertTriangle className="w-5 h-5" aria-hidden="true" />
              </div>
              <div className="space-y-1">
                <h3
                  id="confirm-delete-result-title"
                  className="text-base font-bold text-slate-900"
                >
                  {bilingualMode
                    ? 'क्या आप यह परीक्षा परिणाम हटाना चाहते हैं?'
                    : 'Delete Exam Result Record?'}
                </h3>
                <p className="text-xs sm:text-sm text-slate-600">
                  {bilingualMode
                    ? 'यह कार्रवाई स्थायी है और मेरिट विश्लेषण तुरंत अपडेट हो जाएगा।'
                    : 'This permanently removes the result from local storage and immediately updates merit analytics.'}
                </p>
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs space-y-1 tabular-nums">
              <p className="font-bold text-slate-900">
                {pendingDeleteRow.studentName}{' '}
                <span className="font-mono text-slate-500">
                  ({pendingDeleteRow.result.studentId})
                </span>
              </p>
              <p className="text-slate-600">
                {pendingDeleteRow.testTitle} · {pendingDeleteRow.className}
              </p>
              <p className="font-semibold text-[#0D47A1]">
                {bilingualMode ? 'प्राप्तांक:' : 'Score:'} {pendingDeleteRow.result.score} /{' '}
                {pendingDeleteRow.result.totalMarks} ({pendingDeleteRow.result.percentage}%)
              </p>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setPendingDeleteRow(null)}
                className="px-4 py-2 min-h-[40px] rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 cursor-pointer"
              >
                {bilingualMode ? 'रद्द करें' : 'Cancel'}
              </button>
              <button
                type="button"
                data-testid="confirm-delete-result-btn"
                onClick={handleConfirmDeleteResult}
                className="inline-flex items-center gap-1.5 px-4 py-2 min-h-[40px] rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-semibold cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                <span>{bilingualMode ? 'हां, परिणाम हटाएं' : 'Delete Result'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
