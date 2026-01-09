/**
 * GENESIS QUERIES
 *
 * Query helpers for fetching UI atoms from the database.
 * Each atom is a seed that precipitates into HTML.
 */

import { queryAll, queryOne, query, now } from '../client';

// ============================================
// TYPES
// ============================================

export interface GenesisAtom {
  id: string;
  seed: string;
  prime: string;
  atom_type: string;
  variant: string;
  label: string | null;
  icon: string | null;
  tooltip: string | null;
  destination_type: string | null;
  destination: string | null;
  destination_params: string;
  physics: string;
  campaign_id: string | null;
  view: string | null;
  parent_id: string | null;
  is_active: number;
  is_disabled: number;
  sort_order: number;
}

export interface GenesisSurface {
  id: string;
  seed: string;
  surface_type: string;
  title: string | null;
  description: string | null;
  layout: string;
  physics: string;
  campaign_id: string | null;
  view: string;
  children_order: string;
}

export interface GenesisView {
  id: string;
  name: string;
  title: string | null;
  root_surface_id: string | null;
  campaign_id: string | null;
  is_template: number;
  is_active: number;
}

// ============================================
// ATOM QUERIES
// ============================================

/**
 * Get all atoms for a view
 */
export async function getAtomsForView(
  view: string,
  campaignId?: string
): Promise<GenesisAtom[]> {
  // Get atoms for this view, including global atoms (view = '*')
  // Campaign-specific atoms override global ones
  const atoms = await queryAll<GenesisAtom>(`
    SELECT * FROM genesis_atoms
    WHERE is_active = 1
      AND (view = ? OR view = '*')
      AND (campaign_id = ? OR campaign_id IS NULL)
    ORDER BY sort_order ASC
  `, [view, campaignId || null]);

  return atoms;
}

/**
 * Get a specific atom by ID
 */
export async function getAtomById(id: string): Promise<GenesisAtom | null> {
  return queryOne<GenesisAtom>('SELECT * FROM genesis_atoms WHERE id = ?', [id]);
}

/**
 * Get atoms by type for a view
 */
export async function getAtomsByType(
  atomType: string,
  view: string,
  campaignId?: string
): Promise<GenesisAtom[]> {
  const atoms = await queryAll<GenesisAtom>(`
    SELECT * FROM genesis_atoms
    WHERE is_active = 1
      AND atom_type = ?
      AND (view = ? OR view = '*')
      AND (campaign_id = ? OR campaign_id IS NULL)
    ORDER BY sort_order ASC
  `, [atomType, view, campaignId || null]);

  return atoms;
}

/**
 * Get child atoms of a parent
 */
export async function getChildAtoms(parentId: string): Promise<GenesisAtom[]> {
  const atoms = await queryAll<GenesisAtom>(`
    SELECT * FROM genesis_atoms
    WHERE is_active = 1 AND parent_id = ?
    ORDER BY sort_order ASC
  `, [parentId]);

  return atoms;
}

// ============================================
// SURFACE QUERIES
// ============================================

/**
 * Get a surface by ID
 */
export async function getSurfaceById(id: string): Promise<GenesisSurface | null> {
  return queryOne<GenesisSurface>('SELECT * FROM genesis_surfaces WHERE id = ?', [id]);
}

/**
 * Get the surface for a view
 */
export async function getSurfaceForView(
  view: string,
  campaignId?: string
): Promise<GenesisSurface | null> {
  // Prefer campaign-specific, fall back to template
  return queryOne<GenesisSurface>(`
    SELECT * FROM genesis_surfaces
    WHERE view = ?
      AND (campaign_id = ? OR campaign_id IS NULL)
    ORDER BY campaign_id DESC NULLS LAST
    LIMIT 1
  `, [view, campaignId || null]);
}

// ============================================
// VIEW QUERIES
// ============================================

/**
 * Get a view definition
 */
export async function getViewByName(
  name: string,
  campaignId?: string
): Promise<GenesisView | null> {
  // Prefer campaign-specific, fall back to template
  return queryOne<GenesisView>(`
    SELECT * FROM genesis_views
    WHERE name = ? AND is_active = 1
      AND (campaign_id = ? OR campaign_id IS NULL)
    ORDER BY campaign_id DESC NULLS LAST
    LIMIT 1
  `, [name, campaignId || null]);
}

// ============================================
// MUTATION HELPERS
// ============================================

/**
 * Create a new atom
 */
export async function createAtom(atom: Omit<GenesisAtom, 'is_active' | 'is_disabled'>): Promise<string> {
  const timestamp = now();

  await query(`
    INSERT INTO genesis_atoms (
      id, seed, prime, atom_type, variant, label, icon, tooltip,
      destination_type, destination, destination_params, physics,
      campaign_id, view, parent_id, is_active, is_disabled, sort_order,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 0, ?, ?, ?)
  `, [
    atom.id,
    atom.seed,
    atom.prime,
    atom.atom_type,
    atom.variant,
    atom.label,
    atom.icon,
    atom.tooltip,
    atom.destination_type,
    atom.destination,
    atom.destination_params,
    atom.physics,
    atom.campaign_id,
    atom.view,
    atom.parent_id,
    atom.sort_order,
    timestamp,
    timestamp
  ]);

  return atom.id;
}

/**
 * Update an atom's variant (e.g., when selecting alignment)
 */
export async function updateAtomVariant(id: string, variant: string): Promise<void> {
  const timestamp = now();

  await query(`
    UPDATE genesis_atoms SET variant = ?, updated_at = ? WHERE id = ?
  `, [variant, timestamp, id]);
}

/**
 * Disable an atom
 */
export async function disableAtom(id: string): Promise<void> {
  const timestamp = now();

  await query(`
    UPDATE genesis_atoms SET is_disabled = 1, updated_at = ? WHERE id = ?
  `, [timestamp, id]);
}
