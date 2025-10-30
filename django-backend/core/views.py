import warnings
from typing import Any, Dict

import numpy as np
import pandas as pd
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from .serializers import BacktestSerializer
from .services.backtest import run_backtest

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

class BacktestAPIView(APIView):
    """
    API view to handle backtesting requests from the frontend.
    """

    def post(self, request, *args, **kwargs):
        serializer = BacktestSerializer(data=request.data)
        if serializer.is_valid():
            # Call the service layer
            results: Dict[str, Any] = run_backtest(serializer.validated_data)

            # Check if the service returned an error
            if "error" in results:
                return Response(results, status=status.HTTP_400_BAD_REQUEST)

            return Response(results, status=status.HTTP_200_OK)

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
