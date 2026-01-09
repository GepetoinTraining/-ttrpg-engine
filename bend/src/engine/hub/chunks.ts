import {
  Hub,
  HubChunk,
  HubDistrict,
  HubObserverState,
  HubSeed,
  BuildingType,
  DistrictType,
  CHUNK_LOAD_RADIUS,
  MAX_CACHED_CHUNKS,
  HUB_SIZE_CONFIG,
} from './schema';
import {
  SeededRNG,
  generateChunkLayout,
  generateDistrictLayout,
  Lot,
} from './topology';

// ============================================
// CHUNK MANAGER
// ============================================
//
// Observer-local rendering:
// - Only generate chunks the observer can see
// - Pre-generate along predicted trajectory
// - LRU cache for recently visited
// - Cold storage for everything else
//
// The manifold philosophy:
// Each observer sees a locally flat neighborhood.
// The global curvature emerges from stitching.
//

export class ChunkManager {
  private hub: Hub;
  private chunkCache: Map<string, HubChunk> = new Map();
  private accessOrder: string[] = [];  // LRU tracking
  private districtLayout: Map<string, DistrictType>;

  constructor(hub: Hub) {
    this.hub = hub;
    this.districtLayout = generateDistrictLayout(
      hub.size,
      hub.topology,
      hub.seed
    );
  }

  /**
   * Get chunk at position, generating if needed.
   */
  getChunk(x: number, y: number): HubChunk {
    const key = `${x},${y}`;

    if (this.chunkCache.has(key)) {
      // Update LRU
      this.touchCache(key);
      return this.chunkCache.get(key)!;
    }

    // Generate chunk
    const chunk = this.generateChunk(x, y);
    this.cacheChunk(key, chunk);

    return chunk;
  }

  /**
   * Load chunks for an observer.
   * Returns the chunks that should be rendered.
   */
  loadForObserver(observer: HubObserverState): HubChunk[] {
    const loaded: HubChunk[] = [];
    const { currentChunk, trajectory } = observer;

    // 1. Current chunk (always)
    loaded.push(this.getChunk(currentChunk.x, currentChunk.y));

    // 2. Adjacent chunks (8 neighbors)
    for (let dx = -CHUNK_LOAD_RADIUS.adjacent; dx <= CHUNK_LOAD_RADIUS.adjacent; dx++) {
      for (let dy = -CHUNK_LOAD_RADIUS.adjacent; dy <= CHUNK_LOAD_RADIUS.adjacent; dy++) {
        if (dx === 0 && dy === 0) continue;

        const nx = currentChunk.x + dx;
        const ny = currentChunk.y + dy;

        if (this.isValidChunk(nx, ny)) {
          loaded.push(this.getChunk(nx, ny));
        }
      }
    }

    // 3. Trajectory chunks (pre-load predicted path)
    for (const predicted of trajectory) {
      if (predicted.probability > 0.3) {  // Only load likely destinations
        if (this.isValidChunk(predicted.x, predicted.y)) {
          loaded.push(this.getChunk(predicted.x, predicted.y));
        }
      }
    }

    return loaded;
  }

  /**
   * Update observer's trajectory prediction.
   * Uses velocity and destination hints.
   */
  updateTrajectory(
    observer: HubObserverState,
    velocity: { dx: number; dy: number },
    destination?: { x: number; y: number }
  ): HubObserverState {
    const trajectory: Array<{ x: number; y: number; probability: number }> = [];

    const { currentChunk } = observer;

    // Velocity-based prediction
    if (velocity.dx !== 0 || velocity.dy !== 0) {
      const normalizedDx = Math.sign(velocity.dx);
      const normalizedDy = Math.sign(velocity.dy);

      // Predict 3 chunks ahead in direction of travel
      for (let i = 1; i <= 3; i++) {
        const prob = 1 - (i * 0.25);  // Decreasing probability
        trajectory.push({
          x: currentChunk.x + normalizedDx * i,
          y: currentChunk.y + normalizedDy * i,
          probability: prob,
        });
      }
    }

    // Destination-based prediction
    if (destination) {
      const dx = Math.sign(destination.x - currentChunk.x);
      const dy = Math.sign(destination.y - currentChunk.y);

      // Path to destination
      let x = currentChunk.x;
      let y = currentChunk.y;
      let prob = 0.8;

      while ((x !== destination.x || y !== destination.y) && prob > 0.1) {
        if (x !== destination.x) x += dx;
        if (y !== destination.y) y += dy;

        trajectory.push({ x, y, probability: prob });
        prob *= 0.9;
      }
    }

    return { ...observer, trajectory };
  }

