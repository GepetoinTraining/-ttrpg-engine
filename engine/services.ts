/**
 * SERVICES ENGINE — Banking, PMC, Legal, Artisan, Discretion
 * =============================================================
 *
 * Services are the HIGH-END economy. Beyond buying/selling goods,
 * these are the contracts for:
 *   - Banking (custody, loans, escrow, insurance)
 *   - Private Military (escort, security, enforcement)
 *   - Legal (representation, arbitration, notary)
 *   - Logistics (coordination, storage, transport)
 *   - Artisan (craft, repair, enchant)
 *   - Discretion (info brokering, anonymity)
 *   - Temple (custody, escrow, arbitration)
 *   - Guild (representation, craft, repair)
 *
 * Provider tier gates what services can be offered.
 * NPC time slots are consumed by execution.
 *
 * TICK INTEGRATION:
 *   Weekly: contract progress, provider revenue/cost
 *   On event: service request, execution, completion
 */

// ============================================================
// SERVICE TYPES — 21 things you can hire someone to do
// ============================================================

export type ServiceType =
  // Banking
  | 'banking_custody' | 'loan' | 'escrow' | 'guarantee' | 'insurance'
  // PMC
  | 'pmc_escort' | 'pmc_retainer' | 'pmc_security' | 'pmc_enforcement'
  // Legal
  | 'legal_representation' | 'legal_arbitration' | 'legal_notary' | 'legal_investigation'
  // Logistics
  | 'logistics_coordination' | 'logistics_storage' | 'logistics_transport'
  // Artisan
  | 'artisan_craft' | 'artisan_repair' | 'artisan_enchant'
  // Discretion
  | 'discretion_service' | 'information_brokering'

// ============================================================
// PROVIDER TYPES — 8 kinds of service businesses
// ============================================================

export type ProviderType =
  | 'bank' | 'pmc' | 'legal' | 'logistics'
  | 'artisan' | 'discretion' | 'temple' | 'guild'

/** What services each provider type can offer */
export const PROVIDER_CATALOG: Record<ProviderType, ServiceType[]> = {
  bank:       ['banking_custody', 'loan', 'escrow', 'guarantee', 'insurance'],
  pmc:        ['pmc_escort', 'pmc_retainer', 'pmc_security', 'pmc_enforcement'],
  legal:      ['legal_representation', 'legal_arbitration', 'legal_notary', 'legal_investigation'],
  logistics:  ['logistics_coordination', 'logistics_storage', 'logistics_transport'],
  artisan:    ['artisan_craft', 'artisan_repair', 'artisan_enchant'],
  discretion: ['discretion_service', 'information_brokering'],
  temple:     ['banking_custody', 'escrow', 'legal_arbitration', 'guarantee'],
  guild:      ['legal_representation', 'guarantee', 'artisan_craft', 'artisan_repair'],
}

// ============================================================
// MERCHANT TIER GATES — Higher tier = more services
// ============================================================

import type { MerchantTier } from './market'

/** Minimum tier required to offer each service */
export const SERVICE_TIER_GATES: Record<ServiceType, MerchantTier> = {
  // Banking
  banking_custody: 'shop',
  loan:            'emporium',
  escrow:          'shop',
  guarantee:       'trading_house',
  insurance:       'trading_house',
  // PMC
  pmc_escort:      'stall',
  pmc_retainer:    'shop',
  pmc_security:    'emporium',
  pmc_enforcement: 'trading_house',
  // Legal
  legal_representation: 'shop',
  legal_arbitration:    'emporium',
  legal_notary:         'stall',
  legal_investigation:  'shop',
  // Logistics
  logistics_coordination: 'shop',
  logistics_storage:      'stall',
  logistics_transport:    'shop',
  // Artisan
  artisan_craft:   'stall',
  artisan_repair:  'peddler',
  artisan_enchant: 'emporium',
  // Discretion
  discretion_service:    'shop',
  information_brokering: 'emporium',
}

// ============================================================
// URGENCY — How fast, how expensive
// ============================================================

export type Urgency = 'routine' | 'priority' | 'emergency'

export const URGENCY_MULTIPLIERS: Record<Urgency, number> = {
  routine:   1.0,
  priority:  1.5,
  emergency: 3.0,
}

// ============================================================
// SERVICE PROVIDER — An entity that offers services
// ============================================================

