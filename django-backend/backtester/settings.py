"""
Django settings for the backtester project.

Stateless JSON API configuration without database persistence.
"""

import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent

SECRET_KEY = os.environ.get(
    'DJANGO_SECRET_KEY',
    'django-insecure-j$%r^-q!2*(&8gwtc0+l310t2(g%vi-o8yosqi@oqbsz5p(7!l',
)

DEBUG = os.environ.get('DJANGO_DEBUG', 'True') == 'True'

ALLOWED_HOSTS = os.environ.get(
    'DJANGO_ALLOWED_HOSTS',
    'localhost 127.0.0.1 [::1]',
).split()


# --- Application Definition ---

INSTALLED_APPS = [
    'core',
    'rest_framework',
    'corsheaders',
]

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'backtester.urls'

TEMPLATES = []

WSGI_APPLICATION = 'backtester.wsgi.application'


# --- Database (Stateless) ---

DATABASES = {}


# --- Internationalization ---

LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'UTC'
USE_I18N = False
USE_TZ = True


# --- CORS ---

CORS_ALLOWED_ORIGIN_REGEXES = [
    r"^http://localhost(:[0-9]+)?$",
    r"^http://127\.0\.0\.1(:[0-9]+)?$",
    r"^http://192\.168\.\d+\.\d+(:[0-9]+)?$",
]

_extra_cors_origins = os.environ.get('DJANGO_CORS_ALLOWED_ORIGINS', '').split()
if _extra_cors_origins:
    CORS_ALLOWED_ORIGINS = _extra_cors_origins


# --- Django REST Framework (Stateless JSON API) ---

REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': [],
    'DEFAULT_PERMISSION_CLASSES': [],
    'UNAUTHENTICATED_USER': None,
    'DEFAULT_RENDERER_CLASSES': [
        'rest_framework.renderers.JSONRenderer',
    ],
}
