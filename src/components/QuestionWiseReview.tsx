import React, { useMemo, useState } from 'react';
import { CheckCircle2, HelpCircle, MinusCircle, XCircle } from 'lucide-react';
import {
  buildQuestionReviewItems,
  type ReviewFilterMode,
} from '../utils/resultsAnalytics';
import type { Result, Test } from '../types/exam';

interface QuestionWiseReviewProps {
  test?: Test;
  result: Result;
  bilingualMode: boolean;
}

const OPTION_LETTERS = ['A', 'B', 'C', 'D'] as const;

export const QuestionWiseReview: React.FC<QuestionWiseReviewProps> = ({
  test,
  result,
  bilingualMode,
}) => {
  const [filterMode, setFilterMode] = useState<ReviewFilterMode>('all');

  const items = useMemo(
    () => buildQuestionReviewItems(test, result),
    [test, result],
  );

  const counts = useMemo(() => {
    let correct = 0;
    let wrong = 0;
    let unattempted = 0;
    for (const item of items) {
      if (item.status === 'correct') correct += 1;
      else if (item.status === 'wrong') wrong += 1;
      else unattempted += 1;
    }
    return { all: items.length, correct, wrong, unattempted };
  }, [items]);

  const filteredItems = useMemo(() => {
    if (filterMode === 'all') return items;
    return items.filter((item) => item.status === filterMode);
  }, [items, filterMode]);

  if (!test || items.length === 0) {
    return (
      <section
        data-testid="question-wise-review"
        className="pt-5 border-t border-slate-200 space-y-2 no-print"
      >
        <h4 className="text-base font-bold text-slate-900">
          {bilingualMode ? 'प्रश्नवार समीक्षा' : 'Question-Wise Review'}
        </h4>
        <p className="text-xs sm:text-sm text-slate-500">
          {bilingualMode
            ? 'इस परिणाम से जुड़ा मूल प्रश्नपत्र उपलब्ध नहीं है।'
            : 'The underlying question paper for this submission is no longer available in the workspace.'}
        </p>
      </section>
    );
  }

  const filterButtons: {
    key: ReviewFilterMode;
    labelEn: string;
    labelHi: string;
    count: number;
  }[] = [
    { key: 'all', labelEn: 'View All', labelHi: 'सभी प्रश्न', count: counts.all },
    {
      key: 'correct',
      labelEn: 'Correct Answers',
      labelHi: 'सही उत्तर',
      count: counts.correct,
    },
    {
      key: 'wrong',
      labelEn: 'Wrong Answers',
      labelHi: 'गलत उत्तर',
      count: counts.wrong,
    },
    {
      key: 'unattempted',
      labelEn: 'Unattempted',
      labelHi: 'अप्रयासित',
      count: counts.unattempted,
    },
  ];

  return (
    <section
      data-testid="question-wise-review"
      className="pt-6 border-t border-slate-200 space-y-5 no-print"
    >
      <div className="space-y-3">
        <div>
          <h4 className="text-lg font-bold text-slate-900">
            {bilingualMode ? 'प्रश्नवार समीक्षा एवं हल' : 'Question-Wise Review & Solutions'}
          </h4>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            {bilingualMode
              ? 'छात्र द्वारा चयनित विकल्प, सही उत्तर, प्राप्त अंक और व्याख्या देखें।'
              : 'Inspect student selections, answer keys, marks awarded, and explanatory solutions.'}
          </p>
        </div>

        {/* Interactive Filter Controls */}
        <div
          role="group"
          aria-label={bilingualMode ? 'समीक्षा फ़िल्टर' : 'Filter question review'}
          className="inline-flex flex-wrap items-center gap-1.5 p-1 bg-slate-100 rounded-lg"
        >
          {filterButtons.map((btn) => {
            const active = filterMode === btn.key;
            return (
              <button
                key={btn.key}
                type="button"
                data-testid={`review-filter-${btn.key}`}
                aria-pressed={active}
                onClick={() => setFilterMode(btn.key)}
                className={`px-3 py-1.5 min-h-[36px] rounded-md text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap tabular-nums ${
                  active
                    ? 'bg-white text-[#0D47A1] shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {bilingualMode ? btn.labelHi : btn.labelEn} ({btn.count})
              </button>
            );
          })}
        </div>
      </div>

      {filteredItems.length === 0 ? (
        <div className="py-8 text-center border border-dashed border-slate-200 rounded-xl space-y-1.5">
          <HelpCircle className="w-8 h-8 text-slate-300 mx-auto" aria-hidden="true" />
          <p className="text-sm font-semibold text-slate-700">
            {bilingualMode
              ? 'इस श्रेणी में कोई प्रश्न नहीं है।'
              : 'No questions match the selected review filter.'}
          </p>
        </div>
      ) : (
        <div className="space-y-4" data-testid="review-questions-list">
          {filteredItems.map((item) => {
            const { index, question, selectedOption, status, marksAwarded } = item;
            return (
              <article
                key={question.id}
                data-testid={`review-item-${index + 1}`}
                className="border border-slate-200 rounded-xl p-4 sm:p-5 bg-white space-y-3"
              >
                <div className="flex flex-wrap items-start justify-between gap-2 pb-2 border-b border-slate-100">
                  <div className="flex items-center gap-2 text-xs font-bold">
                    <span className="text-[#0D47A1] tabular-nums">Q{index + 1}.</span>
                    {status === 'correct' && (
                      <span className="inline-flex items-center gap-1 text-emerald-700">
                        <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>{bilingualMode ? 'सही' : 'Correct'}</span>
                      </span>
                    )}
                    {status === 'wrong' && (
                      <span className="inline-flex items-center gap-1 text-red-700">
                        <XCircle className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>{bilingualMode ? 'गलत' : 'Wrong'}</span>
                      </span>
                    )}
                    {status === 'unattempted' && (
                      <span className="inline-flex items-center gap-1 text-slate-600">
                        <MinusCircle className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>{bilingualMode ? 'अप्रयासित' : 'Unattempted'}</span>
                      </span>
                    )}
                  </div>

                  <span
                    className={`text-xs font-mono font-bold tabular-nums ${
                      marksAwarded > 0
                        ? 'text-emerald-700'
                        : marksAwarded < 0
                          ? 'text-red-700'
                          : 'text-slate-600'
                    }`}
                  >
                    {bilingualMode ? 'अंक:' : 'Marks:'}{' '}
                    {marksAwarded > 0 ? `+${marksAwarded}` : marksAwarded}
                  </span>
                </div>

                <p className="text-sm font-semibold text-slate-900 whitespace-pre-line">
                  {question.questionText}
                </p>

                {question.questionImage && (
                  <img
                    src={question.questionImage}
                    alt={`Diagram for Question ${index + 1}`}
                    referrerPolicy="no-referrer"
                    className="max-h-44 rounded-lg border border-slate-200 object-contain bg-white"
                  />
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {question.options.map((optText, optIdx) => {
                    const isCorrectOption = question.correctOption === optIdx;
                    const isStudentChoice = selectedOption === optIdx;

                    let cardClasses = 'bg-white border-slate-200 text-slate-700';
                    if (isCorrectOption) {
                      cardClasses =
                        'bg-emerald-50 border-emerald-300 text-emerald-950 font-semibold';
                    } else if (isStudentChoice && !isCorrectOption) {
                      cardClasses = 'bg-red-50 border-red-300 text-red-900 font-semibold';
                    }

                    return (
                      <div
                        key={optIdx}
                        className={`px-3 py-2 rounded-lg border text-xs sm:text-sm flex items-center justify-between gap-2 ${cardClasses}`}
                      >
                        <span>
                          <span className="font-bold mr-1.5">{OPTION_LETTERS[optIdx]})</span>
                          {optText}
                        </span>
                        <span className="text-[11px] font-semibold shrink-0">
                          {isCorrectOption && isStudentChoice
                            ? bilingualMode
                              ? 'सही (आपका उत्तर)'
                              : 'Correct · Your Pick'
                            : isCorrectOption
                              ? bilingualMode
                                ? 'सही उत्तर'
                                : 'Correct Key'
                              : isStudentChoice
                                ? bilingualMode
                                  ? 'आपका उत्तर'
                                  : 'Your Pick'
                                : ''}
                        </span>
                      </div>
                    );
                  })}
                </div>

                {question.explanation && (
                  <p className="text-xs text-slate-600 pt-2 border-t border-slate-100">
                    <span className="font-semibold text-slate-800">
                      {bilingualMode ? 'व्याख्या: ' : 'Solution: '}
                    </span>
                    {question.explanation}
                  </p>
                )}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
};
