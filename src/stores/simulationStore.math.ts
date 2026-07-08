import type { SegregationMetrics } from '../engine/types/models';

export type TickMetrics = {
  tick: number;
  dissimilarity: number;
  exposure: number;
  clustering: number;
};

export type MetricAverages = {
  dissimilarity: number;
  exposure: number;
  clustering: number;
  sampleSize: number;
};

function rollingMean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function isMetricStable(history: SegregationMetrics[], selector: (m: SegregationMetrics) => number, window: number, maxDelta: number): boolean {
  const requiredLength = window * 2;
  if (history.length < requiredLength) return false;

  const recent = history.slice(-window).map(selector);
  const previous = history.slice(-requiredLength, -window).map(selector);

  const delta = Math.abs(rollingMean(recent) - rollingMean(previous));
  return delta <= maxDelta;
}

export function shouldAutoPauseForStability(
  history: SegregationMetrics[],
  stabilityStartIndex: number,
  window: number,
  maxDelta: number
): boolean {
  const scopedHistory = history.slice(stabilityStartIndex);

  return (
    isMetricStable(scopedHistory, (m) => m.dissimilarity, window, maxDelta) &&
    isMetricStable(scopedHistory, (m) => m.exposure, window, maxDelta) &&
    isMetricStable(scopedHistory, (m) => m.clustering, window, maxDelta)
  );
}

export function calculateMetricAveragesOverLastTicks(history: TickMetrics[], ticks: number): MetricAverages {
  const sample = history.slice(-Math.max(1, ticks));

  const sums = sample.reduce(
    (acc, metric) => {
      acc.dissimilarity += metric.dissimilarity;
      acc.exposure += metric.exposure;
      acc.clustering += metric.clustering;
      return acc;
    },
    { dissimilarity: 0, exposure: 0, clustering: 0 }
  );

  const sampleSize = sample.length;
  return {
    dissimilarity: sampleSize > 0 ? sums.dissimilarity / sampleSize : 0,
    exposure: sampleSize > 0 ? sums.exposure / sampleSize : 0,
    clustering: sampleSize > 0 ? sums.clustering / sampleSize : 0,
    sampleSize
  };
}

export function averageComparisonRuns(runs: TickMetrics[][]): TickMetrics[] {
  if (runs.length === 0) return [];

  const maxLength = runs.reduce((max, run) => Math.max(max, run.length), 0);
  const averaged: TickMetrics[] = [];

  for (let index = 0; index < maxLength; index++) {
    const points = runs
      .map((run) => run[index] ?? run.at(-1))
      .filter((point): point is TickMetrics => Boolean(point));

    if (points.length === 0) continue;

    const sums = points.reduce(
      (acc, point) => {
        acc.dissimilarity += point.dissimilarity;
        acc.exposure += point.exposure;
        acc.clustering += point.clustering;
        return acc;
      },
      { dissimilarity: 0, exposure: 0, clustering: 0 }
    );

    averaged.push({
      tick: points[0].tick,
      dissimilarity: sums.dissimilarity / points.length,
      exposure: sums.exposure / points.length,
      clustering: sums.clustering / points.length
    });
  }

  return averaged;
}
