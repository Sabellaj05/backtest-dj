export type IntervalOption = '1d' | '1h' | '1wk' | '1mo';

export interface StrategyInfo {
  id: string;
  name: string;
  short_name: string;
  category: string;
  description: string;
  indicators: string[];
}

export interface BacktestRequest {
  ticker: string;
  startDate: string;
  endDate: string;
  strategy: string;
  interval: IntervalOption;
  capital: number;
}

export interface RunMeta {
  ticker: string;
  strategy: string;
  strategy_name: string;
  start_date: string;
  end_date: string;
  interval: IntervalOption;
  initial_cash: number;
}

export interface BacktestMetrics {
  total_return_pct: number;
  cagr_pct: number;
  sharpe: number;
  max_drawdown_pct: number;
  trades: number;
  winrate_pct: number;
  final_equity: number;
  net_profit: number;
  buy_and_hold_return_pct: number;
  profit_factor: number;
  exposure_time_pct: number;
}

export interface PriceChartData {
  dates: number[];
  close: (number | null)[];
  sma1: (number | null)[];
  sma2: (number | null)[];
  buy_signals: (number | null)[];
  sell_signals: (number | null)[];
}

export interface EquityChartData {
  dates: number[];
  equity: (number | null)[];
  drawdown: (number | null)[];
}

export interface TradeRecord {
  entry_time: number | null;
  exit_time: number | null;
  side: 'LONG' | 'SHORT';
  entry_price: number;
  exit_price: number | null;
  size: number;
  pnl: number;
  return_pct: number;
}

export interface BacktestResponse {
  meta: RunMeta;
  metrics: BacktestMetrics;
  price_chart: PriceChartData;
  equity_chart: EquityChartData;
  trades: TradeRecord[];
}

export const DEFAULT_STRATEGIES: StrategyInfo[] = [
  {
    id: 'sma_cross',
    name: 'SMA Crossover (10/50)',
    short_name: 'SMA 10/50',
    category: 'Trend Following',
    description:
      'Enters long when the 10-period SMA crosses above the 50-period SMA and reverses short on downward crossover.',
    indicators: ['SMA (10)', 'SMA (50)'],
  },
  {
    id: 'la_bomba',
    name: 'Risk-Managed SMA (La Bomba)',
    short_name: 'La Bomba',
    category: 'Risk Managed',
    description:
      'SMA 10/50 crossover with 1% Stop Loss, 2% Take Profit, and automatic Break-Even stop once +1% in profit.',
    indicators: ['SMA (10)', 'SMA (50)'],
  },
  {
    id: 'buy_and_hold',
    name: 'Buy & Hold',
    short_name: 'Buy & Hold',
    category: 'Benchmark',
    description:
      'Passive benchmark that allocates full starting capital on bar 1 and holds through the end of the simulation window.',
    indicators: [],
  },
];
