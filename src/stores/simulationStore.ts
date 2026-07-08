import { tick } from 'svelte';
import { writable, get } from 'svelte/store';
import { SimulationEngine } from '../engine/SimulationEngine';
import { WORLD_HEIGHT, WORLD_WIDTH } from '../engine/world';
import type { Agent, Venue, ReactionPreview, SegregationMetrics } from '../engine/types/models';

type MetricAverages = {
  dissimilarity: number;
  exposure: number;
  clustering: number;
  sampleSize: number;
};

type PolicyRunRecord = {
  placement: Venue[];
  averages: MetricAverages;
};

type ComparisonTickRecord = {
  tick: number;
  dissimilarity: number;
  exposure: number;
  clustering: number;
};

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

const compareUserEngine = new SimulationEngine({
  width: WORLD_WIDTH,
  height: WORLD_HEIGHT,
  density: 0.8,
  similarityThreshold: 0.5,
  venueBoost: 0.2
});

const compareExemplarEngine = new SimulationEngine({
  width: WORLD_WIDTH,
  height: WORLD_HEIGHT,
  density: 0.8,
  similarityThreshold: 0.5,
  venueBoost: 0.2
});

compareUserEngine.initEmptyGrid();
compareExemplarEngine.initEmptyGrid();

// 2. Reactive State Stores for Svelte Components
export const agentsStore = writable<Agent[]>(Array.from(engine.agents.values()));
export const venuesStore = writable<Venue[]>(Array.from(engine.venues.values()));
export const tickStore = writable<number>(engine.tickCount);
export const metricsHistoryStore = writable<SegregationMetrics[]>([engine.getMetrics()]);

// Temporary state for the "Exploration" drag-and-drop feature
export const ghostReactionsStore = writable<ReactionPreview[]>([]);
export const hoveredVenueId = writable<string | null>(null);
export const compareUserHoveredVenueIdStore = writable<string | null>(null);
export const compareExemplarHoveredVenueIdStore = writable<string | null>(null);
export const isGeneratingVenuesStore = writable<boolean>(false);
export const policyTargetAveragesStore = writable<MetricAverages | null>(null);
export const userPolicyResultStore = writable<PolicyRunRecord | null>(null);
export const exemplarPolicyResultStore = writable<PolicyRunRecord | null>(null);
export const isComparisonModeStore = writable<boolean>(false);

export const compareUserAgentsStore = writable<Agent[]>([]);
export const compareUserVenuesStore = writable<Venue[]>([]);
export const compareExemplarAgentsStore = writable<Agent[]>([]);
export const compareExemplarVenuesStore = writable<Venue[]>([]);

export const compareUserMetricsHistoryStore = writable<ComparisonTickRecord[]>([]);
export const compareExemplarMetricsHistoryStore = writable<ComparisonTickRecord[]>([]);

export const compareUserGhostReactionsStore = writable<ReactionPreview[]>([]);
export const compareExemplarGhostReactionsStore = writable<ReactionPreview[]>([]);

// Internal loop reference for playing/pausing
let animationFrameId: number;
export const isPlayingStore = writable<boolean>(false);

const STABILITY_WINDOW = 25;
const STABILITY_DELTA_THRESHOLD = 0.02;
const CHAPTER_TWO_SHORT_RUN_TICKS = 50;

let stabilityStartIndex = 0;
let policyBaselineAgentsSnapshot: Agent[] | null = null;

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
  const scopedHistory = history.slice(stabilityStartIndex);

  return (
    isMetricStable(scopedHistory, (m) => m.dissimilarity) &&
    isMetricStable(scopedHistory, (m) => m.exposure) &&
    isMetricStable(scopedHistory, (m) => m.clustering)
  );
}

function resetStabilityWindowBaseline() {
  const history = get(metricsHistoryStore);
  stabilityStartIndex = Math.max(0, history.length - 1);
}

function calculateAveragesOverLastTicks(ticks: number): MetricAverages {
  const history = get(metricsHistoryStore);
  const sample = history.slice(-Math.max(1, ticks));

  const sum = sample.reduce(
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
    dissimilarity: sampleSize > 0 ? sum.dissimilarity / sampleSize : 0,
    exposure: sampleSize > 0 ? sum.exposure / sampleSize : 0,
    clustering: sampleSize > 0 ? sum.clustering / sampleSize : 0,
    sampleSize
  };
}

function snapshotVenuePlacement(): Venue[] {
  return Array.from(engine.venues.values())
    .map((venue) => ({ ...venue }))
    .sort((a, b) => a.id.localeCompare(b.id));
}

