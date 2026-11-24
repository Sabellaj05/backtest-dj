import { useCallback, useEffect, useRef, useState } from 'react';
import { format, startOfYear, subMonths, subYears } from 'date-fns';
import { ConfigPanel, TimeframePreset } from '@/components/ConfigPanel';
import { EmptyState, QuickLaunchScenario } from '@/components/EmptyState';
import { EquityPerformanceChart } from '@/components/EquityPerformanceChart';
import { Footer } from '@/components/layout/Footer';
import {
  HealthStatus,
  Navbar,
  SectionTab,
  ThemeMode,
} from '@/components/layout/Navbar';
import { MethodologyModal } from '@/components/MethodologyModal';
import { PriceSignalChart } from '@/components/PriceSignalChart';
import { TradeHistoryTable } from '@/components/TradeHistoryTable';
import { Skeleton } from '@/components/ui/skeleton';
import { checkHealth, fetchStrategies, runBacktestApi } from '@/lib/api';
import { exportSvgToPng } from '@/lib/exportSvg';
import {
  BacktestRequest,
  BacktestResponse,
  DEFAULT_STRATEGIES,
  IntervalOption,
  StrategyInfo,
} from '@/types/backtest';

function computeDateRangeForPreset(preset: TimeframePreset): {
  start: Date;
  end: Date;
} {
  const end = new Date();
  switch (preset) {
    case '3M':
      return { start: subMonths(end, 3), end };
    case '6M':
      return { start: subMonths(end, 6), end };
    case '1Y':
      return { start: subYears(end, 1), end };
    case '2Y':
      return { start: subYears(end, 2), end };
    case 'YTD':
      return { start: startOfYear(end), end };
  }
}

function ResultsSkeleton() {
  return (
    <div className="space-y-6 px-5 py-6 sm:px-8">
      <div className="space-y-3">
        <Skeleton className="h-5 w-64 bg-[var(--surface)]" />
        <Skeleton className="h-[340px] w-full bg-[var(--surface)]" />
      </div>
      <div className="grid grid-cols-1 gap-4 border-t border-[var(--line)] pt-5 sm:grid-cols-3">
        <Skeleton className="h-16 bg-[var(--surface)]" />
        <Skeleton className="h-16 bg-[var(--surface)]" />
        <Skeleton className="h-16 bg-[var(--surface)]" />
      </div>
      <Skeleton className="h-[240px] w-full bg-[var(--surface)]" />
    </div>
  );
}

