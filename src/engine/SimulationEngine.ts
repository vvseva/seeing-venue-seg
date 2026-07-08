import type {
  Agent,
  EntityColor,
  ReactionPreview,
  SegregationMetrics,
  SimulationConfig,
  Venue
} from './types/models';
import { calculateMetrics } from './math/masseyDentonMetrics';
import {
  collectEmptyCells,
  computeAgentUtility,
  computeVenueAttendanceScores,
  isWithinBounds,
  runLloydMedoids
} from './math/simulationCoreMath';
import { WORLD_HEIGHT, WORLD_WIDTH } from './world';

export class SimulationEngine {
  public width: number;
  public height: number;

  private density: number;
  private similarityThreshold: number;
  private readonly VENUE_RADIUS = 3;

  private grid: (string | null)[][];

  public agents: Map<string, Agent>;
  public venues: Map<string, Venue>;
  public tickCount: number;

  constructor(config: SimulationConfig = {}) {
    this.width = config.width ?? WORLD_WIDTH;
    this.height = config.height ?? WORLD_HEIGHT;
    this.density = config.density ?? 0.7;
    this.similarityThreshold = config.similarityThreshold ?? 0.5;

    this.grid = [];
    this.agents = new Map<string, Agent>();
    this.venues = new Map<string, Venue>();
    this.tickCount = 0;
  }

  public initEmptyGrid(): void {
    this.grid = Array.from({ length: this.height }, () => Array(this.width).fill(null));
    this.agents.clear();
    this.venues.clear();
    this.tickCount = 0;
  }

  public spawnProtagonist(color: EntityColor = 'red'): void {
    const centerX = Math.floor(this.width / 2);
    const centerY = Math.floor(this.height / 2);
    const id = 'agent_protagonist';

    this.agents.set(id, {
      id,
      x: centerX,
      y: centerY,
      color,
      isHappy: true,
      utility: 1,
      currentVenueId: null
    });

    this.grid[centerY][centerX] = id;
    this.updateAllUtilities();
  }

  public spawnPopulation(): void {
    const totalCells = this.width * this.height;
    const targetAgents = Math.max(0, Math.floor(totalCells * this.density) - this.agents.size);
    let spawned = 0;

    let agentIdCounter = this.nextAgentIdCounter();

    while (spawned < targetAgents) {
      const x = Math.floor(Math.random() * this.width);
      const y = Math.floor(Math.random() * this.height);

      if (this.grid[y][x] !== null) continue;

      const color: EntityColor = Math.random() > 0.5 ? 'red' : 'green';
      const id = `agent_${agentIdCounter++}`;

      this.agents.set(id, {
        id,
        x,
        y,
        color,
        isHappy: false,
        utility: 0,
        currentVenueId: null
      });

      this.grid[y][x] = id;
      spawned++;
    }

    this.updateAllUtilities();
  }

  public spawnTutorialGroups(): void {
    if (!this.agents.has('agent_protagonist')) {
      this.spawnProtagonist('red');
    }

    this.clearTutorialAgents();

    const centerX = Math.floor(this.width / 2);
    const topY = Math.max(1, Math.floor(this.height * 0.25));
    const bottomY = Math.min(this.height - 2, Math.floor(this.height * 0.75));

    const xOffsets = [-1, 0, 1];
    xOffsets.forEach((offset, index) => {
      this.placeTutorialAgent(`agent_tutorial_top_${index + 1}`, centerX + offset, topY, 'red');
      this.placeTutorialAgent(`agent_tutorial_bottom_${index + 1}`, centerX + offset, bottomY, 'green');
    });

    this.updateAllUtilities();
  }

