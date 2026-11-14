import assert from 'node:assert/strict';
import test from 'node:test';
import {
  classifyQuestionDocumentFile,
  cleanAndNormalizeExtractedMcqText,
  extractBasicPdfTextFallback,
  groupPdfTextItemsIntoLines,
  isReadableExtractedText,
  isSupportedQuestionDocumentFile,
  reconstructPdfPageLinesWithMeta,
} from './documentTextExtractor.ts';
import { parseRawTextToMCQs } from './mcqParser.ts';

test('classifyQuestionDocumentFile and isSupportedQuestionDocumentFile recognize PDF and images', () => {
  assert.equal(classifyQuestionDocumentFile({ name: 'paper.pdf', type: 'application/pdf' }), 'pdf');
  assert.equal(classifyQuestionDocumentFile({ name: 'scan.PNG', type: '' }), 'image');
  assert.equal(classifyQuestionDocumentFile({ name: 'photo.jpeg', type: 'image/jpeg' }), 'image');
  assert.equal(classifyQuestionDocumentFile({ name: 'notes.txt', type: 'text/plain' }), 'text');
  assert.equal(classifyQuestionDocumentFile({ name: 'archive.zip', type: 'application/zip' }), 'unsupported');

  assert.equal(isSupportedQuestionDocumentFile({ name: 'paper.pdf', type: 'application/pdf' }), true);
  assert.equal(isSupportedQuestionDocumentFile({ name: 'scan.jpg', type: 'image/jpeg' }), true);
  assert.equal(isSupportedQuestionDocumentFile({ name: 'script.exe', type: 'application/octet-stream' }), false);
});

test('groupPdfTextItemsIntoLines reconstructs multi-line MCQs cleanly for parseRawTextToMCQs', () => {
  const items = [
    { str: 'Q1.', transform: [11, 0, 0, 11, 40, 700], width: 18 },
    { str: 'What is 2 + 3?', transform: [11, 0, 0, 11, 64, 700], width: 78, hasEOL: true },
    { str: 'A) 4', transform: [11, 0, 0, 11, 40, 680], width: 25, hasEOL: true },
    { str: 'B) 5', transform: [11, 0, 0, 11, 40, 660], width: 25, hasEOL: true },
    { str: 'C) 6', transform: [11, 0, 0, 11, 40, 640], width: 25, hasEOL: true },
    { str: 'D) 7', transform: [11, 0, 0, 11, 40, 620], width: 25, hasEOL: true },
    { str: 'Ans: B', transform: [11, 0, 0, 11, 40, 600], width: 35, hasEOL: true },
  ];

  const text = cleanAndNormalizeExtractedMcqText(groupPdfTextItemsIntoLines(items));
  const parsed = parseRawTextToMCQs(text);
  assert.equal(parsed.questions.length, 1);
  assert.equal(parsed.questions[0].questionText, 'What is 2 + 3?');
  assert.deepEqual(parsed.questions[0].options, ['4', '5', '6', '7']);
  assert.equal(parsed.questions[0].correctOption, 1);
});

test('reconstructPdfPageLinesWithMeta unscrambles out-of-order 2-column exam PDFs in exact serial order', () => {
  // Simulate PDF stream where right column (Q3, Q4) and left column (Q1, Q2) are interleaved / out of stream order
  const items = [
    // Right column emitted FIRST in PDF stream (X = 330..540)
    { str: 'Q3. Capital of Bihar?', transform: [11, 0, 0, 11, 330, 740], width: 120 },
    { str: 'A) Gaya   B) Patna', transform: [11, 0, 0, 11, 330, 720], width: 110 },
    { str: 'C) Buxar  D) Ara', transform: [11, 0, 0, 11, 330, 700], width: 100 },
    { str: 'Ans: B', transform: [11, 0, 0, 11, 330, 680], width: 40 },
    { str: 'Q4. Largest planet?', transform: [11, 0, 0, 11, 330, 640], width: 110 },
    { str: 'A) Mars B) Jupiter C) Venus D) Earth', transform: [11, 0, 0, 11, 330, 620], width: 190 },
    { str: 'Ans: B', transform: [11, 0, 0, 11, 330, 600], width: 40 },

    // Left column emitted SECOND in PDF stream (X = 40..250), even with Q2 before Q1
    { str: 'Q2. Formula of Water?', transform: [11, 0, 0, 11, 40, 640], width: 115 },
    { str: 'A) H2O B) CO2 C) O2 D) N2', transform: [11, 0, 0, 11, 40, 620], width: 150 },
    { str: 'Ans: A', transform: [11, 0, 0, 11, 40, 600], width: 40 },
    { str: 'Q1.', transform: [11, 0, 0, 11, 40, 740], width: 18 },
    { str: 'Unit of Force?', transform: [11, 0, 0, 11, 64, 740], width: 75 },
    { str: 'A) Joule B) Newton C) Watt D) Volt', transform: [11, 0, 0, 11, 40, 720], width: 185 },
    { str: 'Ans: B', transform: [11, 0, 0, 11, 40, 700], width: 40 },
  ];

  const meta = reconstructPdfPageLinesWithMeta(items);
  assert.equal(meta.columnLayoutDetected, true);

  const cleaned = cleanAndNormalizeExtractedMcqText(meta.text);
  const parsed = parseRawTextToMCQs(cleaned);

  assert.equal(parsed.questions.length, 4);
  assert.equal(parsed.questions[0].questionText, 'Unit of Force?');
  assert.equal(parsed.questions[1].questionText, 'Formula of Water?');
  assert.equal(parsed.questions[2].questionText, 'Capital of Bihar?');
  assert.equal(parsed.questions[3].questionText, 'Largest planet?');
  assert.deepEqual(parsed.questions[0].options, ['Joule', 'Newton', 'Watt', 'Volt']);
  assert.equal(parsed.questions[0].correctOption, 1);
  assert.equal(parsed.questions[1].correctOption, 0);
});

