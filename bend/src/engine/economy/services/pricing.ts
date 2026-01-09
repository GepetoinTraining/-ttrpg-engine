import type { WorldTimestamp } from '../../timeline/substrate';
import type { MerchantTier } from '../../markets/schema';
import {
  type ServiceType,
  type ServiceProvider,
  type ServiceScope,
  type Urgency,
  type ServiceQuote,
  URGENCY_MULTIPLIERS,
  SERVICE_TIER_GATES,
  TIER_CONTRACT_LIMITS,
  FAME_THRESHOLDS,
} from './types';

// ============================================
// DETERMINISTIC SERVICE PRICING
// ============================================
//
// All pricing is:
// - Pure function of inputs (no hidden state)
// - Deterministic (same inputs = same outputs)
// - Derived from observable quantities
//
// Price = BaseCost * TierMod * FameMod * UrgencyMod * RiskMod * HubMod * ScopeMod
//
// No random elements. All variation comes from observable world state.
//

// ============================================
// BASE COSTS BY SERVICE TYPE
// ============================================

/**
 * Base cost in GP for 1 unit of service (1 slot, 1 route, 1 item, etc.)
 * These are the "stall-tier, routine urgency, average risk" baseline.
 */
export const SERVICE_BASE_COSTS: Record<ServiceType, number> = {
  // Banking
  banking_custody: 5,        // Per week per 100gp stored
  loan: 0.05,                // 5% of principal (APR equivalent per period)
  escrow: 10,                // Flat fee per transaction
  guarantee: 0.02,           // 2% of guaranteed amount
  insurance: 0.03,           // 3% of coverage limit (premium)

  // PMC
  pmc_escort: 25,            // Per day per guard
  pmc_retainer: 100,         // Per week on-call
  pmc_security: 50,          // Per day per location
  pmc_enforcement: 200,      // Per action

  // Legal
  legal_representation: 50,  // Per day of proceedings
  legal_arbitration: 100,    // Per dispute
  legal_notary: 5,           // Per document
  legal_investigation: 75,   // Per day of investigation

  // Logistics
  logistics_coordination: 20, // Per route managed
  logistics_storage: 2,       // Per week per 100 units
  logistics_transport: 0.1,   // Per unit per mile

  // Artisan
  artisan_craft: 0.25,       // 25% of item base value
  artisan_repair: 0.1,       // 10% of item base value
  artisan_enchant: 0.5,      // 50% of enchantment value

  // Discretion
  discretion_service: 50,     // Per service instance
  information_brokering: 100, // Per piece of information
  anonymity_service: 200,     // Per identity action
};

// ============================================
// TIER MODIFIERS
// ============================================

/**
 * Higher tier = higher quality = higher price.
 * But higher tier also means more capacity and trust.
 */
export const TIER_PRICE_MODIFIERS: Record<MerchantTier, number> = {
  peddler: 0.6,       // Cheaper but risky
  stall: 0.8,         // Budget option
  shop: 1.0,          // Standard pricing
  emporium: 1.3,      // Premium
  trading_house: 1.6, // Professional
  consortium: 2.0,    // Elite
  megamart: 1.5,      // Volume discount on premium
};

// ============================================
// FAME MODIFIERS
// ============================================

/**
 * Fame affects pricing two ways:
 * - Demand premium (famous = more expensive)
 * - Trust discount (famous = lower risk premium)
 *
 * Net effect depends on service type.
 */
export function calculateFameModifier(
  fameScore: number,
  serviceType: ServiceType,
): { demandPremium: number; trustDiscount: number; netModifier: number } {
  // Demand premium: famous providers charge more
  let demandPremium = 1.0;
  if (fameScore >= FAME_THRESHOLDS.legendary) {
    demandPremium = 1.5;
  } else if (fameScore >= FAME_THRESHOLDS.renowned) {
    demandPremium = 1.3;
  } else if (fameScore >= FAME_THRESHOLDS.reputable) {
    demandPremium = 1.15;
  } else if (fameScore >= FAME_THRESHOLDS.trusted) {
    demandPremium = 1.05;
  }

  // Trust discount: famous = lower risk for high-trust services
  const trustServices: ServiceType[] = [
    'banking_custody',
    'loan',
    'escrow',
    'guarantee',
    'insurance',
    'discretion_service',
    'anonymity_service',
  ];

  let trustDiscount = 1.0;
  if (trustServices.includes(serviceType)) {
    if (fameScore >= FAME_THRESHOLDS.legendary) {
      trustDiscount = 0.85;
    } else if (fameScore >= FAME_THRESHOLDS.renowned) {
      trustDiscount = 0.9;
    } else if (fameScore >= FAME_THRESHOLDS.reputable) {
      trustDiscount = 0.95;
    }
  }

  return {
    demandPremium,
    trustDiscount,
    netModifier: demandPremium * trustDiscount,
  };
}

