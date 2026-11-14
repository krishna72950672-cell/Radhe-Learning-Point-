import React, { useEffect } from 'react';
import { Printer, X } from 'lucide-react';
import {
  DirectorSignatureSVG,
  InstitutionLogo,
  InstitutionWatermark,
  OfficialSealSVG,
} from './BrandingSVGs';
import { INSTITUTION_INFO } from '../constants/institution';
import type { Student } from '../types/exam';

interface StudentIdCardModalProps {
  student: Student | null;
  bilingualMode: boolean;
  onClose: () => void;
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return 'ST';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export const StudentIdCardModal: React.FC<StudentIdCardModalProps> = ({
  student,
  bilingualMode,
  onClose,
}) => {
  useEffect(() => {
    if (!student) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [student, onClose]);

  if (!student) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="id-card-modal-title"
      data-testid="student-id-card-modal"
    >
      <div className="bg-white border border-indigo-100 rounded-3xl max-w-xl w-full p-5 sm:p-6 shadow-2xl space-y-5">
        <div className="flex items-center justify-between gap-4 border-b border-slate-200 pb-3">
          <div>
            <h3 id="id-card-modal-title" className="text-base font-bold text-slate-900">
              {bilingualMode ? 'आधिकारिक छात्र पहचान पत्र' : 'Official Student ID Card'}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5 tabular-nums">
              ID: {student.studentId} · {student.className}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 min-h-[40px] rounded-lg bg-[#0D47A1] hover:bg-[#083275] text-white text-xs font-semibold cursor-pointer whitespace-nowrap"
            >
              <Printer className="w-3.5 h-3.5 text-[#F5DC7F]" aria-hidden="true" />
              <span>{bilingualMode ? 'प्रिंट करें' : 'Print ID Card'}</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label={bilingualMode ? 'पहचान पत्र बंद करें' : 'Close ID card preview'}
              className="p-2 min-h-[40px] min-w-[40px] inline-flex items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Printable ID Card Surface */}
        <div
          id="printable-id-card"
          className="relative border-2 border-[#0D47A1] rounded-2xl overflow-hidden bg-white shadow-md max-w-md mx-auto"
        >
          <InstitutionWatermark className="w-40 h-40 right-2 bottom-10 opacity-[0.05]" />
          {/* Card Deep Blue Header */}
          <div className="relative bg-gradient-to-r from-[#0A367E] via-[#0D47A1] to-[#1E3A8A] text-white px-4 py-3 border-b-4 border-[#D4AF37] flex items-center gap-3">
            <InstitutionLogo className="w-12 h-12 shrink-0" />
            <div className="min-w-0">
              <p className="text-[11px] font-bold text-[#F5DC7F] tracking-wide">
                {INSTITUTION_INFO.shortName} · {INSTITUTION_INFO.mottoEn}
              </p>
              <h4 className="text-[13px] font-bold leading-snug">
                {bilingualMode ? INSTITUTION_INFO.nameHi : INSTITUTION_INFO.nameEn}
              </h4>
              <p className="text-[11px] text-slate-200 tabular-nums">
                {INSTITUTION_INFO.addressEn} · {INSTITUTION_INFO.mobile}
              </p>
            </div>
          </div>

          {/* Card Body */}
          <div className="p-4 space-y-4">
            <div className="flex items-start gap-4">
              {student.photoDataUrl ? (
                <img
                  src={student.photoDataUrl}
                  alt={student.name}
                  referrerPolicy="no-referrer"
                  className="w-24 h-28 object-cover rounded-lg border-2 border-[#D4AF37] shrink-0"
                />
              ) : (
                <div className="w-24 h-28 rounded-lg border-2 border-[#D4AF37] bg-slate-100 flex items-center justify-center text-xl font-bold text-[#0D47A1] shrink-0">
                  {getInitials(student.name)}
                </div>
              )}

              <div className="min-w-0 flex-1 space-y-1.5">
                <p className="text-[11px] font-bold uppercase tracking-wider text-[#0D47A1]">
                  {bilingualMode ? 'छात्र पहचान पत्र' : 'Student Identity Card'}
                </p>
                <p className="text-lg font-bold text-slate-900 leading-tight break-words">
                  {student.name}
                </p>
                <div className="pt-1 space-y-1 text-xs text-slate-700">
                  <p className="tabular-nums">
                    <span className="font-semibold text-slate-500">
                      {bilingualMode ? 'छात्र ID:' : 'Student ID:'}
                    </span>{' '}
                    <span className="font-mono font-bold text-[#0D47A1]">
                      {student.studentId}
                    </span>
                  </p>
                  <p className="tabular-nums">
                    <span className="font-semibold text-slate-500">
                      {bilingualMode ? 'कक्षा:' : 'Class:'}
                    </span>{' '}
                    <span className="font-semibold text-slate-900">{student.className}</span>
                    <span className="mx-1.5 text-slate-300">·</span>
                    <span className="font-semibold text-slate-500">
                      {bilingualMode ? 'रोल:' : 'Roll:'}
                    </span>{' '}
                    <span className="font-semibold text-slate-900">{student.rollNumber}</span>
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-1.5 pt-3 border-t border-slate-200 text-xs">
              <div className="flex justify-between gap-2">
                <span className="text-slate-500 font-medium">
                  {bilingualMode ? 'पिता का नाम:' : "Father's Name:"}
                </span>
                <span className="font-semibold text-slate-900 text-right">
                  {student.fatherName}
                </span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-slate-500 font-medium">
                  {bilingualMode ? 'माता का नाम:' : "Mother's Name:"}
                </span>
                <span className="font-semibold text-slate-900 text-right">
                  {student.motherName}
                </span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-slate-500 font-medium">
                  {bilingualMode ? 'व्हाट्सएप मोबाइल:' : 'WhatsApp Mobile:'}
                </span>
                <span className="font-mono font-semibold text-slate-900 tabular-nums text-right">
                  {student.whatsappMobile}
                </span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-slate-500 font-medium shrink-0">
                  {bilingualMode ? 'पता:' : 'Address:'}
                </span>
                <span className="font-medium text-slate-800 text-right">
                  {student.address}
                </span>
              </div>
            </div>

            {/* Seal & Director Signature Footer */}
            <div className="pt-3 border-t border-slate-200 flex items-end justify-between gap-4">
              <OfficialSealSVG className="w-20 h-20 shrink-0" />
              <div className="flex flex-col items-center text-center">
                <DirectorSignatureSVG className="w-36 h-12" />
                <p className="text-[11px] font-bold text-slate-900 border-t border-slate-300 pt-1 px-2">
                  {bilingualMode ? INSTITUTION_INFO.directorHi : INSTITUTION_INFO.directorEn}
                </p>
                <p className="text-[10px] text-slate-500">
                  {bilingualMode ? 'निदेशक' : 'Authorized Director'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
