import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db/connection'
import {
  characters,
  characterClasses,
  characterAbilities,
  characterSaves,
  characterSkills,
} from '@/db/schema'
import { eq } from 'drizzle-orm'
import { ABILITIES, abilityModifier, type Ability } from '@/game/chargen'

// ─── 5e skill → ability map ────────────────────────────────────────────────
const SKILL_TO_ABILITY: Record<string, Ability> = {
  Acrobatics: 'dexterity',
  'Animal Handling': 'wisdom',
  Arcana: 'intelligence',
  Athletics: 'strength',
  Deception: 'charisma',
  History: 'intelligence',
  Insight: 'wisdom',
  Intimidation: 'charisma',
  Investigation: 'intelligence',
  Medicine: 'wisdom',
  Nature: 'intelligence',
  Perception: 'wisdom',
  Performance: 'charisma',
  Persuasion: 'charisma',
  Religion: 'intelligence',
  'Sleight of Hand': 'dexterity',
  Stealth: 'dexterity',
  Survival: 'wisdom',
}

function proficiencyBonusForLevel(level: number): number {
  if (level >= 17) return 6
  if (level >= 13) return 5
  if (level >= 9) return 4
  if (level >= 5) return 3
  return 2
}

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await ctx.params
    const charRows = await db.select().from(characters).where(eq(characters.id, id)).limit(1)
    if (!charRows[0]) {
      return NextResponse.json({ error: 'character not found' }, { status: 404 })
    }
    const character = charRows[0]

    const [classRows, abilityRows, saveRows, skillRows] = await Promise.all([
      db.select().from(characterClasses).where(eq(characterClasses.characterId, id)),
      db.select().from(characterAbilities).where(eq(characterAbilities.characterId, id)),
      db.select().from(characterSaves).where(eq(characterSaves.characterId, id)),
      db.select().from(characterSkills).where(eq(characterSkills.characterId, id)),
    ])

    // Build ability map
    const scores: Record<Ability, number> = {
      strength: 10,
      dexterity: 10,
      constitution: 10,
      intelligence: 10,
      wisdom: 10,
      charisma: 10,
    }
    for (const r of abilityRows) {
      if (ABILITIES.includes(r.ability as Ability)) {
        scores[r.ability as Ability] = r.score
      }
    }
    const modifiers = Object.fromEntries(
      ABILITIES.map((a) => [a, abilityModifier(scores[a])])
    ) as Record<Ability, number>

    const totalLevel = classRows.reduce((sum, c) => sum + c.level, 0) || 1
    const profBonus = proficiencyBonusForLevel(totalLevel)

    const saveProfs = new Set(saveRows.map((r) => r.ability as Ability))
    const savingThrows = Object.fromEntries(
      ABILITIES.map((a) => [
        a,
        {
          bonus: modifiers[a] + (saveProfs.has(a) ? profBonus : 0),
          proficient: saveProfs.has(a),
        },
      ])
    )

    const skillProfsMap: Record<string, 'none' | 'half' | 'proficient' | 'expertise'> = {}
    for (const r of skillRows) {
      skillProfsMap[r.skill] = r.proficiency as any
    }
    const skills = Object.fromEntries(
      Object.entries(SKILL_TO_ABILITY).map(([skill, ability]) => {
        const prof = skillProfsMap[skill] ?? 'none'
        let bonus = modifiers[ability]
        if (prof === 'half') bonus += Math.floor(profBonus / 2)
        else if (prof === 'proficient') bonus += profBonus
        else if (prof === 'expertise') bonus += profBonus * 2
        return [skill, { ability, bonus, proficiency: prof }]
      })
    )

    // AC: simple — base + DEX (no armor parsing yet)
    const dexMod = modifiers.dexterity
    const ac = (character.baseAC || 10) + dexMod

    return NextResponse.json({
      character: {
        id: character.id,
        name: character.name,
        race: character.race,
        subrace: character.subrace,
        background: character.background,
        size: character.size,
        speed: character.speed,
        hp: { current: character.hpCurrent, max: character.hpMax, temp: character.tempHp },
        status: character.status,
        deathSaves: {
          successes: character.deathSaveSuccesses,
          failures: character.deathSaveFailures,
        },
        xp: character.xp,
      },
      classes: classRows.map((c) => ({
        name: c.className,
        level: c.level,
        subclass: c.subclass,
        hitDie: c.hitDie,
      })),
      level: totalLevel,
      proficiencyBonus: profBonus,
      abilityScores: scores,
      modifiers,
      savingThrows,
      skills,
      ac,
      initBonus: dexMod,
    })
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? 'character load failed' },
      { status: 500 }
    )
  }
}
