import { ref, computed, onMounted } from 'vue'
import { trpc } from '@/api/trpc'

/**
 * GENESIS COMPOSABLE
 *
 * Fetches precipitated HTML from the backend and renders it.
 * The frontend is a viewport - it displays, not computes.
 */

// Cache for precipitated content
const precipitationCache = new Map<string, string>()

/**
 * Precipitate a single atom
 */
export function useAtom(
  component: string,
  content: string = '',
  variant: string = 'default'
) {
  const html = ref('')
  const loading = ref(true)
  const error = ref<Error | null>(null)

  const cacheKey = `atom:${component}:${variant}:${content}`

  async function precipitate() {
    // Check cache
    if (precipitationCache.has(cacheKey)) {
      html.value = precipitationCache.get(cacheKey)!
      loading.value = false
      return
    }

    loading.value = true
    error.value = null

    try {
      const result = await trpc.genesis.atom.query({ component, content, variant })
      html.value = result.html
      precipitationCache.set(cacheKey, result.html)
    } catch (e) {
      error.value = e instanceof Error ? e : new Error(String(e))
    } finally {
      loading.value = false
    }
  }

  onMounted(precipitate)

  return { html, loading, error, precipitate }
}

/**
 * Precipitate a button
 */
export function useButton(label: string, variant: 'primary' | 'secondary' | 'ghost' | 'danger' = 'primary') {
  const html = ref('')
  const loading = ref(true)
  const error = ref<Error | null>(null)

  async function precipitate() {
    loading.value = true
    try {
      const result = await trpc.genesis.button.query({ label, variant })
      html.value = result.html
    } catch (e) {
      error.value = e instanceof Error ? e : new Error(String(e))
    } finally {
      loading.value = false
    }
  }

  onMounted(precipitate)

  return { html, loading, error }
}

/**
 * Precipitate character builder form
 */
export function useCharacterBuilder(campaignId: string) {
  const html = ref('')
  const loading = ref(true)
  const error = ref<Error | null>(null)
  const races = ref<{ id: string; name: string; prime: number }[]>([])
  const classes = ref<{ id: string; name: string; prime: number }[]>([])

  async function loadBuilder() {
    loading.value = true
    error.value = null

    try {
      // Fetch races and classes
      const [racesResult, classesResult] = await Promise.all([
        trpc.genesis.races.query(),
        trpc.genesis.classes.query(),
      ])

      // Map to expected format
      races.value = (racesResult.races || []).map((r: any) => ({
        id: r.id || '',
        name: r.name || '',
        prime: r.prime || 0,
      }))
      classes.value = (classesResult.classes || []).map((c: any) => ({
        id: c.id || '',
        name: c.name || '',
        prime: c.prime || 0,
      }))

      // Fetch the full form - campaignProcedure gets campaignId from header
      const formResult = await trpc.genesis.characterBuilder.query()
      html.value = formResult.html || ''
    } catch (e) {
      error.value = e instanceof Error ? e : new Error(String(e))
    } finally {
      loading.value = false
    }
  }

  onMounted(loadBuilder)

  return { html, loading, error, races, classes, reload: loadBuilder }
}

/**
 * Precipitate custom seed
 */
export function usePrecipitate(
  seed: string,
  content: string = '',
  physics?: {
    mass?: number
    density?: number
    temperature?: number
    charge?: number
    friction?: number
  }
) {
  const html = ref('')
  const loading = ref(true)
  const error = ref<Error | null>(null)

  async function precipitate() {
    loading.value = true
    try {
      const result = await trpc.genesis.precipitate.query({ seed, content, physics })
      html.value = result.html
    } catch (e) {
      error.value = e instanceof Error ? e : new Error(String(e))
    } finally {
      loading.value = false
    }
  }

  onMounted(precipitate)

  return { html, loading, error, precipitate }
}

/**
 * Get available UI components
 */
export function useComponents() {
  const components = ref<{ name: string; seed: string; variants: string[] }[]>([])
  const loading = ref(true)
  const error = ref<Error | null>(null)

  async function load() {
    loading.value = true
    try {
      const result = await trpc.genesis.components.query()
      components.value = result.components
    } catch (e) {
      error.value = e instanceof Error ? e : new Error(String(e))
    } finally {
      loading.value = false
    }
  }

  onMounted(load)

  return { components, loading, error }
}

/**
 * Precipitate a tree of components
 */
export function useTree(
  rootSeed: string,
  children: { seed: string; content: string }[]
) {
  const html = ref('')
  const loading = ref(true)
  const error = ref<Error | null>(null)

  async function precipitate() {
    loading.value = true
    try {
      const result = await trpc.genesis.tree.query({ rootSeed, children })
      html.value = result.html
    } catch (e) {
      error.value = e instanceof Error ? e : new Error(String(e))
    } finally {
      loading.value = false
    }
  }

  onMounted(precipitate)

  return { html, loading, error, precipitate }
}

/**
 * Utility: Render precipitated HTML safely
 */
export function renderPrecipitated(html: string): string {
  // The HTML comes from our trusted backend - safe to render
  return html
}

/**
 * Utility: Clear precipitation cache
 */
export function clearPrecipitationCache() {
  precipitationCache.clear()
}
