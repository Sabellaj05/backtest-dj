from django.db import models
# No models necessary for the MVP. Add models here later if you want to persist tests.


class BacktestResult(models.Model):
    # parameros del front
    ticker = models.CharField(max_length=20)
    start_date = models.DateField()
    end_date = models.DateField()
    strategy = models.CharField(max_length=100)
    starting_capital = models.FloatField()

    # resultados
    total_return_pct = models.FloatField()
    cagr_pct = models.FloatField()
    sharpe = models.FloatField()
    max_drawdown_pct = models.FloatField()
    trades = models.IntegerChoices()
    winrate_pct = models.FloatField()

    # timestamp
    created_at = models.DateTimeField(
        auto_now_add=True, help_text="when the backtester was ran"
    )

    def __str__(self):
        return f"{self.ticker} - {self.strategy} ({self.created_at.strftime('%Y-%m-%d')"

    class Meta:
        # newest results first
        orderding = ["-created_at"]
