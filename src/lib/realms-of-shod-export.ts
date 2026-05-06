/**
 * REALMS-OF-SHOD EXPORT ADAPTERS
 * ================================
 *
 * 47 downgrade adapters + 1 relationship aggregator that translate our
 * richer engine state into Realms-of-Shod's flat tagged-record format.
 *
 * Their schema = `{ id, type, name, description?, notes?, accessIds? }`
 * Their relationships = `{ from, to, type }`
 *
 * See: docs/realms-of-shod-mapping.md
 *
 * Pure read-and-translate. NO engine state mutation. Lives in `src/lib/`
 * because export is a wire-format concern, not engine math.
 *
 * Each function takes our object → emits their RealmsEntity.
 * Some emit RealmsEntity[] (e.g. faction territory → one per controlled node).
 *
 * Grep pattern: search the engine for `REALMS-OF-SHOD ALIGNMENT:` to find
 * every type/field that was added because of this alignment.
 */

import type { TP } from '../../engine/tp'
import type { Faction } from '../../engine/faction'
import type { Race } from '../../engine/race'
import type { Spell } from '../../engine/magic'
import type { ItemV2 } from '../../engine/mf-smelt'
import type { Treaty } from '../../engine/warfare'
import type { Law, Household, KinshipLink, Title } from '../../engine/social'
import type { Document } from '../../engine/document'
import { isHeirloom, isRelic, isArtifact } from '../../engine/mf-smelt'

// ============================================================
// WIRE FORMAT — Realms-of-Shod V2 entity + relationship shapes
// ============================================================

export interface RealmsEntity {
  id: string
  type: string
  name: string
  description?: string
  notes?: string
  accessIds?: string[]
}

export interface RealmsRelationship {
  from: string
  to: string
  type: string
}

// ============================================================
// LOOSE INPUT INTERFACES — shape-based contracts for adapters
// ----------------------------------------------------------------
// Engine types vary in shape across files; the adapter only reads
// a small surface. Defining the read surface as loose interfaces
// keeps adapters resilient to upstream additions.
// ============================================================

interface CharacterLike {
  id: string
  name: string
  race?: string
  classes?: { name: string; level: number }[]
  abilityScores?: Record<string, number>
  hpMax?: number
  hpCurrent?: number
  status?: string
  homeNodeId?: string
  currentNodeId?: string
  factionId?: string
  loyalty?: number
  disposition?: string
  role?: string
}

interface MonsterLike {
  id: string
  name?: string
  speciesId?: string
  cr?: number
  currentHp?: number
}

interface SettlementLike {
  id?: string
  hubId?: string
  name?: string
  population?: number
  size?: string
  prosperity?: number
  stability?: number
  unrest?: number
  defenseLevel?: number
  factionId?: string
  regionId?: string
}

interface NodeLike {
  id: string
  name?: string
  type?: string
  parentId?: string
  description?: string
}

interface DiscoveredSiteLike {
  id: string
  name?: string
  siteType?: string
  mileMarker?: number
  edgeId?: string
  explored?: boolean
}

interface DungeonGateLike {
  id: string
  name?: string
  nodeId?: string
  themeTag?: string
  difficulty?: number
}

interface GuildLike {
  id: string
  name?: string
  type?: string
  hubId?: string
  reputation?: number
  rankCount?: number
}

interface MerchantLike {
  id: string
  name?: string
  tier?: string
  specialization?: string
  hubId?: string
  venueId?: string
  capital?: number
  reputation?: number
}

interface ArmyUnitLike {
  id: string
  name?: string
  factionId?: string
  tier?: string
  unitType?: string
  currentStrength?: number
  regionId?: string
}

interface DeityLike {
  id: string
  name?: string
  alignment?: string
  domains?: string[]
  pantheonId?: string
}

interface PantheonLike {
  id: string
  name?: string
  cultureId?: string
}

interface CommodityLike {
  id: string
  name: string
  category?: string
  basePrice?: number
}

interface DepositLike {
  id: string
  commodityId?: string
  nodeId?: string
  quality?: string
}

