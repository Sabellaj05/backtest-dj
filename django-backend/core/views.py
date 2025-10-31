import datetime
import warnings
from typing import Any, Dict, Optional

import numpy as np
import pandas as pd
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from .serializers import BacktestSerializer
from django.utils import timezone
from .models import BacktestRun, Trade, EquityPoint
from .strategies.factory import create_strategy

from backtesting import Backtest
import yfinance as yf

warnings.simplefilter(action="ignore", category=FutureWarning)

# Generate sample stock data when yfinance fails
def generate_sample_data(ticker, start, end, initial_price=100) -> pd.DataFrame:
    """Generate realistic sample stock data with trend and volatility"""
    dates = pd.date_range(start=start, end=end, freq="D")
    # Filter out weekends (only keep Mon-Fri)
    dates = dates[dates.weekday < 5]

    n_days = len(dates)
    np.random.seed(42)  # For reproducible results

    # Generate price movement with trend and volatility
    daily_returns = np.random.normal(
        0.0008, 0.02, n_days
    )  # ~0.08% daily return, 2% volatility
    # Add a slight upward trend
    trend = np.linspace(0, 0.001, n_days)
    daily_returns += trend

    # Calculate cumulative prices
    price_series = [initial_price]
    for i in range(1, n_days):
        new_price = price_series[-1] * (1 + daily_returns[i])
        price_series.append(new_price)

    # Generate OHLC data with realistic intraday movements
    data = []
    for i, (date, close_price) in enumerate(zip(dates, price_series)):
        daily_vol = abs(np.random.normal(0, 0.015))  # Daily volatility
        high = close_price * (1 + daily_vol)
        low = close_price * (1 - daily_vol)
        open_price = price_series[i - 1] if i > 0 else close_price
        volume = int(np.random.normal(1000000, 200000))  # Random volume

        data.append(
            {
                "Open": max(low, min(high, open_price)),
                "High": high,
                "Low": low,
                "Close": close_price,
                "Volume": max(100000, volume),
            }
        )

    df = pd.DataFrame(data, index=dates)
    return df


