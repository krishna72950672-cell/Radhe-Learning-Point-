export interface InstitutionInfo {
  appNameEn: string;
  appNameHi: string;
  nameEn: string;
  nameHi: string;
  shortName: string;
  mottoEn: string;
  mottoHi: string;
  directorEn: string;
  directorHi: string;
  addressEn: string;
  addressHi: string;
  mobile: string;
  session: string;
  sealText: string;
}

export interface Student {
  id: string;
  studentId: string;
  name: string;
  nameHi?: string;
  fatherName: string;
  motherName: string;
  className: string;
  rollNumber: string;
  whatsappMobile: string;
  address: string;
  photoDataUrl?: string;
  isBlocked?: boolean;
  blockedReason?: string;
  createdAt: string;
  updatedAt: string;
}

export interface QuestionModel {
  id: string;
  subject?: string;
  questionText: string;
  options: [string, string, string, string];
  correctOption: 0 | 1 | 2 | 3;
  explanation?: string;
  questionImage?: string;
  marks?: number;
  negativeMarks?: number;
}

export type Question = QuestionModel;

export interface Test {
  id: string;
  token: string;
  title: string;
  className: string;
  subject: string;
  marksPerQuestion: number;
  negativeMarking: number;
  durationMinutes: number;
  maxViolations: number;
  totalMarks: number;
  questions: QuestionModel[];
  allowedStudentIds?: string[];
  status: 'draft' | 'active' | 'completed';
  scheduledDate?: string;
  createdAt: string;
  publishedAt: string;
}

export type SubmissionReason = 'manual' | 'timer_expired' | 'violation_limit';

export type ViolationType =
  | 'tab_switch'
  | 'window_blur'
  | 'fullscreen_exit'
  | 'back_button';

export interface ViolationEvent {
  type: ViolationType;
  message: string;
  timestamp: string;
}

export interface Result {
  id: string;
  testId: string;
  testToken?: string;
  testTitle?: string;
  subject?: string;
  className?: string;
  studentId: string;
  studentName?: string;
  fatherName?: string;
  motherName?: string;
  rollNumber?: string;
  whatsappMobile?: string;
  address?: string;
  photoDataUrl?: string;
  examLocationMode?: 'online' | 'offline_html';
  score: number;
  totalMarks: number;
  correctCount: number;
  wrongCount: number;
  unansweredCount: number;
  percentage: number;
  submissionReason?: SubmissionReason;
  violationsCount?: number;
  violationLogs?: ViolationEvent[];
  timeTakenSeconds?: number;
  answers?: Record<string, number | null>;
  submittedAt: string;
}

export type StudentResultModel = Result;

export interface NavTabConfig {
  index: number;
  id: string;
  labelEn: string;
  labelHi: string;
  descriptionEn: string;
  descriptionHi: string;
}

export interface ExamMasterPayload {
  schemaVersion: number;
  updatedAt: string;
  institution: string;
  students: Student[];
  tests: Test[];
  results: Result[];
}