  /**
   * Generate a chunk deterministically from seed.
   */
  private generateChunk(x: number, y: number): HubChunk {
    const chunkSeed = `${this.hub.seed}_chunk_${x}_${y}`;
    const rng = new SeededRNG(chunkSeed);

    // Get district for this chunk
    const districtType = this.districtLayout.get(`${x},${y}`) ?? 'residential';
    const district = this.hub.districts.find(d => d.type === districtType);

    // Determine topology (inherit from district or hub)
    const topology = district?.topology ?? this.hub.topology;

    // Generate layout
    const density = this.getDensityForDistrict(districtType);
    const layout = generateChunkLayout(topology, chunkSeed, density);

    // Convert layout to chunk format
    const buildings = this.generateBuildings(layout.lots, districtType, rng);
    const streets = layout.streets.map(s => ({
      id: s.id,
      name: this.generateStreetName(s.type, rng),
      points: s.points,
      width: s.width,
      type: s.type,
      material: this.getStreetMaterial(districtType, s.type, rng),
    }));

    const pois = layout.pois.map((p) => ({
      id: crypto.randomUUID(),
      type: this.getPOIType(districtType, rng),
      name: undefined,
      position: p,
      interactable: rng.next() < 0.5,
      metadata: {},
    }));

    // Edge connections
    const edges = {
      north: this.isValidChunk(x, y - 1) ? `${x},${y - 1}` : undefined,
      south: this.isValidChunk(x, y + 1) ? `${x},${y + 1}` : undefined,
      east: this.isValidChunk(x + 1, y) ? `${x + 1},${y}` : undefined,
      west: this.isValidChunk(x - 1, y) ? `${x - 1},${y}` : undefined,
    };

    return {
      x,
      y,
      hubId: this.hub.worldNodeId,
      districtId: district?.id ?? crypto.randomUUID(),
      districtType,
      topology,
      buildings,
      streets,
      pois,
      edges,
      generatedAt: new Date(),
      seed: chunkSeed,
    };
  }

  /**
   * Generate buildings from lots.
   */
  private generateBuildings(
    lots: Lot[],
    districtType: DistrictType,
    rng: SeededRNG
  ): HubChunk['buildings'] {
    const buildingTypes = this.getBuildingTypesForDistrict(districtType);

    return lots.map(lot => {
      const type = rng.weightedPick(
        buildingTypes.map(b => b.type),
        buildingTypes.map(b => b.weight)
      );

      // Calculate bounding box from vertices
      const minX = Math.min(...lot.vertices.map(v => v.x));
      const maxX = Math.max(...lot.vertices.map(v => v.x));
      const minY = Math.min(...lot.vertices.map(v => v.y));
      const maxY = Math.max(...lot.vertices.map(v => v.y));

      const width = maxX - minX;
      const height = maxY - minY;

      // Building doesn't fill entire lot
      const buildingWidth = width * (0.6 + rng.next() * 0.3);
      const buildingHeight = height * (0.6 + rng.next() * 0.3);

      return {
        id: crypto.randomUUID(),
        type,
        name: this.generateBuildingName(type, rng),
        position: {
          x: lot.center.x - buildingWidth / 2,
          y: lot.center.y - buildingHeight / 2,
        },
        size: { width: buildingWidth, height: buildingHeight },
        rotation: rng.gaussian(0, 5),  // Slight rotation for organic feel
        ownerId: undefined,
        factionId: undefined,
        isOpen: rng.next() > 0.1,
        isAbandoned: rng.next() < 0.05,
        floors: this.getBuildingFloors(type, districtType, rng),
        hasInterior: true,
        interiorSeed: rng.next().toString(),
      };
    });
  }

