/**
 * INTERACTIONS — Player intent → engine resolution
 * ===================================================
 *
 * The missing layer between the world simulation and the player. Each
 * `PlayerIntent` is something a character chooses to do: examine a
 * deposit, extract from it, study what they pulled out.
 *
 * The resolver functions below:
 *   - read κ at the character's .tp node
 *   - check eligibility (tier gate, tool gate, distance is caller's job for v1)
 *   - run the right primitive (rollQuality, mastery study)
 *   - mutate state (deposit reserves drop, mastery level rises)
 *   - emit WorldTPBAction[] entries for the caller to persist
 *   - return a typed `InteractionResult` the surface renders
 *
 * Persistence rule (per feedback_observation_writes.md):
 *   ticks accumulate, OBSERVATIONS write. Every interaction is an
 *   observation — that's why each resolver appends an `observe` action
 *   plus whatever side-effect actions follow (writeKappa for reserves).
 *
 * v1 scope: examine_deposit, extract, study_material.
 * v2+ will add transform/craft/sell/inspect_item/identify.
 */

import { z } from 'zod'
import {
  rollQuality,
  type Deposit,
  type Commodity,
  type QualityLevel,
} from './production-chain'
import {
  slaughter as slaughterFn,
  totalHead,
  type Herd,
  type Species,
} from './husbandry'
import { CROP_DATA, type FarmPlot, type CropType } from './agriculture'
import { type SettlementMarket } from './market'
import {
  MaterialMasteryStore,
  depositVisibilityFor,
  maskedResourceName,
  type DepositVisibility,
  type KnowledgeLevel,
} from './material-mastery'
import {
  type Tier,
  TIER_MULTIPLIERS,
  compareTier,
} from './tier'
import type { TP } from './tp'
import type { WorldTPBAction } from './tpb-world'
import {
  ClaimRegistry,
  createClaim,
  ClaimTargetTypeSchema,
  type ClaimTargetType,
  type Claim,
} from './claims'

// ============================================================
// PLAYER INTENT — discriminated union
// ============================================================

export const ExamineDepositIntentSchema = z.object({
  type: z.literal('examine_deposit'),
  characterId: z.string(),
  depositId: z.string(),
})

export const ExtractIntentSchema = z.object({
  type: z.literal('extract'),
  characterId: z.string(),
  depositId: z.string(),
  /** Tool item id used (presence/power validated by caller). */
  toolItemId: z.string().optional(),
  /** Skill bonus contributed by tool (e.g. +5 for an iron pickaxe). */
  toolBonus: z.number().int().nonnegative().default(0),
  /** Days to spend extracting; each day rolls quality independently. */
  days: z.number().int().min(1).max(30).default(1),
})

export const StudyMaterialIntentSchema = z.object({
  type: z.literal('study_material'),
  characterId: z.string(),
  resourceId: z.string(),
})

export const TendHerdIntentSchema = z.object({
  type: z.literal('tend_herd'),
  characterId: z.string(),
  /** Herd entity id — `herd:<hubId>:<speciesId>` */
  herdId: z.string(),
  /** Settlement node hosting the herd */
  nodeId: z.string(),
  /** Days spent tending (boosts health more, refreshes feed) */
  days: z.number().int().min(1).max(30).default(1),
})

export const SlaughterIntentSchema = z.object({
  type: z.literal('slaughter'),
  characterId: z.string(),
  herdId: z.string(),
  nodeId: z.string(),
  /** Number of head to slaughter (capped at adults+elders). */
  count: z.number().int().min(1).max(1000),
})

export const SellItemIntentSchema = z.object({
  type: z.literal('sell_item'),
  characterId: z.string(),
  /** Settlement node where the market is. */
  nodeId: z.string(),
  /** Commodity / resource id being sold. */
  resourceId: z.string(),
  /** Number of units to sell. */
  quantity: z.number().int().positive(),
})

export const PlantCropsIntentSchema = z.object({
  type: z.literal('plant_crops'),
  characterId: z.string(),
  /** Farm plot id */
  plotId: z.string(),
  nodeId: z.string(),
  /** Crops to plant; total acres must fit the plot. */
  crops: z.array(z.object({
    type: z.string(),       // CropType — validated at runtime against CROP_DATA
    acresPlanted: z.number().positive(),
  })).min(1),
  /** Season to set on the plot (drives which crops can mature). */
  season: z.enum(['spring', 'summer', 'fall', 'winter']),
})

