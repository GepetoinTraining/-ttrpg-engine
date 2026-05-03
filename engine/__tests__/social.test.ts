/**
 * SOCIAL SYSTEM TESTS
 * ====================
 * Contracts, households, kinship, titles, jurisdictions, monthly tick, ascension
 */

import { describe, it, expect } from 'vitest'
import {
  // Contracts
  createContract,
  acceptContract,
  ratifyContract,
  activateContract,
  breachContract,
  terminateContract,
  fulfillContract,
  expireContract,
  getActiveContracts,
  getContractsBetween,
  hasActiveContract,
  // Households
  createHousehold,
  addMember,
  removeMember,
  getActiveMembers,
  getHead,
  getHeirs,
  succeedHead,
  calculateStanding,
  // Kinship
  createKinshipLink,
  getRelatives,
  getParents,
  getChildren,
  getSpouse,
  areRelated,
  canInherit,
  // Titles
  createTitle,
  transferTitle,
  vacateTitle,
  compareRank,
  getHighestTitle,
  // Jurisdictions
  createJurisdiction,
  isEnforceable,
  findJurisdiction,
  // Ticks
  monthlySocialTick,
  ascendCharacterSocial,
  // Family Registry (Koseki)
  createFamilyRegistry,
  registerMarriage,
  registerBirth,
  registerDeath,
  registerAdoption,
  registerDivorce,
  getRegistryAt,
  getEntityRegistry,
  getRegistryLineage,
  // MF Child Pool (twin-spawn)
  createChildPool,
  drawFromChildPool,
  // Name Pools
  generateName,
  getNamePool,
  NAME_POOLS,
  // Types
  type Contract,
  type ContractParty,
  type KinshipLink,
} from '../social'

// ── Helpers ──

function makeParty(role: string, id: string = `char_${role}`): ContractParty {
  return { entityType: 'character', entityId: id, role, consented: true, canExit: false }
}

// ============================================================
// CONTRACTS
// ============================================================

describe('Contracts', () => {
  it('creates a contract with correct category', () => {
    const c = createContract('marriage', [makeParty('spouse', 'a'), makeParty('spouse', 'b')], 100)
    expect(c.type).toBe('marriage')
    expect(c.category).toBe('personal')
    expect(c.status).toBe('proposed')
  })

  it('feudal category for vassalage', () => {
    const c = createContract('vassalage', [makeParty('lord', 'a'), makeParty('vassal', 'b')], 1)
    expect(c.category).toBe('feudal')
  })

  it('economic category for loan', () => {
    expect(createContract('loan', [], 1).category).toBe('economic')
  })

  it('criminal category for blackmail', () => {
    expect(createContract('blackmail', [], 1).category).toBe('criminal')
  })

  it('lifecycle: proposed → accepted → active', () => {
    const c = createContract('employment', [makeParty('employer'), makeParty('employee')], 1)
    expect(c.status).toBe('proposed')
    acceptContract(c)
    expect(c.status).toBe('accepted')
    ratifyContract(c, 'jur_1')
    expect(c.status).toBe('active')
    expect(c.jurisdictionId).toBe('jur_1')
  })

  it('breach increments counter', () => {
    const c = createContract('alliance', [makeParty('ally_1'), makeParty('ally_2')], 1)
    activateContract(c)
    breachContract(c)
    expect(c.status).toBe('breached')
    expect(c.breachCount).toBe(1)
  })

  it('terminate sets end day', () => {
    const c = createContract('marriage', [], 100)
    activateContract(c)
    terminateContract(c, 500)
    expect(c.status).toBe('terminated')
    expect(c.endDay).toBe(500)
  })

  it('fulfill sets end day', () => {
    const c = createContract('apprenticeship', [], 100)
    activateContract(c)
    fulfillContract(c, 300)
    expect(c.status).toBe('fulfilled')
    expect(c.endDay).toBe(300)
  })

  it('expire fixed-duration contract', () => {
    const c = createContract('employment', [], 100, { durationType: 'fixed', durationDays: 30 })
    activateContract(c)
    expect(expireContract(c, 129)).toBe(false) // Not yet
    expect(expireContract(c, 130)).toBe(true)  // 100 + 30 = 130
    expect(c.status).toBe('expired')
  })

  it('queries: getActiveContracts', () => {
    const c1 = createContract('marriage', [makeParty('spouse', 'alice'), makeParty('spouse', 'bob')], 1)
    const c2 = createContract('loan', [makeParty('creditor', 'alice'), makeParty('debtor', 'carol')], 1)
    activateContract(c1)
    activateContract(c2)
    const result = getActiveContracts([c1, c2], 'alice')
    expect(result).toHaveLength(2)
  })

  it('queries: getContractsBetween', () => {
    const c = createContract('alliance', [makeParty('ally', 'a'), makeParty('ally', 'b')], 1)
    expect(getContractsBetween([c], 'a', 'b')).toHaveLength(1)
    expect(getContractsBetween([c], 'a', 'c')).toHaveLength(0)
  })

  it('queries: hasActiveContract', () => {
    const c = createContract('guild_membership', [makeParty('member', 'x')], 1)
    activateContract(c)
    expect(hasActiveContract([c], 'x', 'guild_membership')).toBe(true)
    expect(hasActiveContract([c], 'x', 'marriage')).toBe(false)
  })
})

