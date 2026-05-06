/**
 * SOCIAL CONTRACT ENGINE — The Obligation Graph
 * ================================================
 * 
 * What binds people together: contracts, households, kinship, titles.
 * These are EDGES in the social graph. Every relationship has:
 *   - Type (marriage, vassalage, debt, employment...)
 *   - Status (proposed → active → fulfilled/breached)
 *   - Visibility (public, private, secret, sacred)
 *   - Jurisdiction (who enforces it?)
 * 
 * This is what makes the ascension system work:
 *   Character ascends → their contracts persist
 *   Household survives → children inherit
 *   Titles pass → succession rules apply
 *   Debts remain → new character inherits obligations
 * 
 * TICK INTEGRATION:
 *   Monthly: contract expiry checks, household wealth recalc,
 *            title vacancy succession, claim pressing
 *   On event: contract creation/breach/termination
 */

// ============================================================
// CONTRACT TYPES — 30 types across 7 categories
// ============================================================

export type ContractCategory =
  | 'personal'    // Marriage, betrothal, adoption, guardianship
  | 'service'     // Apprenticeship, employment, indenture
  | 'feudal'      // Vassalage, fealty, homage, hostage, alliance, truce
  | 'religious'   // Holy vow, ordination, excommunication, sanctuary
  | 'economic'    // Trade partnership, guild membership, loan, debt, land lease
  | 'oath'        // Oath of service, blood oath, geas, promise
  | 'criminal'    // Protection racket, blackmail, blood debt

export type ContractType =
  // Personal
  | 'marriage' | 'betrothal' | 'adoption' | 'guardianship'
  // Service
  | 'apprenticeship' | 'employment' | 'indenture'
  // Feudal
  | 'vassalage' | 'fealty' | 'homage' | 'hostage' | 'alliance' | 'truce' | 'peace_treaty'
  // Religious
  | 'holy_vow' | 'ordination' | 'excommunication' | 'sanctuary'
  // Economic
  | 'trade_partnership' | 'guild_membership' | 'loan' | 'debt' | 'land_lease' | 'merchant_license' | 'company_charter'
  // Oath
  | 'oath_of_service' | 'blood_oath' | 'geas' | 'promise'
  // Criminal
  | 'protection_racket' | 'blackmail' | 'blood_debt'

export type ContractVisibility = 'public' | 'private' | 'secret' | 'sacred'

export type ContractStatus =
  | 'proposed' | 'negotiating' | 'accepted' | 'ratified'
  | 'active' | 'suspended' | 'breached' | 'disputed'
  | 'fulfilled' | 'terminated' | 'annulled' | 'expired'

// ============================================================
// CONTRACT — An edge in the obligation graph
// ============================================================

export interface ContractParty {
  entityType: 'character' | 'faction' | 'household' | 'deity'
  entityId: string
  role: string        // spouse, patron, client, master, apprentice, lord, vassal, creditor, debtor
  consented: boolean
  canExit: boolean
}

export interface Contract {
  id: string
  type: ContractType
  category: ContractCategory
  parties: ContractParty[]
  visibility: ContractVisibility
  status: ContractStatus

  // Jurisdiction
  jurisdictionId?: string

  // Duration
  durationType: 'perpetual' | 'fixed' | 'conditional' | 'until_death'
  durationDays?: number
  startDay: number      // World day
  endDay?: number       // World day (if fixed)

  // Breach tracking
  breachCount: number

  // Obligations and rights (free-form for flexibility)
  obligations: { partyRole: string; description: string }[]
  rights: { partyRole: string; description: string }[]
}