  /**
   * Get building types appropriate for a district.
   */
  private getBuildingTypesForDistrict(
    district: DistrictType
  ): Array<{ type: BuildingType; weight: number }> {
    const types: Record<DistrictType, Array<{ type: BuildingType; weight: number }>> = {
      center: [
        { type: 'town_hall', weight: 5 },
        { type: 'shop', weight: 20 },
        { type: 'tavern', weight: 10 },
        { type: 'inn', weight: 8 },
        { type: 'temple', weight: 5 },
        { type: 'house', weight: 10 },
      ],
      residential: [
        { type: 'house', weight: 40 },
        { type: 'townhouse', weight: 20 },
        { type: 'apartment', weight: 10 },
        { type: 'hovel', weight: 10 },
        { type: 'shop', weight: 5 },
        { type: 'shrine', weight: 3 },
        { type: 'well', weight: 2 },
      ],
      commercial: [
        { type: 'shop', weight: 30 },
        { type: 'warehouse', weight: 15 },
        { type: 'inn', weight: 10 },
        { type: 'restaurant', weight: 10 },
        { type: 'bank', weight: 5 },
        { type: 'guildhall', weight: 5 },
        { type: 'market_stall', weight: 20 },
      ],
      industrial: [
        { type: 'workshop', weight: 25 },
        { type: 'smithy', weight: 15 },
        { type: 'tannery', weight: 10 },
        { type: 'mill', weight: 10 },
        { type: 'brewery', weight: 10 },
        { type: 'warehouse', weight: 15 },
        { type: 'hovel', weight: 10 },
      ],
      religious: [
        { type: 'temple', weight: 20 },
        { type: 'shrine', weight: 15 },
        { type: 'monastery', weight: 10 },
        { type: 'house', weight: 20 },
        { type: 'library', weight: 5 },
        { type: 'hospital', weight: 5 },
      ],
      administrative: [
        { type: 'town_hall', weight: 15 },
        { type: 'courthouse', weight: 15 },
        { type: 'prison', weight: 10 },
        { type: 'guardhouse', weight: 10 },
        { type: 'barracks', weight: 10 },
        { type: 'townhouse', weight: 15 },
      ],
      noble: [
        { type: 'manor', weight: 30 },
        { type: 'townhouse', weight: 25 },
        { type: 'house', weight: 15 },
        { type: 'stable', weight: 10 },
        { type: 'fountain', weight: 5 },
      ],
      slums: [
        { type: 'hovel', weight: 50 },
        { type: 'house', weight: 20 },
        { type: 'tavern', weight: 10 },
        { type: 'shop', weight: 5 },
        { type: 'well', weight: 5 },
      ],
      docks: [
        { type: 'warehouse', weight: 30 },
        { type: 'dock', weight: 20 },
        { type: 'tavern', weight: 15 },
        { type: 'shop', weight: 10 },
        { type: 'inn', weight: 10 },
        { type: 'hovel', weight: 10 },
      ],
      military: [
        { type: 'barracks', weight: 30 },
        { type: 'guardhouse', weight: 15 },
        { type: 'tower', weight: 15 },
        { type: 'stable', weight: 10 },
        { type: 'smithy', weight: 10 },
        { type: 'wall_section', weight: 10 },
      ],
      academic: [
        { type: 'library', weight: 25 },
        { type: 'school', weight: 20 },
        { type: 'tower', weight: 10 },
        { type: 'townhouse', weight: 20 },
        { type: 'shop', weight: 10 },
      ],
      entertainment: [
        { type: 'tavern', weight: 25 },
        { type: 'theater', weight: 15 },
        { type: 'arena', weight: 10 },
        { type: 'bathhouse', weight: 10 },
        { type: 'inn', weight: 15 },
        { type: 'restaurant', weight: 10 },
      ],
      magical: [
        { type: 'tower', weight: 30 },
        { type: 'shop', weight: 20 },
        { type: 'library', weight: 15 },
        { type: 'townhouse', weight: 15 },
        { type: 'shrine', weight: 10 },
      ],
      foreign: [
        { type: 'shop', weight: 25 },
        { type: 'inn', weight: 20 },
        { type: 'restaurant', weight: 15 },
        { type: 'warehouse', weight: 15 },
        { type: 'house', weight: 15 },
        { type: 'temple', weight: 5 },
      ],
      garden: [
        { type: 'manor', weight: 20 },
        { type: 'fountain', weight: 20 },
        { type: 'shrine', weight: 15 },
        { type: 'stable', weight: 10 },
        { type: 'house', weight: 20 },
      ],
      necropolis: [
        { type: 'shrine', weight: 30 },
        { type: 'temple', weight: 20 },
        { type: 'tower', weight: 15 },
        { type: 'hovel', weight: 10 },  // Gravedigger
        { type: 'wall_section', weight: 15 },
      ],
    };

    return types[district];
  }

