import warnings
from typing import Any, Dict

import numpy as np
import pandas as pd
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView
from django.http import JsonResponse

from .serializers import BacktestSerializer
from .services.backtest import run_backtest

warnings.simplefilter(action="ignore", category=FutureWarning)


def sanitize_series(series_or_list):
    """Replaces NaN/inf with None and converts valid numbers to standard floats."""
    return [
        None if x is None or np.isnan(x) or np.isinf(x) else float(x)
        for x in series_or_list
    ]


class HealthCheckView(APIView):
    def get(self, request, *args, **kwargs):
        return JsonResponse({'status': 'ok'})


class BacktestAPIView(APIView):
    """
    API view to handle backtesting requests from the frontend.
    """

    def post(self, request, *args, **kwargs):
        serializer = BacktestSerializer(data=request.data)
        if serializer.is_valid():
            # Call the service layer
            results: Dict[str, Any] = run_backtest(serializer.validated_data)

            # Check if the service returned an error
            if "error" in results:
                return Response(results, status=status.HTTP_400_BAD_REQUEST)

            return Response(results, status=status.HTTP_200_OK)

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
