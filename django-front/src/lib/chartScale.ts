export interface ScaleResult {
  min: number;
  max: number;
  ticks: number[];
}

export function computeNiceTicks(
  rawMin: number,
  rawMax: number,
  targetTicks = 5
): ScaleResult {
  if (!Number.isFinite(rawMin) || !Number.isFinite(rawMax)) {
    return { min: 0, max: 1, ticks: [0, 0.5, 1] };
  }

  let min = rawMin;
  let max = rawMax;
  if (min === max) {
    const delta = Math.abs(min) * 0.05 || 1;
    min -= delta;
    max += delta;
  }

  const range = max - min;
  const roughStep = range / Math.max(2, targetTicks - 1);
  const magnitude = Math.pow(10, Math.floor(Math.log10(roughStep)));
  const normalized = roughStep / magnitude;

  let niceNormalized = 1;
  if (normalized <= 1) niceNormalized = 1;
  else if (normalized <= 2) niceNormalized = 2;
  else if (normalized <= 2.5) niceNormalized = 2.5;
  else if (normalized <= 5) niceNormalized = 5;
  else niceNormalized = 10;

  const step = niceNormalized * magnitude;
  const niceMin = Math.floor(min / step) * step;
  const niceMax = Math.ceil(max / step) * step;

  const ticks: number[] = [];
  for (let val = niceMin; val <= niceMax + step * 0.001; val += step) {
    ticks.push(Number(val.toPrecision(10)));
  }

  return { min: niceMin, max: niceMax, ticks };
}

export function computeLogTicks(rawMin: number, rawMax: number): ScaleResult {
  const safeMin = Math.max(rawMin, 1e-4);
  const safeMax = Math.max(rawMax, safeMin * 1.1);

  const minPow = Math.floor(Math.log10(safeMin));
  const maxPow = Math.ceil(Math.log10(safeMax));

  const candidates: number[] = [];
  for (let p = minPow; p <= maxPow; p++) {
    const base = Math.pow(10, p);
    for (const mult of [1, 2, 5]) {
      candidates.push(mult * base);
    }
  }

  const lower =
    [...candidates].reverse().find((v) => v <= safeMin) ?? safeMin * 0.9;
  const upper = candidates.find((v) => v >= safeMax) ?? safeMax * 1.1;

  let ticks = candidates.filter((v) => v >= lower && v <= upper);
  if (ticks.length > 6) {
    ticks = ticks.filter((_, idx) => idx % 2 === 0 || idx === ticks.length - 1);
  }
  if (ticks.length < 2) {
    ticks = [lower, upper];
  }

  return { min: lower, max: upper, ticks };
}

export function buildXAxisTickIndices(length: number, maxTicks = 5): number[] {
  if (length <= 0) return [];
  if (length === 1) return [0];
  if (length <= maxTicks) {
    return Array.from({ length }, (_, i) => i);
  }

  const indices: number[] = [];
  const step = (length - 1) / (maxTicks - 1);
  for (let i = 0; i < maxTicks; i++) {
    indices.push(Math.round(i * step));
  }
  return Array.from(new Set(indices));
}

export function buildLinePath(
  values: (number | null)[],
  xForIndex: (idx: number) => number,
  yForValue: (val: number) => number
): string {
  let path = '';
  let drawing = false;

  for (let i = 0; i < values.length; i++) {
    const val = values[i];
    if (val === null || !Number.isFinite(val)) {
      drawing = false;
      continue;
    }
    const x = xForIndex(i).toFixed(2);
    const y = yForValue(val).toFixed(2);
    if (!drawing) {
      path += `M ${x} ${y} `;
      drawing = true;
    } else {
      path += `L ${x} ${y} `;
    }
  }

  return path.trim();
}