  /**
   * Get density factor for a district type.
   */
  private getDensityForDistrict(district: DistrictType): number {
    const densities: Record<DistrictType, number> = {
      center: 0.8,
      residential: 0.6,
      commercial: 0.9,
      industrial: 0.5,
      religious: 0.4,
      administrative: 0.5,
      noble: 0.3,
      slums: 0.9,
      docks: 0.7,
      military: 0.6,
      academic: 0.5,
      entertainment: 0.7,
      magical: 0.4,
      foreign: 0.7,
      garden: 0.2,
      necropolis: 0.3,
    };
    return densities[district];
  }

  /**
   * Get number of floors for a building.
   */
  private getBuildingFloors(
    type: BuildingType,
    district: DistrictType,
    rng: SeededRNG
  ): number {
    const baseFloors: Record<BuildingType, number> = {
      hovel: 1,
      house: 1,
      townhouse: 2,
      manor: 2,
      apartment: 3,
      shop: 1,
      market_stall: 1,
      warehouse: 1,
      inn: 2,
      tavern: 1,
      restaurant: 1,
      bank: 2,
      guildhall: 2,
      smithy: 1,
      tannery: 1,
      mill: 2,
      workshop: 1,
      brewery: 1,
      temple: 1,
      shrine: 1,
      monastery: 2,
      town_hall: 2,
      courthouse: 2,
      prison: 2,
      barracks: 2,
      guardhouse: 1,
      gatehouse: 2,
      tower: 4,
      library: 2,
      school: 2,
      hospital: 2,
      theater: 2,
      arena: 1,
      bathhouse: 1,
      stable: 1,
      dock: 1,
      well: 1,
      fountain: 1,
      bridge: 1,
      wall_section: 2,
    };

    const base = baseFloors[type] ?? 1;

    // District modifiers
    const modifier = district === 'noble' || district === 'center' ? 1 : 0;

    // Random variance
    const variance = rng.next() < 0.3 ? 1 : 0;

    return base + modifier + variance;
  }

  /**
   * Generate a street name.
   */
  private generateStreetName(
    type: 'main' | 'side' | 'alley' | 'path',
    rng: SeededRNG
  ): string | undefined {
    // Only name main and side streets
    if (type === 'alley' || type === 'path') {
      return rng.next() < 0.2 ? 'Back Alley' : undefined;
    }

    const prefixes = [
      'High', 'Low', 'Old', 'New', 'North', 'South', 'East', 'West',
      'King\'s', 'Queen\'s', 'Market', 'Temple', 'Guild', 'Harbor',
      'Castle', 'Mill', 'Copper', 'Silver', 'Gold', 'Iron',
    ];

    const suffixes = [
      'Street', 'Road', 'Way', 'Lane', 'Row', 'Walk', 'Path',
      'Avenue', 'Boulevard', 'Passage', 'Alley',
    ];

    if (rng.next() < 0.7) {
      return `${rng.pick(prefixes)} ${rng.pick(suffixes)}`;
    }
    return undefined;
  }

  /**
   * Get street material based on district and type.
   */
  private getStreetMaterial(
    district: DistrictType,
    type: 'main' | 'side' | 'alley' | 'path',
    rng: SeededRNG
  ): 'cobblestone' | 'dirt' | 'gravel' | 'wooden' {
    // Wealthy districts have better streets
    const wealthy = ['center', 'noble', 'commercial', 'administrative'];
    const poor = ['slums', 'industrial'];

    if (type === 'main') {
      return wealthy.includes(district) ? 'cobblestone' :
             poor.includes(district) ? 'gravel' : 'cobblestone';
    }

    if (type === 'side') {
      return wealthy.includes(district) ? 'cobblestone' :
             poor.includes(district) ? 'dirt' : 'gravel';
    }

    // Alleys and paths
    return rng.next() < 0.5 ? 'dirt' : 'gravel';
  }

