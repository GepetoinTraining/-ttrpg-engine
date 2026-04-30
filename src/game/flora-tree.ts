/**
 * FLORA — Tree Generator
 * ========================
 * 
 * Procedural tree sprite renderer from seed.
 * Each tree is unique but shares species characteristics.
 * 
 * Architecture:
 *   seed → species selection → component generation → canvas render
 *   
 * Components: roots → trunk → branches → foliage → shadow
 * 
 * Only interacted/changed trees create a worldDelta in DB.
 * Everything else is pure computation from seed.
 */

// ─── Seeded RNG (same as topology.ts) ───

class TreeRNG {
  private seed: number

  constructor(seed: string) {
    let h = 0x811c9dc5
    for (let i = 0; i < seed.length; i++) {
      h ^= seed.charCodeAt(i)
      h = Math.imul(h, 0x01000193)
    }
    this.seed = h >>> 0
  }

  next(): number {
    this.seed = (this.seed * 1664525 + 1013904223) % 4294967296
    return this.seed / 4294967296
  }

  range(min: number, max: number): number {
    return min + this.next() * (max - min)
  }

  rangeInt(min: number, max: number): number {
    return Math.floor(this.range(min, max + 1))
  }

  gaussian(mean: number = 0, stddev: number = 1): number {
    const u1 = this.next()
    const u2 = this.next()
    const z0 = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2)
    return mean + z0 * stddev
  }

  pick<T>(arr: T[]): T {
    return arr[Math.floor(this.next() * arr.length)]
  }
}

// ─── Species Definitions ───

export type TrunkStyle = 'straight' | 'curved' | 'twisted' | 'split'
export type CanopyShape = 'round' | 'conical' | 'umbrella' | 'weeping' | 'irregular' | 'columnar'

export interface TreeSpecies {
  id: string               // matches regionFeatures entity
  trunkStyle: TrunkStyle
  canopyShape: CanopyShape
  heightRange: [number, number]  // min/max height in px (before zoom)
  trunkWidthRatio: number  // trunk width as fraction of height
  branchDensity: number    // 0-1
  leafPalette: string[]    // canopy color options
  trunkColor: string       // bark color
  hasRoots: boolean        // visible surface roots
  canopySpread: number     // width relative to height (1.0 = as wide as tall)
}

/** Species table — keyed to regionFeatures.ts flora entities */
const SPECIES: Record<string, TreeSpecies> = {
  // Forest biome
  oak_tree: {
    id: 'oak_tree',
    trunkStyle: 'curved',
    canopyShape: 'round',
    heightRange: [28, 45],
    trunkWidthRatio: 0.12,
    branchDensity: 0.7,
    leafPalette: ['#2d5a27', '#3a6e32', '#4a7e3a', '#2a5020'],
    trunkColor: '#4a3520',
    hasRoots: true,
    canopySpread: 1.3,
  },
  pine_tree: {
    id: 'pine_tree',
    trunkStyle: 'straight',
    canopyShape: 'conical',
    heightRange: [30, 50],
    trunkWidthRatio: 0.06,
    branchDensity: 0.8,
    leafPalette: ['#1a4420', '#224d28', '#1d3d1d', '#2a5a2a'],
    trunkColor: '#5a3a20',
    hasRoots: false,
    canopySpread: 0.5,
  },
  birch_tree: {
    id: 'birch_tree',
    trunkStyle: 'straight',
    canopyShape: 'irregular',
    heightRange: [25, 40],
    trunkWidthRatio: 0.05,
    branchDensity: 0.4,
    leafPalette: ['#5a8a3a', '#6a9a4a', '#7aaa5a', '#4a7a2a'],
    trunkColor: '#d4cfc8',  // white bark
    hasRoots: false,
    canopySpread: 0.8,
  },

  // Dense forest
  ancient_oak: {
    id: 'ancient_oak',
    trunkStyle: 'twisted',
    canopyShape: 'round',
    heightRange: [45, 65],
    trunkWidthRatio: 0.18,
    branchDensity: 0.9,
    leafPalette: ['#1d4a17', '#2a5a20', '#1a3a12', '#305a28'],
    trunkColor: '#3a2a15',
    hasRoots: true,
    canopySpread: 1.6,
  },

  // Swamp
  willow_tree: {
    id: 'willow_tree',
    trunkStyle: 'curved',
    canopyShape: 'weeping',
    heightRange: [25, 40],
    trunkWidthRatio: 0.08,
    branchDensity: 0.6,
    leafPalette: ['#4a7a3a', '#5a8a4a', '#3a6a2a', '#6a9a5a'],
    trunkColor: '#4a4030',
    hasRoots: true,
    canopySpread: 1.4,
  },

  // Hills
  hawthorn: {
    id: 'hawthorn',
    trunkStyle: 'split',
    canopyShape: 'round',
    heightRange: [15, 25],
    trunkWidthRatio: 0.1,
    branchDensity: 0.8,
    leafPalette: ['#3a6a30', '#4a7a3a', '#5a7a40', '#3a5a28'],
    trunkColor: '#5a4030',
    hasRoots: false,
    canopySpread: 1.2,
  },

  // Mountains
  mountain_pine: {
    id: 'mountain_pine',
    trunkStyle: 'curved',   // wind-bent
    canopyShape: 'conical',
    heightRange: [20, 35],
    trunkWidthRatio: 0.06,
    branchDensity: 0.5,
    leafPalette: ['#1a3a1a', '#2a4a2a', '#1a3020'],
    trunkColor: '#5a3a20',
    hasRoots: false,
    canopySpread: 0.4,
  },
}

