import { CampaignCard } from './campaign_card'
import { Spinner } from '@styles/processors/_internal'
import { Swords } from 'lucide-react'

export interface CampaignListProps {
  campaigns: any[]
  isLoading?: boolean
  emptyMessage?: string
  onCreateNew?: () => void
}

export function CampaignList({
  campaigns,
  isLoading = false,
  emptyMessage = 'No campaigns yet',
  onCreateNew,
}: CampaignListProps) {
  if (isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '48px' }}>
        <Spinner size="lg" label="Loading campaigns..." />
      </div>
    )
  }

  if (!campaigns.length) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '64px 32px',
        background: '#1e293b',
        borderRadius: '12px',
        border: '1px dashed #334155',
      }}>
        <Swords size={48} style={{ color: '#475569', marginBottom: '16px' }} />
        <p style={{ color: '#94a3b8', margin: '0 0 16px', textAlign: 'center' }}>
          {emptyMessage}
        </p>
        {onCreateNew && (
          <button
            onClick={onCreateNew}
            style={{
              padding: '10px 20px',
              background: '#f59e0b',
              border: 'none',
              borderRadius: '8px',
              color: '#0f172a',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Create Your First Campaign
          </button>
        )}
      </div>
    )
  }

  return (
    <div style={{
      display: 'grid',
      gap: '16px',
      gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
    }}>
      {campaigns.map(campaign => (
        <CampaignCard key={campaign.id} campaign={campaign} />
      ))}
    </div>
  )
}
