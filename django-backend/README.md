# Backtester MVP (Django)

Proyecto mínimo para correr un backtest simple (SMA crossover) usando `yfinance` como fuente de datos.

## Requisitos
- Python 3.11+
- Crear virtualenv y activar

```bash
python -m venv venv
source venv/bin/activate   # Linux/macOS
venv\Scripts\activate    # Windows
pip install -r requirements.txt

# con uv
uv sync
source .venv/bin/activate
```

## Ejecutar
```bash
python manage.py migrate
python manage.py runserver

# con uv
uv run manage.py migrate
uv run manage.py runserver
```

Abre http://127.0.0.1:8000 en tu navegador.

## Notas
- Este MVP usa una función de backtest simple y fiable (no depende de internals de `backtesting.py`) para calcular equity y métricas.
- Si `backtesting.py` está instalado, puedes activar la casilla en el formulario (siempre que quieras experimentar con la librería).
- Ajusta `SECRET_KEY` en producción.

## Flexible Strategy Implementation

The backtesting functionality is designed to be flexible, allowing users to bring their own strategies. This is achieved through a combination of dynamic loading, a factory pattern, and a dedicated API for strategy parameters.

### Strategy Definition

A strategy is a Python class that inherits from `backtesting.Strategy`. It has two main methods:

-   `init()`: This is where you initialize your indicators (like SMAs, RSI, etc.).
-   `next()`: This method is called for each data point (e.g., for each day), and it's where you define your trading logic (buy/sell conditions).

### Factory Design Pattern

A `StrategyFactory` is used to dynamically load and create strategy classes. This encapsulates the creation logic and decouples the main application from the individual strategies. The factory uses `importlib` to load the strategy classes from the `core/strategies` directory.

### Strategy-Specific Parameters

Different strategies have different parameters. The UI dynamically adapts to the selected strategy by:
1.  **Defining parameters in the strategy class** as class variables.
2.  **Exposing parameters via an API endpoint** (`/api/strategies/<strategy_name>/`).
3.  **Dynamically generating UI components** in the frontend based on the parameters returned by the API.

## Flow

0.2.0

1. User Interaction (React): The user opens their browser to the React app. They fill in the Ticker, Dates, Strategy, and Capital, and click "Start Backtesting".
2. API Request (React): The handleBacktest function in App.tsx triggers. It bundles the form data into a JSON object and sends a POST request to the backend API at
    http://<your-backend-url>/api/backtest/.
3. URL Routing (Django): Django receives the request. The main backtester/urls.py file sees the /api/backtest/ path and routes the request to the core app's urls.py
    file.
4. API View (Django - DRF): The core/urls.py file matches the request to the BacktestAPIView. The post method of this view is executed.
5. Data Validation (Django - DRF): The BacktestAPIView uses the BacktestSerializer to parse and validate the incoming JSON data. If the data is invalid (e.g., bad date
    format, missing field), it immediately sends a 400 Bad Request response with error details.
6. Execute Logic (Django): If validation succeeds, the BacktestAPIView calls the run_backtest_from_params function, passing it the clean, validated data.
7. Perform Backtest (Django): The run_backtest_from_params function executes the core logic: fetches data from yfinance, runs the simple_backtest, computes metrics, and
    bundles the results (metrics and chart data) into a Python dictionary.
8. API Response (Django - DRF): The BacktestAPIView receives this dictionary, and DRF's Response object serializes it into a proper JSON format and sends it back to the
    front-end with a 200 OK status.
9. Update UI (React): The fetch call in App.tsx resolves. The setChartsData(data) function is called, updating the component's state with the results from the API.
10. Render Results (React): React detects the state change and re-renders the component, displaying the "Backtest Results" card with the metrics that were just received
    from the backend.
