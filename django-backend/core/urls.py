from django.urls import path

from . import views

urlpatterns = [
    path('api/v1/backtest/', views.BacktestAPIView.as_view(), name='api_backtest'),
    path('api/v1/strategies/', views.StrategyListAPIView.as_view(), name='api_strategies'),
    path('api/v1/healthcheck/', views.HealthCheckView.as_view(), name='healthcheck'),
]
