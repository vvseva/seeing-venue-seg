import * as d3 from 'd3';
import type { EntityColor } from '../engine/types/models';

/**
 * Color mappings for the Agents and Venues.
 * We use a softer, modern palette rather than harsh CSS 'red' and 'green'
 * to ensure the museum visualization is visually pleasing and accessible.
 */
export const entityColors: Record<EntityColor, string> = {
  red: '#EF4444',   // Tailwind Red 500
  green: '#10B981'  // Tailwind Emerald 500
};

export const uiColors = {
  unhappyStroke: '#facc15', // Yellow dashed border for unhappy agents
  happyStroke: '#1f2937',   // Dark gray solid border for happy agents
  gridLine: '#e5e7eb',
  background: '#f9fafb'
};

/**
 * D3 Color Scale for the Live Charts.
 * If you add more metrics to the chart later (e.g., Exposure, Clustering),
 * you can map them automatically using this scale.
 */
export const chartMetricsColorScale = d3.scaleOrdinal<string>()
  .domain(['dissimilarity', 'exposure', 'clustering'])
  .range(['#3b82f6', '#8b5cf6', '#f59e0b']); // Blue, Purple, Amber

/**
 * Helper to get the correct fill color for any entity object.
 */
export function getFillColor(colorType: EntityColor): string {
  return entityColors[colorType] || '#9ca3af';
}