/** Fallback species for unknown flora entities */
const DEFAULT_SPECIES: TreeSpecies = {
  id: 'generic_tree',
  trunkStyle: 'straight',
  canopyShape: 'round',
  heightRange: [20, 35],
  trunkWidthRatio: 0.08,
  branchDensity: 0.5,
  leafPalette: ['#3a6a30', '#4a7a3a'],
  trunkColor: '#5a4030',
  hasRoots: false,
  canopySpread: 1.0,
}

// ─── Tree Density by Biome ───

export function getTreeDensity(biomeType: string): { min: number; max: number } {
  switch (biomeType) {
    case 'dense_forest': return { min: 5, max: 8 }
    case 'forest':       return { min: 3, max: 5 }
    case 'hills':        return { min: 1, max: 3 }
    case 'swamp':        return { min: 2, max: 4 }
    case 'plains':       return { min: 0, max: 1 }
    case 'tundra':       return { min: 0, max: 1 }
    default:             return { min: 0, max: 0 }  // ocean, desert, snow, coast, mountains, settlement
  }
}

/** Get tree species available for a biome (from regionFeatures table) */
export function getSpeciesForBiome(biomeType: string): TreeSpecies[] {
  const BIOME_SPECIES: Record<string, string[]> = {
    forest:       ['oak_tree', 'pine_tree', 'birch_tree'],
    dense_forest: ['ancient_oak', 'oak_tree', 'pine_tree', 'birch_tree'],
    hills:        ['hawthorn', 'pine_tree'],
    swamp:        ['willow_tree'],
    plains:       ['oak_tree', 'birch_tree'],
    tundra:       ['mountain_pine'],
    mountains:    ['mountain_pine'],
  }

  const ids = BIOME_SPECIES[biomeType] || []
  return ids.map(id => SPECIES[id] || DEFAULT_SPECIES)
}

// ─── Procedural Tree Rendering ───

export interface TreeInstance {
  x: number       // pixel offset from hex center
  y: number       // pixel offset from hex center
  species: TreeSpecies
  height: number  // actual height for this instance
  age: number     // 0-1, affects size/detail
  seed: string    // for deterministic generation
}

/** Generate tree instances for a hex. Deterministic from hex coords + world seed. */
export function generateTreesForHex(
  hexQ: number,
  hexR: number,
  biomeType: string,
  worldSeed: number,
  hexSize: number,
): TreeInstance[] {
  const density = getTreeDensity(biomeType)
  if (density.max === 0) return []

  const species = getSpeciesForBiome(biomeType)
  if (species.length === 0) return []

  const rng = new TreeRNG(`tree_${worldSeed}_${hexQ}_${hexR}`)
  const count = rng.rangeInt(density.min, density.max)
  const trees: TreeInstance[] = []

  // Place trees within hex, avoiding hex center (where character might stand)
  const placementRadius = hexSize * 0.75
  for (let i = 0; i < count; i++) {
    const angle = rng.next() * Math.PI * 2
    const dist = rng.range(hexSize * 0.15, placementRadius)
    const sp = rng.pick(species)
    const age = rng.range(0.3, 1.0)  // no tiny saplings for now
    const height = sp.heightRange[0] + (sp.heightRange[1] - sp.heightRange[0]) * age

    trees.push({
      x: Math.cos(angle) * dist,
      y: Math.sin(angle) * dist,
      species: sp,
      height,
      age,
      seed: `${worldSeed}_${hexQ}_${hexR}_${i}`,
    })
  }

  return trees
}