// ============================================================
// HOUSEHOLDS
// ============================================================

describe('Households', () => {
  it('creates with head member', () => {
    const hh = createHousehold('House Stark', 'hub_winterfell', 'ned', 100)
    expect(hh.members).toHaveLength(1)
    expect(getHead(hh)?.entityId).toBe('ned')
  })

  it('adds and removes members', () => {
    const hh = createHousehold('House Stark', 'hub_1', 'ned', 100)
    addMember(hh, 'sansa', 'child', 110)
    addMember(hh, 'arya', 'child', 115)
    expect(getActiveMembers(hh)).toHaveLength(3)

    removeMember(hh, 'sansa')
    expect(getActiveMembers(hh)).toHaveLength(2)
  })

  it('succession: heir takes over', () => {
    const hh = createHousehold('House', 'hub_1', 'father', 100)
    addMember(hh, 'son', 'heir', 120)
    addMember(hh, 'daughter', 'child', 125)

    const newHead = succeedHead(hh, 200)
    expect(newHead).toBe('son')
    expect(getHead(hh)?.entityId).toBe('son')
  })

  it('succession: child takes over when no heir', () => {
    const hh = createHousehold('House', 'hub_1', 'father', 100)
    addMember(hh, 'eldest', 'child', 110)
    addMember(hh, 'youngest', 'child', 120)

    const newHead = succeedHead(hh, 200)
    expect(newHead).toBe('eldest') // Eldest child by joinedDay
  })

  it('succession: no one left → declining', () => {
    const hh = createHousehold('House', 'hub_1', 'last_one', 100)
    const newHead = succeedHead(hh, 200)
    expect(newHead).toBeNull()
    expect(hh.status).toBe('declining')
  })

  it('standing calculation', () => {
    const hh = createHousehold('House', 'hub_1', 'x', 1)
    expect(calculateStanding(hh)).toBe('destitute') // 0 treasury, 0 properties

    hh.treasury = 100
    expect(calculateStanding(hh)).toBe('common')

    hh.treasury = 300
    expect(calculateStanding(hh)).toBe('comfortable')

    hh.treasury = 1000
    expect(calculateStanding(hh)).toBe('wealthy')

    hh.treasury = 50000
    expect(calculateStanding(hh)).toBe('royal')
  })
})

// ============================================================
// KINSHIP
// ============================================================

