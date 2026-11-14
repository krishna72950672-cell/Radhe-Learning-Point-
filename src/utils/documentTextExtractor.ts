import {
  formatMcqQuestionsToCanonicalText,
  parseRawTextToMCQsAsync,
} from './mcqParser';
import type { QuestionModel } from '../types/exam';

export type DocumentExtractionMethod =
  | 'ai-ocr'
  | 'pdf-text'
  | 'pdf-ocr'
  | 'image-ocr'
  | 'plain-text';

export interface DocumentExtractionResult {
  text: string;
  method: DocumentExtractionMethod;
  pageCount: number;
  columnLayoutDetected?: boolean;
  warnings: string[];
}

export interface SmartQuestionExtractionResult {
  questions: QuestionModel[];
  formattedText: string;
  method: DocumentExtractionMethod;
  pageCount: number;
  columnLayoutDetected?: boolean;
  warnings: string[];
}

export interface PdfTextItemLike {
  str: string;
  hasEOL?: boolean;
  transform?: number[];
  width?: number;
  height?: number;
}

interface PositionedToken {
  text: string;
  x: number;
  y: number;
  width: number;
  fontSize: number;
  streamIndex: number;
}

export function isSupportedQuestionDocumentFile(file: Pick<File, 'name' | 'type'>): boolean {
  const name = file.name.toLowerCase();
  const type = (file.type || '').toLowerCase();
  if (type === 'application/pdf' || name.endsWith('.pdf')) return true;
  if (
    type === 'image/png' ||
    type === 'image/jpeg' ||
    type === 'image/jpg' ||
    type === 'image/webp' ||
    name.endsWith('.png') ||
    name.endsWith('.jpg') ||
    name.endsWith('.jpeg') ||
    name.endsWith('.webp')
  ) {
    return true;
  }
  if (type === 'text/plain' || name.endsWith('.txt')) return true;
  return false;
}

export function classifyQuestionDocumentFile(
  file: Pick<File, 'name' | 'type'>,
): 'pdf' | 'image' | 'text' | 'unsupported' {
  const name = file.name.toLowerCase();
  const type = (file.type || '').toLowerCase();
  if (type === 'application/pdf' || name.endsWith('.pdf')) return 'pdf';
  if (
    type === 'image/png' ||
    type === 'image/jpeg' ||
    type === 'image/jpg' ||
    type === 'image/webp' ||
    name.endsWith('.png') ||
    name.endsWith('.jpg') ||
    name.endsWith('.jpeg') ||
    name.endsWith('.webp')
  ) {
    return 'image';
  }
  if (type === 'text/plain' || name.endsWith('.txt')) return 'text';
  return 'unsupported';
}

const DEVANAGARI_COMBINING_MARK_RE =
  /^[\u0900-\u0903\u093A-\u094F\u0951-\u0957\u0962\u0963\u200C\u200D]+$/;
const DEVANAGARI_STARTS_WITH_MARK_RE =
  /^[\u0900-\u0903\u093A-\u094F\u0951-\u0957\u0962\u0963]/;
const DEVANAGARI_CHAR_RE = /[\u0900-\u097F]/;

function normalizeTokenText(raw: string): string {
  return String(raw ?? '')
    .replace(/[\u200B\uFEFF]/g, '')
    .replace(/\u00A0/g, ' ')
    .normalize('NFC');
}

function isDevanagariCombiningToken(text: string): boolean {
  return DEVANAGARI_COMBINING_MARK_RE.test(text.trim());
}

/**
 * Repairs common Hindi Unicode PDF/OCR extraction artifacts:
 * - Preserves ZWNJ/ZWJ & normalizes to NFC so Devanagari matras and conjuncts stay whole
 * - Removes stray spaces before Devanagari vowel signs / anusvara / virama
 * - Rejoins split virama conjuncts (e.g. "प् र" -> "प्र", "क् ष" -> "क्ष")
 * - Repairs visually-inverted chhoti-i matra ("ि" placed before its consonant at word start)
 */
