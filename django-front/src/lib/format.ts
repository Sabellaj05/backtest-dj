export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatSignedCurrency(value: number): string {
  const prefix = value > 0 ? '+' : value < 0 ? '-' : '';
  return `${prefix}${formatCurrency(Math.abs(value))}`;
}

export function formatCompactCurrency(value: number): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : '';

  if (abs >= 1_000_000) {
    return `${sign}$${(abs / 1_000_000).toFixed(2)}M`;
  }
  if (abs >= 10_000) {
    return `${sign}$${(abs / 1_000).toFixed(1)}k`;
  }
  if (abs >= 1_000) {
    return `${sign}$${Math.round(abs).toLocaleString('en-US')}`;
  }
  if (abs >= 1) {
    return `${sign}$${abs.toFixed(2)}`;
  }
  return `${sign}$${abs.toFixed(4)}`;
}

export function formatPercent(value: number, signed = false): string {
  const prefix = signed && value > 0 ? '+' : '';
  return `${prefix}${value.toFixed(2)}%`;
}

export function formatDateShort(timestamp: number | null): string {
  if (timestamp === null || Number.isNaN(timestamp)) return '—';
  const date = new Date(timestamp);
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}

export function formatDateTimeChart(
  timestamp: number,
  includeYear = false
): string {
  const date = new Date(timestamp);
  const isIntraday = date.getUTCHours() !== 0 || date.getUTCMinutes() !== 0;

  const options: Intl.DateTimeFormatOptions = {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  };

  if (includeYear) {
    options.year = '2-digit';
  }
  if (isIntraday) {
    options.hour = '2-digit';
    options.minute = '2-digit';
    options.hour12 = false;
  }

  return new Intl.DateTimeFormat('en-US', options).format(date);
}
