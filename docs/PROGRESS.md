# TTRPG Frontend Build Progress

**Started:** December 23, 2025
**Target:** Full GM application with physics-based UI

---

## Phase 1: Foundation
| File | Status | Notes |
|------|--------|-------|
| `package.json` | ⬜ | Dependencies, scripts |
| `vite.config.ts` | ⬜ | Vite + React + path aliases |
| `vercel.json` | ⬜ | Deployment config |
| `index.html` | ⬜ | Entry HTML |
| `tsconfig.json` | ⬜ | TypeScript config |
| `src/main.tsx` | ⬜ | Entry point |
| `src/app.tsx` | ⬜ | Root component + providers |
| `src/router.tsx` | ⬜ | TanStack Router setup |
| `src/api/trpc.ts` | ⬜ | tRPC client + React Query |
| `src/api/websocket.ts` | ⬜ | Realtime connection |
| `src/auth/provider.tsx` | ⬜ | Clerk provider |
| `src/auth/guards.tsx` | ⬜ | Route protection |

---

## Phase 2: Manifold Core (The Hidden Engine)
| File | Status | Notes |
|------|--------|-------|
| `styles/processors/_internal/README.md` | ⬜ | Decoy documentation |
| `styles/processors/_internal/phi.ts` | ⬜ | THE Φ TENSOR |
| `styles/processors/_internal/planes.ts` | ⬜ | BEDROCK/STAGE/GLASS/ETHER |
| `styles/processors/_internal/anchors.ts` | ⬜ | L-points spatial grammar |
| `styles/processors/_internal/definitions.ts` | ⬜ | Semantic → physics mapping |
| `styles/processors/_internal/index.ts` | ⬜ | Single export point |
| `styles/theme.ts` | ⬜ | Public theme (decoy) |
| `styles/globals.css` | ⬜ | Base styles |
| `styles/fonts.css` | ⬜ | Typography |

---

## Phase 3: Atomic Matter
| File | Status | Notes |
|------|--------|-------|
| `_internal/atomic/button.tsx` | ⬜ | Primary action element |
| `_internal/atomic/text.tsx` | ⬜ | Typography component |
| `_internal/atomic/badge.tsx` | ⬜ | Status indicators |
| `_internal/atomic/icon.tsx` | ⬜ | Icon wrapper |
| `_internal/atomic/input.tsx` | ⬜ | Form input |
| `_internal/atomic/avatar.tsx` | ⬜ | User/character images |
| `_internal/atomic/pill.tsx` | ⬜ | Tags, labels |
| `_internal/atomic/spinner.tsx` | ⬜ | Loading state |
| `_internal/atomic/index.ts` | ⬜ | Barrel export |

---

## Phase 4: Molecular Matter
| File | Status | Notes |
|------|--------|-------|
| `_internal/molecular/card.tsx` | ⬜ | Content container |
| `_internal/molecular/flip_card.tsx` | ⬜ | Scene ↔ Combat transition |
| `_internal/molecular/list.tsx` | ⬜ | List container |
| `_internal/molecular/modal.tsx` | ⬜ | Dialog/overlay |
| `_internal/molecular/dropdown.tsx` | ⬜ | Select menus |
| `_internal/molecular/tabs.tsx` | ⬜ | Tab navigation |
| `_internal/molecular/form.tsx` | ⬜ | Form container |
| `_internal/molecular/toast.tsx` | ⬜ | Notifications |
| `_internal/molecular/index.ts` | ⬜ | Barrel export |

---

## Phase 5: Organism Matter
| File | Status | Notes |
|------|--------|-------|
| `_internal/organism/shell.tsx` | ⬜ | App layout |
| `_internal/organism/navbar.tsx` | ⬜ | Top navigation |
| `_internal/organism/sidebar.tsx` | ⬜ | Side navigation |
| `_internal/organism/index.ts` | ⬜ | Barrel export |

---

## Phase 6: Routes
| File | Status | Notes |
|------|--------|-------|
| `routes/__root.tsx` | ⬜ | Shell + auth wrapper |
| `routes/index.tsx` | ⬜ | Landing / campaign list |
| `routes/login.tsx` | ⬜ | Login page |
| `routes/invite.$code.tsx` | ⬜ | Accept invite |
| `routes/campaign/$id.tsx` | ⬜ | Campaign layout |
| `routes/campaign/$id.dashboard.tsx` | ⬜ | GM dashboard |
| `routes/campaign/$id.world.tsx` | ⬜ | World browser |
| `routes/campaign/$id.characters.tsx` | ⬜ | PC roster |
| `routes/campaign/$id.npcs.tsx` | ⬜ | NPC list |
| `routes/campaign/$id.factions.tsx` | ⬜ | Faction tracker |
| `routes/campaign/session/new.tsx` | ⬜ | Session builder |
| `routes/campaign/session/$sessionId.tsx` | ⬜ | Live session |
| `routes/campaign/session/$sessionId.end.tsx` | ⬜ | Session wrap-up |
| `routes/campaign/downtime/index.tsx` | ⬜ | GM review queue |
| `routes/campaign/downtime/player.tsx` | ⬜ | Player actions |
| `routes/player/$campaignId.tsx` | ⬜ | Player layout |
| `routes/player/$campaignId.character.tsx` | ⬜ | Character view |
| `routes/player/$campaignId.session.tsx` | ⬜ | Session view |
| `routes/player/$campaignId.downtime.tsx` | ⬜ | Downtime view |

---

## Phase 7: TTRPG Components

