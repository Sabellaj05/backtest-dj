# QuantFlow — Equity Strategy Backtester

A full-stack quantitative backtesting application combining a stateless Django REST API (`yfinance` + `backtesting.py`) with a React/TypeScript frontend featuring custom `<svg>` financial visualizations.

## Live Showcase vs Local Backend

- **Static Frontend Showcase (Cloudflare Pages)**: When deployed without a Python backend (or built with `VITE_DEMO_MODE=true`), the UI automatically switches to **Sample mode** and runs a deterministic client-side simulation engine with realistic OHLCV series, SMA overlays, risk rules, and trade logs.
- **Full-Stack Live Mode (Local / Docker)**: When running the Django backend locally alongside the frontend, the app detects the API automatically (`Live API`) and fetches real historical market data from Yahoo Finance (`yfinance`).

## Quick Start (Run Locally with Live Django Backend)

### Prerequisites

- Python 3.11+ and [`uv`](https://docs.astral.sh/uv/)
- Node.js 20+ (Node 22 recommended) and `npm`

### Option 1: Local Dev Servers (2 Terminals)

1. **Clone the repository**:

```bash
git clone https://github.com/Sabellaj05/backtest-dj.git
cd backtest-dj
```

2. **Start the Django backend** (Terminal 1):

```bash
cd django-backend
uv sync
uv run python manage.py runserver 8000
```

3. **Start the Vite frontend** (Terminal 2):

```bash
cd django-front
npm install
npm run dev
```

4. Open `http://localhost:3001` in your browser. The header badge will show `Live API` and simulations will pull live Yahoo Finance data.

### Option 2: Docker Compose

```bash
git clone https://github.com/Sabellaj05/backtest-dj.git
cd backtest-dj
cp .env.example .env
docker compose up --build
```

Open `http://localhost` (Nginx serves the built frontend and proxies `/api/` to Gunicorn on port 8000; no database or migrations are required).

## Deploy Frontend Showcase to Cloudflare Pages

The frontend builds cleanly as a static showcase without a backend:

1. Connect `https://github.com/Sabellaj05/backtest-dj` in **Cloudflare Pages**.
2. Configure build settings:
   - **Root directory**: `django-front`
   - **Build command**: `npm run build`
   - **Build output directory**: `dist`
3. Add environment variables:
   - `NODE_VERSION` = `22` (also pinned in `django-front/.node-version`)
   - `VITE_DEMO_MODE` = `true` (skips API healthcheck probes and runs in instant `Sample mode`)

## Implemented Strategies

- **SMA Crossover (10/50)** (`sma_cross`): Trend-following crossover entering long when SMA(10) crosses above SMA(50) and reversing short on downward crossover.
- **Risk-Managed SMA (La Bomba)** (`la_bomba`): SMA 10/50 crossover with a 1% Stop Loss, 2% Take Profit, and automatic Break-Even stop adjustment once unrealized profit reaches +1%.
- **Buy & Hold** (`buy_and_hold`): Passive benchmark allocating starting capital on bar 1 through the end of the selected window.

## API Endpoints

- `GET /api/v1/healthcheck/` — Readiness check (`{"status": "ok"}`).
- `GET /api/v1/strategies/` — Strategy catalog metadata.
- `POST /api/v1/backtest/` — Executes a stateless backtest (`ticker`, `startDate`, `endDate`, `strategy`, `capital`, `interval`) and returns `meta`, `metrics`, `price_chart`, `equity_chart`, and `trades`.
