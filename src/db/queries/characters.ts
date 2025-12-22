import {
  query,
  queryOne,
  queryAll,
  transaction,
  parseJson,
  toJson,
  uuid,
  now,
  NotFoundError,
  type Transaction,
} from "../client";

// ============================================
// CHARACTER QUERIES
// ============================================

// ============================================
// TYPES
// ============================================

export interface CharacterRow {
  id: string;
  campaignId: string;
  partyId: string | null;
  ownerId: string;

  // Identity
  name: string;
  race: string;
  class: string;
  level: number;
  background: string | null;
  alignment: string | null;

  // Stats
  abilityScores: string; // JSON
  hp: number;
  maxHp: number;
  tempHp: number;
  ac: number;
  speed: number;
  proficiencyBonus: number;

  // Resources
  hitDice: string; // JSON
  deathSaves: string; // JSON
  inspiration: number;

  // Currency
  copper: number;
  silver: number;
  electrum: number;
  gold: number;
  platinum: number;

  // Details
  personality: string | null;
  ideals: string | null;
  bonds: string | null;
  flaws: string | null;
  backstory: string | null;
  notes: string | null;

  // State
  status: string;
  experience: number;

  // Metadata
  portraitUrl: string | null;
  sheetData: string; // JSON - full character sheet
  createdAt: string;
  updatedAt: string;
  version: number;
}

export interface CreateCharacterInput {
  id?: string;
  campaignId: string;
  partyId?: string;
  ownerId: string;
  name: string;
  race: string;
  class: string;
  level?: number;
  background?: string;
  alignment?: string;
  abilityScores: {
    strength: number;
    dexterity: number;
    constitution: number;
    intelligence: number;
    wisdom: number;
    charisma: number;
  };
  hp: number;
  maxHp: number;
  ac: number;
  speed?: number;
  sheetData?: Record<string, any>;
}

export interface UpdateCharacterInput {
  name?: string;
  partyId?: string | null;
  level?: number;
  hp?: number;
  maxHp?: number;
  tempHp?: number;
  ac?: number;
  experience?: number;
  status?: string;
  abilityScores?: Record<string, number>;
  personality?: string;
  ideals?: string;
  bonds?: string;
  flaws?: string;
  backstory?: string;
  notes?: string;
  portraitUrl?: string;
  sheetData?: Record<string, any>;
}

export interface CharacterFilters {
  campaignId?: string;
  partyId?: string;
  ownerId?: string;
  status?: string;
  class?: string;
  minLevel?: number;
  maxLevel?: number;
}

// ============================================
// CRUD OPERATIONS
// ============================================

export async function getCharacter(id: string): Promise<CharacterRow | null> {
  return queryOne<CharacterRow>("SELECT * FROM characters WHERE id = ?", [id]);
}

export async function getCharacterOrThrow(id: string): Promise<CharacterRow> {
  const char = await getCharacter(id);
  if (!char) throw new NotFoundError("Character", id);
  return char;
}

export async function createCharacter(
  input: CreateCharacterInput,
): Promise<CharacterRow> {
  const id = input.id || uuid();
  const timestamp = now();

  await query(
    `INSERT INTO characters (
      id, campaign_id, party_id, owner_id,
      name, race, class, level, background, alignment,
      ability_scores, hp, max_hp, temp_hp, ac, speed, proficiency_bonus,
      hit_dice, death_saves, inspiration,
      copper, silver, electrum, gold, platinum,
      status, experience, sheet_data,
      created_at, updated_at, version
    ) VALUES (
      ?, ?, ?, ?,
      ?, ?, ?, ?, ?, ?,
      ?, ?, ?, 0, ?, ?, 2,
      '{}', '{"successes":0,"failures":0}', 0,
      0, 0, 0, 0, 0,
      'alive', 0, ?,
      ?, ?, 1
    )`,
    [
      id,
      input.campaignId,
      input.partyId || null,
      input.ownerId,
      input.name,
      input.race,
      input.class,
      input.level || 1,
      input.background || null,
      input.alignment || null,
      toJson(input.abilityScores),
      input.hp,
      input.maxHp,
      input.ac,
      input.speed || 30,
      toJson(input.sheetData || {}),
      timestamp,
      timestamp,
    ],
  );

  return getCharacterOrThrow(id);
}