export function normalizeHindiDevanagariText(input: string): string {
  if (!input) return '';
  let text = input
    .replace(/[\u200B\uFEFF]/g, '')
    .replace(/\u00A0/g, ' ')
    .normalize('NFC');

  // Remove stray spaces between a Devanagari base character/mark and a following Devanagari matra/mark/virama
  text = text.replace(
    /([\u0904-\u0939\u093C-\u094D\u0958-\u0961\u0972-\u097F\u200C\u200D])[ \t]+([\u0900-\u0903\u093A-\u094F\u0951-\u0957\u0962\u0963])/g,
    '$1$2',
  );

  // Rejoin Devanagari conjuncts split by whitespace right after virama (halant \u094D)
  text = text.replace(
    /\u094D[ \t]+([\u0915-\u0939\u0958-\u095F\u0978-\u097F])/g,
    '\u094D$1',
  );

  // Repair visually-inverted chhoti-i matra (\u093F) emitted before a consonant/conjunct at word boundary
  text = text.replace(
    /(^|[\s(\["'“‘.,:;?!\-–—]|[\u0900-\u0903\u093E-\u094C])\u093F((?:[\u0915-\u0939\u0958-\u095F\u0978-\u097F]\u094D)*[\u0915-\u0939\u0958-\u095F\u0978-\u097F])/g,
    '$1$2\u093F',
  );

  return text.normalize('NFC');
}

function toPositionedTokens(items: readonly PdfTextItemLike[]): PositionedToken[] {
  const tokens: PositionedToken[] = [];

  for (let i = 0; i < items.length; i += 1) {
    const item = items[i];
    const normalized = normalizeTokenText(item.str);
    if (!normalized.trim()) continue;

    const tr = Array.isArray(item.transform) && item.transform.length >= 6 ? item.transform : null;
    const fontSize = tr ? Math.max(6, Math.hypot(tr[0], tr[1]) || Math.abs(tr[3]) || 11) : 11;
    const x = tr ? tr[4] : 0;
    const y = tr ? tr[5] : -i * 18;
    const width =
      typeof item.width === 'number' && item.width >= 0
        ? item.width
        : normalized.trim().length * fontSize * 0.48;

    tokens.push({
      text: normalized.trim(),
      x,
      y,
      width,
      fontSize,
      streamIndex: i,
    });
  }

  return tokens;
}

/**
 * Detects whether a PDF page uses a 2-column exam layout (common in Indian coaching/school papers)
 * so Column 1 is read completely before Column 2 instead of mixing left & right lines horizontally.
 */
export function detectTwoColumnSplitX(tokens: readonly PositionedToken[]): number | null {
  if (tokens.length < 8) return null;

  let minX = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  for (const t of tokens) {
    if (t.x < minX) minX = t.x;
    if (t.x + t.width > maxX) maxX = t.x + t.width;
  }

  const pageSpan = maxX - minX;
  if (pageSpan < 200) return null;

  const searchStart = minX + pageSpan * 0.34;
  const searchEnd = minX + pageSpan * 0.66;
  const step = Math.max(4, pageSpan / 80);

  let bestGutterStart = -1;
  let bestGutterEnd = -1;
  let currentRunStart = -1;

  for (let cx = searchStart; cx <= searchEnd; cx += step) {
    let crossingCount = 0;
    for (const t of tokens) {
      if (t.x < cx && t.x + t.width > cx) {
        crossingCount += 1;
      }
    }

    if (crossingCount === 0) {
      if (currentRunStart < 0) currentRunStart = cx;
      if (cx - currentRunStart > bestGutterEnd - bestGutterStart) {
        bestGutterStart = currentRunStart;
        bestGutterEnd = cx;
      }
    } else {
      currentRunStart = -1;
    }
  }

  if (bestGutterStart < 0 || bestGutterEnd - bestGutterStart < 14) {
    return null;
  }

  const splitX = (bestGutterStart + bestGutterEnd) / 2;
  const leftTokens = tokens.filter((t) => t.x + t.width <= splitX);
  const rightTokens = tokens.filter((t) => t.x >= splitX);

  if (leftTokens.length < 3 || rightTokens.length < 3) return null;

  const leftRatio = leftTokens.length / tokens.length;
  const rightRatio = rightTokens.length / tokens.length;
  if (leftRatio < 0.15 || rightRatio < 0.15) return null;

  // Guard against centered single-line options or tables by checking vertical overlap across both halves
  const distinctY = (arr: readonly PositionedToken[]) => {
    const ys: number[] = [];
    for (const item of arr) {
      if (!ys.some((y) => Math.abs(y - item.y) <= 5)) {
        ys.push(item.y);
      }
    }
    return ys.length;
  };

  if (distinctY(leftTokens) < 3 || distinctY(rightTokens) < 3) {
    return null;
  }

  // Ensure both left and right halves actually contain independent numbered questions
  // so 1-column papers with tabular A) ... B) ... options never false-trigger column splitting
  const leftTextJoined = leftTokens.map((t) => t.text).join(' ');
  const rightTextJoined = rightTokens.map((t) => t.text).join(' ');
  const questionMarkerRe = /(?:^|\s)(?:Q\.?\s*\d+|Que\.?\s*\d+|Question\s*\d+|प्रश्न\s*\d+|\(\d+\)|\d+\s*[.)])/i;
  if (!questionMarkerRe.test(leftTextJoined) || !questionMarkerRe.test(rightTextJoined)) {
    return null;
  }

  return splitX;
}

function reconstructSingleColumnLines(tokens: readonly PositionedToken[]): string[] {
  if (tokens.length === 0) return [];

  // Sort visually top-to-bottom (Y descending in PDF coordinate space), then left-to-right (X ascending)
  const sorted = [...tokens].sort((a, b) => {
    const yDiff = b.y - a.y;
    const minFont = Math.min(a.fontSize, b.fontSize);
    const yThreshold =
      isDevanagariCombiningToken(a.text) || isDevanagariCombiningToken(b.text)
        ? Math.max(6, minFont * 0.9)
        : Math.max(3, minFont * 0.45);
    if (Math.abs(yDiff) > yThreshold) {
      return yDiff;
    }
    if (Math.abs(a.x - b.x) > 0.5) {
      return a.x - b.x;
    }
    return a.streamIndex - b.streamIndex;
  });

  const rows: Array<{ anchorY: number; fontSize: number; items: PositionedToken[] }> = [];

  for (const token of sorted) {
    const isCombining = isDevanagariCombiningToken(token.text);
    // Find the closest existing row within baseline tolerance (protects slightly raised/lowered Hindi matras)
    let targetRow: (typeof rows)[number] | null = null;
    let bestDist = Number.POSITIVE_INFINITY;

    for (let r = rows.length - 1; r >= Math.max(0, rows.length - 4); r -= 1) {
      const candidate = rows[r];
      const tol = isCombining
        ? Math.max(6.5, Math.max(token.fontSize, candidate.fontSize) * 0.95)
        : Math.max(3.5, Math.min(token.fontSize, candidate.fontSize) * 0.52);
      const dist = Math.abs(token.y - candidate.anchorY);
      if (dist <= tol && dist < bestDist) {
        bestDist = dist;
        targetRow = candidate;
      }
    }

    if (targetRow) {
      targetRow.items.push(token);
      if (!isCombining) {
        targetRow.anchorY =
          (targetRow.anchorY * (targetRow.items.length - 1) + token.y) / targetRow.items.length;
      }
    } else {
      rows.push({ anchorY: token.y, fontSize: token.fontSize, items: [token] });
    }
  }

  const lines: string[] = [];
  for (const row of rows) {
    // 1. Sort strictly by X ascending (ties broken by streamIndex)
    const xSorted = [...row.items].sort((a, b) =>
      a.x !== b.x ? a.x - b.x : a.streamIndex - b.streamIndex,
    );

    // 2. Group horizontally overlapping glyphs or touching Devanagari syllable marks into clusters
    //    and preserve PDF streamIndex order inside each cluster so (consonant, ि-matra) never flips!
    const clusters: PositionedToken[][] = [];
    for (const token of xSorted) {
      const prevCluster = clusters[clusters.length - 1];
      if (!prevCluster) {
        clusters.push([token]);
        continue;
      }
      const clusterMaxRight = Math.max(...prevCluster.map((t) => t.x + Math.max(t.width, 0)));
      const lastInCluster = prevCluster[prevCluster.length - 1];
      const refSize = Math.max(6, Math.min(lastInCluster.fontSize, token.fontSize));
      const overlaps = token.x < clusterMaxRight - 0.15;
      const touchingMark =
        (isDevanagariCombiningToken(token.text) ||
          isDevanagariCombiningToken(lastInCluster.text)) &&
        token.x - clusterMaxRight <= refSize * 0.35;

      if (overlaps || touchingMark) {
        prevCluster.push(token);
      } else {
        clusters.push([token]);
      }
    }

    const orderedTokens: PositionedToken[] = [];
    for (const cluster of clusters) {
      if (cluster.length > 1) {
        cluster.sort((a, b) => a.streamIndex - b.streamIndex);
      }
      orderedTokens.push(...cluster);
    }

    let lineText = '';
    let prev: PositionedToken | null = null;
    let prevVisualRight = 0;

    for (const curr of orderedTokens) {
      if (!prev) {
        lineText = curr.text;
        prev = curr;
        prevVisualRight = curr.x + curr.width;
        continue;
      }

      const gap = curr.x - prevVisualRight;
      const refSize = Math.max(6, Math.min(prev.fontSize, curr.fontSize));
      const bothDevanagari =
        DEVANAGARI_CHAR_RE.test(prev.text) && DEVANAGARI_CHAR_RE.test(curr.text);
      const joinTightly =
        prev.text.endsWith('\u094D') ||
        DEVANAGARI_STARTS_WITH_MARK_RE.test(curr.text) ||
        gap <= Math.max(1.2, refSize * (bothDevanagari ? 0.2 : 0.14));

      if (joinTightly) {
        lineText += curr.text;
      } else if (gap <= refSize * 1.9) {
        lineText += ` ${curr.text}`;
      } else {
        lineText += `   ${curr.text}`;
      }

      prev = curr;
      prevVisualRight = Math.max(prevVisualRight, curr.x + curr.width);
    }

    const cleanedLine = normalizeHindiDevanagariText(lineText)
      .replace(/\s{4,}/g, '   ')
      .trim();
    if (cleanedLine) {
      lines.push(cleanedLine);
    }
  }

  return lines;
}

/**
 * Spatial visual layout reconstructor for PDF.js text items.
 * Handles out-of-order PDF streams, splits two-column papers into exact column reading order,
 * and joins fragments cleanly without splitting words or adding garbage spaces.
 */
export function groupPdfTextItemsIntoLines(
  items: readonly PdfTextItemLike[],
): string {
  const result = reconstructPdfPageLinesWithMeta(items);
  return result.text;
}

export function reconstructPdfPageLinesWithMeta(
  items: readonly PdfTextItemLike[],
): { text: string; columnLayoutDetected: boolean } {
  const tokens = toPositionedTokens(items);
  if (tokens.length === 0) {
    return { text: '', columnLayoutDetected: false };
  }

  // Fallback for synthetic unit test items without valid X/Y differences that rely purely on hasEOL
  const allSameOrigin = tokens.every((t) => t.x === tokens[0].x && Math.abs(t.y - tokens[0].y) < 0.01);
  if (allSameOrigin) {
    const simpleLines: string[] = [];
    let parts: string[] = [];
    for (const item of items) {
      const txt = normalizeTokenText(item.str).trim();
      if (txt) parts.push(txt);
      if (item.hasEOL) {
        const joined = normalizeHindiDevanagariText(
          parts.join(' ').replace(/\s{2,}/g, ' ').trim(),
        );
        if (joined) simpleLines.push(joined);
        parts = [];
      }
    }
    if (parts.length > 0) {
      const joined = normalizeHindiDevanagariText(
        parts.join(' ').replace(/\s{2,}/g, ' ').trim(),
      );
      if (joined) simpleLines.push(joined);
    }
    return { text: simpleLines.join('\n'), columnLayoutDetected: false };
  }

  const splitX = detectTwoColumnSplitX(tokens);
  if (splitX !== null) {
    const leftTokens = tokens.filter((t) => t.x + t.width <= splitX);
    const rightTokens = tokens.filter((t) => t.x >= splitX);
    const leftLines = reconstructSingleColumnLines(leftTokens);
    const rightLines = reconstructSingleColumnLines(rightTokens);
    return {
      text: [...leftLines, ...rightLines].join('\n'),
      columnLayoutDetected: true,
    };
  }

  return {
    text: reconstructSingleColumnLines(tokens).join('\n'),
    columnLayoutDetected: false,
  };
}

const STANDALONE_NOISE_LINE_RE =
  /^(?:page\s*\d+(?:\s*(?:of|\/)\s*\d+)?|[-–—_]{3,}|[|]{2,}|[-–—]\s*\d+\s*[-–—]|\d+\s*\/\s*\d+)$/i;

const ORPHAN_QUESTION_PREFIX_RE =
  /^(?:(?:Q|Que|Question|प्रश्न|प्र)\s*[.:-]?\s*\d+\s*[.):-]?|\(?\d+\)?[.)])$/iu;

const ORPHAN_OPTION_PREFIX_RE =
  /^\(?\s*[A-Da-d1-4१-४अआइईबसदकखगघ]\s*[).:\-]$/u;

const QUESTION_BLOCK_START_RE =
  /^(?:(?:Q|Que|Question|प्रश्न|प्र)\s*[.:-]?\s*(\d+)\s*[.):-]?\s+|\(?(\d+)\)?[.)]\s+)/iu;

