import type { QuestionModel } from '../types/exam';
import { normalizeHindiDevanagariText } from './documentTextExtractor';

export interface McqParseResult {
  questions: QuestionModel[];
  warnings: string[];
  stats: {
    parsedCount: number;
    withAnswersCount: number;
    withExplanationsCount: number;
  };
}

interface DraftParseBlock {
  questionNumber: number | null;
  questionLines: string[];
  options: [string, string, string, string];
  optionsSeen: [boolean, boolean, boolean, boolean];
  lastOptionIndex: number | null;
  correctOption: 0 | 1 | 2 | 3 | null;
  explanationLines: string[];
  inExplanation: boolean;
}

const OPTION_TOKEN_TO_INDEX: Record<string, 0 | 1 | 2 | 3> = {
  A: 0,
  B: 1,
  C: 2,
  D: 3,
  '1': 0,
  '2': 1,
  '3': 2,
  '4': 3,
  '१': 0,
  '२': 1,
  '३': 2,
  '४': 3,
  अ: 0,
  ब: 1,
  स: 2,
  द: 3,
  क: 0,
  ख: 1,
  ग: 2,
  घ: 3,
  आ: 1,
  इ: 2,
  ई: 3,
};

const QUESTION_START_RE =
  /^(?:(?:Q|Que|Question|प्रश्न|प्र)\s*[.:-]?\s*(\d+)\s*[.):-]?\s*|(\d+)\s*[.)]\s+|\((\d+)\)\s+)(.+)$/iu;

const SINGLE_OPTION_RE =
  /^\s*\(?\s*([A-Da-d1-4१-४अआइईबसदकखगघ])\s*(?:[).:\-–—]+)\s+(.+)$/u;

const INLINE_MULTI_OPTION_SPLIT_RE =
  /(?:^|\s{2,}|\t)\(?\s*([A-Da-dअआइईबसदकखगघ])\s*[).]\s+/gu;

const COMPACT_INLINE_OPTION_SPLIT_RE =
  /(?:^|\s)\(?([A-Da-dअआइईबसदकखगघ])\)\s+/gu;

const ANSWER_LINE_RE =
  /^(?:\*{1,2})?\s*[\[(]?\s*(?:Ans(?:wer)?|Correct\s*(?:Ans(?:wer)?|Option)?|Key|उत्तर|सही\s*(?:उत्तर|विकल्प)|उ)\s*(?:[:.\-–—=]+|\s+)\s*\(?([A-Da-d1-4१-४अआइईबसदकखगघ])\)?(?:\s|$|[-–—).,;:\]|*])/iu;

const GLOBAL_INLINE_ANSWER_TAG_RE =
  /[\[(]?\s*(?:\*{1,2})?(?:Ans(?:wer)?|Correct\s*(?:Ans(?:wer)?|Option)?|Key|उत्तर|सही\s*(?:उत्तर|विकल्प))\s*(?:[:.\-–—=]+|\s+)\s*\(?([A-Da-d1-4१-४अआइईबसदकखगघ])\)?(?:\*{1,2})?\s*[\])]?/giu;

const EXPLANATION_START_RE =
  /^(?:Exp(?:lanation)?|Sol(?:ution)?|Note|व्याख्या|स्पष्टीकरण|हल)\s*[:.\-–—]?\s*(.*)$/iu;

const ANSWER_KEY_PAIR_RE = /(\d+)\s*[-–—:.)]+\s*\(?([A-Da-d1-4१-४अआइईबसदकखगघ])\)?/gu;

function createEmptyBlock(questionNumber: number | null = null): DraftParseBlock {
  return {
    questionNumber,
    questionLines: [],
    options: ['', '', '', ''],
    optionsSeen: [false, false, false, false],
    lastOptionIndex: null,
    correctOption: null,
    explanationLines: [],
    inExplanation: false,
  };
}

function mapOptionToken(rawToken: string): 0 | 1 | 2 | 3 | null {
  const upper = rawToken.trim().toUpperCase();
  if (Object.prototype.hasOwnProperty.call(OPTION_TOKEN_TO_INDEX, upper)) {
    return OPTION_TOKEN_TO_INDEX[upper];
  }
  return null;
}