export function createContract(
  type: ContractType,
  parties: ContractParty[],
  worldDay: number,
  overrides: Partial<Contract> = {},
): Contract {
  const category = getContractCategory(type)
  return {
    id: `contract_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    type,
    category,
    parties,
    visibility: 'public',
    status: 'proposed',
    durationType: 'perpetual',
    startDay: worldDay,
    breachCount: 0,
    obligations: [],
    rights: [],
    ...overrides,
  }
}

function getContractCategory(type: ContractType): ContractCategory {
  if (['marriage', 'betrothal', 'adoption', 'guardianship'].includes(type)) return 'personal'
  if (['apprenticeship', 'employment', 'indenture'].includes(type)) return 'service'
  if (['vassalage', 'fealty', 'homage', 'hostage', 'alliance', 'truce', 'peace_treaty'].includes(type)) return 'feudal'
  if (['holy_vow', 'ordination', 'excommunication', 'sanctuary'].includes(type)) return 'religious'
  if (['trade_partnership', 'guild_membership', 'loan', 'debt', 'land_lease', 'merchant_license', 'company_charter'].includes(type)) return 'economic'
  if (['oath_of_service', 'blood_oath', 'geas', 'promise'].includes(type)) return 'oath'
  return 'criminal'
}

// ── Contract lifecycle ──

export function acceptContract(contract: Contract): void {
  if (contract.status !== 'proposed' && contract.status !== 'negotiating') return
  contract.status = 'accepted'
}

export function ratifyContract(contract: Contract, jurisdictionId?: string): void {
  if (contract.status !== 'accepted') return
  contract.status = 'active'
  if (jurisdictionId) contract.jurisdictionId = jurisdictionId
}

export function activateContract(contract: Contract): void {
  contract.status = 'active'
}

export function breachContract(contract: Contract): void {
  if (contract.status !== 'active') return
  contract.breachCount++
  contract.status = 'breached'
}

export function terminateContract(contract: Contract, worldDay: number): void {
  contract.status = 'terminated'
  contract.endDay = worldDay
}

export function fulfillContract(contract: Contract, worldDay: number): void {
  contract.status = 'fulfilled'
  contract.endDay = worldDay
}

export function expireContract(contract: Contract, worldDay: number): boolean {
  if (contract.durationType === 'fixed' && contract.durationDays) {
    if (worldDay >= contract.startDay + contract.durationDays) {
      contract.status = 'expired'
      contract.endDay = worldDay
      return true
    }
  }
  return false
}

// ── Contract queries ──

export function getActiveContracts(contracts: Contract[], entityId: string): Contract[] {
  return contracts.filter(c =>
    c.status === 'active' && c.parties.some(p => p.entityId === entityId)
  )
}

export function getContractsBetween(contracts: Contract[], id1: string, id2: string): Contract[] {
  return contracts.filter(c =>
    c.parties.some(p => p.entityId === id1) && c.parties.some(p => p.entityId === id2)
  )
}

export function hasActiveContract(contracts: Contract[], entityId: string, type: ContractType): boolean {
  return contracts.some(c =>
    c.type === type && c.status === 'active' && c.parties.some(p => p.entityId === entityId)
  )
}

// ============================================================
// HOUSEHOLD — Durable social/economic unit
// ============================================================

export type HouseholdType =
  | 'family' | 'noble_house' | 'merchant_house' | 'guild_hall'
  | 'temple' | 'commune' | 'criminal_gang' | 'adventuring_company'

export type SocialStanding =
  | 'outcast' | 'destitute' | 'poor' | 'common'
  | 'comfortable' | 'wealthy' | 'noble' | 'royal'

export type HouseholdRole =
  | 'head' | 'spouse' | 'heir' | 'child' | 'ward'
  | 'elder' | 'servant' | 'retainer' | 'guest' | 'prisoner'

export interface HouseholdMember {
  entityId: string
  role: HouseholdRole
  joinedDay: number
  active: boolean
}

export interface Household {
  id: string
  name: string
  type: HouseholdType
  hubId: string          // Where they live
  standing: SocialStanding
  treasury: number       // GP
  members: HouseholdMember[]
  /** Properties owned (deed IDs) */
  properties: string[]
  /** Heraldry */
  heraldry?: { colors: string[]; symbol?: string; motto?: string }
  status: 'active' | 'declining' | 'dissolved'
}

export function createHousehold(
  name: string,
  hubId: string,
  headEntityId: string,
  worldDay: number,
  type: HouseholdType = 'family',
): Household {
  return {
    id: `hh_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    name, type, hubId,
    standing: 'common',
    treasury: 0,
    members: [{ entityId: headEntityId, role: 'head', joinedDay: worldDay, active: true }],
    properties: [],
    status: 'active',
  }
}

export function addMember(
  household: Household,
  entityId: string,
  role: HouseholdRole,
  worldDay: number,
): void {
  household.members.push({ entityId, role, joinedDay: worldDay, active: true })
}

export function removeMember(household: Household, entityId: string): void {
  const member = household.members.find(m => m.entityId === entityId && m.active)
  if (member) member.active = false
}

export function getActiveMembers(household: Household): HouseholdMember[] {
  return household.members.filter(m => m.active)
}

export function getHead(household: Household): HouseholdMember | undefined {
  return household.members.find(m => m.role === 'head' && m.active)
}

export function getHeirs(household: Household): HouseholdMember[] {
  return household.members.filter(m => m.role === 'heir' && m.active)
}

/** Succession: remove current head, promote heir or eldest child */
export function succeedHead(household: Household, worldDay: number): string | null {
  const currentHead = getHead(household)
  if (currentHead) currentHead.active = false

  // Try heir first
  const heir = household.members.find(m => m.role === 'heir' && m.active)
  if (heir) {
    heir.role = 'head'
    return heir.entityId
  }

  // Try eldest active child
  const child = household.members
    .filter(m => m.role === 'child' && m.active)
    .sort((a, b) => a.joinedDay - b.joinedDay)[0]
  if (child) {
    child.role = 'head'
    return child.entityId
  }

  // No successor → household declining
  household.status = 'declining'
  return null
}

/** Calculate wealth score from treasury and properties */
export function calculateStanding(household: Household): SocialStanding {
  const wealth = household.treasury + household.properties.length * 100
  if (wealth <= 0) return 'destitute'
  if (wealth < 50) return 'poor'
  if (wealth < 200) return 'common'
  if (wealth < 500) return 'comfortable'
  if (wealth < 2000) return 'wealthy'
  if (wealth < 10000) return 'noble'
  return 'royal'
}

// ============================================================
// KINSHIP — Blood and legal family relationships
// ============================================================

export type KinshipType =
  | 'parent' | 'child' | 'sibling' | 'spouse'
  | 'grandparent' | 'grandchild'
  | 'uncle' | 'aunt' | 'nephew' | 'niece' | 'cousin'
  | 'step_parent' | 'step_child' | 'step_sibling' | 'in_law'

export type Legitimacy = 'legitimate' | 'illegitimate' | 'adopted' | 'legitimized' | 'contested' | 'unknown'

export interface KinshipLink {
  entity1Id: string
  entity2Id: string
  relationship: KinshipType // From entity1's perspective
  legitimacy: Legitimacy
  /** Contract that created this link (marriage, adoption) */
  sourceContractId?: string
  status: 'active' | 'deceased' | 'disowned' | 'annulled'
}

export function createKinshipLink(
  entity1Id: string,
  entity2Id: string,
  relationship: KinshipType,
  legitimacy: Legitimacy = 'legitimate',
): KinshipLink {
  return { entity1Id, entity2Id, relationship, legitimacy, status: 'active' }
}