// ============================================
// RISK MODIFIERS
// ============================================

/**
 * Risk-adjusted pricing based on:
 * - Service type inherent risk
 * - Scope risk (larger = riskier)
 * - Route risk (if applicable)
 * - Client risk (reputation, history)
 */
export interface RiskFactors {
  serviceRisk: number;      // Inherent service risk
  scopeRisk: number;        // Risk from scope size
  routeRisk: number;        // Risk from routes involved
  clientRisk: number;       // Risk from client profile
}

export const SERVICE_INHERENT_RISK: Record<ServiceType, number> = {
  // Low risk services
  legal_notary: 1.0,
  logistics_storage: 1.0,
  artisan_repair: 1.0,

  // Medium risk
  banking_custody: 1.1,
  escrow: 1.1,
  legal_representation: 1.15,
  legal_arbitration: 1.15,
  legal_investigation: 1.2,
  logistics_coordination: 1.15,
  artisan_craft: 1.1,
  discretion_service: 1.2,

  // Higher risk
  loan: 1.3,
  pmc_escort: 1.25,
  pmc_retainer: 1.2,
  pmc_security: 1.25,
  logistics_transport: 1.2,
  information_brokering: 1.35,
  artisan_enchant: 1.25,

  // High risk
  guarantee: 1.4,
  insurance: 1.5,
  pmc_enforcement: 1.5,
  anonymity_service: 1.4,
};

export function calculateRiskPremium(
  serviceType: ServiceType,
  scope: ServiceScope,
  clientReputation: number, // 0-100
  routeDangerLevel: number, // 0-1, 0 = safe, 1 = very dangerous
): number {
  const inherent = SERVICE_INHERENT_RISK[serviceType];

  // Scope risk: more entities/hubs = more exposure
  const scopeSize =
    (scope.hubIds?.length ?? 0) +
    (scope.routeIds?.length ?? 0) +
    (scope.entityIds?.length ?? 0);
  const scopeRisk = 1.0 + Math.min(scopeSize * 0.05, 0.5); // Max 50% increase

  // Route risk (only for transport/escort)
  const routeServices: ServiceType[] = [
    'pmc_escort',
    'logistics_transport',
    'logistics_coordination',
  ];
  const routeRisk = routeServices.includes(serviceType)
    ? 1.0 + routeDangerLevel * 0.5
    : 1.0;

  // Client risk: low reputation = higher premium
  const clientRisk = clientReputation < 25
    ? 1.3
    : clientReputation < 50
      ? 1.15
      : clientReputation < 75
        ? 1.05
        : 1.0;

  return inherent * scopeRisk * routeRisk * clientRisk;
}

// ============================================
// HUB MODIFIERS
// ============================================

/**
 * Hub characteristics affect pricing:
 * - Wealthy hubs = higher prices
 * - High competition = lower prices
 * - Remote hubs = supply premium
 */
export interface HubPricingContext {
  wealthLevel: 'poor' | 'modest' | 'comfortable' | 'wealthy' | 'aristocratic';
  competitionLevel: 'monopoly' | 'limited' | 'moderate' | 'competitive' | 'saturated';
  remoteness: number; // 0-1, 0 = major hub, 1 = remote
}

const WEALTH_MODIFIERS: Record<HubPricingContext['wealthLevel'], number> = {
  poor: 0.7,
  modest: 0.85,
  comfortable: 1.0,
  wealthy: 1.25,
  aristocratic: 1.5,
};