test('cleanAndNormalizeExtractedMcqText strips PDF page noise, merges orphan prefixes, and joins split fragments cleanly', () => {
  const messy = `
Page 1 of 4

Q1.
What is the SI unit of Mass?
A)
Kilogram
B)
Gram
C) Pound
D) Tonne
Ans: A

- 2 -
(2) Which gas do plants absorb?
A) Oxygen B) Nitrogen C) Carbon Dioxide D) Hydrogen
Ans: C
`;

  const cleaned = cleanAndNormalizeExtractedMcqText(messy);
  assert.doesNotMatch(cleaned, /Page 1 of 4/);
  assert.doesNotMatch(cleaned, /^- 2 -$/m);
  assert.match(cleaned, /^Q1\. What is the SI unit of Mass\?/m);
  assert.match(cleaned, /^A\) Kilogram/m);

  const parsed = parseRawTextToMCQs(cleaned);
  assert.equal(parsed.questions.length, 2);
  assert.equal(parsed.questions[0].options[0], 'Kilogram');
  assert.deepEqual(parsed.questions[1].options, ['Oxygen', 'Nitrogen', 'Carbon Dioxide', 'Hydrogen']);
  assert.equal(parsed.questions[1].correctOption, 2);
});

test('isReadableExtractedText rejects replacement-glyph garbage so OCR fallback can trigger', () => {
  assert.equal(isReadableExtractedText('\uFFFD\uFFFD\uFFFD\uFFFD\uFFFD\uFFFD\uFFFD\uFFFD'), false);
  assert.equal(isReadableExtractedText('   '), false);
  assert.equal(isReadableExtractedText('Q1. भारत की राजधानी क्या है?'), true);
});

test('extractBasicPdfTextFallback extracts uncompressed PDF Tj text operators', () => {
  const minimalPdf = `%PDF-1.4
1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj
2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj
3 0 obj << /Type /Page /Parent 2 0 R /Contents 4 0 R >> endobj
4 0 obj << /Length 120 >>
stream
BT /F1 12 Tf 50 750 Td
(Q1. Capital of India?) Tj
0 -20 Td (A\\) Mumbai) Tj
0 -20 Td (B\\) New Delhi) Tj
0 -20 Td (C\\) Agra) Tj
0 -20 Td (D\\) Pune) Tj
0 -20 Td (Ans: B) Tj
ET
endstream
endobj`;

  const bytes = new TextEncoder().encode(minimalPdf);
  const extracted = extractBasicPdfTextFallback(bytes);
  const parsed = parseRawTextToMCQs(extracted);

  assert.equal(parsed.questions.length, 1);
  assert.equal(parsed.questions[0].questionText, 'Capital of India?');
  assert.equal(parsed.questions[0].options[1], 'New Delhi');
  assert.equal(parsed.questions[0].correctOption, 1);
});

test('groupPdfTextItemsIntoLines keeps Hindi Devanagari matras, conjuncts, and visually-left chhoti-i intact', () => {
  const items = [
    // Logical stream: क followed by visually-left ि (x = 96 < 100) + त + ा + ब
    { str: 'प्रश्न 1:', transform: [12, 0, 0, 12, 40, 720], width: 42 },
    { str: 'क', transform: [12, 0, 0, 12, 100, 720], width: 10 },
    { str: '\u093F', transform: [12, 0, 0, 12, 96, 720.8], width: 5 },
    { str: 'ताब', transform: [12, 0, 0, 12, 111, 720], width: 22 },
    // Slightly raised anusvara & split virama conjunct
    { str: 'में', transform: [12, 0, 0, 12, 138, 720], width: 14 },
    { str: 'प्', transform: [12, 0, 0, 12, 158, 720], width: 8 },
    { str: 'र', transform: [12, 0, 0, 12, 166.5, 720], width: 6 },
    { str: 'श्', transform: [12, 0, 0, 12, 173, 720], width: 8 },
    { str: 'न?', transform: [12, 0, 0, 12, 181, 720], width: 14, hasEOL: true },
    // Simulate visually-inverted word-start chhoti-i emitted before consonant ("िवज्ञान" -> "विज्ञान")
    { str: 'A) \u093Fवज्ञान', transform: [12, 0, 0, 12, 40, 700], width: 52, hasEOL: true },
    { str: 'B) ग\u0923 \u093Fत', transform: [12, 0, 0, 12, 40, 680], width: 48, hasEOL: true },
    { str: 'C) इतिहास', transform: [12, 0, 0, 12, 40, 660], width: 48, hasEOL: true },
    { str: 'D) भूगोल', transform: [12, 0, 0, 12, 40, 640], width: 48, hasEOL: true },
    { str: 'उत्तर: A', transform: [12, 0, 0, 12, 40, 620], width: 42, hasEOL: true },
  ];

  const reconstructed = cleanAndNormalizeExtractedMcqText(groupPdfTextItemsIntoLines(items));
  assert.ok(reconstructed.includes('किताब'), `Expected 'किताब' in: ${reconstructed}`);
  assert.ok(reconstructed.includes('प्रश्न?'), `Expected 'प्रश्न?' in: ${reconstructed}`);

  const parsed = parseRawTextToMCQs(reconstructed);
  assert.equal(parsed.questions.length, 1);
  assert.equal(parsed.questions[0].options[0], 'विज्ञान');
  assert.equal(parsed.questions[0].options[1], 'गणित');
  assert.equal(parsed.questions[0].correctOption, 0);
});
