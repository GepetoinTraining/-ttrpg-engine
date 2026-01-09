// ============================================
// FACTION CONTROL LAYER
// ============================================
//
// THE ECONOMY IS NOT FREE.
//
// This layer sits above the economic simulation.
// Factions shape trade through:
//   - Taxes, tariffs, tolls
//   - Embargoes and blockades
//   - Monopolies and price controls
//   - Corruption and protection rackets
//
// And where there's control, there's resistance:
//   - Black markets for banned goods
//   - Smuggling routes to evade tariffs
//   - Corrupt officials for sale
//   - Crackdowns and heat
//
// This is where players can:
//   - Exploit the black market
//   - Bribe officials
//   - Smuggle goods
//   - Break monopolies
//   - Or enforce faction will
//

// Core schemas
export * from "./control";

// Communication & messaging
export * from "./communication";
export * from "./communication-engine";

// Governors & local politics
export * from "./governor";
export * from "./governor-engine";

// Network topology
export * from "./network";
export * from "./network-engine";

// Control engine
export * from "./engine";
