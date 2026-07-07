<script lang="ts">
  import * as d3 from 'd3';
  import type { Agent } from '../../engine/types/models';
  import { simulationActions } from '../../stores/simulationStore';
  
  export let agent: Agent;
  export let cellSize: number;
  export let ghostReaction: { hypotheticalHappiness: boolean } | undefined = undefined;
  export let isDraggable: boolean = false;

  // Visuals react to either the engine state or the temporary ghost interaction
  $: isHappy = ghostReaction ? ghostReaction.hypotheticalHappiness : agent.isHappy;
  
  // Calculate translation coordinates for the SVG Group
  $: tx = agent.x * cellSize + cellSize / 2;
  $: ty = agent.y * cellSize + cellSize / 2;

  // D3 Drag Binding via Svelte Action
 function draggable(node: SVGElement) {
    const drag = d3.drag<SVGElement, unknown>()
      // Only allow drag if left-click and the isDraggable prop is true
      .filter((event) => !event.button && isDraggable) 
      .on("start", function() {
        simulationActions.stop();
        d3.select(this).raise().classed("dragging", true);
      })
      .on("drag", (event) => {
        d3.select(node).attr("transform", `translate(${event.x},${event.y})`);

        // Clamping ensures calculations don't break if dragged outside the SVG
        const hoverX = Math.max(0, Math.min(9, Math.floor(event.x / cellSize)));
        const hoverY = Math.max(0, Math.min(9, Math.floor(event.y / cellSize)));

        simulationActions.previewMove(agent.color, agent.id, hoverX, hoverY);
      })
      .on("end", (event) => {
        d3.select(node).classed("dragging", false);
        
        const targetX = Math.max(0, Math.min(9, Math.floor(event.x / cellSize)));
        const targetY = Math.max(0, Math.min(9, Math.floor(event.y / cellSize)));

        const success = simulationActions.commitMove(agent.id, targetX, targetY);

        // If the move failed (e.g., cell was occupied), explicitly snap the SVG back 
        // to Svelte's reactive coordinates to prevent the agent from getting stuck between cells.
        if (!success) {
          // Snap back if dropped on an invalid/occupied cell
          d3.select(node).attr("transform", `translate(${tx},${ty})`);
        }
      });

    d3.select(node).call(drag);

    return {
      destroy() {
        d3.select(node).on(".drag", null);
      }
    };
  }
</script>

<g
  use:draggable
  transform="translate({tx},{ty})"
  class="agent"
  class:draggable={isDraggable}
>
  <circle
    cx="0"
    cy="0"
    r={cellSize * 0.35}
    fill={agent.color}
    stroke={isHappy ? "#1f2937" : "#facc15"}
    stroke-width="0"
    stroke-dasharray={isHappy ? "none" : "4,4"}
  />
  
  <text
    x="0"
    y="-2" 
    text-anchor="middle"
    dominant-baseline="central"
    font-size="{cellSize * 0.5}px"
    class="emoji"
  >
    {isHappy ? '😀' : '😞'}
  </text>
</g>

<style>
  .agent {
    transition: opacity 0.2s;
  }
  .agent.draggable {
    cursor: grab;
  }
  .agent.draggable:active, :global(.dragging) {
    cursor: grabbing;
    filter: drop-shadow(2px 4px 6px rgba(0,0,0,0.3));
  }
  .emoji {
    user-select: none; /* Prevents the user from accidentally highlighting the text */
    pointer-events: none; /* Passes mouse events through to the group for dragging */
  }
</style>