import { useState } from 'react'
import { Avatar, Badge } from '@styles/processors/_internal'
import { ChevronRight, Eye, EyeOff } from 'lucide-react'

export interface NpcStubProps {
  npc: {
    id: string
    name: string
    role?: string
    imageUrl?: string
    depth: number // 0-5 depth level
    isKnown: boolean
  }
  isGM: boolean
  onClick?: () => void
}

const DEPTH_COLORS = [
  '#22c55e', // D0 - surface
  '#0ea5e9', // D1 - shallow
  '#8b5cf6', // D2 - medium
  '#f59e0b', // D3 - deep
  '#ef4444', // D4 - very deep
  '#ec4899', // D5 - abyss
]

export function NpcStub({ npc, isGM, onClick }: NpcStubProps) {
  const depthColor = DEPTH_COLORS[npc.depth] || DEPTH_COLORS[0]

  // Hidden NPCs show differently for GM vs players
  if (!npc.isKnown && !isGM) {
    return null
  }

  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '8px 12px',
        background: 'transparent',
        border: '1px solid #334155',
        borderRadius: '8px',
        cursor: 'pointer',
        width: '100%',
        textAlign: 'left',
        transition: 'all 150ms',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = 'rgba(255,255,255,0.03)'
        e.currentTarget.style.borderColor = depthColor
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'transparent'
        e.currentTarget.style.borderColor = '#334155'
      }}
    >
      <Avatar
        src={npc.imageUrl}
        name={npc.name}
        size="sm"
        style={{
          border: `2px solid ${depthColor}`,
          opacity: npc.isKnown ? 1 : 0.5,
        }}
      />

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
        }}>
          <span style={{
            fontWeight: 500,
            color: npc.isKnown ? '#e2e8f0' : '#64748b',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            {npc.name}
          </span>

          {isGM && !npc.isKnown && (
            <EyeOff size={12} style={{ color: '#64748b', flexShrink: 0 }} />
          )}
        </div>

        {npc.role && (
          <span style={{
            fontSize: '0.75rem',
            color: '#64748b',
            display: 'block',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            {npc.role}
          </span>
        )}
      </div>

      <Badge
        variant="default"
        style={{
          fontSize: '0.625rem',
          color: depthColor,
          borderColor: depthColor,
          flexShrink: 0,
        }}
      >
        D{npc.depth}
      </Badge>

      <ChevronRight size={16} style={{ color: '#475569', flexShrink: 0 }} />
    </button>
  )
}
