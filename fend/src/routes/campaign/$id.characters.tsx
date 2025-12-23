import { useParams, useNavigate } from '@tanstack/react-router'
import { ShellContent, PageHeader, Card, CardTitle, Button, Badge, Avatar, List, ListItem } from '@styles/processors/_internal'
import { Modal, useModal } from '@styles/processors/_internal'
import { trpc } from '@api/trpc'
import { Plus, Heart, Shield, Zap, Crown } from 'lucide-react'

export function CampaignCharacters() {
  const { id } = useParams({ from: '/campaign/$id' })
  const { data: characters } = trpc.character.list.useQuery({ campaignId: id })
  const inviteModal = useModal()

  return (
    <ShellContent>
      <PageHeader
        title="Characters"
        description="Player characters in your campaign"
        actions={
          <Button variant="primary" onClick={inviteModal.openModal}>
            <Plus size={18} />
            Invite Player
          </Button>
        }
      />

      <div style={{ display: 'grid', gap: '16px', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
        {characters?.map((char: any) => (
          <CharacterCard key={char.id} character={char} />
        ))}
      </div>

      <Modal open={inviteModal.open} onClose={inviteModal.closeModal} title="Invite Player">
        <p style={{ color: '#94a3b8', marginBottom: '16px' }}>
          Share this link with a player to invite them to your campaign.
        </p>
        {/* Invite form would go here */}
      </Modal>
    </ShellContent>
  )
}

function CharacterCard({ character }: { character: any }) {
  const hpPercent = (character.currentHp / character.maxHp) * 100
  const hpColor = hpPercent > 50 ? '#22c55e' : hpPercent > 25 ? '#f59e0b' : '#ef4444'

  return (
    <Card variant="default" padding="md">
      <div style={{ display: 'flex', gap: '16px' }}>
        <Avatar src={character.imageUrl} name={character.name} size="lg" />

        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <CardTitle style={{ fontSize: '1rem' }}>{character.name}</CardTitle>
            {character.isLeader && <Crown size={14} style={{ color: '#f59e0b' }} />}
          </div>

          <div style={{ fontSize: '0.8125rem', color: '#94a3b8', marginBottom: '8px' }}>
            Level {character.level} {character.race} {character.class}
          </div>

          {/* HP Bar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <Heart size={14} style={{ color: hpColor }} />
            <div style={{ flex: 1, height: '6px', background: '#1e293b', borderRadius: '3px', overflow: 'hidden' }}>
              <div style={{
                width: `${hpPercent}%`,
                height: '100%',
                background: hpColor,
                transition: 'width 300ms',
              }} />
            </div>
            <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
              {character.currentHp}/{character.maxHp}
            </span>
          </div>

          {/* Quick Stats */}
          <div style={{ display: 'flex', gap: '12px', fontSize: '0.75rem', color: '#64748b' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Shield size={12} /> AC {character.ac}
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Zap size={12} /> Init +{character.initiative}
            </span>
          </div>
        </div>
      </div>

      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: '12px',
        paddingTop: '12px',
        borderTop: '1px solid #1e293b',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Avatar src={character.player?.imageUrl} name={character.player?.name} size="xs" />
          <span style={{ fontSize: '0.8125rem', color: '#64748b' }}>{character.player?.name}</span>
        </div>
        <Badge variant={character.status === 'alive' ? 'success' : 'error'}>
          {character.status}
        </Badge>
      </div>
    </Card>
  )
}
