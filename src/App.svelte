<script lang="ts">
  import Sidebar from './components/layout/Sidebar.svelte';
  import GridWorld from './components/grid/GridWorld.svelte';
  
  // Import the stores to pass down to the visual layer
  import { agentsStore, venuesStore, ghostReactionsStore } from './stores/simulationStore';
</script>

<main class="exhibit-container">
  <header class="exhibit-header">
    <h1>Segregation Dynamics: An Agent-Based Model</h1>
    <p class="subtitle">An interactive exploranation of how local choices shape global patterns.</p>
  </header>

  <div class="exhibit-content">
    
    <section class="simulation-canvas">
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

