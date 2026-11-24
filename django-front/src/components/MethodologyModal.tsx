import { useEffect } from 'react';
import { X } from 'lucide-react';
import { StrategyInfo } from '@/types/backtest';

interface MethodologyModalProps {
  open: boolean;
  onClose: () => void;
  strategies: StrategyInfo[];
}

export function MethodologyModal({
  open,
  onClose,
  strategies,
}: MethodologyModalProps) {
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="methodology-title"
      onClick={onClose}
    >
      <div
        className="max-h-[86vh] w-full max-w-2xl overflow-y-auto rounded-[8px] border border-[var(--line-2)] bg-[var(--surface)] p-6 text-[var(--fg)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-[var(--line)] pb-4">
          <div>
            <p
              className="text-[11px] font-medium uppercase tracking-[0.08em]"
              style={{ color: 'var(--brand)' }}
            >
              Simulation Reference
            </p>
            <h2
              id="methodology-title"
              className="mt-1 text-[17px] font-medium text-[var(--fg)]"
            >
              Methodology &amp; execution assumptions
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close methodology dialog"
            className="inline-flex h-7 w-7 items-center justify-center rounded-[5px] text-[var(--fg-2)] transition-colors hover:bg-[var(--hover)] hover:text-[var(--fg)]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-5 space-y-6 text-[12.5px]">
          <section className="space-y-2.5">
            <h3 className="text-[12px] font-medium uppercase tracking-wider text-[var(--fg-2)]">
              Implemented strategies
            </h3>
            <div className="divide-y divide-[var(--line)] border-y border-[var(--line)]">
              {strategies.map((strategy) => (
                <div key={strategy.id} className="py-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-[var(--fg)]">
                      {strategy.name}
                    </span>
                    <span className="text-[11px] text-[var(--fg-3)]">
                      {strategy.category}
                    </span>
                  </div>
                  <p className="mt-1 leading-relaxed text-[var(--fg-2)]">
                    {strategy.description}
                  </p>
                </div>
              ))}
            </div>
          </section>

          <section className="space-y-2.5">
            <h3 className="text-[12px] font-medium uppercase tracking-wider text-[var(--fg-2)]">
              Performance metrics
            </h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="rounded-[5px] border border-[var(--line)] bg-[var(--bg)] p-3">
                <p className="font-medium text-[var(--fg)]">Total Return &amp; CAGR</p>
                <p className="mt-1 text-[12px] text-[var(--fg-3)]">
                  Cumulative return across the window alongside annualized compound growth rate.
                </p>
              </div>
              <div className="rounded-[5px] border border-[var(--line)] bg-[var(--bg)] p-3">
                <p className="font-medium text-[var(--fg)]">Max Drawdown</p>
                <p className="mt-1 text-[12px] text-[var(--fg-3)]">
                  Largest peak-to-trough percentage decline in equity during the backtest.
                </p>
              </div>
              <div className="rounded-[5px] border border-[var(--line)] bg-[var(--bg)] p-3">
                <p className="font-medium text-[var(--fg)]">Sharpe Ratio</p>
                <p className="mt-1 text-[12px] text-[var(--fg-3)]">
                  Annualized risk-adjusted return relative to equity volatility (0% risk-free rate).
                </p>
              </div>
              <div className="rounded-[5px] border border-[var(--line)] bg-[var(--bg)] p-3">
                <p className="font-medium text-[var(--fg)]">Profit Factor</p>
                <p className="mt-1 text-[12px] text-[var(--fg-3)]">
                  Gross winning profit divided by gross losing losses across closed trades.
                </p>
              </div>
            </div>
          </section>

          <section className="space-y-2">
            <h3 className="text-[12px] font-medium uppercase tracking-wider text-[var(--fg-2)]">
              Execution assumptions
            </h3>
            <ul className="list-disc space-y-1.5 pl-4 text-[12px] leading-relaxed text-[var(--fg-2)]">
              <li>
                Market data is fetched live on demand from Yahoo Finance (<code className="font-mono text-[var(--fg)]">yfinance</code>) with zero server-side database storage.
              </li>
              <li>
                Orders simulate through <code className="font-mono text-[var(--fg)]">backtesting.py</code> with 0.0% commission, zero slippage, and next-bar open fills after bar close signals.
              </li>
              <li>
                Hourly (<code className="font-mono text-[var(--fg)]">1H</code>) history on Yahoo Finance is capped at the most recent 730 days.
              </li>
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}
