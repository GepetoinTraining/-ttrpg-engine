'use client'

/**
 * SCENE 3D — Validation pass for the disc → mold → render pipeline
 * ==================================================================
 *
 * Mounts an R3F canvas with:
 *   - A 5×5 grid of SVG-textured tile planes (the floor)
 *   - One goblin entity composed from a hand-built disc tensor
 *   - The goblin's hidden 64-wedge disc piggybacking the entity tensor
 *
 * What this proves end-to-end:
 *   1. A disc tensor (192 bytes of RGB) → decoded via matrix multiply
 *   2. → DecodedEntity semantic values
 *   3. → Mold pieces (head/torso/arms/legs/weapon)
 *   4. → Three.js geometry rendered on screen
 *
 * Same disc tensor on any client → same goblin. By construction.
 * No hash. No DB lookup per entity. The bytes ARE the stamp.
 */

import { useMemo, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, Stats } from '@react-three/drei'
import { TileFloor } from './TileFloor'
import { EntityMesh } from './EntityMesh'
import { EntitySDFMesh } from './EntitySDFMesh'
import { composeGoblin } from '../../lib/mold/goblin-instance'
import { decodeEntity } from '../../lib/mold/goblin-mold'
import { CreatureSizeIdx, BuildIdx, PoseFamily, Disposition, Intent } from '../../lib/disc/disc-spec'

type RenderMode = 'primitive' | 'sdf' | 'both'

const btnStyle = (active: boolean): React.CSSProperties => ({
  padding: '4px 8px',
  fontSize: 11,
  background: active ? '#4a4a5a' : '#222',
  color: '#ddd',
  border: `1px solid ${active ? '#888' : '#555'}`,
  cursor: 'pointer',
  borderRadius: 3,
})

// ============================================================
// FLOOR PALETTE — choose tiles for the 5×5 grid
// ============================================================

const T_FLAG  = '/sprites/interior/floor-flagstone.svg'
const T_RES   = '/sprites/hub/floor-residential.svg'
const T_COMM  = '/sprites/hub/floor-commercial.svg'
const T_COBBL = '/sprites/hub/street-cobblestone.svg'

// Fixed-pattern 5×5: flagstone surround, cobblestone street running N-S, residential corners
const TILE_PATTERN: string[] = [
  T_FLAG, T_FLAG, T_COBBL, T_FLAG, T_FLAG,
  T_FLAG, T_RES,  T_COBBL, T_RES,  T_FLAG,
  T_COBBL, T_COBBL, T_COBBL, T_COBBL, T_COBBL,
  T_FLAG, T_RES,  T_COBBL, T_RES,  T_FLAG,
  T_FLAG, T_FLAG, T_COBBL, T_FLAG, T_COMM,
]

// ============================================================
// SCENE
// ============================================================