/**
 * Cleans PDF/OCR artifacts: removes page footers/headers, merges detached "Q1." or "A)"
 * prefixes onto their question/option text line, repairs Devanagari matras/conjuncts,
 * eliminates extra blank lines/spaces, and adds neat spacing between consecutive questions in strict serial order.
 */
export function cleanAndNormalizeExtractedMcqText(rawText: string): string {
  if (!rawText.trim()) return '';

  const rawLines = normalizeHindiDevanagariText(rawText.replace(/\r\n?/g, '\n'))
    .split('\n')
    .map((line) => line.replace(/\t+/g, '   ').replace(/ {4,}/g, '   ').trim());

  const filteredLines = rawLines.filter((line) => {
    if (!line) return false;
    if (STANDALONE_NOISE_LINE_RE.test(line)) return false;
    return true;
  });

  const mergedLines: string[] = [];
  for (let i = 0; i < filteredLines.length; i += 1) {
    const line = filteredLines[i];
    if (
      (ORPHAN_QUESTION_PREFIX_RE.test(line) || ORPHAN_OPTION_PREFIX_RE.test(line)) &&
      i + 1 < filteredLines.length
    ) {
      const nextLine = filteredLines[i + 1];
      if (!ORPHAN_QUESTION_PREFIX_RE.test(nextLine) && !ORPHAN_OPTION_PREFIX_RE.test(nextLine)) {
        mergedLines.push(`${line} ${nextLine}`);
        i += 1;
        continue;
      }
    }
    mergedLines.push(line);
  }

  // Re-insert a single clean blank line before each new question block (except the first)
  const formattedLines: string[] = [];
  for (let i = 0; i < mergedLines.length; i += 1) {
    const line = mergedLines[i];
    if (i > 0 && QUESTION_BLOCK_START_RE.test(line) && formattedLines[formattedLines.length - 1] !== '') {
      formattedLines.push('');
    }
    formattedLines.push(line);
  }

  return formattedLines.join('\n').trim();
}

