import { tick } from 'svelte';
import { writable, get } from 'svelte/store';
import { SimulationEngine } from '../engine/SimulationEngine';
import {
  DEFAULT_WORLD_PARAMETERS,
  sanitizeWorldParameters,
  type WorldParameters
} from '../engine/world';
import type { Agent, Venue, ReactionPreview, SegregationMetrics } from '../engine/types/models';
import {
  averageComparisonRuns,
  calculateMetricAveragesOverLastTicks,
  shouldAutoPauseForStability,
  type MetricAverages,
  type TickMetrics
} from './simulationStore.math';

type PolicyRunRecord = {
  placement: Venue[];
  averages: MetricAverages;
};

type ComparisonTickRecord = TickMetrics;
export type VisualizationStyle = 'cats-and-dogs' | 'emoji';

export const worldParametersStore = writable<WorldParameters>({ ...DEFAULT_WORLD_PARAMETERS });
export const visualizationStyleStore = writable<VisualizationStyle>('cats-and-dogs');

function createEngineFromParameters(parameters: WorldParameters): SimulationEngine {
  const nextEngine = new SimulationEngine({
    width: parameters.width,
    height: parameters.height,
    density: parameters.density,
    similarityThreshold: parameters.similarityThreshold,
    venueRadius: parameters.venueRadius
  });

  nextEngine.initEmptyGrid();
  return nextEngine;
}

// 1. Initialize the headless engine
export let engine = createEngineFromParameters(DEFAULT_WORLD_PARAMETERS);
let compareUserEngine = createEngineFromParameters(DEFAULT_WORLD_PARAMETERS);
let compareExemplarEngine = createEngineFromParameters(DEFAULT_WORLD_PARAMETERS);

function recreateAllEngines(parameters: WorldParameters): void {
  engine = createEngineFromParameters(parameters);
  compareUserEngine = createEngineFromParameters(parameters);
  compareExemplarEngine = createEngineFromParameters(parameters);
}

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
export const monteCarloUserRunsStore = writable<ComparisonTickRecord[][]>([]);
export const monteCarloExemplarRunsStore = writable<ComparisonTickRecord[][]>([]);
export const monteCarloUserAverageStore = writable<ComparisonTickRecord[]>([]);
export const monteCarloExemplarAverageStore = writable<ComparisonTickRecord[]>([]);

export const compareUserGhostReactionsStore = writable<ReactionPreview[]>([]);
export const compareExemplarGhostReactionsStore = writable<ReactionPreview[]>([]);

// Internal loop reference for playing/pausing
let animationFrameId: number;
export const isPlayingStore = writable<boolean>(false);

const STABILITY_WINDOW = 25;
const STABILITY_DELTA_THRESHOLD = 0.02;
const CHAPTER_TWO_SHORT_RUN_TICKS = 50;
const COMPARISON_TICKS = 50;
const MONTE_CARLO_RUNS = 10;
const COMPARISON_ANIMATION_DELAY_MS = 200;
const FAST_COMPARISON_ANIMATION_DELAY_MS = 85;

let stabilityStartIndex = 0;
let policyBaselineAgentsSnapshot: Agent[] | null = null;

function resetStabilityWindowBaseline() {
  const history = get(metricsHistoryStore);
  stabilityStartIndex = Math.max(0, history.length - 1);
}

function calculateAveragesOverLastTicks(ticks: number): MetricAverages {
  return calculateMetricAveragesOverLastTicks(get(metricsHistoryStore), ticks);
}

function snapshotVenuePlacement(): Venue[] {
  return Array.from(engine.venues.values())
    .map((venue) => ({ ...venue }))
    .sort((a, b) => a.id.localeCompare(b.id));
}

function snapshotVenuePlacementFromEngine(targetEngine: SimulationEngine): Venue[] {
  return Array.from(targetEngine.venues.values())
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
  monteCarloUserRunsStore.set([]);
  monteCarloExemplarRunsStore.set([]);
  monteCarloUserAverageStore.set([]);
  monteCarloExemplarAverageStore.set([]);
  compareUserGhostReactionsStore.set([]);
  compareExemplarGhostReactionsStore.set([]);
}

