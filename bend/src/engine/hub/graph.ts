import { z } from 'zod';
import {
  HubChunk,
  BuildingType,
} from './schema';

// ============================================
// HUB INTERNAL GRAPH
// ============================================
//
// The hub is a graph of locations connected by paths.
// This enables:
// - NPC pathfinding
// - Player navigation
// - Visibility/awareness calculations
// - Economy flow modeling
//
// NODE TYPES:
// - District (container)
// - Building (specific location)
// - Street (connective tissue)
// - POI (point of interest within street)
//
// EDGE TYPES:
// - CONTAINS (hierarchy)
// - CONNECTS (streets to buildings)
// - ADJACENT (buildings near each other)
// - LEADS_TO (street to street)
//

// ============================================
// HUB NODE TYPES
// ============================================

export const HubNodeTypeSchema = z.enum([
  'district',      // A district (contains buildings, streets)
  'building',      // A specific building
  'street',        // A named street
  'intersection',  // Where streets meet
  'plaza',         // Open area
  'entrance',      // Hub entry point (gate, dock)
  'poi',           // Point of interest
]);
export type HubNodeType = z.infer<typeof HubNodeTypeSchema>;

// ============================================
// HUB NODE
// ============================================

export const HubNodeSchema = z.object({
  id: z.string().uuid(),
  hubId: z.string().uuid(),
  type: HubNodeTypeSchema,

  // Position in hub
  position: z.object({
    chunkX: z.number().int(),
    chunkY: z.number().int(),
    localX: z.number(),  // Within chunk (0-100)
    localY: z.number(),
  }),

  // Type-specific data
  data: z.union([
    // District
    z.object({
      nodeType: z.literal('district'),
      districtId: z.string().uuid(),
      districtType: z.string(),
      name: z.string(),
    }),

    // Building
    z.object({
      nodeType: z.literal('building'),
      buildingType: z.string(),
      name: z.string().optional(),
      ownerId: z.string().uuid().optional(),
      factionId: z.string().uuid().optional(),
      floors: z.number().int().default(1),
      isOpen: z.boolean().default(true),
      hasInterior: z.boolean().default(true),
    }),

    // Street
    z.object({
      nodeType: z.literal('street'),
      name: z.string().optional(),
      streetType: z.enum(['main', 'side', 'alley', 'path']),
      material: z.enum(['cobblestone', 'dirt', 'gravel', 'wooden']),
      width: z.number(),
    }),

    // Intersection
    z.object({
      nodeType: z.literal('intersection'),
      streetNames: z.array(z.string()),
    }),

    // Plaza
    z.object({
      nodeType: z.literal('plaza'),
      name: z.string(),
      features: z.array(z.string()).default([]),
    }),

    // Entrance
    z.object({
      nodeType: z.literal('entrance'),
      name: z.string(),
      entranceType: z.enum(['gate', 'dock', 'road', 'bridge', 'secret']),
      leadsTo: z.string().optional(),  // What's outside
    }),

    // POI
    z.object({
      nodeType: z.literal('poi'),
      poiType: z.string(),
      name: z.string().optional(),
      interactable: z.boolean().default(false),
    }),
  ]),

  // Visibility
  isHidden: z.boolean().default(false),  // Secret locations
  isDiscovered: z.boolean().default(true),  // For fog of war

  // Navigation
  isNavigable: z.boolean().default(true),  // Can NPCs path through?
  movementCost: z.number().default(1),  // Pathfinding weight

  // Metadata
  createdAt: z.date(),
  updatedAt: z.date(),
});
export type HubNode = z.infer<typeof HubNodeSchema>;

// ============================================
// HUB EDGE TYPES
// ============================================

export const HubEdgeTypeSchema = z.enum([
  'CONTAINS',     // Parent contains child (district contains building)
  'CONNECTS',     // Physical connection (street connects to building)
  'ADJACENT',     // Near each other (buildings across the street)
  'LEADS_TO',     // Navigation (street leads to intersection)
  'ENTRANCE',     // Building entrance from street
  'OVERLOOKS',    // Can see from here (upper floors)
  'UNDERGROUND',  // Basement/sewer connection
]);
export type HubEdgeType = z.infer<typeof HubEdgeTypeSchema>;

// ============================================
// HUB EDGE
// ============================================