interface CaravanLike {
  id: string
  type?: string
  ownerId?: string
  originHubId?: string
  destinationHubId?: string
  status?: string
}

interface CurrencyLike {
  id?: string
  name?: string
  baseDenomination?: string
  trust?: number
  issuingFactionId?: string
}

interface VenueLike {
  id: string
  name?: string
  type?: string
  hubId?: string
  ownerId?: string
}

interface MarketLike {
  hubId: string
  taxRate?: number
  merchants?: MerchantLike[]
  venues?: VenueLike[]
}

interface TempleLike {
  id: string
  name?: string
  deityId?: string
  size?: string
  hubId?: string
  factionId?: string
}

interface ContainerLike {
  id: string
  name?: string
  type?: string
  ownerId?: string
  hubId?: string
}

interface LibraryLike {
  id: string
  name?: string
  hubId?: string
  knowledgeTier?: number
  entries?: number
}

interface DistrictLike {
  id: string
  hubId: string
  name?: string
  type?: string
  population?: number
  factions?: string[]
}

interface WorkshopLike {
  id?: string
  name?: string
  hubId?: string
  professionId?: string
  ownerId?: string
}

interface TechBlobLike {
  id: string
  purpose: string
  tier?: string | number
  unlockDC?: number
  hints?: string[]
}

// ============================================================
// HELPERS
// ============================================================

function entity(
  id: string,
  type: string,
  name: string,
  description?: string,
  notes?: string,
  accessIds?: string[],
): RealmsEntity {
  const out: RealmsEntity = { id, type, name }
  if (description) out.description = description
  if (notes) out.notes = notes
  if (accessIds && accessIds.length) out.accessIds = accessIds
  return out
}

function abilityLine(scores?: Record<string, number>): string {
  if (!scores) return ''
  const order = ['str', 'dex', 'con', 'int', 'wis', 'cha']
  return order
    .filter(k => scores[k] !== undefined)
    .map(k => `${k.toUpperCase()} ${scores[k]}`)
    .join(' · ')
}

function classLine(classes?: { name: string; level: number }[]): string {
  if (!classes || classes.length === 0) return ''
  return classes.map(c => `${c.name} ${c.level}`).join(' / ')
}

// ============================================================
// CHARACTERS
// ============================================================

export function toRealmsCharacter(char: CharacterLike): RealmsEntity {
  const cls = classLine(char.classes)
  const abil = abilityLine(char.abilityScores)
  const desc = [char.race, cls].filter(Boolean).join(' · ')
  const notes = [
    abil,
    char.hpMax !== undefined ? `HP ${char.hpCurrent ?? char.hpMax}/${char.hpMax}` : '',
    char.role ?? '',
    char.disposition ?? '',
  ].filter(Boolean).join(' · ')
  return entity(char.id, 'character', char.name, desc, notes,
    [char.homeNodeId, char.currentNodeId, char.factionId].filter(Boolean) as string[])
}

export function toRealmsCreature(monster: MonsterLike): RealmsEntity {
  const desc = [monster.speciesId, monster.cr !== undefined ? `CR ${monster.cr}` : '']
    .filter(Boolean).join(' · ')
  return entity(monster.id, 'creature', monster.name ?? monster.id, desc)
}

export function toRealmsSpecies(speciesId: string, name?: string, biome?: string): RealmsEntity {
  return entity(speciesId, 'species', name ?? speciesId, biome ? `biome: ${biome}` : undefined)
}

export function toRealmsRace(race: Race): RealmsEntity {
  const traits = race.traits.join(', ')
  const abil = abilityLine(race.abilityModifiers)
  const desc = race.description ?? `${race.size} · speed ${race.speed}`
  const notes = [abil, traits ? `traits: ${traits}` : ''].filter(Boolean).join(' · ')
  return entity(race.id, 'race', race.name, desc, notes,
    race.culturalGroup ? [race.culturalGroup] : undefined)
}

// ============================================================
// LOCATIONS
// ============================================================

