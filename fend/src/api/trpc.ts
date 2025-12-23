import { createTRPCReact } from '@trpc/react-query'
import type { AppRouter } from '../../../bend/src/api/router'

// Create tRPC React hooks
export const trpc = createTRPCReact<AppRouter>()

// Re-export types for convenience
export type { AppRouter }

// Helper type for inferring procedure types
export type RouterInput = AppRouter['_def']['procedures']
export type RouterOutput = AppRouter['_def']['procedures']