export async function updateCharacter(
  id: string,
  input: UpdateCharacterInput,
): Promise<CharacterRow> {
  const updates: string[] = ["updated_at = ?", "version = version + 1"];
  const params: any[] = [now()];

  if (input.name !== undefined) {
    updates.push("name = ?");
    params.push(input.name);
  }
  if (input.partyId !== undefined) {
    updates.push("party_id = ?");
    params.push(input.partyId);
  }
  if (input.level !== undefined) {
    updates.push("level = ?");
    params.push(input.level);
  }
  if (input.hp !== undefined) {
    updates.push("hp = ?");
    params.push(input.hp);
  }
  if (input.maxHp !== undefined) {
    updates.push("max_hp = ?");
    params.push(input.maxHp);
  }
  if (input.tempHp !== undefined) {
    updates.push("temp_hp = ?");
    params.push(input.tempHp);
  }
  if (input.ac !== undefined) {
    updates.push("ac = ?");
    params.push(input.ac);
  }
  if (input.experience !== undefined) {
    updates.push("experience = ?");
    params.push(input.experience);
  }
  if (input.status !== undefined) {
    updates.push("status = ?");
    params.push(input.status);
  }
  if (input.abilityScores !== undefined) {
    updates.push("ability_scores = ?");
    params.push(toJson(input.abilityScores));
  }
  if (input.personality !== undefined) {
    updates.push("personality = ?");
    params.push(input.personality);
  }
  if (input.ideals !== undefined) {
    updates.push("ideals = ?");
    params.push(input.ideals);
  }
  if (input.bonds !== undefined) {
    updates.push("bonds = ?");
    params.push(input.bonds);
  }
  if (input.flaws !== undefined) {
    updates.push("flaws = ?");
    params.push(input.flaws);
  }
  if (input.backstory !== undefined) {
    updates.push("backstory = ?");
    params.push(input.backstory);
  }
  if (input.notes !== undefined) {
    updates.push("notes = ?");
    params.push(input.notes);
  }
  if (input.portraitUrl !== undefined) {
    updates.push("portrait_url = ?");
    params.push(input.portraitUrl);
  }
  if (input.sheetData !== undefined) {
    updates.push("sheet_data = ?");
    params.push(toJson(input.sheetData));
  }

  params.push(id);

  await query(
    `UPDATE characters SET ${updates.join(", ")} WHERE id = ?`,
    params,
  );

  return getCharacterOrThrow(id);
}

export async function deleteCharacter(id: string): Promise<void> {
  await query("DELETE FROM characters WHERE id = ?", [id]);
}

// ============================================
// QUERY OPERATIONS
// ============================================

export async function listCharacters(
  filters: CharacterFilters = {},
  page: number = 1,
  pageSize: number = 20,
): Promise<{ characters: CharacterRow[]; total: number }> {
  const conditions: string[] = [];
  const params: any[] = [];

  if (filters.campaignId) {
    conditions.push("campaign_id = ?");
    params.push(filters.campaignId);
  }
  if (filters.partyId) {
    conditions.push("party_id = ?");
    params.push(filters.partyId);
  }
  if (filters.ownerId) {
    conditions.push("owner_id = ?");
    params.push(filters.ownerId);
  }
  if (filters.status) {
    conditions.push("status = ?");
    params.push(filters.status);
  }
  if (filters.class) {
    conditions.push("class = ?");
    params.push(filters.class);
  }
  if (filters.minLevel) {
    conditions.push("level >= ?");
    params.push(filters.minLevel);
  }
  if (filters.maxLevel) {
    conditions.push("level <= ?");
    params.push(filters.maxLevel);
  }

  const whereClause =
    conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const countResult = await queryOne<{ count: number }>(
    `SELECT COUNT(*) as count FROM characters ${whereClause}`,
    params,
  );

  const offset = (page - 1) * pageSize;
  const characters = await queryAll<CharacterRow>(
    `SELECT * FROM characters ${whereClause}
     ORDER BY name ASC
     LIMIT ? OFFSET ?`,
    [...params, pageSize, offset],
  );

  return { characters, total: countResult?.count || 0 };
}