export function Scene3D(): React.ReactElement {
  const [showDiscDebug, setShowDiscDebug] = useState(false)
  const [poseFamily, setPoseFamily] = useState<PoseFamily>(PoseFamily.Combat)
  const [renderMode, setRenderMode] = useState<RenderMode>('sdf')
  const [sdfResolution, setSdfResolution] = useState(32)
  const [build, setBuild] = useState<BuildIdx>(BuildIdx.Slim)

  // Build the goblin's disc tensor from a designer-readable spec.
  // In production, this is what the world-roll function produces deterministically.
  const goblinTensor = useMemo(() => composeGoblin({
    level: 2,
    hpCurrent: 7,
    hpMax: 10,
    ac: 13,
    attackMod: 4,
    baseXpAwarded: 50,
    size: CreatureSizeIdx.Small,
    build,
    poseFamily,
    poseProgress: 0.4,
    disposition: Disposition.Hostile,
    intent: Intent.Attack,
    equipMainHand: 0x0102,  // Phase-0 placeholder for "iron longsword" composition
    equipTorso: 0x0011,     // "leather armor"
    factionIdx: 7,          // some goblin tribe
    loyalty: 100,
    instanceSeed: 0xa3f7c1,
    rollDay: 142,
  }), [poseFamily, build])

  // Round-trip test: decode the tensor and log it (visible in dev tools)
  const decoded = useMemo(() => decodeEntity(goblinTensor), [goblinTensor])

  return (
    <div style={{ position: 'relative', width: '100%', height: '100vh', background: '#1a1a22' }}>
      <Canvas
        shadows
        camera={{ position: [4, 4, 4], fov: 45 }}
        style={{ background: '#1a1a22' }}
      >
        {/* Lighting — tabletop diorama style */}
        <ambientLight intensity={0.4} />
        <directionalLight
          position={[5, 8, 5]}
          intensity={1.2}
          castShadow
          shadow-mapSize-width={1024}
          shadow-mapSize-height={1024}
        />
        <directionalLight position={[-3, 4, -3]} intensity={0.4} color="#a0c0ff" />

        {/* Tile floor */}
        <TileFloor cols={5} rows={5} tileSize={1} tileSvgs={TILE_PATTERN} />

        {/* Goblin renderings — same disc, different mold pipelines */}
        {(renderMode === 'primitive' || renderMode === 'both') && (
          <EntityMesh
            tensor={goblinTensor}
            position={renderMode === 'both' ? [-1.2, 0, 0] : [0, 0, 0]}
            showDiscDebug={renderMode === 'primitive' && showDiscDebug}
          />
        )}
        {(renderMode === 'sdf' || renderMode === 'both') && (
          <EntitySDFMesh
            tensor={goblinTensor}
            position={renderMode === 'both' ? [1.2, 0, 0] : [0, 0, 0]}
            resolution={sdfResolution}
            showDiscDebug={renderMode === 'sdf' && showDiscDebug}
          />
        )}

        {/* Camera control */}
        <OrbitControls target={[0, 0.8, 0]} />
        <Stats />
      </Canvas>

      {/* Debug HUD — shows the decoded entity, proving the round-trip */}
      <div style={{
        position: 'absolute', top: 12, left: 12, padding: 12,
        background: 'rgba(0,0,0,0.65)', color: '#ddd', fontFamily: 'ui-monospace, monospace',
        fontSize: 11, lineHeight: 1.4, maxWidth: 380, borderRadius: 4,
      }}>
        <div style={{ fontWeight: 'bold', marginBottom: 6, color: '#ffe066' }}>
          DISC → MOLD ROUND-TRIP
        </div>
        <div>kind: {decoded.kind} archetype: {decoded.archetype} race: {decoded.race} tier: {decoded.tier}</div>
        <div>size: {decoded.size} build: {decoded.build} pose: {decoded.poseFamily}</div>
        <div>level: {decoded.level} hp: {(decoded.hpNormalized * 100).toFixed(0)}%  AC: {decoded.ac} atk: {decoded.attackMod >= 0 ? '+' : ''}{decoded.attackMod}</div>
        <div>XP awarded: {decoded.xp}  faction: {decoded.factionIdx}  loyalty: {decoded.loyalty}</div>
        <div>main-hand: 0x{decoded.equipment.mainHand.toString(16).padStart(4, '0')}  torso: 0x{decoded.equipment.torso.toString(16).padStart(4, '0')}</div>
        <div style={{ marginTop: 8, color: '#88dd88' }}>
          Disc bytes ARE the stamp · 192 bytes/entity · matrix decoded · NO HASH
        </div>

        <div style={{ marginTop: 12, fontSize: 10, color: '#aaa' }}>POSE</div>
        <div style={{ marginTop: 4, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {(['Idle', 'Combat', 'Sneaking', 'Fleeing', 'Dead'] as const).map((label, i) => (
            <button
              key={label}
              onClick={() => setPoseFamily(i as PoseFamily)}
              style={btnStyle(poseFamily === i)}
            >{label}</button>
          ))}
        </div>

        <div style={{ marginTop: 8, fontSize: 10, color: '#aaa' }}>BUILD</div>
        <div style={{ marginTop: 4, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {(['Slim', 'Average', 'Stout', 'Hulking'] as const).map((label, i) => (
            <button key={label} onClick={() => setBuild(i as BuildIdx)} style={btnStyle(build === i)}>
              {label}
            </button>
          ))}
        </div>

        <div style={{ marginTop: 8, fontSize: 10, color: '#aaa' }}>RENDER MODE</div>
        <div style={{ marginTop: 4, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {(['primitive', 'sdf', 'both'] as RenderMode[]).map((mode) => (
            <button key={mode} onClick={() => setRenderMode(mode)} style={btnStyle(renderMode === mode)}>
              {mode === 'primitive' ? 'Primitive (Phase-0)'
                : mode === 'sdf' ? 'SDF + MarchCubes'
                : 'Side-by-side'}
            </button>
          ))}
        </div>

        {(renderMode === 'sdf' || renderMode === 'both') && (
          <>
            <div style={{ marginTop: 8, fontSize: 10, color: '#aaa' }}>
              SDF RESOLUTION: {sdfResolution}³ = {(sdfResolution ** 3).toLocaleString()} cells
            </div>
            <div style={{ marginTop: 4, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {[16, 24, 32, 48, 64].map((r) => (
                <button key={r} onClick={() => setSdfResolution(r)} style={btnStyle(sdfResolution === r)}>
                  {r}³
                </button>
              ))}
            </div>
          </>
        )}

        <div style={{ marginTop: 8 }}>
          <label style={{ cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={showDiscDebug}
              onChange={e => setShowDiscDebug(e.target.checked)}
            /> show wedge disc (debug)
          </label>
        </div>
      </div>
    </div>
  )
}
