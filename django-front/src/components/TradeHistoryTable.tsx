import { useMemo, useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  formatCurrency,
  formatDateShort,
  formatPercent,
  formatSignedCurrency,
} from '@/lib/format';
import { TradeRecord } from '@/types/backtest';

interface TradeHistoryTableProps {
  trades: TradeRecord[];
}

const DEFAULT_VISIBLE = 10;

export function TradeHistoryTable({ trades }: TradeHistoryTableProps) {
  const [expanded, setExpanded] = useState(false);

  const visibleTrades = expanded ? trades : trades.slice(0, DEFAULT_VISIBLE);
  const hasMore = trades.length > DEFAULT_VISIBLE;

  const maxAbsReturn = useMemo(() => {
    if (trades.length === 0) return 1;
    return Math.max(
      1,
      ...trades.map((t) => Math.abs(t.return_pct))
    );
  }, [trades]);

  return (
    <section
      id="section-executions"
      className="border-t border-[var(--line)] px-5 pb-8 pt-6 sm:px-8"
    >
      <div className="flex items-center justify-between pb-3">
        <div className="flex items-baseline gap-2.5">
          <h2 className="text-[16px] font-medium tracking-tight text-[var(--fg)]">
            Executions
          </h2>
          <span className="text-[12px] text-[var(--fg-3)]">
            {trades.length} {trades.length === 1 ? 'trade' : 'trades'}
          </span>
        </div>

        {hasMore && (
          <button
            type="button"
            onClick={() => setExpanded((prev) => !prev)}
            className="inline-flex items-center gap-1 text-[12px] font-medium text-[var(--fg-2)] transition-colors hover:text-[var(--fg)]"
          >
            {expanded ? (
              <>
                <span>Collapse</span>
                <ChevronUp className="h-3.5 w-3.5" />
              </>
            ) : (
              <>
                <span>Show all {trades.length} trades</span>
                <ChevronDown className="h-3.5 w-3.5" />
              </>
            )}
          </button>
        )}
      </div>

      {trades.length === 0 ? (
        <div className="border-y border-[var(--line)] py-8 text-center">
          <p className="text-[13.5px] font-medium text-[var(--fg)]">
            No trades executed in this window
          </p>
          <p className="mt-1 text-[12px] text-[var(--fg-3)]">
            SMA 10/50 strategies require at least 50 bars and a moving-average cross to trigger an entry. Try extending the lookback window.
          </p>
        </div>
      ) : (
        <div className="border-t border-[var(--line)]">
          <Table>
            <TableHeader>
              <TableRow className="border-b border-[var(--line)] hover:bg-transparent">
                <TableHead className="w-10 pl-2 font-mono text-[11px] font-normal text-[var(--fg-3)]">
                  #
                </TableHead>
                <TableHead className="text-[11.5px] font-normal text-[var(--fg-3)]">
                  Side
                </TableHead>
                <TableHead className="text-[11.5px] font-normal text-[var(--fg-3)]">
                  Entry
                </TableHead>
                <TableHead className="text-[11.5px] font-normal text-[var(--fg-3)]">
                  Exit
                </TableHead>
                <TableHead className="text-right text-[11.5px] font-normal text-[var(--fg-3)]">
                  Entry price
                </TableHead>
                <TableHead className="text-right text-[11.5px] font-normal text-[var(--fg-3)]">
                  Exit price
                </TableHead>
                <TableHead className="text-right text-[11.5px] font-normal text-[var(--fg-3)]">
                  Size
                </TableHead>
                <TableHead className="text-right text-[11.5px] font-normal text-[var(--fg-3)]">
                  P&amp;L
                </TableHead>
                <TableHead className="w-28 pr-2 text-right text-[11.5px] font-normal text-[var(--fg-3)]">
                  Return
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibleTrades.map((trade, index) => {
                const isWinner = trade.pnl >= 0;
                const barWidthPct = Math.max(
                  6,
                  Math.round((Math.abs(trade.return_pct) / maxAbsReturn) * 100)
                );
                const resultColor = isWinner ? 'var(--pos)' : 'var(--neg)';

                return (
                  <TableRow
                    key={`${trade.entry_time}-${index}`}
                    className="border-b border-[var(--line)] font-mono text-[12px] tabular-nums transition-colors hover:bg-[var(--hover)]"
                  >
                    <TableCell className="py-2.5 pl-2 text-[var(--fg-3)]">
                      {index + 1}
                    </TableCell>
                    <TableCell className="py-2.5">
                      <span
                        className="text-[11px] font-medium"
                        style={{
                          color:
                            trade.side === 'LONG' ? 'var(--pos)' : 'var(--neg)',
                        }}
                      >
                        {trade.side}
                      </span>
                    </TableCell>
                    <TableCell className="py-2.5 font-sans text-[12px] text-[var(--fg)]">
                      {formatDateShort(trade.entry_time)}
                    </TableCell>
                    <TableCell className="py-2.5 font-sans text-[12px] text-[var(--fg-2)]">
                      {formatDateShort(trade.exit_time)}
                    </TableCell>
                    <TableCell className="py-2.5 text-right text-[var(--fg)]">
                      {formatCurrency(trade.entry_price)}
                    </TableCell>
                    <TableCell className="py-2.5 text-right text-[var(--fg-2)]">
                      {trade.exit_price != null
                        ? formatCurrency(trade.exit_price)
                        : '—'}
                    </TableCell>
                    <TableCell className="py-2.5 text-right text-[var(--fg-2)]">
                      {trade.size}
                    </TableCell>
                    <TableCell
                      className="py-2.5 text-right font-medium"
                      style={{ color: resultColor }}
                    >
                      {formatSignedCurrency(trade.pnl)}
                    </TableCell>
                    <TableCell className="py-2.5 pr-2 text-right">
                      <div className="flex flex-col items-end gap-1">
                        <span
                          className="font-medium"
                          style={{ color: resultColor }}
                        >
                          {formatPercent(trade.return_pct, true)}
                        </span>
                        <div className="h-[2px] w-full overflow-hidden rounded-full bg-[var(--line)]">
                          <div
                            className="ml-auto h-full rounded-full"
                            style={{
                              width: `${barWidthPct}%`,
                              backgroundColor: resultColor,
                            }}
                          />
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </section>
  );
}
