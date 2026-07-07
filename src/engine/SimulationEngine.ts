import type { 
  EntityColor, 
  Agent, 
  Venue, 
  SimulationConfig, 
  ReactionPreview, 
  SegregationMetrics 
} from './types/models';

import { calculateMetrics } from './math/masseyDentonMetrics';

export class SimulationEngine {
  public width: number;
  public height: number;
  
  private density: number;
  private similarityThreshold: number;
  private venueBoost: number;

  // 2D Array mapping [y][x] coordinates to an entity ID (or null if empty)
  private grid: (string | null)[][];
  
  public agents: Map<string, Agent>;
  public venues: Map<string, Venue>;
  public tickCount: number;

  constructor(config: SimulationConfig = {}) {
    this.width = config.width ?? 15;
    this.height = config.height ?? 15;
    this.density = config.density ?? 0.7;
    this.similarityThreshold = config.similarityThreshold ?? 0.5;
    this.venueBoost = config.venueBoost ?? 0.2;

    this.grid = [];
    this.agents = new Map<string, Agent>();
    this.venues = new Map<string, Venue>();
    this.tickCount = 0;
  }

  // --- INITIALIZATION ---

  public init(): void {
    this.grid = Array.from({ length: this.height }, () => 
      Array(this.width).fill(null)
    );
    
    this.agents.clear();
    this.venues.clear();
    this.tickCount = 0;

    let idCounter = 0;
    const totalCells = this.width * this.height;
    const targetPopulation = Math.floor(totalCells * this.density);

    let placed = 0;
    while (placed < targetPopulation) {
      const x = Math.floor(Math.random() * this.width);
      const y = Math.floor(Math.random() * this.height);

      if (this.grid[y][x] === null) {
        const color: EntityColor = Math.random() > 0.5 ? 'red' : 'green';
        const agentId = `a_${idCounter++}`;
        
        const newAgent: Agent = { id: agentId, x, y, color, isHappy: false, utility: 0 };
        this.grid[y][x] = agentId;
        this.agents.set(agentId, newAgent);
        
        placed++;
      }
    }
    
    this.updateAllUtilities();
  }

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
            if (occupantId.startsWith('a_')) {
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

  public updateAllUtilities(): void {
    for (const [id, agent] of this.agents) {
      const newScore = this.calculateUtilityScore(agent.color, agent.x, agent.y);
      agent.utility = newScore;
      
      // We still derive a boolean so the UI knows whether to draw a solid or dashed border
      agent.isHappy = newScore >= this.similarityThreshold;
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
          
          if (neighborId && neighborId.startsWith('a_') && neighborId !== draggedId) {
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

    const targetCell = this.findNearestEmptyCell(preferredX, preferredY);
    if (!targetCell) {
      if (existingVenue) {
        this.grid[existingVenue.y][existingVenue.x] = existingVenue.id;
      }
      return null;
    }

    const venue: Venue = {
      id,
      x: targetCell.x,
      y: targetCell.y,
      color
    };

    this.venues.set(id, venue);
    this.grid[targetCell.y][targetCell.x] = id;
    return venue;
  }

  public previewVenueReactions(venueId: string, hoverX: number, hoverY: number): ReactionPreview[] {
    const venue = this.venues.get(venueId);
    if (!venue) return [];
    if (!this.isWithinBounds(hoverX, hoverY)) return [];

    const targetOccupant = this.grid[hoverY][hoverX];
    if (targetOccupant !== null && targetOccupant !== venueId) return [];

    const originalX = venue.x;
    const originalY = venue.y;
    const originalTargetOccupant = this.grid[hoverY][hoverX];

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

    return reactions;
  }

  public moveVenue(id: string, targetX: number, targetY: number): boolean {
    const venue = this.venues.get(id);
    if (!venue) return false;
    if (!this.isWithinBounds(targetX, targetY)) return false;
    if (venue.x === targetX && venue.y === targetY) return true;

    const targetOccupant = this.grid[targetY][targetX];
    if (targetOccupant !== null && targetOccupant !== id) {
      if (!targetOccupant.startsWith('a_')) return false;

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

    // Recalculate the entire board's happiness now that venues exist
    this.updateAllUtilities();
  }

  // --- METRICS ---

  public getMetrics(): SegregationMetrics {
    // Calls the isolated math file
    return calculateMetrics(this.agents, this.width, this.height, this.tickCount);
  }
}