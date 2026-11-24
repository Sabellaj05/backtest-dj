"""
Backtest service layer for executing stateless trading strategy simulations.
"""
import logging
import warnings
from typing import Any, Dict, List, Optional

import numpy as np
import pandas as pd
import yfinance as yf
from backtesting import Backtest

from ..strategies.factory import create_strategy

warnings.simplefilter(action="ignore", category=FutureWarning)
logger = logging.getLogger(__name__)


STRATEGIES: List[Dict[str, Any]] = [
    {
        "id": "sma_cross",
        "name": "SMA Crossover (10/50)",
        "short_name": "SMA 10/50",
        "category": "Trend Following",
        "description": (
            "Enters long when the 10-period SMA crosses above the 50-period SMA "
            "and reverses short on downward crossover."
        ),
        "indicators": ["SMA (10)", "SMA (50)"],
    },
    {
        "id": "la_bomba",
        "name": "Risk-Managed SMA (La Bomba)",
        "short_name": "La Bomba",
        "category": "Risk Managed",
        "description": (
            "SMA 10/50 crossover with 1% Stop Loss, 2% Take Profit, "
            "and automatic Break-Even stop once +1% in profit."
        ),
        "indicators": ["SMA (10)", "SMA (50)"],
    },
    {
        "id": "buy_and_hold",
        "name": "Buy & Hold",
        "short_name": "Buy & Hold",
        "category": "Benchmark",
        "description": (
            "Passive benchmark that allocates full starting capital on bar 1 "
            "and holds through the end of the simulation window."
        ),
        "indicators": [],
    },
]

STRATEGY_BY_ID: Dict[str, Dict[str, Any]] = {s["id"]: s for s in STRATEGIES}

# Strategy name mapping from UI / aliases to backend module slug
STRATEGY_MAP: Dict[str, str] = {
    "SMA": "sma_cross",
    "sma_cross": "sma_cross",
    "LA_BOMBA": "la_bomba",
    "la_bomba": "la_bomba",
    "BUY_AND_HOLD": "buy_and_hold",
    "buy_and_hold": "buy_and_hold",
}


def get_available_strategies() -> List[Dict[str, Any]]:
    """Return metadata for all implemented backtest strategies."""
    return [dict(strategy) for strategy in STRATEGIES]


def _is_invalid_number(value: Any) -> bool:
    if value is None or pd.isna(value):
        return True
    try:
        numeric = float(value)
    except (TypeError, ValueError):
        return True
    return np.isnan(numeric) or np.isinf(numeric)


def _safe_float(value: Any, decimals: int = 2, default: float = 0.0) -> float:
    if _is_invalid_number(value):
        return default
    rounded = round(float(value), decimals)
    return 0.0 if rounded == 0 else rounded


def sanitize_series(series_or_list) -> List[Optional[float]]:
    """Replace NaN/inf with None and convert valid numbers to standard floats."""
    return [
        None if _is_invalid_number(x) else float(x)
        for x in series_or_list
    ]


