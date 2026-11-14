import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SAMPLE_BILINGUAL_MCQS,
  formatMcqQuestionsToCanonicalText,
  generateTestToken,
  parseMcqText,
  parseMcqTextAsync,
  sanitizeAiExtractedQuestions,
} from './mcqParser';

test('parseMcqText extracts bilingual English and Hindi questions, options, answers, and explanations', () => {
  const result = parseMcqText(SAMPLE_BILINGUAL_MCQS);
  assert.equal(result.questions.length, 3);
  assert.equal(result.stats.withAnswersCount, 3);
  assert.equal(result.stats.withExplanationsCount, 3);

  // Q1 (English + Hindi)
  assert.ok(result.questions[0].questionText.includes('electric current'));
  assert.equal(result.questions[0].options[1], 'Ampere (एम्पियर)');
  assert.equal(result.questions[0].correctOption, 1);
  assert.ok(result.questions[0].explanation?.includes('Amperes'));

  // Q2 (Hindi Devanagari प्रश्न + अ/ब/स/द)
  assert.ok(result.questions[1].questionText.includes('भारत का संविधान'));
  assert.equal(result.questions[1].options[2], '26 जनवरी 1950');
  assert.equal(result.questions[1].correctOption, 2);
  assert.ok(result.questions[1].explanation?.includes('26 जनवरी 1950'));

  // Q3 (Inline single-line options)
  assert.deepEqual(result.questions[2].options, ['3', '4', '5', '6']);
  assert.equal(result.questions[2].correctOption, 2);
});

test('parseMcqText resolves trailing Answer Key block when inline answers are omitted', () => {
  const raw = `
1. Capital of Bihar is:
A) Gaya
B) Patna
C) Bhagalpur
D) Darbhanga

2. Square root of 144 is:
A) 10
B) 11
C) 12
D) 14

Answer Key:
1-B, 2-C
`;
  const result = parseMcqText(raw);
  assert.equal(result.questions.length, 2);
  assert.equal(result.questions[0].correctOption, 1);
  assert.equal(result.questions[1].correctOption, 2);
});

test('parseMcqTextAsync parses 500 questions non-blockingly and quickly', async () => {
  const chunk = Array.from({ length: 500 }, (_, i) => {
    const num = i + 1;
    return `Q${num}. Sample question ${num}?\nA) Opt 1\nB) Opt 2\nC) Opt 3\nD) Opt 4\nAns: D`;
  }).join('\n\n');

  const start = Date.now();
  const res = await parseMcqTextAsync(chunk, 150);
  const elapsedMs = Date.now() - start;

  assert.equal(res.questions.length, 500);
  assert.equal(res.questions[499].correctOption, 3);
  assert.ok(elapsedMs < 2000, `Parser took too long: ${elapsedMs}ms`);
});

test('generateTestToken produces distinct SRSS-XXXX-XXXX tokens', () => {
  const tokens: string[] = [];
  for (let i = 0; i < 50; i += 1) {
    const token = generateTestToken(tokens);
    assert.match(token, /^SRSS-[A-Z2-9]{4}-[A-Z2-9]{4}$/);
    assert.equal(tokens.includes(token), false);
    tokens.push(token);
  }
});

test('parseMcqText strips bottom and leaked answer keys (Ans: C Ans: A, Ans:- B, उत्तर: स) cleanly out of Option D', () => {
  const raw = `
Q1. विद्युत धारा का SI मात्रक क्या है?
A) वोल्ट
B) एम्पियर
C) ओम
D) वाट
Ans: C Ans: A

Q2. भारत का राष्ट्रीय पक्षी कौन है?
(१) कबूतर
(२) मोर
(३) तोता
(४) हंस उत्तर: स

Q3. Largest state of India by area?
A) Bihar
B) Rajasthan
C) Maharashtra
D) Madhya Pradesh Ans: B Ans: D
Ans:- B
`;

  const result = parseMcqText(raw);
  assert.equal(result.questions.length, 3);

  // Q1: bottom line "Ans: C Ans: A" extracted to C (2) and NEVER appended to Option D
  assert.equal(result.questions[0].options[3], 'वाट');
  assert.equal(result.questions[0].correctOption, 2);

  // Q2: Hindi digits (१)-(४) + inline "उत्तर: स" stripped from Option D and mapped to C (2)
  assert.equal(result.questions[1].options[3], 'हंस');
  assert.equal(result.questions[1].correctOption, 2);

  // Q3: inline "Ans: B Ans: D" + bottom "Ans:- B" stripped from Option D and mapped to B (1)
  assert.equal(result.questions[2].options[3], 'Madhya Pradesh');
  assert.equal(result.questions[2].correctOption, 1);
  for (const q of result.questions) {
    for (const opt of q.options) {
      assert.equal(/(?:Ans|Answer|उत्तर)/i.test(opt), false, `Found leaked answer key in option: ${opt}`);
    }
  }
});

test('sanitizeAiExtractedQuestions + formatMcqQuestionsToCanonicalText cleans Hindi Devanagari and formats uniformly', () => {
  const sanitized = sanitizeAiExtractedQuestions([
    {
      questionNumber: 1,
      questionText: 'Q1. वि द् यु त धारा का SI मात्रक क्या है?',
      options: ['A)वोल्ट', 'B) एम्पियर', '(C) ओम', 'D) वाट Ans: C Ans: A'],
      correctOptionIndex: 1,
      explanation: 'एम्पियर SI मात्रक है।',
    },
  ]);

  assert.equal(sanitized.length, 1);
  assert.equal(sanitized[0].options[0], 'वोल्ट');
  assert.equal(sanitized[0].options[1], 'एम्पियर');
  assert.equal(sanitized[0].options[2], 'ओम');
  assert.equal(sanitized[0].options[3], 'वाट');
  assert.equal(sanitized[0].correctOption, 1);

  const formatted = formatMcqQuestionsToCanonicalText(sanitized);
  assert.ok(formatted.includes('Q1.'));
  assert.ok(formatted.includes('A) वोल्ट'));
  assert.ok(formatted.includes('D) वाट'));
  assert.ok(formatted.includes('Ans: B'));
  assert.ok(formatted.includes('Exp: एम्पियर SI मात्रक है।'));
});

