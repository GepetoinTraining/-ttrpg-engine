/**
 * HOMEBREW ITEM BUILDER
 * ======================
 *
 * AI-powered item generation system that:
 * 1. Takes natural language prompts from players/GMs
 * 2. Uses AI to generate balanced D&D 5e items
 * 3. Returns structured JSON conforming to ItemSchema
 *
 * Flow:
 * 1. User describes what they want: "A sword that shoots fire"
 * 2. AI generates a balanced item with proper stats
 * 3. System validates and returns the item
 * 4. GM can approve/modify before adding to game
 */

import { z } from 'zod'
import {
  ItemSchema,
  Item,
  ItemRaritySchema,
  ItemRarity,
  ItemCategorySchema,
  RARITY_DATA,
} from './schema'

// ============================================
// BUILDER REQUEST/RESPONSE TYPES
// ============================================

/**
 * What the user provides to generate an item
 */
export const HomebrewRequestSchema = z.object({
  // The user's description
  prompt: z.string().min(10).max(2000),

  // Optional constraints
  constraints: z.object({
    // Rarity limits
    maxRarity: ItemRaritySchema.optional(),
    minRarity: ItemRaritySchema.optional(),
    exactRarity: ItemRaritySchema.optional(),

    // Type constraints
    category: ItemCategorySchema.optional(),
    mustBeWeapon: z.boolean().optional(),
    mustBeArmor: z.boolean().optional(),
    mustBeWondrous: z.boolean().optional(),

    // Attunement
    requiresAttunement: z.boolean().optional(),
    attunementClass: z.string().optional(),

    // Value
    maxValue: z.number().optional(),
    minValue: z.number().optional(),

    // Theme/flavor
    theme: z.string().optional(),         // "fire", "ice", "stealth", "healing"
    setting: z.string().optional(),       // "forgotten realms", "eberron", "dark sun"
    tone: z.enum(['serious', 'whimsical', 'dark', 'heroic']).optional(),

    // Balance
    forLevel: z.number().int().min(1).max(20).optional(),
    powerLevel: z.enum(['weak', 'balanced', 'strong']).optional()
  }).optional(),

  // Context for better generation
  context: z.object({
    campaignSetting: z.string().optional(),
    characterClass: z.string().optional(),
    characterLevel: z.number().int().optional(),
    existingItems: z.array(z.string()).optional()  // Names of items they have
  }).optional()
})
export type HomebrewRequest = z.infer<typeof HomebrewRequestSchema>

/**
 * What the AI returns
 */
export const HomebrewResponseSchema = z.object({
  // The generated item
  item: ItemSchema,

  // AI's explanation
  reasoning: z.string(),                    // Why these choices were made
  balanceNotes: z.string().optional(),      // Potential balance concerns
  comparisonItems: z.array(z.string()).optional(),  // Similar official items

  // Flavor content
  flavorText: z.string().optional(),        // In-world description/lore
  historyHook: z.string().optional(),       // Plot hook involving the item
  quirks: z.array(z.string()).optional(),   // Minor personality/quirks

  // Alternatives
  alternatives: z.array(z.object({
    name: z.string(),
    rarity: ItemRaritySchema,
    briefDescription: z.string(),
    keyDifference: z.string()
  })).optional(),

  // Validation
  isBalanced: z.boolean(),
  balanceScore: z.number().min(0).max(100),  // 0 = broken weak, 50 = perfect, 100 = broken strong
  warnings: z.array(z.string()).default([])
})
export type HomebrewResponse = z.infer<typeof HomebrewResponseSchema>

// ============================================
// PROMPT TEMPLATES
// ============================================

/**
 * System prompt for the AI
 */
