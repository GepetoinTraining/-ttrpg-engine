import { trpc } from '@api/trpc'
import { useRealtime, useSendMessage } from '@api/websocket'
import { useCallback } from 'react'

export function useCombat(combatId: string) {
  const query = trpc.combat.get.useQuery({ combatId }, { enabled: !!combatId })
  const sendMessage = useSendMessage()

  // Listen for combat updates
  useRealtime('combat_update', () => {
    query.refetch()
  })

  const endTurn = useCallback(() => {
    sendMessage('end_turn', { combatId })
  }, [combatId, sendMessage])

  const moveToken = useCallback((tokenId: string, x: number, y: number) => {
    sendMessage('move_token', { combatId, tokenId, x, y })
  }, [combatId, sendMessage])

  const performAction = useCallback((tokenId: string, action: string, targetId?: string) => {
    sendMessage('combat_action', { combatId, tokenId, action, targetId })
  }, [combatId, sendMessage])

  return {
    combat: query.data,
    isLoading: query.isLoading,
    currentTurn: query.data?.currentTurn,
    round: query.data?.round,
    tokens: query.data?.tokens || [],
    endTurn,
    moveToken,
    performAction,
  }
}

export function useInitiative(combatId: string) {
  const query = trpc.combat.initiative.useQuery({ combatId }, { enabled: !!combatId })

  useRealtime('initiative_changed', () => {
    query.refetch()
  })

  return {
    order: query.data || [],
    isLoading: query.isLoading,
  }
}

export function useTokenPhysics(tokenId: string, isSelected: boolean, isDragging: boolean) {
  // Physics state derived from interaction
  return {
    mass: 0.6,
    temperature: isSelected ? 'hot' : isDragging ? 'warm' : 'cold',
    friction: isDragging ? 0.1 : 0.3,
    density: 'solid',
  }
}
