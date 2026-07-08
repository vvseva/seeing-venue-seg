import { writable, derived } from 'svelte/store';

// Define the shape of a Chapter
export interface Chapter {
  id: number;
  title: string;
  content: string;
  actionLabel: string;
  dispatchAction?: 'SPAWN_PROTAGONIST' | 'SPAWN_POPULATION' | 'GENERATE_VENUES' | 'PLAY_SIMULATION' | 'RESET';
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
    title: "A Crowded Neighborhood",
    content: "Let's fill the rest of the city. Our initial resident is now surrounded. Drag them around to see how their utility score changes based on their new neighbors.",
    actionLabel: "Spawn Population",
    dispatchAction: 'SPAWN_POPULATION'
  },
  {
    id: 2,
    title: "Massive Moves 1",
    content: "Now we let everyone move. At each tick, unhappy agents will relocate until they are satisfied. Let's watch the macroscopic patterns emerge.",
    actionLabel: "Run Simulation",
    dispatchAction: 'PLAY_SIMULATION'
  },
  {
    id: 3,
    title: "Outcomes 1",
    content: "Notice the macro consequences of individual preferences. Segregation has naturally increased.",
    actionLabel: "Start Tutorial 2: Venues"
  },
  // --- TUTORIAL 2 ---
  {
    id: 4,
    title: "Venue Generation",
    content: "Agents now factor venues into their utility. We will generate color-exclusive venues using Voronoi Relaxation to cover the emerged neighborhoods.",
    actionLabel: "Generate Venues",
    dispatchAction: 'GENERATE_VENUES'
  },
  {
    id: 5,
    title: "Exploration: Venue Impact",
    content: "Venues have a catchment area. Hover over a venue to see who attends it, and drag it to see how it affects local utility.",
    actionLabel: "Next: Massive Moves 2"
  },
  {
    id: 6,
    title: "Massive Moves & Outcomes 2",
    content: "Let's run the simulation again. Observe how the introduction of venues changes the previously segregated environment.",
    actionLabel: "Run Simulation",
    dispatchAction: 'PLAY_SIMULATION'
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