export const HubEdgeSchema = z.object({
  id: z.string().uuid(),
  hubId: z.string().uuid(),

  sourceId: z.string().uuid(),
  targetId: z.string().uuid(),
  type: HubEdgeTypeSchema,

  // Edge properties
  bidirectional: z.boolean().default(true),

  // Navigation
  distance: z.number().default(1),  // Travel time/cost
  isBlocked: z.boolean().default(false),  // Currently impassable
  blockReason: z.string().optional(),

  // Type-specific data
  properties: z.object({
    // For CONNECTS/ENTRANCE
    doorType: z.enum(['open', 'unlocked', 'locked', 'barred', 'hidden']).optional(),
    lockDC: z.number().int().optional(),

    // For UNDERGROUND
    tunnelType: z.enum(['sewer', 'basement', 'cave', 'secret']).optional(),

    // For OVERLOOKS
    sightlineDistance: z.number().optional(),

    // General
    description: z.string().optional(),
    isHidden: z.boolean().default(false),
  }),

  createdAt: z.date(),
  updatedAt: z.date(),
});
export type HubEdge = z.infer<typeof HubEdgeSchema>;

// ============================================
// HUB GRAPH
// ============================================

export class HubGraph {
  private nodes: Map<string, HubNode> = new Map();
  private edges: Map<string, HubEdge> = new Map();
  private adjacencyList: Map<string, Set<string>> = new Map();
  private reverseAdjacency: Map<string, Set<string>> = new Map();

  constructor(nodes: HubNode[] = [], edges: HubEdge[] = []) {
    for (const node of nodes) {
      this.addNode(node);
    }
    for (const edge of edges) {
      this.addEdge(edge);
    }
  }

  // === NODE OPERATIONS ===

  addNode(node: HubNode): void {
    this.nodes.set(node.id, node);
    if (!this.adjacencyList.has(node.id)) {
      this.adjacencyList.set(node.id, new Set());
    }
    if (!this.reverseAdjacency.has(node.id)) {
      this.reverseAdjacency.set(node.id, new Set());
    }
  }

  getNode(id: string): HubNode | undefined {
    return this.nodes.get(id);
  }

  getNodesByType(type: HubNodeType): HubNode[] {
    return Array.from(this.nodes.values()).filter(n => n.type === type);
  }

  getNodesByChunk(chunkX: number, chunkY: number): HubNode[] {
    return Array.from(this.nodes.values()).filter(
      n => n.position.chunkX === chunkX && n.position.chunkY === chunkY
    );
  }

  // === EDGE OPERATIONS ===

  addEdge(edge: HubEdge): void {
    this.edges.set(edge.id, edge);

    // Forward adjacency
    if (!this.adjacencyList.has(edge.sourceId)) {
      this.adjacencyList.set(edge.sourceId, new Set());
    }
    this.adjacencyList.get(edge.sourceId)!.add(edge.targetId);

    // Reverse adjacency
    if (!this.reverseAdjacency.has(edge.targetId)) {
      this.reverseAdjacency.set(edge.targetId, new Set());
    }
    this.reverseAdjacency.get(edge.targetId)!.add(edge.sourceId);

    // Bidirectional
    if (edge.bidirectional) {
      if (!this.adjacencyList.has(edge.targetId)) {
        this.adjacencyList.set(edge.targetId, new Set());
      }
      this.adjacencyList.get(edge.targetId)!.add(edge.sourceId);

      if (!this.reverseAdjacency.has(edge.sourceId)) {
        this.reverseAdjacency.set(edge.sourceId, new Set());
      }
      this.reverseAdjacency.get(edge.sourceId)!.add(edge.targetId);
    }
  }

  getEdge(id: string): HubEdge | undefined {
    return this.edges.get(id);
  }

  getEdgesBetween(sourceId: string, targetId: string): HubEdge[] {
    return Array.from(this.edges.values()).filter(
      e => (e.sourceId === sourceId && e.targetId === targetId) ||
           (e.bidirectional && e.sourceId === targetId && e.targetId === sourceId)
    );
  }

  getOutgoingEdges(nodeId: string): HubEdge[] {
    return Array.from(this.edges.values()).filter(
      e => e.sourceId === nodeId || (e.bidirectional && e.targetId === nodeId)
    );
  }

  getIncomingEdges(nodeId: string): HubEdge[] {
    return Array.from(this.edges.values()).filter(
      e => e.targetId === nodeId || (e.bidirectional && e.sourceId === nodeId)
    );
  }

  // === TRAVERSAL ===