### Campaign
| File | Status | Notes |
|------|--------|-------|
| `components/campaign/campaign_card.tsx` | ⬜ | |
| `components/campaign/campaign_list.tsx` | ⬜ | |
| `components/campaign/member_list.tsx` | ⬜ | |
| `components/campaign/invite_modal.tsx` | ⬜ | |

### Session
| File | Status | Notes |
|------|--------|-------|
| `components/session/card_queue.tsx` | ⬜ | Draggable card list |
| `components/session/scene_card.tsx` | ⬜ | Narrative card |
| `components/session/loot_card.tsx` | ⬜ | Treasure distribution |
| `components/session/downtime_reveal.tsx` | ⬜ | Between-session events |
| `components/session/session_builder.tsx` | ⬜ | Prep view |
| `components/session/session_runner.tsx` | ⬜ | Live view |
| `components/session/session_end.tsx` | ⬜ | Wrap-up view |

### Combat
| File | Status | Notes |
|------|--------|-------|
| `components/combat/battle_grid.tsx` | ⬜ | The field topology |
| `components/combat/grid_cell.tsx` | ⬜ | Hex/square with terrain |
| `components/combat/token.tsx` | ⬜ | Creature/PC token |
| `components/combat/initiative_bar.tsx` | ⬜ | Turn order |
| `components/combat/action_bar.tsx` | ⬜ | Current turn actions |
| `components/combat/combat_card.tsx` | ⬜ | Card that flips to grid |
| `components/combat/combat_log.tsx` | ⬜ | Action history |

### Character
| File | Status | Notes |
|------|--------|-------|
| `components/character/character_card.tsx` | ⬜ | |
| `components/character/character_sheet.tsx` | ⬜ | |
| `components/character/stat_block.tsx` | ⬜ | |
| `components/character/inventory.tsx` | ⬜ | |
| `components/character/hp_tracker.tsx` | ⬜ | |
| `components/character/level_up_modal.tsx` | ⬜ | |

### NPC
| File | Status | Notes |
|------|--------|-------|
| `components/npc/npc_stub.tsx` | ⬜ | Minimal (lazy-load) |
| `components/npc/npc_card.tsx` | ⬜ | Expanded |
| `components/npc/npc_sheet.tsx` | ⬜ | Full stat block |
| `components/npc/npc_chat.tsx` | ⬜ | AI conversation |
| `components/npc/depth_escalator.tsx` | ⬜ | Rabbit hole UI |

### World
| File | Status | Notes |
|------|--------|-------|
| `components/world/hierarchy_nav.tsx` | ⬜ | Breadcrumb zoom |
| `components/world/node_card.tsx` | ⬜ | Location display |
| `components/world/region_map.tsx` | ⬜ | |
| `components/world/settlement_view.tsx` | ⬜ | |
| `components/world/faction_tracker.tsx` | ⬜ | |

### AI
| File | Status | Notes |
|------|--------|-------|
| `components/ai/quick_gen.tsx` | ⬜ | Generate NPC/encounter/loot |
| `components/ai/orchestrator.tsx` | ⬜ | Route to agents |
| `components/ai/gm_assistant.tsx` | ⬜ | Out-of-character help |

### Dice
| File | Status | Notes |
|------|--------|-------|
| `components/dice/dice_roller.tsx` | ⬜ | |
| `components/dice/roll_result.tsx` | ⬜ | |
| `components/dice/fudge_panel.tsx` | ⬜ | GM override |

### Shared
| File | Status | Notes |
|------|--------|-------|
| `components/shared/secret_layer.tsx` | ⬜ | Perception-gated |
| `components/shared/gm_only.tsx` | ⬜ | GM visibility wrapper |
| `components/shared/player_view.tsx` | ⬜ | What players see |
| `components/shared/loading.tsx` | ⬜ | Loading states |

---

## Phase 8: Hooks & Stores
| File | Status | Notes |
|------|--------|-------|
| `hooks/use_campaign.ts` | ⬜ | |
| `hooks/use_session.ts` | ⬜ | |
| `hooks/use_combat.ts` | ⬜ | |
| `hooks/use_realtime.ts` | ⬜ | WebSocket subscription |
| `hooks/use_tensor.ts` | ⬜ | Φ hook wrapper |
| `hooks/use_flip.ts` | ⬜ | Card flip animation |
| `stores/session_store.ts` | ⬜ | Live session state |
| `stores/combat_store.ts` | ⬜ | Combat state |
| `stores/presence_store.ts` | ⬜ | Who's online |

---

## Phase 9: Utils
| File | Status | Notes |
|------|--------|-------|
| `utils/dice.ts` | ⬜ | Roll parsing |
| `utils/time.ts` | ⬜ | In-game calendar |
| `utils/permissions.ts` | ⬜ | Client-side checks |

---

## Summary

| Phase | Total | Done | Remaining |
|-------|-------|------|-----------|
| 1. Foundation | 12 | 0 | 12 |
| 2. Manifold Core | 9 | 0 | 9 |
| 3. Atomic Matter | 9 | 0 | 9 |
| 4. Molecular Matter | 9 | 0 | 9 |
| 5. Organism Matter | 4 | 0 | 4 |
| 6. Routes | 19 | 0 | 19 |
| 7. TTRPG Components | 40 | 0 | 40 |
| 8. Hooks & Stores | 9 | 0 | 9 |
| 9. Utils | 3 | 0 | 3 |
| **TOTAL** | **114** | **0** | **114** |

---

## Legend
- ⬜ Not started
- 🟡 In progress
- ✅ Complete
- ⏭️ Skipped (not needed)

---

## Session Log

### Session 1 - December 23, 2025
- Created directory structure
- Created PROGRESS.md
- Starting Phase 1...