const COMPETITION_MODIFIERS: Record<HubPricingContext['competitionLevel'], number> = {
  monopoly: 1.5,
  limited: 1.2,
  moderate: 1.0,
  competitive: 0.9,
  saturated: 0.8,
};

export function calculateHubModifier(context: HubPricingContext): number {
  const wealth = WEALTH_MODIFIERS[context.wealthLevel];
  const competition = COMPETITION_MODIFIERS[context.competitionLevel];
  const remoteness = 1.0 + context.remoteness * 0.3; // Up to 30% remote premium

  return wealth * competition * remoteness;
}

// ============================================
// SCOPE MULTIPLIERS
// ============================================

/**
 * Scope affects total price:
 * - More hubs/routes = more work
 * - More entities = more complexity
 * - Duration affects ongoing services
 */
export function calculateScopeMultiplier(
  serviceType: ServiceType,
  scope: ServiceScope,
  durationSlots: number,
): number {
  // Base multiplier from scope size
  const hubCount = scope.hubIds?.length ?? 0;
  const routeCount = scope.routeIds?.length ?? 0;
  const entityCount = scope.entityIds?.length ?? 0;

  // Different services scale differently
  let multiplier = 1.0;

  // Transport/logistics scale with routes
  if (['logistics_transport', 'logistics_coordination', 'pmc_escort'].includes(serviceType)) {
    multiplier *= 1.0 + routeCount * 0.8;
  }

  // Security scales with locations
  if (['pmc_security', 'logistics_storage'].includes(serviceType)) {
    multiplier *= 1.0 + hubCount * 0.5;
  }

  // Entity-targeted services scale with entities
  if (['discretion_service', 'legal_investigation', 'information_brokering'].includes(serviceType)) {
    multiplier *= 1.0 + entityCount * 0.4;
  }

  // Duration-based services (per slot pricing)
  const perSlotServices: ServiceType[] = [
    'banking_custody',
    'pmc_retainer',
    'pmc_security',
    'logistics_storage',
    'legal_representation',
  ];

  if (perSlotServices.includes(serviceType)) {
    // Convert slots to weeks for weekly-priced services
    const weeks = Math.ceil(durationSlots / 336); // 48 slots/day * 7 days
    multiplier *= Math.max(1, weeks);
  }

  return multiplier;
}

// ============================================
// TIME SLOT ESTIMATION
// ============================================

/**
 * Estimate NPC time slots needed for service execution.
 * This is CRITICAL: services consume NPC time.
 */
export const SERVICE_BASE_SLOTS: Record<ServiceType, number> = {
  // Quick services (1-2 slots)
  legal_notary: 1,
  artisan_repair: 2,

  // Standard services (4-8 slots)
  banking_custody: 4,
  escrow: 4,
  logistics_storage: 4,
  discretion_service: 6,

  // Extended services (1-2 days)
  loan: 8,
  legal_representation: 48,
  legal_arbitration: 24,
  legal_investigation: 48,
  logistics_coordination: 8,
  artisan_craft: 24,
  information_brokering: 16,

  // Variable (depends heavily on scope)
  guarantee: 4,
  insurance: 4,
  pmc_escort: 48,      // Per day
  pmc_retainer: 336,   // Per week
  pmc_security: 48,    // Per day
  pmc_enforcement: 24,
  logistics_transport: 48,
  artisan_enchant: 48,
  anonymity_service: 16,
};

export function estimateTimeSlots(
  serviceType: ServiceType,
  scope: ServiceScope,
  urgency: Urgency,
): number {
  const base = SERVICE_BASE_SLOTS[serviceType];

  // Scope increases time
  const scopeSize =
    (scope.hubIds?.length ?? 0) +
    (scope.routeIds?.length ?? 0) * 2 +
    (scope.entityIds?.length ?? 0);

  const scopeMultiplier = 1.0 + Math.min(scopeSize * 0.2, 2.0);

  // Urgency reduces time (but costs more)
  const urgencyMultiplier = urgency === 'emergency'
    ? 0.5
    : urgency === 'priority'
      ? 0.75
      : 1.0;

  return Math.ceil(base * scopeMultiplier * urgencyMultiplier);
}

// ============================================
// MAIN PRICING FUNCTION
// ============================================