export interface ServiceProvider {
  id: string
  hubId: string
  providerType: ProviderType
  tier: MerchantTier
  npcId?: string
  factionId?: string
  fameScore: number        // 0-100
  capitalGp: number
  offeredServices: ServiceType[]
  status: 'active' | 'suspended' | 'closed' | 'bankrupt'
}

export function createProvider(
  hubId: string,
  providerType: ProviderType,
  tier: MerchantTier = 'shop',
  overrides: Partial<ServiceProvider> = {},
): ServiceProvider {
  // Auto-filter services by tier
  const catalog = PROVIDER_CATALOG[providerType]
  const TIER_ORDER: MerchantTier[] = ['peddler', 'stall', 'shop', 'emporium', 'trading_house', 'consortium']
  const tierIdx = TIER_ORDER.indexOf(tier)
  const offered = catalog.filter(s => TIER_ORDER.indexOf(SERVICE_TIER_GATES[s]) <= tierIdx)

  return {
    id: `prov_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    hubId, providerType, tier,
    fameScore: 25,
    capitalGp: 500,
    offeredServices: offered,
    status: 'active',
    ...overrides,
  }
}

export function canOfferService(provider: ServiceProvider, service: ServiceType): boolean {
  return provider.offeredServices.includes(service) && provider.status === 'active'
}

// ============================================================
// SERVICE CONTRACT — Active work agreement
// ============================================================

export type ContractStatus = 'proposed' | 'active' | 'completed' | 'failed' | 'cancelled'

export interface ServiceContract {
  id: string
  providerId: string
  clientId: string
  clientType: 'character' | 'npc' | 'party' | 'faction'
  serviceType: ServiceType
  urgency: Urgency
  status: ContractStatus
  baseQuoteGp: number
  finalCostGp?: number
  startDay: number       // World day
  estimatedSlots: number // NPC time slots to execute
  slotsConsumed: number
  executorNpcId?: string
}

/** Calculate a service quote based on type, tier, fame, urgency */
export function quoteService(
  provider: ServiceProvider,
  serviceType: ServiceType,
  urgency: Urgency = 'routine',
): { baseGp: number; urgencyMultiplier: number; famePremium: number; totalGp: number } {
  // Base costs per service category
  const BASE_COSTS: Record<ServiceType, number> = {
    banking_custody: 5,   loan: 0, escrow: 10, guarantee: 50, insurance: 25,
    pmc_escort: 20, pmc_retainer: 50, pmc_security: 30, pmc_enforcement: 100,
    legal_representation: 15, legal_arbitration: 25, legal_notary: 5, legal_investigation: 40,
    logistics_coordination: 15, logistics_storage: 5, logistics_transport: 20,
    artisan_craft: 10, artisan_repair: 5, artisan_enchant: 100,
    discretion_service: 30, information_brokering: 50,
  }

  const baseGp = BASE_COSTS[serviceType] || 10
  const urgencyMul = URGENCY_MULTIPLIERS[urgency]
  const famePremium = 1 + (provider.fameScore / 200)   // 0-50% fame premium
  const totalGp = Math.round(baseGp * urgencyMul * famePremium * 100) / 100

  return { baseGp, urgencyMultiplier: urgencyMul, famePremium, totalGp }
}

export function createServiceContract(
  providerId: string,
  clientId: string,
  clientType: ServiceContract['clientType'],
  serviceType: ServiceType,
  worldDay: number,
  urgency: Urgency = 'routine',
  quoteGp: number = 10,
): ServiceContract {
  const slotsEstimate: Record<Urgency, number> = { routine: 4, priority: 2, emergency: 1 }
  return {
    id: `svc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    providerId, clientId, clientType, serviceType, urgency,
    status: 'proposed',
    baseQuoteGp: quoteGp,
    startDay: worldDay,
    estimatedSlots: slotsEstimate[urgency],
    slotsConsumed: 0,
  }
}

export function acceptServiceContract(contract: ServiceContract): void {
  if (contract.status === 'proposed') contract.status = 'active'
}

export function progressServiceContract(contract: ServiceContract, slotsWorked: number): void {
  if (contract.status !== 'active') return
  contract.slotsConsumed += slotsWorked
  if (contract.slotsConsumed >= contract.estimatedSlots) {
    contract.status = 'completed'
    contract.finalCostGp = contract.baseQuoteGp
  }
}

export function failServiceContract(contract: ServiceContract): void {
  if (contract.status === 'active') {
    contract.status = 'failed'
    contract.finalCostGp = Math.round(contract.baseQuoteGp * 0.25) // 25% penalty
  }
}

