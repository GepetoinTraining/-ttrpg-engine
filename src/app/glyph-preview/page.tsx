'use client'

/**
 * GLYPH PREVIEW — voxel preview + equipment-primitive demo
 * ==================================================================
 *
 * Visual smoke test for the full pipeline:
 *   - 64×64 tile floor
 *   - NPC human archetype (1×2×1 tiles), nude
 *   - NPC human, geared up via the equipment-primitive system
 *     (helm + cuirass + sword + shield, each its own glyph matrix
 *     snapped to body addresses 3/9/1/2)
 *   - Goblin (for comparison)
 *   - Tree
 *
 * Equipment is its own GlyphMatrix, attached to a snap address on the
 * body. The body never bakes equipment in — pieces are independent
 * matrices placed at world positions derived from snap-address voxels.
 */

import { useEffect, useMemo, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, Stats } from '@react-three/drei'
import {
  parseGlyphMatrix,
  upscaleMatrix,
  extractShell,
  countOccupied,
  encodeMatrixRaw,
  encodeMatrixRLE,
  gzipBytes,
  placeEquipment,
  findSnapCells,
  type GlyphMatrix,
  type EquipmentPiece,
  type EquipmentPlacement,
} from '../../../engine/glyphs/mold-evaluator'
import {
  generateTileSvgById,
  TILE_TEMPLATE_CATALOG,
  type GeneratedTile,
} from '../../../engine/glyphs/tile-svg'
import { HUMANOID_SKELETON, getSkeletonEdges, type Skeleton } from '../../../engine/glyphs/skeleton'
import { mfHumanoidFoot } from '../../../engine/glyphs/parts/foot'
import { flesh } from '../../../engine/glyphs/mm-mini'
import { GlyphMatrixViewer, type GlyphPalette, type TileFootprint } from '../../components/scene-3d/GlyphMatrixViewer'
import { SvgTileFloor, type SvgTilePlacement } from '../../components/scene-3d/SvgTileFloor'
import { SkeletonViewer } from '../../components/scene-3d/SkeletonViewer'

// ============================================================
// PALETTES
// ============================================================

const GOBLIN_PALETTE: GlyphPalette = {
  s: { r:  95, g: 145, b:  80 },
  f: { r:  70, g: 110, b:  60 },
  H: { r:  60, g:  90, b:  50 },
  c: { r:  50, g:  40, b:  30 },
  t: { r: 240, g: 230, b: 200 },
  b: { r: 230, g: 220, b: 190 },
  Y: { r:  85, g:  70, b:  55 },
  e: { r: 200, g: 180, b:  60 },
}

const HUMAN_PALETTE: GlyphPalette = {
  s: { r: 230, g: 195, b: 175 },  // light skin tone
  f: { r: 200, g: 130, b: 110 },  // muscle (pinker)
  b: { r: 235, g: 225, b: 195 },  // bone (skull)
  e: { r:  60, g:  95, b: 150 },  // blue eyes
}

const IRON_PALETTE: GlyphPalette = {
  P: { r: 140, g: 140, b: 155 },  // iron plate
  m: { r: 150, g: 150, b: 165 },  // iron metal (sword)
  l: { r:  85, g:  55, b:  35 },  // leather hilt-grip
}

const WOODSHIELD_PALETTE: GlyphPalette = {
  T: { r: 130, g:  85, b:  55 },  // wood face
  m: { r: 110, g: 110, b: 120 },  // iron rim
}

// ============================================================
// FOOTPRINTS
// ============================================================

const HUMAN_FOOTPRINT:  TileFootprint = { width: 1, height: 2, depth: 1 }
const GOBLIN_FOOTPRINT: TileFootprint = { width: 1, height: 2, depth: 1 }
const TREE_FOOTPRINT:   TileFootprint = { width: 2, height: 4, depth: 2 }

// ============================================================
// EQUIPMENT MATRICES — small ASCII slice-stacks
// ============================================================

const HELM_TXT = `--- y=0 ---
PPPPP
PPPPP
PPPPP
PPPPP
PPPPP

--- y=1 ---
PPPPP
PPPPP
PPPPP
PPPPP
PPPPP

--- y=2 ---
__P__
_PPP_
_PPP_
_PPP_
__P__
`

const CUIRASS_TXT = `--- y=0 ---
PPPPPP
PPPPPP
PPPPPP
PPPPPP

--- y=1 ---
PPPPPP
P____P
P____P
PPPPPP

--- y=2 ---
PPPPPP
P____P
P____P
PPPPPP

--- y=3 ---
PPPPPP
PPPPPP
PPPPPP
PPPPPP
`

