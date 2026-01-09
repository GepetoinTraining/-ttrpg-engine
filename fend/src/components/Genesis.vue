<script setup lang="ts">
/**
 * GENESIS COMPONENT
 *
 * Renders precipitated HTML from the Genesis engine.
 * This is the bridge between topology and display.
 *
 * Usage:
 *   <Genesis seed="2" content="Click me" />
 *   <Genesis :html="precipitatedHtml" />
 */

import { ref, watch, onMounted, computed } from 'vue'
import { trpc } from '@/api/trpc'

interface Props {
  // Option 1: Provide seed and let component precipitate
  seed?: string
  content?: string
  tag?: string
  physics?: {
    mass?: number
    density?: number
    temperature?: number
    charge?: number
    friction?: number
  }

  // Option 2: Provide pre-precipitated HTML
  html?: string
}

const props = withDefaults(defineProps<Props>(), {
  content: '',
  tag: 'div',
})

const precipitatedHtml = ref('')
const loading = ref(false)
const error = ref<Error | null>(null)

// Use provided HTML or precipitate from seed
const shouldPrecipitate = computed(() => !props.html && props.seed)

async function precipitate() {
  if (!props.seed) return

  loading.value = true
  error.value = null

  try {
    const result = await trpc.genesis.precipitate.query({
      seed: props.seed,
      content: props.content,
      tag: props.tag,
      physics: props.physics,
    })
    precipitatedHtml.value = result.html
  } catch (e) {
    error.value = e instanceof Error ? e : new Error(String(e))
  } finally {
    loading.value = false
  }
}

// Watch for seed changes
watch(() => props.seed, () => {
  if (shouldPrecipitate.value) {
    precipitate()
  }
})

// Initial precipitation
onMounted(() => {
  if (shouldPrecipitate.value) {
    precipitate()
  }
})

// Final HTML to render
const finalHtml = computed(() => props.html || precipitatedHtml.value)
</script>

<template>
  <div class="genesis-container">
    <!-- Loading state -->
    <div v-if="loading" class="genesis-loading">
      <span class="genesis-spinner"></span>
    </div>

    <!-- Error state -->
    <div v-else-if="error" class="genesis-error">
      {{ error.message }}
    </div>

    <!-- Rendered content -->
    <div v-else-if="finalHtml" v-html="finalHtml" class="genesis-content"></div>

    <!-- Fallback slot -->
    <slot v-else></slot>
  </div>
</template>

<style scoped>
.genesis-container {
  display: contents;
}

.genesis-loading {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.5rem;
}

.genesis-spinner {
  width: 1rem;
  height: 1rem;
  border: 2px solid var(--border, #333);
  border-top-color: var(--energy-hot, #f59e0b);
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.genesis-error {
  color: var(--energy-critical, #ef4444);
  font-size: 0.875rem;
  padding: 0.5rem;
}

.genesis-content {
  display: contents;
}

/* Genesis content inherits these CSS variables */
.genesis-content :deep(*) {
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
}
</style>
