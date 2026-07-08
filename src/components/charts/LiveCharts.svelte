<script lang="ts">
  import * as d3 from 'd3';
  import {
    metricsHistoryStore,
    policyTargetAveragesStore,
    userPolicyResultStore,
    exemplarPolicyResultStore,
    compareUserMetricsHistoryStore,
    compareExemplarMetricsHistoryStore,
    monteCarloUserRunsStore,
    monteCarloExemplarRunsStore,
    monteCarloUserAverageStore,
    monteCarloExemplarAverageStore
  } from '../../stores/simulationStore';
  import { currentChapterIndex } from '../../stores/narrativeStore';
  import type { SegregationMetrics } from '../../engine/types/models';
  import { chartMetricsColorScale } from '../../utils/colors';

  type MetricKey = 'dissimilarity' | 'exposure' | 'clustering';
  type MetricConfig = {
    key: MetricKey;
    title: string;
  };

  type MetricExplanation = {
    shortTitle: string;
    howCalculated: string;
    meaning: string;
  };

  type MetricAverages = {
    dissimilarity: number;
    exposure: number;
    clustering: number;
    sampleSize: number;
  };

  type MetricPoint = {
    tick: number;
    dissimilarity: number;
    exposure: number;
    clustering: number;
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
  let hoveredLineInfo: { key: MetricKey; title: string; description: string } | null = null;
  let highlightedMetricKey: MetricKey | null = null;

  const metricExplanations: Record<MetricKey, MetricExplanation> = {
    exposure: {
      shortTitle: 'Exposure (Front Porch Test)',
      howCalculated:
        'For each person in the target group, we count immediate neighbors and compute the share who are from the same group. Then we average that share across the whole target group.',
      meaning:
        'High values mean the average person mostly sees their own group in day-to-day local surroundings, indicating isolation.'
    },
    dissimilarity: {
      shortTitle: 'Dissimilarity (Neighborhood Mix Test)',
      howCalculated:
        'We split the grid into equal tracts, compare each tract\'s group mix to the city-wide mix, and sum those local gaps.',
      meaning:
        'It estimates how unevenly groups are spread and how much relocation would be needed to make all neighborhoods similarly mixed.'
    },
    clustering: {
      shortTitle: 'Spatial Clustering (Bird\'s-Eye View Test)',
      howCalculated:
        'We measure distances between agents, weighting close same-group pairs much more than far-apart pairs, then normalize against the full population pattern.',
      meaning:
        'High values mean same-group neighborhoods are clumped together into larger continuous enclaves rather than scattered.'
    }
  };

  function createXScale(seriesList: MetricPoint[][]) {
    const nonEmptySeries = seriesList.filter((series) => series.length > 0);
    const maxTick = Math.max(
      ...nonEmptySeries.map((series) => d3.max(series, (metric) => metric.tick) || 0),
      10
    );

    return d3.scaleLinear()
      .domain([0, maxTick])
      .range([0, innerWidth]);
  }

  function createYScale(
    metricKey: MetricKey,
    seriesList: MetricPoint[][],
    includeReferenceValues: boolean
  ) {
    const recentValues = seriesList
      .flatMap((series) => series.slice(-Y_AXIS_WINDOW_TICKS))
      .map((metric) => metric[metricKey]);
    const referenceValues = includeReferenceValues
      ? [
          $policyTargetAveragesStore?.[metricKey] ?? 0,
          $userPolicyResultStore?.averages[metricKey] ?? 0,
          $exemplarPolicyResultStore?.averages[metricKey] ?? 0
        ]
      : [];

    const allValues = [...recentValues, ...referenceValues];
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
    history: MetricPoint[],
    metricKey: MetricKey,
    xScale: d3.ScaleLinear<number, number>,
    yScale: d3.ScaleLinear<number, number>
  ) {
    return d3.line<MetricPoint>()
      .x((metric) => xScale(metric.tick))
      .y((metric) => yScale(metric[metricKey]))
      .curve(d3.curveMonotoneX)(history) || '';
  }

  function getMetricValue(metric: SegregationMetrics, metricKey: MetricKey) {
    return metric[metricKey];
  }

  function getClosestMetric(
    history: MetricPoint[],
    metricKey: MetricKey,
    pointerX: number,
    xScale: d3.ScaleLinear<number, number>
  ) {
    if (history.length === 0) return null;

    const domainX = xScale.invert(pointerX);
    const bisectTick = d3.bisector((metric: SegregationMetrics) => metric.tick).center;
    const index = bisectTick(history, domainX);
    const metric = history[index] ?? history.at(-1);

    return metric ? { key: metricKey, metric } : null;
  }

  function handlePointerMove(
    event: PointerEvent,
    history: MetricPoint[],
    metricKey: MetricKey,
    xScale: d3.ScaleLinear<number, number>
  ) {
    const svg = event.currentTarget as SVGSVGElement;
    const rect = svg.getBoundingClientRect();
    const relativeX = ((event.clientX - rect.left) / rect.width) * innerWidth;
    hoveredMetric = getClosestMetric(history, metricKey, Math.max(0, Math.min(innerWidth, relativeX)), xScale);
  }

  function handlePointerLeave() {
    hoveredMetric = null;
    hoveredLineInfo = null;
  }

  function setHoveredLineInfo(key: MetricKey, title: string, description: string) {
    hoveredLineInfo = { key, title, description };
  }

  function clearHoveredLineInfo(key: MetricKey) {
    if (hoveredLineInfo?.key === key) {
      hoveredLineInfo = null;
    }
  }

  function setHighlightedMetric(key: MetricKey) {
    highlightedMetricKey = key;
  }

  function clearHighlightedMetric(key: MetricKey) {
    if (highlightedMetricKey === key) {
      highlightedMetricKey = null;
    }
  }

  function getAverageValue(averages: MetricAverages | null | undefined, key: MetricKey) {
    if (!averages) return null;
    return averages[key];
  }

  function clipSeriesToTick(series: MetricPoint[], maxTick: number): MetricPoint[] {
    return series.filter((point) => point.tick <= maxTick);
  }
</script>

<div class="charts-stack">
  {#each metricConfigs as metricConfig}
    {@const comparisonUserHistory = $compareUserMetricsHistoryStore}
    {@const comparisonExemplarHistory = $compareExemplarMetricsHistoryStore}
    {@const monteCarloUserRuns = $monteCarloUserRunsStore}
    {@const monteCarloExemplarRuns = $monteCarloExemplarRunsStore}
    {@const monteCarloUserAverage = $monteCarloUserAverageStore}
    {@const monteCarloExemplarAverage = $monteCarloExemplarAverageStore}
    {@const isMonteCarloStage = $currentChapterIndex === 11 && monteCarloUserAverage.length > 0 && monteCarloExemplarAverage.length > 0}
    {@const isSideBySideStage = !isMonteCarloStage && $currentChapterIndex === 10 && comparisonUserHistory.length > 0 && comparisonExemplarHistory.length > 0}
    {@const maxAnimatedTick = Math.min(comparisonUserHistory.at(-1)?.tick ?? 0, comparisonExemplarHistory.at(-1)?.tick ?? 0)}
    {@const visibleMonteCarloUserRuns = (isMonteCarloStage ? monteCarloUserRuns.map((run) => clipSeriesToTick(run, maxAnimatedTick)) : []) as MetricPoint[][]}
    {@const visibleMonteCarloExemplarRuns = (isMonteCarloStage ? monteCarloExemplarRuns.map((run) => clipSeriesToTick(run, maxAnimatedTick)) : []) as MetricPoint[][]}
    {@const visibleMonteCarloUserAverage = (isMonteCarloStage ? clipSeriesToTick(monteCarloUserAverage, maxAnimatedTick) : []) as MetricPoint[]}
    {@const visibleMonteCarloExemplarAverage = (isMonteCarloStage ? clipSeriesToTick(monteCarloExemplarAverage, maxAnimatedTick) : []) as MetricPoint[]}
    {@const primaryHistory = (isMonteCarloStage ? visibleMonteCarloUserAverage : (isSideBySideStage ? comparisonUserHistory : metricsHistory)) as MetricPoint[]}
    {@const secondaryHistory = (isMonteCarloStage ? visibleMonteCarloExemplarAverage : (isSideBySideStage ? comparisonExemplarHistory : [])) as MetricPoint[]}
    {@const monteCarloSeries = (isMonteCarloStage ? [...visibleMonteCarloUserRuns, ...visibleMonteCarloExemplarRuns, visibleMonteCarloUserAverage, visibleMonteCarloExemplarAverage] : []) as MetricPoint[][]}
    {@const chartSeries = (isMonteCarloStage ? monteCarloSeries : [primaryHistory, secondaryHistory]) as MetricPoint[][]}
    {@const xScale = createXScale(chartSeries)}
    {@const yScale = createYScale(metricConfig.key, chartSeries, !isSideBySideStage && !isMonteCarloStage)}
    {@const primaryPath = createPathData(primaryHistory, metricConfig.key, xScale, yScale)}
    {@const secondaryPath = createPathData(secondaryHistory, metricConfig.key, xScale, yScale)}
    {@const latestPrimaryMetric = primaryHistory.at(-1)}
    {@const latestSecondaryMetric = secondaryHistory.at(-1)}
    <div
      class="chart-container"
      class:metric-highlighted={highlightedMetricKey === metricConfig.key}
      role="presentation"
      on:mouseenter={() => setHighlightedMetric(metricConfig.key)}
      on:mouseleave={() => clearHighlightedMetric(metricConfig.key)}
    >
      <h3>{metricConfig.title}</h3>

      {#if highlightedMetricKey === metricConfig.key}
        <div class="metric-explanation" role="note" aria-live="polite">
          <p class="metric-explanation-title">{metricExplanations[metricConfig.key].shortTitle}</p>
          <p class="metric-explanation-line"><strong>How it is calculated:</strong> {metricExplanations[metricConfig.key].howCalculated}</p>
          <p class="metric-explanation-line"><strong>What it tells us:</strong> {metricExplanations[metricConfig.key].meaning}</p>
        </div>
      {/if}

      <div class="chart-badges">
        {#if isMonteCarloStage}
          <span class="tiny-badge tiny-badge-you-soft">Your runs</span>
          <span class="tiny-badge tiny-badge-exemplar-soft">Exemplar runs</span>
          <span class="tiny-badge tiny-badge-you-strong">Your mean</span>
          <span class="tiny-badge tiny-badge-exemplar-strong">Exemplar mean</span>
        {:else if isSideBySideStage}
          <span class="tiny-badge tiny-badge-you-strong">Your trajectory</span>
          <span class="tiny-badge tiny-badge-exemplar-strong">Exemplar trajectory</span>
        {:else}
          <span class="tiny-badge tiny-badge-neutral">Live metric</span>
          {#if getAverageValue($policyTargetAveragesStore, metricConfig.key) !== null}
            <span class="tiny-badge tiny-badge-neutral">Target avg</span>
          {/if}
          {#if getAverageValue($userPolicyResultStore?.averages, metricConfig.key) !== null}
            <span class="tiny-badge tiny-badge-you-soft">Your avg</span>
          {/if}
          {#if getAverageValue($exemplarPolicyResultStore?.averages, metricConfig.key) !== null}
            <span class="tiny-badge tiny-badge-exemplar-soft">Exemplar avg</span>
          {/if}
        {/if}
      </div>
      <p class="chart-value">
        {#if isMonteCarloStage && latestPrimaryMetric && latestSecondaryMetric}
          Tick {latestPrimaryMetric.tick}: Mean You {getMetricValue(latestPrimaryMetric, metricConfig.key).toFixed(3)} | Mean Exemplar {getMetricValue(latestSecondaryMetric, metricConfig.key).toFixed(3)}
        {:else if isSideBySideStage && latestPrimaryMetric && latestSecondaryMetric}
          Tick {latestPrimaryMetric.tick}: You {getMetricValue(latestPrimaryMetric, metricConfig.key).toFixed(3)} | Exemplar {getMetricValue(latestSecondaryMetric, metricConfig.key).toFixed(3)}
        {:else if hoveredMetric?.key === metricConfig.key}
          Tick {hoveredMetric.metric.tick}: {getMetricValue(hoveredMetric.metric, metricConfig.key).toFixed(3)}
        {:else if latestMetric}
          Tick {latestMetric.tick}: {getMetricValue(latestMetric, metricConfig.key).toFixed(3)}
        {:else}
          Waiting for simulation data...
        {/if}
      </p>

      {#if !isSideBySideStage && !isMonteCarloStage && $policyTargetAveragesStore}
        <p class="chart-value">Target avg (25 ticks): {($policyTargetAveragesStore[metricConfig.key]).toFixed(3)}</p>
      {/if}
      {#if !isSideBySideStage && !isMonteCarloStage && $userPolicyResultStore}
        <p class="chart-value">Your policy avg: {($userPolicyResultStore.averages[metricConfig.key]).toFixed(3)}</p>
      {/if}
      {#if !isSideBySideStage && !isMonteCarloStage && $exemplarPolicyResultStore}
        <p class="chart-value">Exemplar avg: {($exemplarPolicyResultStore.averages[metricConfig.key]).toFixed(3)}</p>
      {/if}
      {#if isSideBySideStage}
        <p class="chart-value">Blue: your policy trajectory | Orange: exemplar trajectory</p>
      {/if}
      {#if isMonteCarloStage}
        <p class="chart-value">10 runs per policy. Thin lines: individual runs | Bold lines: average trajectories.</p>
      {/if}
      <p class="chart-hint">
        {#if hoveredLineInfo?.key === metricConfig.key}
          <strong>{hoveredLineInfo.title}:</strong> {hoveredLineInfo.description}
        {:else if isMonteCarloStage}
          Hover a line to see whether it is one random run or the average across runs.
        {:else if isSideBySideStage}
          Hover a line to see which policy trajectory it represents.
        {:else}
          Hover solid and dashed lines to see exactly what each reference means.
        {/if}
      </p>
      
      <svg
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        role="img"
        aria-label={`Interactive chart for ${metricConfig.title}`}
        on:pointermove={(event) => handlePointerMove(event, primaryHistory, metricConfig.key, xScale)}
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

          {#if isMonteCarloStage}
            {#each visibleMonteCarloUserRuns as run, runIndex (runIndex)}
              <path
                d={createPathData(run, metricConfig.key, xScale, yScale)}
                fill="none"
                stroke={COMPARISON_USER_COLOR}
                stroke-width="1.2"
                stroke-linejoin="round"
                stroke-linecap="round"
                opacity="0.14"
              />
              <path
                d={createPathData(run, metricConfig.key, xScale, yScale)}
                fill="none"
                stroke="transparent"
                stroke-width="10"
                role="presentation"
                on:pointerenter={() => setHoveredLineInfo(metricConfig.key, `Your run ${runIndex + 1}`, 'One stochastic trajectory from your venue policy. Thin lines show run-to-run randomness.')}
                on:pointerleave={() => clearHoveredLineInfo(metricConfig.key)}
              />
            {/each}

            {#each visibleMonteCarloExemplarRuns as run, runIndex (runIndex)}
              <path
                d={createPathData(run, metricConfig.key, xScale, yScale)}
                fill="none"
                stroke={COMPARISON_EXEMPLAR_COLOR}
                stroke-width="1.2"
                stroke-linejoin="round"
                stroke-linecap="round"
                opacity="0.14"
              />
              <path
                d={createPathData(run, metricConfig.key, xScale, yScale)}
                fill="none"
                stroke="transparent"
                stroke-width="10"
                role="presentation"
                on:pointerenter={() => setHoveredLineInfo(metricConfig.key, `Exemplar run ${runIndex + 1}`, 'One stochastic trajectory from the exemplar venue policy.')}
                on:pointerleave={() => clearHoveredLineInfo(metricConfig.key)}
              />
            {/each}

            <path
              d={primaryPath}
              fill="none"
              stroke={COMPARISON_USER_COLOR}
              stroke-width="3.4"
              stroke-linejoin="round"
              stroke-linecap="round"
              opacity="0.96"
              role="presentation"
              on:pointerenter={() => setHoveredLineInfo(metricConfig.key, 'Your mean trajectory', 'Bold blue line is the per-tick average over all your policy runs.')}
              on:pointerleave={() => clearHoveredLineInfo(metricConfig.key)}
            />

            <path
              d={secondaryPath}
              fill="none"
              stroke={COMPARISON_EXEMPLAR_COLOR}
              stroke-width="3.4"
              stroke-linejoin="round"
              stroke-linecap="round"
              opacity="0.96"
              role="presentation"
              on:pointerenter={() => setHoveredLineInfo(metricConfig.key, 'Exemplar mean trajectory', 'Bold orange line is the per-tick average over all exemplar runs.')}
              on:pointerleave={() => clearHoveredLineInfo(metricConfig.key)}
            />

            {#if latestPrimaryMetric}
              <text
                x={innerWidth - 2}
                y={Math.max(10, yScale(getMetricValue(latestPrimaryMetric, metricConfig.key)) - 8)}
                text-anchor="end"
                class="chart-direct-label"
                fill={COMPARISON_USER_COLOR}
              >
                Your mean
              </text>
            {/if}

            {#if latestSecondaryMetric}
              <text
                x={innerWidth - 2}
                y={Math.max(22, yScale(getMetricValue(latestSecondaryMetric, metricConfig.key)) + 14)}
                text-anchor="end"
                class="chart-direct-label"
                fill={COMPARISON_EXEMPLAR_COLOR}
              >
                Exemplar mean
              </text>
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
          {:else if isSideBySideStage}
            <path
              d={primaryPath}
              fill="none"
              stroke={COMPARISON_USER_COLOR}
              stroke-width="3"
              stroke-linejoin="round"
              stroke-linecap="round"
              opacity="0.92"
              role="presentation"
              on:pointerenter={() => setHoveredLineInfo(metricConfig.key, 'Your trajectory', 'Blue line shows your policy path in this single comparison run.')}
              on:pointerleave={() => clearHoveredLineInfo(metricConfig.key)}
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
                role="presentation"
                on:pointerenter={() => setHoveredLineInfo(metricConfig.key, 'Exemplar trajectory', 'Orange line shows the exemplar policy path in this run.')}
                on:pointerleave={() => clearHoveredLineInfo(metricConfig.key)}
              />
            {/if}

            {#if latestPrimaryMetric}
              <text
                x={innerWidth - 2}
                y={Math.max(10, yScale(getMetricValue(latestPrimaryMetric, metricConfig.key)) - 8)}
                text-anchor="end"
                class="chart-direct-label"
                fill={COMPARISON_USER_COLOR}
              >
                You
              </text>
            {/if}

            {#if latestSecondaryMetric}
              <text
                x={innerWidth - 2}
                y={Math.max(22, yScale(getMetricValue(latestSecondaryMetric, metricConfig.key)) + 14)}
                text-anchor="end"
                class="chart-direct-label"
                fill={COMPARISON_EXEMPLAR_COLOR}
              >
                Exemplar
              </text>
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
              role="presentation"
              on:pointerenter={() => setHoveredLineInfo(metricConfig.key, 'Live metric line', 'Solid line tracks this metric over time for the active world.')}
              on:pointerleave={() => clearHoveredLineInfo(metricConfig.key)}
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
                role="presentation"
                on:pointerenter={() => setHoveredLineInfo(metricConfig.key, 'Target average', 'Gray dashed line marks the baseline average captured from chapter 7.')}
                on:pointerleave={() => clearHoveredLineInfo(metricConfig.key)}
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
                role="presentation"
                on:pointerenter={() => setHoveredLineInfo(metricConfig.key, 'Your policy average', 'Teal dashed line is your 25-tick average after policy placement.')}
                on:pointerleave={() => clearHoveredLineInfo(metricConfig.key)}
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
                role="presentation"
                on:pointerenter={() => setHoveredLineInfo(metricConfig.key, 'Exemplar policy average', 'Purple dashed line is the exemplar 25-tick average.')}
                on:pointerleave={() => clearHoveredLineInfo(metricConfig.key)}
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
              stroke={isMonteCarloStage ? COMPARISON_USER_COLOR : chartMetricsColorScale(metricConfig.key)}
              stroke-dasharray="4 4"
              stroke-width="1.5"
              opacity="0.45"
            />
            <circle
              cx={xScale(hoveredMetric.metric.tick)}
              cy={yScale(hoveredValue)}
              r="5"
              fill={isMonteCarloStage ? COMPARISON_USER_COLOR : chartMetricsColorScale(metricConfig.key)}
              stroke="white"
              stroke-width="2"
            />
          {/if}
        </g>
      </svg>
    </div>
  {/each}
</div>