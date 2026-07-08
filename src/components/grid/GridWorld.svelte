<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import AgentVisual from './AgentVisual.svelte';
  import VenueVisual from './VenueVisual.svelte';
  import type { Agent, ReactionPreview, Venue } from '../../engine/types/models';
  import type { Writable } from 'svelte/store';
  import { currentChapterIndex } from '../../stores/narrativeStore'; 
  import { WORLD_HEIGHT, WORLD_WIDTH } from '../../engine/world';
  
  type GridCell = {
    x: number;
    y: number;
  };

  export let agentsStore: Writable<Agent[]>;
  export let venuesStore: Writable<Venue[]>;
  export let ghostReactionsStore: Writable<ReactionPreview[]>;

  const width = WORLD_WIDTH;
  const height = WORLD_HEIGHT;
  const MIN_CELL_SIZE = 28;
  const MAX_CELL_SIZE = 60;

  let boardElement: SVGSVGElement | null = null;
  let cellSize = 45; // Pixels per grid cell

  function clamp(value: number, min: number, max: number) {
    return Math.max(min, Math.min(max, value));
  }

  function updateCellSize() {
    const host = boardElement?.parentElement;
    if (!host) return;

    const availableWidth = Math.max(0, host.clientWidth - 8);
    const availableHeight = host.clientHeight > 0 ? Math.max(0, host.clientHeight - 8) : Number.POSITIVE_INFINITY;

    const sizeFromWidth = Math.floor(availableWidth / width);
    const sizeFromHeight = Math.floor(availableHeight / height);
    const nextSize = clamp(Math.min(sizeFromWidth, sizeFromHeight), MIN_CELL_SIZE, MAX_CELL_SIZE);

    if (Number.isFinite(nextSize) && nextSize > 0) {
      cellSize = nextSize;
    }
  }

  onMount(() => {
    const host = boardElement?.parentElement;
    if (!host) return;

    const observer = new ResizeObserver(() => {
      updateCellSize();
    });
    observer.observe(host);

    updateCellSize();

    return () => observer.disconnect();
  });

  onDestroy(() => {
    boardElement = null;
  });
  
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

<svg
  bind:this={boardElement}
  viewBox={`0 0 ${svgWidth} ${svgHeight}`}
  preserveAspectRatio="xMidYMid meet"
  class="board"
>
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
        boardWidth={width}
        boardHeight={height}
        isDraggable={$currentChapterIndex >= 5}
      />
    {/each}
  </g>

  <g class="layer-agents">
    {#each $agentsStore as agent (agent.id)}
      <AgentVisual 
        {agent} 
        {cellSize} 
        boardWidth={width}
        boardHeight={height}
        ghostReaction={$ghostReactionsStore.find(r => r.id === agent.id)}
        isDraggable={$currentChapterIndex <= 3}
        showProtagonistBadge={$currentChapterIndex <= 1 && agent.id === 'agent_protagonist'}
      />
    {/each}
  </g>
</svg>