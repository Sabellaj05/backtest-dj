"""URL configuration for the backtester project."""

from django.urls import include, path

urlpatterns = [
    path('', include('core.urls')),
]