export const ClaimPlotIntentSchema = z.object({
  type: z.literal('claim_plot'),
  characterId: z.string(),
  /** What kind of thing is being claimed. */
  targetType: ClaimTargetTypeSchema,
  /** ID of the deposit / farm_plot / building / edge_segment. */
  targetId: z.string(),
  /** The .tp node where the target sits. */
  nodeId: z.string(),
  /** Source of right — 'self', faction id, 'crown', etc. Default 'self'. */
  legitimacy: z.string().default('self'),
  /** Days of inactivity before the claim auto-lapses. */
  lapseAfterDays: z.number().int().nonnegative().optional(),
  /** Free-form note (deed reference, witnesses, etc). */
  note: z.string().optional(),
})

export const PlayerIntentSchema = z.discriminatedUnion('type', [
  ExamineDepositIntentSchema,
  ExtractIntentSchema,
  StudyMaterialIntentSchema,
  ClaimPlotIntentSchema,
  TendHerdIntentSchema,
  SlaughterIntentSchema,
  PlantCropsIntentSchema,
  SellItemIntentSchema,
])
export type PlayerIntent = z.infer<typeof PlayerIntentSchema>

// ============================================================
// RESULT TYPES
// ============================================================

export interface GeneratedItem {
  resourceId: string
  resourceName: string
  quantity: number
  quality: QualityLevel
  tier: Tier
  /** d20 that produced this stack (per day in extraction). */
  rolledOn: number
}

export interface ObservedDeposit {
  id: string
  /** Null when the character's mastery hasn't revealed the name yet. */
  name: string | null
  type: string | null
  resource: string | null
  quality: string | null
  tier: Tier | null
  reserves: number | null
  /** When false, only `id` and the reading "Unknown deposit" fields are set. */
  fullyVisible: boolean
}

export interface MasteryChange {
  resourceId: string
  before: KnowledgeLevel
  after: KnowledgeLevel
  reason: 'study' | 'examination' | 'use'
}

export interface InteractionResult {
  ok: boolean
  /** Human-readable failure reason when !ok. */
  reason?: string
  intent: PlayerIntent
  worldDay: number
  daysSpent: number
  narrative: string

  // Variant-specific outputs (any/all may be undefined):
  observed?: ObservedDeposit
  visibility?: DepositVisibility
  itemsGenerated?: GeneratedItem[]
  masteryChanges?: MasteryChange[]

  /** TPB entries the caller should append to the world tpb. */
  tpbEntries: WorldTPBAction[]
}

// ============================================================
// RESOLVER 1 — examine_deposit
// ============================================================

export interface ExamineDepositArgs {
  intent: z.infer<typeof ExamineDepositIntentSchema>
  deposit: Deposit
  /** Resource catalog (production-chain.COMMODITIES) */
  resource: Commodity
  /** Character's .tp node — should match deposit.nodeId */
  characterNodeId: string
  /** Wisdom or Investigation modifier — caller picks which is appropriate */
  perceptionModifier: number
  worldDay: number
  tp: TP
  masteryStore: MaterialMasteryStore
  d20: number
}

/**
 * Examine a deposit. The character's existing mastery on the deposit's
 * primary commodity gates how much they see. A successful perception
 * check (d20 + mod ≥ 10 + tier index) bumps mastery by one level —
 * "I learned something just by looking carefully."
 */
