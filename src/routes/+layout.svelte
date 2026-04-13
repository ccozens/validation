<script lang="ts">
  import '../app.css';
  import { onMount, onDestroy } from 'svelte';
  import { user, authLoading, initAuth } from '$lib/stores/auth';
  import { initJournal, teardownJournal } from '$lib/stores/journal';

  let unsubAuth: (() => void) | null = null;

  onMount(() => {
    unsubAuth = initAuth();
  });

  // When user changes, init or teardown journal
  $: if ($user) {
    initJournal($user);
  } else if (!$authLoading) {
    teardownJournal();
  }

  onDestroy(() => {
    unsubAuth?.();
    teardownJournal();
  });
</script>

<slot />