const SETTLEMENT_TYPE_BY_POP: Array<[number, string]> = [
  [50_000, 'city'],
  [10_000, 'city'],
  [2_500,  'town'],
  [500,    'village'],
  [0,      'settlement'],
]

function pickSettlementType(pop?: number): string {
  if (pop === undefined) return 'settlement'
  for (const [floor, type] of SETTLEMENT_TYPE_BY_POP) {
    if (pop >= floor) return type
  }
  return 'settlement'
}

export function toRealmsCity(s: SettlementLike): RealmsEntity {
  return toSettlementGeneric(s, 'city')
}
export function toRealmsTown(s: SettlementLike): RealmsEntity {
  return toSettlementGeneric(s, 'town')
}
export function toRealmsVillage(s: SettlementLike): RealmsEntity {
  return toSettlementGeneric(s, 'village')
}

function toSettlementGeneric(s: SettlementLike, forcedType?: string): RealmsEntity {
  const id = s.id ?? s.hubId ?? 'settlement_unknown'
  const type = forcedType ?? pickSettlementType(s.population)
  const desc = [
    s.population !== undefined ? `pop ~${s.population}` : '',
    s.size,
  ].filter(Boolean).join(' · ')
  const notes = [
    s.prosperity !== undefined ? `prosperity ${s.prosperity}` : '',
    s.stability !== undefined  ? `stability ${s.stability}`   : '',
    s.unrest !== undefined     ? `unrest ${s.unrest}`         : '',
    s.defenseLevel !== undefined ? `defense ${s.defenseLevel}` : '',
  ].filter(Boolean).join(' · ')
  return entity(id, type, s.name ?? id, desc, notes,
    [s.regionId, s.factionId].filter(Boolean) as string[])
}

export function toRealmsRegion(node: NodeLike): RealmsEntity {
  return entity(node.id, 'region', node.name ?? node.id, node.description, undefined,
    node.parentId ? [node.parentId] : undefined)
}

export function toRealmsTerritory(faction: Faction): RealmsEntity[] {
  // One territory record per controlled node — adapter splits a faction's
  // controlledNodes into separate flat records for their schema.
  return faction.controlledNodes.map(nodeId =>
    entity(
      `${faction.id}:territory:${nodeId}`,
      'territory',
      `${faction.name} territory at ${nodeId}`,
      `controlled by ${faction.name}`,
      faction.influence[nodeId] !== undefined ? `influence ${faction.influence[nodeId]}` : undefined,
      [faction.id, nodeId],
    ),
  )
}

export function toRealmsLandmark(site: DiscoveredSiteLike): RealmsEntity {
  return entity(site.id, 'landmark', site.name ?? site.id, site.siteType,
    site.mileMarker !== undefined ? `mile ${site.mileMarker}` : undefined,
    site.edgeId ? [site.edgeId] : undefined)
}

export function toRealmsNaturalFeature(node: NodeLike): RealmsEntity {
  return entity(node.id, 'natural_feature', node.name ?? node.id, node.description, node.type,
    node.parentId ? [node.parentId] : undefined)
}

export function toRealmsRuin(site: DiscoveredSiteLike | DungeonGateLike): RealmsEntity {
  const name = site.name ?? site.id
  const desc = 'siteType' in site ? site.siteType : ('themeTag' in site ? site.themeTag : undefined)
  const notes = 'difficulty' in site && site.difficulty !== undefined ? `difficulty ${site.difficulty}` : undefined
  const access = 'nodeId' in site && site.nodeId ? [site.nodeId]
              : 'edgeId' in site && site.edgeId ? [site.edgeId]
              : undefined
  return entity(site.id, 'ruin', name, desc, notes, access)
}

// ============================================================
// ORGANIZATIONS
// ============================================================

