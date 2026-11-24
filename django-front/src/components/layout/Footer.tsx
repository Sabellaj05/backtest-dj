export function Footer() {
  return (
    <footer className="min-h-[34px] w-full border-t border-[var(--line)] bg-[var(--bg)] px-4 py-1.5 sm:px-7">
      <div className="flex flex-col items-center justify-between gap-1 text-[11px] text-[var(--fg-3)] sm:flex-row">
        <span>
          QuantFlow · Stateless simulation via Yahoo Finance (yfinance) &amp; backtesting.py
        </span>
        <span>
          Simulated historical performance is not indicative of future results.
        </span>
      </div>
    </footer>
  );
}
