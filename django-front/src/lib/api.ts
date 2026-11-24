import { BacktestRequest, BacktestResponse, StrategyInfo } from '@/types/backtest';

export class ApiHttpError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiHttpError';
    this.status = status;
  }
}

export function isExplicitDemoMode(): boolean {
  return import.meta.env.VITE_DEMO_MODE === 'true';
}

export function getApiBaseUrl(): string {
  if (import.meta.env.VITE_API_BASE_URL) {
    return import.meta.env.VITE_API_BASE_URL;
  }

  if (import.meta.env.PROD) {
    return '';
  }

  const hostname = window.location.hostname;
  if (hostname === '127.0.0.1') {
    return 'http://127.0.0.1:8000';
  }
  if (hostname.match(/^192\.168\.\d+\.\d+$/)) {
    return `${window.location.protocol}//${hostname}:8000`;
  }

  return 'http://localhost:8000';
}

function isJsonResponse(response: Response): boolean {
  const contentType = response.headers.get('content-type') || '';
  return contentType.toLowerCase().includes('application/json');
}

function extractApiError(payload: unknown): string {
  if (!payload || typeof payload !== 'object') {
    return 'Request failed with an unexpected response.';
  }

  const record = payload as Record<string, unknown>;
  if (typeof record.error === 'string' && record.error.trim()) {
    return record.error;
  }
  if (typeof record.detail === 'string' && record.detail.trim()) {
    return record.detail;
  }
  if (Array.isArray(record.non_field_errors) && record.non_field_errors.length > 0) {
    return record.non_field_errors.map(String).join(' ');
  }

  const parts: string[] = [];
  for (const [field, value] of Object.entries(record)) {
    if (Array.isArray(value)) {
      parts.push(`${field}: ${value.map(String).join(', ')}`);
    } else if (typeof value === 'string') {
      parts.push(`${field}: ${value}`);
    }
  }

  return parts.length > 0 ? parts.join(' | ') : 'Validation error occurred.';
}

export async function checkHealth(): Promise<boolean> {
  if (isExplicitDemoMode()) return false;
  try {
    const response = await fetch(`${getApiBaseUrl()}/api/v1/healthcheck/`);
    if (!response.ok || !isJsonResponse(response)) return false;
    const data = await response.json();
    return data?.status === 'ok';
  } catch {
    return false;
  }
}

export async function fetchStrategies(): Promise<StrategyInfo[]> {
  if (isExplicitDemoMode()) return [];
  const response = await fetch(`${getApiBaseUrl()}/api/v1/strategies/`);
  if (!response.ok || !isJsonResponse(response)) {
    throw new Error('Failed to load strategies.');
  }
  const data = await response.json();
  return Array.isArray(data?.strategies) ? data.strategies : [];
}

export async function runBacktestApi(
  params: BacktestRequest
): Promise<BacktestResponse> {
  const response = await fetch(`${getApiBaseUrl()}/api/v1/backtest/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(params),
  });

  if (!isJsonResponse(response)) {
    throw new Error('Backend API did not return JSON.');
  }

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new ApiHttpError(extractApiError(data), response.status);
  }

  return data as BacktestResponse;
}