  /**
   * Get POI type for a district.
   */
  private getPOIType(district: DistrictType, rng: SeededRNG): string {
    const types: Record<DistrictType, string[]> = {
      center: ['fountain', 'statue', 'market_square', 'bulletin_board'],
      residential: ['well', 'garden', 'bench'],
      commercial: ['market_stall', 'fountain', 'sign'],
      industrial: ['water_pump', 'cart', 'stockpile'],
      religious: ['shrine', 'statue', 'garden'],
      administrative: ['statue', 'fountain', 'pillory'],
      noble: ['fountain', 'statue', 'garden'],
      slums: ['well', 'cart', 'debris'],
      docks: ['crane', 'bollard', 'crate'],
      military: ['weapon_rack', 'training_dummy', 'watchtower'],
      academic: ['statue', 'garden', 'bench'],
      entertainment: ['stage', 'fountain', 'bench'],
      magical: ['obelisk', 'circle', 'statue'],
      foreign: ['shrine', 'market_stall', 'statue'],
      garden: ['fountain', 'bench', 'statue'],
      necropolis: ['grave', 'mausoleum', 'memorial'],
    };

    return rng.pick(types[district]);
  }

  /**
   * Generate a building name.
   */
  private generateBuildingName(type: BuildingType, rng: SeededRNG): string | undefined {
    // Only some buildings get names
    const namedTypes: BuildingType[] = [
      'inn', 'tavern', 'shop', 'guildhall', 'temple', 'theater', 'arena',
      'town_hall', 'tower', 'manor', 'monastery', 'library', 'bank',
    ];

    if (!namedTypes.includes(type)) {
      return undefined;
    }

    if (rng.next() < 0.3) {
      return undefined;  // Not all named buildings have generated names
    }

    // Name generators by type
    if (type === 'inn' || type === 'tavern') {
      const adjectives = [
        'Prancing', 'Dancing', 'Sleeping', 'Laughing', 'Weeping', 'Golden',
        'Silver', 'Red', 'Blue', 'Black', 'White', 'Rusty', 'Broken',
      ];
      const nouns = [
        'Pony', 'Dragon', 'Griffin', 'Lion', 'Bear', 'Stag', 'Boar',
        'Raven', 'Owl', 'Sword', 'Shield', 'Crown', 'Mug', 'Barrel',
      ];
      return `The ${rng.pick(adjectives)} ${rng.pick(nouns)}`;
    }

    if (type === 'shop') {
      const owners = [
        'Grimble', 'Thornwick', 'Ashford', 'Brightwater', 'Ironhand',
        'Silverbell', 'Darkwood', 'Goldleaf', 'Stoneheart', 'Quickfoot',
      ];
      const suffixes = ['& Sons', '& Co.', "'s Goods", "'s Wares", "'s Emporium"];
      return `${rng.pick(owners)}${rng.pick(suffixes)}`;
    }

    return undefined;
  }

  /**
   * Check if chunk coordinates are valid for this hub.
   */
  private isValidChunk(x: number, y: number): boolean {
    return x >= 0 && x < this.hub.chunkGrid.width &&
           y >= 0 && y < this.hub.chunkGrid.height;
  }

  /**
   * Cache management.
   */
  private cacheChunk(key: string, chunk: HubChunk): void {
    this.chunkCache.set(key, chunk);
    this.accessOrder.push(key);

    // Evict if over limit
    while (this.chunkCache.size > MAX_CACHED_CHUNKS) {
      const oldest = this.accessOrder.shift()!;
      this.chunkCache.delete(oldest);
    }
  }

  private touchCache(key: string): void {
    const idx = this.accessOrder.indexOf(key);
    if (idx !== -1) {
      this.accessOrder.splice(idx, 1);
      this.accessOrder.push(key);
    }
  }

  /**
   * Get cache statistics.
   */
  getCacheStats(): { size: number; maxSize: number; keys: string[] } {
    return {
      size: this.chunkCache.size,
      maxSize: MAX_CACHED_CHUNKS,
      keys: [...this.chunkCache.keys()],
    };
  }

  /**
   * Clear cache (for testing or memory pressure).
   */
  clearCache(): void {
    this.chunkCache.clear();
    this.accessOrder = [];
  }
}

// ============================================
// HUB GENERATOR
// ============================================

