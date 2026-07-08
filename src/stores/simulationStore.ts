import { tick } from 'svelte';
import { writable, get } from 'svelte/store';
import { SimulationEngine } from '../engine/SimulationEngine';
import { WORLD_HEIGHT, WORLD_WIDTH } from '../engine/world';
import type { Agent, Venue, ReactionPreview, SegregationMetrics } from '../engine/types/models';

// 1. Initialize the headless engine
export const engine = new SimulationEngine({
  width: WORLD_WIDTH,
  height: WORLD_HEIGHT,
  density: 0.8,
  similarityThreshold: 0.5,
  venueBoost: 0.2
});

// Initialize the grid mathematically before exposing to UI
engine.initEmptyGrid();

// 2. Reactive State Stores for Svelte Components
export const agentsStore = writable<Agent[]>(Array.from(engine.agents.values()));
export const venuesStore = writable<Venue[]>(Array.from(engine.venues.values()));
export const tickStore = writable<number>(engine.tickCount);
export const metricsHistoryStore = writable<SegregationMetrics[]>([engine.getMetrics()]);

// Temporary state for the "Exploration" drag-and-drop feature
export const ghostReactionsStore = writable<ReactionPreview[]>([]);
export const hoveredVenueId = writable<string | null>(null);
export const isGeneratingVenuesStore = writable<boolean>(false);

// Internal loop reference for playing/pausing
let animationFrameId: number;
export const isPlayingStore = writable<boolean>(false);

const STABILITY_WINDOW = 12;
const STABILITY_DELTA_THRESHOLD = 0.02;

function rollingMean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function isMetricStable(history: SegregationMetrics[], selector: (m: SegregationMetrics) => number): boolean {
  const requiredLength = STABILITY_WINDOW * 2;
  if (history.length < requiredLength) return false;

  const recent = history.slice(-STABILITY_WINDOW).map(selector);
  const previous = history.slice(-requiredLength, -STABILITY_WINDOW).map(selector);

  const delta = Math.abs(rollingMean(recent) - rollingMean(previous));
  return delta <= STABILITY_DELTA_THRESHOLD;
}

function shouldAutoPauseForStability(history: SegregationMetrics[]): boolean {
  return (
    isMetricStable(history, (m) => m.dissimilarity) &&
    isMetricStable(history, (m) => m.exposure) &&
    isMetricStable(history, (m) => m.clustering)
  );
}

// 3. Helper: Synchronize the engine state with the Svelte stores
function syncStores() {
  agentsStore.set(Array.from(engine.agents.values()));
  venuesStore.set(Array.from(engine.venues.values()));
  tickStore.set(engine.tickCount);
}

function recordCurrentMetrics() {
  const nextMetrics = engine.getMetrics();
  metricsHistoryStore.update((history) => {
    const lastMetrics = history.at(-1);
    if (lastMetrics?.tick === nextMetrics.tick) {
      return [...history.slice(0, -1), nextMetrics];
    }
    return [...history, nextMetrics];
  });
}

// 4. Public Action Functions
export const simulationActions = {
  
  // Resets the board entirely
  reset() {
    engine.initEmptyGrid();
    syncStores();
    metricsHistoryStore.set([engine.getMetrics()]);
    this.stop();
  },

  // Advances the simulation by exactly one tick
  step() {
    const isStillActive = engine.tick();
    syncStores();
    recordCurrentMetrics();
    
    return isStillActive;
  },

  // Starts the continuous simulation loop
  play() {
    if (get(isPlayingStore)) return;
    isPlayingStore.set(true);

    const loop = () => {
      const isStillActive = this.step();
      const metricsHistory = get(metricsHistoryStore);
      const reachedStableRollingMean = shouldAutoPauseForStability(metricsHistory);

      // Throttle the visual speed of the loop for human observation
      if (isStillActive && !reachedStableRollingMean && get(isPlayingStore)) {
        setTimeout(() => {
          animationFrameId = requestAnimationFrame(loop);
        }, 200); // 200ms delay between ticks
      } else {
        this.stop();
      }
    };
    loop();
  },

  stop() {
    isPlayingStore.set(false);
    cancelAnimationFrame(animationFrameId);
  },


  // NEW: Narrative initialization triggers
  spawnProtagonist() {
    this.stop();
    engine.spawnProtagonist('red'); // You can default to red or green
    syncStores();
  },

  spawnPopulation() {
    this.stop();
    engine.spawnPopulation();
    syncStores();
  },

  // --- INTERACTIVE DRAG ACTIONS ---

  previewMove(color: 'red'|'green', id: string, targetX: number, targetY: number) {
    this.stop();
    const reactions = engine.previewLocalReactions(color, id, targetX, targetY);
    ghostReactionsStore.set(reactions);
  },

  clearPreview() {
    ghostReactionsStore.set([]);
  },

  commitMove(id: string, targetX: number, targetY: number) {
    this.stop();
    const success = engine.moveAgent(id, targetX, targetY);
    if (success) {
      syncStores();
      recordCurrentMetrics();
    }
    this.clearPreview();
    return success;
  },

  // --- VENUE INTERVENTIONS ---
  
  /**
   * Translates the NetLogo K-Medoids Voronoi logic into the TS engine.
   * You can expand the SimulationEngine class to handle this internally, 
   * but triggering it from here syncs the UI immediately.
   */
  async generateEmergentVenues() {
    if (get(isGeneratingVenuesStore)) return;

    isGeneratingVenuesStore.set(true);
    this.stop();

    await tick();
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => resolve());
    });

    try {
      // Call the Voronoi Relaxation algorithm.
      // In a 10x10 grid with 80% density, there are ~40 agents of each color.
      // A capacity of 20 means the math will automatically generate 2 venues per color (4 total)
      // and push them apart so they perfectly cover the map.
      engine.generateVenuesLloyds(20);

      syncStores();
      recordCurrentMetrics();
    } finally {
      isGeneratingVenuesStore.set(false);
    }
  },

  previewVenueMove(id: string, targetX: number, targetY: number) {
    this.stop();
    const reactions = engine.previewVenueReactions(id, targetX, targetY);
    ghostReactionsStore.set(reactions);
  },

  commitVenueMove(id: string, targetX: number, targetY: number) {
    this.stop();
    const success = engine.moveVenue(id, targetX, targetY);
    if (success) {
      syncStores();
      recordCurrentMetrics();
    }
    this.clearPreview();
    return success;
  }
};