/**
 * Calculate service quote - THE CORE PRICING FUNCTION.
 *
 * This is a pure function: same inputs = same outputs.
 * All state is passed in, nothing read from global.
 *
 * @param provider - The service provider offering the service
 * @param serviceType - What service is being quoted
 * @param scope - What the service covers
 * @param urgency - How fast the client needs it
 * @param clientReputation - Client's reputation (0-100)
 * @param hubContext - Hub pricing context
 * @param routeDanger - Route danger level (0-1) for transport services
 * @param durationSlots - For ongoing services, how long
 * @param quantity - For quantity-based services (items, GP amounts, etc.)
 * @param currentTime - Current world timestamp for quote validity
 */
export function calculateServiceQuote(input: {
  provider: ServiceProvider;
  serviceType: ServiceType;
  scope: ServiceScope;
  urgency: Urgency;
  clientReputation: number;
  hubContext: HubPricingContext;
  routeDanger: number;
  durationSlots: number;
  quantity: number;
  currentTime: WorldTimestamp;
}): ServiceQuote {
  const {
    provider,
    serviceType,
    scope,
    urgency,
    clientReputation,
    hubContext,
    routeDanger,
    durationSlots,
    quantity,
    currentTime,
  } = input;

  // 1. Base cost
  const baseCost = SERVICE_BASE_COSTS[serviceType] * quantity;

  // 2. Tier premium
  const tierPremium = TIER_PRICE_MODIFIERS[provider.merchantTier];

  // 3. Fame modifier
  const fameModifiers = calculateFameModifier(provider.fameScore, serviceType);
  const famePremium = fameModifiers.netModifier;

  // 4. Urgency multiplier
  const urgencyMultiplier = URGENCY_MULTIPLIERS[urgency];

  // 5. Risk premium
  const riskPremium = calculateRiskPremium(serviceType, scope, clientReputation, routeDanger);

  // 6. Hub modifier
  const hubModifier = calculateHubModifier(hubContext);

  // 7. Scope multiplier
  const scopeMultiplier = calculateScopeMultiplier(serviceType, scope, durationSlots);

  // Calculate total
  const totalQuoteGp = Math.round(
    baseCost *
    tierPremium *
    famePremium *
    urgencyMultiplier *
    riskPremium *
    hubModifier *
    scopeMultiplier *
    100
  ) / 100; // Round to 2 decimal places

  // Estimate time slots
  const estimatedSlots = estimateTimeSlots(serviceType, scope, urgency);

  // Quote valid for 48 slots (1 day)
  const validUntil: WorldTimestamp = {
    day: currentTime.day,
    slot: currentTime.slot + 48,
    turn: currentTime.turn + 14400, // 1 day worth of turns
  };

  return {
    providerId: provider.id,
    serviceType,
    baseCostGp: baseCost,
    tierPremium,
    famePremium,
    urgencyMultiplier,
    riskPremium,
    hubModifier,
    scopeMultiplier,
    totalQuoteGp,
    estimatedSlots,
    validUntil: JSON.stringify(validUntil),
    quotedAt: JSON.stringify(currentTime),
  };
}

// ============================================
// CAPABILITY CHECKS
// ============================================

/**
 * Check if provider can offer a service at given scale.
 * Returns null if allowed, or error reason if not.
 */
export function checkProviderCapability(
  provider: ServiceProvider,
  serviceType: ServiceType,
  contractValueGp: number,
): string | null {
  // Check tier gate
  const requiredTier = SERVICE_TIER_GATES[serviceType];
  const tierOrder: MerchantTier[] = [
    'peddler', 'stall', 'shop', 'emporium', 'trading_house', 'consortium', 'megamart'
  ];
  const providerTierIndex = tierOrder.indexOf(provider.merchantTier);
  const requiredTierIndex = tierOrder.indexOf(requiredTier);

  if (providerTierIndex < requiredTierIndex) {
    return `Service ${serviceType} requires ${requiredTier} tier (provider is ${provider.merchantTier})`;
  }

  // Check if service is offered
  if (!provider.offeredServices.includes(serviceType)) {
    return `Provider does not offer ${serviceType}`;
  }

  // Check capital limits
  const maxContract = provider.capitalGp * TIER_CONTRACT_LIMITS[provider.merchantTier];
  if (contractValueGp > maxContract) {
    return `Contract value ${contractValueGp}gp exceeds provider limit ${maxContract}gp`;
  }

  // Check provider status
  if (provider.status !== 'active') {
    return `Provider is ${provider.status}`;
  }

  return null; // Capable
}

