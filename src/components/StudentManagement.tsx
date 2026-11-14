import React, { useMemo, useRef, useState } from 'react';
import {
  Check,
  Copy,
  CreditCard,
  Edit3,
  ImagePlus,
  Search,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import {
  CLASS_OPTIONS,
  generateUniqueStudentId,
  normalizeClass,
  tryNormalizeClass,
} from '../utils/studentId';
import type { Student } from '../types/exam';
import { InstitutionWatermark } from './BrandingSVGs';
import { StudentIdCardModal } from './StudentIdCardModal';

interface StudentManagementProps {
  bilingualMode: boolean;
  students: Student[];
  onAddStudent: (student: Student) => void;
  onUpdateStudent: (student: Student) => void;
  onDeleteStudent: (studentRecordId: string) => void;
}

interface FormState {
  name: string;
  fatherName: string;
  motherName: string;
  className: string;
  rollNumber: string;
  whatsappMobile: string;
  address: string;
  photoDataUrl: string;
}

const INITIAL_FORM: FormState = {
  name: '',
  fatherName: '',
  motherName: '',
  className: 'Class 10',
  rollNumber: '',
  whatsappMobile: '',
  address: '',
  photoDataUrl: '',
};

type FormErrors = Partial<Record<keyof FormState, string>>;

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0 || !parts[0]) return 'ST';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

async function resizePhotoFileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read image file.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Invalid image file selected.'));
      img.onload = () => {
        const maxSide = 240;
        const scale = Math.min(maxSide / img.width, maxSide / img.height, 1);
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
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.82));
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

