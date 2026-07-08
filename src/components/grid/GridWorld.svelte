<script lang="ts">
  import AgentVisual from './AgentVisual.svelte';
  import VenueVisual from './VenueVisual.svelte';
  import type { Agent, ReactionPreview, Venue } from '../../engine/types/models';
  import type { Writable } from 'svelte/store';
  import { currentChapterIndex } from '../../stores/narrativeStore'; 
  
  type GridCell = {
    x: number;
    y: number;
  };

  export let agentsStore: Writable<Agent[]>;
  export let venuesStore: Writable<Venue[]>;
  export let ghostReactionsStore: Writable<ReactionPreview[]>;

  const width = 15;
  const height = 15;
  const cellSize = 60; // Pixels per grid cell
  
  $: svgWidth = width * cellSize;
  $: svgHeight = height * cellSize;

  // Generate background grid
  const bgCells: GridCell[] = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      bgCells.push({ x, y });
    }
  }
</script>

<svg width={svgWidth} height={svgHeight} class="board">
  <g class="layer-grid">
    {#each bgCells as cell}
      <rect x={cell.x * cellSize} y={cell.y * cellSize} width={cellSize} height={cellSize} class="grid-cell" />
    {/each}
  </g>

  <g class="layer-venues">
    {#each $venuesStore as venue (venue.id)}
      <VenueVisual 
        {venue} 
        {cellSize} 
        isDraggable={$currentChapterIndex >= 4}
      />
    {/each}
  </g>

  <g class="layer-agents">
    {#each $agentsStore as agent (agent.id)}
      <AgentVisual 
        {agent} 
        {cellSize} 
        ghostReaction={$ghostReactionsStore.find(r => r.id === agent.id)}
        isDraggable={$currentChapterIndex <= 1 ? agent.isProtagonist : $currentChapterIndex > 1}
      />
    {/each}
  </g>
</svg>