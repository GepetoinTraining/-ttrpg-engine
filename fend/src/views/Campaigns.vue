<script setup lang="ts">
import { RouterLink, useRouter } from 'vue-router'
import { useQuery, useMutation, trpc } from '@/composables/useTrpc'

const router = useRouter()

// Fetch campaigns from API
const { data: campaigns, loading, error, refetch } = useQuery(
  () => trpc.campaign.list.query()
)

// Create campaign mutation
const { mutate: createCampaign, loading: creating } = useMutation(
  (input: { name: string; description?: string }) => trpc.campaign.create.mutate(input)
)

async function handleNewCampaign() {
  const name = prompt('Campaign name:')
  if (!name) return

  const campaign = await createCampaign({ name })
  if (campaign) {
    await refetch()
    router.push(`/campaign/${campaign.id}`)
  }
}
</script>

<template>
  <div class="campaigns-page">
    <header class="page-header">
      <h1>Your Campaigns</h1>
      <button
        class="btn btn-primary"
        :disabled="creating"
        @click="handleNewCampaign"
      >
        {{ creating ? 'Creating...' : 'New Campaign' }}
      </button>
    </header>

    <!-- Loading state -->
    <div v-if="loading" class="loading">
      Loading campaigns...
    </div>

    <!-- Error state -->
    <div v-else-if="error" class="error">
      <p>Failed to load campaigns</p>
      <button class="btn" @click="refetch">Retry</button>
    </div>

    <!-- Empty state -->
    <div v-else-if="!campaigns?.length" class="empty-state">
      <h2>No campaigns yet</h2>
      <p>Create your first campaign to get started.</p>
      <button class="btn btn-primary" @click="handleNewCampaign">
        Create Campaign
      </button>
    </div>

    <!-- Campaign grid -->
    <div v-else class="campaigns-grid">
      <RouterLink
        v-for="campaign in campaigns"
        :key="campaign.id"
        :to="`/campaign/${campaign.id}`"
        class="campaign-card"
      >
        <h2>{{ campaign.name }}</h2>
        <p>{{ campaign.description || 'No description' }}</p>
        <div class="meta">
          <span class="status" :data-status="campaign.status">
            {{ campaign.status }}
          </span>
        </div>
      </RouterLink>
    </div>
  </div>
</template>

<style scoped>
.campaigns-page {
  padding: 2rem;
  max-width: 1200px;
  margin: 0 auto;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
}

.page-header h1 {
  margin: 0;
}

.btn {
  padding: 0.75rem 1.5rem;
  border-radius: 8px;
  border: none;
  font-weight: 500;
  cursor: pointer;
  transition: all 150ms ease-out;
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-primary {
  background: var(--energy-hot);
  color: var(--surface);
}

.btn-primary:hover:not(:disabled) {
  background: var(--energy-warm);
}

.loading,
.error,
.empty-state {
  text-align: center;
  padding: 4rem 2rem;
  color: var(--text-muted);
}

.error {
  color: var(--energy-critical, #ef4444);
}

.error button {
  margin-top: 1rem;
}

.empty-state h2 {
  margin-bottom: 0.5rem;
  color: var(--text);
}

.empty-state button {
  margin-top: 1.5rem;
}

.campaigns-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 1.5rem;
}

.campaign-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 1.5rem;
  text-decoration: none;
  color: inherit;
  transition: all 150ms ease-out;
}

.campaign-card:hover {
  border-color: var(--energy-hot);
  transform: translateY(-4px);
}

.campaign-card h2 {
  margin: 0 0 0.5rem;
  font-size: 1.25rem;
}

.campaign-card p {
  color: var(--text-muted);
  margin: 0 0 1rem;
}

.meta {
  font-size: 0.875rem;
}

.status {
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  background: var(--surface-elevated);
  text-transform: capitalize;
}

.status[data-status="active"] {
  background: var(--energy-hot);
  color: var(--surface);
}

.status[data-status="planning"] {
  background: var(--energy-warm);
  color: var(--surface);
}
</style>
