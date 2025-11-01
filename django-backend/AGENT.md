## Backtester Backend – Agent Guide

This document orients agents working on the Django backend of the Backtester app. It summarizes the architecture, key modules, request/response flow, current persistence model, and near‑term extensions.

### Stack
- **Framework**: Django 5 + Django REST Framework
- **Data**: SQLite (default, per settings)
- **Market Data**: `yfinance`
- **Backtesting engine**: `backtesting` Python library (used when installed)
- **CORS**: `django-cors-headers` enabled for local dev

### Top‑Level Structure
- Project: `backtester`
  - URLs include `core.urls`
  - DB: SQLite at `backtester/db.sqlite3`
- App: `core`
  - API endpoint: `POST /api/v1/backtest/`
  - `views.py`: Thin API endpoint delegating to service layer
  - `services/backtest.py`: Service layer orchestrating backtest execution and persistence
  - `serializers.py`: `BacktestSerializer` input validation
  - `models.py`: ORM models for persistence
  - `strategies/`: Strategy factory and implementations (e.g., `sma_cross`, `buy_and_hold`, `la_bomba`)
  - `admin.py`: Django admin configuration for models

### Request Flow
1. Frontend posts form data to `POST /api/v1/backtest/`.
2. `BacktestAPIView.post` validates payload with `BacktestSerializer`.
3. Delegates to service layer: `run_backtest()` from `core.services.backtest`.
4. Service orchestrates:
   - Downloads OHLCV from `yfinance` with interval handling (`fetch_ohlcv`)
   - Normalizes columns (`Open/High/Low/Close/Volume`)
   - Maps UI strategy name to backend slug via `resolve_strategy_name`
   - Executes backtest using `execute_backtest` which uses `core.strategies.factory.create_strategy`
   - Builds metrics, price chart, and equity curve
   - Persists results to database
5. Response returns `{ metrics, price_chart, equity_chart }` or `{ error }` with appropriate status code.

### Key Files (pointers)
- Routing:
```20:23:/Users/saens/thecode/web/django-project/django-backend/backtester/urls.py
urlpatterns = [
    path('admin/', admin.site.urls),
    path('', include("core.urls")),
]
```
- API endpoint:
```6:8:/Users/saens/thecode/web/django-project/django-backend/core/urls.py
urlpatterns = [
    path('api/v1/backtest/', views.BacktestAPIView.as_view(), name='api_backtest'),
]
```
- API view:
```131:148:/Users/saens/thecode/web/django-project/django-backend/core/views.py
class BacktestAPIView(APIView):
    def post(self, request, *args, **kwargs):
        serializer = BacktestSerializer(data=request.data)
        if serializer.is_valid():
            results = run_backtest(serializer.validated_data)
            if "error" in results:
                return Response(results, status=status.HTTP_400_BAD_REQUEST)
            return Response(results, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
```

### Input Contract (BacktestSerializer)
- `ticker`: string (max 20)
- `startDate`: date
- `endDate`: date (must be after start)
- `strategy`: string (max 100)
- `capital`: float
- `interval`: string (optional, default `1d`)

### Output Contract (current)
- `metrics`: `{ total_return_pct, cagr_pct, sharpe, max_drawdown_pct, trades, winrate_pct }`
- `price_chart`: `{ dates, close, sma1?, sma2?, buy_signals, sell_signals }`
- `equity_chart`: `{ dates, equity }`