// ============================================
// INSURANCE/GUARANTEE PRICING
// ============================================

/**
 * Calculate insurance premium for a risk contract.
 * Premium = Coverage * BaseRate * RiskFactors
 */
export function calculateInsurancePremium(input: {
  coverageLimit: number;
  coveredEventTypes: string[];
  durationSlots: number;
  clientReputation: number;
  providerFame: number;
  hasCollateral: boolean;
  collateralValue: number;
}): { premiumGp: number; breakdown: Record<string, number> } {
  const {
    coverageLimit,
    coveredEventTypes,
    durationSlots,
    clientReputation,
    providerFame,
    hasCollateral,
    collateralValue,
  } = input;

  // Base rate (3% of coverage)
  const baseRate = 0.03;

  // Event type risk (more events = higher premium)
  const eventRisk = 1.0 + coveredEventTypes.length * 0.1;

  // Duration risk (longer = more exposure)
  const weeks = Math.max(1, Math.ceil(durationSlots / 336));
  const durationRisk = Math.sqrt(weeks); // Sublinear - not proportional

  // Client risk (low rep = higher premium)
  const clientRisk = clientReputation < 50 ? 1.3 : clientReputation < 75 ? 1.1 : 1.0;

  // Provider fame discount (famous = lower premium due to trust)
  const fameDiscount = providerFame >= 75 ? 0.9 : providerFame >= 50 ? 0.95 : 1.0;

  // Collateral discount
  const collateralDiscount = hasCollateral
    ? Math.max(0.7, 1.0 - (collateralValue / coverageLimit) * 0.3)
    : 1.0;

  const premiumGp = Math.round(
    coverageLimit *
    baseRate *
    eventRisk *
    durationRisk *
    clientRisk *
    fameDiscount *
    collateralDiscount *
    100
  ) / 100;

  return {
    premiumGp,
    breakdown: {
      baseRate,
      eventRisk,
      durationRisk,
      clientRisk,
      fameDiscount,
      collateralDiscount,
    },
  };
}

/**
 * Calculate guarantee fee for backing another contract.
 * Fee = GuaranteedAmount * BaseRate * ObligorRisk * ContractRisk
 */
export function calculateGuaranteeFee(input: {
  guaranteeLimit: number;
  obligorReputation: number;
  contractType: string;
  durationSlots: number;
  hasCollateral: boolean;
  collateralValue: number;
}): { feeGp: number; breakdown: Record<string, number> } {
  const {
    guaranteeLimit,
    obligorReputation,
    contractType,
    durationSlots,
    hasCollateral,
    collateralValue,
  } = input;

  // Base rate (2% of guaranteed amount)
  const baseRate = 0.02;

  // Obligor risk (who we're backing)
  const obligorRisk = obligorReputation < 25
    ? 2.0
    : obligorReputation < 50
      ? 1.5
      : obligorReputation < 75
        ? 1.2
        : 1.0;

  // Contract type risk
  const contractRiskMap: Record<string, number> = {
    service_contract: 1.0,
    loan: 1.5,
    trade: 1.2,
    custom: 1.3,
  };
  const contractRisk = contractRiskMap[contractType] ?? 1.3;

  // Duration risk
  const weeks = Math.max(1, Math.ceil(durationSlots / 336));
  const durationRisk = 1.0 + Math.log10(weeks) * 0.2;

  // Collateral offset
  const collateralOffset = hasCollateral
    ? Math.max(0.5, 1.0 - (collateralValue / guaranteeLimit) * 0.5)
    : 1.0;

  const feeGp = Math.round(
    guaranteeLimit *
    baseRate *
    obligorRisk *
    contractRisk *
    durationRisk *
    collateralOffset *
    100
  ) / 100;

  return {
    feeGp,
    breakdown: {
      baseRate,
      obligorRisk,
      contractRisk,
      durationRisk,
      collateralOffset,
    },
  };
}