export function App() {
  const initialDates = computeDateRangeForPreset('1Y');

  const [theme, setTheme] = useState<ThemeMode>(() => {
    try {
      return localStorage.getItem('quantflow-theme') === 'light'
        ? 'light'
        : 'dark';
    } catch {
      return 'dark';
    }
  });
  const [activeTab, setActiveTab] = useState<SectionTab>('price');
  const [strategies, setStrategies] =
    useState<StrategyInfo[]>(DEFAULT_STRATEGIES);
  const [healthStatus, setHealthStatus] = useState<HealthStatus>('checking');
  const [methodologyOpen, setMethodologyOpen] = useState(false);

  const [ticker, setTicker] = useState<string>('AAPL');
  const [strategy, setStrategy] = useState<string>('sma_cross');
  const [activePreset, setActivePreset] = useState<TimeframePreset | null>('1Y');
  const [startDate, setStartDate] = useState<Date | undefined>(
    initialDates.start
  );
  const [endDate, setEndDate] = useState<Date | undefined>(initialDates.end);
  const [capital, setCapital] = useState<string>('10000');
  const [interval, setInterval] = useState<IntervalOption>('1d');

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<BacktestResponse | null>(null);

  const priceSvgRef = useRef<SVGSVGElement>(null);
  const equitySvgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (theme === 'light') {
      document.documentElement.dataset.theme = 'light';
    } else {
      delete document.documentElement.dataset.theme;
    }
    try {
      localStorage.setItem('quantflow-theme', theme);
    } catch {
      // Ignore storage access errors
    }
  }, [theme]);

  useEffect(() => {
    let active = true;

    checkHealth().then((ok) => {
      if (active) setHealthStatus(ok ? 'online' : 'offline');
    });

    fetchStrategies()
      .then((list) => {
        if (active && list.length > 0) {
          setStrategies(list);
        }
      })
      .catch(() => {
        // Fallback to built-in strategy metadata when offline
      });

    return () => {
      active = false;
    };
  }, []);

  const executeSimulation = useCallback(async (params: BacktestRequest) => {
    setError(null);
    setIsLoading(true);
    try {
      const data = await runBacktestApi(params);
      setResults(data);
      setActiveTab('price');
      setHealthStatus('online');
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'An unknown error occurred.';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleSubmit = useCallback(() => {
    const cleanTicker = ticker.trim().toUpperCase();
    const numericCapital = Number.parseFloat(capital);

    if (!cleanTicker) {
      setError('Enter a valid ticker symbol (e.g., AAPL, SPY, BTC-USD).');
      return;
    }
    if (!startDate || !endDate) {
      setError('Select both a start date and an end date.');
      return;
    }
    if (startDate >= endDate) {
      setError('Start date must be strictly before end date.');
      return;
    }
    if (!strategy) {
      setError('Select a strategy model.');
      return;
    }
    if (!Number.isFinite(numericCapital) || numericCapital < 1) {
      setError('Starting capital must be at least $1.');
      return;
    }

    executeSimulation({
      ticker: cleanTicker,
      startDate: format(startDate, 'yyyy-MM-dd'),
      endDate: format(endDate, 'yyyy-MM-dd'),
      strategy,
      interval,
      capital: numericCapital,
    });
  }, [ticker, startDate, endDate, strategy, interval, capital, executeSimulation]);

  const handleSelectPreset = (preset: TimeframePreset) => {
    const range = computeDateRangeForPreset(preset);
    setActivePreset(preset);
    setStartDate(range.start);
    setEndDate(range.end);
    setError(null);
  };

  const handleReset = () => {
    const defaults = computeDateRangeForPreset('1Y');
    setTicker('AAPL');
    setStrategy('sma_cross');
    setActivePreset('1Y');
    setStartDate(defaults.start);
    setEndDate(defaults.end);
    setCapital('10000');
    setInterval('1d');
    setError(null);
  };

  const handleQuickLaunch = (scenario: QuickLaunchScenario) => {
    const range = computeDateRangeForPreset(scenario.preset);
    setTicker(scenario.ticker);
    setStrategy(scenario.strategy);
    setActivePreset(scenario.preset);
    setStartDate(range.start);
    setEndDate(range.end);
    setInterval(scenario.interval);
    setCapital(scenario.capital);

    executeSimulation({
      ticker: scenario.ticker,
      startDate: format(range.start, 'yyyy-MM-dd'),
      endDate: format(range.end, 'yyyy-MM-dd'),
      strategy: scenario.strategy,
      interval: scenario.interval,
      capital: Number.parseFloat(scenario.capital),
    });
  };

  const handleSelectTab = (tab: SectionTab) => {
    setActiveTab(tab);
    const idMap: Record<SectionTab, string> = {
      price: 'section-price',
      equity: 'section-equity',
      executions: 'section-executions',
    };
    const el = document.getElementById(idMap[tab]);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const handleDownloadPng = () => {
    if (!results) return;
    const svg =
      activeTab === 'equity' ? equitySvgRef.current : priceSvgRef.current;
    if (!svg) return;
    const suffix = activeTab === 'equity' ? 'equity' : 'price';
    exportSvgToPng(
      svg,
      `${results.meta.ticker.toLowerCase()}-${results.meta.strategy}-${suffix}.png`
    );
  };

  return (
    <div id="top" className="flex min-h-screen flex-col bg-[var(--bg)] text-[var(--fg)]">
      <Navbar
        healthStatus={healthStatus}
        activeTab={activeTab}
        hasResults={results !== null}
        theme={theme}
        onSelectTab={handleSelectTab}
        onToggleTheme={() =>
          setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'))
        }
        onDownloadPng={handleDownloadPng}
        onOpenMethodology={() => setMethodologyOpen(true)}
      />

      <div className="grid flex-1 grid-cols-1 lg:grid-cols-[minmax(0,1fr)_284px]">
        <main className="min-w-0 bg-[var(--bg)] lg:h-[calc(100dvh-94px)] lg:overflow-y-auto">
          {isLoading ? (
            <ResultsSkeleton />
          ) : results ? (
            <div>
              <PriceSignalChart
                meta={results.meta}
                priceChart={results.price_chart}
                svgRef={priceSvgRef}
              />
              <EquityPerformanceChart
                meta={results.meta}
                metrics={results.metrics}
                equityChart={results.equity_chart}
                svgRef={equitySvgRef}
              />
              <TradeHistoryTable trades={results.trades} />
            </div>
          ) : (
            <EmptyState onQuickLaunch={handleQuickLaunch} />
          )}
        </main>

        <aside className="border-t border-[var(--line)] lg:border-l lg:border-t-0">
          <ConfigPanel
            ticker={ticker}
            onTickerChange={(val) => {
              setTicker(val);
              if (error) setError(null);
            }}
            strategy={strategy}
            onStrategyChange={(val) => {
              setStrategy(val);
              if (error) setError(null);
            }}
            strategies={strategies}
            startDate={startDate}
            onStartDateChange={(date) => {
              setActivePreset(null);
              setStartDate(date);
              if (error) setError(null);
            }}
            endDate={endDate}
            onEndDateChange={(date) => {
              setActivePreset(null);
              setEndDate(date);
              if (error) setError(null);
            }}
            activePreset={activePreset}
            onSelectPreset={handleSelectPreset}
            capital={capital}
            onCapitalChange={(val) => {
              setCapital(val);
              if (error) setError(null);
            }}
            interval={interval}
            onIntervalChange={(val) => {
              setInterval(val);
              if (error) setError(null);
            }}
            isLoading={isLoading}
            error={error}
            onReset={handleReset}
            onSubmit={handleSubmit}
          />
        </aside>
      </div>

      <Footer />

      <MethodologyModal
        open={methodologyOpen}
        onClose={() => setMethodologyOpen(false)}
        strategies={strategies}
      />
    </div>
  );
}

export default App;
