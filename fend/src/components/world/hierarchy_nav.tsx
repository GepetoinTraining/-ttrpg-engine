import { ChevronRight, Globe, Map, Building, Home, MapPin } from 'lucide-react'

export interface HierarchyNode {
  id: string
  name: string
  type: 'world' | 'continent' | 'region' | 'settlement' | 'district' | 'location'
}

export interface HierarchyNavProps {
  path: HierarchyNode[]
  onNavigate: (nodeId: string, index: number) => void
}

const TYPE_ICONS: Record<string, React.ReactNode> = {
  world: <Globe size={14} />,
  continent: <Map size={14} />,
  region: <Map size={14} />,
  settlement: <Building size={14} />,
  district: <Home size={14} />,
  location: <MapPin size={14} />,
}

export function HierarchyNav({ path, onNavigate }: HierarchyNavProps) {
  if (!path.length) return null

  return (
    <nav style={{
      display: 'flex',
      alignItems: 'center',
      gap: '4px',
      padding: '8px 12px',
      background: '#0f172a',
      borderRadius: '8px',
      overflowX: 'auto',
      fontSize: '0.875rem',
    }}>
      {path.map((node, index) => {
        const isLast = index === path.length - 1

        return (
          <div key={node.id} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <button
              onClick={() => onNavigate(node.id, index)}
              disabled={isLast}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '4px 8px',
                background: isLast ? 'rgba(245, 158, 11, 0.1)' : 'transparent',
                border: isLast ? '1px solid rgba(245, 158, 11, 0.3)' : '1px solid transparent',
                borderRadius: '4px',
                color: isLast ? '#f59e0b' : '#94a3b8',
                cursor: isLast ? 'default' : 'pointer',
                whiteSpace: 'nowrap',
                fontWeight: isLast ? 600 : 400,
              }}
            >
              {TYPE_ICONS[node.type]}
              {node.name}
            </button>

            {!isLast && (
              <ChevronRight size={14} style={{ color: '#475569', flexShrink: 0 }} />
            )}
          </div>
        )
      })}
    </nav>
  )
}
