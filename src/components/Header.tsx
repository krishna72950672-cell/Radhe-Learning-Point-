import React from 'react';
import { Languages } from 'lucide-react';
import { InstitutionLogo } from './BrandingSVGs';
import { getAppTitle, getInstitutionName } from '../constants/institution';

interface HeaderProps {
  bilingualMode: boolean;
  onToggleBilingual: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  bilingualMode,
  onToggleBilingual,
}) => {
  return (
    <header className="relative overflow-hidden bg-gradient-to-r from-[#0A367E] via-[#1557C0] to-[#312E81] text-white border-b-4 border-[#D4AF37] shadow-lg shadow-blue-950/20">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-12 -top-12 w-52 h-52 rounded-full bg-[#D4AF37]/15 blur-2xl"
      />
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 sm:py-4 flex items-center justify-between gap-4 sm:gap-8">
        {/* Brand Identity Zone */}
        <div className="flex items-center gap-3 sm:gap-4 min-w-0">
          <div className="shrink-0 rounded-full p-0.5 bg-gradient-to-br from-[#F5DC7F] to-[#D4AF37] shadow-lg shadow-amber-400/20">
            <InstitutionLogo className="w-11 h-11 sm:w-14 sm:h-14 border-0" />
          </div>
          <div className="min-w-0">
            <h1 className="text-base sm:text-xl font-extrabold tracking-tight text-white truncate">
              {getAppTitle(bilingualMode)}
            </h1>
            <p className="text-xs sm:text-sm text-[#FDE68A] font-semibold truncate">
              {getInstitutionName(bilingualMode)}
            </p>
          </div>
        </div>

        {/* Primary Action: Bilingual Toggle */}
        <div className="shrink-0">
          <button
            type="button"
            onClick={onToggleBilingual}
            aria-pressed={bilingualMode}
            aria-label={
              bilingualMode
                ? 'Switch language mode to English'
                : 'भाषा मोड हिंदी में बदलें (Switch to Hindi)'
            }
            className="inline-flex items-center gap-2 px-4 py-2.5 min-h-[42px] rounded-2xl bg-white/12 hover:bg-white/20 backdrop-blur-md text-white border border-[#F5DC7F]/60 text-xs sm:text-sm font-semibold shadow-md transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F5DC7F] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0D47A1] whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Languages className="w-4 h-4 text-[#FDE68A] shrink-0" aria-hidden="true" />
            <span>{bilingualMode ? 'हिंदी / English' : 'English / हिंदी'}</span>
          </button>
        </div>
      </div>
    </header>
  );
};

