import React, { useEffect } from 'react';
import { CheckCircle2, X } from 'lucide-react';
import type { QuestionModel } from '../types/exam';

interface TestPreviewModalProps {
  isOpen: boolean;
  bilingualMode: boolean;
  title: string;
  className: string;
  subject: string;
  marksPerQuestion: number;
  negativeMarking: number;
  durationMinutes: number;
  maxViolations: number;
  allowedStudentIds?: string[];
  questions: QuestionModel[];
  onClose: () => void;
}

const OPTION_LETTERS = ['A', 'B', 'C', 'D'] as const;

export const TestPreviewModal: React.FC<TestPreviewModalProps> = ({
  isOpen,
  bilingualMode,
  title,
  className,
  subject,
  marksPerQuestion,
  negativeMarking,
  durationMinutes,
  maxViolations,
  allowedStudentIds = [],
  questions,
  onClose,
}) => {
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const totalMarks = questions.length * marksPerQuestion;

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="test-preview-title"
      data-testid="test-preview-modal"
    >
      <div className="bg-white border border-indigo-100 rounded-3xl max-w-3xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-[#0D47A1] via-[#1D4ED8] to-[#312E81] text-white border-b-4 border-[#D4AF37] flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs font-semibold text-[#FDE68A]">
              {bilingualMode ? 'परीक्षा पूर्वावलोकन' : 'Test Paper Preview'}
            </p>
            <h3 id="test-preview-title" className="text-lg font-extrabold truncate mt-0.5">
              {title.trim() || (bilingualMode ? 'शीर्षकहीन परीक्षा' : 'Untitled Test')}
            </h3>
            <p className="text-xs text-blue-100 tabular-nums mt-1">
              {className} · {subject || '—'} · {questions.length}{' '}
              {bilingualMode ? 'प्रश्न' : 'Questions'} · {totalMarks}{' '}
              {bilingualMode ? 'अंक' : 'Marks'} · {durationMinutes}{' '}
              {bilingualMode ? 'मिनट' : 'min'} ·{' '}
              {negativeMarking > 0
                ? `-${negativeMarking} ${bilingualMode ? 'नकारात्मक' : 'neg'}`
                : bilingualMode
                  ? 'नकारात्मक अंक नहीं'
                  : 'No Negative'}{' '}
              · {bilingualMode ? 'अधिकतम उल्लंघन:' : 'Max Violations:'} {maxViolations}
              {allowedStudentIds.length > 0 &&
                ` · ${bilingualMode ? 'प्रतिबंधित ID:' : 'Restricted IDs:'} ${allowedStudentIds.join(', ')}`}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={bilingualMode ? 'पूर्वावलोकन बंद करें' : 'Close test preview'}
            className="p-2 min-h-[40px] min-w-[40px] inline-flex items-center justify-center rounded-lg bg-[#083275] hover:bg-[#06265B] text-white cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Questions Preview Body */}
        <div className="p-6 overflow-y-auto space-y-6">
          {questions.length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-8">
              {bilingualMode
                ? 'पूर्वावलोकन के लिए कोई प्रश्न नहीं जोड़ा गया है।'
                : 'No questions added yet to preview.'}
            </p>
          ) : (
            questions.map((q, index) => (
              <article
                key={q.id}
                className="border border-slate-200 rounded-xl p-4 sm:p-5 space-y-3 bg-slate-50/40"
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm font-bold text-slate-900 whitespace-pre-line">
                    <span className="text-[#0D47A1] mr-1.5 tabular-nums">Q{index + 1}.</span>
                    {q.questionText || (bilingualMode ? '(खाली प्रश्न)' : '(Empty question)')}
                  </p>
                  <span className="text-xs font-mono font-semibold text-slate-500 tabular-nums shrink-0">
                    +{marksPerQuestion}
                  </span>
                </div>

                {q.questionImage && (
                  <div className="pt-1">
                    <img
                      src={q.questionImage}
                      alt={`Diagram for Question ${index + 1}`}
                      referrerPolicy="no-referrer"
                      className="max-h-52 rounded-lg border border-slate-200 object-contain bg-white"
                    />
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                  {q.options.map((opt, optIdx) => {
                    const isCorrect = q.correctOption === optIdx;
                    return (
                      <div
                        key={optIdx}
                        className={`px-3 py-2 rounded-lg border text-xs sm:text-sm flex items-center justify-between gap-2 ${
                          isCorrect
                            ? 'bg-emerald-50 border-emerald-300 text-emerald-950 font-semibold'
                            : 'bg-white border-slate-200 text-slate-700'
                        }`}
                      >
                        <span>
                          <span className="font-bold mr-1.5">{OPTION_LETTERS[optIdx]})</span>
                          {opt || '—'}
                        </span>
                        {isCorrect && (
                          <CheckCircle2
                            className="w-4 h-4 text-emerald-600 shrink-0"
                            aria-hidden="true"
                          />
                        )}
                      </div>
                    );
                  })}
                </div>

                {q.explanation && (
                  <p className="text-xs text-slate-600 pt-2 border-t border-slate-200">
                    <span className="font-semibold text-slate-800">
                      {bilingualMode ? 'व्याख्या: ' : 'Explanation: '}
                    </span>
                    {q.explanation}
                  </p>
                )}
              </article>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-slate-200 flex justify-end bg-slate-50 rounded-b-xl">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 min-h-[40px] rounded-lg bg-[#0D47A1] hover:bg-[#083275] text-white text-xs font-semibold cursor-pointer"
          >
            {bilingualMode ? 'पूर्वावलोकन बंद करें' : 'Close Preview'}
          </button>
        </div>
      </div>
    </div>
  );
};
