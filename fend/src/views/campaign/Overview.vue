<script setup lang="ts">
import { inject } from 'vue'
import { RouterLink } from 'vue-router'
import type { Ref } from 'vue'

const campaign = inject<Ref<any>>('campaign')
const campaignId = inject<Ref<string>>('campaignId')!
</script>

<template>
  <div class="overview">
    <section class="description" v-if="campaign?.description">
      <h2>About</h2>
      <p>{{ campaign.description }}</p>
    </section>

    <section class="quick-actions">
      <h2>Quick Actions</h2>
      <div class="action-grid">
        <RouterLink :to="`/campaign/${campaignId}/characters`" class="action-card">
          <span class="icon">👤</span>
          <h3>Characters</h3>
          <p>View and manage characters</p>
        </RouterLink>

        <RouterLink :to="`/campaign/${campaignId}/world`" class="action-card">
          <span class="icon">🌍</span>
          <h3>World</h3>
          <p>Explore the world map</p>
        </RouterLink>

        <RouterLink :to="`/campaign/${campaignId}/session`" class="action-card">
          <span class="icon">🎲</span>
          <h3>Play</h3>
          <p>Start a game session</p>
        </RouterLink>
      </div>
    </section>

    <section class="campaign-info" v-if="campaign">
      <h2>Campaign Info</h2>
      <dl class="info-list">
        <div class="info-item">
          <dt>Status</dt>
          <dd class="status" :data-status="campaign.status">{{ campaign.status }}</dd>
        </div>
        <div class="info-item">
          <dt>System</dt>
          <dd>{{ campaign.system || 'D&D 5e' }}</dd>
        </div>
        <div class="info-item">
          <dt>Created</dt>
          <dd>{{ new Date(campaign.createdAt).toLocaleDateString() }}</dd>
        </div>
      </dl>
    </section>
  </div>
</template>

<style scoped>
.overview {
  max-width: 900px;
}

section {
  margin-bottom: 2.5rem;
}

section h2 {
  font-size: 1.25rem;
  margin: 0 0 1rem;
  color: var(--text-muted);
}

.description p {
  line-height: 1.6;
  color: var(--text);
}

.action-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
}

.action-card {
  padding: 1.5rem;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 12px;
  text-decoration: none;
  color: inherit;
  transition: all 150ms ease-out;
}

.action-card:hover {
  border-color: var(--energy-hot);
  transform: translateY(-2px);
}

.action-card .icon {
  font-size: 2rem;
  display: block;
  margin-bottom: 0.75rem;
}

.action-card h3 {
  margin: 0 0 0.25rem;
  font-size: 1rem;
}

.action-card p {
  margin: 0;
  font-size: 0.875rem;
  color: var(--text-muted);
}

.info-list {
  margin: 0;
  display: flex;
  flex-wrap: wrap;
  gap: 2rem;
}

.info-item {
  min-width: 120px;
}

.info-item dt {
  font-size: 0.75rem;
  color: var(--text-dim);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: 0.25rem;
}

.info-item dd {
  margin: 0;
  font-weight: 500;
}

.status {
  text-transform: capitalize;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  background: var(--surface-elevated);
  font-size: 0.875rem;
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