describe('Kinship', () => {
  it('creates active link', () => {
    const link = createKinshipLink('parent_1', 'child_1', 'parent')
    expect(link.status).toBe('active')
    expect(link.legitimacy).toBe('legitimate')
  })

  it('getRelatives finds all connections', () => {
    const links = [
      createKinshipLink('a', 'b', 'parent'),
      createKinshipLink('a', 'c', 'parent'),
      createKinshipLink('d', 'e', 'parent'),
    ]
    expect(getRelatives(links, 'a')).toHaveLength(2)
    expect(getRelatives(links, 'b')).toHaveLength(1)
  })

  it('getParents returns parent entity IDs', () => {
    const links = [
      createKinshipLink('mom', 'kid', 'parent'),
      createKinshipLink('dad', 'kid', 'parent'),
    ]
    expect(getParents(links, 'kid')).toEqual(['mom', 'dad'])
  })

  it('getChildren returns child entity IDs', () => {
    const links = [
      createKinshipLink('parent', 'child_a', 'parent'),
      createKinshipLink('parent', 'child_b', 'parent'),
    ]
    expect(getChildren(links, 'parent')).toEqual(['child_a', 'child_b'])
  })

  it('getSpouse finds married partner', () => {
    const links = [createKinshipLink('a', 'b', 'spouse')]
    expect(getSpouse(links, 'a')).toBe('b')
    expect(getSpouse(links, 'b')).toBe('a')
    expect(getSpouse(links, 'c')).toBeNull()
  })

  it('areRelated detects relationship', () => {
    const links = [createKinshipLink('a', 'b', 'sibling')]
    expect(areRelated(links, 'a', 'b')).toBe(true)
    expect(areRelated(links, 'b', 'a')).toBe(true)
    expect(areRelated(links, 'a', 'c')).toBe(false)
  })

  it('canInherit checks legitimacy', () => {
    expect(canInherit(createKinshipLink('a', 'b', 'child', 'legitimate'))).toBe(true)
    expect(canInherit(createKinshipLink('a', 'b', 'child', 'adopted'))).toBe(true)
    expect(canInherit(createKinshipLink('a', 'b', 'child', 'legitimized'))).toBe(true)
    expect(canInherit(createKinshipLink('a', 'b', 'child', 'illegitimate'))).toBe(false)
    expect(canInherit(createKinshipLink('a', 'b', 'child', 'contested'))).toBe(false)
  })
})

// ============================================================
// TITLES
// ============================================================

describe('Titles', () => {
  it('creates title', () => {
    const t = createTitle('Duke of Amn', 'duke', 'holder_1')
    expect(t.rank).toBe('duke')
    expect(t.status).toBe('active')
  })

  it('vacant title has null holder', () => {
    const t = createTitle('Barony of Nothing', 'baron')
    expect(t.holderId).toBeNull()
    expect(t.status).toBe('vacant')
  })

  it('transfer title', () => {
    const t = createTitle('Count', 'count', 'old')
    transferTitle(t, 'new')
    expect(t.holderId).toBe('new')
    expect(t.status).toBe('active')
  })

  it('vacate title', () => {
    const t = createTitle('Knight', 'knight', 'holder')
    vacateTitle(t)
    expect(t.holderId).toBeNull()
    expect(t.status).toBe('vacant')
  })

  it('compareRank: emperor > king > duke', () => {
    expect(compareRank('emperor', 'king')).toBeLessThan(0)
    expect(compareRank('king', 'duke')).toBeLessThan(0)
    expect(compareRank('baron', 'emperor')).toBeGreaterThan(0)
  })

  it('getHighestTitle', () => {
    const titles = [
      createTitle('Baron', 'baron', 'hero'),
      createTitle('Duke', 'duke', 'hero'),
      createTitle('Knight', 'knight', 'hero'),
    ]
    const highest = getHighestTitle(titles, 'hero')
    expect(highest?.rank).toBe('duke')
  })
})

// ============================================================
// JURISDICTIONS
// ============================================================

describe('Jurisdictions', () => {
  it('creates with recognized types', () => {
    const j = createJurisdiction('Royal Court', 'royal_court', ['marriage', 'vassalage'])
    expect(j.recognizedTypes).toHaveLength(2)
    expect(j.canFine).toBe(true)
    expect(j.canImprison).toBe(false)
  })

  it('isEnforceable checks recognized types', () => {
    const j = createJurisdiction('City', 'city', ['marriage', 'employment', 'loan'])
    expect(isEnforceable(j, 'marriage')).toBe(true)
    expect(isEnforceable(j, 'blood_oath')).toBe(false)
  })

  it('findJurisdiction returns highest precedence', () => {
    const j1 = createJurisdiction('Village', 'village', ['marriage'], 30)
    const j2 = createJurisdiction('City', 'city', ['marriage', 'loan'], 60)
    const j3 = createJurisdiction('Royal', 'royal_court', ['marriage'], 90)

    expect(findJurisdiction([j1, j2, j3], 'marriage')?.name).toBe('Royal')
    expect(findJurisdiction([j1, j2], 'loan')?.name).toBe('City')
    expect(findJurisdiction([j1, j2, j3], 'blood_oath')).toBeUndefined()
  })
})