function recordComparisonMetrics() {
  const userMetrics = compareUserEngine.getMetrics();
  const exemplarMetrics = compareExemplarEngine.getMetrics();

  compareUserMetricsHistoryStore.update((history) => [...history, userMetrics]);
  compareExemplarMetricsHistoryStore.update((history) => [...history, exemplarMetrics]);
}

function runBackgroundTrajectory(
  baselineAgents: Agent[],
  placement: Venue[],
  ticks: number
): ComparisonTickRecord[] {
  const parameters = get(worldParametersStore);
  const backgroundEngine = createEngineFromParameters(parameters);
  backgroundEngine.initializeScenario(baselineAgents, placement);

  const history: ComparisonTickRecord[] = [backgroundEngine.getMetrics()];
  for (let i = 0; i < ticks; i++) {
    backgroundEngine.tick();
    history.push(backgroundEngine.getMetrics());
  }

  return history;
}

// 4. Public Action Functions
export const simulationActions = {
  setVisualizationStyle(style: VisualizationStyle) {
    visualizationStyleStore.set(style);
  },

  applyWorldParameters(nextParameters: Partial<WorldParameters>) {
    this.stop();

    const current = get(worldParametersStore);
    const merged = sanitizeWorldParameters({
      ...current,
      ...nextParameters
    });

    worldParametersStore.set(merged);
    recreateAllEngines(merged);
    syncStores();

    hoveredVenueId.set(null);
    metricsHistoryStore.set([engine.getMetrics()]);
    policyTargetAveragesStore.set(null);
    userPolicyResultStore.set(null);
    exemplarPolicyResultStore.set(null);
    policyBaselineAgentsSnapshot = null;
    resetComparisonStores();
    resetStabilityWindowBaseline();
  },

  resetWorldParametersToDefaults() {
    this.applyWorldParameters(DEFAULT_WORLD_PARAMETERS);
  },

  resetStabilityWindow() {
    resetStabilityWindowBaseline();
  },
  
  // Resets the board entirely
  reset() {
    this.stop();
    recreateAllEngines(get(worldParametersStore));
    syncStores();
    hoveredVenueId.set(null);
    metricsHistoryStore.set([engine.getMetrics()]);
    policyTargetAveragesStore.set(null);
    userPolicyResultStore.set(null);
    exemplarPolicyResultStore.set(null);
    policyBaselineAgentsSnapshot = null;
    resetComparisonStores();
    resetStabilityWindowBaseline();
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
      const reachedStableRollingMean = shouldAutoPauseForStability(
        metricsHistory,
        stabilityStartIndex,
        STABILITY_WINDOW,
        STABILITY_DELTA_THRESHOLD
      );

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

  playForTicks(ticks: number = CHAPTER_TWO_SHORT_RUN_TICKS, onComplete?: () => void): Promise<boolean> {
    if (get(isPlayingStore)) return Promise.resolve(false);

    const totalTicks = Math.max(1, Math.floor(ticks));
    let ticksRemaining = totalTicks;
    isPlayingStore.set(true);

    return new Promise<boolean>((resolve) => {
      const loop = () => {
        if (!get(isPlayingStore)) {
          resolve(false);
          return;
        }

        const isStillActive = this.step();
        ticksRemaining--;

        if (isStillActive && ticksRemaining > 0) {
          setTimeout(() => {
            animationFrameId = requestAnimationFrame(loop);
          }, 200);
          return;
        }

        const completed = ticksRemaining <= 0 || !isStillActive;
        this.stop();
        if (completed) {
          onComplete?.();
        }
        resolve(completed);
      };

      loop();
    });
  },

  capturePolicyTargetFromLast25Ticks() {
    policyTargetAveragesStore.set(calculateAveragesOverLastTicks(25));
  },

  async runUserPolicyEvaluation() {
    this.stop();
    resetStabilityWindowBaseline();
    policyBaselineAgentsSnapshot = snapshotAgentsForPolicyBaseline();
    isComparisonModeStore.set(false);

    const placement = snapshotVenuePlacement();
    const completed = await this.playForTicks(25);

    if (completed) {
      userPolicyResultStore.set({
        placement,
        averages: calculateAveragesOverLastTicks(25)
      });
    }

    return completed;
  },

  async runExemplarPolicyEvaluation() {
    this.stop();
    if (!policyBaselineAgentsSnapshot) {
      policyBaselineAgentsSnapshot = snapshotAgentsForPolicyBaseline();
    }
    engine.applyIntegratedVenuePolicy();
    syncStores();
    recordCurrentMetrics();
    resetStabilityWindowBaseline();

    const placement = snapshotVenuePlacement();
    const completed = await this.playForTicks(25);

    if (completed) {
      exemplarPolicyResultStore.set({
        placement,
        averages: calculateAveragesOverLastTicks(25)
      });
    }

    return completed;
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
      let ticksRemaining = COMPARISON_TICKS;
      const loop = () => {
        const userActive = compareUserEngine.tick();
        const exemplarActive = compareExemplarEngine.tick();
        ticksRemaining--;

        syncComparisonStores();
        recordComparisonMetrics();

        if ((userActive || exemplarActive) && ticksRemaining > 0) {
          setTimeout(() => {
            requestAnimationFrame(loop);
          }, COMPARISON_ANIMATION_DELAY_MS);
          return;
        }

        resolve();
      };

      loop();
    });
  },

  async runMonteCarloComparison() {
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

    const userRuns = Array.from({ length: MONTE_CARLO_RUNS }, () =>
      runBackgroundTrajectory(baselineAgents, userPlacement, COMPARISON_TICKS)
    );
    const exemplarRuns = Array.from({ length: MONTE_CARLO_RUNS }, () =>
      runBackgroundTrajectory(baselineAgents, exemplarPlacement, COMPARISON_TICKS)
    );

    monteCarloUserRunsStore.set(userRuns);
    monteCarloExemplarRunsStore.set(exemplarRuns);
    monteCarloUserAverageStore.set(averageComparisonRuns(userRuns));
    monteCarloExemplarAverageStore.set(averageComparisonRuns(exemplarRuns));

    return new Promise<void>((resolve) => {
      let ticksRemaining = COMPARISON_TICKS;
      const loop = () => {
        const userActive = compareUserEngine.tick();
        const exemplarActive = compareExemplarEngine.tick();
        ticksRemaining--;

        syncComparisonStores();
        recordComparisonMetrics();

        if ((userActive || exemplarActive) && ticksRemaining > 0) {
          setTimeout(() => {
            requestAnimationFrame(loop);
          }, FAST_COMPARISON_ANIMATION_DELAY_MS);
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
      const { venueCapacity } = get(worldParametersStore);
      engine.generateVenuesLloyds(venueCapacity);

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

  previewCompareUserVenueMove(id: string, targetX: number, targetY: number) {
    this.stop();
    const reactions = compareUserEngine.previewVenueReactions(id, targetX, targetY);
    compareUserGhostReactionsStore.set(reactions);
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
  },

  commitCompareUserVenueMove(id: string, targetX: number, targetY: number) {
    this.stop();
    const success = compareUserEngine.moveVenue(id, targetX, targetY);
    if (success) {
      compareUserGhostReactionsStore.set([]);
      syncComparisonStores();
      const placement = snapshotVenuePlacementFromEngine(compareUserEngine);
      userPolicyResultStore.update((currentResult) => {
        if (!currentResult) {
          return {
            placement,
            averages: calculateAveragesOverLastTicks(25)
          };
        }

        return {
          ...currentResult,
          placement
        };
      });
    }

    compareUserGhostReactionsStore.set([]);
    return success;
  }
};