export const HOMEBREW_SYSTEM_PROMPT = `You are an expert D&D 5e game designer specializing in creating balanced magic items. Your role is to help players and GMs create custom items that:

1. Are mechanically balanced for their rarity tier
2. Follow D&D 5e design conventions
3. Have interesting and flavorful abilities
4. Don't overshadow existing official items

RARITY GUIDELINES:
- Common (50-100 gp): Minor conveniences, no combat bonuses
- Uncommon (101-500 gp): +1 weapons/armor, minor abilities, sometimes attunement
- Rare (501-5,000 gp): +2 weapons/armor, significant abilities, usually attunement
- Very Rare (5,001-50,000 gp): +3 weapons/armor, powerful abilities, almost always attunement
- Legendary (50,001+ gp): Campaign-defining items, always attunement
- Artifact: Unique world-shaping items with major drawbacks

BALANCE PRINCIPLES:
1. Compare to official items of the same rarity
2. Attunement is a cost - items requiring it can be slightly stronger
3. Limited uses (charges, 1/day) allow stronger effects
4. Drawbacks/curses allow stronger benefits
5. Concentration requirements on spell-like effects
6. Don't give unlimited casting of leveled spells
7. +X bonuses are reserved for weapons/armor/shields

OUTPUT FORMAT:
Always respond with valid JSON matching the HomebrewResponse schema. Include:
- Complete item stats
- Balance reasoning
- Comparison to official items
- Any warnings about potential issues
- 2-3 alternative versions at different power levels`

/**
 * Build the user prompt from request
 */
export function buildUserPrompt(request: HomebrewRequest): string {
  let prompt = `Create a D&D 5e magic item based on this description:\n\n"${request.prompt}"\n\n`

  if (request.constraints) {
    prompt += 'CONSTRAINTS:\n'

    if (request.constraints.exactRarity) {
      prompt += `- Must be ${request.constraints.exactRarity} rarity\n`
    } else {
      if (request.constraints.minRarity) {
        prompt += `- Minimum rarity: ${request.constraints.minRarity}\n`
      }
      if (request.constraints.maxRarity) {
        prompt += `- Maximum rarity: ${request.constraints.maxRarity}\n`
      }
    }

    if (request.constraints.category) {
      prompt += `- Category: ${request.constraints.category}\n`
    }
    if (request.constraints.mustBeWeapon) {
      prompt += '- Must be a weapon\n'
    }
    if (request.constraints.mustBeArmor) {
      prompt += '- Must be armor\n'
    }
    if (request.constraints.mustBeWondrous) {
      prompt += '- Must be a wondrous item\n'
    }

    if (request.constraints.requiresAttunement !== undefined) {
      prompt += `- ${request.constraints.requiresAttunement ? 'Must require' : 'Must NOT require'} attunement\n`
    }
    if (request.constraints.attunementClass) {
      prompt += `- Attunement by: ${request.constraints.attunementClass}\n`
    }

    if (request.constraints.maxValue) {
      prompt += `- Maximum value: ${request.constraints.maxValue} gp\n`
    }

    if (request.constraints.theme) {
      prompt += `- Theme/element: ${request.constraints.theme}\n`
    }
    if (request.constraints.tone) {
      prompt += `- Tone: ${request.constraints.tone}\n`
    }

    if (request.constraints.forLevel) {
      prompt += `- Appropriate for level ${request.constraints.forLevel} character\n`
    }
    if (request.constraints.powerLevel) {
      prompt += `- Power level: ${request.constraints.powerLevel}\n`
    }
  }

  if (request.context) {
    prompt += '\nCONTEXT:\n'

    if (request.context.campaignSetting) {
      prompt += `- Campaign setting: ${request.context.campaignSetting}\n`
    }
    if (request.context.characterClass) {
      prompt += `- For a ${request.context.characterClass}\n`
    }
    if (request.context.characterLevel) {
      prompt += `- Character level: ${request.context.characterLevel}\n`
    }
    if (request.context.existingItems?.length) {
      prompt += `- Character already has: ${request.context.existingItems.join(', ')}\n`
    }
  }

  prompt += '\nRespond with a complete HomebrewResponse JSON object.'

  return prompt
}

// ============================================
// VALIDATION & BALANCE CHECKING
// ============================================

/**
 * Validate that the generated item follows D&D conventions
 */