function snapshotAgentsForPolicyBaseline(): Agent[] {
  return engine
    .getAgentsSnapshot()
    .map((agent) => ({ ...agent }))
    .sort((a, b) => a.id.localeCompare(b.id));
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

function syncComparisonStores() {
  compareUserAgentsStore.set(Array.from(compareUserEngine.agents.values()));
  compareUserVenuesStore.set(Array.from(compareUserEngine.venues.values()));
  compareExemplarAgentsStore.set(Array.from(compareExemplarEngine.agents.values()));
  compareExemplarVenuesStore.set(Array.from(compareExemplarEngine.venues.values()));
}

function resetComparisonStores() {
  isComparisonModeStore.set(false);
  compareUserHoveredVenueIdStore.set(null);
  compareExemplarHoveredVenueIdStore.set(null);
  compareUserAgentsStore.set([]);
  compareUserVenuesStore.set([]);
  compareExemplarAgentsStore.set([]);
  compareExemplarVenuesStore.set([]);
  compareUserMetricsHistoryStore.set([]);
  compareExemplarMetricsHistoryStore.set([]);
  compareUserGhostReactionsStore.set([]);
  compareExemplarGhostReactionsStore.set([]);
}

function recordComparisonMetrics() {
  const userMetrics = compareUserEngine.getMetrics();
  const exemplarMetrics = compareExemplarEngine.getMetrics();

  compareUserMetricsHistoryStore.update((history) => [...history, userMetrics]);
  compareExemplarMetricsHistoryStore.update((history) => [...history, exemplarMetrics]);
}

// 4. Public Action Functions
export const simulationActions = {
  resetStabilityWindow() {
    resetStabilityWindowBaseline();
  },
  
  // Resets the board entirely
  reset() {
    engine.initEmptyGrid();
    syncStores();
    hoveredVenueId.set(null);
    metricsHistoryStore.set([engine.getMetrics()]);
    policyTargetAveragesStore.set(null);
    userPolicyResultStore.set(null);
    exemplarPolicyResultStore.set(null);
    policyBaselineAgentsSnapshot = null;
    resetComparisonStores();
    resetStabilityWindowBaseline();
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

  playForTicks(ticks: number = CHAPTER_TWO_SHORT_RUN_TICKS, onComplete?: () => void) {
    if (get(isPlayingStore)) return;

    const totalTicks = Math.max(1, Math.floor(ticks));
    let ticksRemaining = totalTicks;
    isPlayingStore.set(true);

    const loop = () => {
      const isStillActive = this.step();
      ticksRemaining--;

      if (isStillActive && ticksRemaining > 0 && get(isPlayingStore)) {
        setTimeout(() => {
          animationFrameId = requestAnimationFrame(loop);
        }, 200);
      } else {
        this.stop();
        onComplete?.();
      }
    };

    loop();
  },

  capturePolicyTargetFromLast25Ticks() {
    policyTargetAveragesStore.set(calculateAveragesOverLastTicks(25));
  },

  runUserPolicyEvaluation() {
    this.stop();
    resetStabilityWindowBaseline();
    policyBaselineAgentsSnapshot = snapshotAgentsForPolicyBaseline();
    isComparisonModeStore.set(false);

    const placement = snapshotVenuePlacement();
    return new Promise<void>((resolve) => {
      this.playForTicks(25, () => {
        userPolicyResultStore.set({
          placement,
          averages: calculateAveragesOverLastTicks(25)
        });
        resolve();
      });
    });
  },

  runExemplarPolicyEvaluation() {
    this.stop();
    if (!policyBaselineAgentsSnapshot) {
      policyBaselineAgentsSnapshot = snapshotAgentsForPolicyBaseline();
    }
    engine.applyIntegratedVenuePolicy();
    syncStores();
    recordCurrentMetrics();
    resetStabilityWindowBaseline();

    const placement = snapshotVenuePlacement();
    return new Promise<void>((resolve) => {
      this.playForTicks(25, () => {
        exemplarPolicyResultStore.set({
          placement,
          averages: calculateAveragesOverLastTicks(25)
        });
        resolve();
      });
    });
  },

  runSideBySideComparison() {
    this.stop();

    const userResult = get(userPolicyResultStore);
    const exemplarResult = get(exemplarPolicyResultStore);
    const baselineAgents = policyBaselineAgentsSnapshot ?? snapshotAgentsForPolicyBaseline();
    const userPlacement = userResult?.placement ?? snapshotVenuePlacement();
    const exemplarPlacement = exemplarResult?.placement ?? snapshotVenuePlacement();

    compareUserEngine.initializeScenario(baselineAgents, userPlacement);
    compareExemplarEngine.initializeScenario(baselineAgents, exemplarPlacement);
    compareUserHoveredVenueIdStore.set(null);
    compareExemplarHoveredVenueIdStore.set(null);

    compareUserMetricsHistoryStore.set([compareUserEngine.getMetrics()]);
    compareExemplarMetricsHistoryStore.set([compareExemplarEngine.getMetrics()]);
    syncComparisonStores();
    isComparisonModeStore.set(true);

    return new Promise<void>((resolve) => {
      let ticksRemaining = 25;
      const loop = () => {
        const userActive = compareUserEngine.tick();
        const exemplarActive = compareExemplarEngine.tick();
        ticksRemaining--;

        syncComparisonStores();
        recordComparisonMetrics();

        if ((userActive || exemplarActive) && ticksRemaining > 0) {
          setTimeout(() => {
            requestAnimationFrame(loop);
          }, 200);
          return;
        }

        resolve();
      };

      loop();
    });
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
    resetStabilityWindowBaseline();
  },

  spawnTutorialGroups() {
    this.stop();
    engine.spawnTutorialGroups();
    syncStores();
    resetStabilityWindowBaseline();
  },

  spawnPopulation() {
    this.stop();
    engine.spawnPopulation();
    syncStores();
    resetStabilityWindowBaseline();
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
      resetStabilityWindowBaseline();
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
      resetStabilityWindowBaseline();
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
      resetStabilityWindowBaseline();
    }
    this.clearPreview();
    return success;
  }
};