export async function getPartyCharacters(
  partyId: string,
): Promise<CharacterRow[]> {
  return queryAll<CharacterRow>(
    `SELECT * FROM characters
     WHERE party_id = ? AND status = 'alive'
     ORDER BY name`,
    [partyId],
  );
}

export async function getPlayerCharacters(
  ownerId: string,
  campaignId?: string,
): Promise<CharacterRow[]> {
  if (campaignId) {
    return queryAll<CharacterRow>(
      `SELECT * FROM characters
       WHERE owner_id = ? AND campaign_id = ?
       ORDER BY updated_at DESC`,
      [ownerId, campaignId],
    );
  }
  return queryAll<CharacterRow>(
    `SELECT * FROM characters
     WHERE owner_id = ?
     ORDER BY updated_at DESC`,
    [ownerId],
  );
}

// ============================================
// HP & COMBAT
// ============================================

export async function damageCharacter(
  id: string,
  amount: number,
): Promise<CharacterRow> {
  // First reduce temp HP, then HP
  const char = await getCharacterOrThrow(id);

  let remaining = amount;
  let newTempHp = char.tempHp;
  let newHp = char.hp;

  if (newTempHp > 0) {
    if (remaining <= newTempHp) {
      newTempHp -= remaining;
      remaining = 0;
    } else {
      remaining -= newTempHp;
      newTempHp = 0;
    }
  }

  newHp = Math.max(0, newHp - remaining);

  const status = newHp === 0 ? "unconscious" : "alive";

  await query(
    `UPDATE characters
     SET hp = ?, temp_hp = ?, status = ?, updated_at = ?, version = version + 1
     WHERE id = ?`,
    [newHp, newTempHp, status, now(), id],
  );

  return getCharacterOrThrow(id);
}

export async function healCharacter(
  id: string,
  amount: number,
): Promise<CharacterRow> {
  const char = await getCharacterOrThrow(id);
  const newHp = Math.min(char.maxHp, char.hp + amount);
  const status =
    char.status === "unconscious" && newHp > 0 ? "alive" : char.status;

  await query(
    `UPDATE characters
     SET hp = ?, status = ?, updated_at = ?, version = version + 1
     WHERE id = ?`,
    [newHp, status, now(), id],
  );

  return getCharacterOrThrow(id);
}

export async function addTempHp(
  id: string,
  amount: number,
): Promise<CharacterRow> {
  const char = await getCharacterOrThrow(id);
  // Temp HP doesn't stack, take higher
  const newTempHp = Math.max(char.tempHp, amount);

  await query(
    `UPDATE characters
     SET temp_hp = ?, updated_at = ?, version = version + 1
     WHERE id = ?`,
    [newTempHp, now(), id],
  );

  return getCharacterOrThrow(id);
}

// ============================================
// CURRENCY
// ============================================