/** Render a single tree to the canvas at position (px, py). */
export function renderTree(
  ctx: CanvasRenderingContext2D,
  px: number,
  py: number,
  tree: TreeInstance,
) {
  const { species, height, age } = tree
  const rng = new TreeRNG(tree.seed)

  const trunkW = height * species.trunkWidthRatio
  const canopyW = height * species.canopySpread * (0.8 + age * 0.4)
  const canopyH = height * (species.canopyShape === 'conical' ? 0.7 : 0.5)

  ctx.save()
  ctx.translate(px, py)

  // ─── Shadow ───
  ctx.fillStyle = 'rgba(0, 0, 0, 0.12)'
  ctx.beginPath()
  ctx.ellipse(0, 2, canopyW * 0.35, canopyW * 0.15, 0, 0, Math.PI * 2)
  ctx.fill()

  // ─── Roots (if species has them) ───
  if (species.hasRoots && age > 0.5) {
    ctx.strokeStyle = species.trunkColor
    ctx.lineWidth = trunkW * 0.3
    const rootCount = rng.rangeInt(2, 4)
    for (let i = 0; i < rootCount; i++) {
      const rootAngle = rng.range(-0.8, 0.8) + (i % 2 === 0 ? -0.5 : 0.5)
      const rootLen = rng.range(3, 8) * age
      ctx.beginPath()
      ctx.moveTo(0, 0)
      ctx.quadraticCurveTo(
        Math.cos(rootAngle) * rootLen * 0.5,
        1,
        Math.cos(rootAngle) * rootLen,
        2
      )
      ctx.stroke()
    }
  }

  // ─── Trunk ───
  ctx.fillStyle = species.trunkColor
  ctx.strokeStyle = species.trunkColor
  ctx.lineWidth = trunkW
  ctx.lineCap = 'round'

  const trunkH = height * 0.45
  ctx.beginPath()

  switch (species.trunkStyle) {
    case 'straight':
      ctx.moveTo(0, 0)
      ctx.lineTo(0, -trunkH)
      break

    case 'curved': {
      const bendX = rng.gaussian(0, trunkW * 2)
      ctx.moveTo(0, 0)
      ctx.quadraticCurveTo(bendX, -trunkH * 0.5, bendX * 0.5, -trunkH)
      break
    }

    case 'twisted': {
      const tw1 = rng.gaussian(0, trunkW * 3)
      const tw2 = rng.gaussian(0, trunkW * 2)
      ctx.moveTo(0, 0)
      ctx.bezierCurveTo(tw1, -trunkH * 0.33, tw2, -trunkH * 0.67, tw2 * 0.3, -trunkH)
      break
    }

    case 'split': {
      // Main trunk splits into two
      const splitH = trunkH * 0.5
      ctx.moveTo(0, 0)
      ctx.lineTo(0, -splitH)
      ctx.stroke()
      // Left branch
      ctx.beginPath()
      ctx.moveTo(0, -splitH)
      ctx.quadraticCurveTo(-trunkW * 2, -trunkH * 0.7, -trunkW * 1.5, -trunkH)
      ctx.stroke()
      // Right branch
      ctx.beginPath()
      ctx.moveTo(0, -splitH)
      ctx.quadraticCurveTo(trunkW * 2, -trunkH * 0.7, trunkW * 1.5, -trunkH)
      break
    }
  }
  ctx.stroke()

  // ─── Branches ───
  if (species.branchDensity > 0.3) {
    ctx.lineWidth = trunkW * 0.3
    const branchCount = Math.floor(species.branchDensity * 6 * age)
    for (let i = 0; i < branchCount; i++) {
      const branchY = -trunkH * (0.3 + rng.next() * 0.6)
      const branchDir = rng.next() > 0.5 ? 1 : -1
      const branchLen = rng.range(3, 10) * age
      const branchAngle = rng.range(0.3, 1.2) * branchDir

      ctx.beginPath()
      ctx.moveTo(rng.gaussian(0, trunkW * 0.5), branchY)
      ctx.quadraticCurveTo(
        Math.cos(branchAngle) * branchLen * 0.5,
        branchY - branchLen * 0.2,
        Math.cos(branchAngle) * branchLen,
        branchY - Math.sin(branchAngle) * branchLen * 0.5
      )
      ctx.stroke()
    }
  }

  // ─── Canopy / Foliage ───
  const canopyCenterY = -trunkH - canopyH * 0.3

  switch (species.canopyShape) {
    case 'round': {
      // Cluster of overlapping circles
      const blobCount = 3 + Math.floor(age * 4)
      for (let i = 0; i < blobCount; i++) {
        const bx = rng.gaussian(0, canopyW * 0.2)
        const by = canopyCenterY + rng.gaussian(0, canopyH * 0.15)
        const br = rng.range(canopyW * 0.2, canopyW * 0.35)
        ctx.fillStyle = rng.pick(species.leafPalette)
        ctx.beginPath()
        ctx.arc(bx, by, br, 0, Math.PI * 2)
        ctx.fill()
      }
      break
    }

    case 'conical': {
      // Triangle shape with layers
      const layers = 3 + Math.floor(age * 2)
      for (let i = 0; i < layers; i++) {
        const layerY = -trunkH * 0.3 - (canopyH * i / layers)
        const layerW = canopyW * (1 - i * 0.2 / layers)
        ctx.fillStyle = rng.pick(species.leafPalette)
        ctx.beginPath()
        ctx.moveTo(-layerW * 0.5, layerY)
        ctx.lineTo(layerW * 0.5, layerY)
        ctx.lineTo(rng.gaussian(0, 1), layerY - canopyH / layers * 1.2)
        ctx.closePath()
        ctx.fill()
      }
      break
    }

    case 'umbrella': {
      // Flat-topped wide canopy
      ctx.fillStyle = rng.pick(species.leafPalette)
      ctx.beginPath()
      ctx.ellipse(0, canopyCenterY, canopyW * 0.5, canopyH * 0.25, 0, 0, Math.PI * 2)
      ctx.fill()
      // Bottom detail
      ctx.fillStyle = rng.pick(species.leafPalette)
      ctx.beginPath()
      ctx.ellipse(0, canopyCenterY + canopyH * 0.1, canopyW * 0.4, canopyH * 0.15, 0, 0, Math.PI)
      ctx.fill()
      break
    }

    case 'weeping': {
      // Drooping strands from top
      const strandCount = 5 + Math.floor(age * 4)
      for (let i = 0; i < strandCount; i++) {
        const startX = rng.gaussian(0, canopyW * 0.2)
        const startY = canopyCenterY + rng.range(-canopyH * 0.2, 0)
        const endX = startX + rng.gaussian(0, canopyW * 0.3)
        const endY = startY + rng.range(canopyH * 0.5, canopyH * 1.2)

        ctx.strokeStyle = rng.pick(species.leafPalette)
        ctx.lineWidth = rng.range(1, 2.5)
        ctx.beginPath()
        ctx.moveTo(startX, startY)
        ctx.quadraticCurveTo(
          (startX + endX) / 2 + rng.gaussian(0, 3),
          (startY + endY) / 2,
          endX, endY
        )
        ctx.stroke()
      }
      // Central canopy mass
      ctx.fillStyle = rng.pick(species.leafPalette)
      ctx.beginPath()
      ctx.ellipse(0, canopyCenterY, canopyW * 0.3, canopyH * 0.25, 0, 0, Math.PI * 2)
      ctx.fill()
      break
    }

    case 'irregular': {
      // Sparse, asymmetric blobs
      const blobCount = 2 + Math.floor(age * 3)
      for (let i = 0; i < blobCount; i++) {
        const bx = rng.gaussian(0, canopyW * 0.3)
        const by = canopyCenterY + rng.gaussian(0, canopyH * 0.2)
        const br = rng.range(canopyW * 0.15, canopyW * 0.3)
        ctx.fillStyle = rng.pick(species.leafPalette)
        ctx.beginPath()
        ctx.arc(bx, by, br, 0, Math.PI * 2)
        ctx.fill()
      }
      break
    }

    case 'columnar': {
      // Tall narrow canopy (cypress-like)
      ctx.fillStyle = rng.pick(species.leafPalette)
      ctx.beginPath()
      ctx.ellipse(0, canopyCenterY, canopyW * 0.2, canopyH * 0.5, 0, 0, Math.PI * 2)
      ctx.fill()
      break
    }
  }

  ctx.restore()
}

/** Get species by entity id */
export function getSpecies(entityId: string): TreeSpecies {
  return SPECIES[entityId] || DEFAULT_SPECIES
}