// ============================================
// GUARANTEE ELIGIBILITY (TIER GATE)
// ============================================

/**
 * Guarantee capability levels - no booleans.
 */
export type GuaranteeCapability = 'none' | 'local_limited' | 'institutional_limited' | 'systemic';

/**
 * Determine what level of guarantees a tier can issue.
 *
 * - peddler/stall/shop => cannot issue guarantees ('none')
 * - emporium => local-limited guarantees only (hub-bound, explicit collateral, low caps)
 * - trading_house => institutional-limited guarantees (regional, capped, explicit exclusions)
 * - consortium/megamart => systemic guarantees (full underwriting, stacking permitted)
 */
export function canIssueGuarantees(tier: MerchantTier): GuaranteeCapability {
  switch (tier) {
    case 'peddler':
    case 'stall':
    case 'shop':
      return 'none';
    case 'emporium':
      return 'local_limited';
    case 'trading_house':
      return 'institutional_limited';
    case 'consortium':
    case 'megamart':
      return 'systemic';
  }
}

/**
 * Guarantee limits by capability level.
 */
export const GUARANTEE_CAPABILITY_LIMITS: Record<GuaranteeCapability, {
  maxGuaranteeMultiple: number;  // Multiple of capital
  scopeLimit: 'none' | 'hub' | 'region' | 'unlimited';
  requiresCollateral: boolean;
  allowsStacking: boolean;
}> = {
  none: {
    maxGuaranteeMultiple: 0,
    scopeLimit: 'none',
    requiresCollateral: true,
    allowsStacking: false,
  },
  local_limited: {
    maxGuaranteeMultiple: 0.5,   // Max 50% of capital per guarantee
    scopeLimit: 'hub',
    requiresCollateral: true,    // Must have collateral
    allowsStacking: false,       // Cannot stack multiple guarantees
  },
  institutional_limited: {
    maxGuaranteeMultiple: 1.0,
    scopeLimit: 'region',
    requiresCollateral: false,   // Can underwrite without collateral
    allowsStacking: false,
  },
  systemic: {
    maxGuaranteeMultiple: 3.0,
    scopeLimit: 'unlimited',
    requiresCollateral: false,
    allowsStacking: true,        // Can stack multiple guarantees
  },
};

/**
 * Check if a provider can issue a specific guarantee.
 */
export function validateGuaranteeEligibility(
  provider: ServiceProvider,
  guaranteeAmount: number,
  scope: ServiceScope,
  hasCollateral: boolean,
): { eligible: boolean; reason?: string } {
  const capability = canIssueGuarantees(provider.merchantTier);
  const limits = GUARANTEE_CAPABILITY_LIMITS[capability];

  if (capability === 'none') {
    return { eligible: false, reason: `${provider.merchantTier} tier cannot issue guarantees` };
  }

  // Check amount limit
  const maxAmount = provider.capitalGp * limits.maxGuaranteeMultiple;
  if (guaranteeAmount > maxAmount) {
    return {
      eligible: false,
      reason: `Guarantee amount ${guaranteeAmount}gp exceeds limit ${maxAmount}gp for ${capability}`,
    };
  }

  // Check collateral requirement
  if (limits.requiresCollateral && !hasCollateral) {
    return { eligible: false, reason: `${capability} guarantees require collateral` };
  }

  // Check scope limit
  if (limits.scopeLimit === 'hub' && (scope.hubIds?.length ?? 0) > 1) {
    return { eligible: false, reason: `${capability} guarantees limited to single hub` };
  }

  if (limits.scopeLimit === 'region' && (scope.hubIds?.length ?? 0) > 5) {
    return { eligible: false, reason: `${capability} guarantees limited to regional scope (max 5 hubs)` };
  }

  return { eligible: true };
}

// ============================================
// IO COST (Scope + Risk + Discretion)
// ============================================

/**
 * Calculate IO cost component.
 * Derived from scope size, risk level, and discretion requirements.
 *
 * Pure function - deterministic.
 */
