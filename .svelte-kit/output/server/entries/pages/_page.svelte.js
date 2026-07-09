import { n as onDestroy, r as tick } from "../../chunks/index-server.js";
import { C as escape_html, E as get, O as writable, S as attr, T as derived, c as stringify, ct as fallback, i as ensure_array_like, l as unsubscribe_stores, n as bind_props, s as store_get, t as attr_class } from "../../chunks/server.js";
import "../../chunks/index-server2.js";
import * as d3 from "d3";
//#region src/stores/narrativeStore.ts
var chaptersData = [
	{
		id: 0,
		title: "The First Resident",
		content: "We start with an empty grid. Let's welcome our very first resident. They currently have no neighbors and no venues to attend.",
		actionLabel: "Spawn Protagonist",
		dispatchAction: "SPAWN_PROTAGONIST"
	},
	{
		id: 1,
		title: "Model Behavior Tutorial",
		content: "The protagonist now stands between two small groups of different colors, one near the top and one near the bottom. Move the protagonist around and observe how nearby agents react.",
		actionLabel: "Create Tutorial Setup",
		dispatchAction: "SPAWN_TUTORIAL_GROUPS"
	},
	{
		id: 2,
		title: "A Crowded Neighborhood",
		content: "Let's fill the rest of the city. Our initial resident is now surrounded. Drag them around to see how their utility score changes based on their new neighbors.",
		actionLabel: "Spawn Population",
		dispatchAction: "SPAWN_POPULATION"
	},
	{
		id: 3,
		title: "Massive Moves 1",
		content: "Now we let everyone move. At each tick, unhappy agents will relocate until they are satisfied. Let's watch the macroscopic patterns emerge.",
		actionLabel: "Run Simulation",
		dispatchAction: "PLAY_SIMULATION"
	},
	{
		id: 4,
		title: "Outcomes 1",
		content: "Notice the macro consequences of individual preferences. Segregation has naturally increased.",
		actionLabel: "Start Tutorial 2: Venues"
	},
	{
		id: 5,
		title: "Venue Generation",
		content: "Agents now factor venues into their utility. We will generate color-exclusive venues using Voronoi Relaxation to cover the emerged neighborhoods.",
		actionLabel: "Generate Venues",
		dispatchAction: "GENERATE_VENUES"
	},
	{
		id: 6,
		title: "Exploration: Venue Impact",
		content: "Venues have a catchment area. Hover over a venue to see who attends it, and drag it to see how it affects local utility.",
		actionLabel: "Next: Massive Moves 2"
	},
	{
		id: 7,
		title: "Massive Moves & Outcomes 2",
		content: "Let's run the simulation again. Observe how the introduction of venues changes the previously segregated environment.",
		actionLabel: "Run Simulation",
		dispatchAction: "PLAY_SIMULATION"
	},
	{
		id: 8,
		title: "Policy Maker Challenge",
		content: "You are now the policy maker. Move venues, run the model for 25 ticks, and try to reduce segregation. We will save your venue placements and the average segregation indexes from those 25 ticks as your policy score.",
		actionLabel: "Run Your Policy (25 Ticks)",
		dispatchAction: "RUN_USER_POLICY"
	},
	{
		id: 9,
		title: "Exemplar Integrated Policy",
		content: "Now compare your policy with an exemplar integrated venue placement. The model creates four base venues and adds four nearby integrated counterpart venues of opposite colors, then runs 25 ticks to compare average indexes.",
		actionLabel: "Run Exemplar Policy (25 Ticks)",
		dispatchAction: "RUN_EXEMPLAR_POLICY"
	},
	{
		id: 10,
		title: "Side-by-Side Policy Comparison",
		content: "Both worlds now run in parallel: your venue policy on the left and the exemplar integrated policy on the right. Compare segregation trajectories in colorblind-friendly chart lines.",
		actionLabel: "Run Side-by-Side Comparison",
		dispatchAction: "RUN_SIDE_BY_SIDE_COMPARE"
	},
	{
		id: 11,
		title: "Robust Comparison Across Randomness",
		content: "To reduce noise from random movement, we now run each policy 10 times while the two worlds animate at a faster pace. You can still adjust venues on the Your Policy grid and rerun to see new spaghetti lines and updated mean trajectories.",
		actionLabel: "Run 10x Robust Comparison",
		dispatchAction: "RUN_MONTE_CARLO_COMPARE"
	}
];
var chapters = chaptersData;
var currentChapterIndex = writable(0);
var currentChapter = derived(currentChapterIndex, ($index) => chaptersData[$index]);
//#endregion
//#region src/engine/math/masseyDentonMetrics.ts
/**
* Calculates Massey & Denton Segregation Metrics for the current grid state.
* @param agents Map of all agents in the simulation
* @param width Grid width
* @param height Grid height
* @param tickCount Current simulation tick
* @param targetColor The color group to analyze (e.g., 'red')
*/
function calculateMetrics(agents, width, height, tickCount, targetColor = "red") {
	const allAgents = Array.from(agents.values());
	const popX = allAgents.filter((a) => a.color === targetColor);
	const popY = allAgents.filter((a) => a.color !== targetColor);
	const totalX = popX.length;
	const totalY = popY.length;
	const totalPop = allAgents.length;
	if (totalX === 0 || totalY === 0) return {
		tick: tickCount,
		dissimilarity: 0,
		exposure: 0,
		clustering: 0
	};
	let isolationSum = 0;
	popX.forEach((agent) => {
		let sameNearby = 0;
		let totalNearby = 0;
		for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
			if (dx === 0 && dy === 0) continue;
			const nx = agent.x + dx;
			const ny = agent.y + dy;
			const neighbor = allAgents.find((a) => a.x === nx && a.y === ny);
			if (neighbor) {
				totalNearby++;
				if (neighbor.color === agent.color) sameNearby++;
			}
		}
		if (totalNearby > 0) isolationSum += sameNearby / totalNearby;
	});
	const exposure = isolationSum / totalX;
	const tractSize = 2;
	let dissimilaritySum = 0;
	for (let ty = 0; ty < height; ty += tractSize) for (let tx = 0; tx < width; tx += tractSize) {
		let localX = 0;
		let localY = 0;
		allAgents.forEach((agent) => {
			if (agent.x >= tx && agent.x < tx + tractSize && agent.y >= ty && agent.y < ty + tractSize) if (agent.color === targetColor) localX++;
			else localY++;
		});
		dissimilaritySum += Math.abs(localX / totalX - localY / totalY);
	}
	const dissimilarity = dissimilaritySum / 2;
	const calculatePxx = (group) => {
		if (group.length <= 1) return 0;
		let sum = 0;
		group.forEach((a1) => {
			let innerSum = 0;
			group.forEach((a2) => {
				if (a1.id !== a2.id) {
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
	return {
		tick: tickCount,
		dissimilarity,
		exposure,
		clustering: ptt > 0 ? (totalX * pxx + totalY * pyy) / (totalPop * ptt) : 0
	};
}
//#endregion
//#region src/engine/math/simulationCoreMath.ts
function isWithinBounds(x, y, width, height) {
	return x >= 0 && x < width && y >= 0 && y < height;
}
function euclideanDistance(a, b) {
	const dx = a.x - b.x;
	const dy = a.y - b.y;
	return Math.sqrt(dx * dx + dy * dy);
}
function mooreNeighbors(x, y, width, height) {
	const neighbors = [];
	for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
		if (dx === 0 && dy === 0) continue;
		const nx = x + dx;
		const ny = y + dy;
		if (isWithinBounds(nx, ny, width, height)) neighbors.push({
			x: nx,
			y: ny
		});
	}
	return neighbors;
}
function collectEmptyCells(grid, width, height, exclude) {
	const emptyCells = [];
	for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) if (!(exclude ? exclude.x === x && exclude.y === y : false) && grid[y][x] === null) emptyCells.push({
		x,
		y
	});
	return emptyCells;
}
function neighborhoodSimilarity(color, x, y, grid, agents, width, height) {
	let sameColor = 0;
	let totalNeighbors = 0;
	for (const neighborCoord of mooreNeighbors(x, y, width, height)) {
		const occupantId = grid[neighborCoord.y][neighborCoord.x];
		if (!occupantId || !occupantId.startsWith("agent_")) continue;
		const neighbor = agents.get(occupantId);
		if (!neighbor) continue;
		totalNeighbors++;
		if (neighbor.color === color) sameColor++;
	}
	if (totalNeighbors === 0) return 1;
	return sameColor / totalNeighbors;
}
function computeVenueAttendanceScores(venues, agents, venueRadius) {
	const venueScores = /* @__PURE__ */ new Map();
	for (const venue of venues.values()) {
		let sameColor = 0;
		let totalInRadius = 0;
		for (const agent of agents.values()) {
			if (euclideanDistance(agent, venue) > venueRadius) continue;
			totalInRadius++;
			if (agent.color === venue.color) sameColor++;
		}
		venueScores.set(venue.id, totalInRadius > 0 ? sameColor / totalInRadius : 0);
	}
	return venueScores;
}
function findClosestVenueInRadius(venues, color, x, y, venueRadius) {
	let closestVenueId = null;
	let minDistance = Number.POSITIVE_INFINITY;
	for (const venue of venues.values()) {
		if (venue.color !== color) continue;
		const distance = euclideanDistance({
			x,
			y
		}, venue);
		if (distance < minDistance) {
			minDistance = distance;
			closestVenueId = venue.id;
		}
	}
	if (minDistance > venueRadius) return null;
	return closestVenueId;
}
function computeAgentUtility(agent, grid, agents, venues, venueScores, width, height, venueRadius, similarityThreshold) {
	const neighborhoodScore = neighborhoodSimilarity(agent.color, agent.x, agent.y, grid, agents, width, height);
	const closestVenueId = findClosestVenueInRadius(venues, agent.color, agent.x, agent.y, venueRadius);
	const venueUtility = closestVenueId ? venueScores.get(closestVenueId) ?? 0 : 0;
	const utility = venues.size === 0 ? neighborhoodScore : .5 * neighborhoodScore + .5 * venueUtility;
	return {
		utility,
		currentVenueId: closestVenueId,
		isHappy: utility >= similarityThreshold
	};
}
function sampleUnique(items, count) {
	const next = [...items];
	for (let i = next.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		const tmp = next[i];
		next[i] = next[j];
		next[j] = tmp;
	}
	return next.slice(0, Math.max(0, Math.min(count, next.length)));
}
function nearestTrackerIndex(point, trackers) {
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
function medoidOfCluster(cluster) {
	if (cluster.length === 0) return {
		x: 0,
		y: 0
	};
	let best = cluster[0];
	let bestDistance = Number.POSITIVE_INFINITY;
	for (const candidate of cluster) {
		let totalDistance = 0;
		for (const member of cluster) totalDistance += euclideanDistance(candidate, member);
		if (totalDistance < bestDistance) {
			bestDistance = totalDistance;
			best = candidate;
		}
	}
	return {
		x: best.x,
		y: best.y
	};
}
function runLloydMedoids(targetAgents, k, iterations) {
	if (targetAgents.length === 0) return [];
	const initialSeeds = sampleUnique(targetAgents, k).map((seed) => ({
		x: seed.x,
		y: seed.y
	}));
	const trackers = initialSeeds.length > 0 ? initialSeeds : [{
		x: targetAgents[0].x,
		y: targetAgents[0].y
	}];
	for (let i = 0; i < iterations; i++) {
		const clusters = Array.from({ length: trackers.length }, () => []);
		for (const agent of targetAgents) clusters[nearestTrackerIndex(agent, trackers)].push(agent);
		for (let trackerIndex = 0; trackerIndex < trackers.length; trackerIndex++) {
			if (clusters[trackerIndex].length === 0) continue;
			trackers[trackerIndex] = medoidOfCluster(clusters[trackerIndex]);
		}
	}
	return trackers;
}
var DEFAULT_WORLD_PARAMETERS = {
	width: 12,
	height: 12,
	density: .8,
	similarityThreshold: .5,
	venueRadius: 3,
	venueCapacity: 20
};
function sanitizeWorldParameters(input) {
	return {
		width: Math.max(4, Math.min(60, Math.floor(input.width ?? DEFAULT_WORLD_PARAMETERS.width))),
		height: Math.max(4, Math.min(60, Math.floor(input.height ?? DEFAULT_WORLD_PARAMETERS.height))),
		density: Math.max(.05, Math.min(.99, input.density ?? DEFAULT_WORLD_PARAMETERS.density)),
		similarityThreshold: Math.max(0, Math.min(1, input.similarityThreshold ?? DEFAULT_WORLD_PARAMETERS.similarityThreshold)),
		venueRadius: Math.max(1, Math.min(20, Math.floor(input.venueRadius ?? DEFAULT_WORLD_PARAMETERS.venueRadius))),
		venueCapacity: Math.max(1, Math.min(200, Math.floor(input.venueCapacity ?? DEFAULT_WORLD_PARAMETERS.venueCapacity)))
	};
}
//#endregion
//#region src/engine/SimulationEngine.ts
var SimulationEngine = class {
	width;
	height;
	density;
	similarityThreshold;
	venueRadius;
	grid;
	agents;
	venues;
	tickCount;
	constructor(config = {}) {
		this.width = config.width ?? 12;
		this.height = config.height ?? 12;
		this.density = config.density ?? .8;
		this.similarityThreshold = config.similarityThreshold ?? .5;
		this.venueRadius = config.venueRadius ?? 3;
		this.grid = [];
		this.agents = /* @__PURE__ */ new Map();
		this.venues = /* @__PURE__ */ new Map();
		this.tickCount = 0;
	}
	initEmptyGrid() {
		this.grid = Array.from({ length: this.height }, () => Array(this.width).fill(null));
		this.agents.clear();
		this.venues.clear();
		this.tickCount = 0;
	}
	spawnProtagonist(color = "red") {
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
	spawnPopulation() {
		const totalCells = this.width * this.height;
		const targetAgents = Math.max(0, Math.floor(totalCells * this.density) - this.agents.size);
		let spawned = 0;
		let agentIdCounter = this.nextAgentIdCounter();
		while (spawned < targetAgents) {
			const x = Math.floor(Math.random() * this.width);
			const y = Math.floor(Math.random() * this.height);
			if (this.grid[y][x] !== null) continue;
			const color = Math.random() > .5 ? "red" : "green";
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
	spawnTutorialGroups() {
		if (!this.agents.has("agent_protagonist")) this.spawnProtagonist("red");
		this.clearTutorialAgents();
		const centerX = Math.floor(this.width / 2);
		const topY = Math.max(1, Math.floor(this.height * .25));
		const bottomY = Math.min(this.height - 2, Math.floor(this.height * .75));
		[
			-1,
			0,
			1
		].forEach((offset, index) => {
			this.placeTutorialAgent(`agent_tutorial_top_${index + 1}`, centerX + offset, topY, "red");
			this.placeTutorialAgent(`agent_tutorial_bottom_${index + 1}`, centerX + offset, bottomY, "green");
		});
		this.updateAllUtilities();
	}
	previewLocalReactions(_draggedColor, draggedId, hoverX, hoverY) {
		if (!this.inBounds(hoverX, hoverY)) return [];
		const hoveredOccupant = this.grid[hoverY][hoverX];
		if (hoveredOccupant !== null && hoveredOccupant !== draggedId) return [];
		const originalOccupant = this.grid[hoverY][hoverX];
		this.grid[hoverY][hoverX] = draggedId;
		const venueScores = computeVenueAttendanceScores(this.venues, this.agents, this.venueRadius);
		const reactions = [];
		for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
			if (dx === 0 && dy === 0) continue;
			const nx = hoverX + dx;
			const ny = hoverY + dy;
			if (!this.inBounds(nx, ny)) continue;
			const neighborId = this.grid[ny][nx];
			if (!neighborId || !neighborId.startsWith("agent_") || neighborId === draggedId) continue;
			const neighbor = this.agents.get(neighborId);
			if (!neighbor) continue;
			const utilitySnapshot = computeAgentUtility(neighbor, this.grid, this.agents, this.venues, venueScores, this.width, this.height, this.venueRadius, this.similarityThreshold);
			reactions.push({
				id: neighbor.id,
				originalHappiness: neighbor.isHappy,
				hypotheticalHappiness: utilitySnapshot.isHappy
			});
		}
		this.grid[hoverY][hoverX] = originalOccupant;
		return reactions;
	}
	moveAgent(id, targetX, targetY) {
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
	placeVenue(id, preferredX, preferredY, color) {
		const existingVenue = this.venues.get(id);
		if (existingVenue) this.grid[existingVenue.y][existingVenue.x] = null;
		if (!this.inBounds(preferredX, preferredY)) {
			if (existingVenue) this.grid[existingVenue.y][existingVenue.x] = existingVenue.id;
			return null;
		}
		const targetOccupant = this.grid[preferredY][preferredX];
		if (targetOccupant && targetOccupant.startsWith("agent_")) {
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
		} else if (targetOccupant && targetOccupant.startsWith("v_")) {
			this.venues.delete(targetOccupant);
			this.grid[preferredY][preferredX] = null;
		}
		const venue = {
			id,
			x: preferredX,
			y: preferredY,
			color
		};
		this.venues.set(id, venue);
		this.grid[preferredY][preferredX] = id;
		return venue;
	}
	previewVenueReactions(venueId, hoverX, hoverY) {
		const venue = this.venues.get(venueId);
		if (!venue || !this.inBounds(hoverX, hoverY)) return [];
		const targetOccupant = this.grid[hoverY][hoverX];
		if (targetOccupant !== null && targetOccupant !== venueId && !targetOccupant.startsWith("agent_")) return [];
		const originalVenuePosition = {
			x: venue.x,
			y: venue.y
		};
		const originalTargetOccupant = this.grid[hoverY][hoverX];
		let displacedAgent = null;
		let displacedOriginalPosition = null;
		let displacedRelocation = null;
		if (targetOccupant && targetOccupant.startsWith("agent_")) {
			displacedAgent = this.agents.get(targetOccupant) ?? null;
			if (!displacedAgent) return [];
			displacedOriginalPosition = {
				x: displacedAgent.x,
				y: displacedAgent.y
			};
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
		const venueScores = computeVenueAttendanceScores(this.venues, this.agents, this.venueRadius);
		const reactions = [];
		for (const agent of this.agents.values()) {
			const utilitySnapshot = computeAgentUtility(agent, this.grid, this.agents, this.venues, venueScores, this.width, this.height, this.venueRadius, this.similarityThreshold);
			if (utilitySnapshot.isHappy !== agent.isHappy) reactions.push({
				id: agent.id,
				originalHappiness: agent.isHappy,
				hypotheticalHappiness: utilitySnapshot.isHappy
			});
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
	moveVenue(id, targetX, targetY) {
		const venue = this.venues.get(id);
		if (!venue) return false;
		if (!this.inBounds(targetX, targetY)) return false;
		if (venue.x === targetX && venue.y === targetY) return true;
		const targetOccupant = this.grid[targetY][targetX];
		if (targetOccupant !== null && targetOccupant !== id) {
			if (!targetOccupant.startsWith("agent_")) return false;
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
	tick() {
		const allAgents = Array.from(this.agents.values());
		if (allAgents.length === 0) return false;
		allAgents.sort((a, b) => a.utility - b.utility);
		const moveQuota = Math.max(1, Math.ceil(allAgents.length * .1));
		const movingAgents = allAgents.slice(0, moveQuota);
		const emptyCells = collectEmptyCells(this.grid, this.width, this.height);
		if (emptyCells.length === 0) return false;
		let movedCount = 0;
		for (const agent of movingAgents) {
			if (emptyCells.length === 0) break;
			const targetIndex = Math.floor(Math.random() * emptyCells.length);
			const target = emptyCells.splice(targetIndex, 1)[0];
			this.grid[agent.y][agent.x] = null;
			emptyCells.push({
				x: agent.x,
				y: agent.y
			});
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
	generateVenuesLloyds(capacityPerVenue = 20) {
		this.clearAllVenues();
		const activeColors = ["red", "green"];
		let venueIdCounter = 0;
		for (const color of activeColors) {
			const targetAgents = Array.from(this.agents.values()).filter((agent) => agent.color === color);
			if (targetAgents.length === 0) continue;
			const trackerPoints = runLloydMedoids(targetAgents, Math.max(1, Math.ceil(targetAgents.length / capacityPerVenue)), 5);
			for (const tracker of trackerPoints) {
				const venueId = `v_${venueIdCounter++}`;
				this.placeVenue(venueId, tracker.x, tracker.y, color);
			}
		}
		this.updateAllUtilities();
	}
	applyIntegratedVenuePolicy() {
		this.clearAllVenues();
		const quarterX = Math.floor(this.width / 4);
		const threeQuarterX = Math.floor(3 * this.width / 4);
		const quarterY = Math.floor(this.height / 4);
		const threeQuarterY = Math.floor(3 * this.height / 4);
		const clampX = (x) => Math.max(1, Math.min(this.width - 2, x));
		const clampY = (y) => Math.max(1, Math.min(this.height - 2, y));
		const basePlacements = [
			{
				id: "v_0",
				x: clampX(quarterX),
				y: clampY(quarterY),
				color: "red"
			},
			{
				id: "v_1",
				x: clampX(threeQuarterX),
				y: clampY(quarterY),
				color: "green"
			},
			{
				id: "v_2",
				x: clampX(quarterX),
				y: clampY(threeQuarterY),
				color: "green"
			},
			{
				id: "v_3",
				x: clampX(threeQuarterX),
				y: clampY(threeQuarterY),
				color: "red"
			}
		];
		for (const placement of basePlacements) this.placeVenue(placement.id, placement.x, placement.y, placement.color);
		basePlacements.forEach((basePlacement, index) => {
			const oppositeColor = basePlacement.color === "red" ? "green" : "red";
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
	getAgentsSnapshot() {
		return Array.from(this.agents.values()).map((agent) => ({ ...agent }));
	}
	getVenuesSnapshot() {
		return Array.from(this.venues.values()).map((venue) => ({ ...venue }));
	}
	initializeScenario(baseAgents, venuePlacements) {
		this.initEmptyGrid();
		for (const sourceAgent of baseAgents) {
			if (!this.inBounds(sourceAgent.x, sourceAgent.y)) continue;
			if (this.grid[sourceAgent.y][sourceAgent.x] !== null) continue;
			const agent = {
				...sourceAgent,
				currentVenueId: null,
				isHappy: false,
				utility: 0
			};
			this.agents.set(agent.id, agent);
			this.grid[agent.y][agent.x] = agent.id;
		}
		for (const sourceVenue of venuePlacements) this.placeVenue(sourceVenue.id, sourceVenue.x, sourceVenue.y, sourceVenue.color);
		this.tickCount = 0;
		this.updateAllUtilities();
	}
	getMetrics() {
		return calculateMetrics(this.agents, this.width, this.height, this.tickCount);
	}
	inBounds(x, y) {
		return isWithinBounds(x, y, this.width, this.height);
	}
	nextAgentIdCounter() {
		let counter = 1;
		for (const id of this.agents.keys()) {
			const match = id.match(/^agent_(\d+)$/);
			if (!match) continue;
			counter = Math.max(counter, Number(match[1]) + 1);
		}
		return counter;
	}
	clearTutorialAgents() {
		for (const [id, agent] of this.agents.entries()) {
			if (!id.startsWith("agent_tutorial_")) continue;
			this.grid[agent.y][agent.x] = null;
			this.agents.delete(id);
		}
	}
	placeTutorialAgent(id, x, y, color) {
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
	restoreExistingVenue(existingVenue) {
		if (!existingVenue) return;
		this.grid[existingVenue.y][existingVenue.x] = existingVenue.id;
	}
	findRandomEmptyCell(excludeX, excludeY) {
		const emptyCells = collectEmptyCells(this.grid, this.width, this.height, excludeX !== void 0 && excludeY !== void 0 ? {
			x: excludeX,
			y: excludeY
		} : void 0);
		if (emptyCells.length === 0) return null;
		return emptyCells[Math.floor(Math.random() * emptyCells.length)];
	}
	findNearestNonVenueCell(preferredX, preferredY) {
		if (!this.inBounds(preferredX, preferredY)) return null;
		const occupant = this.grid[preferredY][preferredX];
		if (occupant === null || occupant.startsWith("agent_")) return {
			x: preferredX,
			y: preferredY
		};
		const maxRadius = Math.max(this.width, this.height);
		for (let radius = 1; radius <= maxRadius; radius++) for (let y = preferredY - radius; y <= preferredY + radius; y++) for (let x = preferredX - radius; x <= preferredX + radius; x++) {
			if (!this.inBounds(x, y)) continue;
			if (!(Math.max(Math.abs(x - preferredX), Math.abs(y - preferredY)) === radius)) continue;
			const ringOccupant = this.grid[y][x];
			if (ringOccupant === null || ringOccupant.startsWith("agent_")) return {
				x,
				y
			};
		}
		return null;
	}
	clearAllVenues() {
		for (const venue of this.venues.values()) if (this.inBounds(venue.x, venue.y) && this.grid[venue.y][venue.x] === venue.id) this.grid[venue.y][venue.x] = null;
		this.venues.clear();
	}
	updateAllUtilities() {
		const venueScores = computeVenueAttendanceScores(this.venues, this.agents, this.venueRadius);
		for (const agent of this.agents.values()) {
			const next = computeAgentUtility(agent, this.grid, this.agents, this.venues, venueScores, this.width, this.height, this.venueRadius, this.similarityThreshold);
			agent.utility = next.utility;
			agent.currentVenueId = next.currentVenueId;
			agent.isHappy = next.isHappy;
		}
	}
};
//#endregion
//#region src/stores/simulationStore.math.ts
function rollingMean(values) {
	if (values.length === 0) return 0;
	return values.reduce((sum, value) => sum + value, 0) / values.length;
}
function isMetricStable(history, selector, window, maxDelta) {
	const requiredLength = window * 2;
	if (history.length < requiredLength) return false;
	const recent = history.slice(-window).map(selector);
	const previous = history.slice(-requiredLength, -window).map(selector);
	return Math.abs(rollingMean(recent) - rollingMean(previous)) <= maxDelta;
}
function shouldAutoPauseForStability(history, stabilityStartIndex, window, maxDelta) {
	const scopedHistory = history.slice(stabilityStartIndex);
	return isMetricStable(scopedHistory, (m) => m.dissimilarity, window, maxDelta) && isMetricStable(scopedHistory, (m) => m.exposure, window, maxDelta) && isMetricStable(scopedHistory, (m) => m.clustering, window, maxDelta);
}
function calculateMetricAveragesOverLastTicks(history, ticks) {
	const sample = history.slice(-Math.max(1, ticks));
	const sums = sample.reduce((acc, metric) => {
		acc.dissimilarity += metric.dissimilarity;
		acc.exposure += metric.exposure;
		acc.clustering += metric.clustering;
		return acc;
	}, {
		dissimilarity: 0,
		exposure: 0,
		clustering: 0
	});
	const sampleSize = sample.length;
	return {
		dissimilarity: sampleSize > 0 ? sums.dissimilarity / sampleSize : 0,
		exposure: sampleSize > 0 ? sums.exposure / sampleSize : 0,
		clustering: sampleSize > 0 ? sums.clustering / sampleSize : 0,
		sampleSize
	};
}
function averageComparisonRuns(runs) {
	if (runs.length === 0) return [];
	const maxLength = runs.reduce((max, run) => Math.max(max, run.length), 0);
	const averaged = [];
	for (let index = 0; index < maxLength; index++) {
		const points = runs.map((run) => run[index] ?? run.at(-1)).filter((point) => Boolean(point));
		if (points.length === 0) continue;
		const sums = points.reduce((acc, point) => {
			acc.dissimilarity += point.dissimilarity;
			acc.exposure += point.exposure;
			acc.clustering += point.clustering;
			return acc;
		}, {
			dissimilarity: 0,
			exposure: 0,
			clustering: 0
		});
		averaged.push({
			tick: points[0].tick,
			dissimilarity: sums.dissimilarity / points.length,
			exposure: sums.exposure / points.length,
			clustering: sums.clustering / points.length
		});
	}
	return averaged;
}
//#endregion
//#region src/stores/simulationStore.ts
var worldParametersStore = writable({ ...DEFAULT_WORLD_PARAMETERS });
var visualizationStyleStore = writable("cats-and-dogs");
function createEngineFromParameters(parameters) {
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
var engine = createEngineFromParameters(DEFAULT_WORLD_PARAMETERS);
var compareUserEngine = createEngineFromParameters(DEFAULT_WORLD_PARAMETERS);
var compareExemplarEngine = createEngineFromParameters(DEFAULT_WORLD_PARAMETERS);
function recreateAllEngines(parameters) {
	engine = createEngineFromParameters(parameters);
	compareUserEngine = createEngineFromParameters(parameters);
	compareExemplarEngine = createEngineFromParameters(parameters);
}
var agentsStore = writable(Array.from(engine.agents.values()));
var venuesStore = writable(Array.from(engine.venues.values()));
var tickStore = writable(engine.tickCount);
var metricsHistoryStore = writable([engine.getMetrics()]);
var ghostReactionsStore = writable([]);
var hoveredVenueId = writable(null);
var compareUserHoveredVenueIdStore = writable(null);
var compareExemplarHoveredVenueIdStore = writable(null);
var isGeneratingVenuesStore = writable(false);
var policyTargetAveragesStore = writable(null);
var userPolicyResultStore = writable(null);
var exemplarPolicyResultStore = writable(null);
var isComparisonModeStore = writable(false);
var compareUserAgentsStore = writable([]);
var compareUserVenuesStore = writable([]);
var compareExemplarAgentsStore = writable([]);
var compareExemplarVenuesStore = writable([]);
var compareUserMetricsHistoryStore = writable([]);
var compareExemplarMetricsHistoryStore = writable([]);
var monteCarloUserRunsStore = writable([]);
var monteCarloExemplarRunsStore = writable([]);
var monteCarloUserAverageStore = writable([]);
var monteCarloExemplarAverageStore = writable([]);
var compareUserGhostReactionsStore = writable([]);
var compareExemplarGhostReactionsStore = writable([]);
var animationFrameId;
var isPlayingStore = writable(false);
var STABILITY_WINDOW = 25;
var STABILITY_DELTA_THRESHOLD = .02;
var CHAPTER_TWO_SHORT_RUN_TICKS = 50;
var COMPARISON_TICKS = 50;
var MONTE_CARLO_RUNS = 10;
var COMPARISON_ANIMATION_DELAY_MS = 200;
var FAST_COMPARISON_ANIMATION_DELAY_MS = 85;
var stabilityStartIndex = 0;
var policyBaselineAgentsSnapshot = null;
function resetStabilityWindowBaseline() {
	const history = get(metricsHistoryStore);
	stabilityStartIndex = Math.max(0, history.length - 1);
}
function calculateAveragesOverLastTicks(ticks) {
	return calculateMetricAveragesOverLastTicks(get(metricsHistoryStore), ticks);
}
function snapshotVenuePlacement() {
	return Array.from(engine.venues.values()).map((venue) => ({ ...venue })).sort((a, b) => a.id.localeCompare(b.id));
}
function snapshotVenuePlacementFromEngine(targetEngine) {
	return Array.from(targetEngine.venues.values()).map((venue) => ({ ...venue })).sort((a, b) => a.id.localeCompare(b.id));
}
function snapshotAgentsForPolicyBaseline() {
	return engine.getAgentsSnapshot().map((agent) => ({ ...agent })).sort((a, b) => a.id.localeCompare(b.id));
}
function syncStores() {
	agentsStore.set(Array.from(engine.agents.values()));
	venuesStore.set(Array.from(engine.venues.values()));
	tickStore.set(engine.tickCount);
}
function recordCurrentMetrics() {
	const nextMetrics = engine.getMetrics();
	metricsHistoryStore.update((history) => {
		if (history.at(-1)?.tick === nextMetrics.tick) return [...history.slice(0, -1), nextMetrics];
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
function runBackgroundTrajectory(baselineAgents, placement, ticks) {
	const backgroundEngine = createEngineFromParameters(get(worldParametersStore));
	backgroundEngine.initializeScenario(baselineAgents, placement);
	const history = [backgroundEngine.getMetrics()];
	for (let i = 0; i < ticks; i++) {
		backgroundEngine.tick();
		history.push(backgroundEngine.getMetrics());
	}
	return history;
}
var simulationActions = {
	setVisualizationStyle(style) {
		visualizationStyleStore.set(style);
	},
	applyWorldParameters(nextParameters) {
		this.stop();
		const merged = sanitizeWorldParameters({
			...get(worldParametersStore),
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
	step() {
		const isStillActive = engine.tick();
		syncStores();
		recordCurrentMetrics();
		return isStillActive;
	},
	play() {
		if (get(isPlayingStore)) return;
		isPlayingStore.set(true);
		const loop = () => {
			const isStillActive = this.step();
			const reachedStableRollingMean = shouldAutoPauseForStability(get(metricsHistoryStore), stabilityStartIndex, STABILITY_WINDOW, STABILITY_DELTA_THRESHOLD);
			if (isStillActive && !reachedStableRollingMean && get(isPlayingStore)) setTimeout(() => {
				animationFrameId = requestAnimationFrame(loop);
			}, 200);
			else this.stop();
		};
		loop();
	},
	playForTicks(ticks = CHAPTER_TWO_SHORT_RUN_TICKS, onComplete) {
		if (get(isPlayingStore)) return Promise.resolve(false);
		let ticksRemaining = Math.max(1, Math.floor(ticks));
		isPlayingStore.set(true);
		return new Promise((resolve) => {
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
				if (completed) onComplete?.();
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
		if (completed) userPolicyResultStore.set({
			placement,
			averages: calculateAveragesOverLastTicks(25)
		});
		return completed;
	},
	async runExemplarPolicyEvaluation() {
		this.stop();
		if (!policyBaselineAgentsSnapshot) policyBaselineAgentsSnapshot = snapshotAgentsForPolicyBaseline();
		engine.applyIntegratedVenuePolicy();
		syncStores();
		recordCurrentMetrics();
		resetStabilityWindowBaseline();
		const placement = snapshotVenuePlacement();
		const completed = await this.playForTicks(25);
		if (completed) exemplarPolicyResultStore.set({
			placement,
			averages: calculateAveragesOverLastTicks(25)
		});
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
		return new Promise((resolve) => {
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
		const userRuns = Array.from({ length: MONTE_CARLO_RUNS }, () => runBackgroundTrajectory(baselineAgents, userPlacement, COMPARISON_TICKS));
		const exemplarRuns = Array.from({ length: MONTE_CARLO_RUNS }, () => runBackgroundTrajectory(baselineAgents, exemplarPlacement, COMPARISON_TICKS));
		monteCarloUserRunsStore.set(userRuns);
		monteCarloExemplarRunsStore.set(exemplarRuns);
		monteCarloUserAverageStore.set(averageComparisonRuns(userRuns));
		monteCarloExemplarAverageStore.set(averageComparisonRuns(exemplarRuns));
		return new Promise((resolve) => {
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
	spawnProtagonist() {
		this.stop();
		engine.spawnProtagonist("red");
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
	previewMove(color, id, targetX, targetY) {
		this.stop();
		const reactions = engine.previewLocalReactions(color, id, targetX, targetY);
		ghostReactionsStore.set(reactions);
	},
	clearPreview() {
		ghostReactionsStore.set([]);
	},
	commitMove(id, targetX, targetY) {
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
		await new Promise((resolve) => {
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
	previewVenueMove(id, targetX, targetY) {
		this.stop();
		const reactions = engine.previewVenueReactions(id, targetX, targetY);
		ghostReactionsStore.set(reactions);
	},
	previewCompareUserVenueMove(id, targetX, targetY) {
		this.stop();
		const reactions = compareUserEngine.previewVenueReactions(id, targetX, targetY);
		compareUserGhostReactionsStore.set(reactions);
	},
	commitVenueMove(id, targetX, targetY) {
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
	commitCompareUserVenueMove(id, targetX, targetY) {
		this.stop();
		const success = compareUserEngine.moveVenue(id, targetX, targetY);
		if (success) {
			compareUserGhostReactionsStore.set([]);
			syncComparisonStores();
			const placement = snapshotVenuePlacementFromEngine(compareUserEngine);
			userPolicyResultStore.update((currentResult) => {
				if (!currentResult) return {
					placement,
					averages: calculateAveragesOverLastTicks(25)
				};
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
//#endregion
//#region src/components/narrative/Storyboard.svelte
function Storyboard($$renderer, $$props) {
	$$renderer.component(($$renderer) => {
		var $$store_subs;
		$$renderer.push(`<div class="storyboard"><h2>${escape_html(store_get($$store_subs ??= {}, "$currentChapter", currentChapter).title)}</h2> <p class="content">${escape_html(store_get($$store_subs ??= {}, "$currentChapter", currentChapter).content)}</p> <div class="actions"><button class="btn-primary"${attr("disabled", store_get($$store_subs ??= {}, "$isGeneratingVenuesStore", isGeneratingVenuesStore) || false, true)}>`);
		if (store_get($$store_subs ??= {}, "$isGeneratingVenuesStore", isGeneratingVenuesStore)) {
			$$renderer.push("<!--[0-->");
			$$renderer.push(`<span class="spinner" aria-hidden="true"></span>`);
		} else $$renderer.push("<!--[-1-->");
		$$renderer.push(`<!--]--> ${escape_html(store_get($$store_subs ??= {}, "$currentChapter", currentChapter).actionLabel)}</button></div></div>`);
		if ($$store_subs) unsubscribe_stores($$store_subs);
	});
}
//#endregion
//#region src/utils/colors.ts
/**
* D3 Color Scale for the Live Charts.
* If you add more metrics to the chart later (e.g., Exposure, Clustering),
* you can map them automatically using this scale.
*/
var chartMetricsColorScale = d3.scaleOrdinal().domain([
	"dissimilarity",
	"exposure",
	"clustering"
]).range([
	"#3b82f6",
	"#8b5cf6",
	"#f59e0b"
]);
//#endregion
//#region src/components/charts/LiveCharts.svelte
function LiveCharts($$renderer, $$props) {
	$$renderer.component(($$renderer) => {
		var $$store_subs;
		let metricsHistory, latestMetric;
		const width = 320;
		const height = 190;
		const COMPARISON_USER_COLOR = "#0072B2";
		const COMPARISON_EXEMPLAR_COLOR = "#D55E00";
		const margin = {
			top: 20,
			right: 20,
			bottom: 30,
			left: 40
		};
		const innerWidth = width - margin.left - margin.right;
		const innerHeight = height - margin.top - margin.bottom;
		const metricConfigs = [
			{
				key: "dissimilarity",
				title: "Dissimilarity Index"
			},
			{
				key: "exposure",
				title: "Exposure Index"
			},
			{
				key: "clustering",
				title: "Clustering Index"
			}
		];
		let hoveredMetric = null;
		let hoveredLineInfo = null;
		let highlightedMetricKey = null;
		const metricExplanations = {
			exposure: {
				shortTitle: "Exposure (Front Porch Test)",
				howCalculated: "For each person in the target group, we count immediate neighbors and compute the share who are from the same group. Then we average that share across the whole target group.",
				meaning: "High values mean the average person mostly sees their own group in day-to-day local surroundings, indicating isolation."
			},
			dissimilarity: {
				shortTitle: "Dissimilarity (Neighborhood Mix Test)",
				howCalculated: "We split the grid into equal tracts, compare each tract's group mix to the city-wide mix, and sum those local gaps.",
				meaning: "It estimates how unevenly groups are spread and how much relocation would be needed to make all neighborhoods similarly mixed."
			},
			clustering: {
				shortTitle: "Spatial Clustering (Bird's-Eye View Test)",
				howCalculated: "We measure distances between agents, weighting close same-group pairs much more than far-apart pairs, then normalize against the full population pattern.",
				meaning: "High values mean same-group neighborhoods are clumped together into larger continuous enclaves rather than scattered."
			}
		};
		function createXScale(seriesList) {
			const nonEmptySeries = seriesList.filter((series) => series.length > 0);
			const maxTick = Math.max(...nonEmptySeries.map((series) => d3.max(series, (metric) => metric.tick) || 0), 10);
			return d3.scaleLinear().domain([0, maxTick]).range([0, innerWidth]);
		}
		function createYScale(metricKey, seriesList, includeReferenceValues) {
			const recentValues = seriesList.flatMap((series) => series.slice(-50)).map((metric) => metric[metricKey]);
			const referenceValues = includeReferenceValues ? [
				store_get($$store_subs ??= {}, "$policyTargetAveragesStore", policyTargetAveragesStore)?.[metricKey] ?? 0,
				store_get($$store_subs ??= {}, "$userPolicyResultStore", userPolicyResultStore)?.averages[metricKey] ?? 0,
				store_get($$store_subs ??= {}, "$exemplarPolicyResultStore", exemplarPolicyResultStore)?.averages[metricKey] ?? 0
			] : [];
			const allValues = [...recentValues, ...referenceValues];
			const minValue = d3.min(allValues) ?? 0;
			const maxValue = d3.max(allValues) ?? 1;
			const range = maxValue - minValue;
			const padding = Math.max(.02, range * .12);
			const yMin = Math.max(0, minValue - padding);
			const yMax = Math.max(yMin + .08, maxValue + padding);
			return d3.scaleLinear().domain([yMin, yMax]).range([innerHeight, 0]);
		}
		function createPathData(history, metricKey, xScale, yScale) {
			return d3.line().x((metric) => xScale(metric.tick)).y((metric) => yScale(metric[metricKey])).curve(d3.curveMonotoneX)(history) || "";
		}
		function getMetricValue(metric, metricKey) {
			return metric[metricKey];
		}
		function getAverageValue(averages, key) {
			if (!averages) return null;
			return averages[key];
		}
		function clipSeriesToTick(series, maxTick) {
			return series.filter((point) => point.tick <= maxTick);
		}
		$: metricsHistory = store_get($$store_subs ??= {}, "$metricsHistoryStore", metricsHistoryStore);
		$: latestMetric = metricsHistory.at(-1);
		$$renderer.push(`<div class="charts-stack"><!--[-->`);
		const each_array = ensure_array_like(metricConfigs);
		for (let $$index_3 = 0, $$length = each_array.length; $$index_3 < $$length; $$index_3++) {
			let metricConfig = each_array[$$index_3];
			const comparisonUserHistory = store_get($$store_subs ??= {}, "$compareUserMetricsHistoryStore", compareUserMetricsHistoryStore);
			const comparisonExemplarHistory = store_get($$store_subs ??= {}, "$compareExemplarMetricsHistoryStore", compareExemplarMetricsHistoryStore);
			const monteCarloUserRuns = store_get($$store_subs ??= {}, "$monteCarloUserRunsStore", monteCarloUserRunsStore);
			const monteCarloExemplarRuns = store_get($$store_subs ??= {}, "$monteCarloExemplarRunsStore", monteCarloExemplarRunsStore);
			const monteCarloUserAverage = store_get($$store_subs ??= {}, "$monteCarloUserAverageStore", monteCarloUserAverageStore);
			const monteCarloExemplarAverage = store_get($$store_subs ??= {}, "$monteCarloExemplarAverageStore", monteCarloExemplarAverageStore);
			const isMonteCarloStage = store_get($$store_subs ??= {}, "$currentChapterIndex", currentChapterIndex) === 11 && monteCarloUserAverage.length > 0 && monteCarloExemplarAverage.length > 0;
			const isSideBySideStage = !isMonteCarloStage && store_get($$store_subs ??= {}, "$currentChapterIndex", currentChapterIndex) === 10 && comparisonUserHistory.length > 0 && comparisonExemplarHistory.length > 0;
			const maxAnimatedTick = Math.min(comparisonUserHistory.at(-1)?.tick ?? 0, comparisonExemplarHistory.at(-1)?.tick ?? 0);
			const visibleMonteCarloUserRuns = isMonteCarloStage ? monteCarloUserRuns.map((run) => clipSeriesToTick(run, maxAnimatedTick)) : [];
			const visibleMonteCarloExemplarRuns = isMonteCarloStage ? monteCarloExemplarRuns.map((run) => clipSeriesToTick(run, maxAnimatedTick)) : [];
			const visibleMonteCarloUserAverage = isMonteCarloStage ? clipSeriesToTick(monteCarloUserAverage, maxAnimatedTick) : [];
			const visibleMonteCarloExemplarAverage = isMonteCarloStage ? clipSeriesToTick(monteCarloExemplarAverage, maxAnimatedTick) : [];
			const primaryHistory = isMonteCarloStage ? visibleMonteCarloUserAverage : isSideBySideStage ? comparisonUserHistory : metricsHistory;
			const secondaryHistory = isMonteCarloStage ? visibleMonteCarloExemplarAverage : isSideBySideStage ? comparisonExemplarHistory : [];
			const monteCarloSeries = isMonteCarloStage ? [
				...visibleMonteCarloUserRuns,
				...visibleMonteCarloExemplarRuns,
				visibleMonteCarloUserAverage,
				visibleMonteCarloExemplarAverage
			] : [];
			const chartSeries = isMonteCarloStage ? monteCarloSeries : [primaryHistory, secondaryHistory];
			const xScale = createXScale(chartSeries);
			const yScale = createYScale(metricConfig.key, chartSeries, !isSideBySideStage && !isMonteCarloStage);
			const primaryPath = createPathData(primaryHistory, metricConfig.key, xScale, yScale);
			const secondaryPath = createPathData(secondaryHistory, metricConfig.key, xScale, yScale);
			const latestPrimaryMetric = primaryHistory.at(-1);
			const latestSecondaryMetric = secondaryHistory.at(-1);
			$$renderer.push(`<div${attr_class("chart-container", void 0, { "metric-highlighted": highlightedMetricKey === metricConfig.key })} role="presentation"><h3>${escape_html(metricConfig.title)}</h3> `);
			if (highlightedMetricKey === metricConfig.key) {
				$$renderer.push("<!--[0-->");
				$$renderer.push(`<div class="metric-explanation" role="note" aria-live="polite"><p class="metric-explanation-title">${escape_html(metricExplanations[metricConfig.key].shortTitle)}</p> <p class="metric-explanation-line"><strong>How it is calculated:</strong> ${escape_html(metricExplanations[metricConfig.key].howCalculated)}</p> <p class="metric-explanation-line"><strong>What it tells us:</strong> ${escape_html(metricExplanations[metricConfig.key].meaning)}</p></div>`);
			} else $$renderer.push("<!--[-1-->");
			$$renderer.push(`<!--]--> <div class="chart-badges">`);
			if (isMonteCarloStage) {
				$$renderer.push("<!--[0-->");
				$$renderer.push(`<span class="tiny-badge tiny-badge-you-soft">Your runs</span> <span class="tiny-badge tiny-badge-exemplar-soft">Exemplar runs</span> <span class="tiny-badge tiny-badge-you-strong">Your mean</span> <span class="tiny-badge tiny-badge-exemplar-strong">Exemplar mean</span>`);
			} else if (isSideBySideStage) {
				$$renderer.push("<!--[1-->");
				$$renderer.push(`<span class="tiny-badge tiny-badge-you-strong">Your trajectory</span> <span class="tiny-badge tiny-badge-exemplar-strong">Exemplar trajectory</span>`);
			} else {
				$$renderer.push("<!--[-1-->");
				$$renderer.push(`<span class="tiny-badge tiny-badge-neutral">Live metric</span> `);
				if (getAverageValue(store_get($$store_subs ??= {}, "$policyTargetAveragesStore", policyTargetAveragesStore), metricConfig.key) !== null) {
					$$renderer.push("<!--[0-->");
					$$renderer.push(`<span class="tiny-badge tiny-badge-neutral">Target avg</span>`);
				} else $$renderer.push("<!--[-1-->");
				$$renderer.push(`<!--]--> `);
				if (getAverageValue(store_get($$store_subs ??= {}, "$userPolicyResultStore", userPolicyResultStore)?.averages, metricConfig.key) !== null) {
					$$renderer.push("<!--[0-->");
					$$renderer.push(`<span class="tiny-badge tiny-badge-you-soft">Your avg</span>`);
				} else $$renderer.push("<!--[-1-->");
				$$renderer.push(`<!--]--> `);
				if (getAverageValue(store_get($$store_subs ??= {}, "$exemplarPolicyResultStore", exemplarPolicyResultStore)?.averages, metricConfig.key) !== null) {
					$$renderer.push("<!--[0-->");
					$$renderer.push(`<span class="tiny-badge tiny-badge-exemplar-soft">Exemplar avg</span>`);
				} else $$renderer.push("<!--[-1-->");
				$$renderer.push(`<!--]-->`);
			}
			$$renderer.push(`<!--]--></div> <p class="chart-value">`);
			if (isMonteCarloStage && latestPrimaryMetric && latestSecondaryMetric) {
				$$renderer.push("<!--[0-->");
				$$renderer.push(`Tick ${escape_html(latestPrimaryMetric.tick)}: Mean You ${escape_html(getMetricValue(latestPrimaryMetric, metricConfig.key).toFixed(3))} | Mean Exemplar ${escape_html(getMetricValue(latestSecondaryMetric, metricConfig.key).toFixed(3))}`);
			} else if (isSideBySideStage && latestPrimaryMetric && latestSecondaryMetric) {
				$$renderer.push("<!--[1-->");
				$$renderer.push(`Tick ${escape_html(latestPrimaryMetric.tick)}: You ${escape_html(getMetricValue(latestPrimaryMetric, metricConfig.key).toFixed(3))} | Exemplar ${escape_html(getMetricValue(latestSecondaryMetric, metricConfig.key).toFixed(3))}`);
			} else if (void 0 === metricConfig.key) {
				$$renderer.push("<!--[2-->");
				$$renderer.push(`Tick ${escape_html(hoveredMetric.metric.tick)}: ${escape_html(getMetricValue(hoveredMetric.metric, metricConfig.key).toFixed(3))}`);
			} else if (latestMetric) {
				$$renderer.push("<!--[3-->");
				$$renderer.push(`Tick ${escape_html(latestMetric.tick)}: ${escape_html(getMetricValue(latestMetric, metricConfig.key).toFixed(3))}`);
			} else {
				$$renderer.push("<!--[-1-->");
				$$renderer.push(`Waiting for simulation data...`);
			}
			$$renderer.push(`<!--]--></p> `);
			if (!isSideBySideStage && !isMonteCarloStage && store_get($$store_subs ??= {}, "$policyTargetAveragesStore", policyTargetAveragesStore)) {
				$$renderer.push("<!--[0-->");
				$$renderer.push(`<p class="chart-value">Target avg (25 ticks): ${escape_html(store_get($$store_subs ??= {}, "$policyTargetAveragesStore", policyTargetAveragesStore)[metricConfig.key].toFixed(3))}</p>`);
			} else $$renderer.push("<!--[-1-->");
			$$renderer.push(`<!--]--> `);
			if (!isSideBySideStage && !isMonteCarloStage && store_get($$store_subs ??= {}, "$userPolicyResultStore", userPolicyResultStore)) {
				$$renderer.push("<!--[0-->");
				$$renderer.push(`<p class="chart-value">Your policy avg: ${escape_html(store_get($$store_subs ??= {}, "$userPolicyResultStore", userPolicyResultStore).averages[metricConfig.key].toFixed(3))}</p>`);
			} else $$renderer.push("<!--[-1-->");
			$$renderer.push(`<!--]--> `);
			if (!isSideBySideStage && !isMonteCarloStage && store_get($$store_subs ??= {}, "$exemplarPolicyResultStore", exemplarPolicyResultStore)) {
				$$renderer.push("<!--[0-->");
				$$renderer.push(`<p class="chart-value">Exemplar avg: ${escape_html(store_get($$store_subs ??= {}, "$exemplarPolicyResultStore", exemplarPolicyResultStore).averages[metricConfig.key].toFixed(3))}</p>`);
			} else $$renderer.push("<!--[-1-->");
			$$renderer.push(`<!--]--> `);
			if (isSideBySideStage) {
				$$renderer.push("<!--[0-->");
				$$renderer.push(`<p class="chart-value">Blue: your policy trajectory | Orange: exemplar trajectory</p>`);
			} else $$renderer.push("<!--[-1-->");
			$$renderer.push(`<!--]--> `);
			if (isMonteCarloStage) {
				$$renderer.push("<!--[0-->");
				$$renderer.push(`<p class="chart-value">10 runs per policy. Thin lines: individual runs | Bold lines: average trajectories.</p>`);
			} else $$renderer.push("<!--[-1-->");
			$$renderer.push(`<!--]--> <p class="chart-hint">`);
			if (void 0 === metricConfig.key) {
				$$renderer.push("<!--[0-->");
				$$renderer.push(`<strong>${escape_html(hoveredLineInfo.title)}:</strong> ${escape_html(hoveredLineInfo.description)}`);
			} else if (isMonteCarloStage) {
				$$renderer.push("<!--[1-->");
				$$renderer.push(`Hover a line to see whether it is one random run or the average across runs.`);
			} else if (isSideBySideStage) {
				$$renderer.push("<!--[2-->");
				$$renderer.push(`Hover a line to see which policy trajectory it represents.`);
			} else {
				$$renderer.push("<!--[-1-->");
				$$renderer.push(`Hover solid and dashed lines to see exactly what each reference means.`);
			}
			$$renderer.push(`<!--]--></p> <svg${attr("viewBox", `0 0 ${width} ${height}`)} preserveAspectRatio="none" role="img"${attr("aria-label", `Interactive chart for ${metricConfig.title}`)}><g${attr("transform", `translate(${margin.left},${margin.top})`)}><!--[-->`);
			const each_array_1 = ensure_array_like(yScale.ticks(4));
			for (let $$index = 0, $$length = each_array_1.length; $$index < $$length; $$index++) {
				let tick = each_array_1[$$index];
				$$renderer.push(`<line x1="0"${attr("x2", innerWidth)}${attr("y1", yScale(tick))}${attr("y2", yScale(tick))} stroke="#eee"></line><text x="-5"${attr("y", yScale(tick) + 4)} text-anchor="end" font-size="10" fill="#888">${escape_html(tick.toFixed(2))}</text>`);
			}
			$$renderer.push(`<!--]-->`);
			if (isMonteCarloStage) {
				$$renderer.push("<!--[0-->");
				$$renderer.push(`<!--[-->`);
				const each_array_2 = ensure_array_like(visibleMonteCarloUserRuns);
				for (let runIndex = 0, $$length = each_array_2.length; runIndex < $$length; runIndex++) {
					let run = each_array_2[runIndex];
					$$renderer.push(`<path${attr("d", createPathData(run, metricConfig.key, xScale, yScale))} fill="none"${attr("stroke", COMPARISON_USER_COLOR)} stroke-width="1.2" stroke-linejoin="round" stroke-linecap="round" opacity="0.14"></path><path${attr("d", createPathData(run, metricConfig.key, xScale, yScale))} fill="none" stroke="transparent" stroke-width="10" role="presentation"></path>`);
				}
				$$renderer.push(`<!--]--><!--[-->`);
				const each_array_3 = ensure_array_like(visibleMonteCarloExemplarRuns);
				for (let runIndex = 0, $$length = each_array_3.length; runIndex < $$length; runIndex++) {
					let run = each_array_3[runIndex];
					$$renderer.push(`<path${attr("d", createPathData(run, metricConfig.key, xScale, yScale))} fill="none"${attr("stroke", COMPARISON_EXEMPLAR_COLOR)} stroke-width="1.2" stroke-linejoin="round" stroke-linecap="round" opacity="0.14"></path><path${attr("d", createPathData(run, metricConfig.key, xScale, yScale))} fill="none" stroke="transparent" stroke-width="10" role="presentation"></path>`);
				}
				$$renderer.push(`<!--]--><path${attr("d", primaryPath)} fill="none"${attr("stroke", COMPARISON_USER_COLOR)} stroke-width="3.4" stroke-linejoin="round" stroke-linecap="round" opacity="0.96" role="presentation"></path><path${attr("d", secondaryPath)} fill="none"${attr("stroke", COMPARISON_EXEMPLAR_COLOR)} stroke-width="3.4" stroke-linejoin="round" stroke-linecap="round" opacity="0.96" role="presentation"></path>`);
				if (latestPrimaryMetric) {
					$$renderer.push("<!--[0-->");
					$$renderer.push(`<text${attr("x", innerWidth - 2)}${attr("y", Math.max(10, yScale(getMetricValue(latestPrimaryMetric, metricConfig.key)) - 8))} text-anchor="end" class="chart-direct-label"${attr("fill", COMPARISON_USER_COLOR)}>Your mean</text>`);
				} else $$renderer.push("<!--[-1-->");
				$$renderer.push(`<!--]-->`);
				if (latestSecondaryMetric) {
					$$renderer.push("<!--[0-->");
					$$renderer.push(`<text${attr("x", innerWidth - 2)}${attr("y", Math.max(22, yScale(getMetricValue(latestSecondaryMetric, metricConfig.key)) + 14))} text-anchor="end" class="chart-direct-label"${attr("fill", COMPARISON_EXEMPLAR_COLOR)}>Exemplar mean</text>`);
				} else $$renderer.push("<!--[-1-->");
				$$renderer.push(`<!--]-->`);
				if (latestPrimaryMetric) {
					$$renderer.push("<!--[0-->");
					$$renderer.push(`<circle${attr("cx", xScale(latestPrimaryMetric.tick))}${attr("cy", yScale(getMetricValue(latestPrimaryMetric, metricConfig.key)))} r="4"${attr("fill", COMPARISON_USER_COLOR)}></circle>`);
				} else $$renderer.push("<!--[-1-->");
				$$renderer.push(`<!--]-->`);
				if (latestSecondaryMetric) {
					$$renderer.push("<!--[0-->");
					$$renderer.push(`<circle${attr("cx", xScale(latestSecondaryMetric.tick))}${attr("cy", yScale(getMetricValue(latestSecondaryMetric, metricConfig.key)))} r="4"${attr("fill", COMPARISON_EXEMPLAR_COLOR)}></circle>`);
				} else $$renderer.push("<!--[-1-->");
				$$renderer.push(`<!--]-->`);
			} else if (isSideBySideStage) {
				$$renderer.push("<!--[1-->");
				$$renderer.push(`<path${attr("d", primaryPath)} fill="none"${attr("stroke", COMPARISON_USER_COLOR)} stroke-width="3" stroke-linejoin="round" stroke-linecap="round" opacity="0.92" role="presentation"></path>`);
				if (secondaryHistory.length > 1) {
					$$renderer.push("<!--[0-->");
					$$renderer.push(`<path${attr("d", secondaryPath)} fill="none"${attr("stroke", COMPARISON_EXEMPLAR_COLOR)} stroke-width="3" stroke-linejoin="round" stroke-linecap="round" opacity="0.92" role="presentation"></path>`);
				} else $$renderer.push("<!--[-1-->");
				$$renderer.push(`<!--]-->`);
				if (latestPrimaryMetric) {
					$$renderer.push("<!--[0-->");
					$$renderer.push(`<text${attr("x", innerWidth - 2)}${attr("y", Math.max(10, yScale(getMetricValue(latestPrimaryMetric, metricConfig.key)) - 8))} text-anchor="end" class="chart-direct-label"${attr("fill", COMPARISON_USER_COLOR)}>You</text>`);
				} else $$renderer.push("<!--[-1-->");
				$$renderer.push(`<!--]-->`);
				if (latestSecondaryMetric) {
					$$renderer.push("<!--[0-->");
					$$renderer.push(`<text${attr("x", innerWidth - 2)}${attr("y", Math.max(22, yScale(getMetricValue(latestSecondaryMetric, metricConfig.key)) + 14))} text-anchor="end" class="chart-direct-label"${attr("fill", COMPARISON_EXEMPLAR_COLOR)}>Exemplar</text>`);
				} else $$renderer.push("<!--[-1-->");
				$$renderer.push(`<!--]-->`);
				if (latestPrimaryMetric) {
					$$renderer.push("<!--[0-->");
					$$renderer.push(`<circle${attr("cx", xScale(latestPrimaryMetric.tick))}${attr("cy", yScale(getMetricValue(latestPrimaryMetric, metricConfig.key)))} r="4"${attr("fill", COMPARISON_USER_COLOR)}></circle>`);
				} else $$renderer.push("<!--[-1-->");
				$$renderer.push(`<!--]-->`);
				if (latestSecondaryMetric) {
					$$renderer.push("<!--[0-->");
					$$renderer.push(`<circle${attr("cx", xScale(latestSecondaryMetric.tick))}${attr("cy", yScale(getMetricValue(latestSecondaryMetric, metricConfig.key)))} r="4"${attr("fill", COMPARISON_EXEMPLAR_COLOR)}></circle>`);
				} else $$renderer.push("<!--[-1-->");
				$$renderer.push(`<!--]-->`);
			} else {
				$$renderer.push("<!--[-1-->");
				$$renderer.push(`<path${attr("d", primaryPath)} fill="none"${attr("stroke", chartMetricsColorScale(metricConfig.key))} stroke-width="3" stroke-linejoin="round" stroke-linecap="round" role="presentation"></path>`);
				if (latestPrimaryMetric) {
					$$renderer.push("<!--[0-->");
					$$renderer.push(`<circle${attr("cx", xScale(latestPrimaryMetric.tick))}${attr("cy", yScale(getMetricValue(latestPrimaryMetric, metricConfig.key)))} r="4"${attr("fill", chartMetricsColorScale(metricConfig.key))}></circle>`);
				} else $$renderer.push("<!--[-1-->");
				$$renderer.push(`<!--]-->`);
				if (getAverageValue(store_get($$store_subs ??= {}, "$policyTargetAveragesStore", policyTargetAveragesStore), metricConfig.key) !== null) {
					$$renderer.push("<!--[0-->");
					const targetValue = getAverageValue(store_get($$store_subs ??= {}, "$policyTargetAveragesStore", policyTargetAveragesStore), metricConfig.key);
					$$renderer.push(`<line x1="0"${attr("x2", innerWidth)}${attr("y1", yScale(targetValue))}${attr("y2", yScale(targetValue))} stroke="#6b7280" stroke-dasharray="8 4" stroke-width="1.5" opacity="0.9" role="presentation"></line>`);
				} else $$renderer.push("<!--[-1-->");
				$$renderer.push(`<!--]-->`);
				if (getAverageValue(store_get($$store_subs ??= {}, "$userPolicyResultStore", userPolicyResultStore)?.averages, metricConfig.key) !== null) {
					$$renderer.push("<!--[0-->");
					const userValue = getAverageValue(store_get($$store_subs ??= {}, "$userPolicyResultStore", userPolicyResultStore)?.averages, metricConfig.key);
					$$renderer.push(`<line x1="0"${attr("x2", innerWidth)}${attr("y1", yScale(userValue))}${attr("y2", yScale(userValue))} stroke="#0f766e" stroke-dasharray="4 4" stroke-width="1.5" opacity="0.9" role="presentation"></line>`);
				} else $$renderer.push("<!--[-1-->");
				$$renderer.push(`<!--]-->`);
				if (getAverageValue(store_get($$store_subs ??= {}, "$exemplarPolicyResultStore", exemplarPolicyResultStore)?.averages, metricConfig.key) !== null) {
					$$renderer.push("<!--[0-->");
					const exemplarValue = getAverageValue(store_get($$store_subs ??= {}, "$exemplarPolicyResultStore", exemplarPolicyResultStore)?.averages, metricConfig.key);
					$$renderer.push(`<line x1="0"${attr("x2", innerWidth)}${attr("y1", yScale(exemplarValue))}${attr("y2", yScale(exemplarValue))} stroke="#7c3aed" stroke-dasharray="2 3" stroke-width="1.5" opacity="0.9" role="presentation"></line>`);
				} else $$renderer.push("<!--[-1-->");
				$$renderer.push(`<!--]-->`);
			}
			$$renderer.push(`<!--]-->`);
			if (void 0 === metricConfig.key) {
				$$renderer.push("<!--[0-->");
				const hoveredValue = getMetricValue(hoveredMetric.metric, metricConfig.key);
				$$renderer.push(`<line${attr("x1", xScale(hoveredMetric.metric.tick))}${attr("x2", xScale(hoveredMetric.metric.tick))} y1="0"${attr("y2", innerHeight)}${attr("stroke", isMonteCarloStage ? COMPARISON_USER_COLOR : chartMetricsColorScale(metricConfig.key))} stroke-dasharray="4 4" stroke-width="1.5" opacity="0.45"></line><circle${attr("cx", xScale(hoveredMetric.metric.tick))}${attr("cy", yScale(hoveredValue))} r="5"${attr("fill", isMonteCarloStage ? COMPARISON_USER_COLOR : chartMetricsColorScale(metricConfig.key))} stroke="white" stroke-width="2"></circle>`);
			} else $$renderer.push("<!--[-1-->");
			$$renderer.push(`<!--]--></g></svg></div>`);
		}
		$$renderer.push(`<!--]--></div>`);
		if ($$store_subs) unsubscribe_stores($$store_subs);
	});
}
//#endregion
//#region src/components/layout/Sidebar.svelte
function Sidebar($$renderer, $$props) {
	let showCharts = fallback($$props["showCharts"], true);
	$$renderer.push(`<aside class="sidebar"><div class="panel narrative-panel">`);
	Storyboard($$renderer, {});
	$$renderer.push(`<!----></div> `);
	if (showCharts) {
		$$renderer.push("<!--[0-->");
		$$renderer.push(`<div class="panel charts-panel">`);
		LiveCharts($$renderer, {});
		$$renderer.push(`<!----></div>`);
	} else $$renderer.push("<!--[-1-->");
	$$renderer.push(`<!--]--></aside>`);
	bind_props($$props, { showCharts });
}
//#endregion
//#region src/components/grid/AgentVisual.svelte
function AgentVisual($$renderer, $$props) {
	$$renderer.component(($$renderer) => {
		var $$store_subs;
		let isHappy, tx, ty, isWiggling, species, mood, agentImagePath, utilityWidth, barX;
		let agent = $$props["agent"];
		let cellSize = $$props["cellSize"];
		let boardWidth = $$props["boardWidth"];
		let boardHeight = $$props["boardHeight"];
		let hoveredVenueStore = $$props["hoveredVenueStore"];
		let ghostReaction = fallback($$props["ghostReaction"], void 0);
		let isDraggable = fallback($$props["isDraggable"], false);
		let showProtagonistBadge = fallback($$props["showProtagonistBadge"], false);
		const barMaxWidth = cellSize * .7;
		$: isHappy = ghostReaction ? ghostReaction.hypotheticalHappiness : agent.isHappy;
		$: tx = agent.x * cellSize + cellSize / 2;
		$: ty = agent.y * cellSize + cellSize / 2;
		$: isWiggling = store_get($$store_subs ??= {}, "$hoveredVenueStore", hoveredVenueStore) !== null && store_get($$store_subs ??= {}, "$hoveredVenueStore", hoveredVenueStore) === agent.currentVenueId;
		$: species = agent.color === "red" ? "cat" : "dog";
		$: mood = isHappy ? "happy" : "sad";
		$: agentImagePath = `/images/cat/${species}-${mood}.svg`;
		$: utilityWidth = agent.utility * barMaxWidth;
		$: barX = -(barMaxWidth / 2);
		$$renderer.push(`<g${attr("transform", `translate(${stringify(tx)},${stringify(ty)})`)}${attr_class("agent", void 0, { "draggable": isDraggable })}><g${attr_class("agent-body", void 0, { "wiggle": isWiggling })}><circle cx="0" cy="0"${attr("r", cellSize * .42)} fill="transparent" pointer-events="all"></circle><g class="utility-bar-group"><rect${attr("x", barX)}${attr("y", -cellSize * .45)}${attr("width", barMaxWidth)} height="5" fill="#e0e0e0" rx="2.5"></rect><rect${attr("x", barX)}${attr("y", -cellSize * .45)}${attr("width", utilityWidth)} height="5"${attr("fill", agent.color)} rx="2.5"></rect></g>`);
		if (store_get($$store_subs ??= {}, "$visualizationStyleStore", visualizationStyleStore) === "cats-and-dogs") {
			$$renderer.push("<!--[0-->");
			$$renderer.push(`<image${attr("href", agentImagePath)}${attr("x", -cellSize * .42)}${attr("y", -cellSize * .42)}${attr("width", cellSize * .84)}${attr("height", cellSize * .84)} preserveAspectRatio="xMidYMid meet" class="entity-svg"></image>`);
		} else {
			$$renderer.push("<!--[-1-->");
			$$renderer.push(`<circle cx="0" cy="0"${attr("r", cellSize * .35)}${attr("fill", agent.color)}${attr("stroke", isHappy ? "#111" : "#fff")}${attr("stroke-width", isHappy ? 0 : 2)}${attr("stroke-dasharray", isHappy ? "none" : "4 2")}></circle><text x="0" y="6" text-anchor="middle" font-size="18" pointer-events="none" class="emoji">${escape_html(isHappy ? "🙂" : "☹️")}</text>`);
		}
		$$renderer.push(`<!--]-->`);
		if (showProtagonistBadge) {
			$$renderer.push("<!--[0-->");
			$$renderer.push(`<text x="0" y="-16" text-anchor="middle" font-size="16" pointer-events="none" class="emoji">⭐</text>`);
		} else $$renderer.push("<!--[-1-->");
		$$renderer.push(`<!--]--></g></g>`);
		if ($$store_subs) unsubscribe_stores($$store_subs);
		bind_props($$props, {
			agent,
			cellSize,
			boardWidth,
			boardHeight,
			hoveredVenueStore,
			ghostReaction,
			isDraggable,
			showProtagonistBadge
		});
	});
}
//#endregion
//#region src/components/grid/VenueVisual.svelte
function VenueVisual($$renderer, $$props) {
	$$renderer.component(($$renderer) => {
		var $$store_subs;
		let tx, ty, species, venueImagePath, isHovered;
		let venue = $$props["venue"];
		let cellSize = $$props["cellSize"];
		let boardWidth = $$props["boardWidth"];
		let boardHeight = $$props["boardHeight"];
		let hoveredVenueStore = $$props["hoveredVenueStore"];
		let isDraggable = fallback($$props["isDraggable"], false);
		let onPreviewMove = fallback($$props["onPreviewMove"], () => simulationActions.previewVenueMove, true);
		let onCommitMove = fallback($$props["onCommitMove"], () => simulationActions.commitVenueMove, true);
		const size = cellSize - 16;
		$: tx = venue.x * cellSize + 8;
		$: ty = venue.y * cellSize + 8;
		$: species = venue.color === "red" ? "cat" : "dog";
		$: venueImagePath = `/images/cat/${species}-venue.svg`;
		$: isHovered = store_get($$store_subs ??= {}, "$hoveredVenueStore", hoveredVenueStore) === venue.id;
		$$renderer.push(`<g${attr("transform", `translate(${stringify(tx)},${stringify(ty)})`)}${attr_class("venue", void 0, {
			"draggable": isDraggable,
			"hovered": isHovered
		})} role="button" tabindex="0"${attr("aria-label", `Venue ${stringify(venue.id)}`)}>`);
		if (store_get($$store_subs ??= {}, "$visualizationStyleStore", visualizationStyleStore) === "cats-and-dogs") {
			$$renderer.push("<!--[0-->");
			$$renderer.push(`<rect x="0" y="0"${attr("width", size)}${attr("height", size)} fill="transparent" pointer-events="all"></rect><rect x="0" y="0"${attr("width", size)}${attr("height", size)}${attr("fill", venue.color)} rx="8" opacity="0.15" stroke="#1f2937" stroke-width="0"></rect><image${attr("href", venueImagePath)}${attr("x", 0)}${attr("y", 0)}${attr("width", size)}${attr("height", size)} preserveAspectRatio="xMidYMid meet" class="entity-svg"></image>`);
		} else {
			$$renderer.push("<!--[-1-->");
			$$renderer.push(`<rect x="0" y="0"${attr("width", size)}${attr("height", size)}${attr("fill", venue.color)} rx="8" opacity="0.8" stroke="#1f2937" stroke-width="0"></rect><text${attr("x", size / 2)}${attr("y", size / 2 + 2)} text-anchor="middle" dominant-baseline="central"${attr("font-size", `${stringify(size * .8)}px`)} class="emoji">🏛️</text>`);
		}
		$$renderer.push(`<!--]--></g>`);
		if ($$store_subs) unsubscribe_stores($$store_subs);
		bind_props($$props, {
			venue,
			cellSize,
			boardWidth,
			boardHeight,
			hoveredVenueStore,
			isDraggable,
			onPreviewMove,
			onCommitMove
		});
	});
}
//#endregion
//#region src/components/grid/GridWorld.svelte
function GridWorld($$renderer, $$props) {
	$$renderer.component(($$renderer) => {
		var $$store_subs;
		let width, height, svgWidth, svgHeight, bgCells;
		let agentsStore = $$props["agentsStore"];
		let venuesStore = $$props["venuesStore"];
		let ghostReactionsStore = $$props["ghostReactionsStore"];
		let hoveredVenueStore = fallback($$props["hoveredVenueStore"], hoveredVenueId);
		let allowInteractions = fallback($$props["allowInteractions"], true);
		let compactMode = fallback($$props["compactMode"], false);
		let previewVenueMove = fallback($$props["previewVenueMove"], () => simulationActions.previewVenueMove, true);
		let commitVenueMove = fallback($$props["commitVenueMove"], () => simulationActions.commitVenueMove, true);
		let cellSize = 45;
		onDestroy(() => {});
		$: width = store_get($$store_subs ??= {}, "$worldParametersStore", worldParametersStore).width;
		$: height = store_get($$store_subs ??= {}, "$worldParametersStore", worldParametersStore).height;
		$: svgWidth = width * cellSize;
		$: svgHeight = height * cellSize;
		$: bgCells = (() => {
			const nextCells = [];
			for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) nextCells.push({
				x,
				y
			});
			return nextCells;
		})();
		$$renderer.push(`<svg${attr("viewBox", `0 0 ${svgWidth} ${svgHeight}`)} preserveAspectRatio="xMidYMid meet" class="board"><g class="layer-grid"><!--[-->`);
		const each_array = ensure_array_like(bgCells);
		for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
			let cell = each_array[$$index];
			$$renderer.push(`<rect${attr("x", cell.x * cellSize)}${attr("y", cell.y * cellSize)}${attr("width", cellSize)}${attr("height", cellSize)} class="grid-cell"></rect>`);
		}
		$$renderer.push(`<!--]--></g><g class="layer-venues"><!--[-->`);
		const each_array_1 = ensure_array_like(store_get($$store_subs ??= {}, "$venuesStore", venuesStore));
		for (let $$index_1 = 0, $$length = each_array_1.length; $$index_1 < $$length; $$index_1++) {
			let venue = each_array_1[$$index_1];
			VenueVisual($$renderer, {
				venue,
				cellSize,
				boardWidth: width,
				boardHeight: height,
				hoveredVenueStore,
				isDraggable: allowInteractions && store_get($$store_subs ??= {}, "$currentChapterIndex", currentChapterIndex) >= 5,
				onPreviewMove: previewVenueMove,
				onCommitMove: commitVenueMove
			});
		}
		$$renderer.push(`<!--]--></g><g class="layer-agents"><!--[-->`);
		const each_array_2 = ensure_array_like(store_get($$store_subs ??= {}, "$agentsStore", agentsStore));
		for (let $$index_2 = 0, $$length = each_array_2.length; $$index_2 < $$length; $$index_2++) {
			let agent = each_array_2[$$index_2];
			AgentVisual($$renderer, {
				agent,
				cellSize,
				boardWidth: width,
				boardHeight: height,
				hoveredVenueStore,
				ghostReaction: store_get($$store_subs ??= {}, "$ghostReactionsStore", ghostReactionsStore).find((r) => r.id === agent.id),
				isDraggable: allowInteractions && store_get($$store_subs ??= {}, "$currentChapterIndex", currentChapterIndex) <= 3,
				showProtagonistBadge: store_get($$store_subs ??= {}, "$currentChapterIndex", currentChapterIndex) <= 1 && agent.id === "agent_protagonist"
			});
		}
		$$renderer.push(`<!--]--></g></svg>`);
		if ($$store_subs) unsubscribe_stores($$store_subs);
		bind_props($$props, {
			agentsStore,
			venuesStore,
			ghostReactionsStore,
			hoveredVenueStore,
			allowInteractions,
			compactMode,
			previewVenueMove,
			commitVenueMove
		});
	});
}
//#endregion
//#region src/routes/+page.svelte
function _page($$renderer, $$props) {
	$$renderer.component(($$renderer) => {
		var $$store_subs;
		$: {
			store_get($$store_subs ??= {}, "$worldParametersStore", worldParametersStore).width;
			store_get($$store_subs ??= {}, "$worldParametersStore", worldParametersStore).height;
			store_get($$store_subs ??= {}, "$worldParametersStore", worldParametersStore).density;
			store_get($$store_subs ??= {}, "$worldParametersStore", worldParametersStore).similarityThreshold;
			store_get($$store_subs ??= {}, "$worldParametersStore", worldParametersStore).venueRadius;
			store_get($$store_subs ??= {}, "$worldParametersStore", worldParametersStore).venueCapacity;
			store_get($$store_subs ??= {}, "$visualizationStyleStore", visualizationStyleStore);
		}
		$$renderer.push(`<main class="exhibit-container"><header class="exhibit-header"><div class="exhibit-header-grid"><div><h1><button type="button" class="secret-trigger-title" aria-label="Segregation Dynamics: An Agent-Based Model">Segregation Dynamics: An Agent-Based Model</button></h1> <p class="subtitle">An interactive exploranation of how local choices shape global patterns.</p></div> <div class="chapter-progress" role="navigation" aria-label="Chapter progression"><div class="chapter-progress-top"><span class="chapter-progress-label">Chapter ${escape_html(store_get($$store_subs ??= {}, "$currentChapterIndex", currentChapterIndex) + 1)} of ${escape_html(chapters.length)}</span> <div class="chapter-progress-actions"><button type="button" class="chapter-nav-btn"${attr("disabled", store_get($$store_subs ??= {}, "$currentChapterIndex", currentChapterIndex) === 0, true)} aria-label="Go to previous chapter">Previous</button> <button type="button" class="chapter-nav-btn"${attr("disabled", store_get($$store_subs ??= {}, "$currentChapterIndex", currentChapterIndex) === chapters.length - 1, true)} aria-label="Go to next chapter">Next</button></div></div> <div class="chapter-stepper" aria-label="Chapter selection"><!--[-->`);
		const each_array = ensure_array_like(chapters);
		for (let chapterIndex = 0, $$length = each_array.length; chapterIndex < $$length; chapterIndex++) {
			let chapter = each_array[chapterIndex];
			$$renderer.push(`<button type="button"${attr_class("chapter-step", void 0, {
				"is-complete": chapterIndex < store_get($$store_subs ??= {}, "$currentChapterIndex", currentChapterIndex),
				"is-active": chapterIndex === store_get($$store_subs ??= {}, "$currentChapterIndex", currentChapterIndex)
			})}${attr("aria-current", chapterIndex === store_get($$store_subs ??= {}, "$currentChapterIndex", currentChapterIndex) ? "step" : void 0)}${attr("aria-label", `Go to chapter ${chapterIndex + 1}: ${chapter.title}`)}${attr("title", `Chapter ${chapterIndex + 1}: ${chapter.title}`)}>${escape_html(chapterIndex + 1)}</button>`);
		}
		$$renderer.push(`<!--]--></div> <p class="chapter-progress-title">${escape_html(store_get($$store_subs ??= {}, "$currentChapter", currentChapter).title)}</p></div></div></header> `);
		$$renderer.push("<!--[-1-->");
		$$renderer.push(`<div class="exhibit-content"><section${attr_class("simulation-canvas", void 0, { "chapter11-layout": store_get($$store_subs ??= {}, "$currentChapterIndex", currentChapterIndex) === 11 })}><div class="simulation-controls"><button class="simulation-toggle"${attr("disabled", store_get($$store_subs ??= {}, "$isGeneratingVenuesStore", isGeneratingVenuesStore), true)}${attr("aria-label", store_get($$store_subs ??= {}, "$isPlayingStore", isPlayingStore) ? "Pause simulation" : "Play simulation")}><span class="control-icon" aria-hidden="true">${escape_html(store_get($$store_subs ??= {}, "$isPlayingStore", isPlayingStore) ? "❚❚" : "▶")}</span> <span>${escape_html(store_get($$store_subs ??= {}, "$isPlayingStore", isPlayingStore) ? "Pause" : "Play")} simulation</span></button></div> `);
		if (store_get($$store_subs ??= {}, "$currentChapterIndex", currentChapterIndex) >= 10) {
			$$renderer.push("<!--[0-->");
			$$renderer.push(`<div class="grid-compare-layout"><div class="grid-wrapper compare-grid-panel"><h3 class="compare-grid-title">Your Policy <span class="tiny-badge tiny-badge-you-strong">You</span></h3> `);
			GridWorld($$renderer, {
				agentsStore: compareUserAgentsStore,
				venuesStore: compareUserVenuesStore,
				ghostReactionsStore: compareUserGhostReactionsStore,
				hoveredVenueStore: compareUserHoveredVenueIdStore,
				allowInteractions: store_get($$store_subs ??= {}, "$currentChapterIndex", currentChapterIndex) === 11,
				compactMode: true,
				previewVenueMove: simulationActions.previewCompareUserVenueMove,
				commitVenueMove: simulationActions.commitCompareUserVenueMove
			});
			$$renderer.push(`<!----></div> <div class="grid-wrapper compare-grid-panel"><h3 class="compare-grid-title">Exemplar Policy <span class="tiny-badge tiny-badge-exemplar-strong">Exemplar</span></h3> `);
			GridWorld($$renderer, {
				agentsStore: compareExemplarAgentsStore,
				venuesStore: compareExemplarVenuesStore,
				ghostReactionsStore: compareExemplarGhostReactionsStore,
				hoveredVenueStore: compareExemplarHoveredVenueIdStore,
				allowInteractions: false,
				compactMode: true
			});
			$$renderer.push(`<!----></div></div>`);
		} else {
			$$renderer.push("<!--[-1-->");
			$$renderer.push(`<div class="grid-wrapper">`);
			GridWorld($$renderer, {
				agentsStore,
				venuesStore,
				ghostReactionsStore,
				hoveredVenueStore: hoveredVenueId
			});
			$$renderer.push(`<!----></div>`);
		}
		$$renderer.push(`<!--]--> `);
		if (store_get($$store_subs ??= {}, "$currentChapterIndex", currentChapterIndex) === 11) {
			$$renderer.push("<!--[0-->");
			$$renderer.push(`<div class="panel chapter11-charts-panel">`);
			LiveCharts($$renderer, {});
			$$renderer.push(`<!----></div>`);
		} else $$renderer.push("<!--[-1-->");
		$$renderer.push(`<!--]--></section> `);
		Sidebar($$renderer, { showCharts: store_get($$store_subs ??= {}, "$currentChapterIndex", currentChapterIndex) !== 11 });
		$$renderer.push(`<!----></div>`);
		$$renderer.push(`<!--]--></main>`);
		if ($$store_subs) unsubscribe_stores($$store_subs);
	});
}
//#endregion
export { _page as default };