  getNeighbors(nodeId: string): HubNode[] {
    const neighborIds = this.adjacencyList.get(nodeId) ?? new Set();
    return Array.from(neighborIds)
      .map(id => this.nodes.get(id))
      .filter((n): n is HubNode => n !== undefined);
  }

  getParents(nodeId: string): HubNode[] {
    const parentIds = this.reverseAdjacency.get(nodeId) ?? new Set();
    return Array.from(parentIds)
      .map(id => this.nodes.get(id))
      .filter((n): n is HubNode => n !== undefined);
  }

  /**
   * Get all buildings of a specific type.
   */
  getBuildingsByType(buildingType: BuildingType): HubNode[] {
    return Array.from(this.nodes.values()).filter(n => {
      if (n.type !== 'building') return false;
      const data = n.data as { nodeType: 'building'; buildingType: string };
      return data.buildingType === buildingType;
    });
  }

  /**
   * Find shortest path between two nodes (A* algorithm).
   */
  findPath(startId: string, endId: string): string[] | null {
    const start = this.nodes.get(startId);
    const end = this.nodes.get(endId);

    if (!start || !end) return null;

    // A* implementation
    const openSet = new Set<string>([startId]);
    const cameFrom = new Map<string, string>();

    const gScore = new Map<string, number>();
    gScore.set(startId, 0);

    const fScore = new Map<string, number>();
    fScore.set(startId, this.heuristic(start, end));

    while (openSet.size > 0) {
      // Find node with lowest fScore
      let current = '';
      let lowestF = Infinity;
      for (const nodeId of openSet) {
        const f = fScore.get(nodeId) ?? Infinity;
        if (f < lowestF) {
          lowestF = f;
          current = nodeId;
        }
      }

      if (current === endId) {
        // Reconstruct path
        const path: string[] = [current];
        while (cameFrom.has(current)) {
          current = cameFrom.get(current)!;
          path.unshift(current);
        }
        return path;
      }

      openSet.delete(current);

      void this.nodes.get(current); // currentNode available if needed
      const neighbors = this.adjacencyList.get(current) ?? new Set();

      for (const neighborId of neighbors) {
        const neighbor = this.nodes.get(neighborId);
        if (!neighbor || !neighbor.isNavigable) continue;

        // Check if edge is blocked
        const edges = this.getEdgesBetween(current, neighborId);
        const isBlocked = edges.every(e => e.isBlocked);
        if (isBlocked) continue;

        const edgeWeight = Math.min(...edges.map(e => e.distance));
        const tentativeG = (gScore.get(current) ?? Infinity) + edgeWeight * neighbor.movementCost;

        if (tentativeG < (gScore.get(neighborId) ?? Infinity)) {
          cameFrom.set(neighborId, current);
          gScore.set(neighborId, tentativeG);
          fScore.set(neighborId, tentativeG + this.heuristic(neighbor, end));
          openSet.add(neighborId);
        }
      }
    }

    return null;  // No path found
  }

  private heuristic(a: HubNode, b: HubNode): number {
    // Manhattan distance in chunk space + local space
    const chunkDist = Math.abs(a.position.chunkX - b.position.chunkX) +
                      Math.abs(a.position.chunkY - b.position.chunkY);
    const localDist = Math.hypot(
      (a.position.chunkX * 100 + a.position.localX) - (b.position.chunkX * 100 + b.position.localX),
      (a.position.chunkY * 100 + a.position.localY) - (b.position.chunkY * 100 + b.position.localY)
    );
    return chunkDist * 100 + localDist;
  }

  /**
   * Find all nodes reachable from a starting point within a distance.
   */
  getNodesWithinDistance(startId: string, maxDistance: number): Map<string, number> {
    const distances = new Map<string, number>();
    const visited = new Set<string>();
    const queue: Array<{ nodeId: string; distance: number }> = [{ nodeId: startId, distance: 0 }];

    while (queue.length > 0) {
      const { nodeId, distance } = queue.shift()!;

      if (visited.has(nodeId)) continue;
      if (distance > maxDistance) continue;

      visited.add(nodeId);
      distances.set(nodeId, distance);

      const neighbors = this.adjacencyList.get(nodeId) ?? new Set();
      for (const neighborId of neighbors) {
        if (!visited.has(neighborId)) {
          const neighbor = this.nodes.get(neighborId);
          if (neighbor && neighbor.isNavigable) {
            const edges = this.getEdgesBetween(nodeId, neighborId);
            const edgeWeight = Math.min(...edges.map(e => e.distance));
            queue.push({
              nodeId: neighborId,
              distance: distance + edgeWeight * neighbor.movementCost,
            });
          }
        }
      }
    }

    return distances;
  }