export function validateItem(item: Item): { valid: boolean; errors: string[] } {
  const errors: string[] = []

  // Check required fields
  if (!item.name) errors.push('Item must have a name')
  if (!item.category) errors.push('Item must have a category')

  // Check weapon/armor consistency
  if (item.category === 'weapon' && !item.weapon) {
    errors.push('Weapons must have weapon data')
  }
  if (item.category === 'armor' && !item.armor) {
    errors.push('Armor must have armor data')
  }

  // Check magical item requirements
  if (item.magical) {
    if (!item.rarity) {
      errors.push('Magical items must have a rarity')
    }
  }

  // Check attunement logic
  if (item.attunement?.required) {
    if (!item.magical) {
      errors.push('Non-magical items typically don\'t require attunement')
    }
  }

  // Check value vs rarity
  if (item.rarity && item.baseValue) {
    const rarityData = RARITY_DATA[item.rarity]
    if (item.baseValue < rarityData.minValue * 0.5) {
      errors.push(`Value ${item.baseValue} gp seems too low for ${item.rarity} rarity`)
    }
    if (rarityData.maxValue && item.baseValue > rarityData.maxValue * 2) {
      errors.push(`Value ${item.baseValue} gp seems too high for ${item.rarity} rarity`)
    }
  }

  // Check weapon bonuses
  if (item.weapon) {
    const bonus = item.weapon.bonusToHit
    if (bonus > 0 && !item.magical) {
      errors.push('Non-magical weapons cannot have to-hit bonuses')
    }
    if (bonus > 3) {
      errors.push('Weapons cannot have more than +3 bonus')
    }

    // Check rarity vs bonus
    if (item.rarity && bonus) {
      const expectedRarity: Record<number, ItemRarity[]> = {
        1: ['uncommon', 'rare'],
        2: ['rare', 'very_rare'],
        3: ['very_rare', 'legendary']
      }
      if (expectedRarity[bonus] && !expectedRarity[bonus].includes(item.rarity)) {
        errors.push(`+${bonus} weapons are typically ${expectedRarity[bonus].join(' or ')}, not ${item.rarity}`)
      }
    }
  }

  // Check armor bonuses
  if (item.armor) {
    const bonus = item.armor.bonusAC
    if (bonus > 0 && !item.magical) {
      errors.push('Non-magical armor cannot have AC bonuses')
    }
    if (bonus > 3) {
      errors.push('Armor cannot have more than +3 bonus')
    }
  }

  return { valid: errors.length === 0, errors }
}

/**
 * Calculate a balance score (0-100)
 * 50 = perfectly balanced, <50 = weak, >50 = strong
 */
export function calculateBalanceScore(item: Item): number {
  let score = 50 // Start balanced

  if (!item.rarity) return score

  RARITY_DATA[item.rarity]

  // Adjust for abilities
  const numAbilities = item.abilities?.length || 0
  if (numAbilities > 3) score += 5 * (numAbilities - 3)

  // Adjust for attunement (cost)
  if (item.attunement?.required) score -= 5

  // Adjust for charges
  if (item.charges) {
    if (item.charges.rechargeTime === 'never') score -= 10
    if (item.charges.destroyOnEmpty) score -= 5
  }

  // Adjust for curses
  if (item.cursed) score -= 10

  // Adjust for weapon bonuses
  if (item.weapon) {
    const bonus = item.weapon.bonusToHit + item.weapon.bonusDamage
    if (bonus > 0) score += bonus * 3
  }

  // Adjust for armor bonuses
  if (item.armor?.bonusAC) {
    score += item.armor.bonusAC * 5
  }

  // Clamp to 0-100
  return Math.max(0, Math.min(100, score))
}

// ============================================
// EXAMPLE ITEMS (for reference)
// ============================================

/**
 * Example items at each rarity for comparison
 */
