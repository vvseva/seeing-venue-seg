import type { 
  EntityColor, 
  Agent, 
  Venue, 
  SimulationConfig, 
  ReactionPreview, 
  SegregationMetrics 
} from './types/models';

import { calculateMetrics } from './math/masseyDentonMetrics';
import { WORLD_HEIGHT, WORLD_WIDTH } from './world';

export class SimulationEngine {
  public width: number;
  public height: number;
  
  private density: number;
  private similarityThreshold: number;
  private venueBoost: number;
  private readonly VENUE_RADIUS = 3;

  // 2D Array mapping [y][x] coordinates to an entity ID (or null if empty)
  private grid: (string | null)[][];
  
  public agents: Map<string, Agent>;
  public venues: Map<string, Venue>;
  public tickCount: number;

  constructor(config: SimulationConfig = {}) {
    this.width = config.width ?? WORLD_WIDTH;
    this.height = config.height ?? WORLD_HEIGHT;
    this.density = config.density ?? 0.7;
    this.similarityThreshold = config.similarityThreshold ?? 0.5;
    this.venueBoost = config.venueBoost ?? 0.2;

    this.grid = [];
    this.agents = new Map<string, Agent>();
    this.venues = new Map<string, Venue>();
    this.tickCount = 0;
  }

  // --- INITIALIZATION ---
  public initEmptyGrid(): void {
    this.grid = Array.from({ length: this.height }, () => 
      Array(this.width).fill(null)
    );
    
    this.agents.clear();
    this.venues.clear();
    this.tickCount = 0;
  }

  public spawnProtagonist(color: EntityColor = 'red'): void {
    const centerX = Math.floor(this.width / 2);
    const centerY = Math.floor(this.height / 2);
    const id = "agent_protagonist";

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

    let agentIdCounter = 1;
    for (const id of this.agents.keys()) {
      const match = id.match(/^agent_(\d+)$/);
      if (match) {
        agentIdCounter = Math.max(agentIdCounter, Number(match[1]) + 1);
      }
    }

    while (spawned < targetAgents) {
      const x = Math.floor(Math.random() * this.width);
      const y = Math.floor(Math.random() * this.height);

      // Only spawn if cell is empty
      if (this.grid[y][x] === null) {
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
    }
    this.updateAllUtilities();
  }

  public spawnTutorialGroups(): void {
    if (!this.agents.has('agent_protagonist')) {
      this.spawnProtagonist('red');
    }

    for (const [id, agent] of this.agents.entries()) {
      if (id.startsWith('agent_tutorial_')) {
        this.grid[agent.y][agent.x] = null;
        this.agents.delete(id);
      }
    }

    const centerX = Math.floor(this.width / 2);
    const topY = Math.max(1, Math.floor(this.height * 0.25));
    const bottomY = Math.min(this.height - 2, Math.floor(this.height * 0.75));
    const xOffsets = [-1, 0, 1];

    const placeTutorialAgent = (id: string, x: number, y: number, color: EntityColor) => {
      if (!this.isWithinBounds(x, y) || this.grid[y][x] !== null) return;

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
    };

    xOffsets.forEach((offset, index) => {
      placeTutorialAgent(`agent_tutorial_top_${index + 1}`, centerX + offset, topY, 'red');
      placeTutorialAgent(`agent_tutorial_bottom_${index + 1}`, centerX + offset, bottomY, 'green');
    });

    this.updateAllUtilities();
  }

  // public init(): void {
  //   this.grid = Array.from({ length: this.height }, () => 
  //     Array(this.width).fill(null)
  //   );
    
  //   this.agents.clear();
  //   this.venues.clear();
  //   this.tickCount = 0;

  //   let idCounter = 0;
  //   const totalCells = this.width * this.height;
  //   const targetPopulation = Math.floor(totalCells * this.density);

  //   let placed = 0;
  //   while (placed < targetPopulation) {
  //     const x = Math.floor(Math.random() * this.width);
  //     const y = Math.floor(Math.random() * this.height);

  //     if (this.grid[y][x] === null) {
  //       const color: EntityColor = Math.random() > 0.5 ? 'red' : 'green';
  //       const agentId = `a_${idCounter++}`;
        
  //       const newAgent: Agent = { id: agentId, x, y, color, isHappy: false, utility: 0 };
  //       this.grid[y][x] = agentId;
  //       this.agents.set(agentId, newAgent);
        
  //       placed++;
  //     }
  //   }
    
  //   this.updateAllUtilities();
  // }

  // --- CORE LOGIC ---

  private isWithinBounds(x: number, y: number): boolean {
    return x >= 0 && x < this.width && y >= 0 && y < this.height;
  }

  private isCellEmpty(x: number, y: number): boolean {
    return this.isWithinBounds(x, y) && this.grid[y][x] === null;
  }

  private findNearestEmptyCell(preferredX: number, preferredY: number): { x: number; y: number } | null {
    if (this.isCellEmpty(preferredX, preferredY)) {
      return { x: preferredX, y: preferredY };
    }

    const maxRadius = Math.max(this.width, this.height);

    for (let radius = 1; radius <= maxRadius; radius++) {
      for (let y = preferredY - radius; y <= preferredY + radius; y++) {
        for (let x = preferredX - radius; x <= preferredX + radius; x++) {
          const isOnRing = Math.max(Math.abs(x - preferredX), Math.abs(y - preferredY)) === radius;
          if (isOnRing && this.isCellEmpty(x, y)) {
            return { x, y };
          }
        }
      }
    }

    return null;
  }

  private findRandomEmptyCell(excludeX?: number, excludeY?: number): { x: number; y: number } | null {
    const emptyCells: { x: number; y: number }[] = [];

    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const isExcluded = excludeX === x && excludeY === y;
        if (!isExcluded && this.grid[y][x] === null) {
          emptyCells.push({ x, y });
        }
      }
    }

