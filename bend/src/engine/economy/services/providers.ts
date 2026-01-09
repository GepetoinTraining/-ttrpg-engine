import { query, queryOne, queryAll } from '../../../db/client';
import { writeDelta } from '../../timeline/deltas';
import { MERCHANT_TIER_REQUIREMENTS, type MerchantTier } from '../../markets/schema';
import {
  type ServiceProvider,
  type ServiceType,
  type ProviderType,
  type OperatingHours,
  ServiceProviderSchema,
  PROVIDER_SERVICE_CATALOG,
  SERVICE_TIER_GATES,
  TIER_CONTRACT_LIMITS,
  FAME_THRESHOLDS,
} from './types';

// ============================================
// SERVICE PROVIDER MANAGEMENT
// ============================================
//
// Providers are entities (NPCs or Factions) that offer services.
// Their capabilities emerge from tier, not hard flags.
//
// NPC ambitions become structurally motivated:
// - Reputation/capital -> tier -> capabilities
//

// ============================================
// PROVIDER CREATION
// ============================================

export interface CreateProviderInput {
  hubId: string;
  npcId?: string;
  factionId?: string;
  providerType: ProviderType;
  merchantTier: MerchantTier;
  initialCapital: number;
  licenses?: string[];
  operatingHours?: OperatingHours;
}

/**
 * Register a new service provider.
 */