export function isReadableExtractedText(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return false;
  const replacementCount = (trimmed.match(/\uFFFD/g) ?? []).length;
  if (replacementCount / trimmed.length > 0.1) return false;
  // Require at least some alphanumeric or Devanagari characters
  const readableChars = (trimmed.match(/[A-Za-z0-9\u0900-\u097F]/g) ?? []).length;
  return readableChars >= Math.min(8, trimmed.length * 0.25);
}

/**
 * Lightweight pure-JS fallback extractor for simple uncompressed PDF text streams
 * in case PDF.js worker fails in restricted environments.
 */
export function extractBasicPdfTextFallback(bytes: Uint8Array): string {
  const decoder = new TextDecoder('latin1');
  const raw = decoder.decode(bytes);
  const extractedLines: string[] = [];
  const tjMatches = raw.match(/\((?:\\.|[^\\()])+\)\s*Tj/g) ?? [];
  for (const token of tjMatches) {
    const inner = token.replace(/^\(/, '').replace(/\)\s*Tj$/, '');
    const unescaped = inner
      .replace(/\\n/g, '\n')
      .replace(/\\r/g, '')
      .replace(/\\([()\\])/g, '$1')
      .trim();
    if (unescaped) {
      extractedLines.push(unescaped);
    }
  }

  const tjArrayMatches = raw.match(/\[(?:[^\]]+)\]\s*TJ/g) ?? [];
  for (const arr of tjArrayMatches) {
    const parts = arr.match(/\((?:\\.|[^\\()])*\)/g) ?? [];
    const line = parts
      .map((p) => p.slice(1, -1).replace(/\\([()\\])/g, '$1'))
      .join('')
      .trim();
    if (line) {
      extractedLines.push(line);
    }
  }

  return cleanAndNormalizeExtractedMcqText(extractedLines.join('\n'));
}

