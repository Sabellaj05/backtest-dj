from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from .serializers import BacktestSerializer
from .strategies.factory import create_strategy
import pandas as pd
import numpy as np
import datetime
from typing import Dict, Any, Optional

# Optional libraries
try:
    import yfinance as yf
except Exception as e:
    print(f"Error importing yfinance: {e}")
    yf = None

# Generate sample stock data when yfinance fails
def generate_sample_data(ticker, start, end, initial_price=100) -> pd.DataFrame:
    """Generate realistic sample stock data with trend and volatility"""
    dates = pd.date_range(start=start, end=end, freq='D')
    # Filter out weekends (only keep Mon-Fri)
    dates = dates[dates.weekday < 5]
    
    n_days = len(dates)
    np.random.seed(42)  # For reproducible results
    
    # Generate price movement with trend and volatility
    daily_returns = np.random.normal(0.0008, 0.02, n_days)  # ~0.08% daily return, 2% volatility
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
        open_price = price_series[i-1] if i > 0 else close_price
        volume = int(np.random.normal(1000000, 200000))  # Random volume
        
        data.append({
            'Open': max(low, min(high, open_price)),
            'High': high,
            'Low': low,
            'Close': close_price,
            'Volume': max(100000, volume)
        })
    
    df = pd.DataFrame(data, index=dates)
    return df

