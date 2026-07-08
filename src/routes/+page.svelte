<script lang="ts">
  import Sidebar from '../components/layout/Sidebar.svelte';
  import GridWorld from '../components/grid/GridWorld.svelte';
  import { currentChapterIndex } from '../stores/narrativeStore';
  import {
    agentsStore,
    venuesStore,
    ghostReactionsStore,
    compareUserAgentsStore,
    compareUserVenuesStore,
    compareExemplarAgentsStore,
    compareExemplarVenuesStore,
    compareUserGhostReactionsStore,
    compareExemplarGhostReactionsStore,
    hoveredVenueId,
    compareUserHoveredVenueIdStore,
    compareExemplarHoveredVenueIdStore,
    isPlayingStore,
    isGeneratingVenuesStore,
    simulationActions
  } from '../stores/simulationStore';
</script>

<main class="exhibit-container">
  <header class="exhibit-header">
    <h1>Segregation Dynamics: An Agent-Based Model</h1>
    <p class="subtitle">An interactive exploranation of how local choices shape global patterns.</p>
  </header>

  <div class="exhibit-content">
    <section class="simulation-canvas">
      <div class="simulation-controls">
        <button
          class="simulation-toggle"
          on:click={() => ($isPlayingStore ? simulationActions.stop() : simulationActions.play())}
          disabled={$isGeneratingVenuesStore}
          aria-label={$isPlayingStore ? 'Pause simulation' : 'Play simulation'}
        >
          <span class="control-icon" aria-hidden="true">{$isPlayingStore ? '❚❚' : '▶'}</span>
          <span>{$isPlayingStore ? 'Pause' : 'Play'} simulation</span>
        </button>
      </div>

      {#if $currentChapterIndex === 10}
        <div class="grid-compare-layout">
          <div class="grid-wrapper compare-grid-panel">
            <h3 class="compare-grid-title">Your Policy</h3>
            <GridWorld
              agentsStore={compareUserAgentsStore}
              venuesStore={compareUserVenuesStore}
              ghostReactionsStore={compareUserGhostReactionsStore}
              hoveredVenueStore={compareUserHoveredVenueIdStore}
              allowInteractions={false}
              compactMode={true}
            />
          </div>

          <div class="grid-wrapper compare-grid-panel">
            <h3 class="compare-grid-title">Exemplar Policy</h3>
            <GridWorld
              agentsStore={compareExemplarAgentsStore}
              venuesStore={compareExemplarVenuesStore}
              ghostReactionsStore={compareExemplarGhostReactionsStore}
              hoveredVenueStore={compareExemplarHoveredVenueIdStore}
              allowInteractions={false}
              compactMode={true}
            />
          </div>
        </div>
      {:else}
        <div class="grid-wrapper">
          <GridWorld
            {agentsStore}
            {venuesStore}
            {ghostReactionsStore}
            hoveredVenueStore={hoveredVenueId}
          />
        </div>
      {/if}
    </section>

    <Sidebar />
  </div>
</main>
