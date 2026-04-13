<script lang="ts">
  import { user, authLoading, authError, signIn, signOut } from '$lib/stores/auth';
  import {
    entries,
    daySummaries,
    weekSummaries,
    journalLoading,
    summaryLoading,
    addEntry,
    saveDaySummary,
    saveWeekSummary,
    groupEntriesByDate,
    getEntriesForCurrentWeek,
    getCurrentWeekRange,
    toDateStr,
    formatDisplayDate,
    formatTime,
  } from '$lib/stores/journal';
  import { generateDaySummary, generateWeekSummary } from '$lib/utils/gemini';

  let entryText = '';
  let submitting = false;
  let endOfDayLoading = false;
  let weekSummaryLoading = false;
  let errorMsg = '';
  let view: 'write' | 'history' = 'write';

  // Today's date string
  $: todayStr = toDateStr(new Date());

  // Grouped entries for history view
  $: groupedDays = groupEntriesByDate($entries, $daySummaries);

  // Today's entries
  $: todayEntries = $entries.filter((e) => toDateStr(e.createdAt) === todayStr);

  // Today's summary if it exists
  $: todaySummary = $daySummaries.find((s) => s.date === todayStr) ?? null;

  // Current week summary
  $: {
    const { startStr } = getCurrentWeekRange();
    currentWeekSummary = $weekSummaries.find((s) => s.weekStart === startStr) ?? null;
  }
  let currentWeekSummary: (typeof $weekSummaries)[0] | null = null;

  async function handleAddEntry() {
    if (!entryText.trim() || !$user) return;
    submitting = true;
    errorMsg = '';
    try {
      await addEntry($user, entryText.trim());
      entryText = '';
    } catch (e) {
      errorMsg = 'Failed to save entry. Please try again.';
    } finally {
      submitting = false;
    }
  }

  async function handleEndOfDay() {
    if (!$user || todayEntries.length === 0) return;
    endOfDayLoading = true;
    errorMsg = '';
    try {
      const summary = await generateDaySummary(
        todayStr,
        todayEntries.map((e) => e.text)
      );
      await saveDaySummary($user, todayStr, summary);
    } catch (e) {
      errorMsg = 'Failed to generate summary. Check your Gemini API key.';
    } finally {
      endOfDayLoading = false;
    }
  }

  async function handleWeekSummary() {
    if (!$user) return;
    weekSummaryLoading = true;
    errorMsg = '';
    try {
      const { startStr, endStr, start, end } = getCurrentWeekRange();
      const weekEntries = $entries.filter((e) => e.createdAt >= start && e.createdAt <= end);

      if (weekEntries.length === 0) {
        errorMsg = 'No entries found for this week yet.';
        weekSummaryLoading = false;
        return;
      }

      // Group by day
      const byDay = new Map<string, string[]>();
      for (const e of weekEntries) {
        const d = toDateStr(e.createdAt);
        if (!byDay.has(d)) byDay.set(d, []);
        byDay.get(d)!.push(e.text);
      }

      const entriesByDay = [...byDay.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, entries]) => ({ date, entries }));

      const summary = await generateWeekSummary(startStr, endStr, entriesByDay);
      await saveWeekSummary($user, startStr, endStr, summary);
    } catch (e) {
      errorMsg = 'Failed to generate weekly summary. Check your Gemini API key.';
    } finally {
      weekSummaryLoading = false;
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      handleAddEntry();
    }
  }
</script>

