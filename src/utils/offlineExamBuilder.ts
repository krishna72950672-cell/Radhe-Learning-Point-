import { INSTITUTION_INFO } from '../constants/institution';
import type { InstitutionInfo, Student, Test } from '../types/exam';

export const OFFLINE_AWAY_LIMIT_MS = 5000;

function escapeHtml(value: string): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function safeSerializeForInlineScript(data: unknown): string {
  return JSON.stringify(data)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

/**
 * Generates a 100% self-contained, zero-dependency standalone HTML examination package
 * that runs completely offline in any modern browser without internet or a backend server.
 *
 * Enforces:
 * - 8-digit Student ID verification + full student profile & photo capture + local attempt lock
 * - Real-time countdown timer with auto-submit (`timer_expired`)
 * - Fullscreen enforcement (`fullscreenchange`) & back-button blocking (`popstate`)
 * - Strict 5-Second Background / Blur Rule (`visibilitychange` & `blur`):
 *   staying hidden or unfocused for > 5 seconds triggers an immediate warning pop-up,
 *   increments violation count, logs the event, and auto-submits (`violation_limit`)
 *   once `maxViolations` is reached.
 */
export async function loadInstitutionLogoDataUrl(
  src = '/assets/aistudio/square-image_781837b3.jpg',
): Promise<string | undefined> {
  if (typeof window === 'undefined' || typeof document === 'undefined') return undefined;
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const size = 128;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(undefined);
          return;
        }
        ctx.drawImage(img, 0, 0, size, size);
        resolve(canvas.toDataURL('image/jpeg', 0.85));
      } catch {
        resolve(undefined);
      }
    };
    img.onerror = () => resolve(undefined);
    img.src = src;
  });
}

