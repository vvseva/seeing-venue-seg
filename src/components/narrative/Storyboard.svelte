<script lang="ts">
  import { currentChapter, currentChapterIndex, narrativeActions } from '../../stores/narrativeStore';
  import { isPlayingStore, simulationActions } from '../../stores/simulationStore';

  const finalChapterIndex = 5;

  function handleActionClick() {
    if ($currentChapter.dispatchAction === 'GENERATE_VENUES') {
      simulationActions.generateEmergentVenues();
    } else if ($currentChapter.dispatchAction === 'PLAY_SIMULATION') {
      simulationActions.play();
    }
  
    // Advance the text after dispatching the current chapter action.
    narrativeActions.next();
  }

  function nextPhase() {
    if ($currentChapter.dispatchAction === 'GENERATE_VENUES') {
      simulationActions.generateEmergentVenues();
    } else if ($currentChapter.dispatchAction === 'PLAY_SIMULATION') {
      simulationActions.play();
    }

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
    <button class="btn-secondary" on:click={toggleSimulation}>
      {$isPlayingStore ? 'Pause' : 'Continue'}
    </button>
  </div>
</div>

<style>
  .actions {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
  }

  .btn-secondary {
    border: 1px solid #6b7280;
    background: #f3f4f6;
    color: #111827;
    padding: 0.5rem 0.75rem;
    border-radius: 0.5rem;
    cursor: pointer;
  }
</style>