export function resolveExamineDeposit(args: ExamineDepositArgs): InteractionResult {
  const { intent, deposit, resource, characterNodeId, perceptionModifier,
          worldDay, tp, masteryStore, d20 } = args

  // Eligibility: deposit's nodeId must match where the character is.
  if (deposit.nodeId !== characterNodeId) {
    return failResult(intent, worldDay,
      `Cannot examine ${deposit.id} — character is at ${characterNodeId}, not ${deposit.nodeId}.`)
  }

  // Knowledge level for this resource determines visible fields.
  const knowledge = masteryStore.get(intent.characterId, resource.id)
  const visibility = depositVisibilityFor(knowledge.knowledgeLevel)

  // Perception check — DC scales with deposit tier
  const tierIndex = ['F','E','D','C','B','A','S','SS','SSS','EX'].indexOf(deposit.tier)
  const dc = 10 + tierIndex
  const total = d20 + perceptionModifier
  const examineSucceeded = total >= dc

  // On success, bump mastery by one (capped at 3). Even level-0 characters
  // can learn the resource's name by careful observation.
  const masteryChanges: MasteryChange[] = []
  if (examineSucceeded && knowledge.knowledgeLevel < 3) {
    const before = knowledge.knowledgeLevel
    const after = masteryStore.study(intent.characterId, resource.id, worldDay)
    masteryChanges.push({ resourceId: resource.id, before, after, reason: 'examination' })
  }

  // Visibility *after* the bump (if any), so a successful examine
  // immediately benefits.
  const finalLevel = masteryStore.get(intent.characterId, resource.id).knowledgeLevel
  const finalVisibility = depositVisibilityFor(finalLevel)
  const observed = projectDeposit(deposit, resource, finalVisibility, finalLevel)

  const narrative = buildExamineNarrative(deposit, resource, observed, examineSucceeded, finalLevel, total, dc)

  const tpbEntries: WorldTPBAction[] = [{
    type: 'observe',
    nodeId: deposit.nodeId,
    partyId: intent.characterId,
  }]

  return {
    ok: true,
    intent,
    worldDay,
    daysSpent: 0,
    narrative,
    observed,
    visibility: finalVisibility,
    masteryChanges: masteryChanges.length > 0 ? masteryChanges : undefined,
    tpbEntries,
  }
}

// ============================================================
// RESOLVER 2 — extract
// ============================================================

export interface ExtractArgs {
  intent: z.infer<typeof ExtractIntentSchema>
  deposit: Deposit                  // mutated in-place: remainingReserves drops
  resource: Commodity
  characterNodeId: string
  /** Mining/survival/whatever skill modifier for the d20 quality roll. */
  skillModifier: number
  worldDay: number
  tp: TP
  masteryStore: MaterialMasteryStore
  /** One d20 per day of extraction. Caller pulls from MFPool. */
  d20PerDay: number[]
}

/**
 * Extract from a deposit. Each day:
 *   - rollQuality(skill, toolBonus, difficulty, d20) → QualityLevel
 *   - amount = baseOutputPerDay × qualityMult × tierMult × qualityFactor
 *   - reserves drop by amount
 *   - if reserves hit 0, deposit becomes 'depleted'
 * Mastery slowly drifts up from repeated use (one chance per extract day).
 */