export function getRelatives(links: KinshipLink[], entityId: string): KinshipLink[] {
  return links.filter(l =>
    l.status === 'active' && (l.entity1Id === entityId || l.entity2Id === entityId)
  )
}

export function getParents(links: KinshipLink[], entityId: string): string[] {
  return links
    .filter(l => l.status === 'active' && l.entity2Id === entityId && l.relationship === 'parent')
    .map(l => l.entity1Id)
}

export function getChildren(links: KinshipLink[], entityId: string): string[] {
  return links
    .filter(l => l.status === 'active' && l.entity1Id === entityId && l.relationship === 'parent')
    .map(l => l.entity2Id)
}

export function getSpouse(links: KinshipLink[], entityId: string): string | null {
  const link = links.find(l =>
    l.status === 'active' && l.relationship === 'spouse' &&
    (l.entity1Id === entityId || l.entity2Id === entityId)
  )
  if (!link) return null
  return link.entity1Id === entityId ? link.entity2Id : link.entity1Id
}

export function areRelated(links: KinshipLink[], id1: string, id2: string): boolean {
  return links.some(l =>
    l.status === 'active' &&
    ((l.entity1Id === id1 && l.entity2Id === id2) || (l.entity1Id === id2 && l.entity2Id === id1))
  )
}

export function canInherit(link: KinshipLink): boolean {
  return link.legitimacy === 'legitimate' || link.legitimacy === 'adopted' || link.legitimacy === 'legitimized'
}

// ============================================================
// TITLES — Inheritable positions of power
// ============================================================

export type TitleRank =
  | 'emperor' | 'king' | 'archduke' | 'duke' | 'marquess'
  | 'count' | 'viscount' | 'baron' | 'baronet' | 'knight'
  | 'lord' | 'mayor' | 'alderman' | 'guildmaster' | 'high_priest' | 'abbot'

export type SuccessionType =
  | 'primogeniture' | 'male_primogeniture' | 'ultimogeniture'
  | 'gavelkind' | 'elective' | 'appointed' | 'conquest' | 'seniority'

export interface Title {
  id: string
  name: string
  rank: TitleRank
  holderId: string | null
  /** Domain node this title controls */
  domainNodeId?: string
  succession: SuccessionType
  /** Rights granted: collect_taxes, administer_justice, raise_levies, grant_land */
  rights: string[]
  /** Obligations: military_service, tax_tribute, court_attendance */
  obligations: string[]
  status: 'active' | 'vacant' | 'disputed' | 'abolished'
}

export function createTitle(
  name: string,
  rank: TitleRank,
  holderId: string | null = null,
  succession: SuccessionType = 'primogeniture',
): Title {
  return {
    id: `title_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    name, rank, holderId, succession,
    rights: [], obligations: [],
    status: holderId ? 'active' : 'vacant',
  }
}

export function transferTitle(title: Title, newHolderId: string): void {
  title.holderId = newHolderId
  title.status = 'active'
}

export function vacateTitle(title: Title): void {
  title.holderId = null
  title.status = 'vacant'
}

/** Rank ordering for comparison (lower = higher rank) */
const RANK_ORDER: TitleRank[] = [
  'emperor', 'king', 'archduke', 'duke', 'marquess', 'count', 'viscount',
  'baron', 'baronet', 'knight', 'lord', 'mayor', 'alderman',
  'guildmaster', 'high_priest', 'abbot',
]

export function compareRank(a: TitleRank, b: TitleRank): number {
  return RANK_ORDER.indexOf(a) - RANK_ORDER.indexOf(b)
}

export function getHighestTitle(titles: Title[], entityId: string): Title | undefined {
  const held = titles.filter(t => t.holderId === entityId && t.status === 'active')
  if (held.length === 0) return undefined
  return held.sort((a, b) => compareRank(a.rank, b.rank))[0]
}

// ============================================================
// JURISDICTION — Who enforces what, where
// ============================================================

export type JurisdictionType =
  | 'royal_court' | 'noble_court' | 'church' | 'temple'
  | 'guild' | 'city' | 'village' | 'tribal' | 'divine' | 'criminal'

export interface Jurisdiction {
  id: string
  name: string
  type: JurisdictionType
  /** Hub or region this jurisdiction covers */
  scopeNodeId?: string
  /** Authority entity (faction, deity, character) */
  authorityId?: string
  /** Higher precedence overrides lower */
  precedence: number
  /** What contract types this jurisdiction recognizes */
  recognizedTypes: ContractType[]
  /** Enforcement powers */
  canFine: boolean
  canImprison: boolean
  canExile: boolean
  canExecute: boolean
  canExcommunicate: boolean
  canConfiscate: boolean
}

export function createJurisdiction(
  name: string,
  type: JurisdictionType,
  recognizedTypes: ContractType[],
  precedence: number = 50,
): Jurisdiction {
  return {
    id: `jur_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    name, type, precedence, recognizedTypes,
    canFine: true, canImprison: false, canExile: false,
    canExecute: false, canExcommunicate: false, canConfiscate: false,
  }
}

export function isEnforceable(jurisdiction: Jurisdiction, contractType: ContractType): boolean {
  return jurisdiction.recognizedTypes.includes(contractType)
}

export function findJurisdiction(
  jurisdictions: Jurisdiction[],
  contractType: ContractType,
  nodeId?: string,
): Jurisdiction | undefined {
  const applicable = jurisdictions
    .filter(j => j.recognizedTypes.includes(contractType))
    .filter(j => !nodeId || !j.scopeNodeId || j.scopeNodeId === nodeId)
    .sort((a, b) => b.precedence - a.precedence)
  return applicable[0]
}

