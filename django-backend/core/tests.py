import os
from unittest.mock import patch

import django

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "backtester.settings")
django.setup()

import numpy as np
import pandas as pd
from django.test import SimpleTestCase, override_settings
from rest_framework.test import APIClient


def make_synthetic_ohlcv(periods: int = 160) -> pd.DataFrame:
    """Create deterministic trending + oscillating OHLCV data for crossover tests."""
    dates = pd.date_range("2025-01-01", periods=periods, freq="D")
    x = np.linspace(0, 4 * np.pi, periods)
    close = 150.0 + 18.0 * np.sin(x) + np.linspace(0, 20, periods)
    open_p = np.roll(close, 1)
    open_p[0] = close[0]
    high = np.maximum(open_p, close) + 1.5
    low = np.minimum(open_p, close) - 1.5
    volume = np.full(periods, 1_500_000, dtype=float)
    return pd.DataFrame(
        {
            "Open": open_p,
            "High": high,
            "Low": low,
            "Close": close,
            "Volume": volume,
        },
        index=dates,
    )


@override_settings(ALLOWED_HOSTS=["*"])
class StatelessAPITests(SimpleTestCase):
    def setUp(self):
        self.client = APIClient()

    def test_healthcheck(self):
        response = self.client.get("/api/v1/healthcheck/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"status": "ok"})

    def test_strategy_list(self):
        response = self.client.get("/api/v1/strategies/")
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        strategy_ids = [s["id"] for s in payload["strategies"]]
        self.assertEqual(strategy_ids, ["sma_cross", "la_bomba", "buy_and_hold"])

    def test_invalid_strategy_rejected(self):
        response = self.client.post(
            "/api/v1/backtest/",
            {
                "ticker": "AAPL",
                "startDate": "2025-01-01",
                "endDate": "2025-06-01",
                "strategy": "RSI",
                "capital": 10000,
                "interval": "1d",
            },
            format="json",
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn("strategy", response.json())

    def test_invalid_date_order_rejected(self):
        response = self.client.post(
            "/api/v1/backtest/",
            {
                "ticker": "AAPL",
                "startDate": "2025-06-01",
                "endDate": "2025-01-01",
                "strategy": "sma_cross",
                "capital": 10000,
                "interval": "1d",
            },
            format="json",
        )
        self.assertEqual(response.status_code, 400)

    def test_invalid_ticker_rejected(self):
        response = self.client.post(
            "/api/v1/backtest/",
            {
                "ticker": "AAPL; DROP",
                "startDate": "2025-01-01",
                "endDate": "2025-06-01",
                "strategy": "sma_cross",
                "capital": 10000,
            },
            format="json",
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn("ticker", response.json())

    @patch("core.services.backtest.fetch_ohlcv")
    def test_all_strategies_execute_with_enriched_payload(self, mock_fetch):
        mock_fetch.return_value = make_synthetic_ohlcv()

        for strategy_id in ("sma_cross", "la_bomba", "buy_and_hold"):
            with self.subTest(strategy=strategy_id):
                response = self.client.post(
                    "/api/v1/backtest/",
                    {
                        "ticker": "aapl",
                        "startDate": "2025-01-01",
                        "endDate": "2025-06-15",
                        "strategy": strategy_id,
                        "capital": 10000,
                        "interval": "1d",
                    },
                    format="json",
                )
                self.assertEqual(response.status_code, 200)
                data = response.json()

                self.assertEqual(data["meta"]["ticker"], "AAPL")
                self.assertEqual(data["meta"]["strategy"], strategy_id)
                self.assertEqual(data["meta"]["initial_cash"], 10000.0)

                metrics = data["metrics"]
                for key in (
                    "total_return_pct",
                    "cagr_pct",
                    "sharpe",
                    "max_drawdown_pct",
                    "trades",
                    "winrate_pct",
                    "final_equity",
                    "net_profit",
                    "buy_and_hold_return_pct",
                    "profit_factor",
                    "exposure_time_pct",
                ):
                    self.assertIn(key, metrics)

                equity_chart = data["equity_chart"]
                self.assertEqual(len(equity_chart["dates"]), len(equity_chart["equity"]))
                self.assertEqual(len(equity_chart["dates"]), len(equity_chart["drawdown"]))
                self.assertTrue(all(d <= 0 for d in equity_chart["drawdown"] if d is not None))

                self.assertIsInstance(data["trades"], list)
                if strategy_id == "buy_and_hold":
                    self.assertEqual(len(data["trades"]), 1)
                    self.assertEqual(data["trades"][0]["side"], "LONG")
                if strategy_id in ("sma_cross", "la_bomba"):
                    self.assertGreater(len(data["price_chart"]["sma1"]), 0)
                    self.assertGreater(len(data["price_chart"]["sma2"]), 0)
