import type { Agent, EntityColor, Venue } from '../types/models';

export type Point = {
  x: number;
  y: number;
};

export type Grid = (string | null)[][];

export type AgentUtility = {
  utility: number;
  currentVenueId: string | null;
  isHappy: boolean;
};

export function isWithinBounds(x: number, y: number, width: number, height: number): boolean {
  return x >= 0 && x < width && y >= 0 && y < height;
}

export function euclideanDistance(a: Point, b: Point): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

export function mooreNeighbors(x: number, y: number, width: number, height: number): Point[] {
  const neighbors: Point[] = [];

  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dy === 0) continue;

      const nx = x + dx;
      const ny = y + dy;
      if (isWithinBounds(nx, ny, width, height)) {
        neighbors.push({ x: nx, y: ny });
      }
    }
  }

  return neighbors;
}

export function collectEmptyCells(grid: Grid, width: number, height: number, exclude?: Point): Point[] {
  const emptyCells: Point[] = [];

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const isExcluded = exclude ? exclude.x === x && exclude.y === y : false;
      if (!isExcluded && grid[y][x] === null) {
        emptyCells.push({ x, y });
      }
    }
  }

  return emptyCells;
}

export function neighborhoodSimilarity(
  color: EntityColor,
  x: number,
  y: number,
  grid: Grid,
  agents: Map<string, Agent>,
  width: number,
  height: number
): number {
  let sameColor = 0;
  let totalNeighbors = 0;

  for (const neighborCoord of mooreNeighbors(x, y, width, height)) {
    const occupantId = grid[neighborCoord.y][neighborCoord.x];
    if (!occupantId || !occupantId.startsWith('agent_')) continue;

    const neighbor = agents.get(occupantId);
    if (!neighbor) continue;

    totalNeighbors++;
    if (neighbor.color === color) {
      sameColor++;
    }
  }

  if (totalNeighbors === 0) return 1;
  return sameColor / totalNeighbors;
}

export function computeVenueAttendanceScores(
  venues: Map<string, Venue>,
  agents: Map<string, Agent>,
  venueRadius: number
): Map<string, number> {
  const venueScores = new Map<string, number>();

  for (const venue of venues.values()) {
    let sameColor = 0;
    let totalInRadius = 0;

    for (const agent of agents.values()) {
      const distance = euclideanDistance(agent, venue);
      if (distance > venueRadius) continue;

      totalInRadius++;
      if (agent.color === venue.color) {
        sameColor++;
      }
    }

    venueScores.set(venue.id, totalInRadius > 0 ? sameColor / totalInRadius : 0);
  }

  return venueScores;
}

export function findClosestVenueInRadius(
  venues: Map<string, Venue>,
  color: EntityColor,
  x: number,
  y: number,
  venueRadius: number
): string | null {
  let closestVenueId: string | null = null;
  let minDistance = Number.POSITIVE_INFINITY;

  for (const venue of venues.values()) {
    if (venue.color !== color) continue;

    const distance = euclideanDistance({ x, y }, venue);
    if (distance < minDistance) {
      minDistance = distance;
      closestVenueId = venue.id;
    }
  }

  if (minDistance > venueRadius) {
    return null;
  }

  return closestVenueId;
}

export function computeAgentUtility(
  agent: Pick<Agent, 'color' | 'x' | 'y'>,
  grid: Grid,
  agents: Map<string, Agent>,
  venues: Map<string, Venue>,
  venueScores: Map<string, number>,
  width: number,
  height: number,
  venueRadius: number,
  similarityThreshold: number
): AgentUtility {
  const neighborhoodScore = neighborhoodSimilarity(agent.color, agent.x, agent.y, grid, agents, width, height);
  const closestVenueId = findClosestVenueInRadius(venues, agent.color, agent.x, agent.y, venueRadius);

  const venueUtility = closestVenueId ? (venueScores.get(closestVenueId) ?? 0) : 0;
  const utility = venues.size === 0 ? neighborhoodScore : 0.5 * neighborhoodScore + 0.5 * venueUtility;

  return {
    utility,
    currentVenueId: closestVenueId,
    isHappy: utility >= similarityThreshold
  };
}

export function sampleUnique<T>(items: T[], count: number): T[] {
  const next = [...items];

  for (let i = next.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = next[i];
    next[i] = next[j];
    next[j] = tmp;
  }

  return next.slice(0, Math.max(0, Math.min(count, next.length)));
}

function nearestTrackerIndex(point: Point, trackers: Point[]): number {
  let nearestIndex = 0;
  let nearestDistance = Number.POSITIVE_INFINITY;

  for (let i = 0; i < trackers.length; i++) {
    const distance = euclideanDistance(point, trackers[i]);
    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearestIndex = i;
    }
  }

  return nearestIndex;
}

function medoidOfCluster(cluster: Agent[]): Point {
  if (cluster.length === 0) {
    return { x: 0, y: 0 };
  }

  let best = cluster[0];
  let bestDistance = Number.POSITIVE_INFINITY;

  for (const candidate of cluster) {
    let totalDistance = 0;
    for (const member of cluster) {
      totalDistance += euclideanDistance(candidate, member);
    }

    if (totalDistance < bestDistance) {
      bestDistance = totalDistance;
      best = candidate;
    }
  }

  return { x: best.x, y: best.y };
}

export function runLloydMedoids(targetAgents: Agent[], k: number, iterations: number): Point[] {
  if (targetAgents.length === 0) return [];

  const initialSeeds = sampleUnique(targetAgents, k).map((seed) => ({ x: seed.x, y: seed.y }));
  const trackers = initialSeeds.length > 0 ? initialSeeds : [{ x: targetAgents[0].x, y: targetAgents[0].y }];

  for (let i = 0; i < iterations; i++) {
    const clusters: Agent[][] = Array.from({ length: trackers.length }, () => []);

    for (const agent of targetAgents) {
      const index = nearestTrackerIndex(agent, trackers);
      clusters[index].push(agent);
    }

    for (let trackerIndex = 0; trackerIndex < trackers.length; trackerIndex++) {
      if (clusters[trackerIndex].length === 0) continue;
      trackers[trackerIndex] = medoidOfCluster(clusters[trackerIndex]);
    }
  }

  return trackers;
}