// ============================================================
// MONTHLY SOCIAL TICK — Contract expiry, standing recalc
// ============================================================

export interface SocialTickResult {
  expiredContracts: string[]
  standingChanges: { householdId: string; from: SocialStanding; to: SocialStanding }[]
  vacantTitles: string[]
  successions: { titleId: string; newHolderId: string }[]
}

/**
 * Monthly social tick. Checks contract expiry, recalculates standing,
 * handles title vacancies.
 */
export function monthlySocialTick(
  worldDay: number,
  contracts: Contract[],
  households: Household[],
  titles: Title[],
  kinshipLinks: KinshipLink[],
): SocialTickResult {
  const result: SocialTickResult = {
    expiredContracts: [],
    standingChanges: [],
    vacantTitles: [],
    successions: [],
  }

  // ── Phase 1: Expire fixed-duration contracts ──
  for (const contract of contracts) {
    if (contract.status === 'active' && expireContract(contract, worldDay)) {
      result.expiredContracts.push(contract.id)
    }
  }

  // ── Phase 2: Recalculate household standing ──
  for (const household of households) {
    if (household.status !== 'active') continue
    const oldStanding = household.standing
    const newStanding = calculateStanding(household)
    if (oldStanding !== newStanding) {
      household.standing = newStanding
      result.standingChanges.push({
        householdId: household.id,
        from: oldStanding,
        to: newStanding,
      })
    }
  }

  // ── Phase 3: Handle vacant titles ──
  for (const title of titles) {
    if (title.status !== 'vacant') continue
    result.vacantTitles.push(title.id)

    // Try succession for primogeniture-type titles
    if (title.succession === 'primogeniture' || title.succession === 'male_primogeniture') {
      // Find former holder's children via kinship
      // This is a simplified version — real implementation would walk the kinship graph
      const formerHolderLinks = kinshipLinks.filter(l =>
        l.relationship === 'parent' && l.status === 'active' && canInherit(l)
      )
      if (formerHolderLinks.length > 0) {
        const heir = formerHolderLinks[0].entity2Id
        transferTitle(title, heir)
        result.successions.push({ titleId: title.id, newHolderId: heir })
      }
    }
  }

  return result
}

// ============================================================
// CHARACTER ASCENSION — Social continuity
// ============================================================

/**
 * When a character ascends (becomes topological), their social obligations persist:
 * - Contracts transfer to heir or household
 * - Household succession triggers
 * - Titles pass to next in line
 * - Debts become household debts
 * 
 * Returns the heir entity ID if one takes over.
 */
export function ascendCharacterSocial(
  entityId: string,
  worldDay: number,
  contracts: Contract[],
  household: Household | undefined,
  titles: Title[],
): { heirId: string | null; transferredContracts: number; transferredTitles: number } {
  let heirId: string | null = null
  let transferredContracts = 0
  let transferredTitles = 0

  // ── Household succession ──
  if (household) {
    const head = getHead(household)
    if (head && head.entityId === entityId) {
      heirId = succeedHead(household, worldDay)
    }
  }

  // ── Contract transfer ──
  if (heirId) {
    for (const contract of contracts) {
      if (contract.status !== 'active') continue
      const party = contract.parties.find(p => p.entityId === entityId)
      if (party) {
        // Transfer contract to heir
        party.entityId = heirId
        transferredContracts++
      }
    }
  } else {
    // No heir → terminate all contracts
    for (const contract of contracts) {
      if (contract.status !== 'active') continue
      if (contract.parties.some(p => p.entityId === entityId)) {
        terminateContract(contract, worldDay)
      }
    }
  }

  // ── Title transfer ──
  for (const title of titles) {
    if (title.holderId !== entityId) continue
    if (heirId) {
      transferTitle(title, heirId)
      transferredTitles++
    } else {
      vacateTitle(title)
    }
  }

  return { heirId, transferredContracts, transferredTitles }
}

// ============================================================
// FAMILY REGISTRY (KOSEKI) — Node-bound family records
// ============================================================
//
// The koseki is the settlement's official family register.
// Marriage, birth, death, adoption, divorce — all go through here.
// The registry is bound to a settlement node (the "city hall"),
// not to individual actors.
//
// Design based on Japan's 戸籍 system:
//   - One person is the head (筆頭者)
//   - Marriage = registering into a family
//   - Birth = adding a child
//   - Death = marking exit (never deleted)
//   - Adoption = transfer between registries
//   - Divorce = removal + new registry or return to parent's

export type RegistryEntryType = 'head' | 'spouse' | 'child' | 'adopted' | 'ward'
export type RegistryExitReason = 'death' | 'marriage_out' | 'divorce' | 'adoption_out' | 'disown' | 'exile'

export interface FamilyRegistryEntry {
  entityId: string
  name: string
  entryType: RegistryEntryType
  enteredDay: number
  exitedDay: number | null
  exitReason: RegistryExitReason | null
  birthDay?: number
  deathDay?: number
  legitimacy: Legitimacy
}

export interface FamilyRegistry {
  id: string
  familyName: string
  /** Settlement node where this registry is filed */
  registeredAt: string
  /** The registry head (筆頭者) — usually founder or eldest */
  headId: string
  entries: FamilyRegistryEntry[]
  /** Link to the economic unit */
  householdId: string
  createdDay: number
  status: 'active' | 'extinct' | 'merged'
}

// ── Registry creation ──

