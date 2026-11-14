import React, { useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  BookOpen,
  Download,
  Eye,
  FileText,
  FileUp,
  ImagePlus,
  ImageUp,
  Loader2,
  Lock,
  Plus,
  Send,
  Sparkles,
  Trash2,
  Wand2,
  X,
} from 'lucide-react';
import { CLASS_OPTIONS, normalizeClass, tryNormalizeClass } from '../utils/studentId';
import {
  SAMPLE_BILINGUAL_MCQS,
  generateTestToken,
  parseRawTextToMCQsAsync,
} from '../utils/mcqParser';
import { parseAllowedStudentIds } from '../utils/examEvaluation';
import { extractQuestionsSmartWithAiOcr } from '../utils/documentTextExtractor';
import {
  buildStrictOnlineExamHTML,
  loadInstitutionLogoDataUrl,
} from '../utils/offlineExamBuilder';
import type { QuestionModel, Student, Test } from '../types/exam';
import { InstitutionWatermark } from './BrandingSVGs';
import { TestPreviewModal } from './TestPreviewModal';

interface QuestionBuilderProps {
  bilingualMode: boolean;
  existingTests: Test[];
  students?: Student[];
  onPublishTest: (test: Test) => void;
}

const OPTION_LETTERS = ['A', 'B', 'C', 'D'] as const;

const SUBJECT_SUGGESTIONS = [
  'Mathematics',
  'Science',
  'Physics',
  'Chemistry',
  'Biology',
  'Social Science',
  'Hindi',
  'English',
  'General Knowledge',
];

function createBlankQuestion(): QuestionModel {
  const rand = globalThis.crypto?.getRandomValues
    ? globalThis.crypto.getRandomValues(new Uint32Array(1))[0].toString(36)
    : Math.random().toString(36).slice(2, 8);
  return {
    id: `q-${Date.now().toString(36)}-${rand}`,
    questionText: '',
    options: ['', '', '', ''],
    correctOption: 0,
    explanation: '',
  };
}

async function resizeQuestionImageToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read image file.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Invalid image file selected.'));
      img.onload = () => {
        const maxWidth = 720;
        const maxHeight = 480;
        const scale = Math.min(maxWidth / img.width, maxHeight / img.height, 1);
        const width = Math.max(1, Math.round(img.width * scale));
        const height = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(String(reader.result));
          return;
        }
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.85));
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