    if (emptyCells.length === 0) return null;
    const randomIndex = Math.floor(Math.random() * emptyCells.length);
    return emptyCells[randomIndex];
  }

  /**
   * Calculates the raw numerical utility score for an agent at a given location.
   * Score = (Neighborhood Similarity Proportion) + (Venue Proximity Boost)
   */
  private calculateUtilityScore(color: EntityColor, x: number, y: number, ignoreId: string | null = null): number {
    let sameColor = 0;
    let totalNeighbors = 0;
    let nearMatchingVenue = false;

    // 1. Calculate Neighborhood Preferences (Moore Neighborhood)
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        
        const nx = x + dx;
        const ny = y + dy;

        if (nx >= 0 && nx < this.width && ny >= 0 && ny < this.height) {
          const occupantId = this.grid[ny][nx];
          
          if (occupantId && occupantId !== ignoreId) {
            if (occupantId.startsWith('agent_')) {
              const neighbor = this.agents.get(occupantId);
              if (neighbor) {
                totalNeighbors++;
                if (neighbor.color === color) sameColor++;
              }
            } 
            // 2. Evaluate Venue Proximity
            else if (occupantId.startsWith('v_')) {
              const venue = this.venues.get(occupantId);
              if (venue && venue.color === color) {
                nearMatchingVenue = true;
              }
            }
          }
        }
      }
    }

    // If an agent is completely isolated, we consider their neighborhood score perfect (1.0)
    let neighborhoodScore = totalNeighbors === 0 ? 1.0 : (sameColor / totalNeighbors);
    
    // Sum the preferences
    let totalUtility = neighborhoodScore;
    if (nearMatchingVenue) {
      totalUtility += this.venueBoost;
    }

    // Tiny noise helps break deterministic ties between agents with identical utility.
    const epsilon = (Math.random() - 0.5) * 1e-6;
    return totalUtility + epsilon;
  }

  private updateAllUtilities(): void {
    // Phase 1: Sweep - Calculate venue attendance scores based on radius
    const venueScores = new Map<string, number>();

    for (const venue of this.venues.values()) {
      let sameColor = 0;
      let totalInRadius = 0;

      for (const agent of this.agents.values()) {
        // Euclidean distance
        const dist = Math.sqrt(Math.pow(agent.x - venue.x, 2) + Math.pow(agent.y - venue.y, 2));
        if (dist <= this.VENUE_RADIUS) {
          totalInRadius++;
          if (agent.color === venue.color) {
            sameColor++;
          }
        }
      }
      const score = totalInRadius > 0 ? (sameColor / totalInRadius) : 0;
      venueScores.set(venue.id, score);
    }

    // Phase 2: Agent Utility
    for (const agent of this.agents.values()) {
      
      // 1. Neighborhood Utility
      let sameNeighbors = 0;
      let totalNeighbors = 0;

      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          const nx = agent.x + dx;
          const ny = agent.y + dy;

          if (nx >= 0 && nx < this.width && ny >= 0 && ny < this.height) {
            const neighborId = this.grid[ny][nx];
            if (neighborId) {
              const neighbor = this.agents.get(neighborId);
              if (neighbor) {
                totalNeighbors++;
                if (neighbor.color === agent.color) sameNeighbors++;
              }
            }
          }
        }
      }

      const uNeighborhood = totalNeighbors > 0 ? (sameNeighbors / totalNeighbors) : 1.0;

      // 2. Venue Utility (Find closest matching venue)
      let closestVenueId: string | null = null;
      let minDistance = Infinity;

      for (const venue of this.venues.values()) {
        if (venue.color === agent.color) {
          const dist = Math.sqrt(Math.pow(agent.x - venue.x, 2) + Math.pow(agent.y - venue.y, 2));
          if (dist < minDistance) {
            minDistance = dist;
            closestVenueId = venue.id;
          }
        }
      }

      // Only assign venue utility if within the radius limit
      agent.currentVenueId = (minDistance <= this.VENUE_RADIUS) ? closestVenueId : null;
      const uVenue = agent.currentVenueId ? (venueScores.get(agent.currentVenueId) || 0) : 0;

      // 3. Combine Utilities
      // If no venues exist (Tutorial Chapters 0-2), rely purely on neighborhood to avoid halving utility
      if (this.venues.size === 0) {
        agent.utility = uNeighborhood;
      } else {
        agent.utility = (0.5 * uNeighborhood) + (0.5 * uVenue);
      }
      
      agent.isHappy = agent.utility >= this.similarityThreshold;
    }
  }

  // --- INTERACTIVE METHODS (MUSEUM EXPLORATION) ---

  public previewLocalReactions(draggedColor: EntityColor, draggedId: string, hoverX: number, hoverY: number): ReactionPreview[] {
    if (!this.isWithinBounds(hoverX, hoverY)) {
      return [];
    }

    const hoveredOccupant = this.grid[hoverY][hoverX];
    if (hoveredOccupant !== null && hoveredOccupant !== draggedId) {
      return [];
    }

    const reactions: ReactionPreview[] = [];
    
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        
        const nx = hoverX + dx;
        const ny = hoverY + dy;

        if (nx >= 0 && nx < this.width && ny >= 0 && ny < this.height) {
          const neighborId = this.grid[ny][nx];
          
          if (neighborId && neighborId.startsWith('agent_') && neighborId !== draggedId) {
            const neighbor = this.agents.get(neighborId);
            
            if (neighbor) {
              const originalOccupant = this.grid[hoverY][hoverX];
              this.grid[hoverY][hoverX] = draggedId; 
              
              const hypotheticalScore = this.calculateUtilityScore(neighbor.color, neighbor.x, neighbor.y);
              const hypotheticalHappiness = hypotheticalScore >= this.similarityThreshold;
              
              this.grid[hoverY][hoverX] = originalOccupant; 

              reactions.push({
                id: neighbor.id,
                originalHappiness: neighbor.isHappy,
                hypotheticalHappiness
              });
            }
          }
        }
      }
    }
    return reactions;
  }

  public moveAgent(id: string, targetX: number, targetY: number): boolean {
    const agent = this.agents.get(id);
    if (!agent) return false;
    
    if (!this.isWithinBounds(targetX, targetY)) return false;
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

    if (!this.isWithinBounds(preferredX, preferredY)) {
      if (existingVenue) {
        this.grid[existingVenue.y][existingVenue.x] = existingVenue.id;
      }
      return null;
    }

    const targetOccupant = this.grid[preferredY][preferredX];

    if (targetOccupant && targetOccupant.startsWith('agent_')) {
      const displacedAgent = this.agents.get(targetOccupant);
      if (!displacedAgent) {
        if (existingVenue) {
          this.grid[existingVenue.y][existingVenue.x] = existingVenue.id;
        }
        return null;
      }

      const relocation = this.findRandomEmptyCell(preferredX, preferredY);
      if (!relocation) {
        if (existingVenue) {
          this.grid[existingVenue.y][existingVenue.x] = existingVenue.id;
        }
        return null;
      }

      this.grid[displacedAgent.y][displacedAgent.x] = null;
      displacedAgent.x = relocation.x;
      displacedAgent.y = relocation.y;
      this.grid[relocation.y][relocation.x] = displacedAgent.id;
    } else if (targetOccupant && targetOccupant.startsWith('v_')) {
      this.venues.delete(targetOccupant);
      this.grid[preferredY][preferredX] = null;
    } else if (targetOccupant !== null) {
      this.grid[preferredY][preferredX] = null;
    }

    const venue: Venue = {
      id,
      x: preferredX,
      y: preferredY,
      color
    };

    this.venues.set(id, venue);
    this.grid[preferredY][preferredX] = id;
    return venue;
  }

  public previewVenueReactions(venueId: string, hoverX: number, hoverY: number): ReactionPreview[] {
    const venue = this.venues.get(venueId);
    if (!venue) return [];
    if (!this.isWithinBounds(hoverX, hoverY)) return [];

    const targetOccupant = this.grid[hoverY][hoverX];
    if (targetOccupant !== null && targetOccupant !== venueId && !targetOccupant.startsWith('agent_')) return [];

    const originalX = venue.x;
    const originalY = venue.y;
    const originalTargetOccupant = this.grid[hoverY][hoverX];
    let displacedAgent: Agent | null = null;
    let relocation: { x: number; y: number } | null = null;
    let displacedAgentOriginalX = -1;
    let displacedAgentOriginalY = -1;

    if (targetOccupant && targetOccupant.startsWith('agent_')) {
      displacedAgent = this.agents.get(targetOccupant) ?? null;
      if (!displacedAgent) return [];

      displacedAgentOriginalX = displacedAgent.x;
      displacedAgentOriginalY = displacedAgent.y;

      relocation = this.findRandomEmptyCell(hoverX, hoverY);
      if (!relocation) return [];

      this.grid[displacedAgent.y][displacedAgent.x] = null;
      displacedAgent.x = relocation.x;
      displacedAgent.y = relocation.y;
      this.grid[relocation.y][relocation.x] = displacedAgent.id;
    }

    this.grid[originalY][originalX] = null;
    this.grid[hoverY][hoverX] = venueId;
    venue.x = hoverX;
    venue.y = hoverY;

    const reactions: ReactionPreview[] = [];
    for (const agent of this.agents.values()) {
      const hypotheticalHappiness = this.calculateUtilityScore(agent.color, agent.x, agent.y) >= this.similarityThreshold;
      if (hypotheticalHappiness !== agent.isHappy) {
        reactions.push({
          id: agent.id,
          originalHappiness: agent.isHappy,
          hypotheticalHappiness
        });
      }
    }

    this.grid[hoverY][hoverX] = originalTargetOccupant;
    this.grid[originalY][originalX] = venueId;
    venue.x = originalX;
    venue.y = originalY;

    if (displacedAgent && relocation) {
      this.grid[relocation.y][relocation.x] = null;
      displacedAgent.x = displacedAgentOriginalX;
      displacedAgent.y = displacedAgentOriginalY;
      this.grid[displacedAgentOriginalY][displacedAgentOriginalX] = displacedAgent.id;
    }

    return reactions;
  }

  public moveVenue(id: string, targetX: number, targetY: number): boolean {
    const venue = this.venues.get(id);
    if (!venue) return false;
    if (!this.isWithinBounds(targetX, targetY)) return false;
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

  // --- MACRO SIMULATION LOOP ---

  public tick(): boolean {
    const allAgents = Array.from(this.agents.values());
    if (allAgents.length === 0) return false;

    // Always move the bottom 10% by continuous utility (lowest first).
    allAgents.sort((a, b) => a.utility - b.utility);

    const moveQuota = Math.max(1, Math.ceil(allAgents.length * 0.10));
    const movingAgents = allAgents.slice(0, moveQuota);

    // Cache available empty cells
    const emptyCells: {x: number, y: number}[] = [];
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        if (this.grid[y][x] === null) emptyCells.push({ x, y });
      }
    }

    if (emptyCells.length === 0) return false;

    // Move the bottom 10% utility agents to random empty cells
    let movedCount = 0;
    for (const agent of movingAgents) {
      if (emptyCells.length === 0) break;
      
      const targetIndex = Math.floor(Math.random() * emptyCells.length);
      const target = emptyCells.splice(targetIndex, 1)[0];

      // Remove from old cell
      this.grid[agent.y][agent.x] = null;
      // Add old cell back to available pool
      emptyCells.push({ x: agent.x, y: agent.y });

      // Move to new cell
      agent.x = target.x;
      agent.y = target.y;
      this.grid[agent.y][agent.x] = agent.id;
      movedCount++;
    }

    if (movedCount === 0) return false;

    // Recalculate utilities for the world based on the new topology
    this.updateAllUtilities();
    this.tickCount++;
    return true;
  }

  // --- VENUE GENERATION (VORONOI RELAXATION) ---

  /**
   * Generates venues using Lloyd's Algorithm (K-Medoids Voronoi Relaxation).
   * @param capacityPerVenue How many agents a single venue should serve (determines K)
   */
  public generateVenuesLloyds(capacityPerVenue: number = 20): void {
    for (const venue of this.venues.values()) {
      if (this.isWithinBounds(venue.x, venue.y) && this.grid[venue.y][venue.x] === venue.id) {
        this.grid[venue.y][venue.x] = null;
      }
    }
    this.venues.clear();
    const activeColors: EntityColor[] = ['red', 'green'];
    let venueIdCounter = 0;

    activeColors.forEach(color => {
      // Get all agents of this specific color
      const targetFamilies = Array.from(this.agents.values()).filter(a => a.color === color);
      if (targetFamilies.length === 0) return;

      // 1. Dynamically calculate K based on population
      const k = Math.max(1, Math.ceil(targetFamilies.length / capacityPerVenue));

      // 2. Initialize invisible tracker seeds (randomly select K unique agents)
      const shuffled = [...targetFamilies].sort(() => 0.5 - Math.random());
      const seeds = shuffled.slice(0, Math.min(k, targetFamilies.length));
      
      const trackers = seeds.map((seed, index) => ({
         id: `tracker_${color}_${index}`,
         x: seed.x,
         y: seed.y
      }));

      // 3. Voronoi Relaxation (Lloyd's Algorithm)
      const iterations = 5;
      for (let i = 0; i < iterations; i++) {
         
         // Step A: Assign every agent to their nearest tracker (forming Voronoi cells)
         const clusters = new Map<string, Agent[]>();
         trackers.forEach(t => clusters.set(t.id, []));

         targetFamilies.forEach(agent => {
            let nearestTracker = trackers[0];
            let minDist = Infinity;
            
            trackers.forEach(t => {
               // Euclidean distance
               const dist = Math.sqrt(Math.pow(agent.x - t.x, 2) + Math.pow(agent.y - t.y, 2));
               if (dist < minDist) {
                  minDist = dist;
                  nearestTracker = t;
               }
            });
            clusters.get(nearestTracker.id)!.push(agent);
         });

         // Step B: Move the tracker to the Medoid of its newly assigned cell
         trackers.forEach(t => {
            const cluster = clusters.get(t.id)!;
            
            if (cluster.length > 0) {
               let bestMedoid = cluster[0];
               let minTotalDist = Infinity;
               
               // Find the agent that minimizes the sum of distances to all other agents in the cell
               cluster.forEach(candidate => {
                  let totalDist = 0;
                  cluster.forEach(member => {
                     totalDist += Math.sqrt(Math.pow(candidate.x - member.x, 2) + Math.pow(candidate.y - member.y, 2));
                  });
                  
                  if (totalDist < minTotalDist) {
                     minTotalDist = totalDist;
                     bestMedoid = candidate;
                  }
               });
               
               // Move the tracker
               t.x = bestMedoid.x;
               t.y = bestMedoid.y;
            }
         });
      }

      // 4. Finalize Placement: Spawn the actual venues at the settled tracker locations
      trackers.forEach(t => {
         const vId = `v_${venueIdCounter++}`;
        this.placeVenue(vId, t.x, t.y, color);
      });
    });

    for (const agent of this.agents.values()) {
      const venueAtCell = Array.from(this.venues.values()).find(
        (venue) => venue.x === agent.x && venue.y === agent.y
      );

      if (!venueAtCell) {
        continue;
      }

      const relocation = this.findRandomEmptyCell(agent.x, agent.y);
      if (!relocation) {
        continue;
      }

      this.grid[agent.y][agent.x] = venueAtCell.id;
      agent.x = relocation.x;
      agent.y = relocation.y;
      this.grid[relocation.y][relocation.x] = agent.id;
    }

    // Recalculate the entire board's happiness now that venues exist
    this.updateAllUtilities();
  }

  public applyIntegratedVenuePolicy(): void {
    for (const venue of this.venues.values()) {
      if (this.isWithinBounds(venue.x, venue.y) && this.grid[venue.y][venue.x] === venue.id) {
        this.grid[venue.y][venue.x] = null;
      }
    }
    this.venues.clear();

    const quarterX = Math.floor(this.width / 4);
    const threeQuarterX = Math.floor((3 * this.width) / 4);
    const quarterY = Math.floor(this.height / 4);
    const threeQuarterY = Math.floor((3 * this.height) / 4);

    const clampX = (x: number) => Math.max(1, Math.min(this.width - 2, x));
    const clampY = (y: number) => Math.max(1, Math.min(this.height - 2, y));

    const placements: Array<{ id: string; x: number; y: number; color: EntityColor }> = [
      { id: 'v_0', x: clampX(quarterX), y: clampY(quarterY), color: 'red' },
      { id: 'v_1', x: clampX(quarterX + 2), y: clampY(quarterY), color: 'green' },
      { id: 'v_2', x: clampX(threeQuarterX - 2), y: clampY(threeQuarterY), color: 'red' },
      { id: 'v_3', x: clampX(threeQuarterX), y: clampY(threeQuarterY), color: 'green' }
    ];

    for (const placement of placements) {
      this.placeVenue(placement.id, placement.x, placement.y, placement.color);
    }

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
      if (!this.isWithinBounds(sourceAgent.x, sourceAgent.y)) continue;
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

  // --- METRICS ---

  public getMetrics(): SegregationMetrics {
    // Calls the isolated math file
    return calculateMetrics(this.agents, this.width, this.height, this.tickCount);
  }
}