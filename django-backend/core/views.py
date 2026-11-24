from typing import Any, Dict

from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from .serializers import BacktestSerializer
from .services.backtest import get_available_strategies, run_backtest


class HealthCheckView(APIView):
    """Lightweight readiness endpoint."""

    def get(self, request, *args, **kwargs):
        return Response({"status": "ok"}, status=status.HTTP_200_OK)


class StrategyListAPIView(APIView):
    """Return metadata for all implemented backtesting strategies."""

    def get(self, request, *args, **kwargs):
        return Response(
            {"strategies": get_available_strategies()},
            status=status.HTTP_200_OK,
        )


class BacktestAPIView(APIView):
    """Execute a stateless strategy backtest from validated parameters."""

    def post(self, request, *args, **kwargs):
        serializer = BacktestSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        results: Dict[str, Any] = run_backtest(serializer.validated_data)
        if "error" in results:
            return Response(results, status=status.HTTP_400_BAD_REQUEST)

        return Response(results, status=status.HTTP_200_OK)
