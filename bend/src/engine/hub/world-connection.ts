import { z } from 'zod';

// ============================================
// HUB ↔ WORLD GRAPH CONNECTION
// ============================================
//
// Philosophy: ENTRANCES ARE PORTALS TO THE WORLD
//
// A hub (settlement) exists as both:
//   1. A WorldNode in the world graph (macro view)
//   2. A detailed internal graph with streets/buildings (micro view)
//
// The connection point is the ENTRANCE:
//   - Gates connect to roads
//   - Docks connect to sea/river routes
//   - Bridges connect to crossings
//
// When a party leaves through an entrance, they step onto a route.
// When they arrive at a hub, they enter through an entrance.
//
// This enables:
//   - Caravan arrival at specific docks/gates
//   - Gate closures blocking specific routes
//   - Ambushes just outside specific gates
//   - "Meet me at the East Gate" actually means something
//

// ============================================
// WORLD ROUTE (Connection between WorldNodes)
// ============================================

export const WorldRouteTypeSchema = z.enum([
  'road',           // Maintained road
  'trail',          // Footpath/animal trail
  'river',          // River travel
  'sea',            // Ocean/coastal
  'mountain_pass',  // Through mountains
  'underground',    // Underdark passage
  'portal',         // Magical connection
  'air',            // Flying route
]);
export type WorldRouteType = z.infer<typeof WorldRouteTypeSchema>;

export const WorldRouteSchema = z.object({
  id: z.string().uuid(),
  campaignId: z.string().uuid(),

  // Identity
  name: z.string(),                      // "The High Road", "Sword Coast Way"
  type: WorldRouteTypeSchema,

  // Endpoints (WorldNode IDs - can be hubs, POIs, or regions)
  fromNodeId: z.string().uuid(),
  fromNodeName: z.string(),
  fromNodeType: z.enum(['hub', 'poi', 'region', 'landmark']),

  toNodeId: z.string().uuid(),
  toNodeName: z.string(),
  toNodeType: z.enum(['hub', 'poi', 'region', 'landmark']),

  // Physical properties
  distance: z.number(),                  // Miles
  terrain: z.array(z.string()).default([]), // ["forest", "hills", "river_crossing"]
  quality: z.enum(['excellent', 'good', 'fair', 'poor', 'terrible']).default('fair'),

  // Travel
  travelDays: z.object({
    foot: z.number(),
    mounted: z.number(),
    wagon: z.number(),
    ship: z.number().optional(),
  }),

  // Safety
  dangerLevel: z.number().int().min(0).max(10).default(3),
  dangerSources: z.array(z.string()).default([]),  // ["bandits", "wolves", "goblin_raids"]
  patrolledBy: z.string().uuid().optional(),        // Faction that patrols

  // Status
  status: z.enum(['open', 'dangerous', 'blocked', 'destroyed']).default('open'),
  blockReason: z.string().optional(),
  blockedBy: z.string().uuid().optional(),          // POI or faction blocking it

  // Trade route integration
  tradeRouteIds: z.array(z.string().uuid()).default([]),  // TradeRouteProgram IDs using this

  // Waypoints (POIs or landmarks along the route)
  waypoints: z.array(z.object({
    nodeId: z.string().uuid(),
    nodeName: z.string(),
    distanceFromStart: z.number(),        // Miles from start
    isOptional: z.boolean().default(false), // Can be bypassed
  })).default([]),

  // Tolls
  tolls: z.array(z.object({
    locationId: z.string().uuid(),
    locationName: z.string(),
    amount: z.number(),
    collectedBy: z.string().uuid(),       // Faction
  })).default([]),

  createdAt: z.string(),
  updatedAt: z.string(),
});
export type WorldRoute = z.infer<typeof WorldRouteSchema>;

// ============================================
// ENTRANCE ↔ ROUTE CONNECTION
// ============================================

