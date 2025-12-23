import { Avatar, Badge, Button } from '@styles/processors/_internal'
import { List, ListItem, Dropdown } from '@styles/processors/_internal'
import { Crown, Shield, User, MoreVertical, UserMinus } from 'lucide-react'
import { useState } from 'react'

export interface Member {
  id: string
  userId: string
  name: string
  email?: string
  imageUrl?: string
  role: 'owner' | 'gm' | 'player'
  characterName?: string
  joinedAt: string
  isOnline?: boolean
}

export interface MemberListProps {
  members: Member[]
  currentUserId: string
  currentUserRole: 'owner' | 'gm' | 'player'
  onRoleChange?: (memberId: string, newRole: 'gm' | 'player') => void
  onRemove?: (memberId: string) => void
}

export function MemberList({
  members,
  currentUserId,
  currentUserRole,
  onRoleChange,
  onRemove,
}: MemberListProps) {
  const canManage = currentUserRole === 'owner' || currentUserRole === 'gm'

  // Sort: owner first, then GMs, then players
  const sortedMembers = [...members].sort((a, b) => {
    const order = { owner: 0, gm: 1, player: 2 }
    return order[a.role] - order[b.role]
  })

  return (
    <List gap="sm">
      {sortedMembers.map(member => (
        <MemberItem
          key={member.id}
          member={member}
          isCurrentUser={member.userId === currentUserId}
          canManage={canManage && member.role !== 'owner' && member.userId !== currentUserId}
          onRoleChange={onRoleChange}
          onRemove={onRemove}
        />
      ))}
    </List>
  )
}

function MemberItem({
  member,
  isCurrentUser,
  canManage,
  onRoleChange,
  onRemove,
}: {
  member: Member
  isCurrentUser: boolean
  canManage: boolean
  onRoleChange?: (memberId: string, newRole: 'gm' | 'player') => void
  onRemove?: (memberId: string) => void
}) {
  const [showMenu, setShowMenu] = useState(false)

  const roleIcons = {
    owner: <Crown size={14} style={{ color: '#f59e0b' }} />,
    gm: <Shield size={14} style={{ color: '#8b5cf6' }} />,
    player: <User size={14} style={{ color: '#64748b' }} />,
  }

  const roleLabels = {
    owner: 'Owner',
    gm: 'Game Master',
    player: 'Player',
  }

  return (
    <ListItem
      leading={
        <Avatar
          src={member.imageUrl}
          name={member.name}
          size="md"
          status={member.isOnline ? 'online' : 'offline'}
        />
      }
      trailing={
        canManage ? (
          <div style={{ position: 'relative' }}>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowMenu(!showMenu)}
              style={{ padding: '4px' }}
            >
              <MoreVertical size={16} />
            </Button>

            {showMenu && (
              <>
                <div
                  style={{ position: 'fixed', inset: 0, zIndex: 40 }}
                  onClick={() => setShowMenu(false)}
                />
                <div style={{
                  position: 'absolute',
                  right: 0,
                  top: '100%',
                  marginTop: '4px',
                  background: '#1e293b',
                  border: '1px solid #334155',
                  borderRadius: '8px',
                  padding: '4px',
                  zIndex: 50,
                  minWidth: '140px',
                }}>
                  {member.role === 'player' && onRoleChange && (
                    <MenuButton onClick={() => { onRoleChange(member.id, 'gm'); setShowMenu(false) }}>
                      <Shield size={14} /> Make GM
                    </MenuButton>
                  )}
                  {member.role === 'gm' && onRoleChange && (
                    <MenuButton onClick={() => { onRoleChange(member.id, 'player'); setShowMenu(false) }}>
                      <User size={14} /> Make Player
                    </MenuButton>
                  )}
                  {onRemove && (
                    <MenuButton
                      onClick={() => { onRemove(member.id); setShowMenu(false) }}
                      danger
                    >
                      <UserMinus size={14} /> Remove
                    </MenuButton>
                  )}
                </div>
              </>
            )}
          </div>
        ) : null
      }
    >
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontWeight: 500 }}>{member.name}</span>
          {isCurrentUser && (
            <Badge variant="default" style={{ fontSize: '0.625rem' }}>You</Badge>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8125rem', color: '#64748b' }}>
          {roleIcons[member.role]}
          <span>{roleLabels[member.role]}</span>
          {member.characterName && (
            <>
              <span style={{ color: '#475569' }}>•</span>
              <span>{member.characterName}</span>
            </>
          )}
        </div>
      </div>
    </ListItem>
  )
}

function MenuButton({
  children,
  onClick,
  danger = false
}: {
  children: React.ReactNode
  onClick: () => void
  danger?: boolean
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        width: '100%',
        padding: '8px 12px',
        background: 'transparent',
        border: 'none',
        borderRadius: '4px',
        color: danger ? '#ef4444' : '#e2e8f0',
        fontSize: '0.875rem',
        cursor: 'pointer',
        textAlign: 'left',
      }}
      onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
    >
      {children}
    </button>
  )
}
