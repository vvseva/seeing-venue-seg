import { writable, derived } from 'svelte/store';

// Define the shape of a Chapter
export interface Chapter {
  id: number;
  title: string;
  content: string;
  actionLabel: string;
  dispatchAction?:
    | 'SPAWN_PROTAGONIST'
    | 'SPAWN_TUTORIAL_GROUPS'
    | 'SPAWN_POPULATION'
    | 'GENERATE_VENUES'
    | 'PLAY_SIMULATION'
    | 'RUN_USER_POLICY'
    | 'RUN_EXEMPLAR_POLICY'
    | 'RUN_SIDE_BY_SIDE_COMPARE'
    | 'RESET';
}

const chaptersData: Chapter[] = [
  // --- INTRO & TUTORIAL 1 ---
  {
    id: 0,
    title: "The First Resident",
    content: "We start with an empty grid. Let's welcome our very first resident. They currently have no neighbors and no venues to attend.",
    actionLabel: "Spawn Protagonist",
    dispatchAction: 'SPAWN_PROTAGONIST'
  },
  {
    id: 1,
    title: "Model Behavior Tutorial",
    content: "The protagonist now stands between two small groups of different colors, one near the top and one near the bottom. Move the protagonist around and observe how nearby agents react.",
    actionLabel: "Create Tutorial Setup",
    dispatchAction: 'SPAWN_TUTORIAL_GROUPS'
  },
  {
    id: 2,
    title: "A Crowded Neighborhood",
    content: "Let's fill the rest of the city. Our initial resident is now surrounded. Drag them around to see how their utility score changes based on their new neighbors.",
    actionLabel: "Spawn Population",
    dispatchAction: 'SPAWN_POPULATION'
  },
  {
    id: 3,
    title: "Massive Moves 1",
    content: "Now we let everyone move. At each tick, unhappy agents will relocate until they are satisfied. Let's watch the macroscopic patterns emerge.",
    actionLabel: "Run Simulation",
    dispatchAction: 'PLAY_SIMULATION'
  },
  {
    id: 4,
    title: "Outcomes 1",
    content: "Notice the macro consequences of individual preferences. Segregation has naturally increased.",
    actionLabel: "Start Tutorial 2: Venues"
  },
  // --- TUTORIAL 2 ---
  {
    id: 5,
    title: "Venue Generation",
    content: "Agents now factor venues into their utility. We will generate color-exclusive venues using Voronoi Relaxation to cover the emerged neighborhoods.",
    actionLabel: "Generate Venues",
    dispatchAction: 'GENERATE_VENUES'
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
    dispatchAction: 'PLAY_SIMULATION'
  },
  {
    id: 8,
    title: "Policy Maker Challenge",
    content: "You are now the policy maker. Move venues, run the model for 25 ticks, and try to reduce segregation. We will save your venue placements and the average segregation indexes from those 25 ticks as your policy score.",
    actionLabel: "Run Your Policy (25 Ticks)",
    dispatchAction: 'RUN_USER_POLICY'
  },
  {
    id: 9,
    title: "Exemplar Integrated Policy",
    content: "Now compare your policy with an exemplar integrated venue placement. The model keeps four venues and places them far from each other and from boundaries with alternating colors. We run 25 ticks and compare average indexes.",
    actionLabel: "Run Exemplar Policy (25 Ticks)",
    dispatchAction: 'RUN_EXEMPLAR_POLICY'
  },
  {
    id: 10,
    title: "Side-by-Side Policy Comparison",
    content: "Both worlds now run in parallel: your venue policy on the left and the exemplar integrated policy on the right. Compare segregation trajectories in colorblind-friendly chart lines.",
    actionLabel: "Run Side-by-Side Comparison",
    dispatchAction: 'RUN_SIDE_BY_SIDE_COMPARE'
  }
];

// The core reactive index
export const currentChapterIndex = writable<number>(0);

// Derived store: Automatically updates when currentChapterIndex changes
export const currentChapter = derived(
  currentChapterIndex,
  ($index) => chaptersData[$index]
);

// Navigation Actions
export const narrativeActions = {
  next() {
    currentChapterIndex.update(n => Math.min(n + 1, chaptersData.length - 1));
  },
  prev() {
    currentChapterIndex.update(n => Math.max(n - 1, 0));
  },
  reset() {
    currentChapterIndex.set(0);
  }
};