export function cancelServiceContract(contract: ServiceContract): void {
  if (contract.status === 'proposed' || contract.status === 'active') {
    const wasActive = contract.status === 'active'
    contract.status = 'cancelled'
    contract.finalCostGp = wasActive
      ? Math.round(contract.baseQuoteGp * 0.5) // 50% cancellation fee
      : 0
  }
}

// ============================================================
// INSURANCE / RISK CONTRACT
// ============================================================

export type CoveredEvent =
  | 'cargo_loss' | 'route_attack' | 'theft' | 'fire' | 'flood'
  | 'death' | 'injury' | 'contract_default' | 'magical_accident'

export interface RiskContract {
  id: string
  providerId: string
  clientId: string
  coveredEvents: CoveredEvent[]
  coverageLimitGp: number
  premiumGp: number
  startDay: number
  durationDays: number
  status: 'active' | 'expired' | 'claimed_out' | 'cancelled'
  claimsPaid: number
}

export function createRiskContract(
  providerId: string,
  clientId: string,
  coveredEvents: CoveredEvent[],
  coverageLimitGp: number,
  premiumGp: number,
  worldDay: number,
  durationDays: number = 30,
): RiskContract {
  return {
    id: `risk_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    providerId, clientId, coveredEvents,
    coverageLimitGp, premiumGp,
    startDay: worldDay, durationDays,
    status: 'active', claimsPaid: 0,
  }
}

export function fileClaim(contract: RiskContract, eventType: CoveredEvent, amountGp: number): {
  approved: boolean; paidGp: number; remaining: number
} {
  if (contract.status !== 'active') return { approved: false, paidGp: 0, remaining: 0 }
  if (!contract.coveredEvents.includes(eventType)) return { approved: false, paidGp: 0, remaining: 0 }

  const remaining = contract.coverageLimitGp - contract.claimsPaid
  const paid = Math.min(amountGp, remaining)
  contract.claimsPaid += paid

  if (contract.claimsPaid >= contract.coverageLimitGp) {
    contract.status = 'claimed_out'
  }

  return { approved: true, paidGp: paid, remaining: remaining - paid }
}

export function expireRiskContract(contract: RiskContract, worldDay: number): boolean {
  if (contract.status === 'active' && worldDay >= contract.startDay + contract.durationDays) {
    contract.status = 'expired'
    return true
  }
  return false
}

// ============================================================
// WEEKLY SERVICES TICK
// ============================================================

export interface ServicesTickResult {
  completedContracts: string[]
  progressedContracts: string[]
  expiredRiskContracts: string[]
  providerRevenue: { providerId: string; revenue: number }[]
}

/**
 * Weekly services tick:
 * 1. Progress active contracts (consume slots)
 * 2. Expire risk contracts
 * 3. Calculate provider revenue
 */
export function weeklyServicesTick(
  worldDay: number,
  contracts: ServiceContract[],
  riskContracts: RiskContract[],
  providers: ServiceProvider[],
): ServicesTickResult {
  const result: ServicesTickResult = {
    completedContracts: [],
    progressedContracts: [],
    expiredRiskContracts: [],
    providerRevenue: [],
  }

  // Progress active service contracts
  for (const contract of contracts) {
    if (contract.status !== 'active') continue
    const slotsBefore = contract.slotsConsumed
    progressServiceContract(contract, 1) // 1 slot per week for routine
    if (contract.slotsConsumed > slotsBefore) {
      if ((contract.status as ContractStatus) === 'completed') {
        result.completedContracts.push(contract.id)
      } else {
        result.progressedContracts.push(contract.id)
      }
    }
  }

  // Expire risk contracts
  for (const rc of riskContracts) {
    if (expireRiskContract(rc, worldDay)) {
      result.expiredRiskContracts.push(rc.id)
    }
  }

  // Calculate provider revenue (from completed contracts this tick)
  for (const provider of providers) {
    const completedThisTick = contracts.filter(
      c => c.providerId === provider.id && result.completedContracts.includes(c.id)
    )
    const revenue = completedThisTick.reduce((sum, c) => sum + (c.finalCostGp || c.baseQuoteGp), 0)
    if (revenue > 0) {
      provider.capitalGp += revenue
      result.providerRevenue.push({ providerId: provider.id, revenue })
    }
  }

  return result
}
