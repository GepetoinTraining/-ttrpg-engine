'use client'

// Die.tsx — Three.js polyhedral dice (clear resin, Roman numerals).
// Ported from the Crag & Coin design project via the DM Helper handoff.
//
// Architecture:
//   scene
//     └── tiltGroup          — fixed 3/4 camera angle (rotateX -0.35, rotateY -0.55)
//           └── dieGroup     — animates to bring face[value] toward +Z (camera)
//                 ├── mesh   — translucent polyhedron
//                 └── numerals (one plane per face, positioned just inside surface)
//
// One RAF loop drives both idle rendering and slerp animation (rest OR tumble).

import React from 'react'
import * as THREE from 'three'

const DIE_SIDES: Record<string, number> = {
  d4: 4,
  d6: 6,
  d8: 8,
  d10: 10,
  d12: 12,
  d20: 20,
}

// ─── Roman numerals ─────────────────────────────────────────────────────
const ROMAN = [
  '', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X',
  'XI', 'XII', 'XIII', 'XIV', 'XV', 'XVI', 'XVII', 'XVIII', 'XIX', 'XX',
]

function makeNumeralTexture(
  n: number,
  { size = 256, color = '#3a1a08' }: { size?: number; color?: string } = {}
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  const ctx = canvas.getContext('2d')!
  const text = ROMAN[n] || String(n)
  const fontSize =
    text.length <= 2 ? size * 0.6 : text.length <= 4 ? size * 0.44 : size * 0.34
  ctx.font = `700 ${fontSize}px "IM Fell English", "EB Garamond", Georgia, serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = color
  ctx.fillText(text, size / 2, size / 2 + fontSize * 0.04)
  const tex = new THREE.CanvasTexture(canvas)
  tex.anisotropy = 8
  tex.needsUpdate = true
  return tex
}

interface DieGeom {
  geometry: THREE.BufferGeometry
  faceNormals: THREE.Vector3[]
  faceCenters: THREE.Vector3[]
  numeralSize: number
  inset: number
}

// ─── D6 cube ────────────────────────────────────────────────────────────
function buildD6(): DieGeom {
  const g = new THREE.BoxGeometry(1, 1, 1)
  const fn = [
    new THREE.Vector3(1, 0, 0),
    new THREE.Vector3(-1, 0, 0),
    new THREE.Vector3(0, 1, 0),
    new THREE.Vector3(0, -1, 0),
    new THREE.Vector3(0, 0, 1),
    new THREE.Vector3(0, 0, -1),
  ]
  const fc = fn.map((n) => n.clone().multiplyScalar(0.5))
  return { geometry: g, faceNormals: fn, faceCenters: fc, numeralSize: 0.75, inset: 0.05 }
}

// ─── D4 tetrahedron ─────────────────────────────────────────────────────
function buildD4(): DieGeom {
  const s = 0.85
  const V = [
    new THREE.Vector3(s, s, s),
    new THREE.Vector3(s, -s, -s),
    new THREE.Vector3(-s, s, -s),
    new THREE.Vector3(-s, -s, s),
  ]
  const faceVerts: [THREE.Vector3, THREE.Vector3, THREE.Vector3][] = [
    [V[0], V[2], V[1]],
    [V[0], V[1], V[3]],
    [V[0], V[3], V[2]],
    [V[1], V[2], V[3]],
  ]

  const positions: number[] = []
  const fn: THREE.Vector3[] = []
  const fc: THREE.Vector3[] = []
  for (const [a, b, c] of faceVerts) {
    positions.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z)
    const center = a.clone().add(b).add(c).divideScalar(3)
    fc.push(center)
    fn.push(center.clone().normalize())
  }

  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  g.computeVertexNormals()

  return { geometry: g, faceNormals: fn, faceCenters: fc, numeralSize: 0.55, inset: 0.04 }
}

// ─── D8 octahedron ──────────────────────────────────────────────────────
function buildD8(): DieGeom {
  const r = 1.0
  const V = {
    px: new THREE.Vector3(r, 0, 0),
    nx: new THREE.Vector3(-r, 0, 0),
    py: new THREE.Vector3(0, r, 0),
    ny: new THREE.Vector3(0, -r, 0),
    pz: new THREE.Vector3(0, 0, r),
    nz: new THREE.Vector3(0, 0, -r),
  }
  const faceVerts: [THREE.Vector3, THREE.Vector3, THREE.Vector3][] = [
    [V.px, V.py, V.pz],
    [V.px, V.pz, V.ny],
    [V.px, V.ny, V.nz],
    [V.px, V.nz, V.py],
    [V.nx, V.pz, V.py],
    [V.nx, V.py, V.nz],
    [V.nx, V.nz, V.ny],
    [V.nx, V.ny, V.pz],
  ]

  const positions: number[] = []
  const fn: THREE.Vector3[] = []
  const fc: THREE.Vector3[] = []
  for (const [a, b, c] of faceVerts) {
    positions.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z)
    const center = a.clone().add(b).add(c).divideScalar(3)
    fc.push(center)
    fn.push(center.clone().normalize())
  }

  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  g.computeVertexNormals()

  return { geometry: g, faceNormals: fn, faceCenters: fc, numeralSize: 0.42, inset: 0.03 }
}

// ─── D12 dodecahedron ───────────────────────────────────────────────────
function buildD12(): DieGeom {
  const g = new THREE.DodecahedronGeometry(1.0)
  const pos = g.attributes.position
  const triCount = pos.count / 3
  const faceMap: { normal: THREE.Vector3; centers: THREE.Vector3[]; count: number }[] = []
  const EPS = 0.01
  const a = new THREE.Vector3()
  const b = new THREE.Vector3()
  const c = new THREE.Vector3()
  for (let i = 0; i < triCount; i++) {
    a.fromBufferAttribute(pos, i * 3)
    b.fromBufferAttribute(pos, i * 3 + 1)
    c.fromBufferAttribute(pos, i * 3 + 2)
    const centroid = a.clone().add(b).add(c).divideScalar(3)
    const normal = centroid.clone().normalize()
    let bucket = faceMap.find((f) => f.normal.dot(normal) > 1 - EPS)
    if (!bucket) {
      bucket = { normal: normal.clone(), centers: [], count: 0 }
      faceMap.push(bucket)
    }
    bucket.centers.push(centroid)
    bucket.count++
  }
  faceMap.sort((A, B) => {
    if (Math.abs(A.normal.y - B.normal.y) > 0.01) return B.normal.y - A.normal.y
    if (Math.abs(A.normal.x - B.normal.x) > 0.01) return B.normal.x - A.normal.x
    return B.normal.z - A.normal.z
  })
  const fn = faceMap.map((f) => f.normal)
  const fc = faceMap.map((f) => {
    const avg = new THREE.Vector3()
    f.centers.forEach((v) => avg.add(v))
    avg.divideScalar(f.centers.length)
    return avg
  })
  return { geometry: g, faceNormals: fn, faceCenters: fc, numeralSize: 0.5, inset: 0.03 }
}

// ─── D20 icosahedron ────────────────────────────────────────────────────
function buildD20(): DieGeom {
  const g = new THREE.IcosahedronGeometry(1.0)
  const pos = g.attributes.position
  const triCount = pos.count / 3
  const fn: THREE.Vector3[] = []
  const fc: THREE.Vector3[] = []
  const a = new THREE.Vector3()
  const b = new THREE.Vector3()
  const c = new THREE.Vector3()
  for (let i = 0; i < triCount; i++) {
    a.fromBufferAttribute(pos, i * 3)
    b.fromBufferAttribute(pos, i * 3 + 1)
    c.fromBufferAttribute(pos, i * 3 + 2)
    const centroid = a.clone().add(b).add(c).divideScalar(3)
    fc.push(centroid)
    fn.push(centroid.clone().normalize())
  }
  return { geometry: g, faceNormals: fn, faceCenters: fc, numeralSize: 0.36, inset: 0.02 }
}

// ─── D10 pentagonal trapezohedron ───────────────────────────────────────
function buildD10(): DieGeom {
  const apexY = 0.9
  const ringY = 0.18
  const ringR = 0.95

  const top = new THREE.Vector3(0, apexY, 0)
  const bot = new THREE.Vector3(0, -apexY, 0)

  const upper: THREE.Vector3[] = []
  const lower: THREE.Vector3[] = []
  for (let i = 0; i < 5; i++) {
    const aU = (i / 5) * Math.PI * 2
    const aL = aU + Math.PI / 5
    upper.push(new THREE.Vector3(Math.cos(aU) * ringR, ringY, Math.sin(aU) * ringR))
    lower.push(new THREE.Vector3(Math.cos(aL) * ringR, -ringY, Math.sin(aL) * ringR))
  }

  const faces: [THREE.Vector3, THREE.Vector3, THREE.Vector3, THREE.Vector3][] = []
  for (let i = 0; i < 5; i++) {
    const ni = (i + 1) % 5
    faces.push([top, upper[i], lower[i], upper[ni]])
  }
  for (let i = 0; i < 5; i++) {
    const ni = (i + 1) % 5
    faces.push([bot, lower[ni], upper[ni], lower[i]])
  }

  const positions: number[] = []
  const fn: THREE.Vector3[] = []
  const fc: THREE.Vector3[] = []
  for (const quad of faces) {
    const [p0, p1, p2, p3] = quad
    positions.push(p0.x, p0.y, p0.z, p1.x, p1.y, p1.z, p2.x, p2.y, p2.z)
    positions.push(p0.x, p0.y, p0.z, p2.x, p2.y, p2.z, p3.x, p3.y, p3.z)
    const center = p0.clone().add(p1).add(p2).add(p3).divideScalar(4)
    fc.push(center)
    const e1 = p1.clone().sub(p0)
    const e2 = p2.clone().sub(p0)
    const normal = new THREE.Vector3().crossVectors(e1, e2).normalize()
    if (normal.dot(center) < 0) normal.negate()
    fn.push(normal)
  }

  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  g.computeVertexNormals()

  return { geometry: g, faceNormals: fn, faceCenters: fc, numeralSize: 0.44, inset: 0.03 }
}

function buildDieGeometry(type: string): DieGeom {
  switch (type) {
    case 'd4':
      return buildD4()
    case 'd6':
      return buildD6()
    case 'd8':
      return buildD8()
    case 'd10':
      return buildD10()
    case 'd12':
      return buildD12()
    case 'd20':
      return buildD20()
    default:
      return buildD6()
  }
}

const TILT_Q = new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.32, -0.45, 0.05))

function faceFrontQuaternion(normal: THREE.Vector3): THREE.Quaternion {
  const forward = new THREE.Vector3(0, 0, 1)
  const q = new THREE.Quaternion().setFromUnitVectors(normal.clone().normalize(), forward)
  return TILT_Q.clone().multiply(q)
}

interface DieProps {
  type?: 'd4' | 'd6' | 'd8' | 'd10' | 'd12' | 'd20'
  value?: number
  size?: number
  rolling?: boolean
  held?: boolean
  durationMs?: number
  spins?: number
  tint?: number
  onRollEnd?: () => void
}

export default function Die({
  type = 'd6',
  value = 1,
  size = 160,
  rolling = false,
  held = false,
  durationMs = 1400,
  spins = 1,
  tint = 0xf4e9ca,
  onRollEnd,
}: DieProps) {
  const mountRef = React.useRef<HTMLDivElement>(null)
  const stateRef = React.useRef<any>({})
  const prevRollingRef = React.useRef(rolling)

  const resolvedSkin = React.useMemo(
    () => ({
      tint,
      numeralColor: '#3a1a08',
      opacity: 0.38,
      roughness: 0.15,
      metalness: 0,
      emissive: 0x000000,
      emissiveIntensity: 0,
    }),
    [tint]
  )

  React.useEffect(() => {
    const mount = mountRef.current
    if (!mount) return

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 100)
    camera.position.set(0, 0, 6)
    camera.lookAt(0, 0, 0)

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setSize(size, size)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setClearColor(0x000000, 0)
    mount.appendChild(renderer.domElement)

    scene.add(new THREE.AmbientLight(0xffffff, 0.9))
    const key = new THREE.DirectionalLight(0xfff1d2, 1.3)
    key.position.set(4, 6, 5)
    scene.add(key)
    const rim = new THREE.DirectionalLight(0xb8c8ff, 0.7)
    rim.position.set(-4, 2, -3)
    scene.add(rim)
    const fill = new THREE.PointLight(0xffe2b0, 0.8, 10)
    fill.position.set(0, -1.5, 4)
    scene.add(fill)

    const { geometry, faceNormals, faceCenters, numeralSize, inset } =
      buildDieGeometry(type)

    const material = new THREE.MeshStandardMaterial({
      color: resolvedSkin.tint,
      roughness: resolvedSkin.roughness,
      metalness: resolvedSkin.metalness,
      transparent: resolvedSkin.opacity < 1,
      opacity: resolvedSkin.opacity,
      emissive: resolvedSkin.emissive,
      emissiveIntensity: resolvedSkin.emissiveIntensity,
      side: THREE.DoubleSide,
      depthWrite: resolvedSkin.opacity >= 0.9,
    })

    const tiltGroup = new THREE.Group()
    tiltGroup.rotation.set(-0.35, -0.55, 0)
    scene.add(tiltGroup)

    const dieGroup = new THREE.Group()
    tiltGroup.add(dieGroup)

    const mesh = new THREE.Mesh(geometry, material)
    mesh.renderOrder = 0
    dieGroup.add(mesh)

    const total = DIE_SIDES[type]
    for (let i = 0; i < total; i++) {
      const texture = makeNumeralTexture(i + 1, { color: resolvedSkin.numeralColor })
      const planeMat = new THREE.MeshBasicMaterial({
        map: texture,
        transparent: true,
        depthWrite: true,
        depthTest: true,
        side: THREE.DoubleSide,
      })
      const plane = new THREE.Mesh(
        new THREE.PlaneGeometry(numeralSize, numeralSize),
        planeMat
      )
      const n = faceNormals[i]
      plane.position.copy(faceCenters[i]).addScaledVector(n, -inset)
      plane.lookAt(plane.position.clone().add(n))
      plane.renderOrder = 1
      dieGroup.add(plane)
    }

    const sc = document.createElement('canvas')
    sc.width = sc.height = 128
    const sctx = sc.getContext('2d')!
    const r = sc.width / 2
    const grad = sctx.createRadialGradient(r, r, 0, r, r, r)
    grad.addColorStop(0, 'rgba(0,0,0,0.55)')
    grad.addColorStop(0.5, 'rgba(0,0,0,0.2)')
    grad.addColorStop(1, 'rgba(0,0,0,0)')
    sctx.fillStyle = grad
    sctx.fillRect(0, 0, sc.width, sc.height)
    const shadow = new THREE.Mesh(
      new THREE.PlaneGeometry(1.8, 1.8),
      new THREE.MeshBasicMaterial({
        map: new THREE.CanvasTexture(sc),
        transparent: true,
        depthWrite: false,
      })
    )
    shadow.rotation.x = -Math.PI / 2
    shadow.position.y = -0.9
    scene.add(shadow)

    const startQ = faceFrontQuaternion(faceNormals[value - 1])
    dieGroup.quaternion.copy(startQ)

    const anim: any = {
      startQ: startQ.clone(),
      targetQ: startQ.clone(),
      startTime: 0,
      duration: 0,
      active: false,
      spinAxis: new THREE.Vector3(0, 1, 0),
      spinRadians: 0,
    }

    let animId: number | null = null
    const loop = (t: number) => {
      animId = requestAnimationFrame(loop)
      if (anim.active) {
        const elapsed = t - anim.startTime
        const k = Math.min(1, elapsed / anim.duration)
        const e = 1 - Math.pow(1 - k, 3)
        const spinNow = anim.spinRadians * (1 - e)
        const spinQ = new THREE.Quaternion().setFromAxisAngle(anim.spinAxis, spinNow)
        const slerped = anim.startQ.clone().slerp(anim.targetQ, e)
        slerped.multiply(spinQ)
        dieGroup.quaternion.copy(slerped)
        if (k >= 1) {
          dieGroup.quaternion.copy(anim.targetQ)
          anim.active = false
          if (stateRef.current.onRollEndPending) {
            const cb = stateRef.current.onRollEndPending
            stateRef.current.onRollEndPending = null
            setTimeout(cb, 0)
          }
        }
      }
      renderer.render(scene, camera)
    }
    loop(0)

    stateRef.current = {
      scene,
      camera,
      renderer,
      tiltGroup,
      dieGroup,
      mesh,
      material,
      geometry,
      faceNormals,
      animState: anim,
      onRollEndPending: null,
    }

    return () => {
      if (animId !== null) cancelAnimationFrame(animId)
      geometry.dispose()
      material.dispose()
      dieGroup.children.forEach((child: any) => {
        if (child.material) {
          child.material.map?.dispose()
          child.material.dispose()
        }
        if (child.geometry && child.geometry !== geometry) child.geometry.dispose()
      })
      renderer.dispose()
      if (renderer.domElement.parentNode) {
        renderer.domElement.parentNode.removeChild(renderer.domElement)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, size, resolvedSkin])

  // Value change while idle → short ease
  React.useEffect(() => {
    const s = stateRef.current
    if (!s.dieGroup || rolling) return
    const target = faceFrontQuaternion(s.faceNormals[value - 1])
    const anim = s.animState
    anim.startQ = s.dieGroup.quaternion.clone()
    anim.targetQ = target
    anim.startTime = performance.now()
    anim.duration = 400
    anim.active = true
    anim.spinAxis.set(0, 1, 0)
    anim.spinRadians = 0
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  // Rolling false → true : tumble
  React.useEffect(() => {
    const wasRolling = prevRollingRef.current
    prevRollingRef.current = rolling
    const s = stateRef.current
    if (!s.dieGroup) return
    if (!rolling || wasRolling) return

    const target = faceFrontQuaternion(s.faceNormals[value - 1])
    const anim = s.animState
    anim.startQ = s.dieGroup.quaternion.clone()
    anim.targetQ = target
    anim.startTime = performance.now()
    anim.duration = durationMs
    anim.active = true
    anim.spinAxis
      .set(
        (Math.random() - 0.5) * 2,
        (Math.random() - 0.5) * 2,
        (Math.random() - 0.5) * 2
      )
      .normalize()
    anim.spinRadians = Math.PI * 2 * Math.max(2, spins * 3)

    s.onRollEndPending = onRollEnd || null
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rolling, value, durationMs, spins, onRollEnd])

  return (
    <div
      ref={mountRef}
      style={{
        width: size,
        height: size,
        position: 'relative',
        filter: held
          ? 'drop-shadow(0 0 12px rgba(212,168,74,0.7))'
          : 'drop-shadow(0 6px 14px rgba(0,0,0,0.55))',
        transition: 'filter 200ms ease',
      }}
    />
  )
}
