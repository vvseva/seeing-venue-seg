<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import AgentVisual from './AgentVisual.svelte';
  import VenueVisual from './VenueVisual.svelte';
  import type { Agent, ReactionPreview, Venue } from '../../engine/types/models';
  import type { Writable } from 'svelte/store';
  import { hoveredVenueId, simulationActions, worldParametersStore } from '../../stores/simulationStore';
  import { currentChapterIndex } from '../../stores/narrativeStore'; 
  
  type GridCell = {
    x: number;
    y: number;
  };

  export let agentsStore: Writable<Agent[]>;
  export let venuesStore: Writable<Venue[]>;
  export let ghostReactionsStore: Writable<ReactionPreview[]>;
  export let hoveredVenueStore: Writable<string | null> = hoveredVenueId;
  export let allowInteractions = true;
  export let compactMode = false;
  export let previewVenueMove: (id: string, targetX: number, targetY: number) => void = simulationActions.previewVenueMove;
  export let commitVenueMove: (id: string, targetX: number, targetY: number) => boolean = simulationActions.commitVenueMove;

  $: width = $worldParametersStore.width;
  $: height = $worldParametersStore.height;
  const STANDARD_MIN_CELL_SIZE = 28;
  const STANDARD_MAX_CELL_SIZE = 60;
  const COMPACT_MIN_CELL_SIZE = 16;
  const COMPACT_MAX_CELL_SIZE = 30;

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
    const minSize = compactMode ? COMPACT_MIN_CELL_SIZE : STANDARD_MIN_CELL_SIZE;
    const maxSize = compactMode ? COMPACT_MAX_CELL_SIZE : STANDARD_MAX_CELL_SIZE;
    const nextSize = clamp(Math.min(sizeFromWidth, sizeFromHeight), minSize, maxSize);

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
  $: bgCells = (() => {
    const nextCells: GridCell[] = [];
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        nextCells.push({ x, y });
      }
    }
    return nextCells;
  })();
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
        {hoveredVenueStore}
        isDraggable={allowInteractions && $currentChapterIndex >= 5}
        onPreviewMove={previewVenueMove}
        onCommitMove={commitVenueMove}
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
        {hoveredVenueStore}
        ghostReaction={$ghostReactionsStore.find(r => r.id === agent.id)}
        isDraggable={allowInteractions && $currentChapterIndex <= 3}
        showProtagonistBadge={$currentChapterIndex <= 1 && agent.id === 'agent_protagonist'}
      />
    {/each}
  </g>
</svg>