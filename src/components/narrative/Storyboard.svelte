<script lang="ts">
  import { currentChapter, currentChapterIndex, narrativeActions } from '../../stores/narrativeStore';
  import { isPlayingStore, simulationActions } from '../../stores/simulationStore';

  const finalChapterIndex = 6; // Updated to match new chapter length

  function nextPhase() {
    // 1. Fire the specific action if the chapter demands it
    if ($currentChapter.dispatchAction === 'SPAWN_PROTAGONIST') {
      simulationActions.spawnProtagonist();
    } else if ($currentChapter.dispatchAction === 'SPAWN_POPULATION') {
      simulationActions.spawnPopulation();
    } else if ($currentChapter.dispatchAction === 'GENERATE_VENUES') {
      simulationActions.generateEmergentVenues();
    } else if ($currentChapter.dispatchAction === 'PLAY_SIMULATION') {
      simulationActions.play();
    }

    // 2. Advance the narrative
    if ($currentChapterIndex < finalChapterIndex) {
      narrativeActions.next();
    }
  }

  function toggleSimulation() {
    if ($isPlayingStore) {
      simulationActions.stop();
      return;
    }
    simulationActions.play();
  }
</script>

<div class="storyboard">
  <h2>{$currentChapter.title}</h2>
  <p class="content">{$currentChapter.content}</p>
  
  <div class="actions">
    <button class="btn-primary" on:click={nextPhase}>
      {$currentChapter.actionLabel}
    </button>
    {#if $currentChapter.dispatchAction === 'PLAY_SIMULATION' || $currentChapterIndex > 1}
      <button class="btn-secondary" on:click={toggleSimulation}>
        {$isPlayingStore ? 'Pause Simulation' : 'Run Simulation'}
      </button>
    {/if}
  </div>
</div>