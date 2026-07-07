export type EntityColor = 'red' | 'green';

export interface Agent {
  id: string;
  x: number;
  y: number;
  color: EntityColor;
  isHappy: boolean;
  utility: number; // NEW: Continuous score for sorting
}

export interface Venue {
  id: string;
  x: number;
  y: number;
  color: EntityColor;
}

export interface SimulationConfig {
  width?: number;
  height?: number;
  density?: number;
  similarityThreshold?: number;
  venueBoost?: number;
}

export interface ReactionPreview {
  id: string;
  originalHappiness: boolean;
  hypotheticalHappiness: boolean;
}

export interface SegregationMetrics {
  tick: number;
  dissimilarity: number;
  exposure: number;
  clustering: number;
}