export function toRealmsFaction(faction: Faction): RealmsEntity {
  const desc = [faction.type, faction.motto].filter(Boolean).join(' — ')
  const notes = [
    `treasury ${faction.treasury}`,
    `members ${faction.members.length}`,
    faction.secrecyLevel ? `secrecy ${faction.secrecyLevel}` : '',
  ].filter(Boolean).join(' · ')
  return entity(faction.id, 'faction', faction.name, desc, notes,
    [faction.headquartersNodeId, ...faction.controlledNodes])
}

export function toRealmsGuild(guild: GuildLike): RealmsEntity {
  const desc = guild.type
  const notes = [
    guild.reputation !== undefined ? `reputation ${guild.reputation}` : '',
    guild.rankCount !== undefined ? `${guild.rankCount} ranks` : '',
  ].filter(Boolean).join(' · ')
  return entity(guild.id, 'guild', guild.name ?? guild.id, desc, notes,
    guild.hubId ? [guild.hubId] : undefined)
}

export function toRealmsPoliticalBody(faction: Faction): RealmsEntity {
  return entity(faction.id, 'political_body', faction.name, faction.motto,
    `government type · ${faction.type}`,
    [faction.headquartersNodeId])
}

export function toRealmsCult(faction: Faction): RealmsEntity {
  // Phase 1 enrichment — only meaningful when type === 'cult'
  const secrecy = faction.secrecyLevel ?? 'discreet'
  return entity(faction.id, 'cult', faction.name, faction.motto,
    `secrecy: ${secrecy} · members ${faction.members.length}`,
    [faction.headquartersNodeId])
}

export function toRealmsReligion(pantheon: PantheonLike, deity: DeityLike): RealmsEntity {
  const desc = [deity.alignment, deity.domains?.join('/')].filter(Boolean).join(' · ')
  return entity(deity.id, 'religion', deity.name ?? deity.id, desc,
    `pantheon: ${pantheon.name ?? pantheon.id}`,
    [pantheon.id])
}

export function toRealmsMerchant(merchant: MerchantLike): RealmsEntity {
  const desc = [merchant.tier, merchant.specialization].filter(Boolean).join(' · ')
  const notes = [
    merchant.capital !== undefined ? `capital ${merchant.capital}gp` : '',
    merchant.reputation !== undefined ? `rep ${merchant.reputation}` : '',
  ].filter(Boolean).join(' · ')
  return entity(merchant.id, 'merchant', merchant.name ?? merchant.id, desc, notes,
    [merchant.hubId, merchant.venueId].filter(Boolean) as string[])
}

export function toRealmsArmy(unit: ArmyUnitLike): RealmsEntity {
  const desc = [unit.tier, unit.unitType].filter(Boolean).join(' · ')
  const notes = unit.currentStrength !== undefined ? `strength ${unit.currentStrength}` : undefined
  return entity(unit.id, 'army', unit.name ?? unit.id, desc, notes,
    [unit.factionId, unit.regionId].filter(Boolean) as string[])
}

export function toRealmsClan(household: Household): RealmsEntity {
  const head = household.members.find(m => m.role === 'head' && m.active !== false)
  return entity(household.id, 'clan', household.name,
    household.type,
    `${household.members.length} members · standing ${household.standing}`,
    head ? [head.entityId] : undefined)
}

export function toRealmsDynasty(title: Title, kinship: KinshipLink[]): RealmsEntity {
  const holder = title.holderId ?? ''
  const linkedIds = holder
    ? kinship
        .filter(k => k.entity1Id === holder || k.entity2Id === holder)
        .map(k => k.entity1Id === holder ? k.entity2Id : k.entity1Id)
    : []
  return entity(`dynasty:${title.id}`, 'dynasty', title.name,
    `${title.rank} · holder ${holder || 'vacant'}`,
    `${kinship.length} kin links`,
    [holder, ...linkedIds].filter(Boolean))
}

export function toRealmsSanctuary(faction: Faction): RealmsEntity {
  // Phase 1 enrichment — only meaningful when type === 'sanctuary'
  const protections = faction.refugeProtections?.join(', ') ?? ''
  const desc = faction.accessRules ?? 'sanctuary refuge'
  const notes = protections ? `protections: ${protections}` : undefined
  return entity(faction.id, 'sanctuary', faction.name, desc, notes,
    [faction.headquartersNodeId])
}