const SWORD_TXT = `--- y=0 ---
m

--- y=1 ---
l

--- y=2 ---
l

--- y=3 ---
l

--- y=4 ---
m

--- y=5 ---
m

--- y=6 ---
m

--- y=7 ---
m
`

const SHIELD_TXT = `--- y=0 ---
mmmm

--- y=1 ---
mTTm

--- y=2 ---
mTTm

--- y=3 ---
mTTm

--- y=4 ---
mTTm

--- y=5 ---
mmmm
`

// ============================================================
// PAGE
// ============================================================

interface Loaded {
  human: GlyphMatrix
  goblin: GlyphMatrix
  tree: GlyphMatrix
  equipment: {
    helm:    EquipmentPiece
    cuirass: EquipmentPiece
    sword:   EquipmentPiece
    shield:  EquipmentPiece
  }
}

export default function GlyphPreviewPage(): React.ReactElement {
  const [loaded, setLoaded] = useState<Loaded | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Load matrices once.
  useEffect(() => {
    let cancelled = false
    Promise.all([
      fetch('/glyphs/example-human.txt').then(r => r.text()),
      fetch('/glyphs/example-goblin.txt').then(r => r.text()),
      fetch('/glyphs/example-tree.txt').then(r => r.text()),
    ])
      .then(([humanText, goblinText, treeText]) => {
        if (cancelled) return
        try {
          const helm    = parseGlyphMatrix(HELM_TXT)
          const cuirass = parseGlyphMatrix(CUIRASS_TXT)
          const sword   = parseGlyphMatrix(SWORD_TXT)
          const shield  = parseGlyphMatrix(SHIELD_TXT)
          setLoaded({
            human:  parseGlyphMatrix(humanText),
            goblin: parseGlyphMatrix(goblinText),
            tree:   parseGlyphMatrix(treeText),
            equipment: {
              helm:    { id: 'iron_helm',     matrix: helm,    snapAddress: 3 },
              cuirass: { id: 'iron_cuirass',  matrix: cuirass, snapAddress: 9 },
              // Sword: held by the grip-mid-hilt cell. attachPoint chosen so
              // the hilt sits in the hand and the blade points up.
              sword:   { id: 'longsword',     matrix: sword,   snapAddress: 1, attachPoint: { x: 0, y: 2, z: 0 } },
              // Shield: grip is at center-back of the disc.
              shield:  { id: 'wooden_shield', matrix: shield,  snapAddress: 2, attachPoint: { x: 1, y: 3, z: 0 } },
            },
          })
        } catch (e) {
          setError(e instanceof Error ? e.message : String(e))
        }
      })
      .catch(e => {
        if (cancelled) return
        setError(e instanceof Error ? e.message : String(e))
      })
    return () => { cancelled = true }
  }, [])

  // Equipment placements — world positions derived from snap addresses.
  const equipped = useMemo<EquipmentPlacement[] | null>(() => {
    if (!loaded) return null
    const { equipment, human } = loaded
    return placeEquipment(human, HUMAN_FOOTPRINT, [
      equipment.helm,
      equipment.cuirass,
      equipment.sword,
      equipment.shield,
    ])
  }, [loaded])

  // Snap cell map for HUD display.
  const snaps = useMemo(() => {
    if (!loaded) return null
    return findSnapCells(loaded.human)
  }, [loaded])

  // Wire format for the human matrix.
  const [wire, setWire] = useState<{ raw: number; rle: number; gzip: number } | null>(null)
  useEffect(() => {
    if (!loaded) return
    let cancelled = false
    ;(async () => {
      const raw = encodeMatrixRaw(loaded.human)
      const rle = encodeMatrixRLE(loaded.human)
      const gz  = await gzipBytes(raw)
      if (cancelled) return
      setWire({ raw: raw.length, rle: rle.length, gzip: gz.length })
    })()
    return () => { cancelled = true }
  }, [loaded])

  // Stats: shell counts for human nude + tree (skip goblin upscale to keep page snappy).
  const [native, setNative] = useState<{
    human: { shell: GlyphMatrix; full: number; shellCount: number; ms: number }
  } | null>(null)
  useEffect(() => {
    if (!loaded) return
    let cancelled = false
    const id = setTimeout(() => {
      const t1 = performance.now()
      const humanFull = upscaleMatrix(loaded.human, 4, 8, 4)
      const humanShell = extractShell(humanFull)
      const t2 = performance.now()
      if (cancelled) return
      setNative({
        human: {
          shell: humanShell,
          full: countOccupied(humanFull),
          shellCount: countOccupied(humanShell),
          ms: t2 - t1,
        },
      })
    }, 50)
    return () => { cancelled = true; clearTimeout(id) }
  }, [loaded])

  // ─── SVG tile pipeline ──────────────────────────────────────────────────
  // ONE tile = a 64×64 procedural SVG, generated from (template, seed, q, r).
  // The template's noise functions decide the per-cell glyph; row-RLE'd <rect>
  // runs become the SVG body. Each tile is unique due to seed + noise.
  //
  // Tiles are FLOOR — they exist at fixed (q, r) coords. Minis walk on top
  // with their own world positions; tiles never move.
  const WORLD_SEED = 'preview-001'

  const svgTiles = useMemo<{ placements: SvgTilePlacement[]; samples: GeneratedTile[]; totalSvgBytes: number }>(() => {
    const placements: SvgTilePlacement[] = []
    const samples: GeneratedTile[] = []
    let totalBytes = 0

    // Sample row: one of each template, side by side. Each is its own
    // generated SVG. This is the pipeline working — six different surfaces
    // from one (worldSeed, q, r, template) function.
    const rowTemplates: Array<keyof typeof TILE_TEMPLATE_CATALOG> = [
      'grass', 'dirt', 'cobblestone', 'sand', 'forest_floor', 'snow',
    ]
    rowTemplates.forEach((id, i) => {
      const q = -3 + i
      const r = -3
      const tile = generateTileSvgById(id, WORLD_SEED, q, r)
      samples.push(tile)
      totalBytes += tile.svg.length
      placements.push({ key: `sample:${id}:${q}:${r}`, svg: tile.svg, q, r })
    })

    // A second row: same `grass` template at adjacent (q, r) — proves each
    // tile is a *unique* SVG (different noise sample per coord) but they
    // tile cohesively as floor.
    for (let i = 0; i < 6; i++) {
      const q = -3 + i
      const r = -2
      const tile = generateTileSvgById('grass', WORLD_SEED, q, r)
      totalBytes += tile.svg.length
      placements.push({ key: `floor:grass:${q}:${r}`, svg: tile.svg, q, r })
    }

    return { placements, samples, totalSvgBytes: totalBytes }
  }, [])

  // ─── Mini (creature) world positions — independent of tiles ─────────────
  const HUMAN_POS:        [number, number, number] = [0, 0, 0]
  const HUMAN_GEARED_POS: [number, number, number] = [3, 0, 0]
  const GOBLIN_POS:       [number, number, number] = [5, 0, 0]
  const TREE_POS:         [number, number, number] = [10, 0, 0]

  // Skeleton sits next to the geared human so we can see body, geared body,
  // and the wire-frame primitive that they're all derived from.
  const SKELETON_POS:     [number, number, number] = [7, 0, 0]
  const skeletonEdges = useMemo(() => getSkeletonEdges(HUMANOID_SKELETON), [])

  // ─── First MF — wire mfHumanoidFoot onto foot_L and foot_R ──────────────
  // Iterate by node id; everywhere else we leave `mf` undefined so flesh()
  // will skip the rest of the body for now. Build up MF coverage one node
  // at a time; the math composes as we add more.
  const HUMANOID_WITH_FOOT_MF = useMemo<Skeleton>(() => ({
    ...HUMANOID_SKELETON,
    nodes: HUMANOID_SKELETON.nodes.map((n) => ({
      ...n,
      mf: (n.id === 'foot_L' || n.id === 'foot_R') ? mfHumanoidFoot : n.mf,
    })),
  }), [])

  const fleshedHumanoid = useMemo(() => {
    return flesh(
      HUMANOID_WITH_FOOT_MF,
      { width: 1, height: 2, depth: 1 },
      { species: 'humanoid', height: 2.0, constitution: 1.0, instanceSeed: 'preview-001' },
    )
  }, [HUMANOID_WITH_FOOT_MF])

  // The fleshed matrix is at native resolution (64×128×64). Run shell
  // extraction so only surface cubes ship to the InstancedMesh.
  const fleshedShell = useMemo(() => extractShell(fleshedHumanoid.matrix), [fleshedHumanoid])

  /** Where the fleshed humanoid renders. Same world position as the wire so
   *  the bone goes through the foot voxels — visual proof that the math
   *  generates flesh aligned to the skeleton. */
  const FLESHED_POS:       [number, number, number] = SKELETON_POS

  return (
    <div style={{ position: 'relative', width: '100%', height: '100vh', background: '#0a0a14' }}>
      <Canvas
        shadows
        camera={{ position: [9, 6, 7], fov: 45 }}
        style={{ background: '#0a0a14' }}
      >
        <ambientLight intensity={0.5} />
        <directionalLight
          position={[6, 12, 8]}
          intensity={1.2}
          castShadow
          shadow-mapSize-width={2048}
          shadow-mapSize-height={2048}
          shadow-camera-near={0.1}
          shadow-camera-far={50}
          shadow-camera-left={-15}
          shadow-camera-right={15}
          shadow-camera-top={15}
          shadow-camera-bottom={-15}
        />
        <directionalLight position={[-3, 4, -3]} intensity={0.4} color="#a0c0ff" />

        {/* 64×64 floor — procedural plane backdrop (dark to contrast with tiles) */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.001, 0]} receiveShadow>
          <planeGeometry args={[64, 64]} />
          <meshStandardMaterial color="#1a1f1a" roughness={0.95} />
        </mesh>
        <gridHelper args={[64, 64, '#3a3a4a', '#2a2a34']} position={[0, 0.0005, 0]} />

        {/* SVG tiles — the pipeline output. Each tile is a 64×64 procedural
            SVG rasterized to a Three.js texture on a unit plane. Tiles are
            floor; minis walk on top, independent of which tile is below. */}
        <SvgTileFloor tiles={svgTiles.placements} tileSize={1} resolution={256} />

        {/* NPC human, nude */}
        {loaded && (
          <GlyphMatrixViewer
            matrix={loaded.human}
            tileFootprint={HUMAN_FOOTPRINT}
            position={HUMAN_POS}
            palette={HUMAN_PALETTE}
          />
        )}

        {/* NPC human, equipped — body + each piece as its own viewer */}
        {loaded && equipped && (
          <>
            <GlyphMatrixViewer
              matrix={loaded.human}
              tileFootprint={HUMAN_FOOTPRINT}
              position={HUMAN_GEARED_POS}
              palette={HUMAN_PALETTE}
            />
            {equipped.map(p => (
              <GlyphMatrixViewer
                key={p.id}
                matrix={p.matrix}
                tileFootprint={p.tileFootprint}
                position={[
                  HUMAN_GEARED_POS[0] + p.worldPosition[0],
                  HUMAN_GEARED_POS[1] + p.worldPosition[1],
                  HUMAN_GEARED_POS[2] + p.worldPosition[2],
                ]}
                palette={p.id === 'wooden_shield' ? WOODSHIELD_PALETTE : IRON_PALETTE}
              />
            ))}
          </>
        )}

        {/* Goblin */}
        {loaded && (
          <GlyphMatrixViewer
            matrix={loaded.goblin}
            tileFootprint={GOBLIN_FOOTPRINT}
            position={GOBLIN_POS}
            palette={GOBLIN_PALETTE}
          />
        )}

        {/* Tree */}
        {loaded && (
          <GlyphMatrixViewer
            matrix={loaded.tree}
            tileFootprint={TREE_FOOTPRINT}
            position={TREE_POS}
          />
        )}

        {/* Skeleton primitive — wire-frame armature, the base for every creature */}
        <SkeletonViewer skeleton={HUMANOID_SKELETON} position={SKELETON_POS} />

        {/* Fleshed humanoid (so far: just feet). The matrix is generated by
            walking the skeleton and invoking each node's MF. Empty cells
            elsewhere stay '_' until more MFs land. Same world position as
            the wireframe — the bones run through the voxels. */}
        <GlyphMatrixViewer
          matrix={fleshedShell}
          tileFootprint={HUMAN_FOOTPRINT}
          position={FLESHED_POS}
          palette={HUMAN_PALETTE}
        />

        <OrbitControls target={[5, 1, 0]} />
        <Stats />
      </Canvas>

      <div
        style={{
          position: 'absolute',
          top: 12,
          left: 12,
          padding: 12,
          background: 'rgba(0,0,0,0.72)',
          color: '#ddd',
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
          fontSize: 11,
          lineHeight: 1.5,
          maxWidth: 420,
          borderRadius: 4,
          border: '1px solid #333',
        }}
      >
        <div style={{ fontWeight: 'bold', marginBottom: 6, color: '#ffe066' }}>
          GLYPH MATRIX → VOXEL PREVIEW
        </div>
        <div>scene: <b>skeleton</b> · nude · geared · goblin · tree · tile patch</div>

        <div style={{ marginTop: 10, padding: 8, background: 'rgba(255, 170, 68, 0.08)', borderLeft: '2px solid #ffaa44', fontSize: 10, lineHeight: 1.6 }}>
          <div style={{ fontWeight: 'bold', color: '#ffaa44', marginBottom: 4 }}>SKELETON PRIMITIVE</div>
          <div style={{ color: '#ddd' }}>
            humanoid: <b>{HUMANOID_SKELETON.nodes.length}</b> nodes · <b>{skeletonEdges.length}</b> edges (joints)
          </div>
          <div style={{ color: '#aab', fontSize: 9 }}>
            MFs wired: {fleshedHumanoid.stats.nodesWithMf} / {HUMANOID_SKELETON.nodes.length} · stamped {fleshedHumanoid.stats.cellsStamped.toLocaleString()} cells in {fleshedHumanoid.stats.walkMs.toFixed(1)}ms
          </div>
          <div style={{ color: '#aab', fontSize: 9 }}>
            mfFoot ratios: length=1/8 height · width=0.45 length · top-arch=0.22 length (wider, flatter)
          </div>
        </div>

        <div style={{ marginTop: 10, padding: 8, background: 'rgba(140, 180, 240, 0.08)', borderLeft: '2px solid #8ab4f0', fontSize: 10, lineHeight: 1.6 }}>
          <div style={{ fontWeight: 'bold', color: '#8ab4f0', marginBottom: 4 }}>SVG TILE PIPELINE (1 tile = 64×64)</div>
          <div style={{ color: '#aab' }}>noise → glyph grid → row-RLE&apos;d &lt;rect&gt; runs → SVG → CanvasTexture</div>
          {svgTiles.samples.map(t => (
            <div key={t.templateId} style={{ color: '#ddd', display: 'flex', alignItems: 'center', gap: 6 }}>
              <img
                src={`data:image/svg+xml;base64,${btoa(t.svg)}`}
                width={48}
                height={48}
                style={{ border: '1px solid #444', imageRendering: 'pixelated' }}
                alt={t.templateId}
              />
              <span><b>{t.templateId}</b> = {t.svg.length.toLocaleString()} B</span>
            </div>
          ))}
          <div style={{ color: '#8ab4f0', marginTop: 4 }}>
            scene total: <b>{svgTiles.totalSvgBytes.toLocaleString()} B</b> across {svgTiles.placements.length} tiles
          </div>
        </div>

        <div style={{ marginTop: 10, padding: 8, background: 'rgba(255, 224, 102, 0.06)', borderLeft: '2px solid #ffe066', fontSize: 10, lineHeight: 1.6 }}>
          <div style={{ fontWeight: 'bold', color: '#ffe066', marginBottom: 4 }}>EQUIPMENT PRIMITIVES</div>
          {equipped && equipped.map(p => (
            <div key={p.id} style={{ color: '#ddd' }}>
              <b>{p.id}</b> snap={p.matrix.sizeX}×{p.matrix.sizeY}×{p.matrix.sizeZ} → world Δ ({p.worldPosition.map(n => n.toFixed(2)).join(', ')})
            </div>
          ))}
        </div>

        {snaps && (
          <div style={{ marginTop: 8, fontSize: 10, color: '#aab' }}>
            <b>human snap addresses:</b> {Array.from(snaps.entries()).map(([n, c]) => `${n}@(${c.x},${c.y},${c.z})`).join(' · ')}
          </div>
        )}

        {wire && (
          <div style={{ marginTop: 10, padding: 8, background: 'rgba(110, 200, 110, 0.08)', borderLeft: '2px solid #88dd88', fontSize: 10, lineHeight: 1.6 }}>
            <div style={{ fontWeight: 'bold', color: '#88dd88', marginBottom: 4 }}>WIRE (human matrix)</div>
            <div style={{ color: '#ddd' }}>
              16³: <b>{wire.raw.toLocaleString()}</b> raw / <b>{wire.rle.toLocaleString()}</b> RLE / <b style={{ color: '#88dd88' }}>{wire.gzip.toLocaleString()} B gzip</b>
            </div>
          </div>
        )}

        {native && (
          <div style={{ marginTop: 8, fontSize: 10, color: '#bbe6bb' }}>
            <b>human native</b>: 64×128×64 = {native.human.full.toLocaleString()} → <b>{native.human.shellCount.toLocaleString()}</b> cubes ({((1 - native.human.shellCount / native.human.full) * 100).toFixed(0)}% interior dropped) in {native.human.ms.toFixed(0)}ms
          </div>
        )}

        {error && <div style={{ color: '#f88', marginTop: 8 }}>parse error: {error}</div>}
        {!loaded && !error && <div style={{ marginTop: 8, color: '#888' }}>loading matrices…</div>}

        <div style={{ marginTop: 10, fontSize: 10, color: '#888' }}>
          orbit: drag · pan: shift+drag · zoom: scroll
        </div>
      </div>
    </div>
  )
}
