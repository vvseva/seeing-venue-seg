<script lang="ts">
  import Storyboard from '../narrative/Storyboard.svelte';
  import LiveCharts from '../charts/LiveCharts.svelte';
</script>

<aside class="sidebar">
  <div class="panel narrative-panel">
    <Storyboard />
  </div>
  
  <div class="panel charts-panel">
    <LiveCharts />
  </div>
</aside>