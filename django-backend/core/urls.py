from django.urls import path
from . import views

app_name = 'core'

urlpatterns = [
    path('api/backtest/', views.BacktestAPIView.as_view(), name='api_backtest'),
]
