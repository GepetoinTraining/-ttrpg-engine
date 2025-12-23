import { trpc } from '@api/trpc'
import { useRoom } from '@api/websocket'

export function useCampaign(id: string) {
  const query = trpc.campaign.get.useQuery({ id }, { enabled: !!id })

  // Join campaign room for realtime
  useRoom('campaign', id)

  return {
    campaign: query.data,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  }
}

export function useCampaignList() {
  const query = trpc.campaign.list.useQuery()

  return {
    campaigns: query.data || [],
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  }
}

export function useCampaignMembers(campaignId: string) {
  const query = trpc.campaign.members.useQuery({ campaignId }, { enabled: !!campaignId })

  return {
    members: query.data || [],
    isLoading: query.isLoading,
  }
}
