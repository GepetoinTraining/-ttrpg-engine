import { useState } from 'react'
import { Card, CardTitle, Badge, Button, Avatar } from '@styles/processors/_internal'
import { Tabs, TabList, Tab, TabPanel, List, ListItem } from '@styles/processors/_internal'
import { Building, Users, Shield, Store, Bed, Beer, Scroll, Swords, ChevronRight } from 'lucide-react'

export interface Settlement {
  id: string
  name: string
  type: 'metropolis' | 'city' | 'town' | 'village' | 'hamlet'
  population: number
  imageUrl?: string
  description: string
  government?: string
  defenses?: string

  districts?: Array<{
    id: string
    name: string
    description: string
    type: 'residential' | 'commercial' | 'industrial' | 'government' | 'religious' | 'slums'
  }>

  pointsOfInterest?: Array<{
    id: string
    name: string
    type: 'shop' | 'tavern' | 'inn' | 'temple' | 'guild' | 'landmark'
    description?: string
    npcId?: string
    npcName?: string
  }>

  factions?: Array<{
    id: string
    name: string
    influence: 'dominant' | 'strong' | 'moderate' | 'weak'
  }>

  rumors?: string[]
  quests?: Array<{
    id: string
    title: string
    giver?: string
    status: 'available' | 'active' | 'completed'
  }>
}

export interface SettlementViewProps {
  settlement: Settlement
  isGM: boolean
  onNavigateToDistrict?: (districtId: string) => void
  onNavigateToPoi?: (poiId: string) => void
  onNavigateToNpc?: (npcId: string) => void
  onNavigateToFaction?: (factionId: string) => void
}

const TYPE_SIZES: Record<string, string> = {
  metropolis: '100,000+',
  city: '10,000-100,000',
  town: '1,000-10,000',
  village: '100-1,000',
  hamlet: '< 100',
}

const POI_ICONS: Record<string, React.ReactNode> = {
  shop: <Store size={14} />,
  tavern: <Beer size={14} />,
  inn: <Bed size={14} />,
  temple: <Building size={14} />,
  guild: <Shield size={14} />,
  landmark: <Building size={14} />,
}

