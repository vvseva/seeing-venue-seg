<script lang="ts">
  import * as d3 from 'd3';
  import type { Agent } from '../../engine/types/models';
  import { simulationActions, hoveredVenueId } from '../../stores/simulationStore';
  
  export let agent: Agent;
  export let cellSize: number;
  export let ghostReaction: { hypotheticalHappiness: boolean } | undefined = undefined;
  export let isDraggable: boolean = false;

  // Visuals react to either the engine state or the temporary ghost interaction
  $: isHappy = ghostReaction ? ghostReaction.hypotheticalHappiness : agent.isHappy;
  
  // Calculate translation coordinates for the SVG Group
  $: tx = agent.x * cellSize + cellSize / 2;
  $: ty = agent.y * cellSize + cellSize / 2;

  // React to the venue hover state for the wiggle animation
  $: isWiggling = $hoveredVenueId !== null && $hoveredVenueId === agent.currentVenueId;

  // Utility bar calculations
  const barMaxWidth = cellSize * 0.7; // Scale to cell size
  $: utilityWidth = agent.utility * barMaxWidth;
  $: barX = -(barMaxWidth / 2);

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
  class="agent {isWiggling ? 'wiggle' : ''}"
  class:draggable={isDraggable}
>
  <g class="utility-bar-group">
    <rect x={barX} y={-cellSize * 0.45} width={barMaxWidth} height="5" fill="#e0e0e0" rx="2.5" />
    <rect x={barX} y={-cellSize * 0.45} width={utilityWidth} height="5" fill={agent.color} rx="2.5" />
  </g>

  <circle
    cx="0"
    cy="0"
    r={cellSize * 0.35}
    fill={agent.color}
    stroke={isHappy ? "#111" : "#fff"}
    stroke-width={isHappy ? 0 : 2}
    stroke-dasharray={isHappy ? "none" : "4 2"}
  />

  {#if agent.isProtagonist}
    <text x="0" y="6" text-anchor="middle" font-size="18" pointer-events="none">🥳</text>
  {/if}
</g>