export function toRealmsMilitary(faction: Faction): RealmsEntity {
  return entity(faction.id, 'military', faction.name, faction.motto,
    `treasury ${faction.treasury} · members ${faction.members.length}`,
    [faction.headquartersNodeId, ...faction.controlledNodes])
}

export function toRealmsResidence(household: Household): RealmsEntity {
  return entity(`residence:${household.id}`, 'residence', `${household.name} residence`,
    `${household.type} household`,
    `${household.members.length} members`,
    [household.id])
}

// ============================================================
// ITEMS
// ============================================================

function itemDesc(item: ItemV2): string {
  return [item.baseName, `tier ${item.tier}`, item.quality]
    .filter(Boolean).join(' · ')
}

function itemNotes(item: ItemV2): string {
  const parts: string[] = []
  if (item.affixes.length > 0) parts.push(`affixes: ${item.affixes.map(a => a.word).join(', ')}`)
  if (item.quantity !== 1) parts.push(`qty ${item.quantity}`)
  parts.push(`forged d${item.provenance.worldDay}`)
  return parts.join(' · ')
}

export function toRealmsWeapon(item: ItemV2): RealmsEntity {
  return entity(item.id, 'weapon',
    item.prefixName ? `${item.prefixName} ${item.baseName}` : item.baseName,
    itemDesc(item), itemNotes(item))
}

export function toRealmsMagic(spell: Spell): RealmsEntity {
  const components = [
    spell.verbal ? 'V' : '',
    spell.somatic ? 'S' : '',
    spell.materials && spell.materials.length > 0 ? 'M' : '',
  ].filter(Boolean).join('')
  const desc = `level ${spell.level} ${spell.school}`
  const notes = [
    components ? `components ${components}` : '',
    spell.range !== undefined ? `range ${spell.range}ft` : '',
    spell.duration ?? '',
    spell.concentration ? 'concentration' : '',
    spell.ritual ? 'ritual' : '',
    spell.classes?.length ? `classes: ${spell.classes.join(', ')}` : '',
  ].filter(Boolean).join(' · ')
  return entity(spell.id, 'magic', spell.name, desc, notes)
}

export function toRealmsHeirloom(item: ItemV2): RealmsEntity {
  // Phase 1 enrichment — meaningful when lineageChain is populated
  const chain = item.lineageChain ?? []
  const ownerCount = chain.length
  const notes = chain.length > 0
    ? `${ownerCount} previous owners · current: ${chain[chain.length - 1].holderId}`
    : 'no recorded lineage'
  return entity(item.id, 'heirloom', item.baseName, itemDesc(item), notes,
    chain.map(l => l.holderId))
}

export function toRealmsRelic(item: ItemV2): RealmsEntity {
  // Phase 1 enrichment — meaningful when religiousSignificance is populated
  const sig = item.religiousSignificance
  const desc = itemDesc(item)
  const notes = sig
    ? `sacred to ${sig.deityId}${sig.originEvent ? ` · ${sig.originEvent}` : ''}`
    : 'religious provenance unknown'
  return entity(item.id, 'relic', item.baseName, desc, notes,
    sig ? [sig.deityId] : undefined)
}

export function toRealmsTool(item: ItemV2): RealmsEntity {
  return entity(item.id, 'tool', item.baseName, itemDesc(item), itemNotes(item))
}

export function toRealmsArtifact(item: ItemV2): RealmsEntity {
  // Phase 1 enrichment — meaningful when uniqueness is populated
  const uniq = item.uniqueness
  const desc = uniq?.loreText ?? itemDesc(item)
  const notes = uniq
    ? `magical: ${uniq.magicalProperties.join(', ')}`
    : 'no recorded artifact properties'
  return entity(item.id, 'artifact', item.baseName, desc, notes)
}