export function resolveExtract(args: ExtractArgs): InteractionResult {
  const { intent, deposit, resource, characterNodeId, skillModifier,
          worldDay, masteryStore, d20PerDay } = args

  if (deposit.nodeId !== characterNodeId) {
    return failResult(intent, worldDay,
      `Cannot extract from ${deposit.id} — character is not at ${deposit.nodeId}.`)
  }

  const days = Math.min(intent.days, d20PerDay.length)
  if (days <= 0) {
    return failResult(intent, worldDay,
      `Need at least one d20 to extract.`)
  }

  // Tier gate: a tier-S deposit refuses an F-tier character outright.
  // (Tools/skill could compensate; for v1 just gate on character party tier
  // = inferred 'F' if not set; caller passes tools+skill for finer gate.)

  const tierIndex = ['F','E','D','C','B','A','S','SS','SSS','EX'].indexOf(deposit.tier)
  const dc = 8 + tierIndex * 2  // F=8, E=10, D=12, ...
  const tierMult = TIER_MULTIPLIERS[deposit.tier]

  const items: GeneratedItem[] = []
  const tpbEntries: WorldTPBAction[] = [{
    type: 'observe',
    nodeId: deposit.nodeId,
    partyId: intent.characterId,
  }]

  let totalQuantity = 0
  let reservesBefore = deposit.remainingReserves ?? Infinity
  let reservesAfter = reservesBefore

  // rollQuality always returns a quality level (no "failed" state); a
  // critical-1 forces 'poor' which yields a fraction of base output.
  const qualityFactor: Record<QualityLevel, number> = {
    poor:       0.3,
    common:     1.0,
    good:       1.2,
    excellent:  1.5,
    masterwork: 2.0,
  }

  for (let d = 0; d < days; d++) {
    if (reservesAfter <= 0) break
    const d20 = d20PerDay[d]
    const quality = rollQuality(skillModifier, intent.toolBonus, dc, d20)
    const factor = qualityFactor[quality]
    const dailyAmount = Math.floor(deposit.baseOutputPerDay * tierMult * factor)
    const actual = Math.min(dailyAmount, reservesAfter)
    if (actual > 0) {
      items.push({
        resourceId: resource.id,
        resourceName: resource.name,
        quantity: actual,
        quality,
        tier: deposit.tier,
        rolledOn: d20,
      })
      totalQuantity += actual
      reservesAfter -= actual
    }
  }

  // Mutate the deposit object (caller persists/re-syncs).
  deposit.remainingReserves = reservesAfter
  if (Number.isFinite(reservesAfter) && reservesAfter <= 0) {
    deposit.quality = 'depleted'
  }

  // Write the reserve change as a κ TPB entry. The reserve number itself
  // lives on the Deposit object; the TPB row records that this character
  // observed and consumed reserves.
  if (Number.isFinite(reservesBefore) && reservesAfter !== reservesBefore) {
    tpbEntries.push({
      type: 'writeKappa',
      nodeId: deposit.nodeId,
      domain: 'deposit',
      paths: [`remainingReserves:${deposit.id}`],
      system: 'interactions:extract',
    })
  }

  // Mastery drift: one in five extract days bumps mastery (capped at 3).
  const masteryChanges: MasteryChange[] = []
  const knowledge = masteryStore.get(intent.characterId, resource.id)
  if (knowledge.knowledgeLevel < 3) {
    const driftRoll = (d20PerDay[0] + days) % 5
    if (driftRoll === 0) {
      const before = knowledge.knowledgeLevel
      const after = masteryStore.study(intent.characterId, resource.id, worldDay)
      masteryChanges.push({ resourceId: resource.id, before, after, reason: 'use' })
    }
  }

  const narrative = buildExtractNarrative(
    deposit, resource, items, totalQuantity, days, reservesBefore, reservesAfter,
  )

  return {
    ok: true,
    intent,
    worldDay: worldDay + days,  // wall-clock advanced by days spent
    daysSpent: days,
    narrative,
    itemsGenerated: items,
    masteryChanges: masteryChanges.length > 0 ? masteryChanges : undefined,
    tpbEntries,
  }
}

// ============================================================
// RESOLVER 3 — study_material
// ============================================================

export interface StudyMaterialArgs {
  intent: z.infer<typeof StudyMaterialIntentSchema>
  resource: Commodity
  worldDay: number
  masteryStore: MaterialMasteryStore
}

/**
 * Study a material the character holds (or recently extracted). Bumps
 * mastery by exactly one level (capped at 3). Cost: one in-engine day
 * (caller advances the clock).
 */
export function resolveStudyMaterial(args: StudyMaterialArgs): InteractionResult {
  const { intent, resource, worldDay, masteryStore } = args

  const before = masteryStore.get(intent.characterId, resource.id).knowledgeLevel
  const after = masteryStore.study(intent.characterId, resource.id, worldDay)

  const masteryChanges: MasteryChange[] = before === after
    ? []
    : [{ resourceId: resource.id, before, after, reason: 'study' }]

  const narrative = before === after
    ? `${resource.name}: already at maximum knowledge.`
    : `Studied ${resource.name} (knowledge ${before} → ${after}).` +
      (after === 1 ? ` You now recognize the substance.` :
       after === 2 ? ` Its base properties are clear.` :
                     ` Its hidden affixes reveal themselves.`)

  return {
    ok: true,
    intent,
    worldDay: worldDay + 1,
    daysSpent: 1,
    narrative,
    masteryChanges: masteryChanges.length > 0 ? masteryChanges : undefined,
    // study is a personal act — no world-level observation entry needed.
    tpbEntries: [],
  }
}

// ============================================================
// RESOLVER 4 — claim_plot
// ============================================================

export interface ClaimPlotArgs {
  intent: z.infer<typeof ClaimPlotIntentSchema>
  /** Character must be at the same node as the target to file a claim. */
  characterNodeId: string
  worldDay: number
  registry: ClaimRegistry
  /** Default lapse window (days) when intent doesn't specify. */
  defaultLapseAfterDays?: number
}