export async function createProvider(input: CreateProviderInput): Promise<ServiceProvider> {
  if (!input.npcId && !input.factionId) {
    throw new Error('Provider must have either npcId or factionId');
  }
  if (input.npcId && input.factionId) {
    throw new Error('Provider cannot have both npcId and factionId');
  }

  // Validate tier requirements
  const tierReqs = MERCHANT_TIER_REQUIREMENTS[input.merchantTier];
  if (input.initialCapital < tierReqs.minCapital) {
    throw new Error(
      `Insufficient capital for ${input.merchantTier} tier: need ${tierReqs.minCapital}gp, have ${input.initialCapital}gp`,
    );
  }

  const now = new Date().toISOString();
  const providerId = crypto.randomUUID();

  // Determine offered services based on type and tier
  const catalogServices = PROVIDER_SERVICE_CATALOG[input.providerType];
  const offeredServices = catalogServices.filter(serviceType => {
    const requiredTier = SERVICE_TIER_GATES[serviceType];
    return canOfferService(input.merchantTier, requiredTier);
  });

  const provider: ServiceProvider = {
    id: providerId,
    hubId: input.hubId,
    npcId: input.npcId,
    factionId: input.factionId,
    providerType: input.providerType,
    merchantTier: input.merchantTier,
    fameScore: 0,
    capitalGp: input.initialCapital,
    licenses: input.licenses ?? [],
    offeredServices,
    operatingHours: input.operatingHours ?? {
      openSlot: 16,
      closeSlot: 36,
      daysActive: [0, 1, 2, 3, 4, 5],
    },
    status: 'active',
    createdAt: now,
    updatedAt: now,
    version: 1,
  };

  // Validate
  ServiceProviderSchema.parse(provider);

  await query(
    `INSERT INTO service_providers (
      id, hub_id, npc_id, faction_id,
      provider_type, merchant_tier, fame_score, capital_gp,
      licenses, offered_services, operating_hours, status,
      created_at, updated_at, version
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      provider.id,
      provider.hubId,
      provider.npcId ?? null,
      provider.factionId ?? null,
      provider.providerType,
      provider.merchantTier,
      provider.fameScore,
      provider.capitalGp,
      JSON.stringify(provider.licenses),
      JSON.stringify(provider.offeredServices),
      JSON.stringify(provider.operatingHours),
      provider.status,
      provider.createdAt,
      provider.updatedAt,
      provider.version,
    ],
  );

  await writeDelta({
    campaignId: input.hubId, // Hub-scoped for now
    entityType: 'service_provider',
    entityId: providerId,
    operation: 'create',
    delta: { provider },
    actorType: 'system',
    timestamp: now,
  });

  return provider;
}

// ============================================
// PROVIDER QUERIES
// ============================================

/**
 * Get a provider by ID.
 */
export async function getProvider(providerId: string): Promise<ServiceProvider | null> {
  const row = await queryOne<ProviderRow>(
    `SELECT * FROM service_providers WHERE id = ?`,
    [providerId],
  );

  if (!row) return null;
  return rowToProvider(row);
}

/**
 * Get provider by NPC ID.
 */
export async function getProviderByNpc(npcId: string): Promise<ServiceProvider | null> {
  const row = await queryOne<ProviderRow>(
    `SELECT * FROM service_providers WHERE npc_id = ?`,
    [npcId],
  );

  if (!row) return null;
  return rowToProvider(row);
}

/**
 * Get providers in a hub.
 */
export async function getProvidersInHub(hubId: string): Promise<ServiceProvider[]> {
  const rows = await queryAll<ProviderRow>(
    `SELECT * FROM service_providers WHERE hub_id = ? AND status = 'active'`,
    [hubId],
  );

  return rows.map(rowToProvider);
}

/**
 * Find providers offering a specific service in a hub.
 */
export async function findProvidersForService(
  hubId: string,
  serviceType: ServiceType,
): Promise<ServiceProvider[]> {
  // SQLite JSON querying is limited, so we filter in code
  const providers = await getProvidersInHub(hubId);
  return providers.filter(p => p.offeredServices.includes(serviceType));
}

/**
 * Find providers by type in a hub.
 */
export async function findProvidersByType(
  hubId: string,
  providerType: ProviderType,
): Promise<ServiceProvider[]> {
  const rows = await queryAll<ProviderRow>(
    `SELECT * FROM service_providers
     WHERE hub_id = ? AND provider_type = ? AND status = 'active'`,
    [hubId, providerType],
  );

  return rows.map(rowToProvider);
}

// ============================================
// PROVIDER UPDATES
// ============================================

/**
 * Update provider capital after a transaction.
 */
export async function updateProviderCapital(
  providerId: string,
  deltaGp: number,
  reason: string,
): Promise<ServiceProvider> {
  const provider = await getProvider(providerId);
  if (!provider) {
    throw new Error(`Provider not found: ${providerId}`);
  }

  const newCapital = provider.capitalGp + deltaGp;
  if (newCapital < 0) {
    throw new Error(`Would result in negative capital: ${newCapital}`);
  }

  const now = new Date().toISOString();

  await query(
    `UPDATE service_providers
     SET capital_gp = ?, updated_at = ?, version = version + 1
     WHERE id = ?`,
    [newCapital, now, providerId],
  );

  await writeDelta({
    campaignId: provider.hubId,
    entityType: 'service_provider',
    entityId: providerId,
    operation: 'update',
    delta: { capitalGp: newCapital, deltaGp, reason },
    actorType: 'system',
    timestamp: now,
  });

  return {
    ...provider,
    capitalGp: newCapital,
    updatedAt: now,
    version: provider.version + 1,
  };
}

/**
 * Update provider fame score.
 */
export async function updateProviderFame(
  providerId: string,
  deltaFame: number,
  reason: string,
): Promise<ServiceProvider> {
  const provider = await getProvider(providerId);
  if (!provider) {
    throw new Error(`Provider not found: ${providerId}`);
  }

  const newFame = Math.max(0, Math.min(100, provider.fameScore + deltaFame));
  const now = new Date().toISOString();

  await query(
    `UPDATE service_providers
     SET fame_score = ?, updated_at = ?, version = version + 1
     WHERE id = ?`,
    [newFame, now, providerId],
  );

  await writeDelta({
    campaignId: provider.hubId,
    entityType: 'service_provider',
    entityId: providerId,
    operation: 'update',
    delta: { fameScore: newFame, deltaFame, reason },
    actorType: 'system',
    timestamp: now,
  });

  return {
    ...provider,
    fameScore: newFame,
    updatedAt: now,
    version: provider.version + 1,
  };
}

/**
 * Upgrade provider tier.
 * Must meet tier requirements.
 */
export async function upgradeProviderTier(
  providerId: string,
): Promise<{ success: boolean; provider?: ServiceProvider; reason?: string }> {
  const provider = await getProvider(providerId);
  if (!provider) {
    return { success: false, reason: `Provider not found: ${providerId}` };
  }

  const tierOrder: MerchantTier[] = [
    'peddler', 'stall', 'shop', 'emporium', 'trading_house', 'consortium', 'megamart',
  ];
  const currentIndex = tierOrder.indexOf(provider.merchantTier);

  if (currentIndex >= tierOrder.length - 1) {
    return { success: false, reason: 'Already at maximum tier' };
  }

  const nextTier = tierOrder[currentIndex + 1];
  const requirements = MERCHANT_TIER_REQUIREMENTS[nextTier];

  // Check requirements
  if (provider.capitalGp < requirements.minCapital) {
    return {
      success: false,
      reason: `Insufficient capital: need ${requirements.minCapital}gp, have ${provider.capitalGp}gp`,
    };
  }

  if (provider.fameScore < requirements.minReputation) {
    return {
      success: false,
      reason: `Insufficient fame: need ${requirements.minReputation}, have ${provider.fameScore}`,
    };
  }

  // Check licenses
  const missingLicenses = requirements.licenses.filter(l => !provider.licenses.includes(l));
  if (missingLicenses.length > 0) {
    return {
      success: false,
      reason: `Missing licenses: ${missingLicenses.join(', ')}`,
    };
  }

  // Upgrade
  const now = new Date().toISOString();

  // Recalculate offered services for new tier
  const catalogServices = PROVIDER_SERVICE_CATALOG[provider.providerType];
  const offeredServices = catalogServices.filter(serviceType => {
    const requiredTier = SERVICE_TIER_GATES[serviceType];
    return canOfferService(nextTier, requiredTier);
  });

  await query(
    `UPDATE service_providers
     SET merchant_tier = ?, offered_services = ?, updated_at = ?, version = version + 1
     WHERE id = ?`,
    [nextTier, JSON.stringify(offeredServices), now, providerId],
  );

  await writeDelta({
    campaignId: provider.hubId,
    entityType: 'service_provider',
    entityId: providerId,
    operation: 'update',
    delta: { merchantTier: nextTier, previousTier: provider.merchantTier, offeredServices },
    actorType: 'system',
    timestamp: now,
  });

  return {
    success: true,
    provider: {
      ...provider,
      merchantTier: nextTier,
      offeredServices,
      updatedAt: now,
      version: provider.version + 1,
    },
  };
}

/**
 * Suspend a provider (temporary closure).
 */
export async function suspendProvider(
  providerId: string,
  reason: string,
): Promise<ServiceProvider> {
  const provider = await getProvider(providerId);
  if (!provider) {
    throw new Error(`Provider not found: ${providerId}`);
  }

  const now = new Date().toISOString();

  await query(
    `UPDATE service_providers SET status = 'suspended', updated_at = ?, version = version + 1 WHERE id = ?`,
    [now, providerId],
  );

  await writeDelta({
    campaignId: provider.hubId,
    entityType: 'service_provider',
    entityId: providerId,
    operation: 'update',
    delta: { status: 'suspended', reason },
    actorType: 'system',
    timestamp: now,
  });

  return {
    ...provider,
    status: 'suspended',
    updatedAt: now,
    version: provider.version + 1,
  };
}

/**
 * Reactivate a suspended provider.
 */
export async function reactivateProvider(providerId: string): Promise<ServiceProvider> {
  const provider = await getProvider(providerId);
  if (!provider) {
    throw new Error(`Provider not found: ${providerId}`);
  }

  if (provider.status !== 'suspended') {
    throw new Error(`Provider is not suspended: ${provider.status}`);
  }

  const now = new Date().toISOString();

  await query(
    `UPDATE service_providers SET status = 'active', updated_at = ?, version = version + 1 WHERE id = ?`,
    [now, providerId],
  );

  await writeDelta({
    campaignId: provider.hubId,
    entityType: 'service_provider',
    entityId: providerId,
    operation: 'update',
    delta: { status: 'active' },
    actorType: 'system',
    timestamp: now,
  });

  return {
    ...provider,
    status: 'active',
    updatedAt: now,
    version: provider.version + 1,
  };
}

// ============================================
// CAPABILITY CHECKS
// ============================================

/**
 * Check if a tier can offer a service requiring another tier.
 */
function canOfferService(providerTier: MerchantTier, requiredTier: MerchantTier): boolean {
  const tierOrder: MerchantTier[] = [
    'peddler', 'stall', 'shop', 'emporium', 'trading_house', 'consortium', 'megamart',
  ];
  return tierOrder.indexOf(providerTier) >= tierOrder.indexOf(requiredTier);
}

/**
 * Get maximum contract value for a provider.
 */
export function getProviderContractLimit(provider: ServiceProvider): number {
  return provider.capitalGp * TIER_CONTRACT_LIMITS[provider.merchantTier];
}

/**
 * Check if provider can handle a contract of given value.
 */
export function canHandleContract(provider: ServiceProvider, contractValue: number): boolean {
  return contractValue <= getProviderContractLimit(provider);
}

/**
 * Get provider's fame tier description.
 */
export function getProviderFameTier(
  fameScore: number,
): 'unknown' | 'trusted' | 'reputable' | 'renowned' | 'legendary' {
  if (fameScore >= FAME_THRESHOLDS.legendary) return 'legendary';
  if (fameScore >= FAME_THRESHOLDS.renowned) return 'renowned';
  if (fameScore >= FAME_THRESHOLDS.reputable) return 'reputable';
  if (fameScore >= FAME_THRESHOLDS.trusted) return 'trusted';
  return 'unknown';
}

/**
 * Calculate fame gain from completing a contract.
 * Fame gain scales with contract value and success.
 */
export function calculateFameGain(
  contractValue: number,
  providerTier: MerchantTier,
  success: boolean,
  exceptional: boolean = false,
): number {
  if (!success) {
    // Failure costs fame
    return -Math.min(5, Math.ceil(contractValue / 1000));
  }

  // Base gain from contract value relative to tier expectations
  const tierExpectedValue: Record<MerchantTier, number> = {
    peddler: 10,
    stall: 50,
    shop: 200,
    emporium: 1000,
    trading_house: 5000,
    consortium: 25000,
    megamart: 100000,
  };

  const expected = tierExpectedValue[providerTier];
  const ratio = contractValue / expected;

  let gain = Math.min(3, Math.ceil(ratio));
  if (exceptional) gain += 2;

  return gain;
}

// ============================================
// PROVIDER RANKINGS
// ============================================

/**
 * Get top providers in a hub by fame.
 */
export async function getTopProviders(
  hubId: string,
  limit: number = 10,
): Promise<ServiceProvider[]> {
  const rows = await queryAll<ProviderRow>(
    `SELECT * FROM service_providers
     WHERE hub_id = ? AND status = 'active'
     ORDER BY fame_score DESC
     LIMIT ?`,
    [hubId, limit],
  );

  return rows.map(rowToProvider);
}

/**
 * Get providers that could upgrade (meet requirements).
 */
export async function findUpgradeReadyProviders(hubId: string): Promise<ServiceProvider[]> {
  const providers = await getProvidersInHub(hubId);

  return providers.filter(provider => {
    const tierOrder: MerchantTier[] = [
      'peddler', 'stall', 'shop', 'emporium', 'trading_house', 'consortium', 'megamart',
    ];
    const currentIndex = tierOrder.indexOf(provider.merchantTier);

    if (currentIndex >= tierOrder.length - 1) return false;

    const nextTier = tierOrder[currentIndex + 1];
    const requirements = MERCHANT_TIER_REQUIREMENTS[nextTier];

    return (
      provider.capitalGp >= requirements.minCapital &&
      provider.fameScore >= requirements.minReputation &&
      requirements.licenses.every(l => provider.licenses.includes(l))
    );
  });
}

// ============================================
// ROW TYPES AND CONVERTERS
// ============================================

interface ProviderRow {
  id: string;
  hub_id: string;
  npc_id: string | null;
  faction_id: string | null;
  provider_type: string;
  merchant_tier: string;
  fame_score: number;
  capital_gp: number;
  licenses: string;
  offered_services: string;
  operating_hours: string;
  status: string;
  created_at: string;
  updated_at: string;
  version: number;
}

function rowToProvider(row: ProviderRow): ServiceProvider {
  return ServiceProviderSchema.parse({
    id: row.id,
    hubId: row.hub_id,
    npcId: row.npc_id ?? undefined,
    factionId: row.faction_id ?? undefined,
    providerType: row.provider_type,
    merchantTier: row.merchant_tier,
    fameScore: row.fame_score,
    capitalGp: row.capital_gp,
    licenses: JSON.parse(row.licenses),
    offeredServices: JSON.parse(row.offered_services),
    operatingHours: JSON.parse(row.operating_hours),
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    version: row.version,
  });
}