export function calculateIOCost(input: {
  scope: ServiceScope;
  coveredEventTypes: string[];
  routeDangerLevel: number;
  isIllegal: boolean;
  visibilitySupressed: boolean;
}): { ioCost: number; breakdown: { scopeCost: number; riskCost: number; discretionCost: number } } {
  const { scope, coveredEventTypes, routeDangerLevel, isIllegal, visibilitySupressed } = input;

  // Scope cost: entities touched, hubs/routes involved
  const entityCount = scope.entityIds?.length ?? 0;
  const hubCount = scope.hubIds?.length ?? 0;
  const routeCount = scope.routeIds?.length ?? 0;

  const scopeCost = Math.max(1,
    entityCount * 2 +
    hubCount * 5 +
    routeCount * 10
  );

  // Risk cost: based on covered event types and route danger
  const eventRisk = coveredEventTypes.length * 0.15;
  const routeRisk = routeDangerLevel * 0.5;
  const illegalityRisk = isIllegal ? 0.5 : 0;
  const riskCost = Math.max(1, 10 * (1 + eventRisk + routeRisk + illegalityRisk));

  // Discretion cost: visibility suppression is expensive
  const discretionCost = visibilitySupressed ? 25 : 0;

  const ioCost = Math.max(0, scopeCost + riskCost + discretionCost);

  return {
    ioCost,
    breakdown: { scopeCost, riskCost, discretionCost },
  };
}

// ============================================
// TIME SLOT COST
// ============================================

/**
 * Provider schedule scarcity context.
 */
export interface ScheduleScarcityContext {
  totalSlotsPerWeek: number;        // Total available slots
  bookedSlotsThisWeek: number;      // Already committed
  providerQueueDepth: number;       // Pending contracts
}

/**
 * Calculate time slot cost component.
 * Derived from schedule scarcity, duration, and urgency.
 *
 * Pure function - deterministic.
 */
export function calculateTimeSlotCost(input: {
  durationSlots: number;
  urgency: Urgency;
  scarcity: ScheduleScarcityContext;
  baseSlotsRate: number;  // Base GP per slot
}): { timeSlotCost: number; breakdown: { baseCost: number; scarcityPremium: number; urgencyPremium: number } } {
  const { durationSlots, urgency, scarcity, baseSlotsRate } = input;

  // Base cost from duration
  const baseCost = Math.max(1, durationSlots * baseSlotsRate);

  // Scarcity premium: busier providers charge more
  const utilizationRatio = scarcity.totalSlotsPerWeek > 0
    ? scarcity.bookedSlotsThisWeek / scarcity.totalSlotsPerWeek
    : 0;
  const queuePressure = Math.min(scarcity.providerQueueDepth * 0.1, 0.5);
  const scarcityMultiplier = 1.0 + utilizationRatio * 0.5 + queuePressure;
  const scarcityPremium = baseCost * (scarcityMultiplier - 1.0);

  // Urgency premium
  const urgencyMultiplier = URGENCY_MULTIPLIERS[urgency];
  const urgencyPremium = baseCost * (urgencyMultiplier - 1.0);

  const timeSlotCost = Math.max(0, baseCost + scarcityPremium + urgencyPremium);

  return {
    timeSlotCost,
    breakdown: { baseCost, scarcityPremium, urgencyPremium },
  };
}

// ============================================
// FAME MULTIPLIER (Monotonic)
// ============================================

/**
 * Calculate fame multiplier.
 * INVARIANT: >= 1 and monotonic in fame.
 *
 * Pure function - deterministic.
 */
export function calculateFameMultiplier(fameScore: number): number {
  // Clamp fame to 0-100
  const fame = Math.max(0, Math.min(100, fameScore));

  // Monotonic function: 1.0 at fame=0, up to 2.0 at fame=100
  // Using logarithmic growth for diminishing returns
  const multiplier = 1.0 + Math.log10(1 + fame * 0.9) / Math.log10(100);

  // Ensure >= 1.0
  return Math.max(1.0, multiplier);
}

// ============================================
// HUB ECONOMIC CEILING (No Hard Flags)
// ============================================

/**
 * Hub economic signals for deriving capability ceiling.
 */
export interface HubEconomicSignals {
  capitalConcentration: number;    // Total provider capital in hub
  enforcementStrength: number;     // 0-1, guards/pmc/law presence
  factionDensity: number;          // Number of active factions
  factionStability: number;        // 0-1, how stable faction relations are
  averageFameSurplus: number;      // Average provider fame above baseline
  populationWealth: number;        // Average wealth per capita
}