export function readFileAsArrayBuffer(file: File): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read file via FileReader.'));
    reader.onload = () => {
      if (reader.result instanceof ArrayBuffer) {
        resolve(reader.result);
      } else {
        reject(new Error('Unexpected non-binary FileReader result.'));
      }
    };
    reader.readAsArrayBuffer(file);
  });
}

export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read file as Data URL.'));
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.readAsDataURL(file);
  });
}

export function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read text file.'));
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.readAsText(file);
  });
}

async function runImageOcr(
  imageSource: string,
  onProgress?: (status: string, progressPct?: number) => void,
): Promise<{ text: string; warnings: string[] }> {
  const warnings: string[] = [];
  const { createWorker } = await import('tesseract.js');

  const recognizeWithLang = async (lang: string): Promise<string> => {
    const worker = await createWorker(lang, 1, {
      logger: (msg) => {
        if (msg.status === 'recognizing text' && typeof msg.progress === 'number') {
          onProgress?.('OCR scanning text...', Math.round(msg.progress * 100));
        }
      },
    });
    try {
      const result = await worker.recognize(imageSource);
      return (result.data?.text ?? '').trim();
    } finally {
      await worker.terminate();
    }
  };

  try {
    onProgress?.('Running OCR (English + Hindi)...', 10);
    const bilingualText = await recognizeWithLang('eng+hin');
    if (bilingualText) {
      return { text: cleanAndNormalizeExtractedMcqText(bilingualText), warnings };
    }
  } catch {
    // Fall back to English-only traineddata if Hindi model cannot be loaded
  }

  try {
    onProgress?.('Running OCR (English)...', 15);
    const engText = await recognizeWithLang('eng');
    if (engText) {
      return { text: cleanAndNormalizeExtractedMcqText(engText), warnings };
    }
  } catch (err) {
    warnings.push(
      err instanceof Error
        ? `OCR notice: ${err.message}`
        : 'OCR engine could not initialize language data.',
    );
  }

  return { text: '', warnings };
}

