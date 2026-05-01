import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db/connection'
import {
  characters,
  characterClasses,
  characterAbilities,
  characterSaves,
  characterSkills,
  characterPersona,
  players,
  campaigns,
  adventures,
  parties,
  inventories,
  containers,
  items,
  spells,
  spellsKnown,
} from '@/db/schema'
import { eq } from 'drizzle-orm'
import {
  RACES,
  CLASSES,
  ABILITIES,
  abilityModifier,
  calculateStartingHp,
  findSubrace,
  type Ability,
} from '@/game/chargen'
import { composeSpell, calculateSpellLevel, getSpellSchool } from '../../../../../engine/magic'
import { appendLoreEntry } from '@/lib/lore-bag'
import { randomUUID } from 'crypto'

interface ComposedSpellInput {
  /** Player-typed name (used only on first creation; existing spells keep their canonical name). */
  name?: string
  /** Prime-element composition map (e.g. { Fire: 2, Projectile: 1 }). */
  elements?: Record<string, number>
}

interface PersonaEntry {
  field: string
  value: string
  ord: number
}

interface CreateBody {
  userId?: string
  campaignId?: string
  name: string
  raceKey: string
  subrace?: string
  classKey: string
  abilityScores: Record<Ability, number>
  background?: string
  alignment?: string
  hook?: string
  /** Optional level (default 1). Imported characters carry their D&D Beyond level. */
  level?: number
  /** Override the auto-derived starting HP (e.g. imported max HP). */
  hpMax?: number
  hpCurrent?: number
  /** Override save proficiencies (else inferred from class). */
  saveProficiencies?: Ability[]
  /** Skills with proficiency status (label keyed). */
  skills?: Record<string, { proficient: boolean; expertise: boolean }>
  /** Persona facts (backstory / ideals / bonds / flaws / allies / notes). */
  persona?: PersonaEntry[]
  /** When true, treat abilityScores as already-final (post-racial) values.
   * Imported characters carry the final scores from D&D Beyond, so the racial
   * bonus must NOT be re-applied. */
  skipRacialBonus?: boolean
  /** Starter inventory items (string names from class kit + background kit). */
  kitItems?: string[]
  /**
   * Composed starting spells. The server runs each through the spells ledger:
   * if `compositionSeed` already exists, the existing canonical name + creator
   * are used. Otherwise this character cert is registered as the first creator
   * and a lore-bag entry is appended.
   */
  startingSpells?: {
    cantrip?: ComposedSpellInput
    spell1?: ComposedSpellInput
  }
  /** Character cert id — needed to credit the cert as a spell's first creator. */
  certId?: string
}

interface SpellLedgerOutcome {
  spellId: string
  name: string
  level: number
  school: string
  isFirstCreator: boolean
  creatorCertId: string | null
  compositionSeed: string
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as CreateBody
    if (!body.name?.trim()) {
      return NextResponse.json({ error: 'name required' }, { status: 400 })
    }
    const race = RACES[body.raceKey]
    if (!race) {
      return NextResponse.json({ error: `unknown race: ${body.raceKey}` }, { status: 400 })
    }
    const klass = CLASSES[body.classKey]
    if (!klass) {
      return NextResponse.json({ error: `unknown class: ${body.classKey}` }, { status: 400 })
    }

    // Apply racial + subrace bonuses unless caller passed already-final scores
    // (imported characters carry post-racial values from D&D Beyond).
    const finalScores = { ...body.abilityScores } as Record<Ability, number>
    if (!body.skipRacialBonus) {
      const subraceData = findSubrace(body.raceKey, body.subrace)
      for (const ability of ABILITIES) {
        const raceBonus = race.abilityBonuses[ability] ?? 0
        const subraceBonus = subraceData?.abilityBonuses[ability] ?? 0
        finalScores[ability] = (body.abilityScores[ability] ?? 10) + raceBonus + subraceBonus
      }
    }

    const hp = calculateStartingHp(klass, finalScores.constitution)

    // Optional: resolve party starting location for character location, and
    // upsert a players row for the user.
    let locationType = 'settlement'
    let locationId = 'unknown'
    let playerId: string | null = null