// ============================================================
// MONTHLY SOCIAL TICK
// ============================================================

describe('Monthly Social Tick', () => {
  it('expires fixed-duration contracts', () => {
    const c = createContract('employment', [makeParty('worker', 'a')], 100, {
      durationType: 'fixed', durationDays: 30,
    })
    activateContract(c)

    const result = monthlySocialTick(130, [c], [], [], [])
    expect(result.expiredContracts).toContain(c.id)
    expect(c.status).toBe('expired')
  })

  it('recalculates household standing', () => {
    const hh = createHousehold('House', 'hub_1', 'x', 1)
    hh.treasury = 1000 // Should become wealthy
    hh.standing = 'common' // Currently common

    const result = monthlySocialTick(100, [], [hh], [], [])
    expect(result.standingChanges).toHaveLength(1)
    expect(result.standingChanges[0].to).toBe('wealthy')
  })

  it('identifies vacant titles', () => {
    const t = createTitle('Barony', 'baron')
    const result = monthlySocialTick(100, [], [], [t], [])
    expect(result.vacantTitles).toContain(t.id)
  })
})

// ============================================================
// CHARACTER ASCENSION
// ============================================================

describe('Character Ascension', () => {
  it('transfers contracts and titles to heir', () => {
    const hh = createHousehold('House', 'hub_1', 'father', 100)
    addMember(hh, 'son', 'heir', 120)

    const contract = createContract('alliance', [makeParty('ally', 'father'), makeParty('ally', 'other')], 100)
    activateContract(contract)

    const title = createTitle('Baron', 'baron', 'father')

    const result = ascendCharacterSocial('father', 500, [contract], hh, [title])

    expect(result.heirId).toBe('son')
    expect(result.transferredContracts).toBe(1)
    expect(result.transferredTitles).toBe(1)
    expect(title.holderId).toBe('son')
    expect(contract.parties[0].entityId).toBe('son')
  })

  it('terminates contracts when no heir', () => {
    const hh = createHousehold('House', 'hub_1', 'lone_wolf', 100)

    const contract = createContract('alliance', [makeParty('ally', 'lone_wolf')], 100)
    activateContract(contract)

    const title = createTitle('Knight', 'knight', 'lone_wolf')

    const result = ascendCharacterSocial('lone_wolf', 500, [contract], hh, [title])

    expect(result.heirId).toBeNull()
    expect(contract.status).toBe('terminated')
    expect(title.status).toBe('vacant')
  })
})

// ============================================================
// FAMILY REGISTRY (KOSEKI)
// ============================================================