async function extractTextFromPdfFile(
  file: File,
  onProgress?: (status: string, progressPct?: number) => void,
): Promise<DocumentExtractionResult> {
  const warnings: string[] = [];
  onProgress?.('Reading PDF file...', 5);
  const buffer = await readFileAsArrayBuffer(file);
  const bytes = new Uint8Array(buffer);

  try {
    const pdfjsLib = await import('pdfjs-dist');
    const workerModule = await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
    pdfjsLib.GlobalWorkerOptions.workerSrc = workerModule.default;

    const loadingTask = pdfjsLib.getDocument({ data: bytes.slice() });
    const pdfDoc = await loadingTask.promise;
    const totalPages = pdfDoc.numPages;
    const pageTexts: string[] = [];
    let anyColumnsDetected = false;
    let ocrUsed = false;

    for (let pageNo = 1; pageNo <= totalPages; pageNo += 1) {
      onProgress?.(
        `Reading PDF page ${pageNo} / ${totalPages}...`,
        Math.round((pageNo / Math.max(1, totalPages)) * 75),
      );
      const page = await pdfDoc.getPage(pageNo);
      const textContent = await page.getTextContent();
      const pageMeta = reconstructPdfPageLinesWithMeta(
        textContent.items as PdfTextItemLike[],
      );
      if (pageMeta.columnLayoutDetected) {
        anyColumnsDetected = true;
      }

      if (isReadableExtractedText(pageMeta.text)) {
        pageTexts.push(pageMeta.text);
      } else if (pageNo <= 8) {
        // Scanned or legacy non-Unicode page fallback -> high-DPI canvas OCR
        ocrUsed = true;
        onProgress?.(
          `OCR scanning PDF page ${pageNo} / ${totalPages}...`,
          Math.round((pageNo / Math.max(1, totalPages)) * 90),
        );
        const viewport = page.getViewport({ scale: 2.0 });
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.floor(viewport.width));
        canvas.height = Math.max(1, Math.floor(viewport.height));
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          await page.render({ canvas, canvasContext: ctx, viewport }).promise;
          const dataUrl = canvas.toDataURL('image/png');
          const ocrRes = await runImageOcr(dataUrl, onProgress);
          warnings.push(...ocrRes.warnings);
          if (ocrRes.text) {
            pageTexts.push(ocrRes.text);
          }
        }
      }
    }

    const cleanedCombined = cleanAndNormalizeExtractedMcqText(pageTexts.join('\n\n'));
    if (cleanedCombined) {
      onProgress?.('PDF formatted & extracted.', 100);
      return {
        text: cleanedCombined,
        method: ocrUsed ? 'pdf-ocr' : 'pdf-text',
        pageCount: totalPages,
        columnLayoutDetected: anyColumnsDetected,
        warnings,
      };
    }

    return {
      text: '',
      method: ocrUsed ? 'pdf-ocr' : 'pdf-text',
      pageCount: totalPages,
      columnLayoutDetected: anyColumnsDetected,
      warnings,
    };
  } catch {
    const fallbackText = extractBasicPdfTextFallback(bytes);
    if (fallbackText) {
      warnings.push('Used direct PDF stream reader fallback.');
      return {
        text: fallbackText,
        method: 'pdf-text',
        pageCount: 1,
        warnings,
      };
    }
    throw new Error('Could not extract text from the uploaded PDF file.');
  }
}

