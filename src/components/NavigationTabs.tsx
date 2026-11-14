import React from 'react';
import {
  LayoutDashboard,
  Users,
  FileQuestion,
  ClipboardCheck,
  Trophy,
} from 'lucide-react';
import { NAV_TABS, getTabLabel } from '../constants/institution';

interface NavigationTabsProps {
  selectedTab: number;
  bilingualMode: boolean;
  onSelectTab: (tabIndex: number) => void;
}

const TAB_ICONS = [
  LayoutDashboard,
  Users,
  FileQuestion,
  ClipboardCheck,
  Trophy,
] as const;

const TAB_ACCENTS = [
  'from-blue-600 to-indigo-700 shadow-blue-600/25',
  'from-emerald-600 to-teal-700 shadow-emerald-600/25',
  'from-violet-600 to-purple-700 shadow-violet-600/25',
  'from-amber-500 to-orange-600 shadow-amber-500/25',
  'from-rose-600 to-pink-700 shadow-rose-600/25',
] as const;

const MOBILE_SHORT_LABELS: Record<string, { en: string; hi: string }> = {
  dashboard: { en: 'Home', hi: 'होम' },
  students: { en: 'Students', hi: 'छात्र' },
  'question-builder': { en: 'Builder', hi: 'निर्माता' },
  'active-exams': { en: 'Exams', hi: 'परीक्षा' },
  'results-leaderboard': { en: 'Results', hi: 'परिणाम' },
};

export const NavigationTabs: React.FC<NavigationTabsProps> = ({
  selectedTab,
  bilingualMode,
  onSelectTab,
}) => {
  return (
    <>
      {/* Desktop / Tablet Top App Navigation */}
      <nav
        aria-label={bilingualMode ? 'मुख्य नेविगेशन' : 'Primary navigation'}
        className="hidden md:block sticky top-0 z-30 bg-white/85 backdrop-blur-lg border-b border-indigo-100 shadow-sm"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2">
          <div
            role="tablist"
            aria-label={bilingualMode ? 'एप्लिकेशन अनुभाग' : 'Application sections'}
            className="flex items-center gap-2 overflow-x-auto no-scrollbar"
          >
            {NAV_TABS.map((tab, idx) => {
              const Icon = TAB_ICONS[idx] ?? LayoutDashboard;
              const isActive = selectedTab === tab.index;
              const activeGradient = TAB_ACCENTS[idx] ?? TAB_ACCENTS[0];

              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  id={`tab-${tab.id}`}
                  aria-selected={isActive}
                  aria-controls={`panel-${tab.id}`}
                  onClick={() => onSelectTab(tab.index)}
                  className={`relative inline-flex items-center gap-2 px-4 py-2.5 min-h-[44px] rounded-2xl text-sm font-semibold whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0D47A1] ${
                    isActive
                      ? `bg-gradient-to-r ${activeGradient} text-white shadow-lg`
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80'
                  }`}
                >
                  <Icon
                    className={`w-4 h-4 shrink-0 ${
                      isActive ? 'text-white' : 'text-slate-500'
                    }`}
                    aria-hidden="true"
                  />
                  <span>{getTabLabel(tab, bilingualMode)}</span>
                </button>
              );
            })}
          </div>
        </div>
      </nav>

      {/* Mobile Native-App Bottom Tab Bar (< md) */}
      <nav
        aria-label={bilingualMode ? 'मोबाइल नेविगेशन' : 'Mobile bottom navigation'}
        data-testid="mobile-bottom-nav"
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-xl border-t border-indigo-100 shadow-[0_-8px_28px_rgba(13,71,161,0.12)] no-print"
      >
        <div
          role="tablist"
          aria-label={bilingualMode ? 'मोबाइल अनुभाग' : 'Mobile sections'}
          className="grid grid-cols-5 items-center px-1.5 py-1.5 gap-1"
        >
          {NAV_TABS.map((tab, idx) => {
            const Icon = TAB_ICONS[idx] ?? LayoutDashboard;
            const isActive = selectedTab === tab.index;
            const activeGradient = TAB_ACCENTS[idx] ?? TAB_ACCENTS[0];
            const mobileLabel = MOBILE_SHORT_LABELS[tab.id]
              ? bilingualMode
                ? MOBILE_SHORT_LABELS[tab.id].hi
                : MOBILE_SHORT_LABELS[tab.id].en
              : getTabLabel(tab, bilingualMode);

            return (
              <button
                key={`mobile-${tab.id}`}
                type="button"
                role="tab"
                aria-selected={isActive}
                aria-label={getTabLabel(tab, bilingualMode)}
                onClick={() => onSelectTab(tab.index)}
                className={`flex flex-col items-center justify-center min-h-[50px] px-1 py-1 rounded-2xl cursor-pointer ${
                  isActive
                    ? `bg-gradient-to-b ${activeGradient} text-white shadow-md`
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Icon className="w-5 h-5 shrink-0" aria-hidden="true" />
                <span className="text-[11px] font-bold tracking-tight mt-0.5 leading-none">
                  {mobileLabel}
                </span>
              </button>
            );
          })}
        </div>
      </nav>
    </>
  );
};

