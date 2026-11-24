import { RefObject, useEffect, useMemo, useRef, useState } from 'react';
import { Check } from 'lucide-react';
import {
  buildLinePath,
  buildXAxisTickIndices,
  computeLogTicks,
  computeNiceTicks,
} from '@/lib/chartScale';
import {
  formatCompactCurrency,
  formatCurrency,
  formatDateTimeChart,
} from '@/lib/format';
import { PriceChartData, RunMeta } from '@/types/backtest';

interface PriceSignalChartProps {
  meta: RunMeta;
  priceChart: PriceChartData;
  svgRef: RefObject<SVGSVGElement>;
}

interface RightLabelItem {
  id: string;
  label: string;
  sublabel?: string;
  color: string;
  lastX: number;
  rawY: number;
  y: number;
}

export function PriceSignalChart({
  meta,
  priceChart,
  svgRef,
}: PriceSignalChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(860);
  const [showSmas, setShowSmas] = useState(true);
  const [showSignals, setShowSignals] = useState(true);
  const [scaleMode, setScaleMode] = useState<'linear' | 'log'>('linear');
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

  const hasSma1 = useMemo(
    () => priceChart.sma1.some((v) => v !== null),
    [priceChart.sma1]
  );
  const hasSma2 = useMemo(
    () => priceChart.sma2.some((v) => v !== null),
    [priceChart.sma2]
  );

  const spanMultipleYears = useMemo(() => {
    if (priceChart.dates.length < 2) return false;
    return (
      priceChart.dates[priceChart.dates.length - 1] - priceChart.dates[0] >
      1000 * 60 * 60 * 24 * 180
    );
  }, [priceChart.dates]);

  const height = width < 640 ? 300 : 370;
  const padLeft = 64;
  const padRight = width >= 640 ? 112 : 20;
  const padTop = 18;
  const padBottom = 32;
  const plotWidth = Math.max(100, width - padLeft - padRight);
  const plotHeight = Math.max(80, height - padTop - padBottom);

  const allVisibleValues = useMemo(() => {
    const vals: number[] = [];
    for (const v of priceChart.close) {
      if (v !== null && Number.isFinite(v)) vals.push(v);
    }
    if (showSmas) {
      for (const v of priceChart.sma1) {
        if (v !== null && Number.isFinite(v)) vals.push(v);
      }
      for (const v of priceChart.sma2) {
        if (v !== null && Number.isFinite(v)) vals.push(v);
      }
    }
    if (showSignals) {
      for (const v of priceChart.buy_signals) {
        if (v !== null && Number.isFinite(v)) vals.push(v);
      }
      for (const v of priceChart.sell_signals) {
        if (v !== null && Number.isFinite(v)) vals.push(v);
      }
    }
    return vals;
  }, [priceChart, showSmas, showSignals]);

  const yScaleInfo = useMemo(() => {
    const rawMin = allVisibleValues.length > 0 ? Math.min(...allVisibleValues) : 0;
    const rawMax = allVisibleValues.length > 0 ? Math.max(...allVisibleValues) : 100;
    if (scaleMode === 'log' && rawMin > 0) {
      return computeLogTicks(rawMin, rawMax);
    }
    return computeNiceTicks(rawMin, rawMax, 5);
  }, [allVisibleValues, scaleMode]);

  const count = priceChart.dates.length;
  const xForIndex = (idx: number) => {
    if (count <= 1) return padLeft + plotWidth / 2;
    return padLeft + (idx / (count - 1)) * plotWidth;
  };

  const yForValue = (val: number) => {
    if (scaleMode === 'log' && yScaleInfo.min > 0) {
      const safeVal = Math.max(val, yScaleInfo.min);
      const logMin = Math.log10(yScaleInfo.min);
      const logMax = Math.log10(yScaleInfo.max);
      const denom = logMax - logMin || 1;
      const ratio = (Math.log10(safeVal) - logMin) / denom;
      return padTop + plotHeight - ratio * plotHeight;
    }
    const denom = yScaleInfo.max - yScaleInfo.min || 1;
    const ratio = (val - yScaleInfo.min) / denom;
    return padTop + plotHeight - ratio * plotHeight;
  };

  const closePath = useMemo(
    () => buildLinePath(priceChart.close, xForIndex, yForValue),
    [priceChart.close, plotWidth, plotHeight, yScaleInfo, scaleMode]
  );
  const sma1Path = useMemo(
    () =>
      showSmas && hasSma1
        ? buildLinePath(priceChart.sma1, xForIndex, yForValue)
        : '',
    [priceChart.sma1, showSmas, hasSma1, plotWidth, plotHeight, yScaleInfo, scaleMode]
  );
  const sma2Path = useMemo(
    () =>
      showSmas && hasSma2
        ? buildLinePath(priceChart.sma2, xForIndex, yForValue)
        : '',
    [priceChart.sma2, showSmas, hasSma2, plotWidth, plotHeight, yScaleInfo, scaleMode]
  );

  const rightLabels = useMemo<RightLabelItem[]>(() => {
    if (width < 640 || count === 0) return [];

    const findLast = (arr: (number | null)[]) => {
      for (let i = arr.length - 1; i >= 0; i--) {
        const v = arr[i];
        if (v !== null && Number.isFinite(v)) {
          return { idx: i, val: v };
        }
      }
      return null;
    };

    const items: RightLabelItem[] = [];
    const lastClose = findLast(priceChart.close);
    if (lastClose) {
      const y = yForValue(lastClose.val);
      items.push({
        id: 'close',
        label: 'Close',
        sublabel: formatCompactCurrency(lastClose.val),
        color: 'var(--series-price)',
        lastX: xForIndex(lastClose.idx),
        rawY: y,
        y,
      });
    }
    if (showSmas && hasSma1) {
      const lastSma1 = findLast(priceChart.sma1);
      if (lastSma1) {
        const y = yForValue(lastSma1.val);
        items.push({
          id: 'sma1',
          label: 'SMA 10',
          color: 'var(--series-sma1)',
          lastX: xForIndex(lastSma1.idx),
          rawY: y,
          y,
        });
      }
    }
    if (showSmas && hasSma2) {
      const lastSma2 = findLast(priceChart.sma2);
      if (lastSma2) {
        const y = yForValue(lastSma2.val);
        items.push({
          id: 'sma2',
          label: 'SMA 50',
          color: 'var(--series-sma2)',
          lastX: xForIndex(lastSma2.idx),
          rawY: y,
          y,
        });
      }
    }

    items.sort((a, b) => a.rawY - b.rawY);
    const minGap = 16;
    for (let i = 1; i < items.length; i++) {
      if (items[i].y - items[i - 1].y < minGap) {
        items[i].y = items[i - 1].y + minGap;
      }
    }
    const maxY = height - padBottom - 6;
    if (items.length > 0 && items[items.length - 1].y > maxY) {
      items[items.length - 1].y = maxY;
      for (let i = items.length - 2; i >= 0; i--) {
        if (items[i + 1].y - items[i].y < minGap) {
          items[i].y = Math.max(padTop + 8, items[i + 1].y - minGap);
        }
      }
    }

    return items;
  }, [
    width,
    count,
    priceChart,
    showSmas,
    hasSma1,
    hasSma2,
    plotWidth,
    plotHeight,
    yScaleInfo,
    scaleMode,
  ]);

  const xTickIndices = useMemo(
    () => buildXAxisTickIndices(count, width < 640 ? 3 : 5),
    [count, width]
  );

  const handleMouseMove = (event: React.MouseEvent<SVGRectElement>) => {
    if (count === 0) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const relX = event.clientX - rect.left;
    const ratio = Math.max(0, Math.min(1, relX / Math.max(1, rect.width)));
    const idx = Math.round(ratio * (count - 1));
    setHoverIdx(idx);
  };

  const hoverClose = hoverIdx !== null ? priceChart.close[hoverIdx] : null;
  const hoverSma1 = hoverIdx !== null ? priceChart.sma1[hoverIdx] : null;
  const hoverSma2 = hoverIdx !== null ? priceChart.sma2[hoverIdx] : null;
  const hoverBuy = hoverIdx !== null ? priceChart.buy_signals[hoverIdx] : null;
  const hoverSell = hoverIdx !== null ? priceChart.sell_signals[hoverIdx] : null;

  const plotRight = padLeft + plotWidth;
  const plotBottom = padTop + plotHeight;

  return (
    <section
      id="section-price"
      className="px-5 pb-6 pt-5 sm:px-8 sm:pt-6"
    >
      {/* Header Row */}
      <div className="flex flex-col justify-between gap-3 pb-3 sm:flex-row sm:items-end">
        <div>
          <div className="flex flex-wrap items-baseline gap-2.5">
            <h2 className="text-[16px] font-medium tracking-tight text-[var(--fg)]">
              Price &amp; signals
            </h2>
            <span className="font-mono text-[12px] text-[var(--fg-3)]">
              {meta.ticker} · {meta.strategy_name} · {meta.start_date} to{' '}
              {meta.end_date} ({meta.interval.toUpperCase()})
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4 text-[12px]">
          {(hasSma1 || hasSma2) && (
            <button
              type="button"
              onClick={() => setShowSmas((prev) => !prev)}
              className="inline-flex items-center gap-1.5 text-[var(--fg-2)] transition-colors hover:text-[var(--fg)]"
            >
              <span
                className="inline-flex h-[13px] w-[13px] items-center justify-center rounded-[3px] border"
                style={{
                  borderColor: showSmas ? 'var(--brand)' : 'var(--line-2)',
                  backgroundColor: showSmas ? 'var(--brand)' : 'transparent',
                  color: 'var(--on-accent)',
                }}
              >
                {showSmas && <Check className="h-2.5 w-2.5 stroke-[3]" />}
              </span>
              <span>SMAs</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setShowSignals((prev) => !prev)}
            className="inline-flex items-center gap-1.5 text-[var(--fg-2)] transition-colors hover:text-[var(--fg)]"
          >
            <span
              className="inline-flex h-[13px] w-[13px] items-center justify-center rounded-[3px] border"
              style={{
                borderColor: showSignals ? 'var(--brand)' : 'var(--line-2)',
                backgroundColor: showSignals ? 'var(--brand)' : 'transparent',
                color: 'var(--on-accent)',
              }}
            >
              {showSignals && <Check className="h-2.5 w-2.5 stroke-[3]" />}
            </span>
            <span>Signals</span>
          </button>

          <div className="flex items-center gap-2.5 border-l border-[var(--line)] pl-3">
            {(['linear', 'log'] as const).map((mode) => {
              const active = scaleMode === mode;
              return (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setScaleMode(mode)}
                  className="relative pb-1 capitalize transition-colors"
                  style={{
                    color: active ? 'var(--fg)' : 'var(--fg-3)',
                    fontWeight: active ? 500 : 400,
                  }}
                >
                  {mode}
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
      </div>

      {/* SVG Plot Container */}
      <div ref={containerRef} className="relative w-full select-none">
        {hoverIdx !== null && priceChart.dates[hoverIdx] !== undefined && (
          <div
            className="pointer-events-none absolute left-16 top-3 z-10 w-[228px] rounded-[8px] border border-[var(--line-2)] bg-[var(--surface)] px-3 py-2.5 text-[12px]"
          >
            <p className="border-b border-[var(--line)] pb-1.5 font-mono text-[11px] text-[var(--fg-2)]">
              {formatDateTimeChart(priceChart.dates[hoverIdx], true)}
            </p>
            <div className="mt-1.5 space-y-1 tabular-nums">
              {hoverClose != null && (
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-[var(--fg-2)]">
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ backgroundColor: 'var(--series-price)' }}
                    />
                    Close
                  </span>
                  <span className="font-mono font-medium text-[var(--fg)]">
                    {formatCurrency(hoverClose)}
                  </span>
                </div>
              )}
              {showSmas && hoverSma1 != null && (
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-[var(--fg-2)]">
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ backgroundColor: 'var(--series-sma1)' }}
                    />
                    SMA (10)
                  </span>
                  <span className="font-mono text-[var(--fg)]">
                    {formatCurrency(hoverSma1)}
                  </span>
                </div>
              )}
              {showSmas && hoverSma2 != null && (
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-[var(--fg-2)]">
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ backgroundColor: 'var(--series-sma2)' }}
                    />
                    SMA (50)
                  </span>
                  <span className="font-mono text-[var(--fg)]">
                    {formatCurrency(hoverSma2)}
                  </span>
                </div>
              )}
              {showSignals && hoverBuy != null && (
                <div
                  className="flex items-center justify-between border-t border-[var(--line)] pt-1 font-medium"
                  style={{ color: 'var(--pos)' }}
                >
                  <span>Buy entry</span>
                  <span className="font-mono">{formatCurrency(hoverBuy)}</span>
                </div>
              )}
              {showSignals && hoverSell != null && (
                <div
                  className="flex items-center justify-between border-t border-[var(--line)] pt-1 font-medium"
                  style={{ color: 'var(--neg)' }}
                >
                  <span>Short entry</span>
                  <span className="font-mono">{formatCurrency(hoverSell)}</span>
                </div>
              )}
            </div>
          </div>
        )}

        <svg
          ref={svgRef}
          width={width}
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          className="block w-full overflow-visible"
        >
          {/* Dotted Horizontal Gridlines */}
          {yScaleInfo.ticks.map((tick, idx) => {
            const y = yForValue(tick);
            const isBaseline = idx === 0;
            return (
              <g key={tick}>
                <line
                  x1={padLeft}
                  y1={y}
                  x2={plotRight}
                  y2={y}
                  stroke={isBaseline ? 'var(--line-2)' : 'var(--line)'}
                  strokeDasharray={isBaseline ? undefined : '2 6'}
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
                  {formatCompactCurrency(tick)}
                </text>
              </g>
            );
          })}

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
                {formatDateTimeChart(priceChart.dates[idx], spanMultipleYears)}
              </text>
            );
          })}

          {/* Series Polylines */}
          {sma2Path && (
            <path
              d={sma2Path}
              fill="none"
              stroke="var(--series-sma2)"
              strokeWidth={1.5}
              strokeOpacity={0.78}
              strokeLinejoin="round"
            />
          )}
          {sma1Path && (
            <path
              d={sma1Path}
              fill="none"
              stroke="var(--series-sma1)"
              strokeWidth={1.75}
              strokeOpacity={0.88}
              strokeLinejoin="round"
            />
          )}
          {closePath && (
            <path
              d={closePath}
              fill="none"
              stroke="var(--series-price)"
              strokeWidth={2.1}
              strokeOpacity={0.94}
              strokeLinejoin="round"
            />
          )}

          {/* Knockout Entry Signal Dots */}
          {showSignals &&
            priceChart.buy_signals.map((val, i) => {
              if (val === null || !Number.isFinite(val)) return null;
              return (
                <circle
                  key={`buy-${i}`}
                  cx={xForIndex(i)}
                  cy={yForValue(val)}
                  r={4.5}
                  fill="var(--pos)"
                  stroke="var(--bg)"
                  strokeWidth={1.8}
                />
              );
            })}
          {showSignals &&
            priceChart.sell_signals.map((val, i) => {
              if (val === null || !Number.isFinite(val)) return null;
              return (
                <circle
                  key={`sell-${i}`}
                  cx={xForIndex(i)}
                  cy={yForValue(val)}
                  r={4.5}
                  fill="var(--neg)"
                  stroke="var(--bg)"
                  strokeWidth={1.8}
                />
              );
            })}

          {/* Direct Right-Edge Series Labels */}
          {rightLabels.map((item) => (
            <g key={item.id}>
              <polyline
                points={`${item.lastX},${item.rawY} ${plotRight + 8},${item.y} ${plotRight + 14},${item.y}`}
                fill="none"
                stroke={item.color}
                strokeOpacity={0.55}
                strokeWidth={1}
              />
              <text
                x={plotRight + 18}
                y={item.y + 3.5}
                fill={item.color}
                fontSize="12"
                fontWeight={500}
              >
                {item.label}
                {item.sublabel ? ` ${item.sublabel}` : ''}
              </text>
            </g>
          ))}

          {/* Hover Crosshair & Active Point */}
          {hoverIdx !== null && hoverClose != null && (
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
                cy={yForValue(hoverClose)}
                r={5}
                fill="var(--series-price)"
                stroke="var(--bg)"
                strokeWidth={2}
              />
            </g>
          )}

          {/* Pointer Tracking Layer */}
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
    </section>
  );
}