Dates are returned as epoch millis (ns // 1e6) arrays.

### Strategies
- Strategy mapping bridges UI names to implementations:
  - `SMA` → `sma_cross`
  - `EMA` → `sma_cross` (placeholder)
  - `RSI` → `rsi` (planned)
  - `MACD` → `macd` (planned)
  - `LA_BOMBA` → `la_bomba`
  - `buy_and_hold` → `buy_and_hold`
- Strategy classes are resolved via `core.strategies.factory.create_strategy` and run by `backtesting.Backtest`.

### Persistence Models

**Implemented V3 Full-Fidelity Schema** in `core/models.py`:

- **`BacktestRun`**: Main run record with configuration and summary metrics
  - Fields: ticker, start_date, end_date, strategy, starting_capital, interval
  - Metrics: total_return_pct, cagr_pct, sharpe, max_drawdown_pct, trades, winrate_pct
  - Indexed on `(ticker, strategy, start_date, end_date)`
  
- **`Trade`**: Individual trade records (FK to `BacktestRun`)
  - Fields: entry_time, exit_time, entry_price, exit_price, size, pnl, return_pct, duration_seconds
  - Indexed on `(run, entry_time)`
  
- **`EquityPoint`**: Equity curve data points (FK to `BacktestRun`)
  - Fields: timestamp, equity
  - Indexed on `(run, timestamp)`

All runs are automatically persisted on successful completion via the service layer.

### Data Mapping (serializer → model)
- `ticker` → `ticker`
- `startDate` → `start_date`
- `endDate` → `end_date`
- `strategy` → `strategy`
- `capital` → `starting_capital`
- Metrics computed in `run_backtest_from_params` map 1:1 to model fields.

### Next Steps for Agents
1. Wire persistence in `BacktestAPIView.post` after successful run:
   - Create and save `BacktestResult` with request params and returned metrics.
2. Add an endpoint to list past runs (e.g., `GET /api/v1/backtests/`) with pagination and filtering by ticker/strategy/date.
3. Optionally extend the model with JSON fields for charts.
4. Migrations: run `makemigrations` and `migrate`.

### Ops & Settings
- DB: SQLite configured in settings; can swap to Postgres later without code changes in app layer.
- CORS: local origins allowed via regex.
- Security: `SECRET_KEY` is dev‑only; rotate for prod.

### Known Considerations
- `yfinance` availability: errors surface as `{ error }`; ensure frontend handles 400 with message.
- Interval handling changes date format and data density; epoch‑millis used to keep frontend rendering consistent.
- Strategy placeholders (`EMA`, `RSI`, `MACD`) currently route to available implementations; add real strategies later.

---

## Refactoring (Latest)

The backtest execution flow has been refactored into a service layer for better modularity and testability.

### Architecture

**Service Layer (`core/services/backtest.py`)**:
- `run_backtest()`: Main orchestration entry point
- `fetch_ohlcv()`: Data retrieval from yfinance
- `resolve_strategy_name()`: Maps UI strategy names to backend implementations
- `execute_backtest()`: Executes backtest using strategy factory
- `compute_metrics()`: Extracts and sanitizes performance metrics
- `build_price_chart()`: Constructs price chart with indicators and signals
- `build_equity_chart()`: Constructs equity curve data
- `persist_backtest_results()`: Saves run, trades, and equity points to DB

**View Layer (`core/views.py`)**:
- `BacktestAPIView`: Thin API endpoint that delegates to service layer

**Key Benefits**:
1. **Separation of concerns**: View handles HTTP, service handles business logic
2. **Testability**: Each service function can be unit tested independently
3. **Maintainability**: Clear function boundaries, single responsibility
4. **Reusability**: Service functions can be reused in other contexts (CLI, management commands, etc.)
5. **Strategy Factory preserved**: `execute_backtest()` uses `create_strategy()` exactly as before

### Database Models

**V3 Full-Fidelity Schema**:
- `BacktestRun`: Main run record with config + summary metrics
  - Indexed on `(ticker, strategy, start_date, end_date)`
- `Trade`: Individual trade records (FK to `BacktestRun`)
  - Indexed on `(run, entry_time)`
  - Fields: entry/exit times, prices, size, PnL, return_pct, duration
- `EquityPoint`: Equity curve data points (FK to `BacktestRun`)
  - Indexed on `(run, timestamp)`
  - Fields: timestamp, equity value

All runs are automatically persisted on successful completion.

---
Maintainer notes: Keep this file updated when endpoints, models, or strategy mappings change.


