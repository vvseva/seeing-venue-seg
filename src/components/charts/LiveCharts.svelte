<script lang="ts">
  import * as d3 from 'd3';
  import {
    metricsHistoryStore,
    policyTargetAveragesStore,
    userPolicyResultStore,
    exemplarPolicyResultStore,
    compareUserMetricsHistoryStore,
    compareExemplarMetricsHistoryStore
  } from '../../stores/simulationStore';
  import { currentChapterIndex } from '../../stores/narrativeStore';
  import type { SegregationMetrics } from '../../engine/types/models';
  import { chartMetricsColorScale } from '../../utils/colors';

  type MetricKey = 'dissimilarity' | 'exposure' | 'clustering';
  type MetricConfig = {
    key: MetricKey;
    title: string;
  };

  type MetricAverages = {
    dissimilarity: number;
    exposure: number;
    clustering: number;
    sampleSize: number;
  };

  const width = 320;
  const height = 190;
  const Y_AXIS_WINDOW_TICKS = 50;
  const COMPARISON_USER_COLOR = '#0072B2';
  const COMPARISON_EXEMPLAR_COLOR = '#D55E00';
  const margin = { top: 20, right: 20, bottom: 30, left: 40 };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;
  const metricConfigs: MetricConfig[] = [
    { key: 'dissimilarity', title: 'Dissimilarity Index' },
    { key: 'exposure', title: 'Exposure Index' },
    { key: 'clustering', title: 'Clustering Index' }
  ];

  $: metricsHistory = $metricsHistoryStore;
  $: latestMetric = metricsHistory.at(-1);
  let hoveredMetric: { key: MetricKey; metric: SegregationMetrics } | null = null;

  function createXScale(
    history: SegregationMetrics[],
    comparisonUser: SegregationMetrics[] = [],
    comparisonExemplar: SegregationMetrics[] = []
  ) {
    const maxTick = Math.max(
      d3.max(history, (metric) => metric.tick) || 0,
      d3.max(comparisonUser, (metric) => metric.tick) || 0,
      d3.max(comparisonExemplar, (metric) => metric.tick) || 0,
      10
    );

    return d3.scaleLinear()
      .domain([0, maxTick])
      .range([0, innerWidth]);
  }

  function createYScale(
    history: SegregationMetrics[],
    metricKey: MetricKey,
    comparisonUser: SegregationMetrics[] = [],
    comparisonExemplar: SegregationMetrics[] = []
  ) {
    const recentHistory = history.slice(-Y_AXIS_WINDOW_TICKS);
    const recentValues = recentHistory.map((metric) => metric[metricKey]);
    const recentComparisonUserValues = comparisonUser.slice(-Y_AXIS_WINDOW_TICKS).map((metric) => metric[metricKey]);
    const recentComparisonExemplarValues = comparisonExemplar.slice(-Y_AXIS_WINDOW_TICKS).map((metric) => metric[metricKey]);
    const referenceValues = [
      $policyTargetAveragesStore?.[metricKey] ?? 0,
      $userPolicyResultStore?.averages[metricKey] ?? 0,
      $exemplarPolicyResultStore?.averages[metricKey] ?? 0
    ];

    const allValues = [
      ...recentValues,
      ...recentComparisonUserValues,
      ...recentComparisonExemplarValues,
      ...referenceValues
    ];
    const minValue = d3.min(allValues) ?? 0;
    const maxValue = d3.max(allValues) ?? 1;
    const range = maxValue - minValue;
    const padding = Math.max(0.02, range * 0.12);
    const yMin = Math.max(0, minValue - padding);
    const yMax = Math.max(yMin + 0.08, maxValue + padding);

    return d3.scaleLinear()
      .domain([yMin, yMax])
      .range([innerHeight, 0]);
  }

  function createPathData(
    history: SegregationMetrics[],
    metricKey: MetricKey,
    comparisonUser: SegregationMetrics[] = [],
    comparisonExemplar: SegregationMetrics[] = []
  ) {
    const xScale = createXScale(history, comparisonUser, comparisonExemplar);
    const yScale = createYScale(history, metricKey, comparisonUser, comparisonExemplar);

    return d3.line<SegregationMetrics>()
      .x((metric) => xScale(metric.tick))
      .y((metric) => yScale(metric[metricKey]))
      .curve(d3.curveMonotoneX)(history) || '';
  }

  function getMetricValue(metric: SegregationMetrics, metricKey: MetricKey) {
    return metric[metricKey];
  }

  function getClosestMetric(history: SegregationMetrics[], metricKey: MetricKey, pointerX: number) {
    if (history.length === 0) return null;

    const xScale = createXScale(history);
    const domainX = xScale.invert(pointerX);
    const bisectTick = d3.bisector((metric: SegregationMetrics) => metric.tick).center;
    const index = bisectTick(history, domainX);
    const metric = history[index] ?? history.at(-1);

    return metric ? { key: metricKey, metric } : null;
  }

  function handlePointerMove(event: PointerEvent, history: SegregationMetrics[], metricKey: MetricKey) {
    const svg = event.currentTarget as SVGSVGElement;
    const rect = svg.getBoundingClientRect();
    const relativeX = ((event.clientX - rect.left) / rect.width) * innerWidth;
    hoveredMetric = getClosestMetric(history, metricKey, Math.max(0, Math.min(innerWidth, relativeX)));
  }

  function handlePointerLeave() {
    hoveredMetric = null;
  }

  function getAverageValue(averages: MetricAverages | null | undefined, key: MetricKey) {
    if (!averages) return null;
    return averages[key];
  }