export interface ClaimPlotResult extends InteractionResult {
  /** The newly-registered claim. */
  claim?: Claim
  /** If filing on a contested target, the existing claims now also contested. */
  contestedExisting?: Claim[]
}

/**
 * File a claim on a plot. Slow-life trope: walk into an unclaimed forest,
 * declare ownership, the engine quietly registers it. The narrative is the
 * only public surface — the registry table is "secret" until the player
 * discovers it via UI exploration or another player's claim collides.
 */
export function resolveClaimPlot(args: ClaimPlotArgs): ClaimPlotResult {
  const { intent, characterNodeId, worldDay, registry, defaultLapseAfterDays } = args

  // Eligibility: must be physically at the target's node.
  if (intent.nodeId !== characterNodeId) {
    return failResult(intent, worldDay,
      `Cannot file claim — character is at ${characterNodeId}, target is at ${intent.nodeId}.`)
  }

  // Build the claim. Pending status; registry will promote to active or
  // flip to contested if there's already an active competitor.
  const draft = createClaim({
    claimantId: intent.characterId,
    targetType: intent.targetType as ClaimTargetType,
    targetId: intent.targetId,
    nodeId: intent.nodeId,
    claimedDay: worldDay,
    lapseAfterDays: intent.lapseAfterDays ?? defaultLapseAfterDays,
    legitimacy: intent.legitimacy,
    note: intent.note,
  })

  const { claim, contestedExisting } = registry.register(draft)

  const tpbEntries: WorldTPBAction[] = [{
    type: 'observe',
    nodeId: intent.nodeId,
    partyId: intent.characterId,
  }]

  let narrative: string
  if (claim.status === 'contested') {
    narrative =
      `Filed claim on ${intent.targetType}:${intent.targetId} — but it's already claimed. ` +
      `Both claims now contested (vs ${contestedExisting.map(c => c.claimantId).join(', ')}).`
  } else {
    narrative =
      `Claimed ${intent.targetType}:${intent.targetId}. ` +
      `Status: active${claim.lapseAfterDays ? `, lapses after ${claim.lapseAfterDays} days unattended` : ''}.`
  }

  return {
    ok: true,
    intent,
    worldDay,
    daysSpent: 0,
    narrative,
    tpbEntries,
    claim,
    contestedExisting: contestedExisting.length > 0 ? contestedExisting : undefined,
  }
}

// ============================================================
// RESOLVER 5 — tend_herd
// ============================================================

export interface TendHerdArgs {
  intent: z.infer<typeof TendHerdIntentSchema>
  herd: Herd
  species: Species
  characterNodeId: string
  worldDay: number
  /** Optional — if set, refreshes the character's claim on this herd. */
  registry?: ClaimRegistry
}

/**
 * Tend a herd: feed, water, check health. Resets daysSinceLastFeed,
 * raises health by ~10/day (capped 100). If the character holds an
 * active claim on the herd via the registry, also refreshes the
 * claim's lastTendedDay (rescues a lapsed claim).
 */
export function resolveTendHerd(args: TendHerdArgs): InteractionResult {
  const { intent, herd, species, characterNodeId, worldDay, registry } = args

  if (herd.hubId !== characterNodeId) {
    return failResult(intent, worldDay,
      `Cannot tend herd at ${herd.hubId} — character is at ${characterNodeId}.`)
  }
  if (totalHead(herd) === 0) {
    return failResult(intent, worldDay,
      `Herd at ${herd.hubId} has no animals to tend.`)
  }

  // Reset feed clock + raise health
  herd.daysSinceLastFeed = 0
  const beforeHealth = herd.health
  herd.health = Math.min(100, herd.health + intent.days * 10)
  const healthGain = herd.health - beforeHealth

  // Refresh claim tend day if registry + claim exist
  if (registry) {
    const claims = registry.findOnTarget('herd', intent.herdId)
    const mine = claims.find(c => c.claimantId === intent.characterId
      && (c.status === 'active' || c.status === 'lapsed'))
    if (mine) registry.tend(mine.id, worldDay + intent.days)
  }

  const tpbEntries: WorldTPBAction[] = [{
    type: 'observe',
    nodeId: herd.hubId,
    partyId: intent.characterId,
  }]

  const narrative =
    `Tended ${species.name} at ${herd.hubId} for ${intent.days} day${intent.days > 1 ? 's' : ''}: ` +
    `health ${beforeHealth} → ${herd.health}` +
    (healthGain > 0 ? ` (+${healthGain})` : '') +
    `, well-fed.`

  return {
    ok: true,
    intent,
    worldDay: worldDay + intent.days,
    daysSpent: intent.days,
    narrative,
    tpbEntries,
  }
}