describe('Family Registry (Koseki)', () => {
  it('creates a registry at a settlement', () => {
    const reg = createFamilyRegistry('Obarskyr', 'node_suzail', 'azoun', 'Azoun IV', 'hh_1', 100)
    expect(reg.familyName).toBe('Obarskyr')
    expect(reg.registeredAt).toBe('node_suzail')
    expect(reg.headId).toBe('azoun')
    expect(reg.entries).toHaveLength(1)
    expect(reg.entries[0].entryType).toBe('head')
    expect(reg.status).toBe('active')
  })

  it('registerMarriage orchestrates contract + kinship + registry + household', () => {
    const result = registerMarriage(
      { id: 'azoun', name: 'Azoun IV' },
      { id: 'filfaeril', name: 'Filfaeril Selazair' },
      'node_suzail', 100,
    )

    // Contract created and active
    expect(result.contract.type).toBe('marriage')
    expect(result.contract.status).toBe('active')
    expect(result.contract.parties).toHaveLength(2)

    // Kinship link created
    expect(result.kinshipLink.relationship).toBe('spouse')
    expect(result.kinshipLink.entity1Id).toBe('azoun')
    expect(result.kinshipLink.entity2Id).toBe('filfaeril')

    // Registry created with both spouses
    expect(result.registry.familyName).toBeTruthy()
    expect(result.registry.entries).toHaveLength(2) // head + spouse
    expect(result.registry.entries[0].entryType).toBe('head')
    expect(result.registry.entries[1].entryType).toBe('spouse')

    // Household created with both
    expect(getActiveMembers(result.household)).toHaveLength(2)
  })

  it('registerMarriage join mode — spouse enters existing registry', () => {
    // Create existing registry + household
    const hh = createHousehold('House Obarskyr', 'node_suzail', 'azoun', 50, 'noble_house')
    const reg = createFamilyRegistry('Obarskyr', 'node_suzail', 'azoun', 'Azoun IV', hh.id, 50)

    const result = registerMarriage(
      { id: 'azoun', name: 'Azoun IV' },
      { id: 'filfaeril', name: 'Filfaeril Selazair' },
      'node_suzail', 100,
      reg, hh,
    )

    // Same registry, now with spouse added
    expect(result.registry).toBe(reg) // same object
    expect(result.registry.entries).toHaveLength(2)
    expect(getActiveMembers(hh)).toHaveLength(2)
  })

  it('registerBirth adds child with dual-parent kinship', () => {
    const result = registerMarriage(
      { id: 'father', name: 'Lord Stark' },
      { id: 'mother', name: 'Lady Stark' },
      'node_winterfell', 100,
    )

    const kinshipLinks: KinshipLink[] = [result.kinshipLink]
    const birth = registerBirth(
      result.registry, result.household,
      'child_1', 'Robb Stark', 'mother', 'father',
      200, 'legitimate', kinshipLinks,
    )

    expect(birth.registryEntry.entryType).toBe('child')
    expect(birth.registryEntry.birthDay).toBe(200)
    expect(birth.kinshipToMother.entity1Id).toBe('mother')
    expect(birth.kinshipToFather.entity1Id).toBe('father')
    expect(result.registry.entries).toHaveLength(3) // head + spouse + child
    expect(kinshipLinks).toHaveLength(3) // spouse + 2 parent links
    expect(getActiveMembers(result.household)).toHaveLength(3)
  })

  it('registerDeath exits from registry and triggers succession', () => {
    const marriage = registerMarriage(
      { id: 'head', name: 'Lord' },
      { id: 'spouse', name: 'Lady' },
      'node_city', 100,
    )
    const kinshipLinks: KinshipLink[] = [marriage.kinshipLink]
    registerBirth(marriage.registry, marriage.household, 'child', 'Junior', 'spouse', 'head', 150, 'legitimate', kinshipLinks)

    // Head dies
    const death = registerDeath(marriage.registry, marriage.household, 'head', 300, kinshipLinks)

    expect(death.wasHead).toBe(true)
    expect(death.successorId).toBe('spouse') // spouse succeeds
    expect(marriage.registry.headId).toBe('spouse')

    // Entry marked as exited
    const headEntry = marriage.registry.entries.find(e => e.entityId === 'head')
    expect(headEntry?.exitedDay).toBe(300)
    expect(headEntry?.exitReason).toBe('death')
    expect(headEntry?.deathDay).toBe(300)
  })

  it('registerDeath → extinct when no successors', () => {
    const hh = createHousehold('House', 'node_1', 'last_one', 100)
    const reg = createFamilyRegistry('Last', 'node_1', 'last_one', 'Last One', hh.id, 100)

    registerDeath(reg, hh, 'last_one', 500, [])
    expect(reg.status).toBe('extinct')
  })

  it('registerAdoption transfers child between registries', () => {
    const fromHh = createHousehold('From', 'node_1', 'bio_parent', 100)
    const fromReg = createFamilyRegistry('From', 'node_1', 'bio_parent', 'Bio Parent', fromHh.id, 100)
    fromReg.entries.push({
      entityId: 'orphan', name: 'Orphan', entryType: 'child',
      enteredDay: 110, exitedDay: null, exitReason: null, legitimacy: 'legitimate',
    })

    const toHh = createHousehold('To', 'node_2', 'adopt_parent', 100)
    const toReg = createFamilyRegistry('To', 'node_2', 'adopt_parent', 'Adopt Parent', toHh.id, 100)

    const kinshipLinks: KinshipLink[] = []
    registerAdoption(fromReg, toReg, toHh, 'orphan', 'Orphan', 'adopt_parent', 200, kinshipLinks)

    // Exited from source
    const fromEntry = fromReg.entries.find(e => e.entityId === 'orphan')
    expect(fromEntry?.exitedDay).toBe(200)
    expect(fromEntry?.exitReason).toBe('adoption_out')

    // Entered target
    const toEntry = toReg.entries.find(e => e.entityId === 'orphan')
    expect(toEntry?.entryType).toBe('adopted')
    expect(toEntry?.legitimacy).toBe('adopted')

    // Kinship created
    expect(kinshipLinks).toHaveLength(1)
    expect(kinshipLinks[0].legitimacy).toBe('adopted')
  })

  it('registerDivorce exits spouse and creates new registry', () => {
    const marriage = registerMarriage(
      { id: 'stays', name: 'Lord Stays' },
      { id: 'leaves', name: 'Lady Leaves' },
      'node_city', 100,
    )
    const contracts = [marriage.contract]
    const kinshipLinks = [marriage.kinshipLink]

    const divorce = registerDivorce(
      marriage.registry, marriage.household,
      'leaves', 'Lady Leaves',
      contracts, kinshipLinks, 300,
    )

    // Spouse exited from original registry
    const exitedEntry = marriage.registry.entries.find(e => e.entityId === 'leaves')
    expect(exitedEntry?.exitedDay).toBe(300)
    expect(exitedEntry?.exitReason).toBe('divorce')

    // Marriage contract terminated
    expect(marriage.contract.status).toBe('terminated')

    // Kinship annulled
    expect(kinshipLinks[0].status).toBe('annulled')

    // New registry created for leaving spouse
    expect(divorce.newRegistry).not.toBeNull()
    expect(divorce.newRegistry!.entries[0].entityId).toBe('leaves')
    expect(divorce.newRegistry!.registeredAt).toBe('node_city')
    expect(divorce.newHousehold).not.toBeNull()
  })

  it('getRegistryAt finds registries at a settlement', () => {
    const reg1 = createFamilyRegistry('House A', 'node_suzail', 'a', 'A', 'hh1', 1)
    const reg2 = createFamilyRegistry('House B', 'node_suzail', 'b', 'B', 'hh2', 1)
    const reg3 = createFamilyRegistry('House C', 'node_arabel', 'c', 'C', 'hh3', 1)

    const suzail = getRegistryAt([reg1, reg2, reg3], 'node_suzail')
    expect(suzail).toHaveLength(2)

    const arabel = getRegistryAt([reg1, reg2, reg3], 'node_arabel')
    expect(arabel).toHaveLength(1)
  })

  it('getEntityRegistry finds which registry an entity belongs to', () => {
    const reg = createFamilyRegistry('Obarskyr', 'node_suzail', 'azoun', 'Azoun', 'hh1', 1)
    registerMarriage(
      { id: 'azoun', name: 'Azoun' },
      { id: 'queen', name: 'Queen' },
      'node_suzail', 50, reg,
      createHousehold('H', 'node_suzail', 'azoun', 1),
    )

    expect(getEntityRegistry([reg], 'azoun')?.familyName).toBe('Obarskyr')
    expect(getEntityRegistry([reg], 'queen')?.familyName).toBe('Obarskyr')
    expect(getEntityRegistry([reg], 'nobody')).toBeNull()
  })

  it('getRegistryLineage builds family tree from kinship', () => {
    const links = [
      createKinshipLink('grandparent', 'parent_a', 'parent'),
      createKinshipLink('grandparent', 'parent_b', 'parent'),
      createKinshipLink('parent_a', 'child_1', 'parent'),
      createKinshipLink('parent_a', 'child_2', 'parent'),
    ]

    const tree = getRegistryLineage(links, 'grandparent', 3)
    expect(tree).toHaveLength(2) // parent_a, parent_b
    expect(tree[0].children).toHaveLength(2) // child_1, child_2
    expect(tree[1].children).toHaveLength(0) // parent_b has no children
  })
})

