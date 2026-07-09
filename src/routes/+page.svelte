<script lang="ts">
  import Sidebar from '../components/layout/Sidebar.svelte';
  import GridWorld from '../components/grid/GridWorld.svelte';
  import LiveCharts from '../components/charts/LiveCharts.svelte';
  import { chapters, currentChapter, currentChapterIndex, narrativeActions } from '../stores/narrativeStore';
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
    worldParametersStore,
    visualizationStyleStore,
    simulationActions
  } from '../stores/simulationStore';
  import type { VisualizationStyle } from '../stores/simulationStore';

  const TRIPLE_TAP_WINDOW_MS = 550;
  let titleTapCount = 0;
  let tapResetTimer: ReturnType<typeof setTimeout> | null = null;
  let showModelParameters = false;

  let draftWidth = 12;
  let draftHeight = 12;
  let draftDensity = 0.8;
  let draftSimilarityThreshold = 0.5;
  let draftVenueRadius = 3;
  let draftVenueCapacity = 20;
  let draftVisualizationStyle: VisualizationStyle = 'cats-and-dogs';

  $: if (!showModelParameters) {
    draftWidth = $worldParametersStore.width;
    draftHeight = $worldParametersStore.height;
    draftDensity = $worldParametersStore.density;
    draftSimilarityThreshold = $worldParametersStore.similarityThreshold;
    draftVenueRadius = $worldParametersStore.venueRadius;
    draftVenueCapacity = $worldParametersStore.venueCapacity;
    draftVisualizationStyle = $visualizationStyleStore;
  }

  function clearTapResetTimer() {
    if (!tapResetTimer) return;
    clearTimeout(tapResetTimer);
    tapResetTimer = null;
  }

  function handleSecretTap() {
    titleTapCount += 1;
    clearTapResetTimer();

    if (titleTapCount >= 3) {
      showModelParameters = true;
      titleTapCount = 0;
      return;
    }

    tapResetTimer = setTimeout(() => {
      titleTapCount = 0;
      tapResetTimer = null;
    }, TRIPLE_TAP_WINDOW_MS);
  }

  function saveModelParametersAndReturn() {
    simulationActions.applyWorldParameters({
      width: draftWidth,
      height: draftHeight,
      density: draftDensity,
      similarityThreshold: draftSimilarityThreshold,
      venueRadius: draftVenueRadius,
      venueCapacity: draftVenueCapacity
    });
    simulationActions.setVisualizationStyle(draftVisualizationStyle);

    showModelParameters = false;
  }

  function resetModelParametersToDefault() {
    simulationActions.resetWorldParametersToDefaults();
    simulationActions.setVisualizationStyle('cats-and-dogs');
    showModelParameters = false;
  }
</script>

