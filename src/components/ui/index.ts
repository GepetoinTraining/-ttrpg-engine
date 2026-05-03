/**
 * UI primitives — used by the real (non-wireframe) surfaces.
 *
 * The wireframe surfaces under src/components/design/surfaces/ keep
 * importing from their existing locations (./_chips, etc.). New work
 * imports from `@/components/ui` so we have a clean primitive boundary.
 *
 * Mobile-first / flex-only / no fixed widths — see
 * `feedback_responsive_no_fixed_widths.md`.
 */

export { AppShell } from './AppShell'
export { Sidebar, NavSection, NavItem } from './Sidebar'
export { Communicator } from './Communicator'
export type { CommMessage, CommChannel } from './Communicator'
export { Card } from './Card'
export { ModalFrame } from './ModalFrame'
export { CharacterCard } from './CharacterCard'
export type { CharacterCardData } from './CharacterCard'
export { InviteLinkCard } from './InviteLinkCard'
export type { InviteStatus } from './InviteLinkCard'
export { PartyRoster, PartySlot } from './PartyRoster'
export type { PartySlotData } from './PartyRoster'
export { InventoryList } from './InventoryList'
export type { InventoryItem } from './InventoryList'
export { IntentForm } from './IntentForm'
export type { IntentVerb, IntentPayload } from './IntentForm'

// Re-export the existing chips for one-stop ui imports.
export { Chip, EmptyState, FidelityBadge, STATUS_TAGS } from '@/components/design/surfaces/_chips'