// ============================================================
// REGIONAL NAME POOLS
// ============================================================

describe('Regional Name Pools', () => {
  it('generates names from cormyrian pool', () => {
    const pool = getNamePool('cormyrian')!
    expect(pool).not.toBeNull()
    const name = generateName(pool, 'masculine', 42)
    expect(pool.masculine).toContain(name.firstName)
    expect(pool.familyNames).toContain(name.familyName)
  })

  it('generates different names from different seeds', () => {
    const pool = getNamePool('sword_coast')!
    const name1 = generateName(pool, 'feminine', 1)
    const name2 = generateName(pool, 'feminine', 999)
    // Very unlikely to be the same with different seeds
    expect(name1.firstName !== name2.firstName || name1.familyName !== name2.familyName).toBe(true)
  })

  it('has 5 culture pools', () => {
    expect(getNamePool('cormyrian')).not.toBeNull()
    expect(getNamePool('sword_coast')).not.toBeNull()
    expect(getNamePool('drow')).not.toBeNull()
    expect(getNamePool('dwarven')).not.toBeNull()
    expect(getNamePool('halfling')).not.toBeNull()
    expect(getNamePool('nonexistent')).toBeNull()
  })

  it('drow names are appropriately exotic', () => {
    const pool = getNamePool('drow')!
    expect(pool.masculine).toContain('Drizzt')
    expect(pool.familyNames).toContain("Do'Urden")
  })
})

