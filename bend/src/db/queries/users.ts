import { query, queryOne, now } from "../client";

// ============================================
// USER QUERIES
// ============================================

export interface User {
  id: string;          // This IS the Clerk ID
  email: string;
  username: string | null;
  displayName: string | null;
  imageUrl: string | null;
  pronouns: string | null;
  timezone: string | null;
  preferences: UserPreferences;
  stats: Record<string, any>;
  systemRole: "user" | "admin" | "moderator";
  isPremium: boolean;
  createdAt: string;
  updatedAt: string;
  lastActiveAt: string | null;
}

export interface UserPreferences {
  preferredRole?: "player" | "gm" | "both";
  onboardingComplete?: boolean;
  theme?: string;
  [key: string]: any;
}

/**
 * Get user by ID (which is the Clerk ID)
 */
export async function getUserByClerkId(clerkId: string): Promise<User | null> {
  const row = await queryOne<any>(
    `SELECT * FROM users WHERE id = ?`,
    [clerkId]
  );
  return row ? rowToUser(row) : null;
}

/**
 * Alias for getUserByClerkId
 */
export async function getUser(id: string): Promise<User | null> {
  return getUserByClerkId(id);
}

/**
 * Ensure user exists in database (upsert)
 * Call this after Clerk auth to sync user to DB
 */
export async function ensureUser(clerkUser: {
  id: string;        // Clerk user ID (sub)
  email?: string;
  displayName?: string;
  avatarUrl?: string;
}): Promise<User> {
  const existing = await getUserByClerkId(clerkUser.id);

  if (existing) {
    // Update if email/name changed
    if (
      clerkUser.email !== existing.email ||
      clerkUser.displayName !== existing.displayName ||
      clerkUser.avatarUrl !== existing.imageUrl
    ) {
      await query(
        `UPDATE users SET
          email = COALESCE(?, email),
          display_name = COALESCE(?, display_name),
          image_url = COALESCE(?, image_url),
          updated_at = ?,
          last_active_at = ?
         WHERE id = ?`,
        [
          clerkUser.email ?? null,
          clerkUser.displayName ?? null,
          clerkUser.avatarUrl ?? null,
          now(),
          now(),
          clerkUser.id,
        ]
      );
      // Return updated user
      return (await getUserByClerkId(clerkUser.id))!;
    }
    return existing;
  }

  // Create new user
  await query(
    `INSERT INTO users (id, email, display_name, image_url, preferences, stats, system_role, is_premium, created_at, updated_at, last_active_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      clerkUser.id,
      clerkUser.email || "",
      clerkUser.displayName || null,
      clerkUser.avatarUrl || null,
      JSON.stringify({ onboardingComplete: false }),
      JSON.stringify({}),
      "user",
      0,
      now(),
      now(),
      now(),
    ]
  );

  return (await getUserByClerkId(clerkUser.id))!;
}

/**
 * Update user profile
 */
export async function updateUser(
  userId: string,
  data: {
    displayName?: string;
    pronouns?: string;
    timezone?: string;
    preferredRole?: "player" | "gm" | "both";
    onboardingComplete?: boolean;
  }
): Promise<User | null> {
  const user = await getUserByClerkId(userId);
  if (!user) return null;

  const sets: string[] = [];
  const params: any[] = [];

  if (data.displayName !== undefined) {
    sets.push("display_name = ?");
    params.push(data.displayName);
  }
  if (data.pronouns !== undefined) {
    sets.push("pronouns = ?");
    params.push(data.pronouns);
  }
  if (data.timezone !== undefined) {
    sets.push("timezone = ?");
    params.push(data.timezone);
  }

  // Handle preferences JSON update
  if (data.preferredRole !== undefined || data.onboardingComplete !== undefined) {
    const newPrefs = { ...user.preferences };
    if (data.preferredRole !== undefined) {
      newPrefs.preferredRole = data.preferredRole;
    }
    if (data.onboardingComplete !== undefined) {
      newPrefs.onboardingComplete = data.onboardingComplete;
    }
    sets.push("preferences = ?");
    params.push(JSON.stringify(newPrefs));
  }

  if (sets.length === 0) {
    return user;
  }

  sets.push("updated_at = ?");
  params.push(now());
  params.push(userId);

  await query(`UPDATE users SET ${sets.join(", ")} WHERE id = ?`, params);

  return getUserByClerkId(userId);
}

/**
 * Check if user needs onboarding
 */
export async function needsOnboarding(userId: string): Promise<boolean> {
  const user = await getUserByClerkId(userId);
  if (!user) return true;
  return !user.preferences.onboardingComplete;
}

/**
 * Convert DB row to User
 */
function rowToUser(row: any): User {
  let preferences: UserPreferences = {};
  let stats: Record<string, any> = {};

  try {
    preferences = typeof row.preferences === 'string'
      ? JSON.parse(row.preferences)
      : (row.preferences || {});
  } catch {
    preferences = {};
  }

  try {
    stats = typeof row.stats === 'string'
      ? JSON.parse(row.stats)
      : (row.stats || {});
  } catch {
    stats = {};
  }

  return {
    id: row.id,
    email: row.email || "",
    username: row.username || null,
    displayName: row.display_name || null,
    imageUrl: row.image_url || null,
    pronouns: row.pronouns || null,
    timezone: row.timezone || null,
    preferences,
    stats,
    systemRole: row.system_role || "user",
    isPremium: row.is_premium === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastActiveAt: row.last_active_at || null,
  };
}
