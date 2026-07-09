export const WORLD_WIDTH = 12;
export const WORLD_HEIGHT = 12;
export const WORLD_DENSITY = 0.8;
export const WORLD_SIMILARITY_THRESHOLD = 0.5;
export const WORLD_VENUE_RADIUS = 3;
export const WORLD_VENUE_CAPACITY = 20;

export type WorldParameters = {
	width: number;
	height: number;
	density: number;
	similarityThreshold: number;
	venueRadius: number;
	venueCapacity: number;
};

export const DEFAULT_WORLD_PARAMETERS: WorldParameters = {
	width: WORLD_WIDTH,
	height: WORLD_HEIGHT,
	density: WORLD_DENSITY,
	similarityThreshold: WORLD_SIMILARITY_THRESHOLD,
	venueRadius: WORLD_VENUE_RADIUS,
	venueCapacity: WORLD_VENUE_CAPACITY
};

export function sanitizeWorldParameters(input: Partial<WorldParameters>): WorldParameters {
	const width = Math.max(4, Math.min(60, Math.floor(input.width ?? DEFAULT_WORLD_PARAMETERS.width)));
	const height = Math.max(4, Math.min(60, Math.floor(input.height ?? DEFAULT_WORLD_PARAMETERS.height)));
	const density = Math.max(0.05, Math.min(0.99, input.density ?? DEFAULT_WORLD_PARAMETERS.density));
	const similarityThreshold = Math.max(
		0,
		Math.min(1, input.similarityThreshold ?? DEFAULT_WORLD_PARAMETERS.similarityThreshold)
	);
	const venueRadius = Math.max(1, Math.min(20, Math.floor(input.venueRadius ?? DEFAULT_WORLD_PARAMETERS.venueRadius)));
	const venueCapacity = Math.max(1, Math.min(200, Math.floor(input.venueCapacity ?? DEFAULT_WORLD_PARAMETERS.venueCapacity)));

	return {
		width,
		height,
		density,
		similarityThreshold,
		venueRadius,
		venueCapacity
	};
}