/**
 * Finds and removes ALL inline/leaked answer key markers (e.g. "Ans: B", "Ans: C Ans: A",
 * "उत्तर: स", "[Ans:- D]") from a question or option text segment without leaving fragments behind.
 */
function stripAndExtractInlineAnswers(rawSegment: string): {
  cleaned: string;
  extractedOption: 0 | 1 | 2 | 3 | null;
} {
  let extractedOption: 0 | 1 | 2 | 3 | null = null;
  GLOBAL_INLINE_ANSWER_TAG_RE.lastIndex = 0;

  const cleaned = rawSegment
    .replace(GLOBAL_INLINE_ANSWER_TAG_RE, (_full, token: string) => {
      const mapped = mapOptionToken(token);
      if (mapped !== null && extractedOption === null) {
        extractedOption = mapped;
      }
      return ' ';
    })
    .replace(/\s{2,}/g, ' ')
    .replace(/[\s\-–—|,;:]+$/g, '')
    .trim();

  return { cleaned, extractedOption };
}

function extractInlineOptionsFromLine(
  line: string,
): Array<{ index: 0 | 1 | 2 | 3; text: string }> {
  let matches: Array<{ index: 0 | 1 | 2 | 3; start: number; textStart: number }> = [];
  INLINE_MULTI_OPTION_SPLIT_RE.lastIndex = 0;

  let m: RegExpExecArray | null;
  while ((m = INLINE_MULTI_OPTION_SPLIT_RE.exec(line)) !== null) {
    const idx = mapOptionToken(m[1]);
    if (idx !== null) {
      matches.push({
        index: idx,
        start: m.index,
        textStart: m.index + m[0].length,
      });
    }
  }

  // Fallback for single-space PDF extracted inline options like "A) Mumbai B) Delhi C) Agra D) Pune"
  if (matches.length < 2) {
    const compactMatches: Array<{ index: 0 | 1 | 2 | 3; start: number; textStart: number }> = [];
    COMPACT_INLINE_OPTION_SPLIT_RE.lastIndex = 0;
    while ((m = COMPACT_INLINE_OPTION_SPLIT_RE.exec(line)) !== null) {
      const idx = mapOptionToken(m[1]);
      if (idx !== null) {
        compactMatches.push({
          index: idx,
          start: m.index,
          textStart: m.index + m[0].length,
        });
      }
    }
    // Accept compact inline split only if it begins at option A (0) and ascends sequentially (0->1...)
    if (
      compactMatches.length >= 2 &&
      compactMatches[0].index === 0 &&
      compactMatches[1].index === 1
    ) {
      matches = compactMatches;
    }
  }

  if (matches.length < 2) {
    return [];
  }

  const results: Array<{ index: 0 | 1 | 2 | 3; text: string }> = [];
  for (let i = 0; i < matches.length; i += 1) {
    const end = i + 1 < matches.length ? matches[i + 1].start : line.length;
    const text = line.slice(matches[i].textStart, end).trim();
    results.push({ index: matches[i].index, text });
  }
  return results;
}

function generateQuestionId(index: number): string {
  const bytes = new Uint32Array(1);
  if (globalThis.crypto?.getRandomValues) {
    globalThis.crypto.getRandomValues(bytes);
    return `q-${Date.now().toString(36)}-${index}-${bytes[0].toString(36)}`;
  }
  return `q-${Date.now().toString(36)}-${index}`;
}

function finalizeBlock(
  block: DraftParseBlock,
  seqIndex: number,
  answerKeyMap: Map<number, 0 | 1 | 2 | 3>,
  warnings: string[],
): QuestionModel | null {
  const questionText = normalizeHindiDevanagariText(block.questionLines.join('\n')).trim();
  if (!questionText) return null;

  const hasAnyOption = block.optionsSeen.some(Boolean);
  if (!hasAnyOption) {
    warnings.push(`Question #${seqIndex + 1} skipped: no options (A/B/C/D) found.`);
    return null;
  }

  let resolvedAnswer = block.correctOption;

  // Final safety sweep across all 4 options so answer tags never stay inside option text
  const sanitizedOptions: [string, string, string, string] = ['', '', '', ''];
  for (let idx = 0; idx < 4; idx += 1) {
    const { cleaned, extractedOption } = stripAndExtractInlineAnswers(block.options[idx]);
    if (resolvedAnswer === null && extractedOption !== null) {
      resolvedAnswer = extractedOption;
    }
    sanitizedOptions[idx] = normalizeHindiDevanagariText(cleaned).trim();
  }

  if (resolvedAnswer === null && block.questionNumber !== null) {
    resolvedAnswer = answerKeyMap.get(block.questionNumber) ?? null;
  }

  const explanation = normalizeHindiDevanagariText(block.explanationLines.join('\n')).trim();

  return {
    id: generateQuestionId(seqIndex),
    questionText,
    options: sanitizedOptions,
    correctOption: resolvedAnswer ?? 0,
    explanation: explanation || undefined,
  };
}

