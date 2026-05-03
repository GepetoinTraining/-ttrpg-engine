// @ts-nocheck
'use client'

/**
 * surfaces/Dungeon.tsx — Dungeon viewer surface (#26).
 *
 * Mounts the full DungeonShell from the design package port. The shell does
 * the heavy lifting: 3 view modes (exploration / corridor / combat),
 * minimap with room-shape variants, context menus that emit engine actions,
 * party HP strip, character sheet / inventory / rest modals.
 *
 * Engine integration: the shell reads from `useWorld()` and emits
 * `applyIntent` calls for tile/door/chest interactions. Combat uses our
 * `MMScene` with mob-ai (no iframe). State is derived from engine TPB
 * replay, not React state.
 */

import DungeonShell from '../dungeon/DungeonShell'

export default function Dungeon() {
  return <DungeonShell />
}