// ============================================================
// RESOLVER 6 — slaughter
// ============================================================

export interface SlaughterArgs {
  intent: z.infer<typeof SlaughterIntentSchema>
  herd: Herd
  species: Species
  characterNodeId: string
  worldDay: number
}

/**
 * Slaughter N head from the herd. Returns meat / hide / tallow as
 * GeneratedItem[]. The herd object is mutated (head counts drop).
 */
export function resolveSlaughter(args: SlaughterArgs): InteractionResult {
  const { intent, herd, species, characterNodeId, worldDay } = args

  if (herd.hubId !== characterNodeId) {
    return failResult(intent, worldDay,
      `Cannot slaughter at ${herd.hubId} — character is at ${characterNodeId}.`)
  }
  const available = herd.adults + herd.elders
  if (available <= 0) {
    return failResult(intent, worldDay,
      `No mature animals to slaughter (only ${herd.young} young).`)
  }

  const requested = Math.min(intent.count, available)
  const result = slaughterFn(herd, species, requested)

  const items: GeneratedItem[] = []
  if (result.meatLbs > 0) {
    items.push({
      resourceId: 'meat',
      resourceName: 'Fresh Meat',
      quantity: Math.floor(result.meatLbs),
      quality: 'common',
      tier: 'F',
      rolledOn: 0,
    })
  }
  if (result.hideLbs > 0) {
    items.push({
      resourceId: 'leather',
      resourceName: 'Hide',
      quantity: Math.floor(result.hideLbs),
      quality: 'common',
      tier: 'F',
      rolledOn: 0,
    })
  }
  if (result.tallowLbs > 0) {
    items.push({
      resourceId: 'tallow',
      resourceName: 'Tallow',
      quantity: Math.floor(result.tallowLbs),
      quality: 'common',
      tier: 'F',
      rolledOn: 0,
    })
  }

  // Slaughter takes ~1 day per 5 head, min 1 day.
  const daysSpent = Math.max(1, Math.ceil(requested / 5))

  const tpbEntries: WorldTPBAction[] = [{
    type: 'observe',
    nodeId: herd.hubId,
    partyId: intent.characterId,
  }]

  const narrative =
    `Slaughtered ${requested} ${species.name} (${daysSpent} day${daysSpent > 1 ? 's' : ''}): ` +
    `${result.meatLbs.toFixed(0)} lb meat, ${result.hideLbs.toFixed(0)} lb hide, ${result.tallowLbs.toFixed(0)} lb tallow. ` +
    `Herd: ${totalHead(herd)} remaining.`

  return {
    ok: true,
    intent,
    worldDay: worldDay + daysSpent,
    daysSpent,
    narrative,
    itemsGenerated: items,
    tpbEntries,
  }
}

// ============================================================
// RESOLVER 7 — plant_crops
// ============================================================

export interface PlantCropsArgs {
  intent: z.infer<typeof PlantCropsIntentSchema>
  plot: FarmPlot
  characterNodeId: string
  worldDay: number
}

/**
 * Plant crops on a fallow plot. Sets crops, season, planted=true,
 * resets growthDays. Fails if the plot is already planted (must
 * harvest first) or if the requested acres don't fit.
 */