    if (body.campaignId) {
      const camp = await db
        .select({ adventureId: campaigns.adventureId })
        .from(campaigns)
        .where(eq(campaigns.id, body.campaignId))
        .limit(1)
      if (camp[0]) {
        const adv = await db
          .select({ partyId: adventures.partyId })
          .from(adventures)
          .where(eq(adventures.id, camp[0].adventureId))
          .limit(1)
        if (adv[0]) {
          const p = await db
            .select({ startingLocation: parties.startingLocation })
            .from(parties)
            .where(eq(parties.id, adv[0].partyId))
            .limit(1)
          if (p[0]?.startingLocation) {
            locationId = p[0].startingLocation
            locationType = 'settlement'
          }
        }
        if (body.userId) {
          // Look up existing player row, or create one.
          const existing = await db
            .select({ id: players.id })
            .from(players)
            .where(eq(players.userId, body.userId))
            .limit(1)
          if (existing[0]) {
            playerId = existing[0].id
          } else {
            playerId = randomUUID()
            await db.insert(players).values({
              id: playerId,
              userId: body.userId,
              adventureId: camp[0].adventureId,
              isDM: false,
            })
          }
        }
      }
    }

    const characterId = randomUUID()

    const charLevel = body.level ?? 1
    const hpMaxFinal = body.hpMax ?? hp
    const hpCurrentFinal = body.hpCurrent ?? hpMaxFinal

    await db.insert(characters).values({
      id: characterId,
      playerId,
      name: body.name.trim(),
      race: race.name,
      subrace: body.subrace ?? null,
      size: race.size,
      reach: 5,
      background: body.background ?? null,
      hpCurrent: hpCurrentFinal,
      hpMax: hpMaxFinal,
      tempHp: 0,
      hitDiceUsed: 0,
      baseAC: 10,
      armorType: 'none',
      shieldEquipped: false,
      acBonusesJson: null,
      speed: race.speed,
      damageType: 'slashing',
      resistancesJson: null,
      vulnerabilitiesJson: null,
      immunitiesJson: null,
      status: 'active',
      conditionsJson: null,
      deathSaveSuccesses: 0,
      deathSaveFailures: 0,
      xp: 0,
      spellcastingAbility: klass.spellcasting ?? null,
      locationType,
      locationId,
    })

    await db.insert(characterClasses).values({
      id: randomUUID(),
      characterId,
      className: klass.name,
      level: charLevel,
      subclass: null,
      hitDie: klass.hitDie,
      isStartingClass: true,
    })

    for (const ability of ABILITIES) {
      await db.insert(characterAbilities).values({
        id: randomUUID(),
        characterId,
        ability,
        score: finalScores[ability],
      })
    }

    // Save proficiencies: caller-supplied list wins over class defaults.
    const saveAbilities = body.saveProficiencies && body.saveProficiencies.length > 0
      ? body.saveProficiencies
      : klass.savingThrows

    for (const ability of saveAbilities) {
      await db.insert(characterSaves).values({
        id: randomUUID(),
        characterId,
        ability,
      })
    }

    // Skill proficiencies (label-keyed map → character_skills rows).
    if (body.skills) {
      for (const [skillLabel, prof] of Object.entries(body.skills)) {
        if (!prof.proficient && !prof.expertise) continue
        await db.insert(characterSkills).values({
          id: randomUUID(),
          characterId,
          skill: skillLabel,
          proficiency: prof.expertise ? 'expertise' : 'proficient',
        })
      }
    }

    // Persona facts (backstory / ideals / bonds / flaws / allies / notes).
    if (body.persona && body.persona.length > 0) {
      for (const p of body.persona) {
        if (!p.value?.trim()) continue
        await db.insert(characterPersona).values({
          id: randomUUID(),
          characterId,
          field: p.field,
          value: p.value.trim(),
          ord: p.ord ?? 0,
        })
      }
    }

    // If we created a player row and there's no active character, set this one.
    if (playerId) {
      await db
        .update(players)
        .set({ activateCharacterId: characterId })
        .where(eq(players.id, playerId))
    }

    // ── Inventory carryover ──────────────────────────────────────────
    // Class kit + background kit items become the character's starter pack.
    let inventoryId: string | null = null
    let containerId: string | null = null
    if (body.kitItems && body.kitItems.length > 0) {
      inventoryId = randomUUID()
      containerId = randomUUID()
      await db.insert(inventories).values({
        id: inventoryId,
        ownerId: characterId,
        ownerType: 'character',
        locationNodeId: locationId,
      })
      await db.insert(containers).values({
        id: containerId,
        inventoryId,
        name: 'Starter pack',
        type: 'backpack',
        weightCapacity: 30,
        volumeCapacity: 1,
        spatialMagic: 'none',
        locked: false,
        lockDC: 0,
        currencyJson: null,
      })
      // De-dup the kit list (some items appear in both class + bg kits).
      const seen = new Set<string>()
      for (const itemName of body.kitItems) {
        const trimmed = itemName.trim()
        if (!trimmed || seen.has(trimmed.toLowerCase())) continue
        seen.add(trimmed.toLowerCase())
        await db.insert(items).values({
          id: randomUUID(),
          containerId,
          name: trimmed,
          category: 'gear',
          rarity: 'common',
          weight: 1,
          volume: 0.1,
          valueGP: 0,
          stackable: false,
          quantity: 1,
          magical: false,
          requiresAttunement: false,
          sourceType: 'starter',
          propertiesJson: null,
        })
      }
    }