export async function addCurrency(
  id: string,
  currency: {
    copper?: number;
    silver?: number;
    electrum?: number;
    gold?: number;
    platinum?: number;
  },
): Promise<CharacterRow> {
  const updates: string[] = ["updated_at = ?", "version = version + 1"];
  const params: any[] = [now()];

  if (currency.copper) {
    updates.push("copper = copper + ?");
    params.push(currency.copper);
  }
  if (currency.silver) {
    updates.push("silver = silver + ?");
    params.push(currency.silver);
  }
  if (currency.electrum) {
    updates.push("electrum = electrum + ?");
    params.push(currency.electrum);
  }
  if (currency.gold) {
    updates.push("gold = gold + ?");
    params.push(currency.gold);
  }
  if (currency.platinum) {
    updates.push("platinum = platinum + ?");
    params.push(currency.platinum);
  }

  params.push(id);

  await query(
    `UPDATE characters SET ${updates.join(", ")} WHERE id = ?`,
    params,
  );

  return getCharacterOrThrow(id);
}

// ============================================
// LEVEL UP
// ============================================

export async function levelUp(
  id: string,
  hpIncrease: number,
  updates?: Partial<UpdateCharacterInput>,
): Promise<CharacterRow> {
  const char = await getCharacterOrThrow(id);

  await query(
    `UPDATE characters SET
      level = level + 1,
      max_hp = max_hp + ?,
      hp = hp + ?,
      proficiency_bonus = CASE
        WHEN level + 1 >= 17 THEN 6
        WHEN level + 1 >= 13 THEN 5
        WHEN level + 1 >= 9 THEN 4
        WHEN level + 1 >= 5 THEN 3
        ELSE 2
      END,
      updated_at = ?,
      version = version + 1
     WHERE id = ?`,
    [hpIncrease, hpIncrease, now(), id],
  );

  if (updates) {
    return updateCharacter(id, updates);
  }

  return getCharacterOrThrow(id);
}

// ============================================
// INVENTORY ITEMS
// ============================================

export interface InventoryItemRow {
  id: string;
  characterId: string;
  name: string;
  type: string;
  quantity: number;
  weight: number;
  value: number;
  equipped: number;
  attuned: number;
  description: string | null;
  properties: string; // JSON
  createdAt: string;
}

export async function getInventory(
  characterId: string,
): Promise<InventoryItemRow[]> {
  return queryAll<InventoryItemRow>(
    `SELECT * FROM inventory_items
     WHERE character_id = ?
     ORDER BY type, name`,
    [characterId],
  );
}

export async function addInventoryItem(
  characterId: string,
  item: {
    name: string;
    type: string;
    quantity?: number;
    weight?: number;
    value?: number;
    description?: string;
    properties?: Record<string, any>;
  },
): Promise<InventoryItemRow> {
  const id = uuid();

  await query(
    `INSERT INTO inventory_items (
      id, character_id, name, type, quantity, weight, value,
      equipped, attuned, description, properties, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, 0, 0, ?, ?, ?)`,
    [
      id,
      characterId,
      item.name,
      item.type,
      item.quantity || 1,
      item.weight || 0,
      item.value || 0,
      item.description || null,
      toJson(item.properties || {}),
      now(),
    ],
  );

  const result = await queryOne<InventoryItemRow>(
    "SELECT * FROM inventory_items WHERE id = ?",
    [id],
  );

  if (!result) throw new Error("Failed to create inventory item");
  return result;
}

export async function removeInventoryItem(itemId: string): Promise<void> {
  await query("DELETE FROM inventory_items WHERE id = ?", [itemId]);
}

export async function updateItemQuantity(
  itemId: string,
  quantity: number,
): Promise<void> {
  if (quantity <= 0) {
    await removeInventoryItem(itemId);
  } else {
    await query("UPDATE inventory_items SET quantity = ? WHERE id = ?", [
      quantity,
      itemId,
    ]);
  }
}

export async function equipItem(
  itemId: string,
  equipped: boolean,
): Promise<void> {
  await query("UPDATE inventory_items SET equipped = ? WHERE id = ?", [
    equipped ? 1 : 0,
    itemId,
  ]);
}

export async function attuneItem(
  itemId: string,
  attuned: boolean,
): Promise<void> {
  await query("UPDATE inventory_items SET attuned = ? WHERE id = ?", [
    attuned ? 1 : 0,
    itemId,
  ]);
}
