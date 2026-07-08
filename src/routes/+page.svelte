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
    simulationActions
  } from '../stores/simulationStore';
</script>

<main class="exhibit-container">
  <header class="exhibit-header">
    <div class="exhibit-header-grid">
      <div>
        <h1>Segregation Dynamics: An Agent-Based Model</h1>
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
</main>