    // ── Spell ledger carryover ───────────────────────────────────────
    // For each composed spell:
    //   1. Compute compositionSeed (BigInt → string)
    //   2. Try lookup; if exists, reuse existing row (canonical name + creator)
    //   3. Else insert new row, register this cert as first creator, append lore
    //   4. Link character → spell via spells_known
    const spellOutcomes: SpellLedgerOutcome[] = []
    if (body.startingSpells) {
      for (const slotKey of ['cantrip', 'spell1'] as const) {
        const composed = body.startingSpells[slotKey]
        if (!composed?.elements) continue
        const elementCount = Object.values(composed.elements).reduce((s, v) => s + (v ?? 0), 0)
        if (elementCount === 0) continue

        const seedBigint = composeSpell(composed.elements)
        const seed = seedBigint.toString()
        const level = calculateSpellLevel(composed.elements)
        const school = getSpellSchool(composed.elements) ?? 'evocation'

        const existing = await db
          .select()
          .from(spells)
          .where(eq(spells.compositionSeed, seed))
          .limit(1)

        let outcome: SpellLedgerOutcome
        if (existing[0]) {
          // Already in the ledger — reuse. Player's typed name is ignored;
          // they get the existing canonical name (and creator credit).
          outcome = {
            spellId: existing[0].id,
            name: existing[0].name,
            level: existing[0].level,
            school: existing[0].school,
            isFirstCreator: false,
            creatorCertId: existing[0].creatorCertId,
            compositionSeed: seed,
          }
        } else {
          // First creator — record name + cert, register in ledger.
          const spellId = randomUUID()
          const canonicalName =
            composed.name?.trim() ||
            `${level === 0 ? 'Minor' : 'Lesser'} ${school[0].toUpperCase() + school.slice(1)} ${seed.slice(0, 6)}`
          const creator = body.certId ?? null
          await db.insert(spells).values({
            id: spellId,
            name: canonicalName,
            school,
            level,
            range: 'self',
            componentsJson: JSON.stringify(['V', 'S']),
            duration: 'instantaneous',
            description:
              `Composed spell — ${
                Object.entries(composed.elements)
                  .map(([k, v]) => `${k}×${v}`)
                  .join(' + ')
              }`,
            ritual: false,
            concentration: false,
            compositionSeed: seed,
            creatorCertId: creator,
            elementsJson: JSON.stringify(composed.elements),
          })

          // Append lore-bag entry for the new spell. Other players' AI/DMs
          // can query this when generating descriptions or contextualizing
          // future encounters with the same composition.
          appendLoreEntry({
            id: `lore-spell-${seed}`,
            name: canonicalName,
            description:
              `${canonicalName} (level ${level} ${school}) was first composed by character cert ${
                creator?.slice(0, 8) ?? 'unknown'
              }… via ${
                Object.entries(composed.elements)
                  .map(([k, v]) => `${k}×${v}`)
                  .join(' + ')
              }.`,
            tags: ['spell', `level-${level}`, school, 'first-composition'],
            source: 'craft-discover',
            discoveredBy: creator ?? undefined,
          })

          outcome = {
            spellId,
            name: canonicalName,
            level,
            school,
            isFirstCreator: true,
            creatorCertId: creator,
            compositionSeed: seed,
          }
        }

        // Link character → spell.
        await db.insert(spellsKnown).values({
          id: randomUUID(),
          characterId,
          spellId: outcome.spellId,
        })

        spellOutcomes.push(outcome)
      }
    }

    return NextResponse.json({
      characterId,
      playerId,
      summary: {
        name: body.name.trim(),
        race: race.name,
        class: klass.name,
        level: charLevel,
        hp: hpMaxFinal,
        finalScores,
        modifiers: Object.fromEntries(
          ABILITIES.map((a) => [a, abilityModifier(finalScores[a])])
        ),
      },
      inventory: inventoryId
        ? { inventoryId, containerId, itemCount: body.kitItems?.length ?? 0 }
        : null,
      spells: spellOutcomes,
    })
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? 'character create failed' },
      { status: 500 }
    )
  }
}
