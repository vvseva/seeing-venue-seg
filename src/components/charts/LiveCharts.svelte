<script lang="ts">
  import * as d3 from 'd3';
  import { metricsHistoryStore } from '../../stores/simulationStore';
  import type { SegregationMetrics } from '../../engine/types/models';
  import { chartMetricsColorScale } from '../../utils/colors';

  type MetricKey = 'dissimilarity' | 'exposure' | 'clustering';
  type MetricConfig = {
    key: MetricKey;
    title: string;
  };

  const width = 320;
  const height = 190;
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

  function createXScale(history: SegregationMetrics[]) {
    return d3.scaleLinear()
      .domain([0, d3.max(history, (metric) => metric.tick) || 10])
      .range([0, innerWidth]);
  }

  function createYScale(history: SegregationMetrics[], metricKey: MetricKey) {
    const maxValue = d3.max(history, (metric) => metric[metricKey]) || 0;

    return d3.scaleLinear()
      .domain([0, Math.max(1, maxValue)])
      .range([innerHeight, 0]);
  }

  function createPathData(history: SegregationMetrics[], metricKey: MetricKey) {
    const xScale = createXScale(history);
    const yScale = createYScale(history, metricKey);

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
</script>

<div class="charts-stack">
  {#each metricConfigs as metricConfig}
    {@const xScale = createXScale(metricsHistory)}
    {@const yScale = createYScale(metricsHistory, metricConfig.key)}
    {@const pathData = createPathData(metricsHistory, metricConfig.key)}
    <div class="chart-container">
      <h3>{metricConfig.title}</h3>
      <p class="chart-value">
        {#if hoveredMetric?.key === metricConfig.key}
          Tick {hoveredMetric.metric.tick}: {getMetricValue(hoveredMetric.metric, metricConfig.key).toFixed(3)}
        {:else if latestMetric}
          Tick {latestMetric.tick}: {getMetricValue(latestMetric, metricConfig.key).toFixed(3)}
        {:else}
          Waiting for simulation data...
        {/if}
      </p>
      
      <svg
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        role="img"
        aria-label={`Interactive chart for ${metricConfig.title}`}
        on:pointermove={(event) => handlePointerMove(event, metricsHistory, metricConfig.key)}
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

          <path
            d={pathData}
            fill="none"
            stroke={chartMetricsColorScale(metricConfig.key)}
            stroke-width="3"
            stroke-linejoin="round"
            stroke-linecap="round"
          />

          {#if latestMetric}
            <circle
              cx={xScale(latestMetric.tick)}
              cy={yScale(getMetricValue(latestMetric, metricConfig.key))}
              r="4"
              fill={chartMetricsColorScale(metricConfig.key)}
            />
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