export function buildStrictOnlineExamHTML(
  test: Test,
  options?: {
    bilingualMode?: boolean;
    institution?: InstitutionInfo;
    logoDataUrl?: string;
    students?: Student[];
  },
): string {
  const bilingual = Boolean(options?.bilingualMode);
  const inst = options?.institution ?? INSTITUTION_INFO;
  const embeddedStudents = (options?.students ?? []).map((s) => ({
    studentId: s.studentId,
    name: s.name,
    fatherName: s.fatherName,
    motherName: s.motherName,
    className: s.className,
    rollNumber: s.rollNumber,
    whatsappMobile: s.whatsappMobile,
    address: s.address,
    photoDataUrl: s.photoDataUrl ?? '',
  }));

  const logoHtml = options?.logoDataUrl
    ? `<img src="${escapeHtml(options.logoDataUrl)}" alt="${escapeHtml(inst.nameEn)} Logo" width="44" height="44" style="width:44px;height:44px;border-radius:9999px;object-fit:cover;border:2px solid #D4AF37;background:#06214D;flex-shrink:0;" />`
    : `<div aria-hidden="true" style="width:44px;height:44px;border-radius:9999px;border:2px solid #D4AF37;background:#083275;color:#F5DC7F;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:13px;flex-shrink:0;">RLP</div>`;

  const examPayload = {
    id: test.id,
    token: test.token,
    title: test.title,
    className: test.className,
    subject: test.subject,
    durationMinutes: test.durationMinutes,
    marksPerQuestion: test.marksPerQuestion,
    negativeMarking: test.negativeMarking,
    maxViolations: Math.max(1, test.maxViolations || 3),
    totalMarks: test.totalMarks,
    bilingualMode: bilingual,
    allowedStudentIds: Array.isArray(test.allowedStudentIds)
      ? test.allowedStudentIds.filter((id) => /^\d{8}$/.test(id))
      : [],
    students: embeddedStudents,
    institution: {
      nameEn: inst.nameEn,
      nameHi: inst.nameHi,
      shortName: inst.shortName,
      directorEn: inst.directorEn,
      directorHi: inst.directorHi,
      addressEn: inst.addressEn,
      mobile: inst.mobile,
    },
    questions: test.questions.map((q) => ({
      id: q.id,
      questionText: q.questionText,
      options: q.options,
      correctOption: q.correctOption,
      explanation: q.explanation ?? '',
      questionImage: q.questionImage ?? '',
      marks: q.marks ?? test.marksPerQuestion,
      negativeMarks: q.negativeMarks ?? test.negativeMarking,
    })),
  };

  const serializedPayload = safeSerializeForInlineScript(examPayload);
  const safeTitle = escapeHtml(test.title || 'Proctored Examination');
  const safeInstName = escapeHtml(inst.nameEn);
  const safeInstNameHi = escapeHtml(inst.nameHi);
  const safeSubject = escapeHtml(test.subject || 'Subject');
  const safeClass = escapeHtml(test.className || 'Class');
  const safeToken = escapeHtml(test.token || 'SRSS-OFFLINE');

  return `<!DOCTYPE html>
<html lang="${bilingual ? 'hi' : 'en'}">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${safeTitle} | ${safeInstName}</title>
  <style>
    :root {
      --brand-blue: #0D47A1;
      --brand-blue-dark: #083275;
      --brand-gold: #D4AF37;
      --brand-gold-soft: #FEF9E7;
      --bg-slate: #F8FAFC;
      --border: #E2E8F0;
      --text-main: #0F172A;
      --text-muted: #475569;
      --danger: #B91C1C;
      --danger-bg: #FEF2F2;
      --success: #047857;
      --success-bg: #ECFDF5;
    }
    * { box-sizing: border-box; }
    html, body {
      margin: 0;
      padding: 0;
      background: var(--bg-slate);
      color: var(--text-main);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Noto Sans Devanagari", Arial, sans-serif;
      line-height: 1.5;
      -webkit-font-smoothing: antialiased;
    }
    .topbar {
      background: linear-gradient(135deg, #0D47A1 0%, #1D4ED8 60%, #312E81 100%);
      color: #FFFFFF;
      border-bottom: 4px solid var(--brand-gold);
      padding: 14px 20px;
      box-shadow: 0 10px 25px rgba(13, 71, 161, 0.22);
    }
    .topbar-inner {
      max-width: 1120px;
      margin: 0 auto;
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
    }
    .brand-row {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .brand-title {
      font-size: 16px;
      font-weight: 800;
      letter-spacing: 0.01em;
    }
    .brand-sub {
      font-size: 12px;
      color: #DBEAFE;
    }
    .status-row {
      display: flex;
      align-items: center;
      gap: 12px;
      flex-wrap: wrap;
    }
    .stat-chip {
      background: rgba(255,255,255,0.14);
      border: 1px solid rgba(255,255,255,0.24);
      padding: 6px 12px;
      border-radius: 12px;
      font-size: 13px;
      font-weight: 700;
      font-variant-numeric: tabular-nums;
    }
    .stat-chip.warn {
      background: #991B1B;
      border-color: #FCA5A5;
      color: #FFFFFF;
    }
    .container {
      max-width: 1120px;
      margin: 24px auto;
      padding: 0 16px 40px;
    }
    .card {
      position: relative;
      overflow: hidden;
      background: #FFFFFF;
      border: 1px solid var(--border);
      border-radius: 22px;
      padding: 24px;
      box-shadow: 0 14px 36px rgba(15, 23, 42, 0.07);
    }
    .verify-watermark {
      position: absolute;
      right: -24px;
      top: -24px;
      width: 170px;
      height: 170px;
      opacity: 0.06;
      pointer-events: none;
      border-radius: 9999px;
    }
    .grid-2 {
      display: grid;
      grid-template-columns: 1fr;
      gap: 20px;
    }
    @media (min-width: 900px) {
      .exam-layout {
        display: grid;
        grid-template-columns: minmax(0, 1fr) 290px;
        gap: 20px;
        align-items: start;
      }
      .grid-2 {
        grid-template-columns: 1fr 1fr;
      }
    }
    h1, h2, h3 { margin: 0 0 8px; color: var(--text-main); }
    p { margin: 0 0 10px; }
    .meta-line {
      font-size: 13px;
      color: var(--text-muted);
      font-variant-numeric: tabular-nums;
    }
    .rules-box {
      background: #FFFBEB;
      border: 1px solid #FDE68A;
      border-radius: 10px;
      padding: 14px 16px;
      margin: 16px 0;
      font-size: 13px;
      color: #78350F;
    }
    .rules-box ul {
      margin: 8px 0 0;
      padding-left: 18px;
    }
    .rules-box li { margin-bottom: 4px; }
    label {
      display: block;
      font-size: 12px;
      font-weight: 700;
      color: #334155;
      margin-bottom: 6px;
    }
    input[type="text"] {
      width: 100%;
      padding: 10px 12px;
      min-height: 44px;
      border: 1px solid #CBD5E1;
      border-radius: 8px;
      font-size: 14px;
      color: var(--text-main);
    }
    input[type="text"]:focus {
      outline: 2px solid var(--brand-blue);
      border-color: var(--brand-blue);
    }
    .btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      padding: 10px 18px;
      min-height: 42px;
      border-radius: 8px;
      border: 1px solid transparent;
      font-size: 14px;
      font-weight: 700;
      cursor: pointer;
      transition: background-color 0.15s ease;
    }
    .btn:disabled { opacity: 0.5; cursor: not-allowed; }
    .btn-primary {
      background: var(--brand-blue);
      color: #FFFFFF;
    }
    .btn-primary:hover:not(:disabled) { background: var(--brand-blue-dark); }
    .btn-secondary {
      background: #FFFFFF;
      border-color: #CBD5E1;
      color: #1E293B;
    }
    .btn-secondary:hover:not(:disabled) { background: #F1F5F9; }
    .btn-danger {
      background: var(--danger);
      color: #FFFFFF;
    }
    .btn-danger:hover:not(:disabled) { background: #991B1B; }
    .error-msg {
      margin-top: 10px;
      padding: 10px 12px;
      border-radius: 8px;
      background: var(--danger-bg);
      border: 1px solid #FECACA;
      color: var(--danger);
      font-size: 13px;
      font-weight: 600;
    }
    .away-banner {
      background: #7F1D1D;
      color: #FFFFFF;
      padding: 10px 16px;
      font-size: 13px;
      font-weight: 700;
      text-align: center;
      font-variant-numeric: tabular-nums;
    }
    .q-title {
      font-size: 17px;
      font-weight: 700;
      color: var(--text-main);
      white-space: pre-wrap;
      margin: 10px 0 14px;
    }
    .q-diagram {
      max-width: 100%;
      max-height: 280px;
      border: 1px solid var(--border);
      border-radius: 8px;
      margin-bottom: 14px;
      display: block;
    }
    .option-btn {
      width: 100%;
      text-align: left;
      display: flex;
      align-items: flex-start;
      gap: 12px;
      padding: 12px 14px;
      border-radius: 10px;
      border: 1px solid #CBD5E1;
      background: #FFFFFF;
      color: var(--text-main);
      font-size: 14px;
      cursor: pointer;
      margin-bottom: 10px;
    }
    .option-btn:hover { background: #F8FAFC; }
    .option-btn.selected {
      border-color: var(--brand-blue);
      background: #EFF6FF;
      font-weight: 600;
    }
    .opt-letter {
      width: 26px;
      height: 26px;
      border-radius: 6px;
      border: 1px solid #94A3B8;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-weight: 800;
      font-size: 12px;
      flex-shrink: 0;
    }
    .option-btn.selected .opt-letter {
      background: var(--brand-blue);
      border-color: var(--brand-blue);
      color: #FFFFFF;
    }
    .palette-grid {
      display: grid;
      grid-template-columns: repeat(5, minmax(0, 1fr));
      gap: 8px;
      margin-top: 12px;
    }
    .pal-btn {
      height: 38px;
      border-radius: 7px;
      border: 1px solid #CBD5E1;
      background: #FFFFFF;
      font-size: 13px;
      font-weight: 700;
      cursor: pointer;
      font-variant-numeric: tabular-nums;
    }
    .pal-btn.answered {
      background: #ECFDF5;
      border-color: #6EE7B7;
      color: #065F46;
    }
    .pal-btn.current {
      background: var(--brand-blue);
      border-color: var(--brand-blue);
      color: #FFFFFF;
    }
    .modal-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(15, 23, 42, 0.72);
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 16px;
      z-index: 9999;
    }
    .modal-box {
      background: #FFFFFF;
      border-radius: 12px;
      max-width: 460px;
      width: 100%;
      padding: 24px;
      border: 2px solid #DC2626;
      box-shadow: 0 20px 50px rgba(0, 0, 0, 0.35);
    }
    .hidden { display: none !important; }
    .summary-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
      gap: 14px;
      margin: 18px 0;
      font-variant-numeric: tabular-nums;
    }
    .summary-item {
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 12px;
      background: #F8FAFC;
    }
    .summary-label { font-size: 11px; font-weight: 700; color: var(--text-muted); text-transform: uppercase; }
    .summary-val { font-size: 22px; font-weight: 800; color: var(--text-main); margin-top: 4px; }
    .log-list {
      border-top: 1px solid var(--border);
      padding-top: 12px;
      margin-top: 14px;
      font-size: 12px;
      color: var(--text-muted);
    }
    .log-list li { margin-bottom: 4px; }
    @media print {
      .no-print { display: none !important; }
      body { background: #FFFFFF; }
    }
  </style>
</head>
<body>
  <header class="topbar">
    <div class="topbar-inner">
      <div class="brand-row">
        ${logoHtml}
        <div>
          <div class="brand-title">${safeInstName}</div>
          <div class="brand-sub">${safeInstNameHi} · Offline Proctored Exam (${safeToken})</div>
        </div>
      </div>

      <div id="live-status-bar" class="status-row hidden">
        <div id="timer-chip" class="stat-chip" data-testid="offline-timer">00:00</div>
        <div id="violation-chip" class="stat-chip" data-testid="offline-violations">Warnings: 0 / ${Math.max(1, test.maxViolations || 3)}</div>
      </div>
    </div>
  </header>

  <div id="away-countdown-banner" class="away-banner hidden" role="status"></div>

  <main class="container">
    <!-- 1. Verification Screen -->
    <section id="screen-verify" class="card">
      ${options?.logoDataUrl ? `<img src="${escapeHtml(options.logoDataUrl)}" alt="" aria-hidden="true" class="verify-watermark" />` : ''}
      <p class="meta-line">${safeClass} · ${safeSubject} · Token: ${safeToken}</p>
      <h1>${safeTitle}</h1>
      <p class="meta-line">
        Questions: <strong>${test.questions.length}</strong> · Total Marks: <strong>${test.totalMarks}</strong> · Duration: <strong>${test.durationMinutes} min</strong> · Max Anti-Cheat Warnings: <strong>${Math.max(1, test.maxViolations || 3)}</strong>
      </p>
      ${Array.isArray(test.allowedStudentIds) && test.allowedStudentIds.length > 0 ? `<div class="error-msg" style="background:#EEF2FF;border-color:#C7D2FE;color:#1E3A8A;margin-bottom:14px;">Restricted Exam: Only authorized Student ID(s) (${escapeHtml(test.allowedStudentIds.join(', '))}) can verify and take this exam.</div>` : ''}

      <div class="rules-box">
        <strong>Ultra-Strict Offline Proctoring Rules (100% Offline Mode):</strong>
        <ul>
          <li><strong>5-Second Tab/Focus Rule:</strong> Switching tabs, minimizing the browser, or losing window focus for more than <strong>5 seconds</strong> triggers an immediate anti-cheat warning pop-up and logs a violation.</li>
          <li><strong>Fullscreen Enforcement:</strong> Exiting fullscreen mode or pressing the browser Back button records a violation immediately.</li>
          <li><strong>Auto-Submit Threshold:</strong> Reaching ${Math.max(1, test.maxViolations || 3)} warning(s) immediately auto-submits your exam (<code>violation_limit</code>).</li>
          <li><strong>Single Attempt Lock:</strong> Once submitted on this device, re-opening this file will prevent duplicate attempts for the same Student ID.</li>
        </ul>
      </div>

      <form id="verify-form" novalidate>
        <div class="grid-2">
          <div>
            <label for="student-id-input">8-Digit Student ID *</label>
            <input id="student-id-input" type="text" maxlength="8" inputmode="numeric" placeholder="e.g. 26014829" autocomplete="off" />
          </div>
          <div>
            <label for="student-name-input">Student Full Name *</label>
            <input id="student-name-input" type="text" placeholder="Enter your full name" autocomplete="off" />
          </div>
          <div>
            <label for="student-father-input">Father's Name *</label>
            <input id="student-father-input" type="text" placeholder="Enter father's name" autocomplete="off" />
          </div>
          <div>
            <label for="student-mother-input">Mother's Name *</label>
            <input id="student-mother-input" type="text" placeholder="Enter mother's name" autocomplete="off" />
          </div>
          <div>
            <label for="student-class-input">Class *</label>
            <input id="student-class-input" type="text" value="${safeClass}" placeholder="e.g. Class 10" autocomplete="off" />
          </div>
          <div>
            <label for="student-roll-input">Roll Number *</label>
            <input id="student-roll-input" type="text" placeholder="e.g. 15" autocomplete="off" />
          </div>
          <div>
            <label for="student-mobile-input">WhatsApp Mobile *</label>
            <input id="student-mobile-input" type="text" maxlength="15" inputmode="tel" placeholder="10-digit WhatsApp mobile" autocomplete="off" />
          </div>
          <div>
            <label for="student-address-input">Full Address *</label>
            <input id="student-address-input" type="text" placeholder="Village / Town / Pin" autocomplete="off" />
          </div>
        </div>

        <div style="margin-top: 16px; display:flex; align-items:center; gap:14px; flex-wrap:wrap; border:1px solid var(--border); border-radius:10px; padding:12px 14px; background:#F8FAFC;">
          <img id="student-photo-preview" class="hidden" alt="Student Photo Preview" style="width:68px; height:82px; object-fit:cover; border-radius:8px; border:2px solid #D4AF37;" />
          <div id="student-photo-empty" style="width:68px; height:82px; border-radius:8px; border:2px dashed #CBD5E1; background:#FFFFFF; display:flex; align-items:center; justify-content:center; font-size:11px; color:#64748B; text-align:center; padding:4px;">Photo</div>
          <div>
            <label for="student-photo-input" style="margin-bottom:4px;">Student Passport Photo (Included in Result &amp; Marksheet)</label>
            <input id="student-photo-input" type="file" accept="image/*" style="font-size:13px;" />
            <div id="student-autofill-note" class="meta-line" style="margin-top:4px; color:#047857; font-weight:600;"></div>
          </div>
        </div>

        <div id="verify-error" class="error-msg hidden" role="alert"></div>
        <div style="margin-top: 18px; display: flex; gap: 12px; flex-wrap: wrap;">
          <button type="submit" id="start-exam-btn" class="btn btn-primary" data-testid="offline-start-btn">
            Enter Fullscreen &amp; Start Exam
          </button>
        </div>
      </form>
    </section>

    <!-- 2. Live Exam Screen -->
    <section id="screen-exam" class="hidden">
      <div class="exam-layout">
        <div class="card">
          <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid var(--border); padding-bottom:10px; gap:10px; flex-wrap:wrap;">
            <span id="q-counter" class="meta-line" style="font-weight:700; color:#0D47A1;">Question 1</span>
            <div style="display:flex; align-items:center; gap:8px;">
              <img id="student-badge-photo" class="hidden" alt="Student" style="width:32px; height:32px; border-radius:6px; object-fit:cover; border:1px solid #D4AF37;" />
              <span id="student-badge" class="meta-line"></span>
            </div>
          </div>

          <div id="q-text" class="q-title"></div>
          <img id="q-image" class="q-diagram hidden" alt="Question diagram" />
          <div id="options-container"></div>

          <div style="display:flex; justify-content:space-between; align-items:center; gap:10px; flex-wrap:wrap; border-top:1px solid var(--border); padding-top:16px; margin-top:12px;">
            <div style="display:flex; gap:8px;">
              <button type="button" id="prev-btn" class="btn btn-secondary">Previous</button>
              <button type="button" id="clear-btn" class="btn btn-secondary">Clear</button>
              <button type="button" id="next-btn" class="btn btn-secondary">Next</button>
            </div>
            <button type="button" id="submit-btn" class="btn btn-primary" data-testid="offline-submit-btn">
              Submit Exam
            </button>
          </div>
        </div>

        <aside class="card">
          <h3 style="font-size:15px;">Question Palette</h3>
          <p id="palette-summary" class="meta-line">0 answered</p>
          <div id="palette-grid" class="palette-grid"></div>
        </aside>
      </div>
    </section>

    <!-- 3. Submitted Scorecard Screen -->
    <section id="screen-result" class="card hidden" data-testid="offline-result-screen">
      <p class="meta-line">${safeInstName} · Offline Examination Receipt</p>
      <h2 id="result-heading">Examination Submitted</h2>
      <p id="result-reason-line" class="meta-line"></p>

      <div id="result-student-profile" style="display:flex; gap:16px; align-items:flex-start; flex-wrap:wrap; border:1px solid var(--border); border-radius:10px; padding:14px; background:#F8FAFC; margin:14px 0;"></div>

      <div class="summary-grid" id="result-summary-grid"></div>

      <div id="result-actions" class="no-print" style="display:flex; gap:10px; flex-wrap:wrap; margin-top:14px;">
        <button type="button" id="download-receipt-btn" class="btn btn-primary">Download Result Receipt (.json)</button>
        <button type="button" id="copy-receipt-btn" class="btn btn-secondary">Copy Result Receipt JSON</button>
        <button type="button" id="print-receipt-btn" class="btn btn-secondary">Print Scorecard</button>
      </div>

      <div id="violation-history-box" class="log-list hidden">
        <strong>Anti-Cheat Activity Log:</strong>
        <ul id="violation-history-list"></ul>
      </div>
    </section>
  </main>

  <!-- Anti-Cheat Immediate Warning Pop-up Modal -->
  <div id="warning-modal" class="modal-backdrop hidden" role="alertdialog" aria-modal="true" data-testid="offline-warning-modal">
    <div class="modal-box">
      <h2 style="color:#B91C1C; font-size:18px;">Anti-Cheat Warning Recorded</h2>
      <p id="warning-modal-msg" style="font-size:14px; color:#1E293B; margin-top:8px;"></p>
      <p id="warning-modal-count" style="font-size:13px; font-weight:700; color:#991B1B;"></p>
      <div style="margin-top:16px; display:flex; justify-content:flex-end; gap:10px;">
        <button type="button" id="ack-warning-btn" class="btn btn-danger" data-testid="ack-warning-btn">
          Resume Exam
        </button>
      </div>
    </div>
  </div>

  <!-- Manual Submit Confirmation Modal -->
  <div id="confirm-submit-modal" class="modal-backdrop hidden" role="dialog" aria-modal="true">
    <div class="modal-box" style="border-color:#0D47A1;">
      <h2 style="font-size:18px;">Confirm Final Submission</h2>
      <p id="confirm-submit-summary" style="font-size:14px; color:#334155; margin-top:8px;"></p>
      <div style="margin-top:16px; display:flex; justify-content:flex-end; gap:10px;">
        <button type="button" id="cancel-submit-btn" class="btn btn-secondary">Continue Exam</button>
        <button type="button" id="confirm-submit-btn" class="btn btn-primary">Yes, Submit Now</button>
      </div>
    </div>
  </div>

  <script>
    (function () {
      var EXAM = ${serializedPayload};
      var AWAY_LIMIT_MS = ${OFFLINE_AWAY_LIMIT_MS};
      var OPT_LETTERS = ['A', 'B', 'C', 'D'];

      var state = {
        studentId: '',
        studentName: '',
        fatherName: '',
        motherName: '',
        className: EXAM.className || '',
        rollNumber: '',
        whatsappMobile: '',
        address: '',
        photoDataUrl: '',
        startedAtMs: 0,
        remainingSeconds: Math.max(1, (EXAM.durationMinutes || 30) * 60),
        currentIndex: 0,
        answers: {},
        warnings: 0,
        violationLogs: [],
        active: false,
        submitted: false,
        submittedReason: 'manual',
        awayStartMs: null,
        awayMonitorTimer: null,
        countdownTimer: null
      };

      var els = {
        verifyScreen: document.getElementById('screen-verify'),
        examScreen: document.getElementById('screen-exam'),
        resultScreen: document.getElementById('screen-result'),
        statusBar: document.getElementById('live-status-bar'),
        timerChip: document.getElementById('timer-chip'),
        violationChip: document.getElementById('violation-chip'),
        awayBanner: document.getElementById('away-countdown-banner'),
        verifyForm: document.getElementById('verify-form'),
        studentIdInput: document.getElementById('student-id-input'),
        studentNameInput: document.getElementById('student-name-input'),
        studentFatherInput: document.getElementById('student-father-input'),
        studentMotherInput: document.getElementById('student-mother-input'),
        studentClassInput: document.getElementById('student-class-input'),
        studentRollInput: document.getElementById('student-roll-input'),
        studentMobileInput: document.getElementById('student-mobile-input'),
        studentAddressInput: document.getElementById('student-address-input'),
        studentPhotoInput: document.getElementById('student-photo-input'),
        studentPhotoPreview: document.getElementById('student-photo-preview'),
        studentPhotoEmpty: document.getElementById('student-photo-empty'),
        studentAutofillNote: document.getElementById('student-autofill-note'),
        verifyError: document.getElementById('verify-error'),
        qCounter: document.getElementById('q-counter'),
        studentBadge: document.getElementById('student-badge'),
        studentBadgePhoto: document.getElementById('student-badge-photo'),
        qText: document.getElementById('q-text'),
        qImage: document.getElementById('q-image'),
        optionsContainer: document.getElementById('options-container'),
        paletteSummary: document.getElementById('palette-summary'),
        paletteGrid: document.getElementById('palette-grid'),
        prevBtn: document.getElementById('prev-btn'),
        nextBtn: document.getElementById('next-btn'),
        clearBtn: document.getElementById('clear-btn'),
        submitBtn: document.getElementById('submit-btn'),
        warningModal: document.getElementById('warning-modal'),
        warningModalMsg: document.getElementById('warning-modal-msg'),
        warningModalCount: document.getElementById('warning-modal-count'),
        ackWarningBtn: document.getElementById('ack-warning-btn'),
        confirmModal: document.getElementById('confirm-submit-modal'),
        confirmSummary: document.getElementById('confirm-submit-summary'),
        cancelSubmitBtn: document.getElementById('cancel-submit-btn'),
        confirmSubmitBtn: document.getElementById('confirm-submit-btn'),
        resultHeading: document.getElementById('result-heading'),
        resultReasonLine: document.getElementById('result-reason-line'),
        resultStudentProfile: document.getElementById('result-student-profile'),
        resultSummaryGrid: document.getElementById('result-summary-grid'),
        violationHistoryBox: document.getElementById('violation-history-box'),
        violationHistoryList: document.getElementById('violation-history-list'),
        downloadReceiptBtn: document.getElementById('download-receipt-btn'),
        copyReceiptBtn: document.getElementById('copy-receipt-btn'),
        printReceiptBtn: document.getElementById('print-receipt-btn')
      };

      function attemptStorageKey(studentId) {
        return 'SRSS_OFFLINE_ATTEMPT_' + EXAM.token + '_' + studentId;
      }

      function formatClock(totalSeconds) {
        var s = Math.max(0, Math.floor(totalSeconds));
        var hrs = Math.floor(s / 3600);
        var mins = Math.floor((s % 3600) / 60);
        var secs = s % 60;
        var pad = function (n) { return n < 10 ? '0' + n : String(n); };
        if (hrs > 0) return pad(hrs) + ':' + pad(mins) + ':' + pad(secs);
        return pad(mins) + ':' + pad(secs);
      }

      function tryRequestFullscreen() {
        try {
          var el = document.documentElement;
          if (!document.fullscreenElement && el && el.requestFullscreen) {
            var p = el.requestFullscreen();
            if (p && typeof p.catch === 'function') p.catch(function () {});
          }
        } catch (e) {}
      }

      function showVerifyError(msg) {
        els.verifyError.textContent = msg;
        els.verifyError.classList.remove('hidden');
      }

      function updateStatusHeader() {
        els.timerChip.textContent = formatClock(state.remainingSeconds);
        els.violationChip.textContent = 'Warnings: ' + state.warnings + ' / ' + EXAM.maxViolations;
        if (state.warnings > 0) {
          els.violationChip.classList.add('warn');
        }
      }

      function renderQuestion() {
        var questions = EXAM.questions;
        if (!questions || questions.length === 0) return;
        var idx = Math.max(0, Math.min(state.currentIndex, questions.length - 1));
        state.currentIndex = idx;
        var q = questions[idx];

        els.qCounter.textContent = 'Question ' + (idx + 1) + ' of ' + questions.length;
        els.studentBadge.textContent = state.studentName + ' (ID: ' + state.studentId + ' · Roll ' + state.rollNumber + ')';
        if (state.photoDataUrl) {
          els.studentBadgePhoto.src = state.photoDataUrl;
          els.studentBadgePhoto.classList.remove('hidden');
        } else {
          els.studentBadgePhoto.classList.add('hidden');
        }
        els.qText.textContent = q.questionText || '';

        if (q.questionImage) {
          els.qImage.src = q.questionImage;
          els.qImage.classList.remove('hidden');
        } else {
          els.qImage.removeAttribute('src');
          els.qImage.classList.add('hidden');
        }

        els.optionsContainer.innerHTML = '';
        var selected = Object.prototype.hasOwnProperty.call(state.answers, q.id)
          ? state.answers[q.id]
          : null;

        for (var i = 0; i < 4; i++) {
          (function (optIndex) {
            var btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'option-btn' + (selected === optIndex ? ' selected' : '');
            btn.setAttribute('data-option-index', String(optIndex));

            var badge = document.createElement('span');
            badge.className = 'opt-letter';
            badge.textContent = OPT_LETTERS[optIndex];

            var labelSpan = document.createElement('span');
            labelSpan.textContent = (q.options && q.options[optIndex]) ? q.options[optIndex] : '';

            btn.appendChild(badge);
            btn.appendChild(labelSpan);
            btn.addEventListener('click', function () {
              if (!state.active || state.submitted) return;
              state.answers[q.id] = optIndex;
              renderQuestion();
            });
            els.optionsContainer.appendChild(btn);
          })(i);
        }

        els.prevBtn.disabled = idx === 0;
        els.nextBtn.disabled = idx === questions.length - 1;
        renderPalette();
      }

      function renderPalette() {
        var questions = EXAM.questions;
        els.paletteGrid.innerHTML = '';
        var answeredCount = 0;

        for (var i = 0; i < questions.length; i++) {
          var q = questions[i];
          var isAnswered =
            Object.prototype.hasOwnProperty.call(state.answers, q.id) &&
            state.answers[q.id] !== null &&
            state.answers[q.id] !== undefined;
          if (isAnswered) answeredCount++;

          (function (targetIdx) {
            var btn = document.createElement('button');
            btn.type = 'button';
            btn.textContent = String(targetIdx + 1);
            btn.className = 'pal-btn';
            if (isAnswered) btn.classList.add('answered');
            if (targetIdx === state.currentIndex) btn.classList.add('current');
            btn.addEventListener('click', function () {
              state.currentIndex = targetIdx;
              renderQuestion();
            });
            els.paletteGrid.appendChild(btn);
          })(i);
        }

        els.paletteSummary.textContent = answeredCount + ' / ' + questions.length + ' answered';
      }

      function stopBackgroundMonitor() {
        state.awayStartMs = null;
        if (state.awayMonitorTimer !== null) {
          clearInterval(state.awayMonitorTimer);
          state.awayMonitorTimer = null;
        }
        els.awayBanner.classList.add('hidden');
        els.awayBanner.textContent = '';
      }

      function recordViolation(type, message) {
        if (!state.active || state.submitted) return;
        state.warnings += 1;
        state.violationLogs.push({
          type: type,
          message: message,
          timestamp: new Date().toISOString()
        });
        updateStatusHeader();

        if (state.warnings >= EXAM.maxViolations) {
          els.warningModal.classList.add('hidden');
          finalizeAndSubmit('violation_limit');
          return;
        }

        els.warningModalMsg.textContent = message;
        els.warningModalCount.textContent =
          'Warning ' + state.warnings + ' of ' + EXAM.maxViolations +
          ' — Reaching ' + EXAM.maxViolations + ' will auto-submit your exam.';
        els.warningModal.classList.remove('hidden');
      }

      function startBackgroundAbsenceMonitor(triggerSource) {
        if (!state.active || state.submitted) return;
        if (state.awayStartMs !== null) return;

        state.awayStartMs = Date.now();
        els.awayBanner.classList.remove('hidden');
        els.awayBanner.textContent =
          'Window focus lost (' + triggerSource + '). Return within 5 seconds to avoid an anti-cheat violation.';

        state.awayMonitorTimer = setInterval(function () {
          if (!state.active || state.submitted || state.awayStartMs === null) {
            stopBackgroundMonitor();
            return;
          }
          var elapsedMs = Date.now() - state.awayStartMs;
          var elapsedSec = (elapsedMs / 1000).toFixed(1);
          els.awayBanner.textContent =
            'Away from exam window: ' + elapsedSec + 's (5.0s strict limit)';

          if (elapsedMs > AWAY_LIMIT_MS) {
            var stillHidden = document.hidden || (typeof document.hasFocus === 'function' && !document.hasFocus());
            stopBackgroundMonitor();
            recordViolation(
              triggerSource,
              'Prolonged tab switch / window blur detected (' + elapsedSec + 's away > 5s limit).'
            );
            if (stillHidden && state.active && !state.submitted) {
              // Restart timer for continued background stay
              state.awayStartMs = Date.now();
              startContinuedMonitor();
            }
          }
        }, 250);
      }

      function startContinuedMonitor() {
        if (state.awayMonitorTimer !== null) return;
        state.awayMonitorTimer = setInterval(function () {
          if (!state.active || state.submitted || state.awayStartMs === null) {
            stopBackgroundMonitor();
            return;
          }
          var elapsedMs = Date.now() - state.awayStartMs;
          if (elapsedMs > AWAY_LIMIT_MS) {
            var elapsedSec = (elapsedMs / 1000).toFixed(1);
            var stillHidden = document.hidden || (typeof document.hasFocus === 'function' && !document.hasFocus());
            stopBackgroundMonitor();
            recordViolation(
              'window_blur',
              'Continued background absence detected (' + elapsedSec + 's > 5s limit).'
            );
            if (stillHidden && state.active && !state.submitted) {
              state.awayStartMs = Date.now();
              startContinuedMonitor();
            }
          }
        }, 250);
      }

      function handleReturnToExam() {
        if (!state.active || state.submitted) return;
        if (document.hidden) return;
        if (state.awayStartMs !== null) {
          var elapsedMs = Date.now() - state.awayStartMs;
          stopBackgroundMonitor();
          if (elapsedMs > AWAY_LIMIT_MS) {
            recordViolation(
              'window_blur',
              'Returned after ' + (elapsedMs / 1000).toFixed(1) + 's away (> 5s limit).'
            );
          }
        }
      }

      function evaluateResult(reason) {
        var correctCount = 0;
        var wrongCount = 0;
        var unansweredCount = 0;
        var rawScore = 0;
        var maxMarks = 0;

        for (var i = 0; i < EXAM.questions.length; i++) {
          var q = EXAM.questions[i];
          var qMarks = Number(q.marks) > 0 ? Number(q.marks) : Number(EXAM.marksPerQuestion) || 1;
          var qNeg = Number(q.negativeMarks) >= 0 ? Number(q.negativeMarks) : Number(EXAM.negativeMarking) || 0;
          maxMarks += qMarks;

          var sel = Object.prototype.hasOwnProperty.call(state.answers, q.id) ? state.answers[q.id] : null;
          if (sel === null || sel === undefined) {
            unansweredCount += 1;
          } else if (sel === q.correctOption) {
            correctCount += 1;
            rawScore += qMarks;
          } else {
            wrongCount += 1;
            rawScore -= qNeg;
          }
        }

        var score = Math.round(rawScore * 100) / 100;
        var totalMarks = Math.round(maxMarks * 100) / 100;
        var percentage = totalMarks > 0 ? Math.round((score / totalMarks) * 10000) / 100 : 0;
        var timeTakenSeconds = Math.max(0, Math.round((Date.now() - state.startedAtMs) / 1000));

        return {
          testId: EXAM.id,
          testToken: EXAM.token,
          testTitle: EXAM.title,
          className: state.className || EXAM.className,
          subject: EXAM.subject,
          studentId: state.studentId,
          studentName: state.studentName,
          fatherName: state.fatherName,
          motherName: state.motherName,
          rollNumber: state.rollNumber,
          whatsappMobile: state.whatsappMobile,
          address: state.address,
          photoDataUrl: state.photoDataUrl || '',
          examLocationMode: 'offline_html',
          score: score,
          totalMarks: totalMarks,
          percentage: percentage,
          correctCount: correctCount,
          wrongCount: wrongCount,
          unansweredCount: unansweredCount,
          submittedReason: reason,
          violationsCount: state.warnings,
          violationLogs: state.violationLogs,
          timeTakenSeconds: timeTakenSeconds,
          answers: state.answers,
          submittedAt: new Date().toISOString()
        };
      }

      var lastSavedPayload = null;

      function setStudentPhotoPreview(dataUrl) {
        state.photoDataUrl = dataUrl || '';
        if (state.photoDataUrl) {
          els.studentPhotoPreview.src = state.photoDataUrl;
          els.studentPhotoPreview.classList.remove('hidden');
          els.studentPhotoEmpty.classList.add('hidden');
        } else {
          els.studentPhotoPreview.removeAttribute('src');
          els.studentPhotoPreview.classList.add('hidden');
          els.studentPhotoEmpty.classList.remove('hidden');
        }
      }

      function renderResultStudentProfile(result) {
        els.resultStudentProfile.innerHTML = '';
        if (result.photoDataUrl) {
          var img = document.createElement('img');
          img.src = result.photoDataUrl;
          img.alt = result.studentName || 'Student Photo';
          img.style.cssText = 'width:84px;height:100px;object-fit:cover;border-radius:8px;border:2px solid #D4AF37;flex-shrink:0;';
          els.resultStudentProfile.appendChild(img);
        } else {
          var ph = document.createElement('div');
          ph.style.cssText = 'width:84px;height:100px;border-radius:8px;border:2px solid #D4AF37;background:#FFFFFF;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:18px;color:#0D47A1;flex-shrink:0;';
          ph.textContent = (result.studentName || 'ST').slice(0, 2).toUpperCase();
          els.resultStudentProfile.appendChild(ph);
        }

        var infoWrap = document.createElement('div');
        infoWrap.style.cssText = 'flex:1;min-width:220px;display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:8px 16px;font-size:12px;';
        var fields = [
          ['Student Name', result.studentName],
          ['8-Digit Student ID', result.studentId],
          ["Father's Name", result.fatherName || '—'],
          ["Mother's Name", result.motherName || '—'],
          ['Class & Roll No', (result.className || '—') + ' · Roll ' + (result.rollNumber || '—')],
          ['WhatsApp Mobile', result.whatsappMobile || '—'],
          ['Address', result.address || '—'],
          ['Exam Mode', 'Offline Proctored HTML']
        ];
        fields.forEach(function (pair) {
          var item = document.createElement('div');
          var lbl = document.createElement('div');
          lbl.style.cssText = 'color:#64748B;font-size:11px;';
          lbl.textContent = pair[0];
          var val = document.createElement('div');
          val.style.cssText = 'color:#0F172A;font-weight:700;';
          val.textContent = pair[1];
          item.appendChild(lbl);
          item.appendChild(val);
          infoWrap.appendChild(item);
        });
        els.resultStudentProfile.appendChild(infoWrap);
      }

      function finalizeAndSubmit(reason) {
        if (state.submitted) return;
        state.submitted = true;
        state.active = false;
        state.submittedReason = reason;
        stopBackgroundMonitor();
        if (state.countdownTimer !== null) {
          clearInterval(state.countdownTimer);
          state.countdownTimer = null;
        }
        els.warningModal.classList.add('hidden');
        els.confirmModal.classList.add('hidden');

        try {
          if (document.fullscreenElement && document.exitFullscreen) {
            document.exitFullscreen().catch(function () {});
          }
        } catch (e) {}

        var result = evaluateResult(reason);
        lastSavedPayload = result;

        try {
          localStorage.setItem(attemptStorageKey(state.studentId), JSON.stringify(result));
        } catch (e) {}

        els.examScreen.classList.add('hidden');
        els.statusBar.classList.add('hidden');
        els.resultScreen.classList.remove('hidden');

        var reasonText =
          reason === 'violation_limit'
            ? 'Auto-submitted due to exceeding maximum anti-cheat violation limit (submittedReason: violation_limit).'
            : reason === 'timer_expired'
              ? 'Auto-submitted because the countdown timer expired (submittedReason: timer_expired).'
              : 'Submitted manually by student (submittedReason: manual).';

        els.resultHeading.textContent =
          reason === 'violation_limit'
            ? 'Exam Auto-Submitted (Violation Limit Reached)'
            : 'Examination Completed Successfully';
        els.resultReasonLine.textContent =
          result.studentName + ' (ID: ' + result.studentId + ') · ' + reasonText;

        renderResultStudentProfile(result);

        var cards = [
          { label: 'Score', val: result.score + ' / ' + result.totalMarks },
          { label: 'Percentage', val: result.percentage + '%' },
          { label: 'Correct', val: String(result.correctCount) },
          { label: 'Wrong', val: String(result.wrongCount) },
          { label: 'Skipped', val: String(result.unansweredCount) },
          { label: 'Warnings', val: String(result.violationsCount) }
        ];
        els.resultSummaryGrid.innerHTML = '';
        cards.forEach(function (c) {
          var box = document.createElement('div');
          box.className = 'summary-item';
          var l = document.createElement('div');
          l.className = 'summary-label';
          l.textContent = c.label;
          var v = document.createElement('div');
          v.className = 'summary-val';
          v.textContent = c.val;
          box.appendChild(l);
          box.appendChild(v);
          els.resultSummaryGrid.appendChild(box);
        });

        if (result.violationLogs.length > 0) {
          els.violationHistoryBox.classList.remove('hidden');
          els.violationHistoryList.innerHTML = '';
          result.violationLogs.forEach(function (log) {
            var li = document.createElement('li');
            li.textContent = '[' + log.type + '] ' + log.message + ' (' + log.timestamp + ')';
            els.violationHistoryList.appendChild(li);
          });
        }
      }

      // Auto-fill registered student profile & photo when 8-digit Student ID matches embedded directory
      els.studentIdInput.addEventListener('input', function () {
        var cleaned = (els.studentIdInput.value || '').replace(/\\D/g, '');
        if (cleaned.length !== 8 || !Array.isArray(EXAM.students)) {
          els.studentAutofillNote.textContent = '';
          return;
        }
        var found = null;
        for (var i = 0; i < EXAM.students.length; i++) {
          if (EXAM.students[i].studentId === cleaned) {
            found = EXAM.students[i];
            break;
          }
        }
        if (found) {
          els.studentNameInput.value = found.name || '';
          els.studentFatherInput.value = found.fatherName || '';
          els.studentMotherInput.value = found.motherName || '';
          els.studentClassInput.value = found.className || EXAM.className || '';
          els.studentRollInput.value = found.rollNumber || '';
          els.studentMobileInput.value = found.whatsappMobile || '';
          els.studentAddressInput.value = found.address || '';
          if (found.photoDataUrl) {
            setStudentPhotoPreview(found.photoDataUrl);
          }
          els.studentAutofillNote.textContent = 'Profile & photo loaded from institution directory.';
        } else {
          els.studentAutofillNote.textContent = '';
        }
      });

      // Handle student photo upload with canvas compression
      els.studentPhotoInput.addEventListener('change', function () {
        var file = els.studentPhotoInput.files && els.studentPhotoInput.files[0];
        if (!file) return;
        var reader = new FileReader();
        reader.onload = function () {
          var img = new Image();
          img.onload = function () {
            var maxW = 220;
            var maxH = 260;
            var scale = Math.min(maxW / img.width, maxH / img.height, 1);
            var w = Math.max(1, Math.round(img.width * scale));
            var h = Math.max(1, Math.round(img.height * scale));
            var canvas = document.createElement('canvas');
            canvas.width = w;
            canvas.height = h;
            var ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.fillStyle = '#FFFFFF';
              ctx.fillRect(0, 0, w, h);
              ctx.drawImage(img, 0, 0, w, h);
              setStudentPhotoPreview(canvas.toDataURL('image/jpeg', 0.84));
            } else {
              setStudentPhotoPreview(String(reader.result));
            }
          };
          img.src = String(reader.result);
        };
        reader.readAsDataURL(file);
      });

      // Attach verification form
      els.verifyForm.addEventListener('submit', function (e) {
        e.preventDefault();
        var sid = (els.studentIdInput.value || '').replace(/\\D/g, '').trim();
        var sname = (els.studentNameInput.value || '').trim();
        var sfather = (els.studentFatherInput.value || '').trim();
        var smother = (els.studentMotherInput.value || '').trim();
        var sclass = (els.studentClassInput.value || '').trim() || EXAM.className;
        var sroll = (els.studentRollInput.value || '').trim();
        var smobile = (els.studentMobileInput.value || '').replace(/\\D/g, '').trim();
        var saddress = (els.studentAddressInput.value || '').trim();

        if (!/^\\d{8}$/.test(sid)) {
          showVerifyError('Please enter a valid 8-digit Student ID.');
          return;
        }
        if (Array.isArray(EXAM.allowedStudentIds) && EXAM.allowedStudentIds.length > 0 && EXAM.allowedStudentIds.indexOf(sid) === -1) {
          showVerifyError('Access Restricted: Student ID ' + sid + ' is not authorized for this specific test.');
          return;
        }
        if (!sname || !sfather || !smother || !sroll || smobile.length < 10 || !saddress) {
          showVerifyError('Please fill all required student details (Name, Father, Mother, Roll No, 10-digit Mobile, and Address).');
          return;
        }
        try {
          var existing = localStorage.getItem(attemptStorageKey(sid));
          if (existing) {
            showVerifyError('Attempt locked: Student ID ' + sid + ' has already submitted this offline exam on this device.');
            return;
          }
        } catch (err) {}

        els.verifyError.classList.add('hidden');
        state.studentId = sid;
        state.studentName = sname;
        state.fatherName = sfather;
        state.motherName = smother;
        state.className = sclass;
        state.rollNumber = sroll;
        state.whatsappMobile = smobile;
        state.address = saddress;
        state.startedAtMs = Date.now();
        state.active = true;
        state.submitted = false;

        try {
          history.pushState({ srssOfflineExam: true }, '', window.location.href);
        } catch (err) {}

        tryRequestFullscreen();

        els.verifyScreen.classList.add('hidden');
        els.examScreen.classList.remove('hidden');
        els.statusBar.classList.remove('hidden');
        updateStatusHeader();
        renderQuestion();

        state.countdownTimer = setInterval(function () {
          if (!state.active || state.submitted) return;
          state.remainingSeconds -= 1;
          updateStatusHeader();
          if (state.remainingSeconds <= 0) {
            finalizeAndSubmit('timer_expired');
          }
        }, 1000);
      });

      // Navigation & submission controls
      els.prevBtn.addEventListener('click', function () {
        if (state.currentIndex > 0) {
          state.currentIndex -= 1;
          renderQuestion();
        }
      });
      els.nextBtn.addEventListener('click', function () {
        if (state.currentIndex < EXAM.questions.length - 1) {
          state.currentIndex += 1;
          renderQuestion();
        }
      });
      els.clearBtn.addEventListener('click', function () {
        var q = EXAM.questions[state.currentIndex];
        if (q) {
          delete state.answers[q.id];
          renderQuestion();
        }
      });
      els.submitBtn.addEventListener('click', function () {
        var answered = Object.keys(state.answers).length;
        els.confirmSummary.textContent =
          'You have answered ' + answered + ' of ' + EXAM.questions.length +
          ' questions. Once submitted, your answers cannot be edited.';
        els.confirmModal.classList.remove('hidden');
      });
      els.cancelSubmitBtn.addEventListener('click', function () {
        els.confirmModal.classList.add('hidden');
      });
      els.confirmSubmitBtn.addEventListener('click', function () {
        finalizeAndSubmit('manual');
      });
      els.ackWarningBtn.addEventListener('click', function () {
        els.warningModal.classList.add('hidden');
        tryRequestFullscreen();
      });

      // Receipt download, copy & print
      els.downloadReceiptBtn.addEventListener('click', function () {
        if (!lastSavedPayload) return;
        var blob = new Blob([JSON.stringify(lastSavedPayload, null, 2)], { type: 'application/json' });
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = 'SRSS-Result-' + lastSavedPayload.testToken + '-' + lastSavedPayload.studentId + '.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      });
      els.copyReceiptBtn.addEventListener('click', function () {
        if (!lastSavedPayload) return;
        var jsonStr = JSON.stringify(lastSavedPayload);
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(jsonStr).then(function () {
            els.copyReceiptBtn.textContent = 'Receipt JSON Copied!';
            setTimeout(function () {
              els.copyReceiptBtn.textContent = 'Copy Result Receipt JSON';
            }, 2000);
          }).catch(function () {});
        }
      });
      els.printReceiptBtn.addEventListener('click', function () {
        window.print();
      });

      // Strict Anti-Cheat Listeners (5-Second Rule + Fullscreen + Back Button + Copy Block)
      document.addEventListener('visibilitychange', function () {
        if (!state.active || state.submitted) return;
        if (document.hidden) {
          startBackgroundAbsenceMonitor('tab_switch');
        } else {
          handleReturnToExam();
        }
      });

      window.addEventListener('blur', function () {
        if (!state.active || state.submitted) return;
        startBackgroundAbsenceMonitor('window_blur');
      });

      window.addEventListener('focus', function () {
        if (!state.active || state.submitted) return;
        handleReturnToExam();
      });

      document.addEventListener('fullscreenchange', function () {
        if (!state.active || state.submitted) return;
        if (!document.fullscreenElement) {
          recordViolation('fullscreen_exit', 'Exited mandatory fullscreen examination mode.');
        }
      });

      window.addEventListener('popstate', function () {
        if (!state.active || state.submitted) return;
        try {
          history.pushState({ srssOfflineExam: true }, '', window.location.href);
        } catch (err) {}
        recordViolation('back_button', 'Attempted browser back-button navigation during active exam.');
      });

      document.addEventListener('contextmenu', function (e) {
        if (state.active && !state.submitted) e.preventDefault();
      });

      document.addEventListener('keydown', function (e) {
        if (!state.active || state.submitted) return;
        if ((e.ctrlKey || e.metaKey) && ['c', 'v', 'x', 'u', 's', 'p'].indexOf(e.key.toLowerCase()) !== -1) {
          e.preventDefault();
        }
        if (e.key === 'F12') {
          e.preventDefault();
        }
      });
    })();
  </script>
</body>
</html>`;
}