</script>

<div class="charts-stack">
  {#each metricConfigs as metricConfig}
    {@const comparisonUserHistory = $compareUserMetricsHistoryStore}
    {@const comparisonExemplarHistory = $compareExemplarMetricsHistoryStore}
    {@const isSideBySideStage = $currentChapterIndex === 10 && comparisonUserHistory.length > 0 && comparisonExemplarHistory.length > 0}
    {@const primaryHistory = isSideBySideStage ? comparisonUserHistory : metricsHistory}
    {@const secondaryHistory = isSideBySideStage ? comparisonExemplarHistory : []}
    {@const xScale = createXScale(primaryHistory, secondaryHistory)}
    {@const yScale = createYScale(primaryHistory, metricConfig.key, secondaryHistory)}
    {@const primaryPath = createPathData(primaryHistory, metricConfig.key, secondaryHistory)}
    {@const secondaryPath = createPathData(secondaryHistory, metricConfig.key, secondaryHistory)}
    {@const latestPrimaryMetric = primaryHistory.at(-1)}
    {@const latestSecondaryMetric = secondaryHistory.at(-1)}
    <div class="chart-container">
      <h3>{metricConfig.title}</h3>
      <p class="chart-value">
        {#if isSideBySideStage && latestPrimaryMetric && latestSecondaryMetric}
          Tick {latestPrimaryMetric.tick}: You {getMetricValue(latestPrimaryMetric, metricConfig.key).toFixed(3)} | Exemplar {getMetricValue(latestSecondaryMetric, metricConfig.key).toFixed(3)}
        {:else if hoveredMetric?.key === metricConfig.key}
          Tick {hoveredMetric.metric.tick}: {getMetricValue(hoveredMetric.metric, metricConfig.key).toFixed(3)}
        {:else if latestMetric}
          Tick {latestMetric.tick}: {getMetricValue(latestMetric, metricConfig.key).toFixed(3)}
        {:else}
          Waiting for simulation data...
        {/if}
      </p>

      {#if !isSideBySideStage && $policyTargetAveragesStore}
        <p class="chart-value">Target avg (25 ticks): {($policyTargetAveragesStore[metricConfig.key]).toFixed(3)}</p>
      {/if}
      {#if !isSideBySideStage && $userPolicyResultStore}
        <p class="chart-value">Your policy avg: {($userPolicyResultStore.averages[metricConfig.key]).toFixed(3)}</p>
      {/if}
      {#if !isSideBySideStage && $exemplarPolicyResultStore}
        <p class="chart-value">Exemplar avg: {($exemplarPolicyResultStore.averages[metricConfig.key]).toFixed(3)}</p>
      {/if}
      {#if isSideBySideStage}
        <p class="chart-value">Blue: your policy trajectory | Orange: exemplar trajectory</p>
      {/if}
      
      <svg
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        role="img"
        aria-label={`Interactive chart for ${metricConfig.title}`}
        on:pointermove={(event) => handlePointerMove(event, primaryHistory, metricConfig.key)}
        on:pointerleave={handlePointerLeave}
      >
        <g transform={`translate(${margin.left},${margin.top})`}>
          {#each yScale.ticks(4) as tick}
            <line 
              x1="0" x2={innerWidth} 
              y1={yScale(tick)} y2={yScale(tick)} 
              stroke="#eee" 
            />
            <text 
              x="-5" y={yScale(tick) + 4} 
              text-anchor="end" font-size="10" fill="#888">
              {tick.toFixed(2)}
            </text>
          {/each}

          {#if isSideBySideStage}
            <path
              d={primaryPath}
              fill="none"
              stroke={COMPARISON_USER_COLOR}
              stroke-width="3"
              stroke-linejoin="round"
              stroke-linecap="round"
              opacity="0.92"
            />
            {#if secondaryHistory.length > 1}
              <path
                d={secondaryPath}
                fill="none"
                stroke={COMPARISON_EXEMPLAR_COLOR}
                stroke-width="3"
                stroke-linejoin="round"
                stroke-linecap="round"
                opacity="0.92"
              />
            {/if}

            {#if latestPrimaryMetric}
              <circle
                cx={xScale(latestPrimaryMetric.tick)}
                cy={yScale(getMetricValue(latestPrimaryMetric, metricConfig.key))}
                r="4"
                fill={COMPARISON_USER_COLOR}
              />
            {/if}

            {#if latestSecondaryMetric}
              <circle
                cx={xScale(latestSecondaryMetric.tick)}
                cy={yScale(getMetricValue(latestSecondaryMetric, metricConfig.key))}
                r="4"
                fill={COMPARISON_EXEMPLAR_COLOR}
              />
            {/if}
          {:else}
            <path
              d={primaryPath}
              fill="none"
              stroke={chartMetricsColorScale(metricConfig.key)}
              stroke-width="3"
              stroke-linejoin="round"
              stroke-linecap="round"
            />

            {#if latestPrimaryMetric}
              <circle
                cx={xScale(latestPrimaryMetric.tick)}
                cy={yScale(getMetricValue(latestPrimaryMetric, metricConfig.key))}
                r="4"
                fill={chartMetricsColorScale(metricConfig.key)}
              />
            {/if}

            {#if getAverageValue($policyTargetAveragesStore, metricConfig.key) !== null}
              {@const targetValue = getAverageValue($policyTargetAveragesStore, metricConfig.key) as number}
              <line
                x1="0"
                x2={innerWidth}
                y1={yScale(targetValue)}
                y2={yScale(targetValue)}
                stroke="#6b7280"
                stroke-dasharray="8 4"
                stroke-width="1.5"
                opacity="0.9"
              />
            {/if}

            {#if getAverageValue($userPolicyResultStore?.averages, metricConfig.key) !== null}
              {@const userValue = getAverageValue($userPolicyResultStore?.averages, metricConfig.key) as number}
              <line
                x1="0"
                x2={innerWidth}
                y1={yScale(userValue)}
                y2={yScale(userValue)}
                stroke="#0f766e"
                stroke-dasharray="4 4"
                stroke-width="1.5"
                opacity="0.9"
              />
            {/if}

            {#if getAverageValue($exemplarPolicyResultStore?.averages, metricConfig.key) !== null}
              {@const exemplarValue = getAverageValue($exemplarPolicyResultStore?.averages, metricConfig.key) as number}
              <line
                x1="0"
                x2={innerWidth}
                y1={yScale(exemplarValue)}
                y2={yScale(exemplarValue)}
                stroke="#7c3aed"
                stroke-dasharray="2 3"
                stroke-width="1.5"
                opacity="0.9"
              />
            {/if}
          {/if}

          {#if hoveredMetric?.key === metricConfig.key}
            {@const hoveredValue = getMetricValue(hoveredMetric.metric, metricConfig.key)}
            <line
              x1={xScale(hoveredMetric.metric.tick)}
              x2={xScale(hoveredMetric.metric.tick)}
              y1="0"
              y2={innerHeight}
              stroke={chartMetricsColorScale(metricConfig.key)}
              stroke-dasharray="4 4"
              stroke-width="1.5"
              opacity="0.45"
            />
            <circle
              cx={xScale(hoveredMetric.metric.tick)}
              cy={yScale(hoveredValue)}
              r="5"
              fill={chartMetricsColorScale(metricConfig.key)}
              stroke="white"
              stroke-width="2"
            />
          {/if}
        </g>
      </svg>
    </div>
  {/each}
</div>