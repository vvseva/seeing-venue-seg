import type { Agent, SegregationMetrics } from '../types/models';

/**
 * Calculates Massey & Denton Segregation Metrics for the current grid state.
 * @param agents Map of all agents in the simulation
 * @param width Grid width
 * @param height Grid height
 * @param tickCount Current simulation tick
 * @param targetColor The color group to analyze (e.g., 'red')
 */
export function calculateMetrics(
  agents: Map<string, Agent>,
  width: number,
  height: number,
  tickCount: number,
  targetColor: 'red' | 'green' = 'red'
): SegregationMetrics {
  
  const allAgents = Array.from(agents.values());
  const popX = allAgents.filter(a => a.color === targetColor);
  const popY = allAgents.filter(a => a.color !== targetColor);
  
  const totalX = popX.length;
  const totalY = popY.length;
  const totalPop = allAgents.length;

  if (totalX === 0 || totalY === 0) {
    return { tick: tickCount, dissimilarity: 0, exposure: 0, clustering: 0 };
  }

  // 1. Calculate Exposure (Isolation Index)
  // Average proportion of same-color neighbors for members of the target group.
  let isolationSum = 0;
  
  popX.forEach(agent => {
    let sameNearby = 0;
    let totalNearby = 0;

    // Moore neighborhood (Radius 1)
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        const nx = agent.x + dx;
        const ny = agent.y + dy;
        
        const neighbor = allAgents.find(a => a.x === nx && a.y === ny);
        if (neighbor) {
          totalNearby++;
          if (neighbor.color === agent.color) sameNearby++;
        }
      }
    }
    
    if (totalNearby > 0) {
      isolationSum += (sameNearby / totalNearby);
    }
  });

  const exposure = isolationSum / totalX;

  // 2. Calculate Dissimilarity Index
  // Requires dividing the grid into "tracts". For a 10x10 grid, we'll use 2x2 tracts.
  const tractSize = 2;
  let dissimilaritySum = 0;

  for (let ty = 0; ty < height; ty += tractSize) {
    for (let tx = 0; tx < width; tx += tractSize) {
      
      // Count populations within this specific tract
      let localX = 0;
      let localY = 0;
      
      allAgents.forEach(agent => {
        if (agent.x >= tx && agent.x < tx + tractSize && agent.y >= ty && agent.y < ty + tractSize) {
          if (agent.color === targetColor) localX++;
          else localY++;
        }
      });

      dissimilaritySum += Math.abs((localX / totalX) - (localY / totalY));
    }
  }
  
  const dissimilarity = dissimilaritySum / 2;

  // 3. Calculate Spatial Clustering
  // Using an exponential distance decay function: exp(-distance)
  const calculatePxx = (group: Agent[]) => {
    if (group.length <= 1) return 0;
    let sum = 0;
    group.forEach(a1 => {
      let innerSum = 0;
      group.forEach(a2 => {
        if (a1.id !== a2.id) {
          // Euclidean distance
          const dist = Math.sqrt(Math.pow(a1.x - a2.x, 2) + Math.pow(a1.y - a2.y, 2));
          innerSum += Math.exp(-dist);
        }
      });
      sum += innerSum / (group.length - 1);
    });
    return sum / group.length;
  };

  const pxx = calculatePxx(popX);
  const pyy = calculatePxx(popY);
  const ptt = calculatePxx(allAgents);

  const clustering = ptt > 0 ? ((totalX * pxx) + (totalY * pyy)) / (totalPop * ptt) : 0;

  return {
    tick: tickCount,
    dissimilarity,
    exposure,
    clustering
  };
}