// ============================================================
// MF CHILD POOL (TWIN-SPAWN)
// ============================================================

describe('MF Child Pool (Twin-Spawn)', () => {
  it('registerBirth generates spare twin into child pool', () => {
    const marriage = registerMarriage(
      { id: 'father', name: 'Azoun Obarskyr' },
      { id: 'mother', name: 'Filfaeril Obarskyr' },
      'node_suzail', 100,
    )
    const childPool = createChildPool('node_suzail')
    const namePool = NAME_POOLS.cormyrian
    const kinshipLinks: KinshipLink[] = [marriage.kinshipLink]

    // Birth with pool — should generate spare twin
    registerBirth(
      marriage.registry, marriage.household,
      'child_1', 'Tanalasta Obarskyr', 'mother', 'father',
      200, 'legitimate', kinshipLinks,
      namePool, childPool,
    )

    // Pool grew by 1 (the spare twin)
    expect(childPool.spares).toHaveLength(1)
    expect(childPool.totalGenerated).toBe(1)
    expect(childPool.spares[0].familyName).toBe('Obarskyr')
    expect(childPool.spares[0].motherId).toBe('mother')
    expect(childPool.spares[0].fatherId).toBe('father')
  })

  it('drawFromChildPool returns and removes a spare', () => {
    const childPool = createChildPool('node_suzail')
    const marriage = registerMarriage(
      { id: 'a', name: 'Lord A' },
      { id: 'b', name: 'Lady B' },
      'node_suzail', 100,
    )
    const kinshipLinks: KinshipLink[] = [marriage.kinshipLink]

    // Generate 3 births → 3 spare twins
    for (let i = 0; i < 3; i++) {
      registerBirth(
        marriage.registry, marriage.household,
        `child_${i}`, `Child ${i}`, 'b', 'a',
        200 + i * 30, 'legitimate', kinshipLinks,
        NAME_POOLS.cormyrian, childPool,
      )
    }

    expect(childPool.spares).toHaveLength(3)

    // Draw one
    const drawn = drawFromChildPool(childPool)
    expect(drawn).not.toBeNull()
    expect(drawn!.name).toBeTruthy()
    expect(childPool.spares).toHaveLength(2)
    expect(childPool.totalDrawn).toBe(1)
  })

  it('drawFromChildPool returns null when empty', () => {
    const pool = createChildPool('node_empty')
    expect(drawFromChildPool(pool)).toBeNull()
  })

  it('birth without pool still works (backwards compatible)', () => {
    const marriage = registerMarriage(
      { id: 'x', name: 'Lord X' },
      { id: 'y', name: 'Lady Y' },
      'node_1', 100,
    )
    const kinshipLinks: KinshipLink[] = [marriage.kinshipLink]

    // No namePool or childPool passed — should still work
    const birth = registerBirth(
      marriage.registry, marriage.household,
      'kid', 'Kid', 'y', 'x', 200, 'legitimate', kinshipLinks,
    )

    expect(birth.registryEntry.entryType).toBe('child')
    expect(marriage.registry.entries).toHaveLength(3)
  })
})

