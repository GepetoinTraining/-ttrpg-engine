<script setup lang="ts">
import { inject } from 'vue'
import { useQuery, trpc } from '@/composables/useTrpc'
import type { Ref } from 'vue'

const campaignId = inject<Ref<string>>('campaignId')!

// Fetch world nodes for this campaign
const { data: nodes, loading, error, refetch } = useQuery(
  () => trpc.world.listNodes.query({ campaignId: campaignId.value })
)

// Group nodes by type
function getNodesByType(type: string) {
  return nodes.value?.filter(n => n.type === type) || []
}
</script>

<template>
  <div class="world-view">
    <header class="view-header">
      <h2>World</h2>
    </header>

    <!-- Loading -->
    <div v-if="loading" class="loading">
      Loading world data...
    </div>

    <!-- Error -->
    <div v-else-if="error" class="error">
      <p>Failed to load world</p>
      <button class="btn" @click="refetch">Retry</button>
    </div>

    <!-- Empty -->
    <div v-else-if="!nodes?.length" class="empty-state">
      <h3>World not seeded</h3>
      <p>The world hasn't been created yet. A GM needs to seed the world geography.</p>
    </div>

    <!-- World tree -->
    <div v-else class="world-tree">
      <!-- Continents -->
      <section v-if="getNodesByType('continent').length">
        <h3>Continents</h3>
        <div class="node-list">
          <div
            v-for="node in getNodesByType('continent')"
            :key="node.id"
            class="node-card continent"
          >
            <h4>{{ node.name }}</h4>
            <p v-if="node.dataStatic?.description">
              {{ node.dataStatic.description }}
            </p>
          </div>
        </div>
      </section>

      <!-- Regions -->
      <section v-if="getNodesByType('region').length">
        <h3>Regions</h3>
        <div class="node-list">
          <div
            v-for="node in getNodesByType('region')"
            :key="node.id"
            class="node-card region"
          >
            <h4>{{ node.name }}</h4>
            <span class="terrain" v-if="node.dataStatic?.terrain">
              {{ node.dataStatic.terrain }}
            </span>
          </div>
        </div>
      </section>

      <!-- Settlements -->
      <section v-if="getNodesByType('settlement').length">
        <h3>Settlements</h3>
        <div class="node-list">
          <div
            v-for="node in getNodesByType('settlement')"
            :key="node.id"
            class="node-card settlement"
          >
            <h4>{{ node.name }}</h4>
            <span class="size" v-if="node.dataStatic?.size">
              {{ node.dataStatic.size }}
            </span>
          </div>
        </div>
      </section>

      <!-- POIs -->
      <section v-if="getNodesByType('poi').length">
        <h3>Points of Interest</h3>
        <div class="node-list">
          <div
            v-for="node in getNodesByType('poi')"
            :key="node.id"
            class="node-card poi"
          >
            <h4>{{ node.name }}</h4>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.world-view {
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

.btn {
  padding: 0.75rem 1.5rem;
  border-radius: 8px;
  border: none;
  font-weight: 500;
  cursor: pointer;
  margin-top: 1rem;
}

.world-tree section {
  margin-bottom: 2rem;
}

.world-tree h3 {
  font-size: 1rem;
  color: var(--text-muted);
  margin: 0 0 1rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.node-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 1rem;
}

.node-card {
  padding: 1rem;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 8px;
  transition: all 150ms ease-out;
}

.node-card:hover {
  border-color: var(--energy-warm);
}

.node-card h4 {
  margin: 0 0 0.25rem;
  font-size: 1rem;
}

.node-card p {
  margin: 0;
  font-size: 0.875rem;
  color: var(--text-muted);
}

.terrain,
.size {
  font-size: 0.75rem;
  color: var(--text-dim);
  text-transform: capitalize;
}

.node-card.continent {
  border-left: 3px solid var(--energy-hot);
}

.node-card.region {
  border-left: 3px solid var(--energy-warm);
}

.node-card.settlement {
  border-left: 3px solid var(--energy);
}

.node-card.poi {
  border-left: 3px solid var(--text-muted);
}
</style>
