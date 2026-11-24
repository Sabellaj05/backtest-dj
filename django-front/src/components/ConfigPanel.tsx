import { format } from 'date-fns';
import {
  AlertCircle,
  CalendarIcon,
  Info,
  Loader2,
  RotateCcw,
  Search,
  X,
} from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { IntervalOption, StrategyInfo } from '@/types/backtest';

export type TimeframePreset = '3M' | '6M' | '1Y' | '2Y' | 'YTD';

const QUICK_TICKERS = ['AAPL', 'NVDA', 'MSFT', 'SPY', 'BTC-USD'];
const TIMEFRAME_PRESETS: TimeframePreset[] = ['3M', '6M', '1Y', '2Y', 'YTD'];
const CAPITAL_PRESETS = [
  { label: '$10k', value: '10000' },
  { label: '$25k', value: '25000' },
  { label: '$100k', value: '100000' },
];
const INTERVAL_OPTIONS: { value: IntervalOption; label: string }[] = [
  { value: '1d', label: '1D' },
  { value: '1wk', label: '1W' },
  { value: '1mo', label: '1M' },
  { value: '1h', label: '1H' },
];

const STRATEGY_DOT_COLOR: Record<string, string> = {
  sma_cross: 'var(--series-sma1)',
  la_bomba: 'var(--brand)',
  buy_and_hold: 'var(--series-sma2)',
};

interface ConfigPanelProps {
  ticker: string;
  onTickerChange: (value: string) => void;
  strategy: string;
  onStrategyChange: (value: string) => void;
  strategies: StrategyInfo[];
  startDate: Date | undefined;
  onStartDateChange: (date: Date | undefined) => void;
  endDate: Date | undefined;
  onEndDateChange: (date: Date | undefined) => void;
  activePreset: TimeframePreset | null;
  onSelectPreset: (preset: TimeframePreset) => void;
  capital: string;
  onCapitalChange: (value: string) => void;
  interval: IntervalOption;
  onIntervalChange: (value: IntervalOption) => void;
  isLoading: boolean;
  isSampleMode: boolean;
  error: string | null;
  onReset: () => void;
  onSubmit: () => void;
}