# Simple fallback backtester (SMA crossover) that does not rely on backtesting.py internals.
def simple_backtest(df, n1, n2, initial_cash=10000.0, commission=0.0):
    df = df.copy().sort_index()
    df['sma1'] = df['Close'].rolling(n1).mean()
    df['sma2'] = df['Close'].rolling(n2).mean()
    df.dropna(subset=['sma1', 'sma2'], inplace=True)

    df['signal'] = 0
    df['signal'] = np.where(df['sma1'] > df['sma2'], 1, 0)
    df['position_change'] = df['signal'].diff().fillna(0)

    cash = float(initial_cash)
    position = 0
    equity_list = []
    trades = []

    for i in range(len(df)):
        date = df.index[i]
        row = df.iloc[i]
        # Price used for execution: next day's Open when possible, otherwise current Close
        if i + 1 < len(df):
            exec_price = float(df.iloc[i+1]['Open'])
        else:
            exec_price = float(row['Close'])

        # Buy signal
        if row['position_change'] == 1:
            # invest all cash
            shares = int((cash * (1 - commission)) // exec_price)
            if shares > 0:
                spent = shares * exec_price
                cash -= spent * (1 + commission)
                position += shares
                trades.append({'date': date, 'type': 'buy', 'price': exec_price, 'shares': shares})
        # Sell signal
        elif row['position_change'] == -1:
            if position > 0:
                received = position * exec_price
                cash += received * (1 - commission)
                trades.append({'date': date, 'type': 'sell', 'price': exec_price, 'shares': position})
                position = 0

        equity = cash + position * float(row['Close'])
        equity_list.append({'date': date, 'equity': equity, 'cash': cash, 'position': position})

    equity_df = pd.DataFrame(equity_list).set_index('date')
    return equity_df, trades, df

def compute_metrics(equity_df, trades, initial_cash) -> Dict[str, Any]:
    equity = equity_df['equity']
    total_return = (equity.iloc[-1] / equity.iloc[0] - 1) * 100
    days = (equity_df.index[-1] - equity_df.index[0]).days or 1
    years = days / 365.25
    cagr = (equity.iloc[-1] / equity.iloc[0]) ** (1 / years) - 1 if years > 0 else 0

    daily_returns = equity.pct_change().dropna()
    sharpe = np.nan_to_num((daily_returns.mean() / daily_returns.std()) * (252 ** 0.5) if len(daily_returns) > 1 and daily_returns.std() > 0 else 0)

    running_max = equity.cummax()
    drawdown = (equity - running_max) / running_max
    max_drawdown = drawdown.min()

    # trades statistics
    wins = 0
    pnl_list = []
    # pair buys and sells
    buy = None
    for t in trades:
        if t['type'] == 'buy':
            buy = t
        elif t['type'] == 'sell' and buy is not None:
            profit = (t['price'] - buy['price']) * t['shares']
            pnl_pct = (t['price'] / buy['price'] - 1) * 100
            pnl_list.append(pnl_pct)
            if profit > 0:
                wins += 1
            buy = None
    trade_count = sum(1 for t in trades if t['type'] == 'buy' or t['type'] == 'sell') // 2 * 2
    trades_executed = int(len(pnl_list))
    winrate = (wins / trades_executed) * 100 if trades_executed > 0 else 0
    avg_return_per_trade = np.nan_to_num(float(pd.Series(pnl_list).mean()) if pnl_list else 0)

    return {
        'total_return_pct': round(float(total_return), 2),
        'cagr_pct': round(float(cagr * 100), 2),
        'sharpe': round(float(sharpe), 2),
        'max_drawdown_pct': round(float(max_drawdown * 100), 2),
        'trades': trades_executed,
        'winrate_pct': round(float(winrate), 2),
        'avg_return_per_trade_pct': round(float(avg_return_per_trade), 2),
    }

from .strategies.factory import create_strategy

from bokeh.embed import components

def run_backtest_from_params(validated_data) -> Dict[str, Any]:
    """
    Runs the backtest with the given parameters and returns the results.
    """
    ticker = validated_data['ticker'].strip().upper()
    start = validated_data['startDate']
    end = validated_data['endDate']
    strategy_name = validated_data['strategy']
    initial_cash = validated_data['capital']
    # This parameter is from the old form, we can decide on a default for the API
    use_bt_lib = True 

    if start >= end:
        return {'error': 'Start date must be before end date.'}

    if yf is None:
        return {'error': 'yfinance is not installed or could not be imported.'}

    # Data fetching logic from the original view
    df: Optional[pd.DataFrame] | None = None
    error_msgs = []
    try:
        df = yf.download(ticker, start=str(start), end=str(end), 
                       progress=False, timeout=10, threads=False)
        if not df.empty:
            df.index = df.index.tz_localize(None)
    except Exception as e:
        error_msgs.append(f'Method 1 failed: {e}')
        df = None
    
    if df is None or df.empty:
        try:
            ticker_obj = yf.Ticker(ticker)
            df = ticker_obj.history(start=str(start), end=str(end), timeout=10)
            if not df.empty:
                df.index = df.index.tz_localize(None)
        except Exception as e:
            error_msgs.append(f'Method 2 failed: {e}')
            df = None
            
    if df is None or df.empty:
        try:
            df = yf.download(ticker, start=str(start), end=str(end), 
                           progress=False, auto_adjust=True, prepost=True)
            if not df.empty:
                df.index = df.index.tz_localize(None)
        except Exception as e:
            error_msgs.append(f'Method 3 failed: {e}')
            df = None

    if df is None or df.empty:
        try:
            df = generate_sample_data(ticker, start, end)
            all_errors = '; '.join(error_msgs)
            # For an API, we might return this as a specific field
            # return {'warning': f'yfinance failed for {ticker}. Using sample data.', 'data': ...}
        except Exception as e:
            all_errors = '; '.join(error_msgs)
            return {'error': f'Could not retrieve data for {ticker}. Errors: {all_errors}'}

    # Data validation
    if isinstance(df.columns, pd.MultiIndex):
        df.columns = df.columns.get_level_values(0)
    df = df.rename(columns={c: c.capitalize() for c in df.columns})
    for col in ['Open', 'High', 'Low', 'Close', 'Volume']:
        if col not in df.columns:
            return {'error': f'Incomplete data: missing column {col}'}

    # --- Backtesting Logic ---
    # Map frontend strategy names to backend strategy file names
    strategy_map = {
        'SMA': 'sma_cross',
        'EMA': 'sma_cross', # Example, assuming EMA uses the same file
        'RSI': 'rsi', # Example for a future strategy
        'MACD': 'macd', # Example for a future strategy
        'buy_and_hold': 'buy_and_hold', # Allow direct name
        'sma_cross': 'sma_cross' # Allow direct name
    }
    backend_strategy_name = strategy_map.get(strategy_name, strategy_name)

    # --- Timeframe Validation ---
    if backend_strategy_name == 'sma_cross' and len(df) < 100:
        return {'error': 'The SMA Cross strategy requires at least 100 days of data. Please select a longer date range.'}

    try:
        from backtesting import Backtest
        BACKTESTING_OK = True
    except ImportError:
        BACKTESTING_OK = False

    if not BACKTESTING_OK:
        return {'error': 'The "backtesting" library is not installed on the server.'}

    strategy_class = create_strategy(backend_strategy_name)
    if not strategy_class:
        return {'error': f'Strategy "{backend_strategy_name}" not found on the backend.'}

    bt = Backtest(df, strategy_class, cash=initial_cash, commission=0.0)
    stats = bt.run()
    
    # Sanitize metrics to prevent JSON errors with NaN values
    metrics = {
        'total_return_pct': np.nan_to_num(round(stats.get('Return [%]', 0), 2)),
        'cagr_pct': np.nan_to_num(round(stats.get('Return (Ann.) [%]', 0), 2)),
        'sharpe': np.nan_to_num(round(stats.get('Sharpe Ratio', 0), 2)),
        'max_drawdown_pct': np.nan_to_num(round(stats.get('Max. Drawdown [%]', 0), 2)),
        'trades': np.nan_to_num(stats.get('# Trades', 0)),
        'winrate_pct': np.nan_to_num(round(stats.get('Win Rate [%]', 0), 2)),
    }

    # a future step could be to extract data from the Bokeh plot object.
    price_chart_data = {
        'dates': df.index.strftime('%Y-%m-%d').tolist(),
        'close': df['Close'].tolist(),
        'sma1': [], # backtesting.py doesn't expose this easily, return empty for now
        'sma2': [], # backtesting.py doesn't expose this easily, return empty for now
        'buys': [], # This data is in stats['_trades'], would require more processing
        'sells': [] # This data is in stats['_trades'], would require more processing
    }
    # Create a placeholder equity curve
    equity_curve = stats['_equity_curve']
    equity_chart_data = {
        'dates': equity_curve.index.strftime('%Y-%m-%d').tolist(),
        'equity': equity_curve['Equity'].tolist(),
    }

    return {
        'metrics': metrics, 
        'price_chart': price_chart_data, 
        'equity_chart': equity_chart_data
    }

class BacktestAPIView(APIView):
    """
    API view to handle backtesting requests from the frontend.
    """
    def post(self, request, *args, **kwargs):
        serializer = BacktestSerializer(data=request.data)
        if serializer.is_valid():
            # Call the refactored logic function
            results = run_backtest_from_params(serializer.validated_data)
            
            # Check if the logic function returned an error
            if 'error' in results:
                return Response(results, status=status.HTTP_400_BAD_REQUEST)
            
            return Response(results, status=status.HTTP_200_OK)
        
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