function extractTrailingAnswerKeySection(lines: string[]): {
  contentLines: string[];
  answerKeyMap: Map<number, 0 | 1 | 2 | 3>;
} {
  const answerKeyMap = new Map<number, 0 | 1 | 2 | 3>();
  let keyHeaderIdx = -1;

  for (let i = lines.length - 1; i >= 0; i -= 1) {
    const trimmed = lines[i].trim();
    if (/^(?:Answer\s*Key|Answers|उत्तर\s*माला|उत्तर\s*कुंजी)\s*[:.\-–—]?/iu.test(trimmed)) {
      keyHeaderIdx = i;
      break;
    }
  }

  if (keyHeaderIdx === -1) {
    return { contentLines: lines, answerKeyMap };
  }

  const keyBlock = lines.slice(keyHeaderIdx).join(' ');
  ANSWER_KEY_PAIR_RE.lastIndex = 0;
  let pair: RegExpExecArray | null;
  while ((pair = ANSWER_KEY_PAIR_RE.exec(keyBlock)) !== null) {
    const qNum = Number.parseInt(pair[1], 10);
    const optIdx = mapOptionToken(pair[2]);
    if (!Number.isNaN(qNum) && optIdx !== null) {
      answerKeyMap.set(qNum, optIdx);
    }
  }

  return {
    contentLines: lines.slice(0, keyHeaderIdx),
    answerKeyMap,
  };
}

