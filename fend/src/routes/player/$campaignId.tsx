import { Outlet, useParams, useLocation, useNavigate } from '@tanstack/react-router'
import { RequireAuth } from '@auth/guards'
import { trpc } from '@api/trpc'
import { useRoom } from '@api/websocket'
import { Spinner } from '@styles/processors/_internal'
import { User, Scroll, Moon, Home } from 'lucide-react'

export function PlayerLayout() {
  const { campaignId } = useParams({ from: '/player/$campaignId' })
  const location = useLocation()
  const navigate = useNavigate()

  const { data: campaign, isLoading } = trpc.campaign.get.useQuery({ id: campaignId })

  // Join campaign room
  useRoom('campaign', campaignId)

  if (isLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
        <Spinner size="lg" />
      </div>
    )
  }

  const isActive = (path: string) => location.pathname.includes(path)

  return (
    <RequireAuth>
      <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
        {/* Header */}
        <header style={{
          padding: '12px 16px',
          borderBottom: '1px solid #1e293b',
          background: '#0f172a',
        }}>
          <h1 style={{
            fontSize: '1rem',
            fontWeight: 600,
            color: '#f8fafc',
            margin: 0,
            fontFamily: '"Crimson Pro", Georgia, serif',
          }}>
            {campaign?.name}
          </h1>
        </header>

        {/* Content */}
        <main style={{ flex: 1, overflow: 'auto' }}>
          <Outlet />
        </main>

        {/* Bottom Navigation */}
        <nav style={{
          display: 'flex',
          borderTop: '1px solid #1e293b',
          background: '#0f172a',
          padding: '8px 0',
        }}>
          <NavItem
            icon={<User size={20} />}
            label="Character"
            active={isActive('/character')}
            onClick={() => navigate({ to: '/player/$campaignId/character', params: { campaignId } })}
          />
          <NavItem
            icon={<Scroll size={20} />}
            label="Session"
            active={isActive('/session')}
            onClick={() => navigate({ to: '/player/$campaignId/session', params: { campaignId } })}
          />
          <NavItem
            icon={<Moon size={20} />}
            label="Downtime"
            active={isActive('/downtime')}
            onClick={() => navigate({ to: '/player/$campaignId/downtime', params: { campaignId } })}
          />
        </nav>
      </div>
    </RequireAuth>
  )
}

function NavItem({ icon, label, active, onClick }: { icon: React.ReactNode; label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '4px',
        padding: '8px',
        background: 'none',
        border: 'none',
        color: active ? '#f59e0b' : '#64748b',
        cursor: 'pointer',
      }}
    >
      {icon}
      <span style={{ fontSize: '0.6875rem' }}>{label}</span>
    </button>
  )
}