{#if $authLoading}
  <!-- Loading splash -->
  <div class="min-h-screen bg-stone-50 flex items-center justify-center">
    <div class="text-stone-400 font-sans text-sm animate-pulse">Loading…</div>
  </div>

{:else if !$user}
  <!-- Sign in screen -->
  <div class="min-h-screen bg-stone-50 flex flex-col items-center justify-center px-6">
    <div class="max-w-sm w-full text-center space-y-8">
      <div class="space-y-2">
        <h1 class="text-3xl font-medium text-stone-800 italic">Journal</h1>
        <p class="text-stone-500 font-sans text-sm leading-relaxed">
          A quiet place to note your day.
        </p>
      </div>

      {#if $authError}
        <p class="text-red-500 font-sans text-sm bg-red-50 rounded-xl px-4 py-3">{$authError}</p>
      {/if}

      <button
        on:click={signIn}
        class="w-full flex items-center justify-center gap-3 bg-white border border-stone-200
               text-stone-700 font-sans text-sm font-medium px-5 py-3 rounded-xl
               hover:bg-stone-50 active:bg-stone-100 transition-colors shadow-sm"
      >
        <svg class="w-4 h-4" viewBox="0 0 24 24">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
        </svg>
        Sign in with Google
      </button>
    </div>
  </div>

{:else}
  <!-- Main app -->
  <div class="min-h-screen bg-stone-50 flex flex-col max-w-lg mx-auto">

    <!-- Header -->
    <header class="px-5 pt-8 pb-4 flex items-start justify-between">
      <div>
        <h1 class="text-2xl font-medium text-stone-800 italic">Journal</h1>
        <p class="text-stone-400 font-mono text-xs mt-0.5">
          {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
        </p>
      </div>
      <button on:click={signOut} class="btn-ghost mt-1">Sign out</button>
    </header>

    <!-- Tab bar -->
    <div class="px-5 mb-4 flex gap-2">
      <button
        on:click={() => (view = 'write')}
        class="font-sans text-sm px-4 py-1.5 rounded-full transition-colors
               {view === 'write' ? 'bg-stone-800 text-white' : 'text-stone-500 hover:text-stone-700'}"
      >
        Today
      </button>
      <button
        on:click={() => (view = 'history')}
        class="font-sans text-sm px-4 py-1.5 rounded-full transition-colors
               {view === 'history' ? 'bg-stone-800 text-white' : 'text-stone-500 hover:text-stone-700'}"
      >
        History
      </button>
    </div>

    <main class="flex-1 px-5 pb-10 space-y-4">

      {#if view === 'write'}

        <!-- Entry input -->
        <div class="card p-4 space-y-3">
          <textarea
            bind:value={entryText}
            on:keydown={handleKeydown}
            placeholder="What's going on…"
            rows={4}
            class="w-full bg-transparent text-stone-800 placeholder-stone-300
                   font-sans text-sm leading-relaxed focus:outline-none"
          ></textarea>
          <div class="flex items-center justify-between">
            <span class="font-mono text-xs text-stone-300">⌘↵ to save</span>
            <button
              on:click={handleAddEntry}
              disabled={!entryText.trim() || submitting}
              class="btn-primary"
            >
              {submitting ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>

        {#if errorMsg}
          <p class="font-sans text-sm text-red-500 bg-red-50 rounded-xl px-4 py-3 animate-fade-in">
            {errorMsg}
          </p>
        {/if}

        <!-- Today's entries -->
        {#if $journalLoading}
          <p class="font-sans text-sm text-stone-400 text-center py-4 animate-pulse">Loading…</p>
        {:else if todayEntries.length > 0}
          <div class="space-y-2">
            {#each todayEntries as entry (entry.id)}
              <div class="card px-4 py-3 animate-slide-up">
                <p class="text-stone-700 font-sans text-sm leading-relaxed">{entry.text}</p>
                <p class="font-mono text-xs text-stone-300 mt-1.5">{formatTime(entry.createdAt)}</p>
              </div>
            {/each}
          </div>

          <!-- Today's summary -->
          {#if todaySummary}
            <div class="summary-card animate-fade-in">
              <p class="font-mono text-xs text-sage-500 mb-2 uppercase tracking-wider">End of day</p>
              <p class="text-stone-700 font-sans text-sm leading-relaxed italic">{todaySummary.summary}</p>
            </div>
          {:else}
            <button
              on:click={handleEndOfDay}
              disabled={endOfDayLoading}
              class="btn-secondary w-full"
            >
              {endOfDayLoading ? 'Reflecting…' : 'End of day'}
            </button>
          {/if}

        {:else}
          <div class="text-center py-10 space-y-1">
            <p class="text-stone-400 font-sans text-sm">Nothing logged yet today.</p>
            <p class="text-stone-300 font-sans text-xs">Write anything — a fragment is enough.</p>
          </div>
        {/if}

        <!-- Weekly summary section -->
        <div class="pt-2 border-t border-stone-100 space-y-3">
          <p class="font-mono text-xs text-stone-400 uppercase tracking-wider">This week</p>

          {#if currentWeekSummary}
            <div class="summary-card animate-fade-in">
              <p class="font-mono text-xs text-sage-500 mb-2 uppercase tracking-wider">Weekly summary</p>
              <p class="text-stone-700 font-sans text-sm leading-relaxed italic">{currentWeekSummary.summary}</p>
            </div>
            <button
              on:click={handleWeekSummary}
              disabled={weekSummaryLoading}
              class="btn-ghost w-full text-center"
            >
              {weekSummaryLoading ? 'Reflecting…' : 'Regenerate summary'}
            </button>
          {:else}
            <button
              on:click={handleWeekSummary}
              disabled={weekSummaryLoading}
              class="btn-secondary w-full"
            >
              {weekSummaryLoading ? 'Reflecting on your week…' : 'Summarise my week'}
            </button>
          {/if}
        </div>

      {:else}
        <!-- History view -->
        {#if $journalLoading}
          <p class="font-sans text-sm text-stone-400 text-center py-8 animate-pulse">Loading…</p>
        {:else if groupedDays.size === 0}
          <div class="text-center py-10">
            <p class="text-stone-400 font-sans text-sm">No entries yet.</p>
          </div>
        {:else}
          <div class="space-y-6">
            {#each [...groupedDays.entries()] as [dateStr, { entries: dayEntries, summary }] (dateStr)}
              <div class="space-y-2 animate-fade-in">
                <h2 class="font-mono text-xs text-stone-400 uppercase tracking-wider">
                  {formatDisplayDate(dateStr)}
                </h2>

                {#each dayEntries as entry (entry.id)}
                  <div class="card px-4 py-3">
                    <p class="text-stone-700 font-sans text-sm leading-relaxed">{entry.text}</p>
                    <p class="font-mono text-xs text-stone-300 mt-1.5">{formatTime(entry.createdAt)}</p>
                  </div>
                {/each}

                {#if summary}
                  <div class="summary-card">
                    <p class="font-mono text-xs text-sage-500 mb-1.5 uppercase tracking-wider">End of day</p>
                    <p class="text-stone-700 font-sans text-sm leading-relaxed italic">{summary.summary}</p>
                  </div>
                {/if}
              </div>
            {/each}
          </div>
        {/if}
      {/if}

    </main>
  </div>
{/if}
