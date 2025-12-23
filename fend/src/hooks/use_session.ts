import { trpc } from '@api/trpc'
import { useRoom, useRealtime } from '@api/websocket'
import { useCallback } from 'react'

export function useSession(sessionId: string) {
  const query = trpc.session.get.useQuery({ sessionId }, { enabled: !!sessionId })

  // Join session room for realtime
  useRoom('session', sessionId)

  return {
    session: query.data,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  }
}

export function useActiveSession(campaignId: string) {
  const query = trpc.session.active.useQuery({ campaignId }, { enabled: !!campaignId })

  return {
    session: query.data,
    isLoading: query.isLoading,
    hasActiveSession: !!query.data,
  }
}

export function useCurrentCard(sessionId: string) {
  const query = trpc.session.currentCard.useQuery(
    { sessionId },
    { enabled: !!sessionId }
  )

  // Listen for card changes
  useRealtime('card_changed', () => {
    query.refetch()
  })

  return {
    card: query.data,
    isLoading: query.isLoading,
    refetch: query.refetch,
  }
}

export function useCardQueue(sessionId: string) {
  const query = trpc.session.cardQueue.useQuery(
    { sessionId },
    { enabled: !!sessionId }
  )

  return {
    cards: query.data || [],
    isLoading: query.isLoading,
  }
}
