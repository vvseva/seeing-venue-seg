<script lang="ts">
  import * as d3 from 'd3';
  import type { Writable } from 'svelte/store';
  import type { Agent } from '../../engine/types/models';
  import { simulationActions, visualizationStyleStore } from '../../stores/simulationStore';
  
  export let agent: Agent;
  export let cellSize: number;
  export let boardWidth: number;
  export let boardHeight: number;
  export let hoveredVenueStore: Writable<string | null>;
  export let ghostReaction: { hypotheticalHappiness: boolean } | undefined = undefined;
  export let isDraggable: boolean = false;
  export let showProtagonistBadge: boolean = false;

  // Visuals react to either the engine state or the temporary ghost interaction
  $: isHappy = ghostReaction ? ghostReaction.hypotheticalHappiness : agent.isHappy;
  
  // Calculate translation coordinates for the SVG Group
  $: tx = agent.x * cellSize + cellSize / 2;
  $: ty = agent.y * cellSize + cellSize / 2;

  // React to the venue hover state for the wiggle animation
  $: isWiggling = $hoveredVenueStore !== null && $hoveredVenueStore === agent.currentVenueId;
  $: species = agent.color === 'red' ? 'cat' : 'dog';
  $: mood = isHappy ? 'happy' : 'sad';
  $: agentImagePath = `/images/cat/${species}-${mood}.svg`;

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
        const hoverX = Math.max(0, Math.min(boardWidth - 1, Math.floor(event.x / cellSize)));
        const hoverY = Math.max(0, Math.min(boardHeight - 1, Math.floor(event.y / cellSize)));

        simulationActions.previewMove(agent.color, agent.id, hoverX, hoverY);
      })
      .on("end", (event) => {
        d3.select(node).classed("dragging", false);
        
        const targetX = Math.max(0, Math.min(boardWidth - 1, Math.floor(event.x / cellSize)));
        const targetY = Math.max(0, Math.min(boardHeight - 1, Math.floor(event.y / cellSize)));

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
  <g class="agent-body" class:wiggle={isWiggling}>
    <circle
      cx="0"
      cy="0"
      r={cellSize * 0.42}
      fill="transparent"
      pointer-events="all"
    />

    <g class="utility-bar-group">
      <rect x={barX} y={-cellSize * 0.45} width={barMaxWidth} height="5" fill="#e0e0e0" rx="2.5" />
      <rect x={barX} y={-cellSize * 0.45} width={utilityWidth} height="5" fill={agent.color} rx="2.5" />
    </g>

    {#if $visualizationStyleStore === 'cats-and-dogs'}
      <image
        href={agentImagePath}
        x={-cellSize * 0.42}
        y={-cellSize * 0.42}
        width={cellSize * 0.84}
        height={cellSize * 0.84}
        preserveAspectRatio="xMidYMid meet"
        class="entity-svg"
      />
    {:else}
      <circle
        cx="0"
        cy="0"
        r={cellSize * 0.35}
        fill={agent.color}
        stroke={isHappy ? "#111" : "#fff"}
        stroke-width={isHappy ? 0 : 2}
        stroke-dasharray={isHappy ? "none" : "4 2"}
      />

      <text x="0" y="6" text-anchor="middle" font-size="18" pointer-events="none" class="emoji">
        {isHappy ? '🙂' : '☹️'}
      </text>
    {/if}

    {#if showProtagonistBadge}
      <text x="0" y="-16" text-anchor="middle" font-size="16" pointer-events="none" class="emoji">⭐</text>
    {/if}
  </g>
</g>