  // === SERIALIZATION ===

  toJSON(): { nodes: HubNode[]; edges: HubEdge[] } {
    return {
      nodes: Array.from(this.nodes.values()),
      edges: Array.from(this.edges.values()),
    };
  }

  static fromJSON(data: { nodes: HubNode[]; edges: HubEdge[] }): HubGraph {
    return new HubGraph(data.nodes, data.edges);
  }
}

// ============================================
// GRAPH BUILDER
// ============================================

export class HubGraphBuilder {
  private hubId: string;
  private nodes: HubNode[] = [];
  private edges: HubEdge[] = [];

  constructor(hubId: string) {
    this.hubId = hubId;
  }

  /**
   * Build graph from hub chunks.
   */
  buildFromChunks(chunks: HubChunk[]): HubGraph {
    // Create nodes for each building and street
    for (const chunk of chunks) {
      this.addChunkNodes(chunk);
    }

    // Create edges within chunks
    for (const chunk of chunks) {
      this.addChunkEdges(chunk);
    }

    // Create edges between chunks
    this.addInterChunkEdges(chunks);

    return new HubGraph(this.nodes, this.edges);
  }

  private addChunkNodes(chunk: HubChunk): void {
    const now = new Date();

    // Buildings
    for (const building of chunk.buildings) {
      this.nodes.push({
        id: building.id,
        hubId: this.hubId,
        type: 'building',
        position: {
          chunkX: chunk.x,
          chunkY: chunk.y,
          localX: building.position.x,
          localY: building.position.y,
        },
        data: {
          nodeType: 'building',
          buildingType: building.type,
          name: building.name,
          ownerId: building.ownerId,
          factionId: building.factionId,
          floors: building.floors,
          isOpen: building.isOpen,
          hasInterior: building.hasInterior,
        },
        isHidden: false,
        isDiscovered: true,
        isNavigable: true,
        movementCost: 1,
        createdAt: now,
        updatedAt: now,
      });
    }

    // Streets (as single nodes representing the street)
    for (const street of chunk.streets) {
      const midPoint = street.points[Math.floor(street.points.length / 2)];
      this.nodes.push({
        id: street.id,
        hubId: this.hubId,
        type: 'street',
        position: {
          chunkX: chunk.x,
          chunkY: chunk.y,
          localX: midPoint.x,
          localY: midPoint.y,
        },
        data: {
          nodeType: 'street',
          name: street.name,
          streetType: street.type,
          material: street.material,
          width: street.width,
        },
        isHidden: false,
        isDiscovered: true,
        isNavigable: true,
        movementCost: 0.5,  // Streets are easier to traverse
        createdAt: now,
        updatedAt: now,
      });
    }

    // POIs
    for (const poi of chunk.pois) {
      this.nodes.push({
        id: poi.id,
        hubId: this.hubId,
        type: 'poi',
        position: {
          chunkX: chunk.x,
          chunkY: chunk.y,
          localX: poi.position.x,
          localY: poi.position.y,
        },
        data: {
          nodeType: 'poi',
          poiType: poi.type,
          name: poi.name,
          interactable: poi.interactable,
        },
        isHidden: false,
        isDiscovered: true,
        isNavigable: true,
        movementCost: 1,
        createdAt: now,
        updatedAt: now,
      });
    }
  }

