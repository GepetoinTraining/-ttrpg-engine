import { Outlet, useParams, useNavigate, useLocation } from '@tanstack/react-router'
import { Sidebar, SidebarSection, SidebarItem, SidebarDivider } from '@styles/processors/_internal'
import { Spinner } from '@styles/processors/_internal'
import { RequireAuth } from '@auth/guards'
import { trpc } from '@api/trpc'
import { useRoom } from '@api/websocket'
import {
  LayoutDashboard, Map, Users, Skull, Shield, Calendar,
  Play, Moon, Settings, ChevronLeft
} from 'lucide-react'

export function CampaignLayout() {
  const { id } = useParams({ from: '/campaign/$id' })
  const navigate = useNavigate()
  const location = useLocation()

  const { data: campaign, isLoading } = trpc.campaign.get.useQuery({ id })

  // Join campaign room for realtime updates
  useRoom('campaign', id)

  if (isLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
        <Spinner size="lg" />
      </div>
    )
  }

  if (!campaign) {
    return (
      <div style={{ padding: '48px', textAlign: 'center', color: '#94a3b8' }}>
        Campaign not found
      </div>
    )
  }

  const isActive = (path: string) => location.pathname.includes(path)

  return (
    <RequireAuth>
      <div style={{ display: 'flex', height: 'calc(100vh - 60px)' }}>
        <Sidebar
          header={
            <div>
              <button
                onClick={() => navigate({ to: '/' })}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  background: 'none',
                  border: 'none',
                  color: '#64748b',
                  fontSize: '0.75rem',
                  cursor: 'pointer',
                  padding: '4px 0',
                  marginBottom: '8px',
                }}
              >
                <ChevronLeft size={14} />
                All Campaigns
              </button>
              <h2 style={{
                fontSize: '1.125rem',
                fontWeight: 700,
                color: '#f8fafc',
                fontFamily: '"Crimson Pro", Georgia, serif',
                margin: 0,
              }}>
                {campaign.name}
              </h2>
            </div>
          }
        >
          <SidebarSection>
            <SidebarItem
              href={`/campaign/${id}`}
              active={location.pathname === `/campaign/${id}`}
              icon={<LayoutDashboard size={18} />}
            >
              Dashboard
            </SidebarItem>
          </SidebarSection>

          <SidebarSection title="Session">
            <SidebarItem
              href={`/campaign/${id}/session/new`}
              active={isActive('/session/new')}
              icon={<Play size={18} />}
            >
              New Session
            </SidebarItem>
            <SidebarItem
              href={`/campaign/${id}/downtime`}
              active={isActive('/downtime')}
              icon={<Moon size={18} />}
            >
              Downtime
            </SidebarItem>
          </SidebarSection>

          <SidebarSection title="World">
            <SidebarItem
              href={`/campaign/${id}/world`}
              active={isActive('/world')}
              icon={<Map size={18} />}
            >
              World
            </SidebarItem>
            <SidebarItem
              href={`/campaign/${id}/characters`}
              active={isActive('/characters')}
              icon={<Users size={18} />}
            >
              Characters
            </SidebarItem>
            <SidebarItem
              href={`/campaign/${id}/npcs`}
              active={isActive('/npcs')}
              icon={<Skull size={18} />}
            >
              NPCs
            </SidebarItem>
            <SidebarItem
              href={`/campaign/${id}/factions`}
              active={isActive('/factions')}
              icon={<Shield size={18} />}
            >
              Factions
            </SidebarItem>
          </SidebarSection>

          <SidebarDivider />

          <SidebarItem
            href={`/campaign/${id}/settings`}
            active={isActive('/settings')}
            icon={<Settings size={18} />}
          >
            Settings
          </SidebarItem>
        </Sidebar>

        <main style={{ flex: 1, overflow: 'auto' }}>
          <Outlet />
        </main>
      </div>
    </RequireAuth>
  )
}