def _index_to_epoch_ms(index: pd.Index) -> List[int]:
    return (index.astype(np.int64) // 10**6).tolist()


def _timestamp_to_epoch_ms(ts: Any) -> Optional[int]:
    if ts is None or pd.isna(ts):
        return None
    return int(pd.Timestamp(ts).value // 10**6)


def fetch_ohlcv(ticker: str, start, end, interval: str = "1d") -> pd.DataFrame:
    """
    Fetch OHLCV data from yfinance.

    Raises:
        ValueError: If data cannot be retrieved or required columns are missing.
    """
    ticker = ticker.strip().upper()
    df: Optional[pd.DataFrame] = None

    try:
        df = yf.download(
            ticker,
            start=str(start),
            end=str(end),
            interval=interval,
            progress=False,
            timeout=10,
            threads=False,
        )
        if df is not None and not df.empty:
            df.index = df.index.tz_localize(None)
    except Exception:
        df = None

    if df is None or df.empty:
        try:
            ticker_obj = yf.Ticker(ticker)
            df = ticker_obj.history(
                start=str(start), end=str(end), interval=interval, timeout=10
            )
            if df is not None and not df.empty:
                df.index = df.index.tz_localize(None)
        except Exception:
            df = None

    if df is None or df.empty:
        if interval == "1h":
            raise ValueError(
                f"No hourly data returned for {ticker}. Note that Yahoo Finance limits 1h history to the last 730 days."
            )
        raise ValueError(
            f"Could not retrieve market data for {ticker}. Verify the ticker symbol and date range."
        )

    if isinstance(df.columns, pd.MultiIndex):
        df.columns = df.columns.get_level_values(0)
    df = df.rename(columns={c: str(c).capitalize() for c in df.columns})

    required_cols = ["Open", "High", "Low", "Close", "Volume"]
    for col in required_cols:
        if col not in df.columns:
            raise ValueError(f"Incomplete data: missing column {col}")

    df = df.dropna(subset=required_cols)
    df = df[~df.index.duplicated(keep="last")].sort_index()

    if df.empty:
        raise ValueError(
            f"No valid OHLCV bars found for {ticker} in the selected date range."
        )

    return df


def resolve_strategy_name(ui_strategy_name: str) -> str:
    """Map UI strategy identifier or legacy alias to backend module slug."""
    return STRATEGY_MAP.get(ui_strategy_name, ui_strategy_name)


def execute_backtest(
    df: pd.DataFrame, strategy_name: str, initial_cash: float
) -> Any:
    """Execute backtest using the strategy factory and backtesting.py engine."""
    strategy_class = create_strategy(strategy_name)
    if not strategy_class:
        raise ValueError(f'Strategy "{strategy_name}" is not available.')

    bt = Backtest(df, strategy_class, cash=initial_cash, commission=0.0)
    return bt.run()


def compute_metrics(stats: Any, initial_cash: float) -> Dict[str, Any]:
    """Extract and sanitize performance metrics from backtest stats."""
    final_equity = _safe_float(
        stats.get("Equity Final [$]"), decimals=2, default=float(initial_cash)
    )
    net_profit = round(final_equity - float(initial_cash), 2)
    if net_profit == 0:
        net_profit = 0.0

    return {
        "total_return_pct": _safe_float(stats.get("Return [%]")),
        "cagr_pct": _safe_float(stats.get("Return (Ann.) [%]")),
        "sharpe": _safe_float(stats.get("Sharpe Ratio")),
        "max_drawdown_pct": _safe_float(stats.get("Max. Drawdown [%]")),
        "trades": int(_safe_float(stats.get("# Trades"), decimals=0)),
        "winrate_pct": _safe_float(stats.get("Win Rate [%]")),
        "final_equity": final_equity,
        "net_profit": net_profit,
        "buy_and_hold_return_pct": _safe_float(stats.get("Buy & Hold Return [%]")),
        "profit_factor": _safe_float(stats.get("Profit Factor")),
        "exposure_time_pct": _safe_float(stats.get("Exposure Time [%]")),
    }


def build_price_chart(df: pd.DataFrame, stats: Any) -> Dict[str, Any]:
    """Build price chart data with buy/sell signals and optional indicator overlays."""
    price_chart_data: Dict[str, Any] = {
        "dates": _index_to_epoch_ms(df.index),
        "close": sanitize_series(df["Close"]),
        "sma1": [],
        "sma2": [],
        "buy_signals": [],
        "sell_signals": [],
    }

    if hasattr(stats._strategy, "sma1"):
        price_chart_data["sma1"] = sanitize_series(stats._strategy.sma1)
    if hasattr(stats._strategy, "sma2"):
        price_chart_data["sma2"] = sanitize_series(stats._strategy.sma2)

    buy_signals = pd.Series(np.nan, index=df.index)
    sell_signals = pd.Series(np.nan, index=df.index)
    trades_df = stats.get("_trades")

    if isinstance(trades_df, pd.DataFrame) and not trades_df.empty:
        buys = trades_df[trades_df["Size"] > 0]
        sells = trades_df[trades_df["Size"] < 0]
        for _, row in buys.iterrows():
            entry_time = row["EntryTime"]
            if entry_time in buy_signals.index:
                buy_signals.at[entry_time] = row["EntryPrice"]
        for _, row in sells.iterrows():
            entry_time = row["EntryTime"]
            if entry_time in sell_signals.index:
                sell_signals.at[entry_time] = row["EntryPrice"]

    price_chart_data["buy_signals"] = sanitize_series(buy_signals)
    price_chart_data["sell_signals"] = sanitize_series(sell_signals)

    return price_chart_data


def build_equity_chart(stats: Any) -> Dict[str, Any]:
    """Build equity curve and underwater drawdown chart series."""
    equity_curve = stats["_equity_curve"]
    drawdown = (
        sanitize_series(-equity_curve["DrawdownPct"] * 100)
        if "DrawdownPct" in equity_curve.columns
        else [0.0] * len(equity_curve)
    )
    return {
        "dates": _index_to_epoch_ms(equity_curve.index),
        "equity": sanitize_series(equity_curve["Equity"]),
        "drawdown": drawdown,
    }


def build_trades_list(stats: Any) -> List[Dict[str, Any]]:
    """Build serialized execution log from backtest trade records."""
    trades_df = stats.get("_trades")
    if not isinstance(trades_df, pd.DataFrame) or trades_df.empty:
        return []

    trades: List[Dict[str, Any]] = []
    for _, row in trades_df.iterrows():
        raw_size = float(row.get("Size", 0) or 0)
        abs_size = abs(raw_size)
        size = int(abs_size) if abs_size.is_integer() else round(abs_size, 4)

        raw_return = row.get("ReturnPct")
        return_pct = (
            _safe_float(float(raw_return) * 100, decimals=2)
            if not _is_invalid_number(raw_return)
            else 0.0
        )

        trades.append(
            {
                "entry_time": _timestamp_to_epoch_ms(row.get("EntryTime")),
                "exit_time": _timestamp_to_epoch_ms(row.get("ExitTime")),
                "side": "LONG" if raw_size > 0 else "SHORT",
                "entry_price": _safe_float(row.get("EntryPrice"), decimals=2),
                "exit_price": (
                    _safe_float(row.get("ExitPrice"), decimals=2)
                    if not _is_invalid_number(row.get("ExitPrice"))
                    else None
                ),
                "size": size,
                "pnl": _safe_float(row.get("PnL"), decimals=2),
                "return_pct": return_pct,
            }
        )

    return trades


def run_backtest(validated_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Execute a stateless backtest simulation and return metrics, chart series,
    metadata, and trade execution records.
    """
    ticker = validated_data["ticker"].strip().upper()
    start = validated_data["startDate"]
    end = validated_data["endDate"]
    ui_strategy_name = validated_data["strategy"]
    initial_cash = float(validated_data["capital"])
    interval = validated_data.get("interval", "1d")

    if start >= end:
        return {"error": "Start date must be before end date."}

    try:
        df = fetch_ohlcv(ticker, start, end, interval)
        strategy_name = resolve_strategy_name(ui_strategy_name)
        stats = execute_backtest(df, strategy_name, initial_cash)

        strategy_meta = STRATEGY_BY_ID.get(strategy_name, {})
        metrics = compute_metrics(stats, initial_cash)
        price_chart_data = build_price_chart(df, stats)
        equity_chart_data = build_equity_chart(stats)
        trades = build_trades_list(stats)

        return {
            "meta": {
                "ticker": ticker,
                "strategy": strategy_name,
                "strategy_name": strategy_meta.get("name", strategy_name),
                "start_date": str(start),
                "end_date": str(end),
                "interval": interval,
                "initial_cash": round(initial_cash, 2),
            },
            "metrics": metrics,
            "price_chart": price_chart_data,
            "equity_chart": equity_chart_data,
            "trades": trades,
        }
    except ValueError as exc:
        return {"error": str(exc)}
    except Exception:
        logger.exception("Unexpected error during backtest execution for %s", ticker)
        return {"error": "An unexpected error occurred during backtest execution."}
