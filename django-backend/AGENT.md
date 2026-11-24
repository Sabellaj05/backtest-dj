# Backtester Backend Guide

Stateless Django 5 + Django REST Framework JSON API powering QuantFlow backtest simulations.

## Stack

- **Framework**: Django 5 + Django REST Framework (no database, sessions, auth, or admin)
- **Market Data**: `yfinance`
- **Backtesting Engine**: `backtesting.py`
- **CORS**: `django-cors-headers`

## Structure

- `backtester/settings.py`: Stateless API configuration (`DATABASES = {}`, JSON renderer, CORS).
- `backtester/urls.py`: Delegates root URLs to `core.urls`.
- `core/urls.py`:
  - `GET /api/v1/healthcheck/` -> `HealthCheckView`
  - `GET /api/v1/strategies/` -> `StrategyListAPIView`
  - `POST /api/v1/backtest/` -> `BacktestAPIView`
- `core/serializers.py`: `BacktestSerializer` validating ticker format, date ordering, strategy key, capital bounds, and bar interval.
- `core/services/backtest.py`: Service layer handling `yfinance` OHLCV retrieval, strategy resolution, `backtesting.py` execution, metric extraction, chart series construction, and trade list serialization.
- `core/strategies/`: Dynamic strategy factory (`factory.py`) and implementations (`sma_cross.py`, `la_bomba.py`, `buy_and_hold.py`).
- `core/tests.py`: `SimpleTestCase` + `APIClient` tests using mocked OHLCV fixtures.

## Contracts

### `POST /api/v1/backtest/` Input

- `ticker`: string (`^[A-Z0-9.-^=]+$`, max 20)
- `startDate`: date (`YYYY-MM-DD`)
- `endDate`: date (`YYYY-MM-DD`, strictly after `startDate`)
- `strategy`: `sma_cross` | `la_bomba` | `buy_and_hold` (also accepts legacy UI aliases `SMA`, `LA_BOMBA`, `BUY_AND_HOLD`)
- `capital`: float (`1.0` to `1,000,000,000.0`)
- `interval`: optional `1d` | `1h` | `1wk` | `1mo` (default `1d`)

### `POST /api/v1/backtest/` Output

- `meta`: `{ ticker, strategy, strategy_name, start_date, end_date, interval, initial_cash }`
- `metrics`: `{ total_return_pct, cagr_pct, sharpe, max_drawdown_pct, trades, winrate_pct, final_equity, net_profit, buy_and_hold_return_pct, profit_factor, exposure_time_pct }`
- `price_chart`: `{ dates, close, sma1, sma2, buy_signals, sell_signals }`
- `equity_chart`: `{ dates, equity, drawdown }`
- `trades`: `[{ entry_time, exit_time, side, entry_price, exit_price, size, pnl, return_pct }]`
