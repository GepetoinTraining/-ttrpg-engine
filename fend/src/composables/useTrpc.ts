import { ref, onMounted } from 'vue'
import { trpc } from '@/api/trpc'

/**
 * Composable for tRPC queries in Vue components
 * Provides loading, error, and data states
 */
export function useQuery<T>(
  queryFn: () => Promise<T>,
  options: { immediate?: boolean } = { immediate: true }
) {
  const data = ref<T | null>(null) as { value: T | null }
  const loading = ref(false)
  const error = ref<Error | null>(null)

  async function execute() {
    loading.value = true
    error.value = null
    try {
      data.value = await queryFn()
    } catch (e) {
      error.value = e instanceof Error ? e : new Error(String(e))
    } finally {
      loading.value = false
    }
  }

  async function refetch() {
    return execute()
  }

  if (options.immediate) {
    onMounted(execute)
  }

  return { data, loading, error, execute, refetch }
}

/**
 * Composable for tRPC mutations
 */
export function useMutation<TInput, TOutput>(
  mutationFn: (input: TInput) => Promise<TOutput>
) {
  const loading = ref(false)
  const error = ref<Error | null>(null)

  async function mutate(input: TInput): Promise<TOutput | null> {
    loading.value = true
    error.value = null
    try {
      return await mutationFn(input)
    } catch (e) {
      error.value = e instanceof Error ? e : new Error(String(e))
      return null
    } finally {
      loading.value = false
    }
  }

  return { mutate, loading, error }
}

// Export trpc client for direct use
export { trpc }