function processLine(
  rawLine: string,
  state: {
    blocks: DraftParseBlock[];
    current: DraftParseBlock | null;
  },
): void {
  const line = normalizeHindiDevanagariText(rawLine).trim();
  if (!line) return;

  // 1. Check Answer line (supports "Ans: B", "Ans:- B", "उत्तर: स", "Ans: C Ans: A", etc.)
  const ansMatch = ANSWER_LINE_RE.exec(line);
  if (ansMatch && state.current) {
    const idx = mapOptionToken(ansMatch[1]);
    if (idx !== null) {
      state.current.correctOption = idx;
      state.current.inExplanation = false;
      const { cleaned } = stripAndExtractInlineAnswers(line);
      const inlineExp = EXPLANATION_START_RE.exec(cleaned);
      if (inlineExp) {
        state.current.inExplanation = true;
        const expBody = inlineExp[1].trim();
        if (expBody) state.current.explanationLines.push(expBody);
      }
      return;
    }
  }

  // 2. Check Explanation line
  const expMatch = EXPLANATION_START_RE.exec(line);
  if (expMatch && state.current) {
    state.current.inExplanation = true;
    const text = expMatch[1].trim();
    if (text) state.current.explanationLines.push(text);
    return;
  }

  // 3. Check Question Start (do not match if line is strictly an option like "1) Option" when inside options)
  const qMatch = QUESTION_START_RE.exec(line);
  if (qMatch) {
    const numStr = qMatch[1] ?? qMatch[2] ?? qMatch[3];
    const qNum = numStr ? Number.parseInt(numStr, 10) : null;
    const isNumericListPrefix = !qMatch[1] && Boolean(qMatch[2] ?? qMatch[3]);
    const numericAsOptionIdx =
      isNumericListPrefix && state.current && state.current.questionLines.length > 0
        ? mapOptionToken(qMatch[2] ?? qMatch[3])
        : null;

    // Treat "1) Text" as option 1 only if we are already inside a question without letters A-D
    const shouldTreatAsNumericOption =
      numericAsOptionIdx !== null &&
      state.current !== null &&
      !state.current.optionsSeen[0] &&
      qNum === 1;

    if (!shouldTreatAsNumericOption) {
      if (state.current) {
        state.blocks.push(state.current);
      }
      const nextBlock = createEmptyBlock(qNum);
      const { cleaned: bodyText, extractedOption } = stripAndExtractInlineAnswers(qMatch[4].trim());
      if (extractedOption !== null) {
        nextBlock.correctOption = extractedOption;
      }

      if (bodyText) {
        nextBlock.questionLines.push(bodyText);
      }
      state.current = nextBlock;
      return;
    }
  }

  if (!state.current) {
    // Allow unnumbered first question line
    state.current = createEmptyBlock(null);
    const { cleaned, extractedOption } = stripAndExtractInlineAnswers(line);
    if (extractedOption !== null) {
      state.current.correctOption = extractedOption;
    }
    if (cleaned) {
      state.current.questionLines.push(cleaned);
    }
    return;
  }

  // 4. Check multiple options on one line (e.g. "A) foo   B) bar   C) baz   D) qux")
  const multiOptions = extractInlineOptionsFromLine(line);
  if (multiOptions.length >= 2) {
    for (const opt of multiOptions) {
      const { cleaned: optText, extractedOption } = stripAndExtractInlineAnswers(opt.text);
      if (extractedOption !== null) {
        state.current.correctOption = extractedOption;
      }
      state.current.options[opt.index] = optText;
      state.current.optionsSeen[opt.index] = true;
      state.current.lastOptionIndex = opt.index;
    }
    state.current.inExplanation = false;
    return;
  }

  // 5. Check single option line
  const optMatch = SINGLE_OPTION_RE.exec(line);
  if (optMatch) {
    const optIdx = mapOptionToken(optMatch[1]);
    if (optIdx !== null) {
      const { cleaned: optText, extractedOption } = stripAndExtractInlineAnswers(optMatch[2].trim());
      if (extractedOption !== null) {
        state.current.correctOption = extractedOption;
      }
      state.current.options[optIdx] = optText;
      state.current.optionsSeen[optIdx] = true;
      state.current.lastOptionIndex = optIdx;
      state.current.inExplanation = false;
      return;
    }
  }

  // 6. Continuation line: append to explanation, current option, or question body (stripping any inline answer tags)
  const { cleaned: cleanedLine, extractedOption } = stripAndExtractInlineAnswers(line);
  if (extractedOption !== null) {
    state.current.correctOption = extractedOption;
  }

  if (!cleanedLine) return;

  if (state.current.inExplanation) {
    state.current.explanationLines.push(cleanedLine);
  } else if (state.current.lastOptionIndex !== null) {
    const idx = state.current.lastOptionIndex;
    state.current.options[idx] = `${state.current.options[idx]} ${cleanedLine}`.trim();
  } else {
    state.current.questionLines.push(cleanedLine);
  }
}

function buildResultFromState(
  blocks: DraftParseBlock[],
  answerKeyMap: Map<number, 0 | 1 | 2 | 3>,
): McqParseResult {
  const warnings: string[] = [];
  const entries: Array<{
    qNum: number | null;
    originalIndex: number;
    question: QuestionModel;
    hasExplicitAnswer: boolean;
  }> = [];

  for (let i = 0; i < blocks.length; i += 1) {
    const b = blocks[i];
    const q = finalizeBlock(b, i, answerKeyMap, warnings);
    if (q) {
      const hasExplicitAnswer =
        b.correctOption !== null ||
        (b.questionNumber !== null && answerKeyMap.has(b.questionNumber));
      entries.push({
        qNum: b.questionNumber,
        originalIndex: i,
        question: q,
        hasExplicitAnswer,
      });
    }
  }

  // If all questions have unique numeric serial numbers (e.g. from PDF extraction)
  // and appeared out of order, sort strictly by question serial ascending (1, 2, 3...)
  const numberedEntries = entries.filter((e) => e.qNum !== null);
  const uniqueNums = new Set(numberedEntries.map((e) => e.qNum));
  if (
    entries.length >= 2 &&
    numberedEntries.length === entries.length &&
    uniqueNums.size === entries.length
  ) {
    entries.sort((a, b) => (a.qNum! - b.qNum!) || (a.originalIndex - b.originalIndex));
  }

  const questions = entries.map((e) => e.question);
  const withAnswersCount = entries.filter((e) => e.hasExplicitAnswer).length;
  const withExplanationsCount = questions.filter((q) => Boolean(q.explanation)).length;

  return {
    questions,
    warnings,
    stats: {
      parsedCount: questions.length,
      withAnswersCount,
      withExplanationsCount,
    },
  };
}