/**
 * Derive the maximum merchant tier a hub can support.
 * No hard flags - purely derived from economic signals.
 *
 * This enables asymmetry:
 * - Some hubs cap at emporium (opportunity for growth)
 * - Some support trading_house+ (economic dominance)
 */
export function deriveHubEconomicCeiling(signals: HubEconomicSignals): MerchantTier {
  // Score components
  const capitalScore = Math.min(100, signals.capitalConcentration / 10000);  // 1M gp = 100
  const enforcementScore = signals.enforcementStrength * 100;
  const stabilityScore = signals.factionStability * signals.factionDensity * 20;
  const fameScore = signals.averageFameSurplus;
  const wealthScore = Math.min(100, signals.populationWealth * 10);

  // Weighted total
  const totalScore =
    capitalScore * 0.3 +
    enforcementScore * 0.25 +
    stabilityScore * 0.2 +
    fameScore * 0.15 +
    wealthScore * 0.1;

  // Map score to tier ceiling
  if (totalScore >= 90) return 'megamart';
  if (totalScore >= 75) return 'consortium';
  if (totalScore >= 55) return 'trading_house';
  if (totalScore >= 35) return 'emporium';
  if (totalScore >= 20) return 'shop';
  if (totalScore >= 10) return 'stall';
  return 'peddler';
}

/**
 * Check if a provider tier is supported by hub ceiling.
 */
export function isTierSupportedByHub(
  providerTier: MerchantTier,
  hubCeiling: MerchantTier,
): boolean {
  const tierOrder: MerchantTier[] = [
    'peddler', 'stall', 'shop', 'emporium', 'trading_house', 'consortium', 'megamart',
  ];
  return tierOrder.indexOf(providerTier) <= tierOrder.indexOf(hubCeiling);
}

// ============================================
// COMPLETE QUOTE WITH ALL COMPONENTS
// ============================================

/**
 * Full service quote with all cost components.
 * Clamps all outputs to non-negative.
 */
export function calculateFullServiceQuote(input: {
  provider: ServiceProvider;
  serviceType: ServiceType;
  scope: ServiceScope;
  urgency: Urgency;
  clientReputation: number;
  hubContext: HubPricingContext;
  routeDanger: number;
  durationSlots: number;
  quantity: number;
  currentTime: WorldTimestamp;
  scheduleScarcity: ScheduleScarcityContext;
  isIllegal: boolean;
  visibilitySupressed: boolean;
  coveredEventTypes: string[];
}): {
  quote: ServiceQuote;
  ioCost: number;
  timeSlotCost: number;
  fameMultiplier: number;
  totalCost: number;
} {
  const baseQuote = calculateServiceQuote({
    provider: input.provider,
    serviceType: input.serviceType,
    scope: input.scope,
    urgency: input.urgency,
    clientReputation: input.clientReputation,
    hubContext: input.hubContext,
    routeDanger: input.routeDanger,
    durationSlots: input.durationSlots,
    quantity: input.quantity,
    currentTime: input.currentTime,
  });

  const ioResult = calculateIOCost({
    scope: input.scope,
    coveredEventTypes: input.coveredEventTypes,
    routeDangerLevel: input.routeDanger,
    isIllegal: input.isIllegal,
    visibilitySupressed: input.visibilitySupressed,
  });

  const timeResult = calculateTimeSlotCost({
    durationSlots: input.durationSlots,
    urgency: input.urgency,
    scarcity: input.scheduleScarcity,
    baseSlotsRate: 1.0,  // 1 GP per slot base
  });

  const fameMultiplier = calculateFameMultiplier(input.provider.fameScore);

  // Total cost with all components
  // Clamp to non-negative
  const totalCost = Math.max(0,
    (baseQuote.totalQuoteGp + ioResult.ioCost + timeResult.timeSlotCost) * fameMultiplier
  );

  return {
    quote: {
      ...baseQuote,
      totalQuoteGp: totalCost,
    },
    ioCost: ioResult.ioCost,
    timeSlotCost: timeResult.timeSlotCost,
    fameMultiplier,
    totalCost,
  };
}