# Simple fallback backtester (SMA crossover) that does not rely on backtesting.py internals.
def simple_backtest(df, n1, n2, initial_cash=10000.0, commission=0.0):
    df = df.copy().sort_index()
    df["sma1"] = df["Close"].rolling(n1).mean()
    df["sma2"] = df["Close"].rolling(n2).mean()
    df.dropna(subset=["sma1", "sma2"], inplace=True)

    df["signal"] = 0
    df["signal"] = np.where(df["sma1"] > df["sma2"], 1, 0)
    df["position_change"] = df["signal"].diff().fillna(0)

    cash = float(initial_cash)
    position = 0
    equity_list = []
    trades = []

    for i in range(len(df)):
        date = df.index[i]
        row = df.iloc[i]
        # Price used for execution: next day's Open when possible, otherwise current Close
        if i + 1 < len(df):
            exec_price = float(df.iloc[i + 1]["Open"])
        else:
            exec_price = float(row["Close"])

        # Buy signal
        if row["position_change"] == 1:
            # invest all cash
            shares = int((cash * (1 - commission)) // exec_price)
            if shares > 0:
                spent = shares * exec_price
                cash -= spent * (1 + commission)
                position += shares
                trades.append(
                    {"date": date, "type": "buy", "price": exec_price, "shares": shares}
                )
        # Sell signal
        elif row["position_change"] == -1:
            if position > 0:
                received = position * exec_price
                cash += received * (1 - commission)
                trades.append(
                    {
                        "date": date,
                        "type": "sell",
                        "price": exec_price,
                        "shares": position,
                    }
                )
                position = 0

        equity = cash + position * float(row["Close"])
        equity_list.append(
            {"date": date, "equity": equity, "cash": cash, "position": position}
        )

    equity_df = pd.DataFrame(equity_list).set_index("date")
    return equity_df, trades, df


def sanitize_series(series_or_list):
    """Replaces NaN/inf with None and converts valid numbers to standard floats."""
    return [
        None if x is None or np.isnan(x) or np.isinf(x) else float(x)
        for x in series_or_list
    ]


def run_backtest_from_params(validated_data) -> Dict[str, Any]:
    """
    Runs the backtest with the given parameters and returns the results.
    """
    ticker = validated_data["ticker"].strip().upper()
    start = validated_data["startDate"]
    end = validated_data["endDate"]
    strategy_name = validated_data["strategy"]
    initial_cash = validated_data["capital"]
    interval = validated_data.get("interval", "1d")

    if start >= end:
        return {"error": "Start date must be before end date."}

    if yf is None:
        return {"error": "yfinance is not installed or could not be imported."}

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
        return {"error": f"Could not retrieve data for {ticker}."}

    if isinstance(df.columns, pd.MultiIndex):
        df.columns = df.columns.get_level_values(0)
    df = df.rename(columns={c: c.capitalize() for c in df.columns})
    for col in ["Open", "High", "Low", "Close", "Volume"]:
        if col not in df.columns:
            return {"error": f"Incomplete data: missing column {col}"}

    strategy_map = {
        "SMA": "sma_cross",
        "EMA": "sma_cross",
        "RSI": "rsi",
        "MACD": "macd",
        "LA_BOMBA": "la_bomba",
        "buy_and_hold": "buy_and_hold",
        "sma_cross": "sma_cross",
    }
    backend_strategy_name = strategy_map.get(strategy_name, strategy_name)

    strategy_class = create_strategy(backend_strategy_name)
    if not strategy_class:
        return {"error": f'Strategy "{backend_strategy_name}" not found.'}

    # instanciamos el backtester
    bt = Backtest(df, strategy_class, cash=initial_cash, commission=0.0)
    # resultados
    stats = bt.run()

    def get_safe_metric(value):
        if value is None or np.isnan(value) or np.isinf(value):
            return 0
        return round(value, 2)

    metrics = {
        "total_return_pct": get_safe_metric(stats.get("Return [%]")),
        "cagr_pct": get_safe_metric(stats.get("Return (Ann.) [%]")),
        "sharpe": get_safe_metric(stats.get("Sharpe Ratio")),
        "max_drawdown_pct": get_safe_metric(stats.get("Max. Drawdown [%]")),
        "trades": int(get_safe_metric(stats.get("# Trades"))),
        "winrate_pct": get_safe_metric(stats.get("Win Rate [%]")),
    }

    # date_format = (
    #     "%Y-%m-%d %H:%M:%S" if interval not in ["1d", "1wk", "1mo"] else "%Y-%m-%d"
    # )

    price_chart_data = {
        "dates": (df.index.astype(np.int64) // 10**6).tolist(),
        "close": sanitize_series(df["Close"]),
        "sma1": [],
        "sma2": [],
        "buys": [],
        "sells": [],
    }

    if hasattr(stats._strategy, "sma1"):
        price_chart_data["sma1"] = sanitize_series(stats._strategy.sma1)
    if hasattr(stats._strategy, "sma2"):
        price_chart_data["sma2"] = sanitize_series(stats._strategy.sma2)

    # Create unified buy/sell signal series
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

    equity_curve = stats["_equity_curve"]
    equity_chart_data = {
        "dates": (equity_curve.index.astype(np.int64) // 10**6).tolist(),
        "equity": sanitize_series(equity_curve["Equity"]),
    }

    # Persist run, trades, and equity curve
    try:
        run = BacktestRun.objects.create(
            ticker=ticker,
            start_date=start,
            end_date=end,
            strategy=backend_strategy_name,
            starting_capital=initial_cash,
            interval=interval,
            total_return_pct=float(metrics["total_return_pct"]),
            cagr_pct=float(metrics["cagr_pct"]),
            sharpe=float(metrics["sharpe"]),
            max_drawdown_pct=float(metrics["max_drawdown_pct"]),
            trades=int(metrics["trades"]),
            winrate_pct=float(metrics["winrate_pct"]),
        )

        # Persist trades (completed trades from trades_df)
        trade_rows = []
        if isinstance(trades_df, pd.DataFrame) and not trades_df.empty:
            for _, row in trades_df.iterrows():
                entry_time = row.get("EntryTime")
                exit_time = row.get("ExitTime")
                # Convert to aware datetimes if needed
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

                entry_price = float(row.get("EntryPrice", np.nan)) if pd.notna(row.get("EntryPrice")) else None
                exit_price = float(row.get("ExitPrice", np.nan)) if pd.notna(row.get("ExitPrice")) else None
                size = float(row.get("Size", 0) or 0)
                pnl = float(row.get("PnL", np.nan)) if pd.notna(row.get("PnL")) else None
                return_pct = float(row.get("ReturnPct", np.nan)) if pd.notna(row.get("ReturnPct")) else None

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
        if isinstance(equity_curve, pd.DataFrame) and not equity_curve.empty:
            for ts, erow in equity_curve.iterrows():
                ts_dt = ts.to_pydatetime()
                if getattr(ts_dt, "tzinfo", None) is None:
                    ts_dt = timezone.make_aware(ts_dt)
                equity_val = float(erow.get("Equity", np.nan))
                if not np.isnan(equity_val) and not np.isinf(equity_val):
                    equity_rows.append(EquityPoint(run=run, timestamp=ts_dt, equity=equity_val))

        if equity_rows:
            EquityPoint.objects.bulk_create(equity_rows, batch_size=1000)
    except Exception as e:
        # Do not fail the API if persistence fails; surface metrics to user regardless
        print(f"Persistence error: {e}")

    return {
        "metrics": metrics,
        "price_chart": price_chart_data,
        "equity_chart": equity_chart_data,
    }


class BacktestAPIView(APIView):
    """
    API view to handle backtesting requests from the frontend.
    """

    def post(self, request, *args, **kwargs):
        serializer = BacktestSerializer(data=request.data)
        if serializer.is_valid():
            # Call the refactored logic function
            results: Dict[str, Any] = run_backtest_from_params(
                serializer.validated_data
            )

            # Check if the logic function returned an error
            if "error" in results:
                return Response(results, status=status.HTTP_400_BAD_REQUEST)

            return Response(results, status=status.HTTP_200_OK)

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
