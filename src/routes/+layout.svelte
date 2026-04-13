<script lang="ts">
  import '../app.css';
  import { user, authLoading } from '$lib/stores/auth';
  import { initJournal, teardownJournal } from '$lib/stores/journal';

  // When user changes, init or teardown journal
  $: if ($user) {
    initJournal($user);
  } else if (!$authLoading) {
    teardownJournal();
  }

</script>

<slot />
