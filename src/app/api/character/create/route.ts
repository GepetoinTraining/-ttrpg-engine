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
import { randomUUID } from 'crypto'

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
    })
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? 'character create failed' },
      { status: 500 }
    )
  }
}