/**
 * Synchronous linear-time O(n) bilingual MCQ parser.
 */
export function parseMcqText(rawText: string): McqParseResult {
  if (!rawText.trim()) {
    return {
      questions: [],
      warnings: [],
      stats: { parsedCount: 0, withAnswersCount: 0, withExplanationsCount: 0 },
    };
  }

  const lines = normalizeHindiDevanagariText(rawText.replace(/\r\n?/g, '\n')).split('\n');
  const { contentLines, answerKeyMap } = extractTrailingAnswerKeySection(lines);
  const state: { blocks: DraftParseBlock[]; current: DraftParseBlock | null } = {
    blocks: [],
    current: null,
  };

  for (let i = 0; i < contentLines.length; i += 1) {
    processLine(contentLines[i], state);
  }
  if (state.current) {
    state.blocks.push(state.current);
  }

  return buildResultFromState(state.blocks, answerKeyMap);
}

/**
 * Non-blocking chunked bilingual MCQ parser that yields to the event loop
 * every chunkSize lines so large question banks never freeze the browser UI.
 */
export async function parseMcqTextAsync(
  rawText: string,
  chunkSize = 250,
): Promise<McqParseResult> {
  if (!rawText.trim()) {
    return {
      questions: [],
      warnings: [],
      stats: { parsedCount: 0, withAnswersCount: 0, withExplanationsCount: 0 },
    };
  }

  const lines = normalizeHindiDevanagariText(rawText.replace(/\r\n?/g, '\n')).split('\n');
  const { contentLines, answerKeyMap } = extractTrailingAnswerKeySection(lines);
  const state: { blocks: DraftParseBlock[]; current: DraftParseBlock | null } = {
    blocks: [],
    current: null,
  };

  for (let i = 0; i < contentLines.length; i += 1) {
    processLine(contentLines[i], state);
    if ((i + 1) % chunkSize === 0 && i + 1 < contentLines.length) {
      await new Promise<void>((resolve) => {
        setTimeout(resolve, 0);
      });
    }
  }

  if (state.current) {
    state.blocks.push(state.current);
  }

  return buildResultFromState(state.blocks, answerKeyMap);
}

export const parseRawTextToMCQs = parseMcqText;
export const parseRawTextToMCQsAsync = parseMcqTextAsync;

export interface AiExtractedRawQuestionItem {
  questionNumber?: number;
  questionText?: string;
  options?: string[];
  correctOption?: number;
  correctOptionIndex?: number;
  explanation?: string;
}

/**
 * Normalizes AI-OCR extracted JSON question items into strict QuestionModel records,
 * enforcing Hindi Devanagari NFC cleanup and stripping any leftover option prefixes or answer keys.
 */
