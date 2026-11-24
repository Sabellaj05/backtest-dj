# QuantFlow — Equity Strategy Backtester

A full-stack quantitative backtesting showcase powered by a stateless Django REST API (`yfinance` + `backtesting.py`) and a React/TypeScript/Recharts financial terminal UI.

## Overview

QuantFlow lets you test trading strategies against historical market data on demand without database overhead or persisted state:

- **Live Market Data**: Fetches historical OHLCV bars from Yahoo Finance (`yfinance`) across `1D`, `1W`, `1M`, and `1H` intervals.
- **Implemented Strategies**:
  - **SMA Crossover (10/50)** (`sma_cross`): Trend-following crossover going long when SMA(10) crosses above SMA(50) and reversing short on downward crossover.
  - **Risk-Managed SMA (La Bomba)** (`la_bomba`): SMA 10/50 crossover with a 1% Stop Loss, 2% Take Profit, and automatic Break-Even stop adjustment once unrealized profit reaches +1%.
  - **Buy & Hold** (`buy_and_hold`): Passive benchmark allocating starting capital on bar 1 through the end of the selected window.
- **Interactive Financial Dashboard**:
  - Summary KPI strip and 6-card metrics grid (Total Return, Final Equity, CAGR, Max Drawdown, Sharpe Ratio, Win Rate, Profit Factor, Exposure, and Buy & Hold alpha).
  - Price Action & Execution Signals chart with SMA overlays and Long/Short entry markers.
  - Portfolio Performance chart toggling between Equity Curve (with initial capital baseline) and Underwater Drawdown %.
  - Trade-level Execution Log with entry/exit timestamps, prices, position sizes, dollar P&L, and percentage return.

## Architecture

- **Backend (`django-backend/`)**: Stateless Django 5 + Django REST Framework API (`DATABASES = {}`), dynamic strategy factory (`core/strategies/factory.py`), and `backtesting.py` execution engine (`core/services/backtest.py`).
- **Frontend (`django-front/`)**: Vite + React + TypeScript + Tailwind CSS + ShadCN UI primitives + Recharts.
- **Reverse Proxy (`nginx/`)**: Nginx serving the production Vite bundle and proxying `/api/` requests to Gunicorn.

## API Endpoints

- `GET /api/v1/healthcheck/` — Lightweight readiness check (`{"status": "ok"}`).
- `GET /api/v1/strategies/` — Returns metadata for all implemented strategies.
- `POST /api/v1/backtest/` — Executes a stateless backtest simulation.
  - Request JSON: `ticker`, `startDate` (`YYYY-MM-DD`), `endDate` (`YYYY-MM-DD`), `strategy`, `capital`, `interval` (`1d`, `1wk`, `1mo`, `1h`).
  - Response JSON: `meta`, `metrics`, `price_chart`, `equity_chart`, `trades`.

## Local Development

### Prerequisites

- Python 3.11+ and `uv`
- Node.js 20+ and `npm`

### 1. Start the Backend API

```bash
cd django-backend
uv sync
uv run python manage.py runserver 8000
```

### 2. Start the Frontend Dev Server

```bash
cd django-front
npm install
npm run dev
```

Open `http://localhost:3001` in your browser.

## Docker Deployment

The application runs completely statelessly with no database volume, migrations, or admin setup required.

1. Configure environment variables:

```bash
cp .env.example .env
```

Edit `.env` to set `DJANGO_SECRET_KEY` and `DJANGO_ALLOWED_HOSTS` for your host or domain.

2. Build and start the containers:

```bash
docker compose up --build -d
```

3. Access the app at `http://<your-host-ip>/` (and API endpoints under `/api/v1/`).

4. Inspect logs if needed:

```bash
docker compose logs -f
```