  private addChunkEdges(chunk: HubChunk): void {
    const now = new Date();

    // Connect buildings to nearest street
    for (const building of chunk.buildings) {
      const nearestStreet = this.findNearestStreet(
        building.position.x,
        building.position.y,
        chunk.streets
      );

      if (nearestStreet) {
        this.edges.push({
          id: crypto.randomUUID(),
          hubId: this.hubId,
          sourceId: nearestStreet.id,
          targetId: building.id,
          type: 'ENTRANCE',
          bidirectional: true,
          distance: 1,
          isBlocked: !building.isOpen,
          blockReason: building.isOpen ? undefined : 'Door is closed',
          properties: {
            doorType: building.isOpen ? 'open' : 'unlocked',
            isHidden: false,
          },
          createdAt: now,
          updatedAt: now,
        });
      }
    }

    // Connect streets to each other
    for (let i = 0; i < chunk.streets.length; i++) {
      for (let j = i + 1; j < chunk.streets.length; j++) {
        const streetA = chunk.streets[i];
        const streetB = chunk.streets[j];

        // Check if streets intersect
        if (this.streetsIntersect(streetA, streetB)) {
          this.edges.push({
            id: crypto.randomUUID(),
            hubId: this.hubId,
            sourceId: streetA.id,
            targetId: streetB.id,
            type: 'LEADS_TO',
            bidirectional: true,
            distance: 0.5,
            isBlocked: false,
            properties: { isHidden: false },
            createdAt: now,
            updatedAt: now,
          });
        }
      }
    }

    // Connect POIs to nearest street
    for (const poi of chunk.pois) {
      const nearestStreet = this.findNearestStreet(
        poi.position.x,
        poi.position.y,
        chunk.streets
      );

      if (nearestStreet) {
        this.edges.push({
          id: crypto.randomUUID(),
          hubId: this.hubId,
          sourceId: nearestStreet.id,
          targetId: poi.id,
          type: 'CONNECTS',
          bidirectional: true,
          distance: 0.5,
          isBlocked: false,
          properties: { isHidden: false },
          createdAt: now,
          updatedAt: now,
        });
      }
    }
  }

  private addInterChunkEdges(chunks: HubChunk[]): void {
    const now = new Date();
    const chunkMap = new Map<string, HubChunk>();

    for (const chunk of chunks) {
      chunkMap.set(`${chunk.x},${chunk.y}`, chunk);
    }

    // Connect streets at chunk boundaries
    for (const chunk of chunks) {
      const neighbors = [
        { dx: 1, dy: 0, edge: 'east' },
        { dx: 0, dy: 1, edge: 'south' },
      ];

      for (const { dx, dy } of neighbors) {
        const neighborKey = `${chunk.x + dx},${chunk.y + dy}`;
        const neighbor = chunkMap.get(neighborKey);

        if (!neighbor) continue;

        // Find streets that reach the boundary
        const boundaryStreets = chunk.streets.filter(s => {
          const lastPoint = s.points[s.points.length - 1];
          if (dx === 1) return lastPoint.x > 90;  // East boundary
          if (dy === 1) return lastPoint.y > 90;  // South boundary
          return false;
        });

        const neighborBoundaryStreets = neighbor.streets.filter(s => {
          const firstPoint = s.points[0];
          if (dx === 1) return firstPoint.x < 10;  // Comes from west
          if (dy === 1) return firstPoint.y < 10;  // Comes from north
          return false;
        });

        // Connect matching streets
        for (const street of boundaryStreets) {
          for (const neighborStreet of neighborBoundaryStreets) {
            // Simple proximity check
            const streetEnd = street.points[street.points.length - 1];
            const neighborStart = neighborStreet.points[0];
            const dist = Math.hypot(
              (dx === 1 ? 100 - streetEnd.x + neighborStart.x : streetEnd.x - neighborStart.x),
              (dy === 1 ? 100 - streetEnd.y + neighborStart.y : streetEnd.y - neighborStart.y)
            );

            if (dist < 20) {  // Close enough to connect
              this.edges.push({
                id: crypto.randomUUID(),
                hubId: this.hubId,
                sourceId: street.id,
                targetId: neighborStreet.id,
                type: 'LEADS_TO',
                bidirectional: true,
                distance: 1,
                isBlocked: false,
                properties: { isHidden: false },
                createdAt: now,
                updatedAt: now,
              });
            }
          }
        }
      }
    }
  }

  private findNearestStreet(
    x: number,
    y: number,
    streets: HubChunk['streets']
  ): HubChunk['streets'][0] | null {
    let nearest: HubChunk['streets'][0] | null = null;
    let minDist = Infinity;

    for (const street of streets) {
      for (const point of street.points) {
        const dist = Math.hypot(x - point.x, y - point.y);
        if (dist < minDist) {
          minDist = dist;
          nearest = street;
        }
      }
    }

    return nearest;
  }

  private streetsIntersect(
    a: HubChunk['streets'][0],
    b: HubChunk['streets'][0]
  ): boolean {
    // Simplified: check if any points are within threshold
    const threshold = 10;

    for (const pointA of a.points) {
      for (const pointB of b.points) {
        const dist = Math.hypot(pointA.x - pointB.x, pointA.y - pointB.y);
        if (dist < threshold) {
          return true;
        }
      }
    }

    return false;
  }
}