export function createFamilyRegistry(
  familyName: string,
  settlementNodeId: string,
  headEntityId: string,
  headName: string,
  householdId: string,
  worldDay: number,
): FamilyRegistry {
  return {
    id: `reg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    familyName,
    registeredAt: settlementNodeId,
    headId: headEntityId,
    entries: [{
      entityId: headEntityId,
      name: headName,
      entryType: 'head',
      enteredDay: worldDay,
      exitedDay: null,
      exitReason: null,
      legitimacy: 'legitimate',
    }],
    householdId,
    createdDay: worldDay,
    status: 'active',
  }
}

// ── Marriage — The orchestrator ──

export interface MarriageResult {
  contract: Contract
  kinshipLink: KinshipLink
  registry: FamilyRegistry
  household: Household
}

/**
 * registerMarriage — the one function that does everything.
 * 
 * Creates: marriage contract + spouse kinship + registry entry + household update.
 * 
 * Two modes:
 *   - 'join': entityB joins entityA's existing registry (traditional)
 *   - 'new': both start a new registry together (fresh family)
 */
export function registerMarriage(
  entityA: { id: string; name: string },
  entityB: { id: string; name: string },
  settlementNodeId: string,
  worldDay: number,
  existingRegistry?: FamilyRegistry,
  existingHousehold?: Household,
  jurisdictionId?: string,
): MarriageResult {
  // 1. Create marriage contract
  const contract = createContract('marriage', [
    { entityType: 'character', entityId: entityA.id, role: 'spouse', consented: true, canExit: true },
    { entityType: 'character', entityId: entityB.id, role: 'spouse', consented: true, canExit: true },
  ], worldDay, {
    durationType: 'until_death',
    visibility: 'public',
    status: 'active',
    jurisdictionId,
  })

  // 2. Create kinship link
  const kinshipLink = createKinshipLink(entityA.id, entityB.id, 'spouse')

  // 3. Registry: join existing or create new
  let registry: FamilyRegistry
  let household: Household

  if (existingRegistry && existingHousehold) {
    // Join mode: entityB enters entityA's registry
    registry = existingRegistry
    registry.entries.push({
      entityId: entityB.id,
      name: entityB.name,
      entryType: 'spouse',
      enteredDay: worldDay,
      exitedDay: null,
      exitReason: null,
      legitimacy: 'legitimate',
    })
    household = existingHousehold
    addMember(household, entityB.id, 'spouse', worldDay)
  } else {
    // New mode: create fresh registry and household
    household = createHousehold(
      `${entityA.name} & ${entityB.name}`,
      settlementNodeId,
      entityA.id,
      worldDay,
      'family',
    )
    addMember(household, entityB.id, 'spouse', worldDay)

    registry = createFamilyRegistry(
      entityA.name.split(' ').pop() ?? entityA.name,
      settlementNodeId,
      entityA.id,
      entityA.name,
      household.id,
      worldDay,
    )
    registry.entries.push({
      entityId: entityB.id,
      name: entityB.name,
      entryType: 'spouse',
      enteredDay: worldDay,
      exitedDay: null,
      exitReason: null,
      legitimacy: 'legitimate',
    })
  }

  return { contract, kinshipLink, registry, household }
}

// ── MF Child Pool — Twin-spawn economics ──
//
// Same pattern as the dice pool:
//   registerBirth() → generate 2, use 1, recycle 1 into the pool
//   drawFromChildPool() → pop a pre-generated spare child
//   Net consumption per birth = 0. The pool only grows.
//
// When a settlement needs an NPC (shopkeeper, guard, commoner),
// it draws from the spare pool instead of generating from scratch.

export interface SpareChild {
  name: string
  firstName: string
  familyName: string
  gender: 'masculine' | 'feminine'
  generatedDay: number
  /** Biological parents (for kinship if needed later) */
  motherId: string
  fatherId: string
  legitimacy: Legitimacy
  /** Deterministic seed used for generation */
  seed: number
}

export interface ChildPool {
  settlementNodeId: string
  spares: SpareChild[]
  totalGenerated: number
  totalDrawn: number
}

export function createChildPool(settlementNodeId: string): ChildPool {
  return { settlementNodeId, spares: [], totalGenerated: 0, totalDrawn: 0 }
}

/**
 * Draw a pre-generated spare child from the settlement pool.
 * Used when you need an NPC, a replacement character, or a future birth.
 */
export function drawFromChildPool(pool: ChildPool): SpareChild | null {
  if (pool.spares.length === 0) return null
  pool.totalDrawn++
  return pool.spares.shift()!
}

// ── Birth ──

export interface BirthResult {
  kinshipToMother: KinshipLink
  kinshipToFather: KinshipLink
  registryEntry: FamilyRegistryEntry
}

export function registerBirth(
  registry: FamilyRegistry,
  household: Household,
  childId: string,
  childName: string,
  motherId: string,
  fatherId: string,
  worldDay: number,
  legitimacy: Legitimacy = 'legitimate',
  kinshipLinks: KinshipLink[] = [],
  namePool?: NamePool,
  childPool?: ChildPool,
): BirthResult {
  const entry: FamilyRegistryEntry = {
    entityId: childId,
    name: childName,
    entryType: 'child',
    enteredDay: worldDay,
    exitedDay: null,
    exitReason: null,
    birthDay: worldDay,
    legitimacy,
  }
  registry.entries.push(entry)
  addMember(household, childId, 'child', worldDay)

  const kinshipToMother = createKinshipLink(motherId, childId, 'parent', legitimacy)
  const kinshipToFather = createKinshipLink(fatherId, childId, 'parent', legitimacy)
  kinshipLinks.push(kinshipToMother, kinshipToFather)

  // ── MF TWIN SPAWN ──
  // Same economics as the dice pool: grind 2, use 1, recycle 1.
  // Every birth generates a spare child for the settlement pool.
  if (namePool && childPool) {
    const seed = worldDay * 7919 + childPool.spares.length
    const gender = ((seed * 31) & 1) === 0 ? 'masculine' as const : 'feminine' as const
    const spareName = generateName(namePool, gender, seed)
    const spare: SpareChild = {
      name: `${spareName.firstName} ${registry.familyName}`,
      firstName: spareName.firstName,
      familyName: registry.familyName,
      gender,
      generatedDay: worldDay,
      motherId,
      fatherId,
      legitimacy,
      seed,
    }
    childPool.spares.push(spare)
    childPool.totalGenerated++
  }

  return { kinshipToMother, kinshipToFather, registryEntry: entry }
}

// ── Death ──

export function registerDeath(
  registry: FamilyRegistry,
  household: Household,
  entityId: string,
  worldDay: number,
  kinshipLinks: KinshipLink[],
): { wasHead: boolean; successorId: string | null } {
  // Mark in registry
  const entry = registry.entries.find(e => e.entityId === entityId && !e.exitedDay)
  if (entry) {
    entry.exitedDay = worldDay
    entry.exitReason = 'death'
    entry.deathDay = worldDay
  }

  // Mark in kinship
  for (const link of kinshipLinks) {
    if (link.entity1Id === entityId || link.entity2Id === entityId) {
      if (link.relationship === 'spouse') link.status = 'deceased'
    }
  }

  // Remove from household
  removeMember(household, entityId)

  // Was this the head?
  const wasHead = registry.headId === entityId
  let successorId: string | null = null

  if (wasHead) {
    // Succession: promote spouse, then eldest child
    const spouse = registry.entries.find(e => e.entryType === 'spouse' && !e.exitedDay)
    if (spouse) {
      registry.headId = spouse.entityId
      spouse.entryType = 'head'
      successorId = spouse.entityId
    } else {
      const child = registry.entries
        .filter(e => (e.entryType === 'child' || e.entryType === 'adopted') && !e.exitedDay)
        .sort((a, b) => a.enteredDay - b.enteredDay)[0]
      if (child) {
        registry.headId = child.entityId
        child.entryType = 'head'
        successorId = child.entityId
      } else {
        registry.status = 'extinct'
      }
    }
    // Also handle household succession
    succeedHead(household, worldDay)
  }

  return { wasHead, successorId }
}

// ── Adoption ──

export function registerAdoption(
  fromRegistry: FamilyRegistry,
  toRegistry: FamilyRegistry,
  toHousehold: Household,
  childId: string,
  childName: string,
  adoptiveParentId: string,
  worldDay: number,
  kinshipLinks: KinshipLink[] = [],
): { kinshipLink: KinshipLink } {
  // Exit from source registry
  const sourceEntry = fromRegistry.entries.find(e => e.entityId === childId && !e.exitedDay)
  if (sourceEntry) {
    sourceEntry.exitedDay = worldDay
    sourceEntry.exitReason = 'adoption_out'
  }

  // Enter into target registry
  toRegistry.entries.push({
    entityId: childId,
    name: childName,
    entryType: 'adopted',
    enteredDay: worldDay,
    exitedDay: null,
    exitReason: null,
    legitimacy: 'adopted',
  })
  addMember(toHousehold, childId, 'child', worldDay)

  // Create adoption kinship
  const kinshipLink = createKinshipLink(adoptiveParentId, childId, 'parent', 'adopted')
  kinshipLinks.push(kinshipLink)

  return { kinshipLink }
}

// ── Divorce ──

export interface DivorceResult {
  terminatedContract: Contract | null
  exitedEntry: FamilyRegistryEntry | null
  newRegistry: FamilyRegistry | null
  newHousehold: Household | null
}

export function registerDivorce(
  registry: FamilyRegistry,
  household: Household,
  leavingEntityId: string,
  leavingEntityName: string,
  contracts: Contract[],
  kinshipLinks: KinshipLink[],
  worldDay: number,
  newSettlementNodeId?: string,
): DivorceResult {
  // 1. Exit from registry
  const entry = registry.entries.find(e => e.entityId === leavingEntityId && !e.exitedDay)
  if (entry) {
    entry.exitedDay = worldDay
    entry.exitReason = 'divorce'
  }

  // 2. Terminate marriage contract
  const marriageContract = contracts.find(c =>
    c.type === 'marriage' && c.status === 'active' &&
    c.parties.some(p => p.entityId === leavingEntityId)
  ) ?? null
  if (marriageContract) terminateContract(marriageContract, worldDay)

  // 3. Update kinship (spouse → annulled)
  for (const link of kinshipLinks) {
    if (link.relationship === 'spouse' &&
        (link.entity1Id === leavingEntityId || link.entity2Id === leavingEntityId)) {
      link.status = 'annulled'
    }
  }

  // 4. Remove from household
  removeMember(household, leavingEntityId)

  // 5. Create new registry for the leaving party at their settlement
  const nodeId = newSettlementNodeId ?? registry.registeredAt
  const newHousehold = createHousehold(leavingEntityName, nodeId, leavingEntityId, worldDay, 'family')
  const newRegistry = createFamilyRegistry(
    leavingEntityName.split(' ').pop() ?? leavingEntityName,
    nodeId,
    leavingEntityId,
    leavingEntityName,
    newHousehold.id,
    worldDay,
  )

  return {
    terminatedContract: marriageContract,
    exitedEntry: entry ?? null,
    newRegistry,
    newHousehold,
  }
}

// ── Registry queries ──

export function getRegistryAt(registries: FamilyRegistry[], settlementNodeId: string): FamilyRegistry[] {
  return registries.filter(r => r.registeredAt === settlementNodeId && r.status === 'active')
}

export function getEntityRegistry(registries: FamilyRegistry[], entityId: string): FamilyRegistry | null {
  return registries.find(r =>
    r.status === 'active' && r.entries.some(e => e.entityId === entityId && !e.exitedDay)
  ) ?? null
}

export function getActiveRegistryMembers(registry: FamilyRegistry): FamilyRegistryEntry[] {
  return registry.entries.filter(e => !e.exitedDay)
}

export interface LineageNode {
  entityId: string
  relationship: KinshipType
  children: LineageNode[]
}

/** Build a lineage tree from kinship links starting from an entity */
export function getRegistryLineage(
  kinshipLinks: KinshipLink[],
  entityId: string,
  depth: number = 3,
): LineageNode[] {
  if (depth <= 0) return []
  const childLinks = kinshipLinks.filter(l =>
    l.status === 'active' && l.entity1Id === entityId && l.relationship === 'parent'
  )
  return childLinks.map(l => ({
    entityId: l.entity2Id,
    relationship: 'child' as KinshipType,
    children: getRegistryLineage(kinshipLinks, l.entity2Id, depth - 1),
  }))
}

// ============================================================
// REGIONAL NAME POOLS — Culture-driven name generation
// ============================================================
//
// Each region's culture κ provides a grab bag of first names
// and family names. Births pull from these pools. The family
// name comes from the registry itself, but first names are
// drawn from the region's culture.

export interface NamePool {
  culture: string
  masculine: string[]
  feminine: string[]
  neutral: string[]
  familyNames: string[]
}

/** Seed name pools — keyed by culture identifier */
export const NAME_POOLS: Record<string, NamePool> = {
  cormyrian: {
    culture: 'cormyrian',
    masculine: [
      'Azoun', 'Baerauble', 'Caladnei', 'Dauneth', 'Emlar', 'Foril',
      'Garen', 'Hector', 'Iltharl', 'Jorunhast', 'Korven', 'Lionar',
      'Myrmeen', 'Ondeth', 'Prester', 'Rhigaerd', 'Salember', 'Thomdor',
      'Ulbrec', 'Vangerdahast', 'Wyvernspur',
    ],
    feminine: [
      'Alusair', 'Braera', 'Crownsilver', 'Dara', 'Emmarask', 'Filfaeril',
      'Glarasteer', 'Hawklin', 'Immerdusk', 'Jalaunthe', 'Korvaelin',
      'Lusheela', 'Merenyl', 'Nalara', 'Obarskyr', 'Phrara', 'Raedra',
      'Sulesta', 'Tanalasta', 'Vainrence',
    ],
    neutral: ['Reth', 'Sorn', 'Penn', 'Alyn', 'Kael', 'Morn'],
    familyNames: [
      'Obarskyr', 'Crownsilver', 'Huntsilver', 'Wyvernspur', 'Bleth',
      'Cormaeril', 'Dauntinghorn', 'Emmarask', 'Goldfeather', 'Hawklin',
      'Illance', 'Immerdusk', 'Lionar', 'Marliir', 'Rowanmantle',
      'Skatterhawk', 'Truesilver', 'Thundersword', 'Vainrence',
    ],
  },
  sword_coast: {
    culture: 'sword_coast',
    masculine: [
      'Aldric', 'Bran', 'Cassius', 'Dagult', 'Elminster', 'Falkner',
      'Gorion', 'Harkle', 'Imoen', 'Jaryn', 'Kelben', 'Laeral',
      'Malchor', 'Neverember', 'Ontharr', 'Piergeiron', 'Rendall',
      'Stedd', 'Tristan', 'Volothamp',
    ],
    feminine: [
      'Althea', 'Brianne', 'Cattie', 'Dove', 'Elara', 'Fiona',
      'Galyn', 'Hesper', 'Ilmara', 'Jhessail', 'Khelben', 'Liriel',
      'Miri', 'Nala', 'Oleanne', 'Penelope', 'Remallia', 'Shaleen',
      'Tabra', 'Verity',
    ],
    neutral: ['Storm', 'Ash', 'River', 'Sage', 'Wren', 'Lark'],
    familyNames: [
      'Amcathra', 'Bladesemmer', 'Cassalanter', 'Eltorchul', 'Gralhund',
      'Husteem', 'Ilvastarr', 'Jardeth', 'Kothont', 'Lathkule',
      'Margaster', 'Neverember', 'Phylund', 'Rosznar', 'Snobeedle',
      'Thongolir', 'Ulbrinter', 'Wands', 'Zulpair',
    ],
  },
  drow: {
    culture: 'drow',
    masculine: [
      'Drizzt', 'Zaknafein', 'Jarlaxle', 'Pharaun', 'Ryld', 'Gromph',
      'Dinin', 'Nalfein', 'Masoj', 'Kelnozz', 'Alton', 'Vhaeraun',
      'Solaufein', 'Rizzen', 'Tsabrak', 'Nimor', 'Halisstra',
    ],
    feminine: [
      'Quenthel', 'Triel', 'Lolth', 'Eilistraee', 'Matron', 'Yvonnel',
      'Briza', 'Vierna', 'Maya', 'Shivra', 'Zeerith', 'Menzoberra',
      'Kyrnill', 'Jhael', 'Dhaunae', 'Irae', 'Akordia',
    ],
    neutral: ['Szith', 'Ched', 'Velkyn', 'Sshamath', 'Eryndlyn'],
    familyNames: [
      'Do\'Urden', 'Baenre', 'Barrison Del\'Armgo', 'Oblodra', 'Faen Tlabbar',
      'Xorlarrin', 'Mizzrym', 'Fey-Branche', 'Tuin\'Tarl', 'Hunzrin',
      'Kenafin', 'Melarn', 'Vandree', 'Despana', 'Agrach Dyrr',
    ],
  },
  dwarven: {
    culture: 'dwarven',
    masculine: [
      'Bruenor', 'Dagnabbet', 'Ebenezer', 'Flint', 'Gimli', 'Harbromm',
      'Konnal', 'Moradin', 'Orsik', 'Rangrim', 'Thoradin', 'Ulfgar',
      'Vondal', 'Whurbin', 'Barendd', 'Gurdis', 'Kildrak',
    ],
    feminine: [
      'Amber', 'Bardryn', 'Dagnal', 'Diesa', 'Eldeth', 'Gunnloda',
      'Helja', 'Kathra', 'Liftrasa', 'Mardred', 'Riswynn', 'Sannl',
      'Torbera', 'Vistra', 'Artin', 'Huldra', 'Ilde',
    ],
    neutral: ['Adrik', 'Torinn', 'Rurik', 'Brottor', 'Dain'],
    familyNames: [
      'Battlehammer', 'Ironfist', 'Stoneshield', 'Fireforge', 'Deepdelver',
      'Goldhill', 'Hammerfall', 'Ironforge', 'Mithrilaxe', 'Onyxhammer',
      'Rumnaheim', 'Steelshaper', 'Thunderbrew', 'Ungart', 'Warcrown',
    ],
  },
  halfling: {
    culture: 'halfling',
    masculine: [
      'Alton', 'Cade', 'Corrin', 'Eldon', 'Finnan', 'Garret',
      'Lyle', 'Merric', 'Milo', 'Osborn', 'Perrin', 'Reed',
      'Roscoe', 'Sam', 'Wellby', 'Wendel',
    ],
    feminine: [
      'Andry', 'Bree', 'Callie', 'Cora', 'Euphemia', 'Jillian',
      'Kithri', 'Lavinia', 'Lidda', 'Merla', 'Nedda', 'Paela',
      'Portia', 'Seraphina', 'Shaena', 'Vani',
    ],
    neutral: ['Pip', 'Twig', 'Wren', 'Moss', 'Perry', 'Thistle'],
    familyNames: [
      'Brushgather', 'Goodbarrel', 'Greenbottle', 'Highhill', 'Hilltopple',
      'Leagallow', 'Tealeaf', 'Thorngage', 'Tosscobble', 'Underbough',
      'Stoutbridge', 'Tallfellow', 'Wanderfoot', 'Appleblossom',
    ],
  },
}

/**
 * Pick a random name from a pool.
 * Uses a seed for determinism (worldDay + entity count).
 */
export function generateName(
  pool: NamePool,
  gender: 'masculine' | 'feminine' | 'neutral' = 'neutral',
  seed: number = Date.now(),
): { firstName: string; familyName: string } {
  const names = gender === 'masculine' ? pool.masculine
    : gender === 'feminine' ? pool.feminine
    : pool.neutral

  // Simple seeded selection (good enough for name generation)
  const firstIdx = ((seed * 7919) & 0x7FFFFFFF) % names.length
  const familyIdx = ((seed * 104729) & 0x7FFFFFFF) % pool.familyNames.length

  return {
    firstName: names[firstIdx],
    familyName: pool.familyNames[familyIdx],
  }
}

/** Get the name pool for a culture, with fallback */
export function getNamePool(culture: string): NamePool | null {
  return NAME_POOLS[culture] ?? null
}

// ============================================================
// LAW ENTITY — Durable decree records
//
// === REALMS-OF-SHOD ALIGNMENT: law ===
// See: docs/realms-of-shod-mapping.md
// Downgrade: src/lib/realms-of-shod-export.ts toRealmsLaw()
//
// The κ.law domain in tp.ts holds the RUNTIME enforcement state
// (enforcement level, special rules). This entity holds the
// HISTORY — who passed what decree, on which day, and when it
// was repealed. The κ override stays as the fast read-path;
// the Law record is the audit trail that feeds into chronicles.
// ============================================================

export type LawStatus = 'active' | 'repealed' | 'suspended'

export interface Law {
  id: string
  /** The .tp node whose jurisdiction this law governs */
  jurisdictionNodeId: string
  /** Human-readable text of the decree */
  decree: string
  /** World day the law took effect */
  effectiveDay: number
  /** World day the law was repealed (absent = still active) */
  repealDay?: number
  /** Entity (NPC or faction) that sponsored / passed the decree */
  sponsorId: string
  status: LawStatus
}

let _lawCounter = 0
export function resetLawIdCounter(): void { _lawCounter = 0 }

export function createLaw(
  jurisdictionNodeId: string,
  decree: string,
  effectiveDay: number,
  sponsorId: string,
): Law {
  return {
    id: `law_${++_lawCounter}`,
    jurisdictionNodeId,
    decree,
    effectiveDay,
    sponsorId,
    status: 'active',
  }
}

export function repealLaw(law: Law, repealDay: number): void {
  law.status = 'repealed'
  law.repealDay = repealDay
}

export function suspendLaw(law: Law): void {
  law.status = 'suspended'
}

/** All laws currently in effect at a given jurisdiction node. */
export function getLawsAt(jurisdictionNodeId: string, laws: Law[]): Law[] {
  return laws.filter(l => l.jurisdictionNodeId === jurisdictionNodeId && l.status === 'active')
}

