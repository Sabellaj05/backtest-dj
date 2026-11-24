import { RefObject, useEffect, useId, useMemo, useRef, useState } from 'react';
import {
  buildLinePath,
  buildXAxisTickIndices,
  computeNiceTicks,
} from '@/lib/chartScale';
import {
  formatCompactCurrency,
  formatCurrency,
  formatDateTimeChart,
  formatPercent,
  formatSignedCurrency,
} from '@/lib/format';
import { BacktestMetrics, EquityChartData, RunMeta } from '@/types/backtest';

interface EquityPerformanceChartProps {
  meta: RunMeta;
  metrics: BacktestMetrics;
  equityChart: EquityChartData;
  svgRef: RefObject<SVGSVGElement>;
}

export function EquityPerformanceChart({
  meta,
  metrics,
  equityChart,
  svgRef,
}: EquityPerformanceChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const uid = useId().replace(/:/g, '');
  const [width, setWidth] = useState(860);
  const [mode, setMode] = useState<'equity' | 'drawdown'>('equity');
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;

    const updateSize = () => {
      const next = Math.floor(node.clientWidth);
      if (next > 0) setWidth(next);
    };
    updateSize();

    const observer = new ResizeObserver(updateSize);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const isPositiveReturn = metrics.total_return_pct >= 0;
  const alphaVsBenchmark =
    metrics.total_return_pct - metrics.buy_and_hold_return_pct;
  const isBenchmark = meta.strategy === 'buy_and_hold';
  const profitFactorDisplay =
    metrics.profit_factor > 0
      ? metrics.profit_factor.toFixed(2)
      : metrics.trades > 0 && metrics.winrate_pct === 100
        ? 'Inf'
        : '0.00';

  const sharpeRating =
    metrics.sharpe >= 1.5
      ? 'Strong'
      : metrics.sharpe >= 0.75
        ? 'Moderate'
        : 'Weak';

  const spanMultipleYears = useMemo(() => {
    if (equityChart.dates.length < 2) return false;
    return (
      equityChart.dates[equityChart.dates.length - 1] - equityChart.dates[0] >
      1000 * 60 * 60 * 24 * 180
    );
  }, [equityChart.dates]);

  const height = width < 640 ? 235 : 275;
  const padLeft = 64;
  const padRight = width >= 640 ? 94 : 20;
  const padTop = 16;
  const padBottom = 30;
  const plotWidth = Math.max(100, width - padLeft - padRight);
  const plotHeight = Math.max(70, height - padTop - padBottom);
  const plotRight = padLeft + plotWidth;
  const plotBottom = padTop + plotHeight;

  const equityScale = useMemo(() => {
    const valid = equityChart.equity.filter(
      (v): v is number => v !== null && Number.isFinite(v)
    );
    const minVal =
      valid.length > 0
        ? Math.min(...valid, meta.initial_cash)
        : meta.initial_cash;
    const maxVal =
      valid.length > 0
        ? Math.max(...valid, meta.initial_cash)
        : meta.initial_cash;
    return computeNiceTicks(minVal, maxVal, 4);
  }, [equityChart.equity, meta.initial_cash]);

  const drawdownScale = useMemo(() => {
    const valid = (equityChart.drawdown ?? []).filter(
      (v): v is number => v !== null && Number.isFinite(v)
    );
    const rawMin = valid.length > 0 ? Math.min(...valid, -1) : -1;
    const res = computeNiceTicks(rawMin, 0, 4);
    const ticks = res.ticks.filter((t) => t <= 0);
    if (!ticks.includes(0)) ticks.push(0);
    return { min: Math.min(res.min, -1), max: 0, ticks };
  }, [equityChart.drawdown]);

  const count = equityChart.dates.length;
  const xForIndex = (idx: number) => {
    if (count <= 1) return padLeft + plotWidth / 2;
    return padLeft + (idx / (count - 1)) * plotWidth;
  };

  const activeScale = mode === 'equity' ? equityScale : drawdownScale;
  const yForValue = (val: number) => {
    const denom = activeScale.max - activeScale.min || 1;
    const ratio = (val - activeScale.min) / denom;
    return padTop + plotHeight - ratio * plotHeight;
  };

  const activeValues =
    mode === 'equity'
      ? equityChart.equity
      : (equityChart.drawdown ?? equityChart.dates.map(() => 0));

  const linePath = useMemo(
    () => buildLinePath(activeValues, xForIndex, yForValue),
    [activeValues, plotWidth, plotHeight, activeScale]
  );

  const baselineValue = mode === 'equity' ? meta.initial_cash : 0;
  const baselineY = yForValue(baselineValue);

  const areaPath = useMemo(() => {
    const pts: { x: number; y: number }[] = [];
    for (let i = 0; i < activeValues.length; i++) {
      const val = activeValues[i];
      if (val !== null && Number.isFinite(val)) {
        pts.push({ x: xForIndex(i), y: yForValue(val) });
      }
    }
    if (pts.length === 0) return '';
    const first = pts[0];
    const last = pts[pts.length - 1];
    const segments = pts
      .map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`)
      .join(' ');
    return `${segments} L ${last.x.toFixed(2)} ${baselineY.toFixed(2)} L ${first.x.toFixed(2)} ${baselineY.toFixed(2)} Z`;
  }, [activeValues, baselineY, plotWidth, plotHeight, activeScale]);

  const xTickIndices = useMemo(
    () => buildXAxisTickIndices(count, width < 640 ? 3 : 5),
    [count, width]
  );

  const handleMouseMove = (event: React.MouseEvent<SVGRectElement>) => {
    if (count === 0) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const relX = event.clientX - rect.left;
    const ratio = Math.max(0, Math.min(1, relX / Math.max(1, rect.width)));
    setHoverIdx(Math.round(ratio * (count - 1)));
  };

  const hoverVal = hoverIdx !== null ? activeValues[hoverIdx] : null;
  const hoverEquity = hoverIdx !== null ? equityChart.equity[hoverIdx] : null;
  const hoverReturnPct =
    hoverEquity != null && meta.initial_cash > 0
      ? ((hoverEquity - meta.initial_cash) / meta.initial_cash) * 100
      : 0;

  return (
    <section
      id="section-equity"
      className="border-t border-[var(--line)] px-5 pb-6 pt-6 sm:px-8"
    >
      {/* Hero 3-KPI Callout Row */}
      <div className="grid grid-cols-1 gap-5 border-b border-[var(--line)] pb-5 sm:grid-cols-3">
        <div>
          <p className="text-[12px] text-[var(--fg-2)]">Total return</p>
          <p
            className="mt-1 text-[34px] font-medium leading-none tracking-[-1px] tabular-nums"
            style={{ color: isPositiveReturn ? 'var(--pos)' : 'var(--neg)' }}
          >
            {formatPercent(metrics.total_return_pct, true)}
          </p>
          <p className="mt-1.5 font-mono text-[11.5px] tabular-nums text-[var(--fg-3)]">
            Net P&amp;L {formatSignedCurrency(metrics.net_profit)}
          </p>
        </div>

        <div>
          <p className="text-[12px] text-[var(--fg-2)]">Final equity</p>
          <p className="mt-1 text-[34px] font-medium leading-none tracking-[-1px] tabular-nums text-[var(--fg)]">
            {formatCurrency(metrics.final_equity)}
          </p>
          <p className="mt-1.5 font-mono text-[11.5px] tabular-nums text-[var(--fg-3)]">
            Initial {formatCurrency(meta.initial_cash)}
          </p>
        </div>

        <div>
          <p className="text-[12px] text-[var(--fg-2)]">
            {isBenchmark ? 'Strategy role' : 'Alpha vs Buy & Hold'}
          </p>
          <p
            className="mt-1 text-[34px] font-medium leading-none tracking-[-1px] tabular-nums"
            style={{
              color: isBenchmark
                ? 'var(--brand)'
                : alphaVsBenchmark >= 0
                  ? 'var(--pos)'
                  : 'var(--neg)',
            }}
          >
            {isBenchmark ? 'Benchmark' : formatPercent(alphaVsBenchmark, true)}
          </p>
          <p className="mt-1.5 font-mono text-[11.5px] tabular-nums text-[var(--fg-3)]">
            B&amp;H return {formatPercent(metrics.buy_and_hold_return_pct, true)}
          </p>
        </div>
      </div>

      {/* Chart Header & Mode Switch */}
      <div className="flex items-center justify-between pt-5 pb-3">
        <h2 className="text-[16px] font-medium tracking-tight text-[var(--fg)]">
          Equity &amp; drawdown
        </h2>

        <div className="flex items-center gap-4 text-[12px]">
          {(
            [
              { id: 'equity', label: 'Equity' },
              { id: 'drawdown', label: 'Drawdown %' },
            ] as const
          ).map((item) => {
            const active = mode === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setMode(item.id);
                  setHoverIdx(null);
                }}
                className="relative pb-1 transition-colors"
                style={{
                  color: active ? 'var(--fg)' : 'var(--fg-3)',
                  fontWeight: active ? 500 : 400,
                }}
              >
                {item.label}
                {active && (
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

      {/* Diverging / Underwater SVG Plot */}
      <div ref={containerRef} className="relative w-full select-none">
        {hoverIdx !== null &&
          equityChart.dates[hoverIdx] !== undefined &&
          hoverVal !== null && (
            <div className="pointer-events-none absolute left-16 top-2 z-10 w-[216px] rounded-[8px] border border-[var(--line-2)] bg-[var(--surface)] px-3 py-2 text-[12px]">
              <p className="border-b border-[var(--line)] pb-1 font-mono text-[11px] text-[var(--fg-2)]">
                {formatDateTimeChart(equityChart.dates[hoverIdx], true)}
              </p>
              {mode === 'equity' ? (
                <div className="mt-1.5 space-y-1 tabular-nums">
                  <div className="flex items-center justify-between">
                    <span className="text-[var(--fg-2)]">Equity</span>
                    <span className="font-mono font-medium text-[var(--fg)]">
                      {formatCurrency(hoverVal)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[var(--fg-2)]">Return</span>
                    <span
                      className="font-mono font-medium"
                      style={{
                        color: hoverReturnPct >= 0 ? 'var(--pos)' : 'var(--neg)',
                      }}
                    >
                      {formatPercent(hoverReturnPct, true)}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="mt-1.5 flex items-center justify-between tabular-nums">
                  <span className="text-[var(--fg-2)]">Drawdown</span>
                  <span
                    className="font-mono font-medium"
                    style={{ color: 'var(--neg)' }}
                  >
                    {formatPercent(hoverVal)}
                  </span>
                </div>
              )}
            </div>
          )}

        <svg
          ref={svgRef}
          width={width}
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          className="block w-full overflow-visible"
        >
          <defs>
            <linearGradient id={`posGrad-${uid}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--pos)" stopOpacity="0.26" />
              <stop offset="100%" stopColor="var(--pos)" stopOpacity="0.02" />
            </linearGradient>
            <linearGradient id={`negGrad-${uid}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--neg)" stopOpacity="0.02" />
              <stop offset="100%" stopColor="var(--neg)" stopOpacity="0.28" />
            </linearGradient>
            <clipPath id={`aboveClip-${uid}`}>
              <rect
                x={padLeft}
                y={0}
                width={plotWidth}
                height={Math.max(0, baselineY)}
              />
            </clipPath>
            <clipPath id={`belowClip-${uid}`}>
              <rect
                x={padLeft}
                y={Math.max(0, baselineY)}
                width={plotWidth}
                height={Math.max(0, height - baselineY)}
              />
            </clipPath>
          </defs>

          {/* Horizontal Dotted Gridlines */}
          {activeScale.ticks.map((tick, idx) => {
            const y = yForValue(tick);
            const isBottom = idx === 0;
            return (
              <g key={tick}>
                <line
                  x1={padLeft}
                  y1={y}
                  x2={plotRight}
                  y2={y}
                  stroke={isBottom ? 'var(--line-2)' : 'var(--line)'}
                  strokeDasharray={isBottom ? undefined : '2 6'}
                  strokeWidth={1}
                />
                <text
                  x={padLeft - 10}
                  y={y + 3.5}
                  textAnchor="end"
                  fill="var(--fg-3)"
                  fontSize="11"
                  fontFamily="JetBrains Mono, monospace"
                >
                  {mode === 'equity'
                    ? formatCompactCurrency(tick)
                    : `${tick.toFixed(1)}%`}
                </text>
              </g>
            );
          })}

          {/* Baseline Reference */}
          <line
            x1={padLeft}
            y1={baselineY}
            x2={plotRight}
            y2={baselineY}
            stroke="var(--fg-3)"
            strokeOpacity={0.75}
            strokeDasharray={mode === 'equity' ? '3 4' : undefined}
            strokeWidth={1}
          />
          {width >= 640 && (
            <text
              x={plotRight + 10}
              y={baselineY + 3.5}
              fill="var(--fg-3)"
              fontSize="11"
            >
              {mode === 'equity' ? 'Initial' : '0.0%'}
            </text>
          )}

          {/* X-Axis Labels */}
          {xTickIndices.map((idx, pos) => {
            const x = xForIndex(idx);
            const anchor =
              pos === 0
                ? 'start'
                : pos === xTickIndices.length - 1
                  ? 'end'
                  : 'middle';
            return (
              <text
                key={idx}
                x={x}
                y={plotBottom + 20}
                textAnchor={anchor}
                fill="var(--fg-3)"
                fontSize="11"
                fontFamily="JetBrains Mono, monospace"
              >
                {formatDateTimeChart(equityChart.dates[idx], spanMultipleYears)}
              </text>
            );
          })}

          {/* Clipped Diverging Equity or Underwater Drawdown */}
          {mode === 'equity' ? (
            <>
              {areaPath && (
                <>
                  <path
                    d={areaPath}
                    fill={`url(#posGrad-${uid})`}
                    clipPath={`url(#aboveClip-${uid})`}
                  />
                  <path
                    d={areaPath}
                    fill={`url(#negGrad-${uid})`}
                    clipPath={`url(#belowClip-${uid})`}
                  />
                </>
              )}
              {linePath && (
                <>
                  <path
                    d={linePath}
                    fill="none"
                    stroke="var(--pos)"
                    strokeWidth={2.2}
                    strokeLinejoin="round"
                    clipPath={`url(#aboveClip-${uid})`}
                  />
                  <path
                    d={linePath}
                    fill="none"
                    stroke="var(--neg)"
                    strokeWidth={2.2}
                    strokeLinejoin="round"
                    clipPath={`url(#belowClip-${uid})`}
                  />
                </>
              )}
              {width >= 640 &&
                count > 0 &&
                equityChart.equity[count - 1] != null && (
                  <text
                    x={plotRight + 10}
                    y={yForValue(equityChart.equity[count - 1]!) + 3.5}
                    fill={isPositiveReturn ? 'var(--pos)' : 'var(--neg)'}
                    fontSize="11.5"
                    fontWeight={500}
                    fontFamily="JetBrains Mono, monospace"
                  >
                    {formatCompactCurrency(equityChart.equity[count - 1]!)}
                  </text>
                )}
            </>
          ) : (
            <>
              {areaPath && (
                <path d={areaPath} fill={`url(#negGrad-${uid})`} />
              )}
              {linePath && (
                <path
                  d={linePath}
                  fill="none"
                  stroke="var(--neg)"
                  strokeWidth={1.9}
                  strokeLinejoin="round"
                />
              )}
              {width >= 640 && (
                <text
                  x={plotRight + 10}
                  y={yForValue(metrics.max_drawdown_pct) + 3.5}
                  fill="var(--neg)"
                  fontSize="11.5"
                  fontWeight={500}
                  fontFamily="JetBrains Mono, monospace"
                >
                  {formatPercent(metrics.max_drawdown_pct)}
                </text>
              )}
            </>
          )}

          {/* Hover Crosshair */}
          {hoverIdx !== null && hoverVal != null && (
            <g pointerEvents="none">
              <line
                x1={xForIndex(hoverIdx)}
                y1={padTop}
                x2={xForIndex(hoverIdx)}
                y2={plotBottom}
                stroke="var(--line-2)"
                strokeDasharray="3 4"
                strokeWidth={1}
              />
              <circle
                cx={xForIndex(hoverIdx)}
                cy={yForValue(hoverVal)}
                r={4.5}
                fill={
                  mode === 'drawdown'
                    ? 'var(--neg)'
                    : hoverVal >= meta.initial_cash
                      ? 'var(--pos)'
                      : 'var(--neg)'
                }
                stroke="var(--bg)"
                strokeWidth={1.8}
              />
            </g>
          )}

          <rect
            x={padLeft}
            y={padTop}
            width={plotWidth}
            height={plotHeight}
            fill="transparent"
            onMouseMove={handleMouseMove}
            onMouseLeave={() => setHoverIdx(null)}
            style={{ cursor: 'crosshair' }}
          />
        </svg>
      </div>

      {/* 6-Metric Hairline Strip */}
      <div className="mt-4 grid grid-cols-2 gap-4 border-t border-[var(--line)] pt-4 sm:grid-cols-3 xl:grid-cols-6">
        <div>
          <p className="text-[11.5px] text-[var(--fg-3)]">Annual return (CAGR)</p>
          <p
            className="mt-1 font-mono text-[16px] font-medium tabular-nums"
            style={{
              color: metrics.cagr_pct >= 0 ? 'var(--pos)' : 'var(--neg)',
            }}
          >
            {formatPercent(metrics.cagr_pct, true)}
          </p>
        </div>

        <div>
          <p className="text-[11.5px] text-[var(--fg-3)]">Max drawdown</p>
          <p
            className="mt-1 font-mono text-[16px] font-medium tabular-nums"
            style={{
              color: metrics.max_drawdown_pct < 0 ? 'var(--neg)' : 'var(--fg)',
            }}
          >
            {formatPercent(metrics.max_drawdown_pct)}
          </p>
        </div>

        <div>
          <p className="text-[11.5px] text-[var(--fg-3)]">Sharpe ratio</p>
          <p className="mt-1 font-mono text-[16px] font-medium tabular-nums text-[var(--fg)]">
            {metrics.sharpe.toFixed(2)}{' '}
            <span className="font-sans text-[11px] font-normal text-[var(--fg-3)]">
              ({sharpeRating})
            </span>
          </p>
        </div>

        <div>
          <p className="text-[11.5px] text-[var(--fg-3)]">Win rate</p>
          <p className="mt-1 font-mono text-[16px] font-medium tabular-nums text-[var(--fg)]">
            {metrics.winrate_pct.toFixed(2)}%
          </p>
        </div>

        <div>
          <p className="text-[11.5px] text-[var(--fg-3)]">Profit factor</p>
          <p className="mt-1 font-mono text-[16px] font-medium tabular-nums text-[var(--fg)]">
            {profitFactorDisplay}
          </p>
        </div>

        <div>
          <p className="text-[11.5px] text-[var(--fg-3)]">Market exposure</p>
          <p className="mt-1 font-mono text-[16px] font-medium tabular-nums text-[var(--fg)]">
            {metrics.exposure_time_pct.toFixed(1)}%{' '}
            <span className="font-sans text-[11px] font-normal text-[var(--fg-3)]">
              · {metrics.trades} {metrics.trades === 1 ? 'trade' : 'trades'}
            </span>
          </p>
        </div>
      </div>
    </section>
  );
}
