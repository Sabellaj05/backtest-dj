"""
Backtest service layer for executing and persisting backtest results.
"""
import warnings
from typing import Any, Dict, Optional

import numpy as np
import pandas as pd
from backtesting import Backtest
import yfinance as yf
from django.utils import timezone

from ..strategies.factory import create_strategy
from ..models import BacktestRun, Trade, EquityPoint

warnings.simplefilter(action="ignore", category=FutureWarning)


# Strategy name mapping from UI to backend implementation
STRATEGY_MAP = {
    "SMA": "sma_cross",
    "EMA": "sma_cross",
    "RSI": "rsi",
    "MACD": "macd",
    "LA_BOMBA": "la_bomba",
    "buy_and_hold": "buy_and_hold",
    "sma_cross": "sma_cross",
}


def sanitize_series(series_or_list):
    """Replaces NaN/inf with None and converts valid numbers to standard floats."""
    return [
        None if x is None or np.isnan(x) or np.isinf(x) else float(x)
        for x in series_or_list
    ]


def fetch_ohlcv(ticker: str, start, end, interval: str = "1d") -> pd.DataFrame:
    """
    Fetch OHLCV data from yfinance.
    
    Args:
        ticker: Stock ticker symbol
        start: Start date
        end: End date
        interval: Data interval (1d, 1wk, etc.)
        
    Returns:
        DataFrame with Open, High, Low, Close, Volume columns
        
    Raises:
        ValueError: If data cannot be retrieved or is incomplete
    """
    ticker = ticker.strip().upper()
    
    df: Optional[pd.DataFrame] | None = None
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
        if not df.empty:
            df.index = df.index.tz_localize(None)
    except Exception:
        df = None
    
    if df is None or df.empty:
        try:
            ticker_obj = yf.Ticker(ticker)
            df = ticker_obj.history(
                start=str(start), end=str(end), interval=interval, timeout=10
            )
            if not df.empty:
                df.index = df.index.tz_localize(None)
        except Exception:
            df = None
    
    if df is None or df.empty:
        raise ValueError(f"Could not retrieve data for {ticker}.")
    
    # Handle MultiIndex columns
    if isinstance(df.columns, pd.MultiIndex):
        df.columns = df.columns.get_level_values(0)
    df = df.rename(columns={c: c.capitalize() for c in df.columns})
    
    # Validate required columns
    required_cols = ["Open", "High", "Low", "Close", "Volume"]
    for col in required_cols:
        if col not in df.columns:
            raise ValueError(f"Incomplete data: missing column {col}")
    
    return df


def resolve_strategy_name(ui_strategy_name: str) -> str:
    """
    Map UI strategy name to backend implementation name using strategy factory.
    
    Args:
        ui_strategy_name: Name from frontend
        
    Returns:
        Backend strategy name
    """
    return STRATEGY_MAP.get(ui_strategy_name, ui_strategy_name)


def execute_backtest(
    df: pd.DataFrame, strategy_name: str, initial_cash: float
) -> Any:
    """
    Execute backtest using the strategy factory.
    
    Args:
        df: OHLCV DataFrame
        strategy_name: Backend strategy name
        initial_cash: Starting capital
        
    Returns:
        Backtest stats object
        
    Raises:
        ValueError: If strategy not found
    """
    # factory 
    strategy_class = create_strategy(strategy_name)
    if not strategy_class:
        raise ValueError(f'Strategy "{strategy_name}" not found.')
    
    bt = Backtest(df, strategy_class, cash=initial_cash, commission=0.0)
    return bt.run()


def compute_metrics(stats: Any) -> Dict[str, Any]:
    """
    Extract and sanitize metrics from backtest stats.
    
    Args:
        stats: Backtest stats object from backtesting library
        
    Returns:
        Dictionary of metrics
    """
    def get_safe_metric(value):
        if value is None or np.isnan(value) or np.isinf(value):
            return 0
        return round(value, 2)
    
    return {
        "total_return_pct": get_safe_metric(stats.get("Return [%]")),
        "cagr_pct": get_safe_metric(stats.get("Return (Ann.) [%]")),
        "sharpe": get_safe_metric(stats.get("Sharpe Ratio")),
        "max_drawdown_pct": get_safe_metric(stats.get("Max. Drawdown [%]")),
        "trades": int(get_safe_metric(stats.get("# Trades"))),
        "winrate_pct": get_safe_metric(stats.get("Win Rate [%]")),
    }