export const REFERENCE_ITEMS: Record<ItemRarity, string[]> = {
  common: [
    'Cloak of Billowing',
    'Candle of the Deep',
    'Clothes of Mending',
    'Tankard of Sobriety'
  ],
  uncommon: [
    'Bag of Holding',
    'Boots of Elvenkind',
    'Cloak of Protection',
    '+1 Weapon',
    'Immovable Rod'
  ],
  rare: [
    'Cloak of Displacement',
    'Ring of Protection',
    '+2 Weapon',
    'Flame Tongue',
    'Wings of Flying'
  ],
  very_rare: [
    'Cloak of Invisibility',
    '+3 Weapon',
    'Staff of Power',
    'Sword of Sharpness',
    'Robe of Stars'
  ],
  legendary: [
    'Vorpal Sword',
    'Staff of the Magi',
    'Ring of Three Wishes',
    'Holy Avenger',
    'Luck Blade'
  ],
  artifact: [
    'Eye of Vecna',
    'Hand of Vecna',
    'Book of Exalted Deeds',
    'Deck of Many Things',
    'Orb of Dragonkind'
  ]
}

// ============================================
// AI INTEGRATION
// ============================================

/**
 * Generate a homebrew item using AI
 * This is the main entry point for item generation
 */
export async function generateHomebrewItem(
  request: HomebrewRequest,
  aiClient: {
    generate: (systemPrompt: string, userPrompt: string) => Promise<string>
  }
): Promise<HomebrewResponse> {
  // Validate request
  const validatedRequest = HomebrewRequestSchema.parse(request)

  // Build prompts
  const systemPrompt = HOMEBREW_SYSTEM_PROMPT
  const userPrompt = buildUserPrompt(validatedRequest)

  // Call AI
  const rawResponse = await aiClient.generate(systemPrompt, userPrompt)

  // Parse response
  let response: HomebrewResponse
  try {
    // Extract JSON from response (handle markdown code blocks)
    const jsonMatch = rawResponse.match(/```(?:json)?\s*([\s\S]*?)```/) ||
                      rawResponse.match(/(\{[\s\S]*\})/)

    if (!jsonMatch) {
      throw new Error('No JSON found in AI response')
    }

    const parsed = JSON.parse(jsonMatch[1])
    response = HomebrewResponseSchema.parse(parsed)
  } catch (err) {
    throw new Error(`Failed to parse AI response: ${err}`)
  }

  // Validate the generated item
  const validation = validateItem(response.item)
  if (!validation.valid) {
    response.warnings = [...response.warnings, ...validation.errors]
    response.isBalanced = false
  }

  // Calculate balance score
  response.balanceScore = calculateBalanceScore(response.item)
  response.isBalanced = response.balanceScore >= 40 && response.balanceScore <= 60

  return response
}

// ============================================
// QUICK GENERATION HELPERS
// ============================================

/**
 * Generate a simple +X weapon
 */
export function generatePlusWeapon(
  baseWeapon: string,
  bonus: 1 | 2 | 3,
  damageType?: string
): Partial<Item> {
  const rarities: Record<number, ItemRarity> = {
    1: 'uncommon',
    2: 'rare',
    3: 'very_rare'
  }

  const values: Record<number, number> = {
    1: 300,
    2: 2000,
    3: 15000
  }

  return {
    name: `+${bonus} ${baseWeapon}`,
    category: 'weapon',
    magical: true,
    rarity: rarities[bonus],
    baseValue: values[bonus],
    attunement: { required: false },
    weapon: {
      damage: '1d8', // Would be based on baseWeapon
      damageType: (damageType || 'slashing') as any,
      properties: [],
      bonusToHit: bonus,
      bonusDamage: bonus
    }
  }
}

/**
 * Generate a simple +X armor
 */
export function generatePlusArmor(
  baseArmor: string,
  bonus: 1 | 2 | 3
): Partial<Item> {
  const rarities: Record<number, ItemRarity> = {
    1: 'rare',      // +1 armor is rare (unlike weapons)
    2: 'very_rare',
    3: 'legendary'
  }

  const values: Record<number, number> = {
    1: 1500,
    2: 6000,
    3: 30000
  }

  return {
    name: `+${bonus} ${baseArmor}`,
    category: 'armor',
    magical: true,
    rarity: rarities[bonus],
    baseValue: values[bonus],
    attunement: { required: false },
    armor: {
      type: 'medium' as any, // Would be based on baseArmor
      baseAC: 14,            // Would be based on baseArmor
      addDexterity: true,
      maxDexBonus: 2,
      stealthDisadvantage: false,
      bonusAC: bonus
    }
  }
}
