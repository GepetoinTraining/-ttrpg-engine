// ============================================
// TTRPG ENGINE
// ============================================
//
// A complete TTRPG engine with:
//   - D&D 5e rules (extensible to other systems)
//   - World graph (Spelljammer support!)
//   - Campaign/Party/Character management
//   - Combat system
//   - Downtime/Economy/Faction simulation
//   - AI-powered NPCs
//   - Real-time multiplayer
//

// ============================================
// CORE MODULES
// ============================================

// Engine - Game mechanics
export * from "./engine";

// World - Cosmology and world graph
export * from "./world";

// Middleware - Aggregates, actions, events
export * from "./middleware";

// Auth - Authentication and permissions
export * from "./auth";

// Database - Turso queries
export * from "./db";

// Seeds - Import world data
export * from "./seeds";

// ============================================
// VERSION
// ============================================

export const VERSION = "0.2.0";

// ============================================
// QUICK START
// ============================================
//
// 1. Initialize database:
//    import { runMigrations } from 'ttrpg-engine';
//    await runMigrations();
//
// 2. Create campaign:
//    import { createCampaign, createNode } from 'ttrpg-engine';
//    const campaign = await createCampaign({
//      name: 'Dragon Heist',
//      primaryWorldId: 'faerun-world-id',
//      ownerId: clerkUserId,
//    });
//
// 3. Start session:
//    import { SessionStateAggregate } from 'ttrpg-engine';
//    // Use middleware aggregates for frontend
//