def build_price_chart(df: pd.DataFrame, stats: Any) -> Dict[str, Any]:
    """
    Build price chart data with buy/sell signals and optional overlays.
    
    Args:
        df: OHLCV DataFrame
        stats: Backtest stats object
        
    Returns:
        Dictionary with dates, close, indicators, and signals
    """
    price_chart_data = {
        "dates": (df.index.astype(np.int64) // 10**6).tolist(),
        "close": sanitize_series(df["Close"]),
        "sma1": [],
        "sma2": [],
        "buy_signals": [],
        "sell_signals": [],
    }
    
    # Add SMA overlays if available
    if hasattr(stats._strategy, "sma1"):
        price_chart_data["sma1"] = sanitize_series(stats._strategy.sma1)
    if hasattr(stats._strategy, "sma2"):
        price_chart_data["sma2"] = sanitize_series(stats._strategy.sma2)
    
    # Extract buy/sell signals from trades
    buy_signals = pd.Series(np.nan, index=df.index)
    sell_signals = pd.Series(np.nan, index=df.index)
    trades_df = stats["_trades"]
    
    if not trades_df.empty:
        buys = trades_df[trades_df["Size"] > 0]
        sells = trades_df[trades_df["Size"] < 0]
        buy_signals.loc[buys["EntryTime"]] = buys["EntryPrice"].values
        sell_signals.loc[sells["EntryTime"]] = sells["EntryPrice"].values
    
    price_chart_data["buy_signals"] = sanitize_series(buy_signals)
    price_chart_data["sell_signals"] = sanitize_series(sell_signals)
    
    return price_chart_data


def build_equity_chart(stats: Any) -> Dict[str, Any]:
    """
    Build equity curve chart data.
    
    Args:
        stats: Backtest stats object
        
    Returns:
        Dictionary with dates and equity values
    """
    equity_curve = stats["_equity_curve"]
    return {
        "dates": (equity_curve.index.astype(np.int64) // 10**6).tolist(),
        "equity": sanitize_series(equity_curve["Equity"]),
    }


def persist_backtest_results(
    ticker: str,
    start,
    end,
    strategy_name: str,
    interval: str,
    initial_cash: float,
    metrics: Dict[str, Any],
    stats: Any,
) -> None:
    """
    Persist backtest run, trades, and equity curve to database.
    
    Args:
        ticker: Stock ticker
        start: Start date
        end: End date
        strategy_name: Backend strategy name
        interval: Data interval
        initial_cash: Starting capital
        metrics: Computed metrics dictionary
        stats: Backtest stats object
    """
    try:
        # Create main run record
        run = BacktestRun.objects.create(
            ticker=ticker,
            start_date=start,
            end_date=end,
            strategy=strategy_name,
            starting_capital=initial_cash,
            interval=interval,
            total_return_pct=float(metrics["total_return_pct"]),
            cagr_pct=float(metrics["cagr_pct"]),
            sharpe=float(metrics["sharpe"]),
            max_drawdown_pct=float(metrics["max_drawdown_pct"]),
            trades=int(metrics["trades"]),
            winrate_pct=float(metrics["winrate_pct"]),
        )
        
        # Persist trades
        trade_rows = []
        trades_df = stats["_trades"]
        
        if isinstance(trades_df, pd.DataFrame) and not trades_df.empty:
            for _, row in trades_df.iterrows():
                entry_time = row.get("EntryTime")
                exit_time = row.get("ExitTime")
                
                # Convert to aware datetimes
                if pd.notna(entry_time):
                    if getattr(entry_time, "tzinfo", None) is None:
                        entry_time = timezone.make_aware(entry_time.to_pydatetime())
                    else:
                        entry_time = entry_time.to_pydatetime()
                else:
                    entry_time = None
                    
                if pd.notna(exit_time):
                    if getattr(exit_time, "tzinfo", None) is None:
                        exit_time = timezone.make_aware(exit_time.to_pydatetime())
                    else:
                        exit_time = exit_time.to_pydatetime()
                else:
                    exit_time = None
                
                entry_price = (
                    float(row.get("EntryPrice", np.nan))
                    if pd.notna(row.get("EntryPrice"))
                    else None
                )
                exit_price = (
                    float(row.get("ExitPrice", np.nan))
                    if pd.notna(row.get("ExitPrice"))
                    else None
                )
                size = float(row.get("Size", 0) or 0)
                pnl = float(row.get("PnL", np.nan)) if pd.notna(row.get("PnL")) else None
                return_pct = (
                    float(row.get("ReturnPct", np.nan))
                    if pd.notna(row.get("ReturnPct"))
                    else None
                )
                
                duration_seconds = None
                if entry_time and exit_time:
                    duration_seconds = int((exit_time - entry_time).total_seconds())
                
                trade_rows.append(
                    Trade(
                        run=run,
                        entry_time=entry_time,
                        exit_time=exit_time,
                        entry_price=entry_price if entry_price is not None else 0.0,
                        exit_price=exit_price,
                        size=size,
                        pnl=pnl,
                        return_pct=return_pct,
                        duration_seconds=duration_seconds,
                    )
                )
        
        if trade_rows:
            Trade.objects.bulk_create(trade_rows, batch_size=500)
        
        # Persist equity curve
        equity_rows = []
        equity_curve = stats["_equity_curve"]
        
        if isinstance(equity_curve, pd.DataFrame) and not equity_curve.empty:
            for ts, erow in equity_curve.iterrows():
                ts_dt = ts.to_pydatetime()
                if getattr(ts_dt, "tzinfo", None) is None:
                    ts_dt = timezone.make_aware(ts_dt)
                equity_val = float(erow.get("Equity", np.nan))
                if not np.isnan(equity_val) and not np.isinf(equity_val):
                    equity_rows.append(
                        EquityPoint(run=run, timestamp=ts_dt, equity=equity_val)
                    )
        
        if equity_rows:
            EquityPoint.objects.bulk_create(equity_rows, batch_size=1000)
            
    except Exception as e:
        # Do not fail the API if persistence fails
        print(f"Persistence error: {e}")


def run_backtest(validated_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Main service entry point: execute backtest and return results.
    
    This function orchestrates the entire backtest workflow:
    1. Validate dates
    2. Fetch OHLCV data
    3. Resolve strategy name
    4. Execute backtest
    5. Compute metrics and build charts
    6. Persist results
    7. Return response payload
    
    Args:
        validated_data: Validated input from serializer
        
    Returns:
        Dictionary with metrics, price_chart, and equity_chart
    """
    ticker = validated_data["ticker"].strip().upper()
    start = validated_data["startDate"]
    end = validated_data["endDate"]
    ui_strategy_name = validated_data["strategy"]
    initial_cash = validated_data["capital"]
    interval = validated_data.get("interval", "1d")
    
    # Validate dates
    if start >= end:
        return {"error": "Start date must be before end date."}
    
    try:
        # Fetch data
        df = fetch_ohlcv(ticker, start, end, interval)
        
        # Resolve strategy name through factory
        strategy_name = resolve_strategy_name(ui_strategy_name)
        
        # Execute backtest
        stats = execute_backtest(df, strategy_name, initial_cash)
        
        # Build response data
        metrics = compute_metrics(stats)
        price_chart_data = build_price_chart(df, stats)
        equity_chart_data = build_equity_chart(stats)
        
        # Persist results (non-blocking)
        persist_backtest_results(
            ticker=ticker,
            start=start,
            end=end,
            strategy_name=strategy_name,
            interval=interval,
            initial_cash=initial_cash,
            metrics=metrics,
            stats=stats,
        )
        
        return {
            "metrics": metrics,
            "price_chart": price_chart_data,
            "equity_chart": equity_chart_data,
        }
        
    except ValueError as e:
        return {"error": str(e)}
    except Exception as e:
        # Catch-all for unexpected errors
        print(f"Unexpected error in run_backtest: {e}")
        return {"error": "An unexpected error occurred during backtest execution."}

