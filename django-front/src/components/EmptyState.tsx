import { ArrowUpRight } from 'lucide-react';
import { TimeframePreset } from '@/components/ConfigPanel';
import { IntervalOption } from '@/types/backtest';

export interface QuickLaunchScenario {
  ticker: string;
  strategy: string;
  strategyLabel: string;
  preset: TimeframePreset;
  interval: IntervalOption;
  capital: string;
  note: string;
  dotColor: string;
}

const QUICK_SCENARIOS: QuickLaunchScenario[] = [
  {
    ticker: 'NVDA',
    strategy: 'sma_cross',
    strategyLabel: 'SMA Crossover (10/50)',
    preset: '1Y',
    interval: '1d',
    capital: '10000',
    note: 'Semiconductor trend-following crossover simulation',
    dotColor: 'var(--series-sma1)',
  },
  {
    ticker: 'AAPL',
    strategy: 'la_bomba',
    strategyLabel: 'Risk-Managed SMA (La Bomba)',
    preset: '1Y',
    interval: '1d',
    capital: '10000',
    note: '1% SL / 2% TP with automated break-even stop',
    dotColor: 'var(--brand)',
  },
  {
    ticker: 'SPY',
    strategy: 'buy_and_hold',
    strategyLabel: 'Buy & Hold',
    preset: '2Y',
    interval: '1d',
    capital: '25000',
    note: 'Passive S&P 500 ETF index benchmark curve',
    dotColor: 'var(--series-sma2)',
  },
];

interface EmptyStateProps {
  onQuickLaunch: (scenario: QuickLaunchScenario) => void;
}

export function EmptyState({ onQuickLaunch }: EmptyStateProps) {
  return (
    <div className="px-5 py-8 sm:px-8 sm:py-10">
      <div className="max-w-2xl">
        <p
          className="text-[11.5px] font-medium uppercase tracking-[0.08em]"
          style={{ color: 'var(--brand)' }}
        >
          Stateless Quantitative Backtester
        </p>
        <h1 className="mt-2.5 text-[28px] font-medium leading-[1.15] tracking-[-0.03em] text-[var(--fg)] sm:text-[34px]">
          Evaluate trading strategies against live historical market data.
        </h1>
        <p className="mt-3 text-[13.5px] leading-relaxed text-[var(--fg-2)]">
          Configure an asset ticker, lookback window, and strategy model in the parameter panel, or launch one of the benchmark presets below to inspect price signals, equity curves, drawdown, and trade executions.
        </p>
      </div>

      <div className="mt-8 grid grid-cols-1 gap-6 border-y border-[var(--line)] py-5 sm:grid-cols-3">
        <div>
          <p className="text-[12px] font-medium text-[var(--fg)]">
            01 · Market data
          </p>
          <p className="mt-1 text-[12px] leading-relaxed text-[var(--fg-3)]">
            Live OHLCV bars fetched on demand from Yahoo Finance across daily, weekly, monthly, and hourly intervals.
          </p>
        </div>
        <div>
          <p className="text-[12px] font-medium text-[var(--fg)]">
            02 · Signal engine
          </p>
          <p className="mt-1 text-[12px] leading-relaxed text-[var(--fg-3)]">
            Compare moving-average crossovers, stop/target risk controls, and passive Buy &amp; Hold exposure.
          </p>
        </div>
        <div>
          <p className="text-[12px] font-medium text-[var(--fg)]">
            03 · Performance breakdown
          </p>
          <p className="mt-1 text-[12px] leading-relaxed text-[var(--fg-3)]">
            Custom SVG price action, diverging equity curve vs initial capital, underwater drawdown, and trade log.
          </p>
        </div>
      </div>

      <div className="mt-7">
        <div className="flex items-center justify-between pb-3">
          <h2 className="text-[15px] font-medium text-[var(--fg)]">
            Quick launch presets
          </h2>
          <span className="text-[12px] text-[var(--fg-3)]">
            Click a row to run immediately
          </span>
        </div>

        <div className="divide-y divide-[var(--line)] border-y border-[var(--line)]">
          {QUICK_SCENARIOS.map((scenario) => (
            <button
              key={`${scenario.ticker}-${scenario.strategy}`}
              type="button"
              onClick={() => onQuickLaunch(scenario)}
              className="group flex w-full flex-col justify-between gap-2 px-2 py-3.5 text-left transition-colors hover:bg-[var(--hover)] sm:flex-row sm:items-center"
            >
              <div className="flex items-start gap-3 sm:items-center">
                <span
                  className="mt-1.5 h-2 w-2 shrink-0 rounded-full sm:mt-0"
                  style={{ backgroundColor: scenario.dotColor }}
                />
                <div>
                  <div className="flex items-center gap-2.5">
                    <span className="font-mono text-[14px] font-medium text-[var(--fg)]">
                      {scenario.ticker}
                    </span>
                    <span className="text-[13px] font-medium text-[var(--fg-2)]">
                      {scenario.strategyLabel}
                    </span>
                  </div>
                  <p className="mt-0.5 text-[12px] text-[var(--fg-3)]">
                    {scenario.note}
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between gap-4 pl-5 sm:pl-0">
                <span className="font-mono text-[11.5px] tabular-nums text-[var(--fg-3)]">
                  {scenario.preset} · {scenario.interval.toUpperCase()} · $
                  {Number(scenario.capital).toLocaleString('en-US')}
                </span>
                <ArrowUpRight className="h-4 w-4 text-[var(--fg-3)] transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-[var(--fg)]" />
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
