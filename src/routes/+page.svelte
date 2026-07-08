<script lang="ts">
  import Sidebar from '../components/layout/Sidebar.svelte';
  import GridWorld from '../components/grid/GridWorld.svelte';
  import { agentsStore, venuesStore, ghostReactionsStore, isPlayingStore, isGeneratingVenuesStore, simulationActions } from '../stores/simulationStore';
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

      <div class="grid-wrapper">
        <GridWorld
          {agentsStore}
          {venuesStore}
          {ghostReactionsStore}
        />
      </div>
    </section>

    <Sidebar />
  </div>
</main>
