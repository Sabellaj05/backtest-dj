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
  - `views.py`: request validation, data fetch, strategy execution, response assembly
  - `serializers.py`: `BacktestSerializer` input validation
  - `models.py`: persistence model(s) for backtest results
  - `strategies/`: strategy factory and strategies (e.g., `sma_cross`, `buy_and_hold`, `la_bomba`)

### Request Flow
1. Frontend posts form data to `POST /api/v1/backtest/`.
2. `BacktestAPIView.post` validates payload with `BacktestSerializer`.
3. `run_backtest_from_params`:
   - Downloads OHLCV from `yfinance` with interval handling
   - Normalizes columns (`Open/High/Low/Close/Volume`)
   - Maps UI strategy name to backend strategy slug
   - Uses `backtesting.Backtest` with a strategy class from `core.strategies.factory.create_strategy`
   - Produces metrics, price chart series (dates, close, SMA overlays, buy/sell markers) and equity curve
4. Response returns `{ metrics, price_chart, equity_chart }` or `{ error }` with appropriate status code.

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
- API view and execution path:
```333:351:/Users/saens/thecode/web/django-project/django-backend/core/views.py
class BacktestAPIView(APIView):
    def post(self, request, *args, **kwargs):
        serializer = BacktestSerializer(data=request.data)
        if serializer.is_valid():
            results = run_backtest_from_params(serializer.validated_data)
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

### Persistence Model (current and plan)

Current model in `core/models.py`:
```5:34:/Users/saens/thecode/web/django-project/django-backend/core/models.py
class BacktestResult(models.Model):
    ticker = models.CharField(max_length=20)
    start_date = models.DateField()
    end_date = models.DateField()
    strategy = models.CharField(max_length=100)
    starting_capital = models.FloatField()
    total_return_pct = models.FloatField()
    cagr_pct = models.FloatField()
    sharpe = models.FloatField()
    max_drawdown_pct = models.FloatField()
    trades = models.IntegerField()
    winrate_pct = models.FloatField()
    created_at = models.DateTimeField(auto_now_add=True)
    class Meta:
        ordering = ["-created_at"]
```

Recommended incremental plan:
1) Minimal v1 (already partially present)
   - Persist run configuration and summary metrics only (`BacktestResult`).
   - Save to DB after a successful backtest.

2) Enhanced v2
   - Add JSON blobs for visualizations to avoid row explosion:
     - `price_chart_json`: JSONField (dates, close, overlays, buy/sell markers)
     - `equity_chart_json`: JSONField (dates, equity)
   - Optional indexing fields (e.g., `interval`, `duration_days`).

3) Full fidelity v3 (optional)
   - Separate tables if analytics on trades are needed:
     - `BacktestRun` (one row per run)
     - `Trade` (FK to run; entry/exit times, prices, size, pnl)
     - `EquityPoint` (FK to run; timestamp, equity)
   - This is heavier but enables SQL analytics; JSON v2 is often sufficient for product needs.

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
Maintainer notes: Keep this file updated when endpoints, models, or strategy mappings change.