export function toRealmsConsumable(commodity: CommodityLike): RealmsEntity {
  return entity(commodity.id, 'consumable', commodity.name,
    commodity.category,
    commodity.basePrice !== undefined ? `base price ${commodity.basePrice}gp` : undefined)
}

export function toRealmsItem(item: ItemV2): RealmsEntity {
  // Generic item — dispatches to specific subtype if applicable
  if (isHeirloom(item)) return toRealmsHeirloom(item)
  if (isRelic(item))    return toRealmsRelic(item)
  if (isArtifact(item)) return toRealmsArtifact(item)
  return entity(item.id, 'item', item.baseName, itemDesc(item), itemNotes(item))
}

// ============================================================
// MISC — Treaty, Vehicle, Currency, Resource, Technology, Documents, Law
// ============================================================

export function toRealmsTreaty(treaty: Treaty): RealmsEntity {
  // Phase 1 enrichment — promoted from string[] to first-class entity
  const desc = `${treaty.factionA} ↔ ${treaty.factionB} · ${treaty.status}`
  const notes = [
    `signed d${treaty.signedDay}`,
    `terms: ${treaty.terms.join(', ')}`,
    treaty.sponsorId ? `sponsor: ${treaty.sponsorId}` : '',
  ].filter(Boolean).join(' · ')
  return entity(treaty.id, 'treaty', `Treaty: ${treaty.factionA}–${treaty.factionB}`,
    desc, notes,
    [treaty.factionA, treaty.factionB, treaty.sponsorId].filter(Boolean) as string[])
}

export function toRealmsVehicle(caravan: CaravanLike): RealmsEntity {
  const desc = caravan.type ?? 'caravan'
  const notes = [
    caravan.status,
    caravan.originHubId && caravan.destinationHubId
      ? `${caravan.originHubId} → ${caravan.destinationHubId}`
      : '',
  ].filter(Boolean).join(' · ')
  return entity(caravan.id, 'vehicle', caravan.id, desc, notes,
    [caravan.ownerId, caravan.originHubId, caravan.destinationHubId].filter(Boolean) as string[])
}

export function toRealmsCurrency(currency: CurrencyLike): RealmsEntity {
  const id = currency.id ?? currency.name ?? 'currency_unknown'
  const desc = currency.baseDenomination
  const notes = currency.trust !== undefined ? `trust ${currency.trust}` : undefined
  return entity(id, 'currency', currency.name ?? id, desc, notes,
    currency.issuingFactionId ? [currency.issuingFactionId] : undefined)
}

export function toRealmsLaw(law: Law): RealmsEntity {
  // Phase 1 enrichment — Law as durable historical record
  const notes = [
    `effective d${law.effectiveDay}`,
    law.repealDay !== undefined ? `repealed d${law.repealDay}` : '',
    `status ${law.status}`,
    `sponsor ${law.sponsorId}`,
  ].filter(Boolean).join(' · ')
  return entity(law.id, 'law', law.decree.slice(0, 60), law.decree, notes,
    [law.jurisdictionNodeId, law.sponsorId])
}

export function toRealmsResource(commodity: CommodityLike, deposit?: DepositLike): RealmsEntity {
  const notes = deposit
    ? `deposit at ${deposit.nodeId} · quality ${deposit.quality}`
    : undefined
  return entity(commodity.id, 'resource', commodity.name, commodity.category, notes,
    deposit?.nodeId ? [deposit.nodeId] : undefined)
}

export function toRealmsTechnology(tech: TechBlobLike): RealmsEntity {
  const desc = `purpose: ${tech.purpose}`
  const notes = [
    tech.tier !== undefined ? `tier ${tech.tier}` : '',
    tech.unlockDC !== undefined ? `unlock DC ${tech.unlockDC}` : '',
    tech.hints?.length ? `hints: ${tech.hints.join(', ')}` : '',
  ].filter(Boolean).join(' · ')
  return entity(tech.id, 'technology', tech.id, desc, notes)
}