<main class="exhibit-container">
  <header class="exhibit-header">
    <div class="exhibit-header-grid">
      <div>
        <h1>
          <button
            type="button"
            class="secret-trigger-title"
            on:click={handleSecretTap}
            aria-label="Segregation Dynamics: An Agent-Based Model"
          >
            Segregation Dynamics: An Agent-Based Model
          </button>
        </h1>
        <p class="subtitle">An interactive exploranation of how local choices shape global patterns.</p>
      </div>

      <div class="chapter-progress" role="navigation" aria-label="Chapter progression">
        <div class="chapter-progress-top">
          <span class="chapter-progress-label">Chapter {$currentChapterIndex + 1} of {chapters.length}</span>
          <div class="chapter-progress-actions">
            <button
              type="button"
              class="chapter-nav-btn"
              on:click={() => narrativeActions.prev()}
              disabled={$currentChapterIndex === 0}
              aria-label="Go to previous chapter"
            >
              Previous
            </button>
            <button
              type="button"
              class="chapter-nav-btn"
              on:click={() => narrativeActions.next()}
              disabled={$currentChapterIndex === chapters.length - 1}
              aria-label="Go to next chapter"
            >
              Next
            </button>
          </div>
        </div>

        <div class="chapter-stepper" aria-label="Chapter selection">
          {#each chapters as chapter, chapterIndex (chapter.id)}
            <button
              type="button"
              class="chapter-step"
              class:is-complete={chapterIndex < $currentChapterIndex}
              class:is-active={chapterIndex === $currentChapterIndex}
              aria-current={chapterIndex === $currentChapterIndex ? 'step' : undefined}
              aria-label={`Go to chapter ${chapterIndex + 1}: ${chapter.title}`}
              title={`Chapter ${chapterIndex + 1}: ${chapter.title}`}
              on:click={() => narrativeActions.goTo(chapterIndex)}
            >
              {chapterIndex + 1}
            </button>
          {/each}
        </div>

        <p class="chapter-progress-title">{$currentChapter.title}</p>
      </div>
    </div>
  </header>

  {#if showModelParameters}
    <section class="secret-parameters-page" aria-label="Model parameters page">
      <div class="secret-parameters-card panel">
        <div class="secret-parameters-header">
          <h2>Model Parameters</h2>
          <button class="chapter-nav-btn" type="button" on:click={() => (showModelParameters = false)}>
            Return to Simulation
          </button>
        </div>

        <p class="chart-hint">These settings apply after you save and reset the simulation world.</p>

        <div class="secret-form-grid">
          <label>
            <span>WORLD_WIDTH</span>
            <input type="number" min="4" max="60" step="1" bind:value={draftWidth} />
          </label>

          <label>
            <span>WORLD_HEIGHT</span>
            <input type="number" min="4" max="60" step="1" bind:value={draftHeight} />
          </label>

          <label>
            <span>density</span>
            <input type="number" min="0.05" max="0.99" step="0.01" bind:value={draftDensity} />
          </label>

          <label>
            <span>similarityThreshold</span>
            <input type="number" min="0" max="1" step="0.01" bind:value={draftSimilarityThreshold} />
          </label>

          <label>
            <span>venueRadius</span>
            <input type="number" min="1" max="20" step="1" bind:value={draftVenueRadius} />
          </label>

          <label>
            <span>venue capacity for generateVenuesLloyds</span>
            <input type="number" min="1" max="200" step="1" bind:value={draftVenueCapacity} />
          </label>

          <label>
            <span>visualization style</span>
            <select bind:value={draftVisualizationStyle}>
              <option value="cats-and-dogs">cats and dogs</option>
              <option value="emoji">emoji</option>
            </select>
          </label>
        </div>

        <div class="secret-form-actions">
          <button class="btn-primary" type="button" on:click={saveModelParametersAndReturn}>Save & Return</button>
          <button class="chapter-nav-btn" type="button" on:click={resetModelParametersToDefault}>
            Reset Defaults
          </button>
        </div>
      </div>
    </section>
  {:else}
    <div class="exhibit-content">
      <section class="simulation-canvas" class:chapter11-layout={$currentChapterIndex === 11}>
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

        {#if $currentChapterIndex >= 10}
          <div class="grid-compare-layout">
            <div class="grid-wrapper compare-grid-panel">
              <h3 class="compare-grid-title">Your Policy <span class="tiny-badge tiny-badge-you-strong">You</span></h3>
              <GridWorld
                agentsStore={compareUserAgentsStore}
                venuesStore={compareUserVenuesStore}
                ghostReactionsStore={compareUserGhostReactionsStore}
                hoveredVenueStore={compareUserHoveredVenueIdStore}
                allowInteractions={$currentChapterIndex === 11}
                compactMode={true}
                previewVenueMove={simulationActions.previewCompareUserVenueMove}
                commitVenueMove={simulationActions.commitCompareUserVenueMove}
              />
            </div>

            <div class="grid-wrapper compare-grid-panel">
              <h3 class="compare-grid-title">Exemplar Policy <span class="tiny-badge tiny-badge-exemplar-strong">Exemplar</span></h3>
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

        {#if $currentChapterIndex === 11}
          <div class="panel chapter11-charts-panel">
            <LiveCharts />
          </div>
        {/if}
      </section>

      <Sidebar showCharts={$currentChapterIndex !== 11} />
    </div>
  {/if}
</main>
