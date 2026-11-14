import React, { useEffect, useState } from 'react';
import {
  Check,
  CheckCircle2,
  Copy,
  MessageCircle,
  Printer,
  X,
  XCircle,
} from 'lucide-react';
import {
  DirectorSignatureSVG,
  InstitutionLogo,
  InstitutionWatermark,
  OfficialSealSVG,
} from './BrandingSVGs';
import { QuestionWiseReview } from './QuestionWiseReview';
import { INSTITUTION_INFO } from '../constants/institution';
import {
  buildWhatsAppResultShare,
  type LeaderboardRow,
} from '../utils/resultsAnalytics';

interface OfficialMarksheetModalProps {
  row: LeaderboardRow | null;
  bilingualMode: boolean;
  onClose: () => void;
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0 || !parts[0]) return 'ST';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export const OfficialMarksheetModal: React.FC<OfficialMarksheetModalProps> = ({
  row,
  bilingualMode,
  onClose,
}) => {
  const [copiedSummary, setCopiedSummary] = useState<boolean>(false);

  useEffect(() => {
    if (!row) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [row, onClose]);

  if (!row) return null;

  const { result, student, test } = row;
  const whatsappShare = buildWhatsAppResultShare({ row, bilingualMode });
  const submittedDateLabel = new Date(result.submittedAt).toLocaleString(
    bilingualMode ? 'hi-IN' : 'en-IN',
    {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    },
  );

  const handleCopyMessage = async () => {
    try {
      await navigator.clipboard.writeText(whatsappShare.message);
    } catch {
      // Clipboard fallback
    }
    setCopiedSummary(true);
    window.setTimeout(() => setCopiedSummary(false), 1800);
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-3 sm:p-5 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="official-marksheet-modal-title"
      data-testid="official-marksheet-modal"
    >
      <div className="bg-white border border-indigo-100 rounded-3xl max-w-4xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Top Action Bar (Non-Printable) */}
        <div className="px-5 py-3.5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 bg-gradient-to-r from-slate-50 to-blue-50/60 no-print">
          <div>
            <h3
              id="official-marksheet-modal-title"
              className="text-base font-bold text-slate-900"
            >
              {bilingualMode ? 'आधिकारिक अंकपत्र एवं प्रश्न समीक्षा' : 'Official Marksheet & Review'}
            </h3>
            <p className="text-xs text-slate-500 tabular-nums mt-0.5">
              {row.studentName} · ID: {result.studentId} · Rank #{row.rank}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <a
              href={whatsappShare.url}
              target="_blank"
              rel="noopener noreferrer"
              data-testid="whatsapp-share-link"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 min-h-[40px] rounded-lg bg-[#15803D] hover:bg-[#166534] text-white text-xs font-semibold transition-colors whitespace-nowrap"
            >
              <MessageCircle className="w-4 h-4" aria-hidden="true" />
              <span>
                {bilingualMode ? 'WhatsApp पर भेजें' : 'Send via WhatsApp'}
              </span>
            </a>

            <button
              type="button"
              onClick={handleCopyMessage}
              className="inline-flex items-center gap-1.5 px-3 py-2 min-h-[40px] rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 cursor-pointer whitespace-nowrap"
            >
              {copiedSummary ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600" aria-hidden="true" />
                  <span className="text-emerald-700">
                    {bilingualMode ? 'संदेश कॉपी' : 'Message Copied'}
                  </span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-slate-500" aria-hidden="true" />
                  <span>{bilingualMode ? 'सारांश कॉपी' : 'Copy Summary'}</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 min-h-[40px] rounded-lg bg-[#0D47A1] hover:bg-[#083275] text-white text-xs font-semibold cursor-pointer whitespace-nowrap"
            >
              <Printer className="w-3.5 h-3.5 text-[#F5DC7F]" aria-hidden="true" />
              <span>{bilingualMode ? 'अंकपत्र प्रिंट करें' : 'Print Marksheet'}</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              aria-label={bilingualMode ? 'अंकपत्र बंद करें' : 'Close marksheet modal'}
              className="p-2 min-h-[40px] min-w-[40px] inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-600 hover:bg-slate-100 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-6">
          {/* PRINTABLE OFFICIAL MARKSHEET */}
          <div
            id="printable-marksheet"
            data-testid="printable-marksheet"
            className="relative border-2 border-[#0D47A1] rounded-2xl overflow-hidden bg-white shadow-md"
          >
            <InstitutionWatermark className="w-64 h-64 right-6 top-32 opacity-[0.04]" />
            {/* Institute Header */}
            <div className="relative bg-gradient-to-r from-[#0A367E] via-[#0D47A1] to-[#1E3A8A] text-white px-6 py-5 border-b-4 border-[#D4AF37] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <InstitutionLogo className="w-16 h-16 shrink-0" />
                <div className="space-y-0.5">
                  <p className="text-xs font-semibold text-[#F5DC7F] tracking-wide">
                    {INSTITUTION_INFO.shortName} · {INSTITUTION_INFO.mottoEn}
                  </p>
                  <h4 className="text-base sm:text-lg font-bold leading-snug text-balance">
                    {INSTITUTION_INFO.nameEn}
                  </h4>
                  <p className="text-sm font-semibold text-slate-100">
                    {INSTITUTION_INFO.nameHi}
                  </p>
                  <p className="text-xs text-slate-200 tabular-nums">
                    {INSTITUTION_INFO.addressEn} · Mob: {INSTITUTION_INFO.mobile}
                  </p>
                </div>
              </div>

              <div className="sm:text-right shrink-0">
                <p className="text-xs font-bold uppercase tracking-wider text-[#F5DC7F]">
                  {bilingualMode ? 'आधिकारिक अंकपत्र' : 'Official Statement of Marks'}
                </p>
                <p className="text-xs text-slate-200 font-mono tabular-nums mt-0.5">
                  Session {INSTITUTION_INFO.session} · Rank #{row.rank}
                </p>
              </div>
            </div>

            {/* Student Details + Photo Placeholder */}
            <div className="p-6 space-y-6">
              <div className="flex flex-col sm:flex-row items-start justify-between gap-5 pb-5 border-b border-slate-200">
                <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2.5 text-xs sm:text-sm flex-1 w-full">
                  <div>
                    <dt className="text-xs text-slate-500">
                      {bilingualMode ? 'छात्र का नाम / Student Name' : 'Student Name'}
                    </dt>
                    <dd className="font-bold text-slate-900 text-base mt-0.5">
                      {row.studentName}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-slate-500">
                      {bilingualMode ? '8-अंकीय छात्र ID / Student ID' : '8-Digit Student ID'}
                    </dt>
                    <dd className="font-mono font-bold text-[#0D47A1] tabular-nums mt-0.5">
                      {result.studentId}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-slate-500">
                      {bilingualMode ? 'पिता का नाम / Father Name' : "Father's Name"}
                    </dt>
                    <dd className="font-semibold text-slate-800 mt-0.5">{row.fatherName}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-slate-500">
                      {bilingualMode ? 'माता का नाम / Mother Name' : "Mother's Name"}
                    </dt>
                    <dd className="font-semibold text-slate-800 mt-0.5">{row.motherName}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-slate-500">
                      {bilingualMode ? 'कक्षा एवं रोल नंबर' : 'Class & Roll Number'}
                    </dt>
                    <dd className="font-semibold text-slate-800 tabular-nums mt-0.5">
                      {row.className} · Roll {row.rollNumber}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-slate-500">
                      {bilingualMode ? 'WhatsApp मोबाइल / Mobile' : 'WhatsApp Mobile'}
                    </dt>
                    <dd className="font-mono font-semibold text-slate-800 tabular-nums mt-0.5">
                      {row.whatsappMobile || '—'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-slate-500">
                      {bilingualMode ? 'पता / Address' : 'Address'}
                    </dt>
                    <dd className="font-semibold text-slate-800 mt-0.5">{row.address}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-slate-500">
                      {bilingualMode ? 'परीक्षा एवं विषय' : 'Examination & Subject'}
                    </dt>
                    <dd className="font-semibold text-slate-800 mt-0.5">
                      {row.testTitle} ({row.subject})
                    </dd>
                  </div>
                </dl>

                {/* Student Photo / Placeholder */}
                <div className="shrink-0 flex flex-col items-center gap-1.5">
                  {row.photoDataUrl ? (
                    <img
                      src={row.photoDataUrl}
                      alt={row.studentName}
                      data-testid="marksheet-student-photo"
                      referrerPolicy="no-referrer"
                      className="w-24 h-28 object-cover rounded-lg border-2 border-[#D4AF37]"
                    />
                  ) : (
                    <div
                      data-testid="marksheet-photo-placeholder"
                      className="w-24 h-28 rounded-lg border-2 border-[#D4AF37] bg-slate-100 flex flex-col items-center justify-center text-[#0D47A1]"
                    >
                      <span className="text-xl font-bold">{getInitials(row.studentName)}</span>
                      <span className="text-[10px] font-medium text-slate-500 mt-1">
                        {bilingualMode ? 'फोटो स्थान' : 'Photo'}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Score Breakdown Table & Pass/Fail Result */}
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h5 className="text-sm font-bold text-slate-900">
                    {bilingualMode ? 'अंक विवरण तालिका' : 'Examination Score Breakdown'}
                  </h5>

                  <div
                    data-testid="marksheet-pass-fail"
                    className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-md border text-xs font-bold tracking-wide ${
                      row.passed
                        ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                        : 'bg-red-50 border-red-300 text-red-800'
                    }`}
                  >
                    {row.passed ? (
                      <>
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" aria-hidden="true" />
                        <span>{bilingualMode ? 'उत्तीर्ण · PASS' : 'RESULT: PASS'}</span>
                      </>
                    ) : (
                      <>
                        <XCircle className="w-4 h-4 text-red-600" aria-hidden="true" />
                        <span>{bilingualMode ? 'अनुत्तीर्ण · FAIL' : 'RESULT: FAIL'}</span>
                      </>
                    )}
                  </div>
                </div>

                <div className="overflow-x-auto border border-slate-200 rounded-lg">
                  <table className="w-full text-left border-collapse text-xs sm:text-sm tabular-nums">
                    <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                      <tr>
                        <th className="py-2.5 px-3 font-semibold">
                          {bilingualMode ? 'कुल प्रश्न' : 'Total'}
                        </th>
                        <th className="py-2.5 px-3 font-semibold">
                          {bilingualMode ? 'प्रयासित' : 'Attempted'}
                        </th>
                        <th className="py-2.5 px-3 font-semibold text-emerald-700">
                          {bilingualMode ? 'सही' : 'Correct'}
                        </th>
                        <th className="py-2.5 px-3 font-semibold text-red-700">
                          {bilingualMode ? 'गलत' : 'Wrong'}
                        </th>
                        <th className="py-2.5 px-3 font-semibold">
                          {bilingualMode ? 'छोड़े गए' : 'Skipped'}
                        </th>
                        <th className="py-2.5 px-3 font-semibold text-[#0D47A1]">
                          {bilingualMode ? 'प्राप्तांक' : 'Obtained Marks'}
                        </th>
                        <th className="py-2.5 px-3 font-semibold">
                          {bilingualMode ? 'प्रतिशत' : 'Percentage'}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="font-bold text-slate-900">
                        <td className="py-3 px-3">{row.totalQuestions}</td>
                        <td className="py-3 px-3">{row.attemptedCount}</td>
                        <td className="py-3 px-3 text-emerald-700">{result.correctCount}</td>
                        <td className="py-3 px-3 text-red-700">{result.wrongCount}</td>
                        <td className="py-3 px-3 text-slate-600">{result.unansweredCount}</td>
                        <td className="py-3 px-3 text-[#0D47A1]">
                          {result.score} / {result.totalMarks}
                        </td>
                        <td className="py-3 px-3">{result.percentage}%</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <p className="text-xs text-slate-500 tabular-nums">
                  {bilingualMode ? 'परीक्षा टोकन:' : 'Test Token:'} {row.testToken} ·{' '}
                  {bilingualMode ? 'सबमिशन:' : 'Submitted:'} {submittedDateLabel} ·{' '}
                  {bilingualMode ? 'एंटी-चीट उल्लंघन:' : 'Anti-Cheat Violations:'}{' '}
                  {result.violationsCount ?? 0}
                </p>
              </div>

              {/* Official Seal & Director Signature Footer */}
              <div className="pt-5 border-t border-slate-200 flex flex-col sm:flex-row items-center sm:items-end justify-between gap-6">
                <div className="flex items-center gap-3">
                  <OfficialSealSVG className="w-24 h-24 shrink-0" />
                  <div className="text-xs text-slate-600">
                    <p className="font-bold text-slate-800">
                      {bilingualMode ? 'संस्थान आधिकारिक मुहर' : 'Official Institution Seal'}
                    </p>
                    <p>{INSTITUTION_INFO.addressEn}</p>
                  </div>
                </div>

                <div className="flex flex-col items-center text-center">
                  <DirectorSignatureSVG className="w-44 h-16" />
                  <p className="text-xs font-bold text-slate-900 border-t border-slate-300 pt-1 px-4">
                    {bilingualMode ? INSTITUTION_INFO.directorHi : INSTITUTION_INFO.directorEn}
                  </p>
                  <p className="text-[11px] text-slate-500">
                    {bilingualMode ? 'निदेशक · श्री राधे शिक्षण संस्थान' : 'Director · Shri Radhe Shikshan Sansthan'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Question-Wise Review Section */}
          <QuestionWiseReview test={test} result={result} bilingualMode={bilingualMode} />
        </div>
      </div>
    </div>
  );
};
