import { C as escape_html, D as writable, S as attr, T as derived, c as stringify, i as ensure_array_like, l as unsubscribe_stores, n as bind_props, s as store_get, st as fallback, t as attr_class } from "../../chunks/server.js";
import "../../chunks/index-server.js";
import * as d3 from "d3";
//#region src/stores/narrativeStore.ts
var chaptersData = [
	{
		id: 0,
		title: "Exploration: Baseline Logic",
		content: "Agents want to live near similar neighbors. Drag an agent to a different cell. Notice how the surrounding agents react instantly to their new neighbor.",
		actionLabel: "Next: Massive Moves"
	},
	{
		id: 1,
		title: "Massive Moves 1",
		content: "At each tick, the 10% least happy agents will randomly move around until they are happy. Let's watch the macroscopic patterns emerge.",
		actionLabel: "Run Simulation",
		dispatchAction: "PLAY_SIMULATION"
	},
	{
		id: 2,
		title: "Outcomes 1",
		content: "Notice the macro consequences of individual preferences. Look at the graphs: Segregation (clustering and dissimilarity) has naturally increased.",
		actionLabel: "Start Tutorial 2: Venues"
	},
	{
		id: 3,
		title: "Venue Generation",
		content: "Agents now need venues in addition to similar neighbors. We will generate color-exclusive venues using Voronoi Relaxation to cover the emerged neighborhoods.",
		actionLabel: "Generate Venues",
		dispatchAction: "GENERATE_VENUES"
	},
	{
		id: 4,
		title: "Exploration: Venue Impact",
		content: "Venues have a catchment area. Drag a venue into different cells. The agents won't move, but they will show if they are happy or not based on the new venue location.",
		actionLabel: "Next: Massive Moves 2"
	},
	{
		id: 5,
		title: "Massive Moves & Outcomes 2",
		content: "Let's run the simulation again. Observe how the introduction of venues changes the previously segregated environment.",
		actionLabel: "Run Simulation",
		dispatchAction: "PLAY_SIMULATION"
	}
];
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
//#region src/engine/SimulationEngine.ts
var SimulationEngine = class {
	width;
	height;
	density;
	similarityThreshold;
	venueBoost;
	grid;
	agents;
	venues;
	tickCount;
	constructor(config = {}) {
		this.width = config.width ?? 15;
		this.height = config.height ?? 15;
		this.density = config.density ?? .7;
		this.similarityThreshold = config.similarityThreshold ?? .5;
		this.venueBoost = config.venueBoost ?? .2;
		this.grid = [];
		this.agents = /* @__PURE__ */ new Map();
		this.venues = /* @__PURE__ */ new Map();
		this.tickCount = 0;
	}
	init() {
		this.grid = Array.from({ length: this.height }, () => Array(this.width).fill(null));
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
				const color = Math.random() > .5 ? "red" : "green";
				const agentId = `a_${idCounter++}`;
				const newAgent = {
					id: agentId,
					x,
					y,
					color,
					isHappy: false,
					utility: 0
				};
				this.grid[y][x] = agentId;
				this.agents.set(agentId, newAgent);
				placed++;
			}
		}
		this.updateAllUtilities();
	}
	isWithinBounds(x, y) {
		return x >= 0 && x < this.width && y >= 0 && y < this.height;
	}
	isCellEmpty(x, y) {
		return this.isWithinBounds(x, y) && this.grid[y][x] === null;
	}
	findNearestEmptyCell(preferredX, preferredY) {
		if (this.isCellEmpty(preferredX, preferredY)) return {
			x: preferredX,
			y: preferredY
		};
		const maxRadius = Math.max(this.width, this.height);
		for (let radius = 1; radius <= maxRadius; radius++) for (let y = preferredY - radius; y <= preferredY + radius; y++) for (let x = preferredX - radius; x <= preferredX + radius; x++) if (Math.max(Math.abs(x - preferredX), Math.abs(y - preferredY)) === radius && this.isCellEmpty(x, y)) return {
			x,
			y
		};
		return null;
	}
	findRandomEmptyCell(excludeX, excludeY) {
		const emptyCells = [];
		for (let y = 0; y < this.height; y++) for (let x = 0; x < this.width; x++) if (!(excludeX === x && excludeY === y) && this.grid[y][x] === null) emptyCells.push({
			x,
			y
		});
		if (emptyCells.length === 0) return null;
		return emptyCells[Math.floor(Math.random() * emptyCells.length)];
	}
	/**
	* Calculates the raw numerical utility score for an agent at a given location.
	* Score = (Neighborhood Similarity Proportion) + (Venue Proximity Boost)
	*/
	calculateUtilityScore(color, x, y, ignoreId = null) {
		let sameColor = 0;
		let totalNeighbors = 0;
		let nearMatchingVenue = false;
		for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
			if (dx === 0 && dy === 0) continue;
			const nx = x + dx;
			const ny = y + dy;
			if (nx >= 0 && nx < this.width && ny >= 0 && ny < this.height) {
				const occupantId = this.grid[ny][nx];
				if (occupantId && occupantId !== ignoreId) {
					if (occupantId.startsWith("a_")) {
						const neighbor = this.agents.get(occupantId);
						if (neighbor) {
							totalNeighbors++;
							if (neighbor.color === color) sameColor++;
						}
					} else if (occupantId.startsWith("v_")) {
						const venue = this.venues.get(occupantId);
						if (venue && venue.color === color) nearMatchingVenue = true;
					}
				}
			}
		}
		let totalUtility = totalNeighbors === 0 ? 1 : sameColor / totalNeighbors;
		if (nearMatchingVenue) totalUtility += this.venueBoost;
		const epsilon = (Math.random() - .5) * 1e-6;
		return totalUtility + epsilon;
	}
	updateAllUtilities() {
		for (const [id, agent] of this.agents) {
			const newScore = this.calculateUtilityScore(agent.color, agent.x, agent.y);
			agent.utility = newScore;
			agent.isHappy = newScore >= this.similarityThreshold;
		}
	}
	previewLocalReactions(draggedColor, draggedId, hoverX, hoverY) {
		if (!this.isWithinBounds(hoverX, hoverY)) return [];
		const hoveredOccupant = this.grid[hoverY][hoverX];
		if (hoveredOccupant !== null && hoveredOccupant !== draggedId) return [];
		const reactions = [];
		for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
			if (dx === 0 && dy === 0) continue;
			const nx = hoverX + dx;
			const ny = hoverY + dy;
			if (nx >= 0 && nx < this.width && ny >= 0 && ny < this.height) {
				const neighborId = this.grid[ny][nx];
				if (neighborId && neighborId.startsWith("a_") && neighborId !== draggedId) {
					const neighbor = this.agents.get(neighborId);
					if (neighbor) {
						const originalOccupant = this.grid[hoverY][hoverX];
						this.grid[hoverY][hoverX] = draggedId;
						const hypotheticalHappiness = this.calculateUtilityScore(neighbor.color, neighbor.x, neighbor.y) >= this.similarityThreshold;
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
		return reactions;
	}
	moveAgent(id, targetX, targetY) {
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
	placeVenue(id, preferredX, preferredY, color) {
		const existingVenue = this.venues.get(id);
		if (existingVenue) this.grid[existingVenue.y][existingVenue.x] = null;
		const targetCell = this.findNearestEmptyCell(preferredX, preferredY);
		if (!targetCell) {
			if (existingVenue) this.grid[existingVenue.y][existingVenue.x] = existingVenue.id;
			return null;
		}
		const venue = {
			id,
			x: targetCell.x,
			y: targetCell.y,
			color
		};
		this.venues.set(id, venue);
		this.grid[targetCell.y][targetCell.x] = id;
		return venue;
	}
	previewVenueReactions(venueId, hoverX, hoverY) {
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
		const reactions = [];
		for (const agent of this.agents.values()) {
			const hypotheticalHappiness = this.calculateUtilityScore(agent.color, agent.x, agent.y) >= this.similarityThreshold;
			if (hypotheticalHappiness !== agent.isHappy) reactions.push({
				id: agent.id,
				originalHappiness: agent.isHappy,
				hypotheticalHappiness
			});
		}
		this.grid[hoverY][hoverX] = originalTargetOccupant;
		this.grid[originalY][originalX] = venueId;
		venue.x = originalX;
		venue.y = originalY;
		return reactions;
	}
	moveVenue(id, targetX, targetY) {
		const venue = this.venues.get(id);
		if (!venue) return false;
		if (!this.isWithinBounds(targetX, targetY)) return false;
		if (venue.x === targetX && venue.y === targetY) return true;
		const targetOccupant = this.grid[targetY][targetX];
		if (targetOccupant !== null && targetOccupant !== id) {
			if (!targetOccupant.startsWith("a_")) return false;
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
		const emptyCells = [];
		for (let y = 0; y < this.height; y++) for (let x = 0; x < this.width; x++) if (this.grid[y][x] === null) emptyCells.push({
			x,
			y
		});
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
	/**
	* Generates venues using Lloyd's Algorithm (K-Medoids Voronoi Relaxation).
	* @param capacityPerVenue How many agents a single venue should serve (determines K)
	*/
	generateVenuesLloyds(capacityPerVenue = 20) {
		for (const venue of this.venues.values()) if (this.isWithinBounds(venue.x, venue.y) && this.grid[venue.y][venue.x] === venue.id) this.grid[venue.y][venue.x] = null;
		this.venues.clear();
		const activeColors = ["red", "green"];
		let venueIdCounter = 0;
		activeColors.forEach((color) => {
			const targetFamilies = Array.from(this.agents.values()).filter((a) => a.color === color);
			if (targetFamilies.length === 0) return;
			const k = Math.max(1, Math.ceil(targetFamilies.length / capacityPerVenue));
			const trackers = [...targetFamilies].sort(() => .5 - Math.random()).slice(0, Math.min(k, targetFamilies.length)).map((seed, index) => ({
				id: `tracker_${color}_${index}`,
				x: seed.x,
				y: seed.y
			}));
			const iterations = 5;
			for (let i = 0; i < iterations; i++) {
				const clusters = /* @__PURE__ */ new Map();
				trackers.forEach((t) => clusters.set(t.id, []));
				targetFamilies.forEach((agent) => {
					let nearestTracker = trackers[0];
					let minDist = Infinity;
					trackers.forEach((t) => {
						const dist = Math.sqrt(Math.pow(agent.x - t.x, 2) + Math.pow(agent.y - t.y, 2));
						if (dist < minDist) {
							minDist = dist;
							nearestTracker = t;
						}
					});
					clusters.get(nearestTracker.id).push(agent);
				});
				trackers.forEach((t) => {
					const cluster = clusters.get(t.id);
					if (cluster.length > 0) {
						let bestMedoid = cluster[0];
						let minTotalDist = Infinity;
						cluster.forEach((candidate) => {
							let totalDist = 0;
							cluster.forEach((member) => {
								totalDist += Math.sqrt(Math.pow(candidate.x - member.x, 2) + Math.pow(candidate.y - member.y, 2));
							});
							if (totalDist < minTotalDist) {
								minTotalDist = totalDist;
								bestMedoid = candidate;
							}
						});
						t.x = bestMedoid.x;
						t.y = bestMedoid.y;
					}
				});
			}
			trackers.forEach((t) => {
				const vId = `v_${venueIdCounter++}`;
				this.placeVenue(vId, t.x, t.y, color);
			});
		});
		this.updateAllUtilities();
	}
	getMetrics() {
		return calculateMetrics(this.agents, this.width, this.height, this.tickCount);
	}
};
//#endregion
//#region src/stores/simulationStore.ts
var engine = new SimulationEngine({
	width: 15,
	height: 15,
	density: .8,
	similarityThreshold: .5,
	venueBoost: .2
});
engine.init();
var agentsStore = writable(Array.from(engine.agents.values()));
var venuesStore = writable(Array.from(engine.venues.values()));
writable(engine.tickCount);
var metricsHistoryStore = writable([engine.getMetrics()]);
var ghostReactionsStore = writable([]);
var isPlayingStore = writable(false);
//#endregion
//#region src/components/narrative/Storyboard.svelte
function Storyboard($$renderer, $$props) {
	$$renderer.component(($$renderer) => {
		var $$store_subs;
		$$renderer.push(`<div class="storyboard"><h2>${escape_html(store_get($$store_subs ??= {}, "$currentChapter", currentChapter).title)}</h2> <p class="content">${escape_html(store_get($$store_subs ??= {}, "$currentChapter", currentChapter).content)}</p> <div class="actions svelte-1q3wass"><button class="btn-primary">${escape_html(store_get($$store_subs ??= {}, "$currentChapter", currentChapter).actionLabel)}</button> <button class="btn-secondary svelte-1q3wass">${escape_html(store_get($$store_subs ??= {}, "$isPlayingStore", isPlayingStore) ? "Pause" : "Continue")}</button></div></div>`);
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
		const width = 300;
		const height = 200;
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
		function createXScale(history) {
			return d3.scaleLinear().domain([0, d3.max(history, (metric) => metric.tick) || 10]).range([0, innerWidth]);
		}
		function createYScale(history, metricKey) {
			const maxValue = d3.max(history, (metric) => metric[metricKey]) || 0;
			return d3.scaleLinear().domain([0, Math.max(1, maxValue)]).range([innerHeight, 0]);
		}
		function createPathData(history, metricKey) {
			const xScale = createXScale(history);
			const yScale = createYScale(history, metricKey);
			return d3.line().x((metric) => xScale(metric.tick)).y((metric) => yScale(metric[metricKey])).curve(d3.curveMonotoneX)(history) || "";
		}
		function getMetricValue(metric, metricKey) {
			return metric[metricKey];
		}
		$: metricsHistory = store_get($$store_subs ??= {}, "$metricsHistoryStore", metricsHistoryStore);
		$: latestMetric = metricsHistory.at(-1);
		$$renderer.push(`<div class="charts-stack svelte-5aitah"><!--[-->`);
		const each_array = ensure_array_like(metricConfigs);
		for (let $$index_1 = 0, $$length = each_array.length; $$index_1 < $$length; $$index_1++) {
			let metricConfig = each_array[$$index_1];
			const xScale = createXScale(metricsHistory);
			const yScale = createYScale(metricsHistory, metricConfig.key);
			const pathData = createPathData(metricsHistory, metricConfig.key);
			$$renderer.push(`<div class="chart-container svelte-5aitah"><h3 class="svelte-5aitah">${escape_html(metricConfig.title)}</h3> <p class="chart-value svelte-5aitah">`);
			if (latestMetric) {
				$$renderer.push("<!--[0-->");
				$$renderer.push(`Tick ${escape_html(latestMetric.tick)}: ${escape_html(getMetricValue(latestMetric, metricConfig.key).toFixed(3))}`);
			} else {
				$$renderer.push("<!--[-1-->");
				$$renderer.push(`Waiting for simulation data...`);
			}
			$$renderer.push(`<!--]--></p> <svg${attr("width", width)}${attr("height", height)}><g${attr("transform", `translate(${margin.left},${margin.top})`)}><!--[-->`);
			const each_array_1 = ensure_array_like(yScale.ticks(4));
			for (let $$index = 0, $$length = each_array_1.length; $$index < $$length; $$index++) {
				let tick = each_array_1[$$index];
				$$renderer.push(`<line x1="0"${attr("x2", innerWidth)}${attr("y1", yScale(tick))}${attr("y2", yScale(tick))} stroke="#eee"></line><text x="-5"${attr("y", yScale(tick) + 4)} text-anchor="end" font-size="10" fill="#888">${escape_html(tick.toFixed(2))}</text>`);
			}
			$$renderer.push(`<!--]--><path${attr("d", pathData)} fill="none"${attr("stroke", chartMetricsColorScale(metricConfig.key))} stroke-width="3" stroke-linejoin="round" stroke-linecap="round" class="svelte-5aitah"></path>`);
			if (latestMetric) {
				$$renderer.push("<!--[0-->");
				$$renderer.push(`<circle${attr("cx", xScale(latestMetric.tick))}${attr("cy", yScale(getMetricValue(latestMetric, metricConfig.key)))} r="4"${attr("fill", chartMetricsColorScale(metricConfig.key))}></circle>`);
			} else $$renderer.push("<!--[-1-->");
			$$renderer.push(`<!--]--></g></svg></div>`);
		}
		$$renderer.push(`<!--]--></div>`);
		if ($$store_subs) unsubscribe_stores($$store_subs);
	});
}
//#endregion
//#region src/components/layout/Sidebar.svelte
function Sidebar($$renderer) {
	$$renderer.push(`<aside class="sidebar"><div class="panel narrative-panel">`);
	Storyboard($$renderer, {});
	$$renderer.push(`<!----></div> <div class="panel charts-panel">`);
	LiveCharts($$renderer, {});
	$$renderer.push(`<!----></div></aside>`);
}
//#endregion
//#region src/components/grid/AgentVisual.svelte
function AgentVisual($$renderer, $$props) {
	$$renderer.component(($$renderer) => {
		let isHappy, tx, ty;
		let agent = $$props["agent"];
		let cellSize = $$props["cellSize"];
		let ghostReaction = fallback($$props["ghostReaction"], void 0);
		let isDraggable = fallback($$props["isDraggable"], false);
		$: isHappy = ghostReaction ? ghostReaction.hypotheticalHappiness : agent.isHappy;
		$: tx = agent.x * cellSize + cellSize / 2;
		$: ty = agent.y * cellSize + cellSize / 2;
		$$renderer.push(`<g${attr("transform", `translate(${stringify(tx)},${stringify(ty)})`)}${attr_class("agent svelte-1d5dd7y", void 0, { "draggable": isDraggable })}><circle cx="0" cy="0"${attr("r", cellSize * .35)}${attr("fill", agent.color)}${attr("stroke", isHappy ? "#1f2937" : "#facc15")} stroke-width="0"${attr("stroke-dasharray", isHappy ? "none" : "4,4")}></circle><text x="0" y="-2" text-anchor="middle" dominant-baseline="central"${attr("font-size", `${stringify(cellSize * .5)}px`)} class="emoji svelte-1d5dd7y">${escape_html(isHappy ? "😀" : "😞")}</text></g>`);
		bind_props($$props, {
			agent,
			cellSize,
			ghostReaction,
			isDraggable
		});
	});
}
//#endregion
//#region src/components/grid/VenueVisual.svelte
function VenueVisual($$renderer, $$props) {
	$$renderer.component(($$renderer) => {
		let tx, ty;
		let venue = $$props["venue"];
		let cellSize = $$props["cellSize"];
		let isDraggable = fallback($$props["isDraggable"], false);
		const size = cellSize - 16;
		$: tx = venue.x * cellSize + 8;
		$: ty = venue.y * cellSize + 8;
		$$renderer.push(`<g${attr("transform", `translate(${stringify(tx)},${stringify(ty)})`)}${attr_class("venue svelte-g1fk94", void 0, { "draggable": isDraggable })}><rect x="0" y="0"${attr("width", size)}${attr("height", size)}${attr("fill", venue.color)} rx="8" opacity="0.8" stroke="#1f2937" stroke-width="0"></rect><text${attr("x", size / 2)}${attr("y", size / 2 + 2)} text-anchor="middle" dominant-baseline="central"${attr("font-size", `${stringify(size * .8)}px`)} class="emoji svelte-g1fk94">🏛️</text></g>`);
		bind_props($$props, {
			venue,
			cellSize,
			isDraggable
		});
	});
}
//#endregion
//#region src/components/grid/GridWorld.svelte
function GridWorld($$renderer, $$props) {
	$$renderer.component(($$renderer) => {
		var $$store_subs;
		let svgWidth, svgHeight;
		let agentsStore = $$props["agentsStore"];
		let venuesStore = $$props["venuesStore"];
		let ghostReactionsStore = $$props["ghostReactionsStore"];
		const width = 10;
		const height = 10;
		const cellSize = 60;
		const bgCells = [];
		for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) bgCells.push({
			x,
			y
		});
		$: svgWidth = width * cellSize;
		$: svgHeight = height * cellSize;
		$$renderer.push(`<svg${attr("width", svgWidth)}${attr("height", svgHeight)} class="board"><g class="layer-grid"><!--[-->`);
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
				isDraggable: store_get($$store_subs ??= {}, "$currentChapterIndex", currentChapterIndex) === 4
			});
		}
		$$renderer.push(`<!--]--></g><g class="layer-agents"><!--[-->`);
		const each_array_2 = ensure_array_like(store_get($$store_subs ??= {}, "$agentsStore", agentsStore));
		for (let $$index_2 = 0, $$length = each_array_2.length; $$index_2 < $$length; $$index_2++) {
			let agent = each_array_2[$$index_2];
			AgentVisual($$renderer, {
				agent,
				cellSize,
				ghostReaction: store_get($$store_subs ??= {}, "$ghostReactionsStore", ghostReactionsStore).find((r) => r.id === agent.id),
				isDraggable: store_get($$store_subs ??= {}, "$currentChapterIndex", currentChapterIndex) === 0
			});
		}
		$$renderer.push(`<!--]--></g></svg>`);
		if ($$store_subs) unsubscribe_stores($$store_subs);
		bind_props($$props, {
			agentsStore,
			venuesStore,
			ghostReactionsStore
		});
	});
}
//#endregion
//#region src/routes/+page.svelte
function _page($$renderer) {
	$$renderer.push(`<main class="exhibit-container"><header class="exhibit-header"><h1>Segregation Dynamics: An Agent-Based Model</h1> <p class="subtitle">An interactive exploranation of how local choices shape global patterns.</p></header> <div class="exhibit-content"><section class="simulation-canvas"><div class="grid-wrapper">`);
	GridWorld($$renderer, {
		agentsStore,
		venuesStore,
		ghostReactionsStore
	});
	$$renderer.push(`<!----></div></section> `);
	Sidebar($$renderer, {});
	$$renderer.push(`<!----></div></main>`);
}
//#endregion
export { _page as default };
