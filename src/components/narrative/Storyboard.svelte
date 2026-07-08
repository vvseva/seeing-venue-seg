<script lang="ts">
  import { currentChapter, currentChapterIndex, narrativeActions } from '../../stores/narrativeStore';
  import { isGeneratingVenuesStore, simulationActions } from '../../stores/simulationStore';

  const finalChapterIndex = 10; // Updated to match new chapter length
  let isAdvancing = false;

  async function nextPhase() {
    if (isAdvancing) return;
    isAdvancing = true;
    simulationActions.resetStabilityWindow();

    try {
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
          simulationActions.playForTicks(25, () => {
            simulationActions.capturePolicyTargetFromLast25Ticks();
          });
        } else {
          simulationActions.play();
        }
      } else if ($currentChapter.dispatchAction === 'RUN_USER_POLICY') {
        await simulationActions.runUserPolicyEvaluation();
      } else if ($currentChapter.dispatchAction === 'RUN_EXEMPLAR_POLICY') {
        await simulationActions.runExemplarPolicyEvaluation();
      } else if ($currentChapter.dispatchAction === 'RUN_SIDE_BY_SIDE_COMPARE') {
        await simulationActions.runSideBySideComparison();
      }

      // 2. Advance the narrative
      if ($currentChapterIndex < finalChapterIndex) {
        narrativeActions.next();
      }
      simulationActions.resetStabilityWindow();
    } finally {
      isAdvancing = false;
    }
  }
</script>

<div class="storyboard">
  <h2>{$currentChapter.title}</h2>
  <p class="content">{$currentChapter.content}</p>
  
  <div class="actions">
    <button class="btn-primary" on:click={nextPhase} disabled={$isGeneratingVenuesStore || isAdvancing}>
      {#if $isGeneratingVenuesStore}
        <span class="spinner" aria-hidden="true"></span>
      {/if}
      {$currentChapter.actionLabel}
    </button>
  </div>
</div>