export function ConfigPanel({
  ticker,
  onTickerChange,
  strategy,
  onStrategyChange,
  strategies,
  startDate,
  onStartDateChange,
  endDate,
  onEndDateChange,
  activePreset,
  onSelectPreset,
  capital,
  onCapitalChange,
  interval,
  onIntervalChange,
  isLoading,
  isSampleMode,
  error,
  onReset,
  onSubmit,
}: ConfigPanelProps) {
  const selectedStrategy = strategies.find((s) => s.id === strategy);

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit();
  };

  return (
    <div className="bg-[var(--bg)] px-5 py-4 lg:h-[calc(100dvh-94px)] lg:overflow-y-auto">
      <div className="flex items-center justify-between pb-3.5">
        <h2 className="text-[15px] font-medium tracking-tight text-[var(--fg)]">
          Parameters
        </h2>
        <button
          type="button"
          onClick={onReset}
          title="Reset parameters"
          aria-label="Reset parameters"
          className="inline-flex h-6 w-6 items-center justify-center rounded-[5px] text-[var(--fg-3)] transition-colors hover:bg-[var(--hover)] hover:text-[var(--fg)]"
        >
          <RotateCcw className="h-[13px] w-[13px]" />
        </button>
      </div>

      <form onSubmit={handleFormSubmit} className="space-y-5">
        {/* Asset Ticker */}
        <section className="space-y-2 border-t border-[var(--line)] pt-4">
          <div className="flex items-center justify-between">
            <label
              htmlFor="ticker"
              className="text-[12px] font-medium text-[var(--fg-2)]"
            >
              Ticker
            </label>
            <span className="text-[11px] text-[var(--fg-3)]">yfinance</span>
          </div>

          <div className="relative flex items-center">
            <Search className="pointer-events-none absolute left-2.5 h-[14px] w-[14px] text-[var(--fg-3)]" />
            <input
              id="ticker"
              type="text"
              placeholder="Search symbol (AAPL)"
              value={ticker}
              onChange={(e) => onTickerChange(e.target.value.toUpperCase())}
              className="h-8 w-full rounded-[5px] border border-[var(--line-2)] bg-transparent pl-8 pr-7 font-mono text-[12.5px] font-medium uppercase text-[var(--fg)] placeholder:font-sans placeholder:normal-case placeholder:text-[var(--fg-3)] focus:border-[var(--brand)] focus:outline-none"
            />
            {ticker && (
              <button
                type="button"
                onClick={() => onTickerChange('')}
                aria-label="Clear ticker"
                className="absolute right-2 text-[var(--fg-3)] hover:text-[var(--fg)]"
              >
                <X className="h-[13px] w-[13px]" />
              </button>
            )}
          </div>

          <div className="flex flex-wrap gap-1">
            {QUICK_TICKERS.map((sym) => {
              const isActive = ticker.trim().toUpperCase() === sym;
              return (
                <button
                  key={sym}
                  type="button"
                  onClick={() => onTickerChange(sym)}
                  className={cn(
                    'rounded-[5px] px-2 py-0.5 font-mono text-[11px] transition-colors',
                    isActive
                      ? 'bg-[var(--hover)] font-medium text-[var(--fg)] ring-1 ring-[var(--line-2)]'
                      : 'text-[var(--fg-3)] hover:bg-[var(--hover)] hover:text-[var(--fg-2)]'
                  )}
                >
                  {sym}
                </button>
              );
            })}
          </div>
        </section>

        {/* Strategy Model */}
        <section className="space-y-1.5 border-t border-[var(--line)] pt-4">
          <div className="flex items-center justify-between pb-1">
            <span className="text-[12px] font-medium text-[var(--fg-2)]">
              Strategy
            </span>
            <span className="text-[11px] text-[var(--fg-3)]">
              {strategies.length} models
            </span>
          </div>

          <div className="space-y-0.5">
            {strategies.map((item) => {
              const isSelected = strategy === item.id;
              const dotColor = STRATEGY_DOT_COLOR[item.id] ?? 'var(--brand)';
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onStrategyChange(item.id)}
                  className={cn(
                    'flex w-full items-center justify-between gap-2 rounded-[5px] px-2 py-1.5 text-left text-[12.5px] transition-colors',
                    isSelected
                      ? 'bg-[var(--hover)] font-medium text-[var(--fg)]'
                      : 'text-[var(--fg-2)] hover:bg-[var(--hover)] hover:text-[var(--fg)]'
                  )}
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <span
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{ backgroundColor: dotColor }}
                    />
                    <span className="truncate">{item.short_name}</span>
                  </span>
                  <span className="shrink-0 text-[11px] text-[var(--fg-3)]">
                    {item.category}
                  </span>
                </button>
              );
            })}
          </div>

          {selectedStrategy && (
            <p className="pt-1.5 text-[11.5px] leading-relaxed text-[var(--fg-3)]">
              {selectedStrategy.description}
            </p>
          )}
        </section>

        {/* Lookback Window */}
        <section className="space-y-2.5 border-t border-[var(--line)] pt-4">
          <div className="flex items-center justify-between">
            <span className="text-[12px] font-medium text-[var(--fg-2)]">
              Window
            </span>
            <div className="flex items-center gap-2.5">
              {TIMEFRAME_PRESETS.map((preset) => {
                const isActive = activePreset === preset;
                return (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => onSelectPreset(preset)}
                    className="relative pb-1 text-[11.5px] tabular-nums transition-colors"
                    style={{
                      color: isActive ? 'var(--fg)' : 'var(--fg-3)',
                      fontWeight: isActive ? 500 : 400,
                    }}
                  >
                    {preset}
                    {isActive && (
                      <span
                        className="absolute bottom-0 left-0 right-0 h-[2px] rounded-[2px]"
                        style={{ backgroundColor: 'var(--brand)' }}
                      />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <span className="mb-1 block text-[11px] text-[var(--fg-3)]">
                Start
              </span>
              <Popover>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className="flex h-8 w-full items-center gap-1.5 rounded-[5px] border border-[var(--line-2)] bg-transparent px-2 text-left text-[11.5px] tabular-nums text-[var(--fg)] transition-colors hover:bg-[var(--hover)]"
                  >
                    <CalendarIcon className="h-3 w-3 shrink-0 text-[var(--fg-3)]" />
                    <span className="truncate">
                      {startDate ? format(startDate, 'MMM d, yyyy') : 'Select'}
                    </span>
                  </button>
                </PopoverTrigger>
                <PopoverContent
                  className="w-auto border-[var(--line-2)] bg-[var(--surface)] p-0 text-[var(--fg)]"
                  align="start"
                >
                  <Calendar
                    mode="single"
                    selected={startDate}
                    defaultMonth={startDate}
                    onSelect={onStartDateChange}
                    disabled={(date) => date > new Date()}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div>
              <span className="mb-1 block text-[11px] text-[var(--fg-3)]">
                End
              </span>
              <Popover>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className="flex h-8 w-full items-center gap-1.5 rounded-[5px] border border-[var(--line-2)] bg-transparent px-2 text-left text-[11.5px] tabular-nums text-[var(--fg)] transition-colors hover:bg-[var(--hover)]"
                  >
                    <CalendarIcon className="h-3 w-3 shrink-0 text-[var(--fg-3)]" />
                    <span className="truncate">
                      {endDate ? format(endDate, 'MMM d, yyyy') : 'Select'}
                    </span>
                  </button>
                </PopoverTrigger>
                <PopoverContent
                  className="w-auto border-[var(--line-2)] bg-[var(--surface)] p-0 text-[var(--fg)]"
                  align="end"
                >
                  <Calendar
                    mode="single"
                    selected={endDate}
                    defaultMonth={endDate}
                    onSelect={onEndDateChange}
                    disabled={(date) => date > new Date()}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>
        </section>

        {/* Capital & Interval */}
        <section className="space-y-3 border-t border-[var(--line)] pt-4">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label
                htmlFor="capital"
                className="text-[12px] font-medium text-[var(--fg-2)]"
              >
                Starting capital
              </label>
              <div className="flex items-center gap-1">
                {CAPITAL_PRESETS.map((preset) => (
                  <button
                    key={preset.value}
                    type="button"
                    onClick={() => onCapitalChange(preset.value)}
                    className={cn(
                      'rounded-[4px] px-1.5 py-0.5 text-[11px] tabular-nums transition-colors',
                      capital === preset.value
                        ? 'bg-[var(--hover)] font-medium text-[var(--fg)]'
                        : 'text-[var(--fg-3)] hover:text-[var(--fg-2)]'
                    )}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="relative flex items-center">
              <span className="pointer-events-none absolute left-2.5 text-[12px] text-[var(--fg-3)]">
                $
              </span>
              <input
                id="capital"
                type="number"
                min={1}
                step="any"
                value={capital}
                onChange={(e) => onCapitalChange(e.target.value)}
                className="h-8 w-full rounded-[5px] border border-[var(--line-2)] bg-transparent pl-6 pr-3 text-[12.5px] font-medium tabular-nums text-[var(--fg)] focus:border-[var(--brand)] focus:outline-none"
              />
            </div>
          </div>

          <div className="flex items-center justify-between pt-0.5">
            <span className="text-[12px] font-medium text-[var(--fg-2)]">
              Interval
            </span>
            <div className="flex items-center gap-3">
              {INTERVAL_OPTIONS.map((opt) => {
                const isActive = interval === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => onIntervalChange(opt.value)}
                    className="relative pb-1 text-[11.5px] transition-colors"
                    style={{
                      color: isActive ? 'var(--fg)' : 'var(--fg-3)',
                      fontWeight: isActive ? 500 : 400,
                    }}
                  >
                    {opt.label}
                    {isActive && (
                      <span
                        className="absolute bottom-0 left-0 right-0 h-[2px] rounded-[2px]"
                        style={{ backgroundColor: 'var(--brand)' }}
                      />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {interval === '1h' && (
            <p className="text-[11px] leading-snug text-[var(--fg-3)]">
              Yahoo Finance limits 1H bars to the last 730 days.
            </p>
          )}
        </section>

        {error && (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-[5px] border border-[var(--neg)]/40 bg-[var(--surface)] p-2.5 text-[12px] leading-relaxed text-[var(--neg)]"
          >
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="flex items-center gap-2">
          <button
            type="submit"
            disabled={isLoading}
            className="flex h-9 flex-1 items-center justify-center gap-2 rounded-[5px] text-[12.5px] font-medium transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            style={{
              backgroundColor: 'var(--brand)',
              color: 'var(--on-accent)',
            }}
          >
            {isLoading ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>Running simulation...</span>
              </>
            ) : (
              <span>Run backtest</span>
            )}
          </button>

          <div className="group relative flex-shrink-0">
            <button
              type="button"
              aria-label="Data source and backend setup info"
              className="flex h-9 w-9 items-center justify-center rounded-[5px] border border-[var(--line-2)] text-[var(--fg-2)] transition-colors hover:bg-[var(--hover)] hover:text-[var(--fg)] focus:outline-none focus:border-[var(--brand)]"
            >
              <Info className="h-4 w-4" />
            </button>

            <div
              role="tooltip"
              className="invisible absolute bottom-full right-0 z-30 pb-2 opacity-0 transition-opacity duration-150 group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100"
            >
              <div className="w-[248px] rounded-[8px] border border-[var(--line-2)] bg-[var(--surface)] p-3 text-[11.5px] leading-relaxed text-[var(--fg-2)]">
                <p className="font-medium text-[var(--fg)]">
                  {isSampleMode ? 'Sample showcase mode' : 'Live Django backend'}
                </p>
                <p className="mt-1">
                  {isSampleMode
                    ? 'This static demo generates deterministic sample OHLCV data in your browser. To run live Yahoo Finance backtests through the Django backend, clone and run the repository from GitHub.'
                    : 'Connected to the local Django REST API for live Yahoo Finance data. Static deployments automatically fall back to client-side sample data.'}
                </p>
                <a
                  href="https://github.com/Sabellaj05/backtest-dj"
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 inline-block font-medium underline underline-offset-2"
                  style={{ color: 'var(--brand)' }}
                >
                  github.com/Sabellaj05/backtest-dj
                </a>
              </div>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