  public previewLocalReactions(
    _draggedColor: EntityColor,
    draggedId: string,
    hoverX: number,
    hoverY: number
  ): ReactionPreview[] {
    if (!this.inBounds(hoverX, hoverY)) return [];

    const hoveredOccupant = this.grid[hoverY][hoverX];
    if (hoveredOccupant !== null && hoveredOccupant !== draggedId) return [];

    const originalOccupant = this.grid[hoverY][hoverX];
    this.grid[hoverY][hoverX] = draggedId;

    const venueScores = computeVenueAttendanceScores(this.venues, this.agents, this.VENUE_RADIUS);
    const reactions: ReactionPreview[] = [];

    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;

        const nx = hoverX + dx;
        const ny = hoverY + dy;
        if (!this.inBounds(nx, ny)) continue;

        const neighborId = this.grid[ny][nx];
        if (!neighborId || !neighborId.startsWith('agent_') || neighborId === draggedId) continue;

        const neighbor = this.agents.get(neighborId);
        if (!neighbor) continue;

        const utilitySnapshot = computeAgentUtility(
          neighbor,
          this.grid,
          this.agents,
          this.venues,
          venueScores,
          this.width,
          this.height,
          this.VENUE_RADIUS,
          this.similarityThreshold
        );

        reactions.push({
          id: neighbor.id,
          originalHappiness: neighbor.isHappy,
          hypotheticalHappiness: utilitySnapshot.isHappy
        });
      }
    }

    this.grid[hoverY][hoverX] = originalOccupant;
    return reactions;
  }

  public moveAgent(id: string, targetX: number, targetY: number): boolean {
    const agent = this.agents.get(id);
    if (!agent) return false;
    if (!this.inBounds(targetX, targetY)) return false;
    if (agent.x === targetX && agent.y === targetY) return true;
    if (this.grid[targetY][targetX] !== null) return false;

    this.grid[agent.y][agent.x] = null;
    agent.x = targetX;
    agent.y = targetY;
    this.grid[targetY][targetX] = agent.id;

    this.updateAllUtilities();
    return true;
  }

  public placeVenue(id: string, preferredX: number, preferredY: number, color: EntityColor): Venue | null {
    const existingVenue = this.venues.get(id);
    if (existingVenue) {
      this.grid[existingVenue.y][existingVenue.x] = null;
    }

    if (!this.inBounds(preferredX, preferredY)) {
      if (existingVenue) {
        this.grid[existingVenue.y][existingVenue.x] = existingVenue.id;
      }
      return null;
    }

    const targetOccupant = this.grid[preferredY][preferredX];
    if (targetOccupant && targetOccupant.startsWith('agent_')) {
      const displacedAgent = this.agents.get(targetOccupant);
      if (!displacedAgent) {
        this.restoreExistingVenue(existingVenue);
        return null;
      }

      const relocation = this.findRandomEmptyCell(preferredX, preferredY);
      if (!relocation) {
        this.restoreExistingVenue(existingVenue);
        return null;
      }

      this.grid[displacedAgent.y][displacedAgent.x] = null;
      displacedAgent.x = relocation.x;
      displacedAgent.y = relocation.y;
      this.grid[relocation.y][relocation.x] = displacedAgent.id;
    } else if (targetOccupant && targetOccupant.startsWith('v_')) {
      this.venues.delete(targetOccupant);
      this.grid[preferredY][preferredX] = null;
    }

    const venue: Venue = { id, x: preferredX, y: preferredY, color };
    this.venues.set(id, venue);
    this.grid[preferredY][preferredX] = id;
    return venue;
  }

  public previewVenueReactions(venueId: string, hoverX: number, hoverY: number): ReactionPreview[] {
    const venue = this.venues.get(venueId);
    if (!venue || !this.inBounds(hoverX, hoverY)) return [];

    const targetOccupant = this.grid[hoverY][hoverX];
    if (targetOccupant !== null && targetOccupant !== venueId && !targetOccupant.startsWith('agent_')) {
      return [];
    }

    const originalVenuePosition = { x: venue.x, y: venue.y };
    const originalTargetOccupant = this.grid[hoverY][hoverX];

    let displacedAgent: Agent | null = null;
    let displacedOriginalPosition: { x: number; y: number } | null = null;
    let displacedRelocation: { x: number; y: number } | null = null;

    if (targetOccupant && targetOccupant.startsWith('agent_')) {
      displacedAgent = this.agents.get(targetOccupant) ?? null;
      if (!displacedAgent) return [];

      displacedOriginalPosition = { x: displacedAgent.x, y: displacedAgent.y };
      displacedRelocation = this.findRandomEmptyCell(hoverX, hoverY);
      if (!displacedRelocation) return [];

      this.grid[displacedAgent.y][displacedAgent.x] = null;
      displacedAgent.x = displacedRelocation.x;
      displacedAgent.y = displacedRelocation.y;
      this.grid[displacedRelocation.y][displacedRelocation.x] = displacedAgent.id;
    }

    this.grid[originalVenuePosition.y][originalVenuePosition.x] = null;
    this.grid[hoverY][hoverX] = venueId;
    venue.x = hoverX;
    venue.y = hoverY;

    const venueScores = computeVenueAttendanceScores(this.venues, this.agents, this.VENUE_RADIUS);
    const reactions: ReactionPreview[] = [];

    for (const agent of this.agents.values()) {
      const utilitySnapshot = computeAgentUtility(
        agent,
        this.grid,
        this.agents,
        this.venues,
        venueScores,
        this.width,
        this.height,
        this.VENUE_RADIUS,
        this.similarityThreshold
      );

      if (utilitySnapshot.isHappy !== agent.isHappy) {
        reactions.push({
          id: agent.id,
          originalHappiness: agent.isHappy,
          hypotheticalHappiness: utilitySnapshot.isHappy
        });
      }
    }

    this.grid[hoverY][hoverX] = originalTargetOccupant;
    this.grid[originalVenuePosition.y][originalVenuePosition.x] = venueId;
    venue.x = originalVenuePosition.x;
    venue.y = originalVenuePosition.y;

    if (displacedAgent && displacedOriginalPosition && displacedRelocation) {
      this.grid[displacedRelocation.y][displacedRelocation.x] = null;
      displacedAgent.x = displacedOriginalPosition.x;
      displacedAgent.y = displacedOriginalPosition.y;
      this.grid[displacedOriginalPosition.y][displacedOriginalPosition.x] = displacedAgent.id;
    }

    return reactions;
  }

  public moveVenue(id: string, targetX: number, targetY: number): boolean {
    const venue = this.venues.get(id);
    if (!venue) return false;
    if (!this.inBounds(targetX, targetY)) return false;
    if (venue.x === targetX && venue.y === targetY) return true;

    const targetOccupant = this.grid[targetY][targetX];
    if (targetOccupant !== null && targetOccupant !== id) {
      if (!targetOccupant.startsWith('agent_')) return false;

      const displacedAgent = this.agents.get(targetOccupant);
      if (!displacedAgent) return false;

      this.grid[venue.y][venue.x] = null;

      const relocation = this.findRandomEmptyCell(targetX, targetY);
      if (!relocation) {
        this.grid[venue.y][venue.x] = venue.id;
        return false;
      }

      displacedAgent.x = relocation.x;
      displacedAgent.y = relocation.y;
      this.grid[relocation.y][relocation.x] = displacedAgent.id;

      this.grid[targetY][targetX] = id;
      venue.x = targetX;
      venue.y = targetY;

      this.updateAllUtilities();
      return true;
    }

    this.grid[venue.y][venue.x] = null;
    this.grid[targetY][targetX] = id;
    venue.x = targetX;
    venue.y = targetY;

    this.updateAllUtilities();
    return true;
  }

  public tick(): boolean {
    const allAgents = Array.from(this.agents.values());
    if (allAgents.length === 0) return false;

    allAgents.sort((a, b) => a.utility - b.utility);

    const moveQuota = Math.max(1, Math.ceil(allAgents.length * 0.1));
    const movingAgents = allAgents.slice(0, moveQuota);

    const emptyCells = collectEmptyCells(this.grid, this.width, this.height);
    if (emptyCells.length === 0) return false;

    let movedCount = 0;
    for (const agent of movingAgents) {
      if (emptyCells.length === 0) break;

      const targetIndex = Math.floor(Math.random() * emptyCells.length);
      const target = emptyCells.splice(targetIndex, 1)[0];

      this.grid[agent.y][agent.x] = null;
      emptyCells.push({ x: agent.x, y: agent.y });

      agent.x = target.x;
      agent.y = target.y;
      this.grid[agent.y][agent.x] = agent.id;
      movedCount++;
    }

    if (movedCount === 0) return false;

    this.updateAllUtilities();
    this.tickCount++;
    return true;
  }

  public generateVenuesLloyds(capacityPerVenue: number = 20): void {
    this.clearAllVenues();

    const activeColors: EntityColor[] = ['red', 'green'];
    let venueIdCounter = 0;

    for (const color of activeColors) {
      const targetAgents = Array.from(this.agents.values()).filter((agent) => agent.color === color);
      if (targetAgents.length === 0) continue;

      const k = Math.max(1, Math.ceil(targetAgents.length / capacityPerVenue));
      const trackerPoints = runLloydMedoids(targetAgents, k, 5);

      for (const tracker of trackerPoints) {
        const venueId = `v_${venueIdCounter++}`;
        this.placeVenue(venueId, tracker.x, tracker.y, color);
      }
    }

    this.updateAllUtilities();
  }

  public applyIntegratedVenuePolicy(): void {
    this.clearAllVenues();

    const quarterX = Math.floor(this.width / 4);
    const threeQuarterX = Math.floor((3 * this.width) / 4);
    const quarterY = Math.floor(this.height / 4);
    const threeQuarterY = Math.floor((3 * this.height) / 4);

    const clampX = (x: number) => Math.max(1, Math.min(this.width - 2, x));
    const clampY = (y: number) => Math.max(1, Math.min(this.height - 2, y));

    const basePlacements: Array<{ id: string; x: number; y: number; color: EntityColor }> = [
      { id: 'v_0', x: clampX(quarterX), y: clampY(quarterY), color: 'red' },
      { id: 'v_1', x: clampX(threeQuarterX), y: clampY(quarterY), color: 'green' },
      { id: 'v_2', x: clampX(quarterX), y: clampY(threeQuarterY), color: 'green' },
      { id: 'v_3', x: clampX(threeQuarterX), y: clampY(threeQuarterY), color: 'red' }
    ];

    for (const placement of basePlacements) {
      this.placeVenue(placement.id, placement.x, placement.y, placement.color);
    }

    basePlacements.forEach((basePlacement, index) => {
      const oppositeColor: EntityColor = basePlacement.color === 'red' ? 'green' : 'red';
      const towardCenterX = Math.sign(Math.floor(this.width / 2) - basePlacement.x);
      const towardCenterY = Math.sign(Math.floor(this.height / 2) - basePlacement.y);
      const fallbackDirX = index % 2 === 0 ? 1 : -1;
      const fallbackDirY = index < 2 ? 1 : -1;

      const preferredX = clampX(basePlacement.x + (towardCenterX || fallbackDirX) * 2);
      const preferredY = clampY(basePlacement.y + (towardCenterY || fallbackDirY) * 2);
      const integratedSpot = this.findNearestNonVenueCell(preferredX, preferredY);
      if (!integratedSpot) return;

      this.placeVenue(`v_${4 + index}`, integratedSpot.x, integratedSpot.y, oppositeColor);
    });

    this.updateAllUtilities();
  }

  public getAgentsSnapshot(): Agent[] {
    return Array.from(this.agents.values()).map((agent) => ({ ...agent }));
  }

  public getVenuesSnapshot(): Venue[] {
    return Array.from(this.venues.values()).map((venue) => ({ ...venue }));
  }

  public initializeScenario(baseAgents: Agent[], venuePlacements: Venue[]): void {
    this.initEmptyGrid();

    for (const sourceAgent of baseAgents) {
      if (!this.inBounds(sourceAgent.x, sourceAgent.y)) continue;
      if (this.grid[sourceAgent.y][sourceAgent.x] !== null) continue;

      const agent: Agent = {
        ...sourceAgent,
        currentVenueId: null,
        isHappy: false,
        utility: 0
      };

      this.agents.set(agent.id, agent);
      this.grid[agent.y][agent.x] = agent.id;
    }

    for (const sourceVenue of venuePlacements) {
      this.placeVenue(sourceVenue.id, sourceVenue.x, sourceVenue.y, sourceVenue.color);
    }

    this.tickCount = 0;
    this.updateAllUtilities();
  }

  public getMetrics(): SegregationMetrics {
    return calculateMetrics(this.agents, this.width, this.height, this.tickCount);
  }

  private inBounds(x: number, y: number): boolean {
    return isWithinBounds(x, y, this.width, this.height);
  }

  private nextAgentIdCounter(): number {
    let counter = 1;

    for (const id of this.agents.keys()) {
      const match = id.match(/^agent_(\d+)$/);
      if (!match) continue;
      counter = Math.max(counter, Number(match[1]) + 1);
    }

    return counter;
  }

  private clearTutorialAgents(): void {
    for (const [id, agent] of this.agents.entries()) {
      if (!id.startsWith('agent_tutorial_')) continue;
      this.grid[agent.y][agent.x] = null;
      this.agents.delete(id);
    }
  }

  private placeTutorialAgent(id: string, x: number, y: number, color: EntityColor): void {
    if (!this.inBounds(x, y)) return;
    if (this.grid[y][x] !== null) return;

    this.agents.set(id, {
      id,
      x,
      y,
      color,
      isHappy: false,
      utility: 0,
      currentVenueId: null
    });

    this.grid[y][x] = id;
  }

  private restoreExistingVenue(existingVenue: Venue | undefined): void {
    if (!existingVenue) return;
    this.grid[existingVenue.y][existingVenue.x] = existingVenue.id;
  }

  private findRandomEmptyCell(excludeX?: number, excludeY?: number): { x: number; y: number } | null {
    const emptyCells = collectEmptyCells(
      this.grid,
      this.width,
      this.height,
      excludeX !== undefined && excludeY !== undefined ? { x: excludeX, y: excludeY } : undefined
    );

    if (emptyCells.length === 0) return null;

    const randomIndex = Math.floor(Math.random() * emptyCells.length);
    return emptyCells[randomIndex];
  }

  private findNearestNonVenueCell(preferredX: number, preferredY: number): { x: number; y: number } | null {
    if (!this.inBounds(preferredX, preferredY)) return null;

    const occupant = this.grid[preferredY][preferredX];
    if (occupant === null || occupant.startsWith('agent_')) {
      return { x: preferredX, y: preferredY };
    }

    const maxRadius = Math.max(this.width, this.height);

    for (let radius = 1; radius <= maxRadius; radius++) {
      for (let y = preferredY - radius; y <= preferredY + radius; y++) {
        for (let x = preferredX - radius; x <= preferredX + radius; x++) {
          if (!this.inBounds(x, y)) continue;

          const isOnRing = Math.max(Math.abs(x - preferredX), Math.abs(y - preferredY)) === radius;
          if (!isOnRing) continue;

          const ringOccupant = this.grid[y][x];
          if (ringOccupant === null || ringOccupant.startsWith('agent_')) {
            return { x, y };
          }
        }
      }
    }

    return null;
  }

  private clearAllVenues(): void {
    for (const venue of this.venues.values()) {
      if (this.inBounds(venue.x, venue.y) && this.grid[venue.y][venue.x] === venue.id) {
        this.grid[venue.y][venue.x] = null;
      }
    }
    this.venues.clear();
  }

  private updateAllUtilities(): void {
    const venueScores = computeVenueAttendanceScores(this.venues, this.agents, this.VENUE_RADIUS);

    for (const agent of this.agents.values()) {
      const next = computeAgentUtility(
        agent,
        this.grid,
        this.agents,
        this.venues,
        venueScores,
        this.width,
        this.height,
        this.VENUE_RADIUS,
        this.similarityThreshold
      );

      agent.utility = next.utility;
      agent.currentVenueId = next.currentVenueId;
      agent.isHappy = next.isHappy;
    }
  }
}