export function SettlementView({
  settlement,
  isGM,
  onNavigateToDistrict,
  onNavigateToPoi,
  onNavigateToNpc,
  onNavigateToFaction,
}: SettlementViewProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Header */}
      <Card variant="default" padding="lg">
        <div style={{ display: 'flex', gap: '20px' }}>
          {settlement.imageUrl && (
            <img
              src={settlement.imageUrl}
              alt={settlement.name}
              style={{
                width: 160,
                height: 100,
                objectFit: 'cover',
                borderRadius: '8px',
              }}
            />
          )}

          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
              <Building size={24} style={{ color: '#f59e0b' }} />
              <CardTitle style={{ fontSize: '1.5rem' }}>{settlement.name}</CardTitle>
              <Badge variant="warning" style={{ textTransform: 'capitalize' }}>
                {settlement.type}
              </Badge>
            </div>

            <div style={{
              display: 'flex',
              gap: '24px',
              fontSize: '0.875rem',
              color: '#94a3b8',
              marginBottom: '12px',
            }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Users size={14} /> {settlement.population.toLocaleString()} ({TYPE_SIZES[settlement.type]})
              </span>
              {settlement.defenses && (
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Shield size={14} /> {settlement.defenses}
                </span>
              )}
            </div>

            <p style={{ margin: 0, color: '#e2e8f0', lineHeight: 1.6 }}>
              {settlement.description}
            </p>
          </div>
        </div>
      </Card>

      {/* Content Tabs */}
      <Card variant="default" padding="md">
        <Tabs defaultValue="districts">
          <TabList>
            {settlement.districts && settlement.districts.length > 0 && (
              <Tab value="districts">Districts</Tab>
            )}
            {settlement.pointsOfInterest && settlement.pointsOfInterest.length > 0 && (
              <Tab value="pois">Places</Tab>
            )}
            {settlement.factions && settlement.factions.length > 0 && (
              <Tab value="factions">Factions</Tab>
            )}
            {((isGM && settlement.rumors) || settlement.quests) && (
              <Tab value="hooks">Hooks</Tab>
            )}
          </TabList>

          {/* Districts */}
          {settlement.districts && (
            <TabPanel value="districts">
              <div style={{ display: 'grid', gap: '12px', marginTop: '16px' }}>
                {settlement.districts.map(district => (
                  <DistrictCard
                    key={district.id}
                    district={district}
                    onClick={() => onNavigateToDistrict?.(district.id)}
                  />
                ))}
              </div>
            </TabPanel>
          )}

          {/* Points of Interest */}
          {settlement.pointsOfInterest && (
            <TabPanel value="pois">
              <List gap="sm" style={{ marginTop: '16px' }}>
                {settlement.pointsOfInterest.map(poi => (
                  <ListItem
                    key={poi.id}
                    leading={POI_ICONS[poi.type] || <Building size={14} />}
                    trailing={<ChevronRight size={14} style={{ color: '#475569' }} />}
                    onClick={() => onNavigateToPoi?.(poi.id)}
                    style={{ cursor: 'pointer' }}
                  >
                    <div>
                      <div style={{ fontWeight: 500 }}>{poi.name}</div>
                      {poi.description && (
                        <div style={{ fontSize: '0.8125rem', color: '#64748b' }}>
                          {poi.description}
                        </div>
                      )}
                      {poi.npcName && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            poi.npcId && onNavigateToNpc?.(poi.npcId)
                          }}
                          style={{
                            fontSize: '0.75rem',
                            color: '#0ea5e9',
                            background: 'none',
                            border: 'none',
                            padding: 0,
                            cursor: 'pointer',
                          }}
                        >
                          Run by: {poi.npcName}
                        </button>
                      )}
                    </div>
                  </ListItem>
                ))}
              </List>
            </TabPanel>
          )}

          {/* Factions */}
          {settlement.factions && (
            <TabPanel value="factions">
              <List gap="sm" style={{ marginTop: '16px' }}>
                {settlement.factions.map(faction => (
                  <ListItem
                    key={faction.id}
                    leading={<Users size={14} />}
                    trailing={
                      <Badge
                        variant="default"
                        style={{
                          color: getInfluenceColor(faction.influence),
                          borderColor: getInfluenceColor(faction.influence),
                        }}
                      >
                        {faction.influence}
                      </Badge>
                    }
                    onClick={() => onNavigateToFaction?.(faction.id)}
                    style={{ cursor: 'pointer' }}
                  >
                    {faction.name}
                  </ListItem>
                ))}
              </List>
            </TabPanel>
          )}

          {/* Hooks (Rumors & Quests) */}
          <TabPanel value="hooks">
            <div style={{ marginTop: '16px' }}>
              {/* Rumors (GM only) */}
              {isGM && settlement.rumors && settlement.rumors.length > 0 && (
                <div style={{ marginBottom: '20px' }}>
                  <div style={{
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    color: '#94a3b8',
                    marginBottom: '8px',
                  }}>
                    RUMORS
                  </div>
                  <ul style={{ margin: 0, paddingLeft: '20px' }}>
                    {settlement.rumors.map((rumor, i) => (
                      <li key={i} style={{
                        color: '#e2e8f0',
                        fontSize: '0.875rem',
                        marginBottom: '8px',
                        lineHeight: 1.5,
                      }}>
                        {rumor}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Quests */}
              {settlement.quests && settlement.quests.length > 0 && (
                <div>
                  <div style={{
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    color: '#94a3b8',
                    marginBottom: '8px',
                  }}>
                    QUESTS
                  </div>
                  <List gap="xs">
                    {settlement.quests.map(quest => (
                      <ListItem
                        key={quest.id}
                        leading={<Scroll size={14} style={{ color: getQuestColor(quest.status) }} />}
                        trailing={
                          <Badge
                            variant="default"
                            style={{
                              color: getQuestColor(quest.status),
                              borderColor: getQuestColor(quest.status),
                            }}
                          >
                            {quest.status}
                          </Badge>
                        }
                      >
                        <div>
                          <div style={{ fontWeight: 500 }}>{quest.title}</div>
                          {quest.giver && (
                            <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                              From: {quest.giver}
                            </div>
                          )}
                        </div>
                      </ListItem>
                    ))}
                  </List>
                </div>
              )}
            </div>
          </TabPanel>
        </Tabs>
      </Card>
    </div>
  )
}

function DistrictCard({
  district,
  onClick
}: {
  district: Settlement['districts'][0]
  onClick: () => void
}) {
  const typeColors: Record<string, string> = {
    residential: '#22c55e',
    commercial: '#f59e0b',
    industrial: '#64748b',
    government: '#8b5cf6',
    religious: '#0ea5e9',
    slums: '#6b7280',
  }

  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: '12px',
        padding: '12px',
        background: '#1e293b',
        border: '1px solid #334155',
        borderLeft: `3px solid ${typeColors[district.type] || '#64748b'}`,
        borderRadius: '8px',
        cursor: 'pointer',
        textAlign: 'left',
        width: '100%',
      }}
    >
      <Building size={20} style={{ color: typeColors[district.type] || '#64748b', flexShrink: 0 }} />
      <div>
        <div style={{ fontWeight: 600, color: '#e2e8f0' }}>{district.name}</div>
        <div style={{ fontSize: '0.8125rem', color: '#94a3b8', marginTop: '4px' }}>
          {district.description}
        </div>
      </div>
      <ChevronRight size={16} style={{ color: '#475569', marginLeft: 'auto', flexShrink: 0 }} />
    </button>
  )
}

function getInfluenceColor(influence: string): string {
  switch (influence) {
    case 'dominant': return '#f59e0b'
    case 'strong': return '#22c55e'
    case 'moderate': return '#0ea5e9'
    case 'weak': return '#64748b'
    default: return '#64748b'
  }
}

function getQuestColor(status: string): string {
  switch (status) {
    case 'available': return '#22c55e'
    case 'active': return '#f59e0b'
    case 'completed': return '#64748b'
    default: return '#64748b'
  }
}