export class HubGenerator {
  /**
   * Generate a hub from seed.
   */
  static generate(seed: HubSeed, worldNodeId: string): Hub {
    const rng = new SeededRNG(
      `${seed.worldNodeId}_${seed.size}_${seed.topology}_${seed.era}`
    );

    const config = HUB_SIZE_CONFIG[seed.size];

    // Population
    const population = rng.rangeInt(config.minPop, config.maxPop);

    // Grid dimensions
    const chunkCount = rng.rangeInt(config.minChunks, config.maxChunks);
    const gridSize = Math.ceil(Math.sqrt(chunkCount));

    // Generate district layout
    const districtLayout = generateDistrictLayout(seed.size, seed.topology, seed.worldNodeId);

    // Create districts
    const districtsByType = new Map<DistrictType, Array<{ x: number; y: number }>>();
    for (const [coord, type] of districtLayout.entries()) {
      const [x, y] = coord.split(',').map(Number);
      if (!districtsByType.has(type)) {
        districtsByType.set(type, []);
      }
      districtsByType.get(type)!.push({ x, y });
    }

    const districts: HubDistrict[] = [];
    for (const [type, coords] of districtsByType.entries()) {
      districts.push({
        id: crypto.randomUUID(),
        hubId: worldNodeId,
        name: this.generateDistrictName(type, rng),
        type,
        chunkCoords: coords,
        topology: seed.topology,
        population: Math.floor(population * (coords.length / chunkCount)),
        wealthLevel: this.getDistrictWealth(type, rng),
        crimeLevel: this.getDistrictCrime(type, rng),
        factions: [],
        notableLocations: [],
        description: undefined,
        atmosphere: this.getDistrictAtmosphere(type),
        seed: `${seed.worldNodeId}_district_${type}`,
      });
    }

    // Services based on size
    const services = {
      hasTemple: config.minPop >= 200 || rng.next() < 0.3,
      hasInn: true,
      hasTavern: true,
      hasSmith: config.minPop >= 100,
      hasMarket: config.minPop >= 500,
      hasStables: config.minPop >= 200,
      hasBank: config.minPop >= 5000,
      hasMageGuild: config.minPop >= 10000 && rng.next() < 0.5,
      hasThievesGuild: config.minPop >= 2000 && rng.next() < 0.3,
      hasHospital: config.minPop >= 5000,
    };

    // Economy type
    const economyTypes: Array<Hub['economy']['type']> = [
      'agricultural', 'trade', 'craft', 'mining', 'fishing', 'military', 'religious', 'academic'
    ];
    const economyType = rng.pick(economyTypes);

    // Governance
    const governanceTypes: Array<Hub['governance']['type']> =
      seed.size === 'outpost' || seed.size === 'hamlet' ? ['elder', 'none'] :
      seed.size === 'village' ? ['elder', 'council'] :
      seed.size === 'town' ? ['council', 'mayor', 'lord'] :
      ['lord', 'council', 'mayor', 'guild', 'theocratic'];

    return {
      worldNodeId,
      name: '', // Set by caller from WorldNode
      size: seed.size,
      seed: seed.worldNodeId,
      population,
      demographics: { human: 60, dwarf: 15, elf: 10, halfling: 8, other: 7 },
      topology: seed.topology,
      chunkGrid: { width: gridSize, height: gridSize },
      districts,
      keyLocations: {
        entrance: [],
        center: undefined,
        government: undefined,
        temple: undefined,
        market: undefined,
        inn: undefined,
        tavern: undefined,
      },
      defenses: {
        hasWalls: config.hasWalls,
        wallCondition: config.hasWalls ? 'fair' : undefined,
        gateCount: config.hasWalls ? rng.rangeInt(2, 4) : 0,
        hasCastle: config.hasCastle,
        hasMoat: config.hasWalls && rng.next() < 0.3,
        militia: Math.floor(population * 0.05),
        guards: Math.floor(population * 0.02),
      },
      economy: {
        type: economyType,
        wealthLevel: 'modest',
        exports: [],
        imports: [],
        hasMarket: services.hasMarket,
        marketDays: services.hasMarket ? ['Godsday'] : [],
      },
      governance: {
        type: rng.pick(governanceTypes),
        ruler: undefined,
        lawLevel: 'fair',
      },
      services,
      residentNPCs: [],
      visitingNPCs: [],
      state: {
        isUnderAttack: false,
        isPlagued: false,
        isFamine: false,
        isOccupied: false,
        mood: 'neutral',
        currentEvent: undefined,
      },
      cachedChunks: {},
      generatedAt: new Date(),
      version: 1,
    };
  }

