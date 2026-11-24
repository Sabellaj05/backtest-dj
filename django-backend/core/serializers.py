import re
from rest_framework import serializers

from .services.backtest import STRATEGY_MAP

TICKER_PATTERN = re.compile(r"^[A-Z0-9.\-^=]+$")
VALID_INTERVALS = ("1d", "1h", "1wk", "1mo")


class BacktestSerializer(serializers.Serializer):
    ticker = serializers.CharField(max_length=20)
    startDate = serializers.DateField()
    endDate = serializers.DateField()
    strategy = serializers.CharField(max_length=100)
    capital = serializers.FloatField(min_value=1.0, max_value=1_000_000_000.0)
    interval = serializers.ChoiceField(
        choices=VALID_INTERVALS, required=False, default="1d"
    )

    def validate_ticker(self, value: str) -> str:
        cleaned = value.strip().upper()
        if not cleaned or not TICKER_PATTERN.match(cleaned):
            raise serializers.ValidationError(
                "Ticker must contain only letters, digits, or '.', '-', '^', '='."
            )
        return cleaned

    def validate_strategy(self, value: str) -> str:
        if value not in STRATEGY_MAP:
            supported = ", ".join(sorted(set(STRATEGY_MAP.values())))
            raise serializers.ValidationError(
                f"Unsupported strategy '{value}'. Supported strategies: {supported}."
            )
        return value

    def validate(self, attrs):
        if attrs["startDate"] >= attrs["endDate"]:
            raise serializers.ValidationError("End date must be after start date.")
        return attrs