export async function extractQuestionTextFromFile(
  file: File,
  onProgress?: (status: string, progressPct?: number) => void,
): Promise<DocumentExtractionResult> {
  const kind = classifyQuestionDocumentFile(file);

  if (kind === 'unsupported') {
    throw new Error('Unsupported file format. Please upload a .pdf, .png, .jpg, or .jpeg file.');
  }

  if (kind === 'text') {
    const text = await readFileAsText(file);
    return {
      text: cleanAndNormalizeExtractedMcqText(text),
      method: 'plain-text',
      pageCount: 1,
      warnings: [],
    };
  }

  if (kind === 'pdf') {
    return extractTextFromPdfFile(file, onProgress);
  }

  // Image (.png, .jpg, .jpeg, .webp) -> FileReader + client-side OCR
  onProgress?.('Reading image file...', 5);
  const dataUrl = await readFileAsDataUrl(file);
  const ocrResult = await runImageOcr(dataUrl, onProgress);
  onProgress?.('Image OCR completed.', 100);
  return {
    text: ocrResult.text,
    method: 'image-ocr',
    pageCount: 1,
    warnings: ocrResult.warnings,
  };
}

/**
 * Unified 100% client-side Smart OCR + Spatial PDF.js + Bilingual MCQ Parser pipeline.
 * Runs completely in the browser (PDF.js 2-column & Hindi Unicode layout reconstruction,
 * Tesseract.js Hindi+English OCR for scans/images, and canonical MCQ formatting) with
 * zero backend servers or paid API keys required.
 */
export async function extractQuestionsSmartWithAiOcr(params: {
  files?: File[];
  rawText?: string;
  onProgress?: (status: string, progressPct?: number) => void;
}): Promise<SmartQuestionExtractionResult> {
  const { files = [], rawText = '', onProgress } = params;
  const warnings: string[] = [];

  for (const file of files) {
    const kind = classifyQuestionDocumentFile(file);
    if (kind === 'unsupported') {
      throw new Error(
        `Unsupported file format (${file.name}). Please upload PDF, PNG, JPG, JPEG, or WEBP.`,
      );
    }
  }

  const extractedTexts: string[] = [];
  let method: DocumentExtractionMethod = 'plain-text';
  let totalPages = 0;
  let anyColumns = false;

  if (rawText.trim()) {
    onProgress?.('Cleaning & formatting question text...', 30);
    extractedTexts.push(cleanAndNormalizeExtractedMcqText(rawText));
  }

  for (const file of files) {
    const res = await extractQuestionTextFromFile(file, onProgress);
    totalPages += res.pageCount;
    if (res.columnLayoutDetected) anyColumns = true;
    method = res.method;
    warnings.push(...res.warnings);
    if (res.text.trim()) {
      extractedTexts.push(res.text);
    }
  }

  const mergedText = extractedTexts.join('\n\n').trim();
  if (!mergedText) {
    return {
      questions: [],
      formattedText: '',
      method,
      pageCount: Math.max(1, totalPages),
      columnLayoutDetected: anyColumns,
      warnings,
    };
  }

  onProgress?.('Parsing & formatting bilingual MCQs...', 85);
  const parsed = await parseRawTextToMCQsAsync(mergedText);
  warnings.push(...parsed.warnings);

  const canonical =
    parsed.questions.length > 0
      ? formatMcqQuestionsToCanonicalText(parsed.questions)
      : mergedText;

  onProgress?.('Completed!', 100);
  return {
    questions: parsed.questions,
    formattedText: canonical,
    method,
    pageCount: Math.max(1, totalPages),
    columnLayoutDetected: anyColumns,
    warnings,
  };
}

