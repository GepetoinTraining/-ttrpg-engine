<script setup lang="ts">
import { computed, provide, watch, onUnmounted } from 'vue'
import { RouterLink, RouterView, useRoute } from 'vue-router'
import { useQuery, trpc } from '@/composables/useTrpc'
import { useCampaignStore } from '@/stores/campaign'

const route = useRoute()
const campaignStore = useCampaignStore()
const campaignId = computed(() => route.params.id as string)

// Set campaign context when route changes
watch(campaignId, (id) => {
  if (id) {
    campaignStore.setCampaign(id)
  }
}, { immediate: true })

// Clear campaign context when leaving
onUnmounted(() => {
  campaignStore.clearCampaign()
})

// Fetch campaign data
const { data: campaign, loading, error } = useQuery(
  () => trpc.campaign.get.query({ id: campaignId.value })
)

// Provide campaign to child routes
provide('campaign', campaign)
provide('campaignId', campaignId)

const tabs = [
  { name: 'Overview', path: '', routeName: 'campaign-overview' },
  { name: 'Characters', path: 'characters', routeName: 'campaign-characters' },
  { name: 'World', path: 'world', routeName: 'campaign-world' },
  { name: 'Session', path: 'session', routeName: 'campaign-session' },
]
</script>

<template>
  <div class="campaign-layout">
    <header class="campaign-header">
      <RouterLink to="/campaigns" class="back-link">&larr; Campaigns</RouterLink>

      <template v-if="loading">
        <h1 class="loading-title">Loading...</h1>
      </template>

      <template v-else-if="error">
        <h1 class="error-title">Error loading campaign</h1>
      </template>

      <template v-else-if="campaign">
        <h1>{{ campaign.name }}</h1>
        <p v-if="campaign.tagline" class="tagline">{{ campaign.tagline }}</p>
      </template>
    </header>

    <nav class="campaign-tabs">
      <RouterLink
        v-for="tab in tabs"
        :key="tab.name"
        :to="`/campaign/${campaignId}/${tab.path}`"
        class="tab"
        :class="{ active: route.name === tab.routeName }"
      >
        {{ tab.name }}
      </RouterLink>
    </nav>

    <main class="campaign-content">
      <div v-if="loading" class="loading-content">
        Loading campaign data...
      </div>
      <div v-else-if="error" class="error-content">
        <p>Failed to load campaign</p>
        <RouterLink to="/campaigns" class="btn">Back to Campaigns</RouterLink>
      </div>
      <RouterView v-else />
    </main>
  </div>
</template>

<style scoped>
.campaign-layout {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.campaign-header {
  padding: 1.5rem 2rem;
  border-bottom: 1px solid var(--border);
}

.back-link {
  font-size: 0.875rem;
  color: var(--text-muted);
  margin-bottom: 0.5rem;
  display: inline-block;
  text-decoration: none;
}

.back-link:hover {
  color: var(--text);
}

.campaign-header h1 {
  margin: 0.5rem 0 0;
}

.loading-title,
.error-title {
  color: var(--text-muted);
}

.tagline {
  margin: 0.5rem 0 0;
  color: var(--text-muted);
  font-size: 1rem;
}

.campaign-tabs {
  display: flex;
  gap: 0;
  border-bottom: 1px solid var(--border);
  padding: 0 2rem;
}

.tab {
  padding: 1rem 1.5rem;
  color: var(--text-muted);
  text-decoration: none;
  border-bottom: 2px solid transparent;
  transition: all 150ms ease-out;
}

.tab:hover {
  color: var(--text);
}

.tab.active {
  color: var(--energy-hot);
  border-bottom-color: var(--energy-hot);
}

.campaign-content {
  flex: 1;
  padding: 2rem;
}

.loading-content,
.error-content {
  text-align: center;
  padding: 4rem;
  color: var(--text-muted);
}

.error-content .btn {
  margin-top: 1rem;
  display: inline-block;
  padding: 0.75rem 1.5rem;
  background: var(--surface-elevated);
  border-radius: 8px;
  text-decoration: none;
  color: var(--text);
}
</style>
