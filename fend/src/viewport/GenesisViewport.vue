<script setup lang="ts">
/**
 * GENESIS VIEWPORT
 * =================
 *
 * A dumb container. Receives ONE precipitated world. Displays it.
 *
 * The backend builds:
 *   atoms → molecules → organisms → WORLD
 *
 * We receive: WORLD (complete HTML/CSS)
 * We do: Display it.
 *
 * No imports. No components. Just a viewport.
 */

import { ref, onMounted, onUnmounted } from 'vue'
import { trpc } from '@/api/trpc'

interface Props {
  campaignId: string
  view?: 'world' | 'character-builder' | 'session'
}

const props = withDefaults(defineProps<Props>(), {
  view: 'world'
})

const emit = defineEmits<{
  (e: 'exit'): void
  (e: 'error', error: Error): void
}>()

// The precipitated world - ONE HTML string
const world = ref('')
const isLoading = ref(true)
const error = ref<string | null>(null)

/**
 * Nucleate the world - fetch the complete precipitated HTML
 */
async function nucleate() {
  isLoading.value = true
  error.value = null

  try {
    // Request the world from Genesis
    // Backend precipitates everything and sends ONE payload
    const result = await trpc.genesis.world.query({
      campaignId: props.campaignId,
      view: props.view,
    })

    world.value = result.html
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed to nucleate world'
    emit('error', e instanceof Error ? e : new Error(String(e)))
  } finally {
    isLoading.value = false
  }
}

function handleExit() {
  emit('exit')
}

onMounted(() => {
  nucleate()
})

onUnmounted(() => {
  world.value = ''
})
</script>

<template>
  <div class="genesis-viewport">
    <!-- Loading: reality is precipitating -->
    <div v-if="isLoading" class="viewport-loading">
      <div class="nucleation">
        <div class="nucleus"></div>
        <p>Nucleating reality...</p>
      </div>
    </div>

    <!-- Error: precipitation failed -->
    <div v-else-if="error" class="viewport-error">
      <h2>Nucleation Failed</h2>
      <p>{{ error }}</p>
      <button @click="nucleate">Retry</button>
      <button @click="handleExit">Exit</button>
    </div>

    <!-- The World: just render the HTML -->
    <div
      v-else
      class="viewport-world"
      v-html="world"
    ></div>
  </div>
</template>

<style>
/*
 * VIEWPORT STYLES
 * These are global (not scoped) so precipitated content inherits them
 */

.genesis-viewport {
  position: fixed;
  inset: 0;
  background: #0a0a0f;
  color: #e0e0e0;
  z-index: 1000;
  overflow: auto;

  /* CSS Variables for precipitated content */
  --surface: #1e293b;
  --surface-elevated: #334155;
  --surface-void: transparent;
  --border: #475569;
  --border-subtle: rgba(255, 255, 255, 0.05);

  --energy: #0ea5e9;
  --energy-cold: #334155;
  --energy-warm: #0ea5e9;
  --energy-hot: #f59e0b;
  --energy-critical: #ef4444;
  --energy-fusion: #8b5cf6;

  --text: #f8fafc;
  --text-muted: #94a3b8;
  --text-dim: #64748b;

  --gm-energy: #f59e0b;
  --player-energy: #0ea5e9;
  --npc-energy: #64748b;
}

/* Loading state */
.viewport-loading {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.nucleation {
  text-align: center;
}

.nucleus {
  width: 60px;
  height: 60px;
  margin: 0 auto 1rem;
  border-radius: 50%;
  background: radial-gradient(circle, var(--energy-fusion) 0%, transparent 70%);
  animation: pulse 1.5s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% {
    transform: scale(0.8);
    opacity: 0.5;
  }
  50% {
    transform: scale(1.2);
    opacity: 1;
  }
}

.nucleation p {
  color: var(--text-muted);
  font-size: 0.875rem;
}

/* Error state */
.viewport-error {
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  gap: 1rem;
}

.viewport-error h2 {
  color: var(--energy-critical);
  margin: 0;
}

.viewport-error p {
  color: var(--text-muted);
  margin: 0;
}

.viewport-error button {
  padding: 0.75rem 1.5rem;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--text);
  cursor: pointer;
  transition: all 150ms ease-out;
}

.viewport-error button:hover {
  background: var(--surface-elevated);
  border-color: var(--energy);
}

/* The World container */
.viewport-world {
  min-height: 100%;
  padding: 1rem;
}
</style>