export const StudentManagement: React.FC<StudentManagementProps> = ({
  bilingualMode,
  students,
  onAddStudent,
  onUpdateStudent,
  onDeleteStudent,
}) => {
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [errors, setErrors] = useState<FormErrors>({});
  const [editingRecordId, setEditingRecordId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [classFilter, setClassFilter] = useState<string>('ALL');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [idCardStudent, setIdCardStudent] = useState<Student | null>(null);
  const [confirmDeleteStudent, setConfirmDeleteStudent] = useState<Student | null>(null);
  const [photoError, setPhotoError] = useState<string>('');
  const [submitFeedback, setSubmitFeedback] = useState<string>('');
  const formSectionRef = useRef<HTMLElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const validateForm = (): FormErrors => {
    const nextErrors: FormErrors = {};
    if (!form.name.trim()) {
      nextErrors.name = bilingualMode ? 'छात्र का नाम आवश्यक है' : 'Student name is required';
    }
    if (!form.fatherName.trim()) {
      nextErrors.fatherName = bilingualMode ? 'पिता का नाम आवश्यक है' : "Father's name is required";
    }
    if (!form.motherName.trim()) {
      nextErrors.motherName = bilingualMode ? 'माता का नाम आवश्यक है' : "Mother's name is required";
    }
    if (!tryNormalizeClass(form.className)) {
      nextErrors.className = bilingualMode
        ? 'मान्य कक्षा चुनें (Class 01 - Class 12)'
        : 'Select a valid class (Class 01 - Class 12)';
    }
    if (!form.rollNumber.trim()) {
      nextErrors.rollNumber = bilingualMode ? 'रोल नंबर आवश्यक है' : 'Roll number is required';
    }
    const mobileDigits = form.whatsappMobile.replace(/\D/g, '');
    if (mobileDigits.length !== 10) {
      nextErrors.whatsappMobile = bilingualMode
        ? '10 अंकों का मान्य व्हाट्सएप मोबाइल नंबर दर्ज करें'
        : 'Enter a valid 10-digit WhatsApp mobile number';
    }
    if (!form.address.trim()) {
      nextErrors.address = bilingualMode ? 'पता आवश्यक है' : 'Address is required';
    }
    return nextErrors;
  };

  const handleFieldChange = (field: keyof FormState, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => {
        const copy = { ...prev };
        delete copy[field];
        return copy;
      });
    }
    setSubmitFeedback('');
  };

  const handlePhotoChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    setPhotoError('');
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setPhotoError(
        bilingualMode ? 'कृपया केवल छवि फ़ाइल (JPG/PNG) चुनें' : 'Please upload a valid image file.',
      );
      return;
    }

    try {
      const dataUrl = await resizePhotoFileToDataUrl(file);
      setForm((prev) => ({ ...prev, photoDataUrl: dataUrl }));
    } catch {
      setPhotoError(
        bilingualMode ? 'फ़ोटो प्रोसेस करने में त्रुटि हुई' : 'Could not process selected photo.',
      );
    }
  };

  const handleResetForm = () => {
    setForm(INITIAL_FORM);
    setErrors({});
    setEditingRecordId(null);
    setPhotoError('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const validationErrors = validateForm();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      setSubmitFeedback('');
      return;
    }

    const normalizedClass = normalizeClass(form.className);
    const cleanedMobile = form.whatsappMobile.replace(/\D/g, '');
    const now = new Date().toISOString();

    if (editingRecordId) {
      const existing = students.find((s) => s.id === editingRecordId);
      if (existing) {
        const updated: Student = {
          ...existing,
          name: form.name.trim(),
          fatherName: form.fatherName.trim(),
          motherName: form.motherName.trim(),
          className: normalizedClass,
          rollNumber: form.rollNumber.trim(),
          whatsappMobile: cleanedMobile,
          address: form.address.trim(),
          photoDataUrl: form.photoDataUrl || undefined,
          updatedAt: now,
        };
        onUpdateStudent(updated);
        setSubmitFeedback(
          bilingualMode
            ? `छात्र "${updated.name}" (${updated.studentId}) का विवरण अपडेट किया गया`
            : `Updated ${updated.name} (ID: ${updated.studentId})`,
        );
        handleResetForm();
        return;
      }
    }

    const existingIds = students.map((s) => s.studentId);
    const newStudentId = generateUniqueStudentId(existingIds);

    const created: Student = {
      id: newStudentId,
      studentId: newStudentId,
      name: form.name.trim(),
      fatherName: form.fatherName.trim(),
      motherName: form.motherName.trim(),
      className: normalizedClass,
      rollNumber: form.rollNumber.trim(),
      whatsappMobile: cleanedMobile,
      address: form.address.trim(),
      photoDataUrl: form.photoDataUrl || undefined,
      createdAt: now,
      updatedAt: now,
    };

    onAddStudent(created);
    setSubmitFeedback(
      bilingualMode
        ? `नया छात्र "${created.name}" सफलतापूर्वक पंजीकृत (ID: ${created.studentId})`
        : `Registered ${created.name} with Student ID ${created.studentId}`,
    );
    handleResetForm();
  };

  const handleEditClick = (student: Student) => {
    setEditingRecordId(student.id);
    setForm({
      name: student.name,
      fatherName: student.fatherName,
      motherName: student.motherName,
      className: tryNormalizeClass(student.className) ?? 'Class 10',
      rollNumber: student.rollNumber,
      whatsappMobile: student.whatsappMobile,
      address: student.address,
      photoDataUrl: student.photoDataUrl ?? '',
    });
    setErrors({});
    setSubmitFeedback('');
    formSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleCopyId = async (studentId: string) => {
    try {
      await navigator.clipboard.writeText(studentId);
    } catch {
      // Clipboard API fallback when restricted
    }
    setCopiedId(studentId);
    window.setTimeout(() => {
      setCopiedId((current) => (current === studentId ? null : current));
    }, 1800);
  };

  const filteredStudents = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return students.filter((student) => {
      if (classFilter !== 'ALL' && student.className !== classFilter) {
        return false;
      }
      if (!query) return true;
      return (
        student.name.toLowerCase().includes(query) ||
        student.studentId.includes(query) ||
        student.rollNumber.toLowerCase().includes(query) ||
        student.fatherName.toLowerCase().includes(query) ||
        student.whatsappMobile.includes(query)
      );
    });
  }, [students, searchQuery, classFilter]);

  return (
    <div
      id="panel-students"
      role="tabpanel"
      aria-labelledby="tab-students"
      data-testid="tab-panel-students"
      className="space-y-6"
    >
      {/* Registration / Edit Form */}
      <section
        ref={formSectionRef}
        className="relative overflow-hidden bg-white border border-indigo-100 rounded-3xl shadow-xl shadow-blue-950/10"
      >
        <InstitutionWatermark className="w-44 h-44 -right-10 -top-10 opacity-[0.06]" />
        <div className="relative bg-gradient-to-r from-[#0D47A1] via-[#2563EB] to-[#4F46E5] text-white px-6 py-5 sm:px-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b-4 border-[#D4AF37]">
          <div>
            <h2 className="text-xl sm:text-2xl font-extrabold text-white">
              {editingRecordId
                ? bilingualMode
                  ? 'छात्र विवरण संपादित करें'
                  : 'Edit Student Record'
                : bilingualMode
                  ? 'नया छात्र पंजीकरण'
                  : 'Student Registration'}
            </h2>
            <p className="text-xs sm:text-sm text-blue-100 mt-1">
              {bilingualMode
                ? 'पंजीकरण पर सुरक्षित 8-अंकीय अद्वितीय छात्र ID स्वतः उत्पन्न होती है।'
                : 'Automatically generates a collision-safe 8-digit unique numeric Student ID.'}
            </p>
          </div>
          {editingRecordId && (
            <button
              type="button"
              onClick={handleResetForm}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 min-h-[40px] rounded-xl border border-white/30 bg-white/15 hover:bg-white/25 text-xs font-semibold text-white self-start sm:self-auto cursor-pointer whitespace-nowrap"
            >
              <X className="w-3.5 h-3.5" aria-hidden="true" />
              <span>{bilingualMode ? 'संपादन रद्द करें' : 'Cancel Edit'}</span>
            </button>
          )}
        </div>

        <form onSubmit={handleSubmit} noValidate className="relative p-6 sm:p-8 space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {/* Student Name */}
            <div>
              <label htmlFor="student-name" className="block text-xs font-semibold text-slate-700 mb-1.5">
                {bilingualMode ? 'छात्र का पूरा नाम *' : 'Student Name *'}
              </label>
              <input
                id="student-name"
                type="text"
                value={form.name}
                onChange={(e) => handleFieldChange('name', e.target.value)}
                placeholder={bilingualMode ? 'जैसे: आरव कुमार' : 'e.g. Aarav Kumar'}
                className="w-full px-3.5 py-2.5 min-h-[42px] rounded-lg border border-slate-300 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0D47A1] focus:border-[#0D47A1]"
              />
              {errors.name && (
                <p className="mt-1 text-xs font-medium text-red-600">{errors.name}</p>
              )}
            </div>

            {/* Father's Name */}
            <div>
              <label htmlFor="father-name" className="block text-xs font-semibold text-slate-700 mb-1.5">
                {bilingualMode ? 'पिता का नाम *' : "Father's Name *"}
              </label>
              <input
                id="father-name"
                type="text"
                value={form.fatherName}
                onChange={(e) => handleFieldChange('fatherName', e.target.value)}
                placeholder={bilingualMode ? 'जैसे: राजेश कुमार' : 'e.g. Rajesh Kumar'}
                className="w-full px-3.5 py-2.5 min-h-[42px] rounded-lg border border-slate-300 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0D47A1] focus:border-[#0D47A1]"
              />
              {errors.fatherName && (
                <p className="mt-1 text-xs font-medium text-red-600">{errors.fatherName}</p>
              )}
            </div>

            {/* Mother's Name */}
            <div>
              <label htmlFor="mother-name" className="block text-xs font-semibold text-slate-700 mb-1.5">
                {bilingualMode ? 'माता का नाम *' : "Mother's Name *"}
              </label>
              <input
                id="mother-name"
                type="text"
                value={form.motherName}
                onChange={(e) => handleFieldChange('motherName', e.target.value)}
                placeholder={bilingualMode ? 'जैसे: सुनीता देवी' : 'e.g. Sunita Devi'}
                className="w-full px-3.5 py-2.5 min-h-[42px] rounded-lg border border-slate-300 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0D47A1] focus:border-[#0D47A1]"
              />
              {errors.motherName && (
                <p className="mt-1 text-xs font-medium text-red-600">{errors.motherName}</p>
              )}
            </div>

            {/* Class Dropdown (Class 01 - Class 12) */}
            <div>
              <label htmlFor="student-class" className="block text-xs font-semibold text-slate-700 mb-1.5">
                {bilingualMode ? 'कक्षा (Class 01 - 12) *' : 'Class (Class 01 - 12) *'}
              </label>
              <select
                id="student-class"
                value={form.className}
                onChange={(e) => handleFieldChange('className', e.target.value)}
                className="w-full px-3.5 py-2.5 min-h-[42px] rounded-lg border border-slate-300 bg-white text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0D47A1] focus:border-[#0D47A1]"
              >
                {CLASS_OPTIONS.map((cls) => (
                  <option key={cls} value={cls}>
                    {cls}
                  </option>
                ))}
              </select>
              {errors.className && (
                <p className="mt-1 text-xs font-medium text-red-600">{errors.className}</p>
              )}
            </div>

            {/* Roll Number */}
            <div>
              <label htmlFor="roll-number" className="block text-xs font-semibold text-slate-700 mb-1.5">
                {bilingualMode ? 'रोल नंबर *' : 'Roll Number *'}
              </label>
              <input
                id="roll-number"
                type="text"
                value={form.rollNumber}
                onChange={(e) => handleFieldChange('rollNumber', e.target.value)}
                placeholder={bilingualMode ? 'जैसे: 101' : 'e.g. 101'}
                className="w-full px-3.5 py-2.5 min-h-[42px] rounded-lg border border-slate-300 text-sm text-slate-900 tabular-nums focus:outline-none focus:ring-2 focus:ring-[#0D47A1] focus:border-[#0D47A1]"
              />
              {errors.rollNumber && (
                <p className="mt-1 text-xs font-medium text-red-600">{errors.rollNumber}</p>
              )}
            </div>

            {/* WhatsApp Mobile */}
            <div>
              <label htmlFor="whatsapp-mobile" className="block text-xs font-semibold text-slate-700 mb-1.5">
                {bilingualMode ? 'व्हाट्सएप मोबाइल (10 अंक) *' : 'WhatsApp Mobile (10 digits) *'}
              </label>
              <input
                id="whatsapp-mobile"
                type="tel"
                inputMode="numeric"
                maxLength={14}
                value={form.whatsappMobile}
                onChange={(e) => handleFieldChange('whatsappMobile', e.target.value)}
                placeholder="9876543210"
                className="w-full px-3.5 py-2.5 min-h-[42px] rounded-lg border border-slate-300 text-sm text-slate-900 font-mono tabular-nums focus:outline-none focus:ring-2 focus:ring-[#0D47A1] focus:border-[#0D47A1]"
              />
              {errors.whatsappMobile && (
                <p className="mt-1 text-xs font-medium text-red-600">{errors.whatsappMobile}</p>
              )}
            </div>

            {/* Address */}
            <div className="md:col-span-2">
              <label htmlFor="student-address" className="block text-xs font-semibold text-slate-700 mb-1.5">
                {bilingualMode ? 'पूरा पता *' : 'Address *'}
              </label>
              <input
                id="student-address"
                type="text"
                value={form.address}
                onChange={(e) => handleFieldChange('address', e.target.value)}
                placeholder={
                  bilingualMode
                    ? 'ग्राम, पोस्ट, प्रखंड, जिला - पिनकोड'
                    : 'Village, Post, Block, District - PIN'
                }
                className="w-full px-3.5 py-2.5 min-h-[42px] rounded-lg border border-slate-300 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0D47A1] focus:border-[#0D47A1]"
              />
              {errors.address && (
                <p className="mt-1 text-xs font-medium text-red-600">{errors.address}</p>
              )}
            </div>

            {/* Photo Upload */}
            <div>
              <label htmlFor="student-photo" className="block text-xs font-semibold text-slate-700 mb-1.5">
                {bilingualMode ? 'छात्र फोटो (वैकल्पिक)' : 'Student Photo (Optional)'}
              </label>
              <div className="flex items-center gap-3">
                {form.photoDataUrl ? (
                  <img
                    src={form.photoDataUrl}
                    alt="Student preview"
                    className="w-11 h-11 rounded-lg object-cover border border-slate-300 shrink-0"
                  />
                ) : (
                  <div className="w-11 h-11 rounded-lg border border-dashed border-slate-300 bg-slate-50 flex items-center justify-center text-slate-400 shrink-0">
                    <ImagePlus className="w-5 h-5" aria-hidden="true" />
                  </div>
                )}
                <div className="flex items-center gap-2 min-w-0">
                  <input
                    ref={fileInputRef}
                    id="student-photo"
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoChange}
                    className="block w-full text-xs text-slate-600 file:mr-2 file:py-1.5 file:px-3 file:rounded-md file:border file:border-slate-300 file:text-xs file:font-semibold file:bg-white file:text-slate-700 hover:file:bg-slate-50 cursor-pointer"
                  />
                  {form.photoDataUrl && (
                    <button
                      type="button"
                      onClick={() => {
                        setForm((prev) => ({ ...prev, photoDataUrl: '' }));
                        if (fileInputRef.current) fileInputRef.current.value = '';
                      }}
                      aria-label="Remove uploaded photo"
                      className="p-1.5 rounded-md text-slate-500 hover:text-red-600 hover:bg-red-50 cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
              {photoError && (
                <p className="mt-1 text-xs font-medium text-red-600">{photoError}</p>
              )}
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-slate-100">
            <div className="text-xs font-medium text-emerald-700" role="status">
              {submitFeedback}
            </div>
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={handleResetForm}
                className="px-4 py-2.5 min-h-[42px] rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-sm font-semibold cursor-pointer whitespace-nowrap"
              >
                {bilingualMode ? 'रीसेट करें' : 'Reset'}
              </button>
              <button
                type="submit"
                className="inline-flex items-center gap-2 px-5 py-2.5 min-h-[42px] rounded-xl bg-gradient-to-r from-[#0D47A1] via-[#1D4ED8] to-[#4F46E5] hover:brightness-110 text-white text-sm font-semibold shadow-md shadow-blue-900/20 transition-all cursor-pointer whitespace-nowrap"
              >
                <UserPlus className="w-4 h-4 text-[#FDE68A]" aria-hidden="true" />
                <span>
                  {editingRecordId
                    ? bilingualMode
                      ? 'छात्र अपडेट करें'
                      : 'Update Student'
                    : bilingualMode
                      ? 'छात्र पंजीकृत करें'
                      : 'Register Student'}
                </span>
              </button>
            </div>
          </div>
        </form>
      </section>

      {/* Registered Students Directory & Card Grid */}
      <section className="relative overflow-hidden bg-white border border-indigo-100 rounded-3xl shadow-xl shadow-blue-950/10 p-6 sm:p-8 space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 pb-5 border-b border-slate-200">
          <div>
            <h3 className="text-lg font-bold text-slate-900">
              {bilingualMode ? 'पंजीकृत छात्र निर्देशिका' : 'Registered Students Directory'}
            </h3>
            <p className="text-xs sm:text-sm text-slate-500 tabular-nums mt-0.5">
              {bilingualMode
                ? `कुल ${students.length} पंजीकृत · प्रदर्शित ${filteredStudents.length}`
                : `${students.length} total registered · ${filteredStudents.length} shown`}
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <div className="relative">
              <Search
                className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                aria-hidden="true"
              />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                aria-label={bilingualMode ? 'छात्र खोजें' : 'Search students'}
                placeholder={
                  bilingualMode
                    ? 'नाम, ID, रोल या मोबाइल खोजें...'
                    : 'Search name, ID, roll, mobile...'
                }
                className="w-full sm:w-72 pl-9 pr-3.5 py-2 min-h-[40px] rounded-lg border border-slate-300 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0D47A1]"
              />
            </div>

            <select
              value={classFilter}
              onChange={(e) => setClassFilter(e.target.value)}
              aria-label={bilingualMode ? 'कक्षा के अनुसार फ़िल्टर करें' : 'Filter by class'}
              className="px-3.5 py-2 min-h-[40px] rounded-lg border border-slate-300 bg-white text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#0D47A1]"
            >
              <option value="ALL">
                {bilingualMode ? 'सभी कक्षाएं (Class 01 - 12)' : 'All Classes (01 - 12)'}
              </option>
              {CLASS_OPTIONS.map((cls) => (
                <option key={cls} value={cls}>
                  {cls}
                </option>
              ))}
            </select>
          </div>
        </div>

        {students.length === 0 ? (
          <div className="py-12 text-center space-y-2">
            <Users className="w-10 h-10 text-slate-300 mx-auto" aria-hidden="true" />
            <p className="text-base font-semibold text-slate-800">
              {bilingualMode ? 'अभी कोई छात्र पंजीकृत नहीं है' : 'No students registered yet'}
            </p>
            <p className="text-sm text-slate-500 max-w-md mx-auto">
              {bilingualMode
                ? 'ऊपर दिए गए फ़ॉर्म से पहला छात्र जोड़ें या Google Drive से पहले से सहेजा गया डेटा लाएं।'
                : 'Register your first student using the form above, or pull existing records from Google Drive.'}
            </p>
          </div>
        ) : filteredStudents.length === 0 ? (
          <div className="py-10 text-center space-y-3">
            <p className="text-sm font-semibold text-slate-700">
              {bilingualMode
                ? 'आपकी खोज से मेल खाने वाला कोई छात्र नहीं मिला।'
                : 'No students match your current search or class filter.'}
            </p>
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setClassFilter('ALL');
              }}
              className="px-4 py-2 min-h-[40px] rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 cursor-pointer"
            >
              {bilingualMode ? 'फ़िल्टर साफ़ करें' : 'Clear Filters'}
            </button>
          </div>
        ) : (
          <div
            data-testid="student-card-grid"
            className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5"
          >
            {filteredStudents.map((student) => {
              const isCopied = copiedId === student.studentId;
              return (
                <article
                  key={student.id}
                  data-testid={`student-card-${student.studentId}`}
                  className="bg-gradient-to-b from-white to-slate-50/70 border border-indigo-100 rounded-2xl p-5 flex flex-col justify-between gap-4 shadow-md shadow-blue-950/5 hover:border-blue-300 hover:shadow-lg transition-all"
                >
                  <div className="space-y-4">
                    {/* Header: Photo + Name + 8-Digit ID */}
                    <div className="flex items-start gap-3.5">
                      {student.photoDataUrl ? (
                        <img
                          src={student.photoDataUrl}
                          alt={student.name}
                          referrerPolicy="no-referrer"
                          className="w-14 h-14 rounded-lg object-cover border border-slate-200 shrink-0"
                        />
                      ) : (
                        <div className="w-14 h-14 rounded-lg bg-[#0D47A1] text-[#F5DC7F] flex items-center justify-center text-base font-bold shrink-0">
                          {getInitials(student.name)}
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <h4 className="text-base font-bold text-slate-900 truncate">
                            {student.name}
                          </h4>
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={() =>
                                onUpdateStudent({
                                  ...student,
                                  isBlocked: !student.isBlocked,
                                  blockedReason: !student.isBlocked
                                    ? 'Blocked by administrator'
                                    : undefined,
                                  updatedAt: new Date().toISOString(),
                                })
                              }
                              aria-label={
                                student.isBlocked
                                  ? `Unblock ${student.name}`
                                  : `Block ${student.name}`
                              }
                              title={
                                student.isBlocked
                                  ? bilingualMode
                                    ? 'छात्र को अनब्लॉक करें'
                                    : 'Unblock student from exams'
                                  : bilingualMode
                                    ? 'छात्र को परीक्षा से ब्लॉक करें'
                                    : 'Block student from exams'
                              }
                              className={`p-1.5 rounded-md transition-colors cursor-pointer ${
                                student.isBlocked
                                  ? 'text-red-600 bg-red-50 hover:bg-red-100'
                                  : 'text-slate-400 hover:text-amber-700 hover:bg-amber-50'
                              }`}
                            >
                              {student.isBlocked ? (
                                <ShieldCheck className="w-4 h-4" />
                              ) : (
                                <ShieldAlert className="w-4 h-4" />
                              )}
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteStudent(student)}
                              aria-label={`Delete ${student.name}`}
                              className="p-1.5 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                        <p className="text-xs text-slate-500 tabular-nums mt-0.5">
                          {student.className} · {bilingualMode ? 'रोल' : 'Roll'} {student.rollNumber}
                        </p>
                        <p className="text-xs font-mono font-bold text-[#0D47A1] tabular-nums mt-1">
                          ID: {student.studentId}
                        </p>
                        {student.isBlocked && (
                          <p
                            data-testid={`student-blocked-label-${student.studentId}`}
                            className="text-xs font-semibold text-red-700 mt-1 flex items-center gap-1"
                          >
                            <ShieldAlert className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                            <span>
                              {bilingualMode ? 'परीक्षा से अवरुद्ध (Blocked)' : 'Blocked from Exams'}
                            </span>
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Details */}
                    <dl className="grid grid-cols-1 gap-1.5 pt-3 border-t border-slate-100 text-xs">
                      <div className="flex justify-between gap-2">
                        <dt className="text-slate-500">
                          {bilingualMode ? 'पिता:' : 'Father:'}
                        </dt>
                        <dd className="font-medium text-slate-800 text-right truncate">
                          {student.fatherName}
                        </dd>
                      </div>
                      <div className="flex justify-between gap-2">
                        <dt className="text-slate-500">
                          {bilingualMode ? 'माता:' : 'Mother:'}
                        </dt>
                        <dd className="font-medium text-slate-800 text-right truncate">
                          {student.motherName}
                        </dd>
                      </div>
                      <div className="flex justify-between gap-2">
                        <dt className="text-slate-500">
                          {bilingualMode ? 'व्हाट्सएप:' : 'WhatsApp:'}
                        </dt>
                        <dd className="font-mono font-medium text-slate-800 tabular-nums text-right">
                          {student.whatsappMobile}
                        </dd>
                      </div>
                      <div className="flex justify-between gap-2">
                        <dt className="text-slate-500 shrink-0">
                          {bilingualMode ? 'पता:' : 'Address:'}
                        </dt>
                        <dd className="font-medium text-slate-700 text-right truncate">
                          {student.address}
                        </dd>
                      </div>
                    </dl>
                  </div>

                  {/* Card Actions */}
                  <div className="grid grid-cols-3 gap-2 pt-3 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => handleCopyId(student.studentId)}
                      aria-label={`Copy 8-digit ID for ${student.name}`}
                      className="inline-flex items-center justify-center gap-1.5 px-2.5 py-2 min-h-[40px] rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 transition-colors cursor-pointer whitespace-nowrap"
                    >
                      {isCopied ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" aria-hidden="true" />
                          <span className="text-emerald-700">
                            {bilingualMode ? 'कॉपी हुआ' : 'Copied'}
                          </span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5 text-slate-500 shrink-0" aria-hidden="true" />
                          <span>{bilingualMode ? 'ID कॉपी' : 'Copy ID'}</span>
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => handleEditClick(student)}
                      aria-label={`Edit details for ${student.name}`}
                      className="inline-flex items-center justify-center gap-1.5 px-2.5 py-2 min-h-[40px] rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 transition-colors cursor-pointer whitespace-nowrap"
                    >
                      <Edit3 className="w-3.5 h-3.5 text-slate-500 shrink-0" aria-hidden="true" />
                      <span>{bilingualMode ? 'संपादित' : 'Edit'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setIdCardStudent(student)}
                      aria-label={`Generate printable ID card for ${student.name}`}
                      className="inline-flex items-center justify-center gap-1.5 px-2.5 py-2 min-h-[40px] rounded-xl bg-gradient-to-r from-[#0D47A1] to-[#2563EB] hover:brightness-110 text-white text-xs font-semibold shadow-sm transition-all cursor-pointer whitespace-nowrap"
                    >
                      <CreditCard className="w-3.5 h-3.5 text-[#FDE68A] shrink-0" aria-hidden="true" />
                      <span>{bilingualMode ? 'ID कार्ड' : 'ID Card'}</span>
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {/* Printable Student ID Card Modal */}
      <StudentIdCardModal
        student={idCardStudent}
        bilingualMode={bilingualMode}
        onClose={() => setIdCardStudent(null)}
      />

      {/* Delete Confirmation Modal */}
      {confirmDeleteStudent && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-student-title"
        >
          <div className="bg-white border border-indigo-100 rounded-3xl max-w-sm w-full p-6 shadow-2xl space-y-4">
            <h4 id="delete-student-title" className="text-base font-bold text-slate-900">
              {bilingualMode ? 'छात्र हटाने की पुष्टि करें' : 'Confirm Student Deletion'}
            </h4>
            <p className="text-sm text-slate-600">
              {bilingualMode
                ? `क्या आप "${confirmDeleteStudent.name}" (ID: ${confirmDeleteStudent.studentId}) को हटाना चाहते हैं?`
                : `Remove "${confirmDeleteStudent.name}" (ID: ${confirmDeleteStudent.studentId}) from your local student registry?`}
            </p>
            <div className="flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setConfirmDeleteStudent(null)}
                className="px-4 py-2 min-h-[40px] rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 cursor-pointer"
              >
                {bilingualMode ? 'रद्द करें' : 'Cancel'}
              </button>
              <button
                type="button"
                onClick={() => {
                  onDeleteStudent(confirmDeleteStudent.id);
                  if (editingRecordId === confirmDeleteStudent.id) {
                    handleResetForm();
                  }
                  setConfirmDeleteStudent(null);
                }}
                className="px-4 py-2 min-h-[40px] rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-semibold cursor-pointer"
              >
                {bilingualMode ? 'हटाएं' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
