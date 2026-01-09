<script setup lang="ts">
import { inject, computed } from 'vue'
import { RouterLink } from 'vue-router'
import { useQuery, trpc } from '@/composables/useTrpc'
import type { Ref } from 'vue'

const campaignId = inject<Ref<string>>('campaignId')!

// Fetch characters in this campaign
const { data: characters, loading, error, refetch } = useQuery(
  () => trpc.character.list.query({ campaignId: campaignId.value })
)

// Group by owner for display
const charactersByOwner = computed(() => {
  if (!characters.value) return {}

  const grouped: Record<string, typeof characters.value> = {}
  for (const char of characters.value) {
    const owner = char.ownerId || 'npc'
    if (!grouped[owner]) grouped[owner] = []
    grouped[owner].push(char)
  }
  return grouped
})
</script>

<template>
  <div class="characters-view">
    <header class="view-header">
      <h2>Characters</h2>
      <RouterLink
        :to="`/campaign/${campaignId}/characters/new`"
        class="btn btn-primary"
      >
        New Character
      </RouterLink>
    </header>

    <!-- Loading -->
    <div v-if="loading" class="loading">
      Loading characters...
    </div>

    <!-- Error -->
    <div v-else-if="error" class="error">
      <p>Failed to load characters</p>
      <button class="btn" @click="refetch">Retry</button>
    </div>

    <!-- Empty -->
    <div v-else-if="!characters?.length" class="empty-state">
      <h3>No characters yet</h3>
      <p>Create your first character to join the adventure.</p>
      <RouterLink
        :to="`/campaign/${campaignId}/characters/new`"
        class="btn btn-primary"
      >
        Create Character
      </RouterLink>
    </div>

    <!-- Character list -->
    <div v-else class="characters-grid">
      <div
        v-for="character in characters"
        :key="character.id"
        class="character-card"
      >
        <div class="avatar">
          {{ character.name.charAt(0).toUpperCase() }}
        </div>
        <div class="info">
          <h3>{{ character.name }}</h3>
          <p class="class-race">
            Level {{ character.level || 1 }}
            {{ character.race || 'Unknown' }}
            {{ character.class || 'Adventurer' }}
          </p>
          <div class="stats">
            <span class="hp" :class="{ low: (character.currentHp || 0) < (character.maxHp || 1) / 2 }">
              HP: {{ character.currentHp || 0 }}/{{ character.maxHp || 0 }}
            </span>
            <span class="status" :data-status="character.status">
              {{ character.status || 'active' }}
            </span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.characters-view {
  max-width: 1000px;
}

.view-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
}

.view-header h2 {
  margin: 0;
}

.btn {
  padding: 0.75rem 1.5rem;
  border-radius: 8px;
  border: none;
  font-weight: 500;
  cursor: pointer;
  transition: all 150ms ease-out;
  text-decoration: none;
}

.btn-primary {
  background: var(--energy-hot);
  color: var(--surface);
}

.btn-primary:hover {
  background: var(--energy-warm);
}

.loading,
.error,
.empty-state {
  text-align: center;
  padding: 4rem 2rem;
  color: var(--text-muted);
}

.empty-state h3 {
  color: var(--text);
  margin-bottom: 0.5rem;
}

.empty-state .btn {
  margin-top: 1.5rem;
}

.characters-grid {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.character-card {
  display: flex;
  gap: 1rem;
  padding: 1rem;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 12px;
  transition: all 150ms ease-out;
}

.character-card:hover {
  border-color: var(--energy-warm);
}

.avatar {
  width: 60px;
  height: 60px;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--energy-hot), var(--energy-warm));
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.5rem;
  font-weight: 600;
  color: var(--surface);
  flex-shrink: 0;
}

.info {
  flex: 1;
  min-width: 0;
}

.info h3 {
  margin: 0 0 0.25rem;
  font-size: 1.125rem;
}

.class-race {
  margin: 0 0 0.5rem;
  color: var(--text-muted);
  font-size: 0.875rem;
}

.stats {
  display: flex;
  gap: 1rem;
  font-size: 0.875rem;
}

.hp {
  color: var(--text-muted);
}

.hp.low {
  color: var(--energy-critical, #ef4444);
}

.status {
  padding: 0.125rem 0.5rem;
  border-radius: 4px;
  background: var(--surface-elevated);
  text-transform: capitalize;
  font-size: 0.75rem;
}

.status[data-status="active"] {
  background: var(--energy-warm);
  color: var(--surface);
}

.status[data-status="dead"] {
  background: var(--energy-critical, #ef4444);
  color: white;
}
</style>
