<script lang="ts">
  import { currentChapter, currentChapterIndex, narrativeActions } from '../../stores/narrativeStore';
  import { isGeneratingVenuesStore, simulationActions } from '../../stores/simulationStore';

  const finalChapterIndex = 7; // Updated to match new chapter length

  async function nextPhase() {
    simulationActions.resetStabilityWindow();

    // 1. Fire the specific action if the chapter demands it
    if ($currentChapter.dispatchAction === 'SPAWN_PROTAGONIST') {
      simulationActions.spawnProtagonist();
    } else if ($currentChapter.dispatchAction === 'SPAWN_TUTORIAL_GROUPS') {
      simulationActions.spawnTutorialGroups();
    } else if ($currentChapter.dispatchAction === 'SPAWN_POPULATION') {
      simulationActions.spawnPopulation();
    } else if ($currentChapter.dispatchAction === 'GENERATE_VENUES') {
      await simulationActions.generateEmergentVenues();
    } else if ($currentChapter.dispatchAction === 'PLAY_SIMULATION') {
      if ($currentChapter.id === 7) {
        simulationActions.playForTicks(10);
      } else {
        simulationActions.play();
      }
    }

    // 2. Advance the narrative
    if ($currentChapterIndex < finalChapterIndex) {
      narrativeActions.next();
      simulationActions.resetStabilityWindow();
    }
  }
</script>

<div class="storyboard">
  <h2>{$currentChapter.title}</h2>
  <p class="content">{$currentChapter.content}</p>
  
  <div class="actions">
    <button class="btn-primary" on:click={nextPhase} disabled={$isGeneratingVenuesStore}>
      {#if $isGeneratingVenuesStore}
        <span class="spinner" aria-hidden="true"></span>
      {/if}
      {$currentChapter.actionLabel}
    </button>
  </div>
</div>