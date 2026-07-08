<script lang="ts">
  import Storyboard from '../narrative/Storyboard.svelte';
  import LiveCharts from '../charts/LiveCharts.svelte';

  export let showCharts = true;
</script>

<aside class="sidebar">
  <div class="panel narrative-panel">
    <Storyboard />
  </div>
  
  {#if showCharts}
    <div class="panel charts-panel">
      <LiveCharts />
    </div>
  {/if}
</aside>