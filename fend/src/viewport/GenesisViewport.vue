<script setup lang="ts">
/**
 * GENESIS VIEWPORT
 * =================
 *
 * A dumb container. Receives ONE precipitated world. Displays it.
 * Handles event delegation for precipitated content via data-dest-* attributes.
 *
 * The backend builds:
 *   atoms → molecules → organisms → WORLD
 *
 * We receive: WORLD (complete HTML/CSS)
 * We do: Display it, delegate events back to the system.
 *
 * Event delegation protocol:
 *   data-dest-type="route"    → router.push(data-dest)
 *   data-dest-type="event"    → emit or dispatch custom event
 *   data-dest-type="mutation" → call trpc mutation
 *   data-dest-type="action"   → local viewport action (e.g. toggle, select)
 */

import { ref, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
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
  (e: 'navigate', dest: string): void
}>()

const router = useRouter()

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

/**
 * Find the nearest ancestor (or self) with a data-dest-type attribute
 */
function findDestElement(target: HTMLElement, boundary: HTMLElement): HTMLElement | null {
  let el: HTMLElement | null = target
  while (el && el !== boundary) {
    if (el.dataset.destType) return el
    el = el.parentElement
  }
  return null
}

/**
 * Handle click delegation from precipitated content
 */
function handleWorldClick(event: MouseEvent) {
  const target = event.target as HTMLElement
  const boundary = event.currentTarget as HTMLElement
  const destEl = findDestElement(target, boundary)
  if (!destEl) return

  const destType = destEl.dataset.destType
  const dest = destEl.dataset.dest
  const paramsRaw = destEl.dataset.destParams

  if (!destType || !dest) return

  // Parse optional params
  let params: Record<string, string> = {}
  if (paramsRaw) {
    try { params = JSON.parse(paramsRaw) } catch { /* ignore bad JSON */ }
  }

  switch (destType) {
    case 'route':
      // Navigate to a Vue Router route
      // dest can be a route name or path; params are passed as query/params
      router.push({
        name: dest,
        params: { id: props.campaignId, ...params },
      })
      break

    case 'event':
      // Dispatch a known event
      if (dest === 'genesis:exit') {
        emit('exit')
      } else if (dest === 'genesis:reload') {
        nucleate()
      } else {
        // Generic custom event
        window.dispatchEvent(new CustomEvent(dest, { detail: { campaignId: props.campaignId, ...params } }))
      }
      break

    case 'mutation': {
      // If this is a submit button linked to a form, let the form submit handler deal with it
      const isSubmit = destEl.getAttribute('type') === 'submit'
      if (isSubmit) break
      // Otherwise, handle as a direct mutation (no-payload button triggers)
      handleMutation(dest, params)
      break
    }

    case 'action':
      // Local viewport actions (UI state changes within precipitated content)
      handleAction(dest, params, destEl)
      break
  }
}

/**
 * Handle a tRPC mutation from a button click
 */
async function handleMutation(dest: string, params: Record<string, string>) {
  try {
    const [routerName, methodName] = dest.split('.')
    if (!routerName || !methodName) return

    // Access the trpc router dynamically
    const trpcRouter = (trpc as any)[routerName]
    if (!trpcRouter || !trpcRouter[methodName]) {
      console.warn(`[Genesis] Unknown mutation: ${dest}`)
      return
    }

    await trpcRouter[methodName].mutate({
      campaignId: props.campaignId,
      ...params,
    })
  } catch (e) {
    console.error(`[Genesis] Mutation ${dest} failed:`, e)
    emit('error', e instanceof Error ? e : new Error(String(e)))
  }
}

/**
 * Handle local viewport actions (toggle selections, etc.)
 */
function handleAction(action: string, params: Record<string, string>, el: HTMLElement) {
  switch (action) {
    case 'setAlignment': {
      // Deselect all alignment buttons, select this one
      const grid = el.closest('[style*="grid"]') || el.parentElement
      if (grid) {
        grid.querySelectorAll<HTMLElement>('button[data-dest="setAlignment"]').forEach(btn => {
          btn.style.borderColor = '#475569'
          btn.style.background = '#1e293b'
          btn.style.color = '#94a3b8'
        })
      }
      el.style.borderColor = '#f59e0b'
      el.style.background = 'rgba(245,158,11,0.2)'
      el.style.color = '#f59e0b'
      break
    }
  }
}

/**
 * Handle form submission from precipitated content
 */
async function handleWorldSubmit(event: Event) {
  event.preventDefault()
  const form = event.target as HTMLFormElement

  // Find the submit button to determine the mutation target
  const submitBtn = form.querySelector<HTMLElement>('button[type="submit"][data-dest-type="mutation"]')
    || form.parentElement?.querySelector<HTMLElement>('button[type="submit"][data-dest-type="mutation"]')

  // Also check footer siblings (submit button may be outside the form element)
  const viewport = form.closest('.viewport-world')
  const footerSubmitBtn = viewport?.querySelector<HTMLElement>('footer button[data-dest-type="mutation"]')

  const mutationBtn = submitBtn || footerSubmitBtn
  const dest = mutationBtn?.dataset.dest
  if (!dest) {
    console.warn('[Genesis] Form submit with no mutation target')
    return
  }

  // Collect form data
  const formData = new FormData(form)
  const data: Record<string, any> = {}
  formData.forEach((value, key) => {
    data[key] = value
  })

  // Route to the correct mutation
  if (dest === 'character.birth') {
    await handleCharacterBirth(data)
  } else {
    await handleMutation(dest, data)
  }
}

/**
 * Character birth - special handling to parse form data into the correct shape
 */
async function handleCharacterBirth(data: Record<string, any>) {
  try {
    const abilityScores = {
      strength: parseInt(data.strength) || 10,
      dexterity: parseInt(data.dexterity) || 10,
      constitution: parseInt(data.constitution) || 10,
      intelligence: parseInt(data.intelligence) || 10,
      wisdom: parseInt(data.wisdom) || 10,
      charisma: parseInt(data.charisma) || 10,
    }

    const result = await trpc.character.birthGenesis.mutate({
      name: data.name || 'Unnamed',
      race: data.race || 'human',
      class: data.class || 'fighter',
      background: data.background || undefined,
      abilityScores,
    })

    // On success, navigate to the character list
    router.push({
      name: 'campaign-characters',
      params: { id: props.campaignId },
    })
  } catch (e) {
    console.error('[Genesis] Character birth failed:', e)
    emit('error', e instanceof Error ? e : new Error(String(e)))
  }
}

/**
 * Listen for genesis:exit custom events (from inline onclick in older content)
 */
function onGenesisExit() {
  emit('exit')
}

function handleExit() {
  emit('exit')
}

onMounted(() => {
  nucleate()
  window.addEventListener('genesis:exit', onGenesisExit)
})

onUnmounted(() => {
  world.value = ''
  window.removeEventListener('genesis:exit', onGenesisExit)
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

    <!-- The World: render the HTML, delegate events -->
    <div
      v-else
      class="viewport-world"
      v-html="world"
      @click="handleWorldClick"
      @submit="handleWorldSubmit"
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

/* The World container - positioned for WorldSurface (absolute) to anchor to */
.viewport-world {
  position: relative;
  width: 100%;
  height: 100%;
}
</style>
