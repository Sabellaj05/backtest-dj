from django.db import models


class BacktestRun(models.Model):
    ticker = models.CharField(max_length=20)
    start_date = models.DateField()
    end_date = models.DateField()
    strategy = models.CharField(max_length=100)
    starting_capital = models.FloatField()
    interval = models.CharField(max_length=10, default="1d")

    total_return_pct = models.FloatField()
    cagr_pct = models.FloatField()
    sharpe = models.FloatField()
    max_drawdown_pct = models.FloatField()
    trades = models.IntegerField()
    winrate_pct = models.FloatField()

    created_at = models.DateTimeField(auto_now_add=True, help_text="when the backtester was ran")

    def __str__(self):
        return f"{self.ticker} - {self.strategy} ({self.created_at.strftime('%Y-%m-%d')})"

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["ticker", "strategy", "start_date", "end_date"]),
        ]


class Trade(models.Model):
    run = models.ForeignKey(BacktestRun, on_delete=models.CASCADE, related_name="trades_detail")
    entry_time = models.DateTimeField()
    exit_time = models.DateTimeField(null=True, blank=True)
    entry_price = models.FloatField()
    exit_price = models.FloatField(null=True, blank=True)
    size = models.FloatField()
    pnl = models.FloatField(null=True, blank=True)
    return_pct = models.FloatField(null=True, blank=True)
    duration_seconds = models.IntegerField(null=True, blank=True)

    class Meta:
        ordering = ["entry_time"]
        indexes = [
            models.Index(fields=["run", "entry_time"]),
        ]


class EquityPoint(models.Model):
    run = models.ForeignKey(BacktestRun, on_delete=models.CASCADE, related_name="equity_points")
    timestamp = models.DateTimeField()
    equity = models.FloatField()

    class Meta:
        ordering = ["timestamp"]
        indexes = [
            models.Index(fields=["run", "timestamp"]),
        ]
    