export function toRealmsMap(doc: Document): RealmsEntity {
  // Phase 1 enrichment — Document.kind === 'map'
  const desc = `map · ${doc.depictedNodes?.length ?? 0} nodes depicted`
  const notes = [
    `created d${doc.createdDay}`,
    `condition ${doc.condition}`,
    `language ${doc.language}`,
  ].filter(Boolean).join(' · ')
  return entity(doc.id, 'map', doc.title, desc, notes,
    [doc.authorId, ...(doc.depictedNodes ?? [])])
}

export function toRealmsLetter(doc: Document): RealmsEntity {
  // Phase 1 enrichment — Document.kind === 'letter'
  const desc = `letter${doc.recipientId ? ` to ${doc.recipientId}` : ''}`
  const notes = [
    `created d${doc.createdDay}`,
    doc.deliveredDay !== undefined ? `delivered d${doc.deliveredDay}` : 'undelivered',
    `condition ${doc.condition}`,
  ].filter(Boolean).join(' · ')
  return entity(doc.id, 'letter', doc.title, desc, notes,
    [doc.authorId, doc.recipientId].filter(Boolean) as string[])
}

export function toRealmsDocument(doc: Document): RealmsEntity {
  // Phase 1 enrichment — generic Document; dispatches by kind
  if (doc.kind === 'map')    return toRealmsMap(doc)
  if (doc.kind === 'letter') return toRealmsLetter(doc)
  const desc = `${doc.kind} · created d${doc.createdDay}`
  const notes = [
    `condition ${doc.condition}`,
    `language ${doc.language}`,
    doc.knowledgeSeedIds?.length ? `seeds: ${doc.knowledgeSeedIds.length}` : '',
  ].filter(Boolean).join(' · ')
  return entity(doc.id, 'document', doc.title, desc, notes,
    [doc.authorId, doc.currentNodeId].filter(Boolean) as string[])
}

// ============================================================
// ESTABLISHMENTS
// ============================================================

export function toRealmsShop(venue: VenueLike): RealmsEntity {
  return entity(venue.id, 'shop', venue.name ?? venue.id, venue.type, undefined,
    [venue.hubId, venue.ownerId].filter(Boolean) as string[])
}

export function toRealmsMarketplace(market: MarketLike): RealmsEntity {
  const id = `marketplace:${market.hubId}`
  const notes = [
    market.taxRate !== undefined ? `tax ${market.taxRate}` : '',
    market.merchants?.length ? `${market.merchants.length} merchants` : '',
    market.venues?.length ? `${market.venues.length} venues` : '',
  ].filter(Boolean).join(' · ')
  return entity(id, 'marketplace', `${market.hubId} marketplace`, undefined, notes,
    [market.hubId])
}

export function toRealmsTemple(temple: TempleLike): RealmsEntity {
  const desc = [temple.size, temple.deityId ? `to ${temple.deityId}` : '']
    .filter(Boolean).join(' · ')
  return entity(temple.id, 'temple', temple.name ?? temple.id, desc, undefined,
    [temple.hubId, temple.deityId, temple.factionId].filter(Boolean) as string[])
}

export function toRealmsBusiness(venue: VenueLike): RealmsEntity {
  return entity(venue.id, 'business', venue.name ?? venue.id, venue.type, undefined,
    [venue.hubId, venue.ownerId].filter(Boolean) as string[])
}

export function toRealmsArchive(library: LibraryLike): RealmsEntity {
  const desc = library.knowledgeTier !== undefined ? `knowledge tier ${library.knowledgeTier}` : undefined
  const notes = library.entries !== undefined ? `${library.entries} entries` : undefined
  return entity(library.id, 'archive', library.name ?? library.id, desc, notes,
    library.hubId ? [library.hubId] : undefined)
}

export function toRealmsTreasury(container: ContainerLike): RealmsEntity {
  return entity(container.id, 'treasury', container.name ?? container.id,
    container.type ?? 'treasury', undefined,
    [container.hubId, container.ownerId].filter(Boolean) as string[])
}

