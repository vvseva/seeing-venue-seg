import { writable, derived } from 'svelte/store';

// Define the shape of a Chapter
export interface Chapter {
  id: number;
  title: string;
  content: string;
  actionLabel: string;
  dispatchAction?: 'GENERATE_VENUES' | 'PLAY_SIMULATION' | 'RESET';
}

const chaptersData: Chapter[] = [
  // --- TUTORIAL 1 ---
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
    dispatchAction: 'PLAY_SIMULATION'
  },
  {
    id: 2,
    title: "Outcomes 1",
    content: "Notice the macro consequences of individual preferences. Look at the graphs: Segregation (clustering and dissimilarity) has naturally increased.",
    actionLabel: "Start Tutorial 2: Venues"
  },
  // --- TUTORIAL 2 ---
  {
    id: 3,
    title: "Venue Generation",
    content: "Agents now need venues in addition to similar neighbors. We will generate color-exclusive venues using Voronoi Relaxation to cover the emerged neighborhoods.",
    actionLabel: "Generate Venues",
    dispatchAction: 'GENERATE_VENUES'
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