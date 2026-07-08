<script lang="ts">
  import * as d3 from 'd3';
  import type { Writable } from 'svelte/store';
  import { simulationActions } from '../../stores/simulationStore';
  import type { Venue } from '../../engine/types/models';
  
  export let venue: Venue;
  export let cellSize: number;
  export let boardWidth: number;
  export let boardHeight: number;
  export let hoveredVenueStore: Writable<string | null>;
  export let isDraggable: boolean = false;
  
  $: tx = venue.x * cellSize + 8;
  $: ty = venue.y * cellSize + 8;
  const size = cellSize - 16;

  function clampCell(value: number, max: number) {
    return Math.max(0, Math.min(max - 1, value));
  }

  function draggable(node: SVGElement) {
    const drag = d3.drag<SVGElement, unknown>()
      .filter((event) => !event.button && isDraggable) // NEW
      .on("start", function() {
        simulationActions.stop();
        d3.select(this).raise().classed("dragging", true);
      })
      .on("drag", (event) => {
        d3.select(node).attr("transform", `translate(${event.x - size/2},${event.y - size/2})`);

        const hoverX = clampCell(Math.floor(event.x / cellSize), boardWidth);
        const hoverY = clampCell(Math.floor(event.y / cellSize), boardHeight);

        simulationActions.previewVenueMove(venue.id, hoverX, hoverY);
      })
      .on("end", (event) => {
        d3.select(node).classed("dragging", false);
        
        const targetX = clampCell(Math.floor(event.x / cellSize), boardWidth);
        const targetY = clampCell(Math.floor(event.y / cellSize), boardHeight);

        const success = simulationActions.commitVenueMove(venue.id, targetX, targetY);

        // Snap back if the venue is dropped outside bounds
        if (!success) {
           d3.select(node).attr("transform", `translate(${tx},${ty})`);
        }
      });

    d3.select(node).call(drag);
    return { destroy() { d3.select(node).on(".drag", null); } };
  }
  
  function handleMouseEnter() {
    hoveredVenueStore.set(venue.id);
  }

  function handleMouseLeave() {
    hoveredVenueStore.set(null);
  }

  $: isHovered = $hoveredVenueStore === venue.id;
</script>

<g
  use:draggable
  transform="translate({tx},{ty})"
  class="venue"
  class:draggable={isDraggable}
  class:hovered={isHovered}
  role="button"
  tabindex="0"
  aria-label="Venue {venue.id}"
  on:pointerenter={handleMouseEnter}
  on:pointerleave={handleMouseLeave}
>
  <rect
    x="0"
    y="0"
    width={size}
    height={size}
    fill={venue.color}
    rx="8"
    opacity="0.8"
    stroke="#1f2937"
    stroke-width="0"
  />

  <text
    x={size / 2}    
    y={size / 2 + 2}
    text-anchor="middle"
    dominant-baseline="central"
    font-size="{size * 0.8}px"
    class="emoji"
  >
    🏛️
  </text>
</g>