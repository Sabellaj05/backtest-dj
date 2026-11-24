import { BookOpen, Download, Moon, Sun } from 'lucide-react';

export type HealthStatus = 'checking' | 'online' | 'offline';
export type SectionTab = 'price' | 'equity' | 'executions';
export type ThemeMode = 'dark' | 'light';

interface NavbarProps {
  healthStatus: HealthStatus;
  activeTab: SectionTab;
  hasResults: boolean;
  theme: ThemeMode;
  onSelectTab: (tab: SectionTab) => void;
  onToggleTheme: () => void;
  onDownloadPng: () => void;
  onOpenMethodology: () => void;
}

const NAV_TABS: { id: SectionTab; label: string }[] = [
  { id: 'price', label: 'Price & signals' },
  { id: 'equity', label: 'Equity & drawdown' },
  { id: 'executions', label: 'Executions' },
];

export function Navbar({
  healthStatus,
  activeTab,
  hasResults,
  theme,
  onSelectTab,
  onToggleTheme,
  onDownloadPng,
  onOpenMethodology,
}: NavbarProps) {
  const statusMeta = {
    checking: { dot: 'bg-amber-400 animate-pulse', label: 'Checking' },
    online: { dot: 'bg-[var(--pos)]', label: 'Online' },
    offline: { dot: 'bg-[var(--neg)]', label: 'Offline' },
  }[healthStatus];

  return (
    <header className="sticky top-0 z-40 h-[60px] w-full border-b border-[var(--line)] bg-[var(--bg)]">
      <div className="flex h-full items-center justify-between px-4 sm:px-7">
        <div className="flex h-full items-center gap-4 sm:gap-6">
          <a
            href="#top"
            onClick={(e) => {
              e.preventDefault();
              onSelectTab('price');
            }}
            className="select-none text-[22px] font-medium tracking-[-1.2px] sm:text-[24px]"
          >
            <span style={{ color: 'var(--brand)' }}>quant</span>
            <span style={{ color: 'var(--fg)' }}>flow</span>
          </a>

          <span className="hidden h-4 w-px bg-[var(--line-2)] sm:block" />

          <nav
            aria-label="Analysis sections"
            className="hidden h-full items-center gap-5 md:flex"
          >
            {NAV_TABS.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => onSelectTab(tab.id)}
                  disabled={!hasResults}
                  className="relative flex h-full items-center text-[12.5px] transition-colors disabled:cursor-default disabled:opacity-45"
                  style={{
                    color: isActive && hasResults ? 'var(--fg)' : 'var(--fg-2)',
                    fontWeight: isActive && hasResults ? 500 : 400,
                  }}
                >
                  <span>{tab.label}</span>
                  {isActive && hasResults && (
                    <span
                      className="absolute bottom-0 left-0 right-0 h-[2px] rounded-t-[2px]"
                      style={{ backgroundColor: 'var(--brand)' }}
                    />
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2">
          <div
            className="mr-1 inline-flex items-center gap-1.5 px-2 py-1 text-[11.5px] text-[var(--fg-2)]"
            title={`Backend API status: ${statusMeta.label}`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${statusMeta.dot}`} />
            <span className="hidden sm:inline">{statusMeta.label}</span>
          </div>

          <button
            type="button"
            onClick={onDownloadPng}
            disabled={!hasResults}
            title={hasResults ? 'Export active chart as PNG' : 'Run a simulation to export PNG'}
            aria-label="Export chart as PNG"
            className="inline-flex h-8 w-8 items-center justify-center rounded-[5px] text-[var(--fg-2)] transition-colors hover:bg-[var(--hover)] hover:text-[var(--fg)] disabled:cursor-not-allowed disabled:opacity-35"
          >
            <Download className="h-[15px] w-[15px]" />
          </button>

          <button
            type="button"
            onClick={onToggleTheme}
            title={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
            aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
            className="inline-flex h-8 w-8 items-center justify-center rounded-[5px] text-[var(--fg-2)] transition-colors hover:bg-[var(--hover)] hover:text-[var(--fg)]"
          >
            {theme === 'dark' ? (
              <Sun className="h-4 w-4" />
            ) : (
              <Moon className="h-4 w-4" />
            )}
          </button>

          <button
            type="button"
            onClick={onOpenMethodology}
            title="Methodology & assumptions"
            aria-label="Open methodology and assumptions"
            className="inline-flex h-8 items-center gap-1.5 rounded-[5px] px-2.5 text-[12px] font-medium text-[var(--fg-2)] transition-colors hover:bg-[var(--hover)] hover:text-[var(--fg)]"
          >
            <BookOpen className="h-[14px] w-[14px]" />
            <span className="hidden sm:inline">Methodology</span>
          </button>
        </div>
      </div>
    </header>
  );
}