export function resolvePlantCrops(args: PlantCropsArgs): InteractionResult {
  const { intent, plot, characterNodeId, worldDay } = args

  if (plot.nodeId !== characterNodeId) {
    return failResult(intent, worldDay,
      `Cannot plant ${plot.id} — character is at ${characterNodeId}, plot is at ${plot.nodeId}.`)
  }
  if (plot.planted) {
    return failResult(intent, worldDay,
      `Plot ${plot.id} is already planted — wait for harvest before re-planting.`)
  }

  // Validate crop types exist in CROP_DATA
  for (const c of intent.crops) {
    if (!(c.type in CROP_DATA)) {
      return failResult(intent, worldDay,
        `Unknown crop type: ${c.type}.`)
    }
  }

  // Validate acres fit the plot
  const PLOT_ACRES_LOOKUP: Record<string, number> = {
    garden: 0.5, small_plot: 5, field: 40, large_estate: 200,
  }
  const totalAcres = intent.crops.reduce((s, c) => s + c.acresPlanted, 0)
  const capacity = PLOT_ACRES_LOOKUP[plot.plotSize] ?? 0
  if (totalAcres > capacity) {
    return failResult(intent, worldDay,
      `Requested ${totalAcres} acres exceeds plot capacity ${capacity}.`)
  }

  // Plant. Mutate the plot in place.
  plot.crops = intent.crops.map(c => ({
    type: c.type as CropType,
    acresPlanted: c.acresPlanted,
  }))
  plot.season = intent.season
  plot.growthDays = 0
  plot.planted = true

  const cropDescription = plot.crops
    .map(c => `${c.acresPlanted}ac ${c.type}`)
    .join(', ')

  const tpbEntries: WorldTPBAction[] = [{
    type: 'observe',
    nodeId: plot.nodeId,
    partyId: intent.characterId,
  }]

  return {
    ok: true,
    intent,
    worldDay,
    daysSpent: 0,        // planting is fast; the wait is the growing
    narrative: `Planted ${plot.id} (${plot.season}): ${cropDescription}.`,
    tpbEntries,
  }
}

// ============================================================
// RESOLVER 8 — sell_item
// ============================================================

export interface SellItemArgs {
  intent: z.infer<typeof SellItemIntentSchema>
  market: SettlementMarket
  characterNodeId: string
  worldDay: number
}

export interface SellItemResult extends InteractionResult {
  /** Gold earned (after market tax). */
  goldEarned?: number
  /** Tax paid to the settlement. */
  taxPaid?: number
  /** Effective per-unit price the seller received. */
  unitPrice?: number
}

/**
 * Sell a stack of items at a settlement market. Looks up the current
 * price (set by the most recent mm-market resolve), computes
 * gold = quantity × price × (1 - taxRate), and adds the items into
 * market supply. Caller is responsible for removing the items from the
 * character's inventory (interaction layer doesn't own inventory yet).
 *
 * If the commodity isn't tracked in the market's price table, the sale
 * fails — there's no buyer for what doesn't exist on the books.
 */
export function resolveSellItem(args: SellItemArgs): SellItemResult {
  const { intent, market, characterNodeId, worldDay } = args

  if (market.hubId !== characterNodeId) {
    return failResult(intent, worldDay,
      `Cannot sell at ${market.hubId} — character is at ${characterNodeId}.`)
  }
  const priceData = market.prices[intent.resourceId]
  if (!priceData || !priceData.available) {
    return failResult(intent, worldDay,
      `${intent.resourceId} has no buyer at ${market.hubId}.`)
  }

  const grossGold = intent.quantity * priceData.currentPrice
  const taxPaid = grossGold * market.taxRate
  const goldEarned = grossGold - taxPaid

  // Items go into market supply (circulation). Future ticks will
  // re-price based on the new supply level.
  priceData.supply += intent.quantity

  const tpbEntries: WorldTPBAction[] = [{
    type: 'observe',
    nodeId: market.hubId,
    partyId: intent.characterId,
  }]

  const narrative =
    `Sold ${intent.quantity}× ${intent.resourceId} at ${priceData.currentPrice.toFixed(2)} gp/u — ` +
    `${goldEarned.toFixed(2)} gp earned (tax ${taxPaid.toFixed(2)} gp).`

  return {
    ok: true,
    intent,
    worldDay,
    daysSpent: 0,
    narrative,
    goldEarned,
    taxPaid,
    unitPrice: priceData.currentPrice,
    tpbEntries,
  }
}

// ============================================================
// AVAILABILITY — what intents are valid here
// ============================================================