export const EntranceConnectionSchema = z.object({
  id: z.string().uuid(),

  // The hub this entrance belongs to
  hubId: z.string().uuid(),

  // The entrance node within the hub
  entranceNodeId: z.string().uuid(),
  entranceName: z.string(),               // "East Gate", "Harbor Dock 3"
  entranceType: z.enum(['gate', 'dock', 'road', 'bridge', 'secret']),

  // The world route this entrance connects to
  worldRouteId: z.string().uuid(),
  worldRouteName: z.string(),

  // Direction on the route (which way does this entrance face?)
  routeDirection: z.enum(['start', 'end', 'waypoint']),

  // If waypoint, distance along route
  waypointDistance: z.number().optional(),

  // Status (entrance can be closed even if route is open)
  status: z.enum(['open', 'closed', 'guarded', 'blocked', 'destroyed']).default('open'),
  closeReason: z.string().optional(),

  // Access control
  access: z.object({
    requiresPermit: z.boolean().default(false),
    permitIssuedBy: z.string().uuid().optional(),
    tollAmount: z.number().default(0),
    hoursOpen: z.object({
      from: z.number().int().min(0).max(23),  // 6 = 6am
      to: z.number().int().min(0).max(23),    // 22 = 10pm
    }).optional(),
    closedAtNight: z.boolean().default(false),
  }),

  // Guard presence
  guards: z.object({
    count: z.number().int().default(0),
    factionId: z.string().uuid().optional(),
    alertLevel: z.enum(['relaxed', 'normal', 'heightened', 'lockdown']).default('normal'),
  }),

  // Traffic (for simulation)
  traffic: z.object({
    averageDaily: z.number().int().default(0),  // People/day
    caravanFrequency: z.number().default(0),    // Caravans/week
    isMainEntrance: z.boolean().default(false),
  }),

  createdAt: z.string(),
  updatedAt: z.string(),
});
export type EntranceConnection = z.infer<typeof EntranceConnectionSchema>;

// ============================================
// HUB WORLD INTERFACE
// ============================================
//
// Aggregates all connections for a hub
//

export const HubWorldInterfaceSchema = z.object({
  hubId: z.string().uuid(),
  worldNodeId: z.string().uuid(),         // Hub's position in world graph

  // All entrance connections
  entrances: z.array(EntranceConnectionSchema),

  // Routes that pass through or terminate here
  connectedRoutes: z.array(z.object({
    routeId: z.string().uuid(),
    routeName: z.string(),
    routeType: WorldRouteTypeSchema,
    relationship: z.enum(['terminus', 'waypoint']),
    entranceIds: z.array(z.string().uuid()),  // Which entrances connect to this route
  })),

  // Summary stats
  stats: z.object({
    totalEntrances: z.number().int(),
    openEntrances: z.number().int(),
    connectedRoutes: z.number().int(),
    dailyTraffic: z.number().int(),
    weeklyCaravans: z.number(),
  }),

  updatedAt: z.string(),
});
export type HubWorldInterface = z.infer<typeof HubWorldInterfaceSchema>;

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Find which entrance to use for a given route.
 */
export function findEntranceForRoute(
  hubInterface: HubWorldInterface,
  routeId: string,
): EntranceConnection | undefined {
  const routeInfo = hubInterface.connectedRoutes.find(r => r.routeId === routeId);
  if (!routeInfo || routeInfo.entranceIds.length === 0) return undefined;

  // Find the first open entrance for this route
  for (const entranceId of routeInfo.entranceIds) {
    const entrance = hubInterface.entrances.find(e => e.id === entranceId);
    if (entrance && entrance.status === 'open') {
      return entrance;
    }
  }

  // All entrances closed - return first one anyway (caller handles closed state)
  const entranceId = routeInfo.entranceIds[0];
  return hubInterface.entrances.find(e => e.id === entranceId);
}

/**
 * Check if a hub is accessible from a route.
 */