  private static generateDistrictName(type: DistrictType, rng: SeededRNG): string {
    const prefixes: Record<DistrictType, string[]> = {
      center: ['Market', 'Town', 'Central', 'Main'],
      residential: ['Hearth', 'Home', 'Gate', 'Hill'],
      commercial: ['Trade', 'Merchant', 'Gold', 'Coin'],
      industrial: ['Forge', 'Hammer', 'Smoke', 'Iron'],
      religious: ['Temple', 'Holy', 'Sacred', 'Divine'],
      administrative: ['Crown', 'Law', 'King\'s', 'Council'],
      noble: ['High', 'Noble', 'Royal', 'Grand'],
      slums: ['Low', 'Shadow', 'Rat', 'Mud'],
      docks: ['Harbor', 'Dock', 'Tide', 'Salt'],
      military: ['Sword', 'Shield', 'Guard', 'Watch'],
      academic: ['Scholar', 'Sage', 'Book', 'Quill'],
      entertainment: ['Revel', 'Merry', 'Song', 'Dance'],
      magical: ['Arcane', 'Mystic', 'Star', 'Moon'],
      foreign: ['Stranger', 'Exotic', 'Far', 'Trade'],
      garden: ['Green', 'Rose', 'Oak', 'Meadow'],
      necropolis: ['Silent', 'Gray', 'Memorial', 'Rest'],
    };

    const suffixes = ['Quarter', 'Ward', 'District', 'Row', 'Square'];

    return `${rng.pick(prefixes[type])} ${rng.pick(suffixes)}`;
  }

  private static getDistrictWealth(
    type: DistrictType,
    _rng: SeededRNG
  ): HubDistrict['wealthLevel'] {
    void _rng; // Reserved for random wealth variation
    const baseWealth: Record<DistrictType, HubDistrict['wealthLevel']> = {
      center: 'comfortable',
      residential: 'modest',
      commercial: 'comfortable',
      industrial: 'poor',
      religious: 'modest',
      administrative: 'comfortable',
      noble: 'wealthy',
      slums: 'destitute',
      docks: 'poor',
      military: 'modest',
      academic: 'modest',
      entertainment: 'modest',
      magical: 'comfortable',
      foreign: 'modest',
      garden: 'wealthy',
      necropolis: 'poor',
    };
    return baseWealth[type];
  }

  private static getDistrictCrime(
    type: DistrictType,
    _rng: SeededRNG
  ): HubDistrict['crimeLevel'] {
    void _rng; // Reserved for random crime variation
    const baseCrime: Record<DistrictType, HubDistrict['crimeLevel']> = {
      center: 'safe',
      residential: 'average',
      commercial: 'average',
      industrial: 'rough',
      religious: 'safe',
      administrative: 'patrolled',
      noble: 'patrolled',
      slums: 'dangerous',
      docks: 'rough',
      military: 'patrolled',
      academic: 'safe',
      entertainment: 'rough',
      magical: 'average',
      foreign: 'rough',
      garden: 'safe',
      necropolis: 'dangerous',
    };
    return baseCrime[type];
  }

  private static getDistrictAtmosphere(type: DistrictType): string {
    const atmospheres: Record<DistrictType, string> = {
      center: 'Bustling with activity, merchants calling their wares',
      residential: 'Quiet streets, children playing, neighbors chatting',
      commercial: 'Crowded markets, haggling voices, clinking coins',
      industrial: 'Smoke and clanging metal, workers covered in soot',
      religious: 'Incense and chanting, pilgrims seeking blessings',
      administrative: 'Stern officials, long queues, rustling parchment',
      noble: 'Manicured gardens, liveried servants, hushed conversations',
      slums: 'Narrow alleys, suspicious eyes, the smell of refuse',
      docks: 'Salt air, creaking ships, rough sailors',
      military: 'Marching boots, clashing steel, shouted orders',
      academic: 'Hushed libraries, debating scholars, ink-stained fingers',
      entertainment: 'Music and laughter, cheap wine, games of chance',
      magical: 'Strange lights, arcane symbols, the crackle of energy',
      foreign: 'Exotic spices, unfamiliar languages, curious wares',
      garden: 'Birdsong, flowing water, the scent of flowers',
      necropolis: 'Silent stone, weeping mourners, the whisper of wind',
    };
    return atmospheres[type];
  }
}