export function toRealmsHealingCenter(venue: VenueLike): RealmsEntity {
  return entity(venue.id, 'healing_center', venue.name ?? venue.id,
    venue.type ?? 'healing services', undefined,
    [venue.hubId, venue.ownerId].filter(Boolean) as string[])
}

export function toRealmsPoliticalCenter(district: DistrictLike): RealmsEntity {
  const desc = district.type
  const notes = district.population !== undefined ? `pop ${district.population}` : undefined
  return entity(district.id, 'political_center', district.name ?? district.id, desc, notes,
    [district.hubId, ...(district.factions ?? [])])
}

export function toRealmsAcademy(library: LibraryLike, workshop?: WorkshopLike): RealmsEntity {
  const id = workshop?.id ? `academy:${library.id}:${workshop.id}` : `academy:${library.id}`
  const desc = library.knowledgeTier !== undefined ? `tier ${library.knowledgeTier}` : 'academy'
  const notes = workshop?.professionId ? `discipline: ${workshop.professionId}` : undefined
  return entity(id, 'academy', library.name ?? id, desc, notes,
    [library.hubId, workshop?.hubId].filter(Boolean) as string[])
}

// ============================================================
// RELATIONSHIP AGGREGATOR
// ============================================================

/**
 * Walk the TP graph + entity registries and emit V2 relationship records.
 * Emits: resides_in, member_of, controlled_by, allied_with, located_at,
 *        descendant_of, sponsored_by, sworn_to (loyalty ≥ 80).
 */
export function toRealmsRelationships(
  tp: TP,
  factions: Faction[] = [],
  households: Household[] = [],
  treaties: Treaty[] = [],
  laws: Law[] = [],
): RealmsRelationship[] {
  const out: RealmsRelationship[] = []

  // 1. Node parent chain → "located_at"
  for (const node of tp.getAllNodes()) {
    if (node.parentId) {
      out.push({ from: node.id, to: node.parentId, type: 'located_at' })
    }
  }

  // 2. Faction members → "member_of"; controlled nodes → "controlled_by"
  for (const faction of factions) {
    for (const member of faction.members) {
      out.push({ from: member.entityId, to: faction.id, type: 'member_of' })
    }
    for (const nodeId of faction.controlledNodes) {
      out.push({ from: nodeId, to: faction.id, type: 'controlled_by' })
    }
    // Loyalty-based "allied_with" / "sworn_enemy"
    for (const [otherFactionId, loyalty] of Object.entries(faction.loyalties)) {
      if (loyalty >= 50)  out.push({ from: faction.id, to: otherFactionId, type: 'allied_with' })
      if (loyalty <= -60) out.push({ from: faction.id, to: otherFactionId, type: 'at_war_with' })
    }
  }

  // 3. Household members → "resides_in"
  for (const household of households) {
    for (const member of household.members) {
      if (member.active === false) continue
      out.push({ from: member.entityId, to: household.id, type: 'resides_in' })
    }
  }

  // 4. Treaties — both sides "signatory_of"; sponsor "sponsored"
  for (const treaty of treaties) {
    out.push({ from: treaty.factionA, to: treaty.id, type: 'signatory_of' })
    out.push({ from: treaty.factionB, to: treaty.id, type: 'signatory_of' })
    if (treaty.sponsorId) {
      out.push({ from: treaty.sponsorId, to: treaty.id, type: 'sponsored_by' })
    }
  }

  // 5. Laws — sponsor + jurisdiction
  for (const law of laws) {
    out.push({ from: law.sponsorId, to: law.id, type: 'sponsored_by' })
    out.push({ from: law.id, to: law.jurisdictionNodeId, type: 'enforced_in' })
  }

  // 6. Entities at nodes (from TP entity registry) → "located_at"
  for (const node of tp.getAllNodes()) {
    const ctx = tp.resolve(node.id)
    if (!ctx) continue
    for (const entityAtNode of ctx.entitiesAt) {
      if (entityAtNode.position.type === 'at_node') {
        out.push({ from: entityAtNode.id, to: entityAtNode.position.nodeId, type: 'located_at' })
      }
    }
  }

  return out
}