export function sanitizeAiExtractedQuestions(
  rawItems: readonly AiExtractedRawQuestionItem[],
): QuestionModel[] {
  const result: QuestionModel[] = [];

  for (let i = 0; i < rawItems.length; i += 1) {
    const item = rawItems[i];
    if (!item) continue;

    const { cleaned: qCleaned, extractedOption: qInlineAns } = stripAndExtractInlineAnswers(
      normalizeHindiDevanagariText(String(item.questionText ?? ''))
        .replace(/^(?:(?:Q|Que|Question|प्रश्न|प्र)\s*[.:-]?\s*\d+\s*[.):-]?\s*|\(?\d+\)?[.)]\s+)/iu, '')
        .trim(),
    );
    if (!qCleaned) continue;

    let resolvedAns: 0 | 1 | 2 | 3 | null = null;
    const rawIndex =
      typeof item.correctOption === 'number'
        ? item.correctOption
        : typeof item.correctOptionIndex === 'number'
          ? item.correctOptionIndex
          : null;
    if (rawIndex === 0 || rawIndex === 1 || rawIndex === 2 || rawIndex === 3) {
      resolvedAns = rawIndex;
    } else if (qInlineAns !== null) {
      resolvedAns = qInlineAns;
    }

    const rawOpts = Array.isArray(item.options) ? item.options : [];
    const options: [string, string, string, string] = ['', '', '', ''];
    for (let optIdx = 0; optIdx < 4; optIdx += 1) {
      const normalizedOpt = normalizeHindiDevanagariText(String(rawOpts[optIdx] ?? ''))
        .replace(/^\s*(?:\(\s*[A-Da-d1-4१-४अआइईबसदकखगघ]\s*\)|[A-Da-d1-4१-४अआइईबसदकखगघ]\s*[).:\-–—]+)\s*/u, '')
        .trim();
      const { cleaned: cleanOpt, extractedOption: optAns } =
        stripAndExtractInlineAnswers(normalizedOpt);
      if (resolvedAns === null && optAns !== null) {
        resolvedAns = optAns;
      }
      options[optIdx] = cleanOpt;
    }

    if (!options.some(Boolean)) continue;

    const explanation = normalizeHindiDevanagariText(String(item.explanation ?? '')).trim();

    result.push({
      id: generateQuestionId(i),
      questionText: qCleaned,
      options,
      correctOption: resolvedAns ?? 0,
      explanation: explanation || undefined,
    });
  }

  return result;
}

/**
 * Formats QuestionModel array into clean canonical SRSS bilingual text format
 * (Q1. / A) B) C) D) / Ans: / Exp:) for easy editing in the question paste box.
 */
export function formatMcqQuestionsToCanonicalText(
  questions: readonly Pick<
    QuestionModel,
    'questionText' | 'options' | 'correctOption' | 'explanation'
  >[],
): string {
  const letters = ['A', 'B', 'C', 'D'] as const;
  return questions
    .map((q, idx) => {
      const lines = [
        `Q${idx + 1}. ${q.questionText.trim()}`,
        `A) ${q.options[0] ?? ''}`,
        `B) ${q.options[1] ?? ''}`,
        `C) ${q.options[2] ?? ''}`,
        `D) ${q.options[3] ?? ''}`,
        `Ans: ${letters[q.correctOption] ?? 'A'}`,
      ];
      if (q.explanation?.trim()) {
        lines.push(`Exp: ${q.explanation.trim()}`);
      }
      return lines.join('\n');
    })
    .join('\n\n');
}

const TOKEN_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/**
 * Generates a cryptographically random unique exam token (e.g. SRSS-7K4M-9P2X).
 */
export function generateTestToken(existingTokens: readonly string[] = []): string {
  const existingSet = new Set(existingTokens);
  const bytes = new Uint8Array(8);

  for (let attempt = 0; attempt < 100; attempt += 1) {
    globalThis.crypto.getRandomValues(bytes);
    let part1 = '';
    let part2 = '';
    for (let i = 0; i < 4; i += 1) {
      part1 += TOKEN_ALPHABET[bytes[i] % TOKEN_ALPHABET.length];
      part2 += TOKEN_ALPHABET[bytes[i + 4] % TOKEN_ALPHABET.length];
    }
    const candidate = `SRSS-${part1}-${part2}`;
    if (!existingSet.has(candidate)) {
      return candidate;
    }
  }

  throw new Error('Unable to generate a unique test token.');
}

export const SAMPLE_BILINGUAL_MCQS = `Q1. What is the SI unit of electric current?
विद्युत धारा का SI मात्रक क्या है?
A) Volt (वोल्ट)
B) Ampere (एम्पियर)
C) Ohm (ओम)
D) Watt (वाट)
Ans: B
Exp: Electric current is measured in Amperes (A), defined as one coulomb of charge per second.

प्रश्न 2: भारत का संविधान किस तिथि को लागू हुआ था?
(अ) 15 अगस्त 1947
(ब) 26 नवम्बर 1949
(स) 26 जनवरी 1950
(द) 2 अक्टूबर 1950
सही उत्तर: स
व्याख्या: भारतीय संविधान 26 जनवरी 1950 को पूर्ण रूप से लागू हुआ था।

Q3. Solve: If 3x + 7 = 22, find the value of x.
A) 3   B) 4   C) 5   D) 6
Answer: C
Explanation: Subtract 7 from both sides to get 3x = 15, then divide by 3 to get x = 5.`;
