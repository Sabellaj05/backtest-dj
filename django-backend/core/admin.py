from django.contrib import admin
from .models import BacktestRun, Trade, EquityPoint


@admin.register(BacktestRun)
class BacktestRunAdmin(admin.ModelAdmin):
    list_display = ["ticker", "strategy", "start_date", "end_date", "total_return_pct", "trades", "created_at"]
    list_filter = ["strategy", "ticker", "created_at"]
    search_fields = ["ticker", "strategy"]
    readonly_fields = ["created_at"]
    ordering = ["-created_at"]


@admin.register(Trade)
class TradeAdmin(admin.ModelAdmin):
    list_display = ["run", "entry_time", "exit_time", "entry_price", "size", "pnl", "return_pct"]
    list_filter = ["run__strategy", "run__ticker"]
    search_fields = ["run__ticker"]
    readonly_fields = ["entry_time", "exit_time"]


@admin.register(EquityPoint)
class EquityPointAdmin(admin.ModelAdmin):
    list_display = ["run", "timestamp", "equity"]
    list_filter = ["run__strategy", "run__ticker"]
    search_fields = ["run__ticker"]