export interface AvailabilityContext {
  characterId: string
  characterNodeId: string
  /** Tools in inventory — for v1 we just check non-empty for extract. */
  hasMiningTool: boolean
  /** The deposit (if any) the character is examining */
  deposit?: Deposit
  /** Resource ids the character holds in inventory (or recently extracted) */
  heldResourceIds?: string[]
  /** Optional claim registry — enables `claim_plot` when target is unclaimed. */
  claimRegistry?: ClaimRegistry
  /** Optional claimable targets nearby (any of these may be claimed). */
  claimableTargets?: Array<{ targetType: ClaimTargetType; targetId: string }>
}

export function getAvailableInteractions(ctx: AvailabilityContext): PlayerIntent['type'][] {
  const types: PlayerIntent['type'][] = []
  if (ctx.deposit && ctx.deposit.nodeId === ctx.characterNodeId) {
    types.push('examine_deposit')
    if (ctx.hasMiningTool) types.push('extract')
  }
  if ((ctx.heldResourceIds?.length ?? 0) > 0) {
    types.push('study_material')
  }
  // Claim availability: any nearby target without an active owner.
  if (ctx.claimRegistry && ctx.claimableTargets && ctx.claimableTargets.length > 0) {
    const anyClaimable = ctx.claimableTargets.some(t =>
      ctx.claimRegistry!.getActiveOwner(t.targetType, t.targetId) === undefined,
    )
    if (anyClaimable) types.push('claim_plot')
  }
  return types
}

// ============================================================
// HELPERS
// ============================================================

function failResult(intent: PlayerIntent, worldDay: number, reason: string): InteractionResult {
  return {
    ok: false,
    reason,
    intent,
    worldDay,
    daysSpent: 0,
    narrative: reason,
    tpbEntries: [],
  }
}

function projectDeposit(
  deposit: Deposit,
  resource: Commodity,
  vis: DepositVisibility,
  level: KnowledgeLevel,
): ObservedDeposit {
  const fullyVisible = level >= 3
  return {
    id: deposit.id,
    name:      vis.nameVisible ? deposit.name : null,
    type:      vis.resourceVisible ? deposit.depositType : null,
    resource:  vis.resourceVisible ? maskedResourceName(resource.id, resource.name, level) : null,
    quality:   vis.qualityVisible ? deposit.quality : null,
    tier:      vis.tierVisible ? deposit.tier : null,
    reserves:  vis.reservesVisible ? (deposit.remainingReserves ?? null) : null,
    fullyVisible,
  }
}

function buildExamineNarrative(
  deposit: Deposit,
  resource: Commodity,
  observed: ObservedDeposit,
  succeeded: boolean,
  level: KnowledgeLevel,
  total: number,
  dc: number,
): string {
  if (level === 0 && !succeeded) {
    return `You see ground that might hold something. (Examine ${total} vs DC ${dc} — failed.)`
  }
  if (level === 0 && succeeded) {
    return `You make out an unfamiliar substance. (Examine ${total} vs DC ${dc} — passed; learned the substance is ${resource.name}.)`
  }
  const parts: string[] = [observed.name ?? deposit.id]
  if (observed.type) parts.push(`(${observed.type})`)
  if (observed.resource) parts.push(`yields ${observed.resource}`)
  if (observed.quality) parts.push(`quality: ${observed.quality}`)
  if (observed.tier) parts.push(`tier ${observed.tier}`)
  if (observed.reserves !== null) parts.push(`reserves ${observed.reserves}`)
  return `${parts.join(' · ')}. (Examine ${total} vs DC ${dc} — ${succeeded ? 'passed' : 'failed but you already knew most of this'}.)`
}

function buildExtractNarrative(
  deposit: Deposit,
  resource: Commodity,
  items: GeneratedItem[],
  total: number,
  days: number,
  reservesBefore: number,
  reservesAfter: number,
): string {
  if (items.length === 0) {
    return `${days} day${days > 1 ? 's' : ''} at ${deposit.name}: no usable yield.`
  }
  const breakdown = items
    .map(i => `${i.quantity}× ${i.resourceName} (${i.quality})`)
    .join(', ')
  const reserveNote = Number.isFinite(reservesBefore)
    ? ` Reserves ${reservesBefore} → ${reservesAfter}.`
    : ''
  return `${days} day${days > 1 ? 's' : ''} at ${deposit.name}: ${total} units total — ${breakdown}.${reserveNote}`
}