export const QuestionBuilder: React.FC<QuestionBuilderProps> = ({
  bilingualMode,
  existingTests,
  students = [],
  onPublishTest,
}) => {
  // Test Configuration State
  const [title, setTitle] = useState<string>('');
  const [allowedStudentIdsInput, setAllowedStudentIdsInput] = useState<string>('');
  const [className, setClassName] = useState<string>('Class 10');
  const [subject, setSubject] = useState<string>('');
  const [marksPerQuestion, setMarksPerQuestion] = useState<string>('1');
  const [negativeMarking, setNegativeMarking] = useState<string>('0');
  const [durationMinutes, setDurationMinutes] = useState<string>('30');
  const [maxViolations, setMaxViolations] = useState<string>('3');

  const parsedAllowedIds = useMemo(
    () => parseAllowedStudentIds(allowedStudentIdsInput),
    [allowedStudentIdsInput],
  );

  // Parser & Draft Questions State
  const [rawPasteText, setRawPasteText] = useState<string>('');
  const [isParsing, setIsParsing] = useState<boolean>(false);
  const [isExtractingFile, setIsExtractingFile] = useState<boolean>(false);
  const [extractionStatus, setExtractionStatus] = useState<string>('');
  const [parseFeedback, setParseFeedback] = useState<string>('');
  const [parseWarnings, setParseWarnings] = useState<string[]>([]);
  const [questions, setQuestions] = useState<QuestionModel[]>([]);
  const [formErrors, setFormErrors] = useState<string[]>([]);
  const [isPreviewOpen, setIsPreviewOpen] = useState<boolean>(false);

  const numericMarks = Math.max(0, Number.parseFloat(marksPerQuestion) || 0);
  const numericNegative = Math.max(0, Number.parseFloat(negativeMarking) || 0);
  const numericDuration = Math.max(0, Number.parseInt(durationMinutes, 10) || 0);
  const numericViolations = Math.max(0, Number.parseInt(maxViolations, 10) || 0);
  const totalMarks = Number((questions.length * numericMarks).toFixed(2));

  const runParseAndImport = async (sourceText: string, extraWarnings: string[] = []) => {
    setIsParsing(true);
    setParseWarnings(extraWarnings);
    try {
      const result = await parseRawTextToMCQsAsync(sourceText);
      if (result.questions.length === 0) {
        setParseFeedback(
          bilingualMode
            ? 'कोई मान्य बहुविकल्पीय प्रश्न नहीं मिला। कृपया Q1., A), B), C), D), Ans: प्रारूप जांचें।'
            : 'No valid MCQs detected. Ensure each question includes options A/B/C/D.',
        );
      } else {
        setQuestions((prev) => [...prev, ...result.questions]);
        setParseFeedback(
          bilingualMode
            ? `${result.stats.parsedCount} प्रश्न जोड़े गए (${result.stats.withAnswersCount} उत्तर कुंजी सहित, ${result.stats.withExplanationsCount} व्याख्या सहित)`
            : `Imported ${result.stats.parsedCount} question(s) (${result.stats.withAnswersCount} with answer keys, ${result.stats.withExplanationsCount} with explanations)`,
        );
        setFormErrors([]);
      }
      setParseWarnings([...extraWarnings, ...result.warnings]);
    } finally {
      setIsParsing(false);
    }
  };

  const handleParseMcqs = async () => {
    if (!rawPasteText.trim()) {
      setParseFeedback(
        bilingualMode
          ? 'कृपया पार्स करने के लिए पहले प्रश्न टेक्स्ट पेस्ट करें।'
          : 'Please paste MCQ text before parsing.',
      );
      return;
    }

    await runParseAndImport(rawPasteText);
  };

  const handleUploadQuestionFiles = async (
    event: React.ChangeEvent<HTMLInputElement>,
    kindLabel: 'pdf' | 'image',
  ) => {
    const fileList = event.target.files;
    const selectedFiles = fileList ? Array.from(fileList) : [];
    event.target.value = '';
    if (selectedFiles.length === 0) return;

    const labelNames =
      selectedFiles.length === 1
        ? selectedFiles[0].name
        : `${selectedFiles.length} ${kindLabel === 'image' ? 'images' : 'files'}`;

    setIsExtractingFile(true);
    setParseWarnings([]);
    setParseFeedback('');
    setExtractionStatus(
      bilingualMode
        ? `${labelNames} को स्मार्ट OCR से स्कैन और फ़ॉर्मेट किया जा रहा है...`
        : `Scanning & formatting ${labelNames} with Smart OCR...`,
    );

    try {
      const extracted = await extractQuestionsSmartWithAiOcr({
        files: selectedFiles,
        onProgress: (status, pct) => {
          setExtractionStatus(typeof pct === 'number' ? `${status} (${pct}%)` : status);
        },
      });

      if (extracted.formattedText.trim()) {
        setRawPasteText(extracted.formattedText);
      }

      if (extracted.questions.length > 0) {
        setQuestions((prev) => [...prev, ...extracted.questions]);
        const withAnsCount = extracted.questions.filter(
          (q) => q.correctOption >= 0 && q.correctOption <= 3,
        ).length;
        const withExpCount = extracted.questions.filter((q) => Boolean(q.explanation)).length;
        const sourceTag =
          extracted.method === 'ai-ocr'
            ? bilingualMode
              ? 'AI OCR'
              : 'AI OCR'
            : extracted.columnLayoutDetected
              ? bilingualMode
                ? `PDF (${extracted.pageCount} पृष्ठ, 2-कॉलम क्रम)`
                : `PDF (${extracted.pageCount}p, 2-col fixed)`
              : bilingualMode
                ? 'स्थानीय पार्सर'
                : 'Local Extractor';

        setParseFeedback(
          bilingualMode
            ? `${sourceTag}: ${extracted.questions.length} प्रश्न सटीक प्रारूप में जोड़े गए (${withAnsCount} उत्तर कुंजी, ${withExpCount} व्याख्या सहित)`
            : `${sourceTag}: Imported ${extracted.questions.length} formatted question(s) (${withAnsCount} with answer keys, ${withExpCount} with explanations).`,
        );
        setFormErrors([]);
      } else {
        setParseFeedback(
          extracted.formattedText.trim()
            ? bilingualMode
              ? 'टेक्स्ट निकाला गया है, कृपया प्रारूप जांचकर "पार्स करें" दबाएं।'
              : 'Text extracted into the box below. Review format and click "Parse & Import Questions".'
            : bilingualMode
              ? `${labelNames} से कोई पठनीय प्रश्न नहीं मिला। कृपया स्पष्ट PDF या छवि अपलोड करें।`
              : `No readable MCQs detected in ${labelNames}. Try a clearer PDF or photo.`,
        );
      }
      setParseWarnings(extracted.warnings);
    } catch (err) {
      setParseFeedback(
        err instanceof Error
          ? err.message
          : bilingualMode
            ? 'फ़ाइल से प्रश्न निकालने में त्रुटि हुई।'
            : 'Failed to extract questions from the uploaded file.',
      );
    } finally {
      setIsExtractingFile(false);
      setExtractionStatus('');
    }
  };

  const handleAiSmartFormatText = async () => {
    if (!rawPasteText.trim()) {
      setParseFeedback(
        bilingualMode
          ? 'AI फ़ॉर्मेट करने के लिए पहले कोई भी प्रश्न टेक्स्ट पेस्ट करें।'
          : 'Please paste question paper text in any format before running AI Smart Format.',
      );
      return;
    }

    setIsExtractingFile(true);
    setParseWarnings([]);
    setParseFeedback('');
    setExtractionStatus(
      bilingualMode
        ? 'स्मार्ट फ़ॉर्मैटर द्वारा प्रश्न प्रारूप को ठीक किया जा रहा है...'
        : 'Formatting & extracting MCQs cleanly...',
    );

    try {
      const extracted = await extractQuestionsSmartWithAiOcr({
        rawText: rawPasteText,
        onProgress: (status, pct) => {
          setExtractionStatus(typeof pct === 'number' ? `${status} (${pct}%)` : status);
        },
      });

      if (extracted.formattedText.trim()) {
        setRawPasteText(extracted.formattedText);
      }

      if (extracted.questions.length > 0) {
        setQuestions((prev) => [...prev, ...extracted.questions]);
        setParseFeedback(
          bilingualMode
            ? `${extracted.method === 'ai-ocr' ? 'AI OCR' : 'स्मार्ट पार्सर'}: ${extracted.questions.length} प्रश्न साफ़ प्रारूप में जोड़े गए।`
            : `${extracted.method === 'ai-ocr' ? 'AI OCR' : 'Smart Parser'}: Formatted & imported ${extracted.questions.length} question(s).`,
        );
        setFormErrors([]);
      } else {
        setParseFeedback(
          bilingualMode
            ? 'कोई मान्य MCQ नहीं मिला। कृपया विकल्प A-D जांचें।'
            : 'No valid MCQs detected. Ensure each question includes options.',
        );
      }
      setParseWarnings(extracted.warnings);
    } catch (err) {
      setParseFeedback(
        err instanceof Error
          ? err.message
          : bilingualMode
            ? 'AI फ़ॉर्मेटिंग में त्रुटि हुई।'
            : 'Failed to auto-format question text.',
      );
    } finally {
      setIsExtractingFile(false);
      setExtractionStatus('');
    }
  };

  const handleDownloadOfflineHtml = async () => {
    if (questions.length === 0) {
      setFormErrors([
        bilingualMode
          ? 'ऑफ़लाइन परीक्षा HTML डाउनलोड करने के लिए कम से कम 1 प्रश्न जोड़ें।'
          : 'Add or parse at least 1 question before downloading the offline exam HTML.',
      ]);
      return;
    }

    const now = new Date().toISOString();
    const token = generateTestToken(existingTests.map((t) => t.token));
    const draftTest: Test = {
      id: `test-draft-${Date.now().toString(36)}`,
      token,
      title: title.trim() || 'Proctored Offline Assessment',
      className: tryNormalizeClass(className) ?? 'Class 10',
      subject: subject.trim() || 'General',
      marksPerQuestion: numericMarks > 0 ? numericMarks : 1,
      negativeMarking: numericNegative >= 0 ? numericNegative : 0,
      durationMinutes: numericDuration > 0 ? numericDuration : 30,
      maxViolations: numericViolations >= 1 ? numericViolations : 3,
      totalMarks: questions.length * (numericMarks > 0 ? numericMarks : 1),
      questions,
      allowedStudentIds:
        parsedAllowedIds.validIds.length > 0 ? parsedAllowedIds.validIds : undefined,
      status: 'active',
      createdAt: now,
      publishedAt: now,
    };

    const logoDataUrl = await loadInstitutionLogoDataUrl();
    const html = buildStrictOnlineExamHTML(draftTest, {
      bilingualMode,
      logoDataUrl,
      students,
    });
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `SRSS-Offline-Exam-${draftTest.token}.html`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setFormErrors([]);
  };

  const handleAddManualQuestion = () => {
    setQuestions((prev) => [...prev, createBlankQuestion()]);
    setFormErrors([]);
  };

  const handleUpdateQuestion = (
    questionId: string,
    updater: (current: QuestionModel) => QuestionModel,
  ) => {
    setQuestions((prev) =>
      prev.map((q) => (q.id === questionId ? updater(q) : q)),
    );
  };

  const handleOptionChange = (
    questionId: string,
    optionIndex: 0 | 1 | 2 | 3,
    value: string,
  ) => {
    handleUpdateQuestion(questionId, (q) => {
      const nextOptions: [string, string, string, string] = [...q.options] as [
        string,
        string,
        string,
        string,
      ];
      nextOptions[optionIndex] = value;
      return { ...q, options: nextOptions };
    });
  };

  const handleQuestionImageUpload = async (
    questionId: string,
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setFormErrors([
        bilingualMode
          ? 'कृपया प्रश्न के लिए केवल मान्य छवि फ़ाइल (JPG/PNG) अपलोड करें।'
          : 'Please upload a valid image file (JPG/PNG) for the question diagram.',
      ]);
      return;
    }

    try {
      const dataUrl = await resizeQuestionImageToDataUrl(file);
      handleUpdateQuestion(questionId, (q) => ({ ...q, questionImage: dataUrl }));
    } catch {
      setFormErrors([
        bilingualMode
          ? 'छवि लोड करने में समस्या हुई।'
          : 'Could not process the selected question image.',
      ]);
    }
  };

  const handleMoveQuestion = (index: number, direction: -1 | 1) => {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= questions.length) return;
    setQuestions((prev) => {
      const copy = [...prev];
      const [item] = copy.splice(index, 1);
      copy.splice(targetIndex, 0, item);
      return copy;
    });
  };

  const handleDeleteQuestion = (questionId: string) => {
    setQuestions((prev) => prev.filter((q) => q.id !== questionId));
  };

  const handlePublish = (event: React.FormEvent) => {
    event.preventDefault();
    const errors: string[] = [];

    if (!title.trim()) {
      errors.push(bilingualMode ? 'परीक्षा का नाम आवश्यक है।' : 'Test Name is required.');
    }
    if (parsedAllowedIds.invalidTokens.length > 0) {
      errors.push(
        bilingualMode
          ? `अमान्य छात्र ID (${parsedAllowedIds.invalidTokens.join(', ')})। प्रत्येक ID ठीक 8 अंकों की होनी चाहिए (अल्पविराम से अलग करें) या बॉक्स खाली छोड़ें।`
          : `Invalid Student ID(s): ${parsedAllowedIds.invalidTokens.join(', ')}. Enter valid 8-digit IDs separated by commas, or leave blank for all students.`,
      );
    }
    if (!tryNormalizeClass(className)) {
      errors.push(
        bilingualMode
          ? 'मान्य कक्षा चुनें (Class 01 - Class 12)।'
          : 'Select a valid Class (Class 01 - Class 12).',
      );
    }
    if (!subject.trim()) {
      errors.push(bilingualMode ? 'विषय का नाम आवश्यक है।' : 'Subject is required.');
    }
    if (!(numericMarks > 0)) {
      errors.push(
        bilingualMode
          ? 'प्रति प्रश्न अंक 0 से अधिक होना चाहिए।'
          : 'Marks per Question must be greater than 0.',
      );
    }
    if (Number.isNaN(Number.parseFloat(negativeMarking)) || numericNegative < 0) {
      errors.push(
        bilingualMode
          ? 'नकारात्मक अंक 0 या उससे अधिक होना चाहिए।'
          : 'Negative Marking cannot be negative.',
      );
    }
    if (!(numericDuration > 0)) {
      errors.push(
        bilingualMode
          ? 'परीक्षा अवधि (मिनट) 0 से अधिक होनी चाहिए।'
          : 'Duration in Minutes must be greater than 0.',
      );
    }
    if (!(numericViolations >= 1)) {
      errors.push(
        bilingualMode
          ? 'अधिकतम एंटी-चीट उल्लंघन कम से कम 1 होना चाहिए।'
          : 'Max Anti-Cheat Violations must be at least 1.',
      );
    }
    if (questions.length === 0) {
      errors.push(
        bilingualMode
          ? 'परीक्षा प्रकाशित करने के लिए कम से कम 1 प्रश्न जोड़ें।'
          : 'Add or parse at least 1 question before publishing.',
      );
    } else {
      questions.forEach((q, idx) => {
        if (!q.questionText.trim()) {
          errors.push(
            bilingualMode
              ? `प्रश्न ${idx + 1} का टेक्स्ट खाली है।`
              : `Question ${idx + 1} text cannot be empty.`,
          );
        }
        const emptyOpt = q.options.some((opt) => !opt.trim());
        if (emptyOpt) {
          errors.push(
            bilingualMode
              ? `प्रश्न ${idx + 1} के सभी 4 विकल्प (A-D) भरें।`
              : `Question ${idx + 1} must have all 4 options (A-D) filled.`,
          );
        }
      });
    }

    if (errors.length > 0) {
      setFormErrors(errors);
      return;
    }

    const now = new Date().toISOString();
    const existingTokens = existingTests.map((t) => t.token);
    const token = generateTestToken(existingTokens);

    const normalizedQuestions: QuestionModel[] = questions.map((q) => ({
      ...q,
      subject: subject.trim(),
      questionText: q.questionText.trim(),
      options: [
        q.options[0].trim(),
        q.options[1].trim(),
        q.options[2].trim(),
        q.options[3].trim(),
      ],
      explanation: q.explanation?.trim() || undefined,
      marks: numericMarks,
      negativeMarks: numericNegative,
    }));

    const newTest: Test = {
      id: `test-${Date.now().toString(36)}`,
      token,
      title: title.trim(),
      className: normalizeClass(className),
      subject: subject.trim(),
      marksPerQuestion: numericMarks,
      negativeMarking: numericNegative,
      durationMinutes: numericDuration,
      maxViolations: numericViolations,
      totalMarks,
      questions: normalizedQuestions,
      allowedStudentIds:
        parsedAllowedIds.validIds.length > 0 ? parsedAllowedIds.validIds : undefined,
      status: 'active',
      createdAt: now,
      publishedAt: now,
    };

    onPublishTest(newTest);
    setTitle('');
    setAllowedStudentIdsInput('');
    setSubject('');
    setRawPasteText('');
    setParseFeedback('');
    setParseWarnings([]);
    setQuestions([]);
    setFormErrors([]);
  };

  return (
    <div
      id="panel-question-builder"
      role="tabpanel"
      aria-labelledby="tab-question-builder"
      data-testid="tab-panel-question-builder"
      className="space-y-6"
    >
      {/* 1. Test Configuration Form */}
      <form onSubmit={handlePublish} noValidate className="space-y-6">
        <section className="relative overflow-hidden bg-white border border-indigo-100 rounded-3xl shadow-xl shadow-blue-950/10 p-6 sm:p-8 space-y-6">
          <InstitutionWatermark className="w-44 h-44 -right-8 -top-8 opacity-[0.06]" />
          <div className="relative flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 pb-5 border-b border-slate-200">
            <div>
              <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900">
                {bilingualMode
                  ? 'परीक्षा कॉन्फ़िगरेशन एवं प्रश्न निर्माता'
                  : 'Test Configuration & Question Builder'}
              </h2>
              <p className="text-sm text-slate-600 mt-1">
                {bilingualMode
                  ? 'परीक्षा पैरामीटर सेट करें, द्विभाषी प्रश्न पेस्ट करें या मैन्युअल रूप से जोड़ें, और सुरक्षित टोकन के साथ प्रकाशित करें।'
                  : 'Configure test rules, import bilingual MCQs or add manual questions with diagrams, and publish with a unique exam token.'}
              </p>
            </div>

            <div className="flex items-center gap-4 shrink-0 tabular-nums">
              <div className="rounded-2xl bg-gradient-to-br from-indigo-50 to-blue-50 border border-indigo-100 px-4 py-2.5 text-center shadow-sm">
                <p className="text-[11px] font-semibold text-indigo-700">
                  {bilingualMode ? 'ड्राफ्ट प्रश्न' : 'Draft Questions'}
                </p>
                <p className="text-2xl font-extrabold text-slate-900" data-testid="draft-question-count">
                  {questions.length}
                </p>
              </div>
              <div className="rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 px-4 py-2.5 text-center text-white shadow-md shadow-blue-600/20">
                <p className="text-[11px] font-semibold text-blue-100">
                  {bilingualMode ? 'कुल अंक' : 'Total Marks'}
                </p>
                <p className="text-2xl font-extrabold text-[#FDE68A]" data-testid="draft-total-marks">
                  {totalMarks}
                </p>
              </div>
            </div>
          </div>

          <div className="relative grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            {/* Box 1: Test Name */}
            <div className="lg:col-span-2 rounded-2xl p-4 bg-gradient-to-br from-blue-50/70 to-white border border-blue-100">
              <label htmlFor="test-name" className="block text-xs font-bold text-[#0D47A1] mb-1.5">
                {bilingualMode ? 'बॉक्स 1: परीक्षा का नाम *' : 'Box 1: Test Name *'}
              </label>
              <input
                id="test-name"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={
                  bilingualMode
                    ? 'जैसे: अर्धवार्षिक विज्ञान परीक्षा 2026'
                    : 'e.g. Mid-Term Science Assessment 2026'
                }
                className="w-full px-3.5 py-2.5 min-h-[42px] rounded-xl border border-blue-200 bg-white text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0D47A1]"
              />
            </div>

            {/* Box 2: Targeted Student ID Restriction Box */}
            <div className="lg:col-span-2 rounded-2xl p-4 bg-gradient-to-br from-violet-50/70 to-white border border-violet-200/80">
              <label
                htmlFor="allowed-student-ids"
                className="flex items-center gap-1.5 text-xs font-bold text-violet-900 mb-1.5"
              >
                <Lock className="w-3.5 h-3.5 text-violet-700 shrink-0" aria-hidden="true" />
                <span>
                  {bilingualMode
                    ? 'बॉक्स 2: विशिष्ट छात्र ID (वैकल्पिक / परीक्षा प्रतिबंधित करें)'
                    : 'Box 2: Specific Student ID (Optional / Restrict Test)'}
                </span>
              </label>
              <input
                id="allowed-student-ids"
                data-testid="allowed-student-ids-input"
                type="text"
                value={allowedStudentIdsInput}
                onChange={(e) => setAllowedStudentIdsInput(e.target.value)}
                placeholder={
                  bilingualMode
                    ? 'जैसे: 48291047 या 48291047, 59283741 (खाली = सभी छात्र)'
                    : 'e.g. 48291047 or 48291047, 59283741 (blank = all students)'
                }
                className="w-full px-3.5 py-2.5 min-h-[42px] rounded-xl border border-violet-200 bg-white text-sm font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-violet-600"
              />
              <p
                data-testid="allowed-student-ids-summary"
                className={`mt-1.5 text-[11px] font-semibold tabular-nums ${
                  parsedAllowedIds.invalidTokens.length > 0
                    ? 'text-red-700'
                    : parsedAllowedIds.validIds.length > 0
                      ? 'text-violet-800'
                      : 'text-slate-500'
                }`}
              >
                {parsedAllowedIds.invalidTokens.length > 0
                  ? bilingualMode
                    ? `अमान्य ID: ${parsedAllowedIds.invalidTokens.join(', ')} (8 अंकों की ID डालें)`
                    : `Invalid ID(s): ${parsedAllowedIds.invalidTokens.join(', ')} — enter 8-digit Student IDs`
                  : parsedAllowedIds.validIds.length > 0
                    ? bilingualMode
                      ? `केवल ${parsedAllowedIds.validIds.length} चयनित छात्र ID को अनुमति: ${parsedAllowedIds.validIds.join(', ')}`
                      : `Restricted to ${parsedAllowedIds.validIds.length} Student ID(s): ${parsedAllowedIds.validIds.join(', ')}`
                    : bilingualMode
                      ? 'खाली छोड़ने पर यह परीक्षा सभी पंजीकृत छात्रों के लिए खुली रहेगी।'
                      : 'Leave blank to keep this test open for all registered students.'}
              </p>
            </div>

            {/* Class Selector (Class 01 - 12) */}
            <div>
              <label htmlFor="test-class" className="block text-xs font-semibold text-slate-700 mb-1.5">
                {bilingualMode ? 'कक्षा (Class 01 - 12) *' : 'Class (Class 01 - 12) *'}
              </label>
              <select
                id="test-class"
                value={className}
                onChange={(e) => setClassName(e.target.value)}
                className="w-full px-3.5 py-2.5 min-h-[42px] rounded-lg border border-slate-300 bg-white text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0D47A1]"
              >
                {CLASS_OPTIONS.map((cls) => (
                  <option key={cls} value={cls}>
                    {cls}
                  </option>
                ))}
              </select>
            </div>

            {/* Subject */}
            <div>
              <label htmlFor="test-subject" className="block text-xs font-semibold text-slate-700 mb-1.5">
                {bilingualMode ? 'विषय *' : 'Subject *'}
              </label>
              <input
                id="test-subject"
                type="text"
                list="subject-suggestions"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder={bilingualMode ? 'जैसे: गणित / विज्ञान' : 'e.g. Science'}
                className="w-full px-3.5 py-2.5 min-h-[42px] rounded-lg border border-slate-300 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0D47A1]"
              />
              <datalist id="subject-suggestions">
                {SUBJECT_SUGGESTIONS.map((s) => (
                  <option key={s} value={s} />
                ))}
              </datalist>
            </div>

            {/* Marks per Question */}
            <div>
              <label htmlFor="marks-per-question" className="block text-xs font-semibold text-slate-700 mb-1.5">
                {bilingualMode ? 'प्रति प्रश्न अंक *' : 'Marks per Question *'}
              </label>
              <input
                id="marks-per-question"
                type="number"
                min="0.5"
                step="0.5"
                value={marksPerQuestion}
                onChange={(e) => setMarksPerQuestion(e.target.value)}
                className="w-full px-3.5 py-2.5 min-h-[42px] rounded-lg border border-slate-300 text-sm text-slate-900 tabular-nums focus:outline-none focus:ring-2 focus:ring-[#0D47A1]"
              />
            </div>

            {/* Negative Marking */}
            <div>
              <label htmlFor="negative-marking" className="block text-xs font-semibold text-slate-700 mb-1.5">
                {bilingualMode ? 'नकारात्मक अंक (गलत पर कटौती)' : 'Negative Marking (per wrong)'}
              </label>
              <input
                id="negative-marking"
                type="number"
                min="0"
                step="0.25"
                value={negativeMarking}
                onChange={(e) => setNegativeMarking(e.target.value)}
                className="w-full px-3.5 py-2.5 min-h-[42px] rounded-lg border border-slate-300 text-sm text-slate-900 tabular-nums focus:outline-none focus:ring-2 focus:ring-[#0D47A1]"
              />
            </div>

            {/* Duration in Minutes */}
            <div>
              <label htmlFor="duration-minutes" className="block text-xs font-semibold text-slate-700 mb-1.5">
                {bilingualMode ? 'अवधि (मिनट में) *' : 'Duration (Minutes) *'}
              </label>
              <input
                id="duration-minutes"
                type="number"
                min="1"
                step="1"
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(e.target.value)}
                className="w-full px-3.5 py-2.5 min-h-[42px] rounded-lg border border-slate-300 text-sm text-slate-900 tabular-nums focus:outline-none focus:ring-2 focus:ring-[#0D47A1]"
              />
            </div>

            {/* Max Anti-Cheat Violations */}
            <div>
              <label htmlFor="max-violations" className="block text-xs font-semibold text-slate-700 mb-1.5">
                {bilingualMode ? 'अधिकतम एंटी-चीट उल्लंघन *' : 'Max Anti-Cheat Violations *'}
              </label>
              <input
                id="max-violations"
                type="number"
                min="1"
                step="1"
                value={maxViolations}
                onChange={(e) => setMaxViolations(e.target.value)}
                className="w-full px-3.5 py-2.5 min-h-[42px] rounded-lg border border-slate-300 text-sm text-slate-900 tabular-nums focus:outline-none focus:ring-2 focus:ring-[#0D47A1]"
              />
            </div>
          </div>
        </section>

        {/* 2. Smart Non-Blocking Bilingual MCQ Parser */}
        <section className="bg-white border border-indigo-100 rounded-3xl shadow-xl shadow-blue-950/10 p-6 sm:p-8 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#0D47A1]" aria-hidden="true" />
                <span>
                  {bilingualMode
                    ? 'स्मार्ट द्विभाषी MCQ पार्सर (English / हिंदी)'
                    : 'Smart Bilingual MCQ Auto-Parser'}
                </span>
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 mt-0.5">
                {bilingualMode
                  ? 'Q1./प्रश्न 1:, विकल्प A/B/C/D या अ/ब/स/द, Ans:/उत्तर: और Exp:/व्याख्या: प्रारूप में प्रश्न सीधे पेस्ट करें।'
                  : 'Paste raw questions in English or Hindi (Q1./प्रश्न 1:, A-D or अ-द options, Ans:/उत्तर:, Exp:/व्याख्या:) to extract instantly without lag.'}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto shrink-0">
              {/* Upload PDF (AI OCR) */}
              <label
                htmlFor="mcq-pdf-upload"
                data-testid="mcq-pdf-upload-label"
                className={`inline-flex items-center gap-1.5 px-3.5 py-2 min-h-[40px] rounded-lg border border-[#0D47A1] bg-blue-50/80 hover:bg-blue-100/80 text-xs font-semibold text-[#0D47A1] whitespace-nowrap cursor-pointer ${
                  isExtractingFile || isParsing ? 'opacity-60 pointer-events-none' : ''
                }`}
              >
                {isExtractingFile ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
                ) : (
                  <FileUp className="w-3.5 h-3.5" aria-hidden="true" />
                )}
                <span>
                  {bilingualMode ? 'PDF अपलोड (Smart OCR)' : 'Upload PDF (Smart OCR)'}
                </span>
                <input
                  id="mcq-pdf-upload"
                  data-testid="mcq-pdf-upload-input"
                  type="file"
                  accept=".pdf,application/pdf"
                  onChange={(e) => handleUploadQuestionFiles(e, 'pdf')}
                  disabled={isExtractingFile || isParsing}
                  className="sr-only"
                />
              </label>

              {/* Upload Image(s) right beside PDF (Smart OCR) */}
              <label
                htmlFor="mcq-image-upload"
                data-testid="mcq-image-upload-label"
                className={`inline-flex items-center gap-1.5 px-3.5 py-2 min-h-[40px] rounded-lg border border-[#D4AF37] bg-amber-50/70 hover:bg-amber-100/70 text-xs font-semibold text-[#0D47A1] whitespace-nowrap cursor-pointer ${
                  isExtractingFile || isParsing ? 'opacity-60 pointer-events-none' : ''
                }`}
              >
                {isExtractingFile ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
                ) : (
                  <ImageUp className="w-3.5 h-3.5 text-[#0D47A1]" aria-hidden="true" />
                )}
                <span>
                  {bilingualMode ? 'छवि अपलोड (Smart OCR)' : 'Upload Image (Smart OCR)'}
                </span>
                <input
                  id="mcq-image-upload"
                  data-testid="mcq-image-upload-input"
                  type="file"
                  multiple
                  accept="image/*,.png,.jpg,.jpeg,.webp"
                  onChange={(e) => handleUploadQuestionFiles(e, 'image')}
                  disabled={isExtractingFile || isParsing}
                  className="sr-only"
                />
              </label>

              <button
                type="button"
                onClick={() => {
                  setRawPasteText(SAMPLE_BILINGUAL_MCQS);
                  setParseFeedback('');
                }}
                className="px-3.5 py-2 min-h-[40px] rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 whitespace-nowrap cursor-pointer"
              >
                {bilingualMode ? 'नमूना द्विभाषी प्रश्न लोड करें' : 'Load Sample Bilingual MCQs'}
              </button>
            </div>
          </div>

          {extractionStatus && (
            <div
              role="status"
              data-testid="extraction-progress-status"
              className="flex items-center gap-2 text-xs font-semibold text-[#0D47A1] bg-blue-50 border border-blue-200 rounded-lg px-3.5 py-2"
            >
              <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" aria-hidden="true" />
              <span>{extractionStatus}</span>
            </div>
          )}

          <div>
            <label htmlFor="mcq-paste-input" className="sr-only">
              {bilingualMode ? 'MCQ टेक्स्ट यहाँ पेस्ट करें' : 'Paste raw MCQ text here'}
            </label>
            <textarea
              id="mcq-paste-input"
              rows={7}
              value={rawPasteText}
              onChange={(e) => setRawPasteText(e.target.value)}
              placeholder={
                bilingualMode
                  ? 'किसी भी प्रारूप में प्रश्न यहाँ पेस्ट करें या ऊपर PDF / छवि अपलोड करें — स्मार्ट OCR स्वतः सही फ़ॉर्मेट बना देगा...\nउदाहरण:\nQ1. भारत की राजधानी क्या है?\nA) मुंबई  B) नई दिल्ली  C) कोलकाता  D) चेन्नई\nAns: B'
                  : 'Paste MCQs in ANY format here, or upload a PDF or Question Image(s) above for Smart OCR extraction...\nExample:\nQ1. What is the capital of India?\nA) Mumbai\nB) New Delhi\nC) Kolkata\nD) Chennai\nAns: B'
              }
              className="w-full px-3.5 py-3 rounded-lg border border-slate-300 text-sm text-slate-900 font-mono leading-relaxed focus:outline-none focus:ring-2 focus:ring-[#0D47A1]"
            />
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="text-xs font-medium text-slate-700" role="status" data-testid="mcq-parse-feedback">
              {parseFeedback}
            </div>
            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={() => {
                  setRawPasteText('');
                  setParseFeedback('');
                  setParseWarnings([]);
                }}
                className="px-3.5 py-2 min-h-[40px] rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 cursor-pointer whitespace-nowrap"
              >
                {bilingualMode ? 'बॉक्स साफ़ करें' : 'Clear Paste Box'}
              </button>
              <button
                type="button"
                data-testid="ai-format-text-btn"
                onClick={handleAiSmartFormatText}
                disabled={isParsing || isExtractingFile}
                className="inline-flex items-center gap-1.5 px-4 py-2 min-h-[40px] rounded-lg border border-[#0D47A1] bg-blue-50/80 hover:bg-blue-100/80 text-[#0D47A1] text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap disabled:opacity-60"
              >
                <Wand2 className="w-3.5 h-3.5" aria-hidden="true" />
                <span>
                  {bilingualMode
                    ? 'स्मार्ट फ़ॉर्मेट और आयात'
                    : 'Smart Format & Import'}
                </span>
              </button>
              <button
                type="button"
                onClick={handleParseMcqs}
                disabled={isParsing || isExtractingFile}
                className="inline-flex items-center gap-1.5 px-4 py-2 min-h-[40px] rounded-lg bg-[#0D47A1] hover:bg-[#083275] text-white text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap disabled:opacity-60"
              >
                <FileText className="w-3.5 h-3.5 text-[#F5DC7F]" aria-hidden="true" />
                <span>
                  {isParsing
                    ? bilingualMode
                      ? 'पार्स हो रहा है...'
                      : 'Parsing...'
                    : bilingualMode
                      ? 'पार्स करें और प्रश्न जोड़ें'
                      : 'Parse & Import Questions'}
                </span>
              </button>
            </div>
          </div>

          {parseWarnings.length > 0 && (
            <ul className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-1">
              {parseWarnings.map((w, idx) => (
                <li key={idx}>{w}</li>
              ))}
            </ul>
          )}
        </section>

        {/* 3. Questions Draft & Answer Key Editor */}
        <section className="bg-white border border-indigo-100 rounded-3xl shadow-xl shadow-blue-950/10 p-6 sm:p-8 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-slate-200">
            <div>
              <h3 className="text-lg font-bold text-slate-900">
                {bilingualMode
                  ? 'प्रश्न ड्राफ्ट एवं उत्तर कुंजी संपादक'
                  : 'Questions Draft & Answer Key Editor'}
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 mt-0.5">
                {bilingualMode
                  ? 'रेडियो बटन से सही उत्तर चुनें, चित्र अपलोड करें या मैन्युअल प्रश्न जोड़ें।'
                  : 'Select the correct option via radio buttons, attach question diagrams, or add manual MCQs.'}
              </p>
            </div>
            <button
              type="button"
              onClick={handleAddManualQuestion}
              className="inline-flex items-center gap-1.5 px-4 py-2 min-h-[40px] rounded-lg border border-[#0D47A1] text-[#0D47A1] hover:bg-slate-50 text-xs font-semibold whitespace-nowrap self-start sm:self-auto cursor-pointer"
            >
              <Plus className="w-4 h-4" aria-hidden="true" />
              <span>{bilingualMode ? 'मैन्युअल प्रश्न जोड़ें' : 'Add Manual Question'}</span>
            </button>
          </div>

          {questions.length === 0 ? (
            <div className="py-10 text-center space-y-2">
              <BookOpen className="w-9 h-9 text-slate-300 mx-auto" aria-hidden="true" />
              <p className="text-sm font-semibold text-slate-700">
                {bilingualMode ? 'अभी ड्राफ्ट में कोई प्रश्न नहीं है' : 'No questions in draft yet'}
              </p>
              <p className="text-xs text-slate-500">
                {bilingualMode
                  ? 'ऊपर टेक्स्ट पेस्ट करके पार्स करें या "मैन्युअल प्रश्न जोड़ें" पर क्लिक करें।'
                  : 'Paste raw text in the MCQ parser above or click "Add Manual Question" to begin.'}
              </p>
            </div>
          ) : (
            <div className="space-y-5" data-testid="draft-questions-list">
              {questions.map((q, qIndex) => (
                <article
                  key={q.id}
                  data-testid={`draft-question-${qIndex + 1}`}
                  className="border border-slate-200 rounded-xl p-5 space-y-4 bg-slate-50/50"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-bold text-[#0D47A1] tabular-nums">
                      {bilingualMode ? `प्रश्न ${qIndex + 1}` : `Question ${qIndex + 1}`}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleMoveQuestion(qIndex, -1)}
                        disabled={qIndex === 0}
                        aria-label={`Move Question ${qIndex + 1} up`}
                        className="p-1.5 rounded-md border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-40 cursor-pointer"
                      >
                        <ArrowUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleMoveQuestion(qIndex, 1)}
                        disabled={qIndex === questions.length - 1}
                        aria-label={`Move Question ${qIndex + 1} down`}
                        className="p-1.5 rounded-md border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-40 cursor-pointer"
                      >
                        <ArrowDown className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteQuestion(q.id)}
                        aria-label={`Delete Question ${qIndex + 1}`}
                        className="p-1.5 rounded-md border border-slate-200 bg-white text-slate-500 hover:text-red-600 hover:border-red-200 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Question Text & Optional Multimedia Image */}
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                    <div className="lg:col-span-2">
                      <label
                        htmlFor={`q-text-${q.id}`}
                        className="block text-xs font-semibold text-slate-700 mb-1"
                      >
                        {bilingualMode ? 'प्रश्न विवरण *' : 'Question Text *'}
                      </label>
                      <textarea
                        id={`q-text-${q.id}`}
                        rows={3}
                        value={q.questionText}
                        onChange={(e) =>
                          handleUpdateQuestion(q.id, (cur) => ({
                            ...cur,
                            questionText: e.target.value,
                          }))
                        }
                        placeholder={
                          bilingualMode ? 'प्रश्न यहाँ लिखें...' : 'Enter question text...'
                        }
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0D47A1]"
                      />
                    </div>

                    {/* Multimedia Question Image Upload & Preview */}
                    <div>
                      <label
                        htmlFor={`q-image-${q.id}`}
                        className="block text-xs font-semibold text-slate-700 mb-1"
                      >
                        {bilingualMode ? 'चित्र / आरेख (वैकल्पिक)' : 'Diagram / Image (Optional)'}
                      </label>
                      {q.questionImage ? (
                        <div className="relative border border-slate-200 rounded-lg bg-white p-2 flex items-center justify-center">
                          <img
                            src={q.questionImage}
                            alt={`Question ${qIndex + 1} diagram`}
                            referrerPolicy="no-referrer"
                            className="max-h-24 object-contain rounded"
                          />
                          <button
                            type="button"
                            onClick={() =>
                              handleUpdateQuestion(q.id, (cur) => ({
                                ...cur,
                                questionImage: undefined,
                              }))
                            }
                            aria-label={`Remove diagram for Question ${qIndex + 1}`}
                            className="absolute top-1.5 right-1.5 p-1 rounded-md bg-white border border-slate-200 text-slate-500 hover:text-red-600 cursor-pointer"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <label
                          htmlFor={`q-image-${q.id}`}
                          className="h-[78px] rounded-lg border border-dashed border-slate-300 bg-white hover:bg-slate-50 flex flex-col items-center justify-center gap-1 text-xs text-slate-500 cursor-pointer px-3 text-center"
                        >
                          <ImagePlus className="w-4 h-4 text-[#0D47A1]" aria-hidden="true" />
                          <span>
                            {bilingualMode ? 'चित्र अपलोड करें' : 'Upload Question Image'}
                          </span>
                          <input
                            id={`q-image-${q.id}`}
                            type="file"
                            accept="image/*"
                            onChange={(e) => handleQuestionImageUpload(q.id, e)}
                            className="sr-only"
                          />
                        </label>
                      )}
                    </div>
                  </div>

                  {/* Options A/B/C/D with Radio Buttons for Correct Option */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {OPTION_LETTERS.map((letter, optIndex) => {
                      const typedIdx = optIndex as 0 | 1 | 2 | 3;
                      const isCorrect = q.correctOption === typedIdx;
                      return (
                        <div
                          key={letter}
                          className={`flex items-center gap-2.5 px-3 py-2 rounded-lg border transition-colors ${
                            isCorrect
                              ? 'bg-emerald-50/70 border-emerald-300'
                              : 'bg-white border-slate-300'
                          }`}
                        >
                          <input
                            id={`q-${q.id}-radio-${letter}`}
                            type="radio"
                            name={`correct-${q.id}`}
                            checked={isCorrect}
                            onChange={() =>
                              handleUpdateQuestion(q.id, (cur) => ({
                                ...cur,
                                correctOption: typedIdx,
                              }))
                            }
                            aria-label={`Mark Option ${letter} as correct for Question ${qIndex + 1}`}
                            className="w-4 h-4 accent-[#0D47A1] cursor-pointer shrink-0"
                          />
                          <label
                            htmlFor={`q-${q.id}-opt-${letter}`}
                            className="text-xs font-bold text-slate-700 shrink-0"
                          >
                            {letter})
                          </label>
                          <input
                            id={`q-${q.id}-opt-${letter}`}
                            type="text"
                            value={q.options[typedIdx]}
                            onChange={(e) =>
                              handleOptionChange(q.id, typedIdx, e.target.value)
                            }
                            placeholder={
                              bilingualMode ? `विकल्प ${letter}` : `Option ${letter}`
                            }
                            className="w-full bg-transparent text-sm text-slate-900 focus:outline-none"
                          />
                        </div>
                      );
                    })}
                  </div>

                  {/* Explanation */}
                  <div>
                    <label
                      htmlFor={`q-exp-${q.id}`}
                      className="block text-xs font-semibold text-slate-700 mb-1"
                    >
                      {bilingualMode ? 'व्याख्या / हल (वैकल्पिक)' : 'Explanation (Optional)'}
                    </label>
                    <input
                      id={`q-exp-${q.id}`}
                      type="text"
                      value={q.explanation ?? ''}
                      onChange={(e) =>
                        handleUpdateQuestion(q.id, (cur) => ({
                          ...cur,
                          explanation: e.target.value,
                        }))
                      }
                      placeholder={
                        bilingualMode
                          ? 'सही उत्तर की संक्षिप्त व्याख्या...'
                          : 'Brief solution or explanation...'
                      }
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0D47A1]"
                    />
                  </div>
                </article>
              ))}
            </div>
          )}

          {/* Validation Errors */}
          {formErrors.length > 0 && (
            <div
              role="alert"
              data-testid="question-builder-errors"
              className="bg-red-50 border border-red-200 rounded-lg p-4 text-xs font-medium text-red-700 space-y-1"
            >
              {formErrors.map((err, i) => (
                <p key={i}>{err}</p>
              ))}
            </div>
          )}

          {/* Preview & Publish Bar */}
          <div className="pt-4 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <p className="text-xs text-slate-500 tabular-nums">
              {bilingualMode
                ? `सारांश: ${questions.length} प्रश्न · कुल ${totalMarks} अंक · अवधि ${numericDuration} मिनट`
                : `Summary: ${questions.length} question(s) · ${totalMarks} total marks · ${numericDuration} min`}
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                data-testid="download-offline-html-builder-btn"
                onClick={handleDownloadOfflineHtml}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 min-h-[42px] rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 text-sm font-semibold cursor-pointer whitespace-nowrap"
              >
                <Download className="w-4 h-4 text-[#0D47A1]" aria-hidden="true" />
                <span>{bilingualMode ? 'ऑफ़लाइन परीक्षा (.html)' : 'Download Offline HTML'}</span>
              </button>

              <button
                type="button"
                onClick={() => setIsPreviewOpen(true)}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 min-h-[42px] rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 text-sm font-semibold cursor-pointer whitespace-nowrap"
              >
                <Eye className="w-4 h-4 text-[#0D47A1]" aria-hidden="true" />
                <span>{bilingualMode ? 'परीक्षा पूर्वावलोकन' : 'Preview Test'}</span>
              </button>

              <button
                type="submit"
                className="inline-flex items-center gap-2 px-5 py-2.5 min-h-[42px] rounded-lg bg-[#0D47A1] hover:bg-[#083275] text-white text-sm font-semibold transition-colors cursor-pointer whitespace-nowrap"
              >
                <Send className="w-4 h-4 text-[#F5DC7F]" aria-hidden="true" />
                <span>{bilingualMode ? 'परीक्षा प्रकाशित करें' : 'Publish Test'}</span>
              </button>
            </div>
          </div>
        </section>
      </form>

      {/* Preview Modal */}
      <TestPreviewModal
        isOpen={isPreviewOpen}
        bilingualMode={bilingualMode}
        title={title}
        className={className}
        subject={subject}
        marksPerQuestion={numericMarks}
        negativeMarking={numericNegative}
        durationMinutes={numericDuration}
        maxViolations={numericViolations}
        allowedStudentIds={parsedAllowedIds.validIds}
        questions={questions}
        onClose={() => setIsPreviewOpen(false)}
      />
    </div>
  );
};
