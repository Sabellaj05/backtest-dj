import {
  BacktestRequest,
  BacktestResponse,
  DEFAULT_STRATEGIES,
  IntervalOption,
  TradeRecord,
} from '@/types/backtest';

interface TickerProfile {
  startPrice: number;
  annualDrift: number;
  annualVol: number;
}

const TICKER_PROFILES: Record<string, TickerProfile> = {
  AAPL: { startPrice: 195, annualDrift: 0.18, annualVol: 0.24 },
  NVDA: { startPrice: 118, annualDrift: 0.34, annualVol: 0.44 },
  MSFT: { startPrice: 395, annualDrift: 0.16, annualVol: 0.22 },
  SPY: { startPrice: 510, annualDrift: 0.13, annualVol: 0.15 },
  'BTC-USD': { startPrice: 68000, annualDrift: 0.32, annualVol: 0.54 },
};

const STRATEGY_ALIASES: Record<string, string> = {
  SMA: 'sma_cross',
  sma_cross: 'sma_cross',
  LA_BOMBA: 'la_bomba',
  la_bomba: 'la_bomba',
  BUY_AND_HOLD: 'buy_and_hold',
  buy_and_hold: 'buy_and_hold',
};

function hashString(input: string): number {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function createMulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function sampleGaussian(rng: () => number): number {
  const u1 = Math.max(1e-7, rng());
  const u2 = rng();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

function parseUtcDate(dateStr: string): number {
  const [y, m, d] = dateStr.split('-').map(Number);
  return Date.UTC(y, (m || 1) - 1, d || 1);
}

function roundTo(val: number, decimals = 2): number {
  if (!Number.isFinite(val)) return 0;
  const factor = Math.pow(10, decimals);
  const res = Math.round(val * factor) / factor;
  return res === 0 ? 0 : res;
}

function getProfile(ticker: string): TickerProfile {
  if (TICKER_PROFILES[ticker]) return TICKER_PROFILES[ticker];
  const h = hashString(ticker);
  return {
    startPrice: 45 + (h % 240),
    annualDrift: 0.08 + ((h % 18) / 100),
    annualVol: 0.18 + (((h >>> 4) % 22) / 100),
  };
}

function generateTimestamps(
  startMs: number,
  endMs: number,
  interval: IntervalOption
): number[] {
  const timestamps: number[] = [];
  const dayMs = 86_400_000;

  if (interval === '1h') {
    const maxDays = 90;
    const effectiveStart = Math.max(startMs, endMs - maxDays * dayMs);
    for (let d = effectiveStart; d <= endMs; d += dayMs) {
      const day = new Date(d).getUTCDay();
      if (day === 0 || day === 6) continue;
      for (let hour = 10; hour <= 16; hour++) {
        timestamps.push(d + hour * 3_600_000);
      }
    }
    return timestamps.slice(-600);
  }

  if (interval === '1wk') {
    for (let d = startMs; d <= endMs; d += 7 * dayMs) {
      timestamps.push(d);
    }
    return timestamps;
  }

  if (interval === '1mo') {
    const cursor = new Date(startMs);
    while (cursor.getTime() <= endMs) {
      timestamps.push(cursor.getTime());
      cursor.setUTCMonth(cursor.getUTCMonth() + 1);
    }
    return timestamps;
  }

  // Daily ('1d'): weekdays
  for (let d = startMs; d <= endMs; d += dayMs) {
    const day = new Date(d).getUTCDay();
    if (day !== 0 && day !== 6) {
      timestamps.push(d);
    }
  }
  if (timestamps.length < 2) {
    return [startMs, endMs];
  }
  return timestamps;
}

function getPeriodsPerYear(interval: IntervalOption): number {
  switch (interval) {
    case '1h':
      return 252 * 7;
    case '1wk':
      return 52;
    case '1mo':
      return 12;
    default:
      return 252;
  }
}

function computeSma(values: number[], window: number): (number | null)[] {
  const result: (number | null)[] = new Array(values.length).fill(null);
  let runningSum = 0;
  for (let i = 0; i < values.length; i++) {
    runningSum += values[i];
    if (i >= window) {
      runningSum -= values[i - window];
    }
    if (i >= window - 1) {
      result[i] = roundTo(runningSum / window, 4);
    }
  }
  return result;
}

interface OpenPosition {
  side: 'LONG' | 'SHORT';
  size: number;
  entryPrice: number;
  entryTime: number;
  sl: number | null;
  tp: number | null;
}

export function generateSampleBacktest(
  params: BacktestRequest
): BacktestResponse {
  const ticker = params.ticker.trim().toUpperCase();
  const strategyId = STRATEGY_ALIASES[params.strategy] ?? 'sma_cross';
  const strategyMeta =
    DEFAULT_STRATEGIES.find((s) => s.id === strategyId) ?? DEFAULT_STRATEGIES[0];
  const initialCash = Math.max(1, Number(params.capital) || 10000);
  const startMs = parseUtcDate(params.startDate);
  const endMs = parseUtcDate(params.endDate);

  const dates = generateTimestamps(startMs, endMs, params.interval);
  const profile = getProfile(ticker);
  const rng = createMulberry32(hashString(`${ticker}:${params.interval}`));
  const periodsPerYear = getPeriodsPerYear(params.interval);
  const dt = 1 / periodsPerYear;

  const close: number[] = [];
  const high: number[] = [];
  const low: number[] = [];

  let price = profile.startPrice;
  for (let i = 0; i < dates.length; i++) {
    if (i > 0) {
      const z = sampleGaussian(rng);
      const drift = (profile.annualDrift - 0.5 * profile.annualVol ** 2) * dt;
      const shock = profile.annualVol * Math.sqrt(dt) * z;
      price = Math.max(0.5, price * Math.exp(drift + shock));
    }
    const barSwing = Math.max(0.004, Math.abs(sampleGaussian(rng)) * profile.annualVol * Math.sqrt(dt) * 0.75);
    const barClose = roundTo(price, 2);
    close.push(barClose);
    high.push(roundTo(barClose * (1 + barSwing), 2));
    low.push(roundTo(Math.max(0.1, barClose * (1 - barSwing)), 2));
  }

  const useSma = strategyId === 'sma_cross' || strategyId === 'la_bomba';
  const sma1 = useSma ? computeSma(close, 10) : [];
  const sma2 = useSma ? computeSma(close, 50) : [];

  const buySignals: (number | null)[] = new Array(dates.length).fill(null);
  const sellSignals: (number | null)[] = new Array(dates.length).fill(null);
  const equity: number[] = [];
  const trades: TradeRecord[] = [];

  let cash = initialCash;
  const state: { position: OpenPosition | null } = { position: null };
  let exposedBars = 0;

  const computeSize = (unitPrice: number) => {
    if (unitPrice <= 0) return 0;
    const raw = cash / unitPrice;
    if (raw >= 1) return Math.floor(raw);
    return roundTo(raw, 4);
  };

  const closePosition = (exitPrice: number, exitTime: number) => {
    const pos = state.position;
    if (!pos) return;
    const pnl =
      pos.side === 'LONG'
        ? (exitPrice - pos.entryPrice) * pos.size
        : (pos.entryPrice - exitPrice) * pos.size;
    const notional = pos.entryPrice * pos.size;
    const returnPct = notional > 0 ? (pnl / notional) * 100 : 0;

    cash += pnl;
    trades.push({
      entry_time: pos.entryTime,
      exit_time: exitTime,
      side: pos.side,
      entry_price: roundTo(pos.entryPrice, 2),
      exit_price: roundTo(exitPrice, 2),
      size: pos.size,
      pnl: roundTo(pnl, 2),
      return_pct: roundTo(returnPct, 2),
    });
    state.position = null;
  };

  const openPosition = (
    side: 'LONG' | 'SHORT',
    barIdx: number,
    withRiskControls: boolean
  ) => {
    const entryPrice = close[barIdx];
    const size = computeSize(entryPrice);
    if (size <= 0) return;

    const sl = withRiskControls
      ? side === 'LONG'
        ? entryPrice * 0.99
        : entryPrice * 1.01
      : null;
    const tp = withRiskControls
      ? side === 'LONG'
        ? entryPrice * 1.02
        : entryPrice * 0.98
      : null;

    state.position = {
      side,
      size,
      entryPrice,
      entryTime: dates[barIdx],
      sl,
      tp,
    };

    if (side === 'LONG') {
      buySignals[barIdx] = entryPrice;
    } else {
      sellSignals[barIdx] = entryPrice;
    }
  };

  for (let i = 0; i < dates.length; i++) {
    const barClose = close[i];
    const barHigh = high[i];
    const barLow = low[i];

    if (strategyId === 'buy_and_hold') {
      if (i === 0) {
        openPosition('LONG', i, false);
      }
    } else if (i > 0) {
      const openPos = state.position;
      if (strategyId === 'la_bomba' && openPos) {
        const unrealizedPct =
          openPos.side === 'LONG'
            ? barClose / openPos.entryPrice - 1
            : openPos.entryPrice / barClose - 1;
        if (unrealizedPct >= 0.01 && openPos.sl !== null) {
          if (
            (openPos.side === 'LONG' && openPos.sl < openPos.entryPrice) ||
            (openPos.side === 'SHORT' && openPos.sl > openPos.entryPrice)
          ) {
            openPos.sl = openPos.entryPrice;
          }
        }

        if (openPos.side === 'LONG') {
          if (openPos.sl !== null && barLow <= openPos.sl) {
            closePosition(openPos.sl, dates[i]);
          } else if (openPos.tp !== null && barHigh >= openPos.tp) {
            closePosition(openPos.tp, dates[i]);
          }
        } else {
          if (openPos.sl !== null && barHigh >= openPos.sl) {
            closePosition(openPos.sl, dates[i]);
          } else if (openPos.tp !== null && barLow <= openPos.tp) {
            closePosition(openPos.tp, dates[i]);
          }
        }
      }

      const prev1 = sma1[i - 1];
      const prev2 = sma2[i - 1];
      const curr1 = sma1[i];
      const curr2 = sma2[i];

      if (prev1 != null && prev2 != null && curr1 != null && curr2 != null) {
        const crossedUp = prev1 <= prev2 && curr1 > curr2;
        const crossedDown = prev1 >= prev2 && curr1 < curr2;

        if (strategyId === 'sma_cross') {
          if (crossedUp && state.position?.side !== 'LONG') {
            if (state.position) closePosition(barClose, dates[i]);
            openPosition('LONG', i, false);
          } else if (crossedDown && state.position?.side !== 'SHORT') {
            if (state.position) closePosition(barClose, dates[i]);
            openPosition('SHORT', i, false);
          }
        } else if (strategyId === 'la_bomba' && !state.position) {
          if (crossedUp) {
            openPosition('LONG', i, true);
          } else if (crossedDown) {
            openPosition('SHORT', i, true);
          }
        }
      }
    }

    if (state.position) {
      exposedBars++;
    }

    if (i === dates.length - 1 && state.position) {
      closePosition(barClose, dates[i]);
    }

    const activePos = state.position;
    const unrealized = activePos
      ? activePos.side === 'LONG'
        ? (barClose - activePos.entryPrice) * activePos.size
        : (activePos.entryPrice - barClose) * activePos.size
      : 0;
    equity.push(roundTo(Math.max(0, cash + unrealized), 2));
  }

  let peak = equity[0] ?? initialCash;
  const drawdown: number[] = equity.map((val) => {
    if (val > peak) peak = val;
    if (peak <= 0) return 0;
    return roundTo(((val - peak) / peak) * 100, 2);
  });

  const finalEquity = equity[equity.length - 1] ?? initialCash;
  const netProfit = roundTo(finalEquity - initialCash, 2);
  const totalReturnPct = roundTo(((finalEquity - initialCash) / initialCash) * 100, 2);

  const years = Math.max(7 / 365.25, (endMs - startMs) / (365.25 * 86_400_000));
  const cagrPct =
    finalEquity > 0
      ? roundTo((Math.pow(finalEquity / initialCash, 1 / years) - 1) * 100, 2)
      : -100;

  const barReturns: number[] = [];
  for (let i = 1; i < equity.length; i++) {
    if (equity[i - 1] > 0) {
      barReturns.push((equity[i] - equity[i - 1]) / equity[i - 1]);
    }
  }
  let sharpe = 0;
  if (barReturns.length > 1) {
    const mean = barReturns.reduce((a, b) => a + b, 0) / barReturns.length;
    const variance =
      barReturns.reduce((acc, r) => acc + (r - mean) ** 2, 0) /
      (barReturns.length - 1);
    const std = Math.sqrt(variance);
    if (std > 1e-9) {
      sharpe = roundTo((mean / std) * Math.sqrt(periodsPerYear), 2);
    }
  }

  const maxDrawdownPct = drawdown.length > 0 ? roundTo(Math.min(...drawdown), 2) : 0;
  const winningTrades = trades.filter((t) => t.pnl > 0);
  const losingTrades = trades.filter((t) => t.pnl < 0);
  const winratePct =
    trades.length > 0 ? roundTo((winningTrades.length / trades.length) * 100, 2) : 0;
  const grossProfit = winningTrades.reduce((acc, t) => acc + t.pnl, 0);
  const grossLoss = Math.abs(losingTrades.reduce((acc, t) => acc + t.pnl, 0));
  const profitFactor = grossLoss > 0 ? roundTo(grossProfit / grossLoss, 2) : 0;
  const exposureTimePct =
    dates.length > 0 ? roundTo((exposedBars / dates.length) * 100, 2) : 0;
  const buyAndHoldReturnPct =
    close.length >= 2 && close[0] > 0
      ? roundTo(((close[close.length - 1] - close[0]) / close[0]) * 100, 2)
      : 0;

  return {
    meta: {
      ticker,
      strategy: strategyId,
      strategy_name: strategyMeta.name,
      start_date: params.startDate,
      end_date: params.endDate,
      interval: params.interval,
      initial_cash: roundTo(initialCash, 2),
    },
    metrics: {
      total_return_pct: totalReturnPct,
      cagr_pct: cagrPct,
      sharpe,
      max_drawdown_pct: maxDrawdownPct,
      trades: trades.length,
      winrate_pct: winratePct,
      final_equity: finalEquity,
      net_profit: netProfit,
      buy_and_hold_return_pct: buyAndHoldReturnPct,
      profit_factor: profitFactor,
      exposure_time_pct: exposureTimePct,
    },
    price_chart: {
      dates,
      close,
      sma1,
      sma2,
      buy_signals: buySignals,
      sell_signals: sellSignals,
    },
    equity_chart: {
      dates,
      equity,
      drawdown,
    },
    trades,
  };
}
