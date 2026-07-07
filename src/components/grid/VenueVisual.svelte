<script lang="ts">
  import * as d3 from 'd3';
  import { simulationActions } from '../../stores/simulationStore';
  import type { Venue } from '../../engine/types/models';
  
  export let venue: Venue;
  export let cellSize: number;
  export let isDraggable: boolean = false;
  
  $: x = venue.x * cellSize + 8;
  $: y = venue.y * cellSize + 8;
  const size = cellSize - 16;

  function draggable(node: SVGElement) {
    const drag = d3.drag<SVGElement, unknown>()
      .filter((event) => !event.button && isDraggable) // NEW
      .on("start", function() {
        simulationActions.stop();
        d3.select(this).raise().classed("dragging", true);
      })
      .on("drag", (event) => {
        d3.select(node).attr("x", event.x - size/2).attr("y", event.y - size/2);

        const hoverX = Math.max(0, Math.min(9, Math.floor(event.x / cellSize)));
        const hoverY = Math.max(0, Math.min(9, Math.floor(event.y / cellSize)));

        simulationActions.previewVenueMove(venue.id, hoverX, hoverY);
      })
      .on("end", (event) => {
        d3.select(node).classed("dragging", false);
        
        const targetX = Math.max(0, Math.min(9, Math.floor(event.x / cellSize)));
        const targetY = Math.max(0, Math.min(9, Math.floor(event.y / cellSize)));

        const success = simulationActions.commitVenueMove(venue.id, targetX, targetY);

        // Snap back if the venue is dropped outside bounds
        if (!success) {
           d3.select(node).attr("x", x).attr("y", y);
        }
      });

    d3.select(node).call(drag);
    return { destroy() { d3.select(node).on(".drag", null); } };
  }
</script>

<rect
  use:draggable
  {x}
  {y}
  width={size}
  height={size}
  fill={venue.color}
  rx="6"
  class="venue-rect"
  class:draggable={isDraggable}
/>

<style>
  .venue-rect {
    opacity: 0.6;
    stroke: #333;
    stroke-width: 2px;
    transition: opacity 0.2s;
  }
  .venue-rect.draggable {
    cursor: grab;
  }
  .venue-rect.draggable:active, :global(.dragging) {
    cursor: grabbing;
    opacity: 0.9;
    filter: drop-shadow(0px 8px 12px rgba(0,0,0,0.4));
  }
</style>