export function canEnterHub(
  hubInterface: HubWorldInterface,
  routeId: string,
  currentHour: number,
): { canEnter: boolean; reason?: string; entrance?: EntranceConnection } {
  const entrance = findEntranceForRoute(hubInterface, routeId);

  if (!entrance) {
    return { canEnter: false, reason: 'No entrance connects to this route' };
  }

  if (entrance.status === 'destroyed') {
    return { canEnter: false, reason: `${entrance.entranceName} has been destroyed`, entrance };
  }

  if (entrance.status === 'blocked') {
    return { canEnter: false, reason: entrance.closeReason ?? `${entrance.entranceName} is blocked`, entrance };
  }

  if (entrance.status === 'closed') {
    return { canEnter: false, reason: entrance.closeReason ?? `${entrance.entranceName} is closed`, entrance };
  }

  // Check hours
  if (entrance.access.hoursOpen) {
    const { from, to } = entrance.access.hoursOpen;
    const isOpen = from <= to
      ? (currentHour >= from && currentHour < to)
      : (currentHour >= from || currentHour < to);  // Wraps midnight

    if (!isOpen) {
      return {
        canEnter: false,
        reason: `${entrance.entranceName} is closed (opens at ${from}:00)`,
        entrance,
      };
    }
  }

  if (entrance.access.closedAtNight && (currentHour < 6 || currentHour >= 22)) {
    return {
      canEnter: false,
      reason: `${entrance.entranceName} is closed at night`,
      entrance,
    };
  }

  return { canEnter: true, entrance };
}

/**
 * Get total toll for entering a hub via a route.
 */
export function calculateEntryToll(
  hubInterface: HubWorldInterface,
  routeId: string,
): number {
  const entrance = findEntranceForRoute(hubInterface, routeId);
  return entrance?.access.tollAmount ?? 0;
}

/**
 * Build a hub world interface from routes and entrance data.
 */
export function buildHubWorldInterface(
  hubId: string,
  worldNodeId: string,
  entrances: EntranceConnection[],
  routes: WorldRoute[],
): HubWorldInterface {
  // Find routes that connect to this hub
  const connectedRoutes = routes
    .filter(r => r.fromNodeId === worldNodeId || r.toNodeId === worldNodeId ||
                 r.waypoints.some(w => w.nodeId === worldNodeId))
    .map(route => {
      const relationship = (route.fromNodeId === worldNodeId || route.toNodeId === worldNodeId)
        ? 'terminus' as const
        : 'waypoint' as const;

      // Find entrances that connect to this route
      const entranceIds = entrances
        .filter(e => e.worldRouteId === route.id)
        .map(e => e.id);

      return {
        routeId: route.id,
        routeName: route.name,
        routeType: route.type,
        relationship,
        entranceIds,
      };
    });

  // Calculate stats
  const openEntrances = entrances.filter(e => e.status === 'open').length;
  const dailyTraffic = entrances.reduce((sum, e) => sum + e.traffic.averageDaily, 0);
  const weeklyCaravans = entrances.reduce((sum, e) => sum + e.traffic.caravanFrequency, 0);

  return {
    hubId,
    worldNodeId,
    entrances,
    connectedRoutes,
    stats: {
      totalEntrances: entrances.length,
      openEntrances,
      connectedRoutes: connectedRoutes.length,
      dailyTraffic,
      weeklyCaravans,
    },
    updatedAt: new Date().toISOString(),
  };
}

/**
 * When a caravan arrives, determine which entrance it uses.
 */
export function getCaravanArrivalEntrance(
  hubInterface: HubWorldInterface,
  routeId: string,
  cargoType: 'land' | 'sea' | 'river',
): EntranceConnection | undefined {
  const routeInfo = hubInterface.connectedRoutes.find(r => r.routeId === routeId);
  if (!routeInfo) return undefined;

  // Filter entrances by cargo type
  const validTypes: EntranceConnection['entranceType'][] =
    cargoType === 'land' ? ['gate', 'road', 'bridge'] :
    cargoType === 'sea' ? ['dock'] :
    cargoType === 'river' ? ['dock', 'bridge'] : ['gate'];

  for (const entranceId of routeInfo.entranceIds) {
    const entrance = hubInterface.entrances.find(e => e.id === entranceId);
    if (entrance && validTypes.includes(entrance.entranceType) && entrance.status === 'open') {
      return entrance;
    }
  }

  return undefined;
}
