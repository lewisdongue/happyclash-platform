import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'

/**
 * Model helpers shared by the city and the halls. Sketchfab models come in
 * every unit and orientation, so each one is measured and brought to real
 * size here, once, before it is placed.
 */

const loader = new GLTFLoader()
const cache = new Map<string, Promise<THREE.Group>>()

/** Loads a model once per visit; later calls get the same scene. */
export function loadModel(url: string, onProgress?: (loaded: number) => void): Promise<THREE.Group> {
  let pending = cache.get(url)
  if (!pending) {
    pending = loader.loadAsync(url, (event) => onProgress?.(event.total ? event.loaded / event.total : 0)).then((gltf) => gltf.scene)
    cache.set(url, pending)
  }
  return pending
}

export interface Part {
  geometry: THREE.BufferGeometry
  material: THREE.Material | THREE.Material[]
}

/**
 * Bakes every mesh of a model into world space, then scales and centers the
 * whole set so that its footprint (or height) matches `size` and it stands
 * on y = 0. The parts can then be drawn as instanced meshes.
 */
export function bakeParts(model: THREE.Object3D, fit: { footprint?: number; height?: number; length?: number }): { parts: Part[]; size: THREE.Vector3 } {
  model.updateMatrixWorld(true)
  const parts: Part[] = []
  model.traverse((child) => {
    const mesh = child as THREE.Mesh
    if (!mesh.isMesh) return
    const geometry = mesh.geometry.clone()
    geometry.applyMatrix4(mesh.matrixWorld)
    parts.push({ geometry, material: mesh.material })
  })

  const box = new THREE.Box3()
  for (const part of parts) {
    part.geometry.computeBoundingBox()
    box.union(part.geometry.boundingBox!)
  }
  const size = box.getSize(new THREE.Vector3())
  const scale = fit.height ? fit.height / size.y : fit.length ? fit.length / Math.max(size.x, size.z) : fit.footprint! / Math.max(size.x, size.z)
  const center = box.getCenter(new THREE.Vector3())
  const transform = new THREE.Matrix4().makeScale(scale, scale, scale).multiply(new THREE.Matrix4().makeTranslation(-center.x, -box.min.y, -center.z))
  for (const part of parts) {
    part.geometry.applyMatrix4(transform)
    part.geometry.computeBoundingBox()
    part.geometry.computeBoundingSphere()
  }
  return { parts, size: size.multiplyScalar(scale) }
}

/** One InstancedMesh per part, all sharing the same per-instance transforms. */
export function instance(parts: Part[], matrices: THREE.Matrix4[], options: { shadows: boolean }): THREE.Group {
  const group = new THREE.Group()
  if (matrices.length === 0) return group
  for (const part of parts) {
    const mesh = new THREE.InstancedMesh(part.geometry, part.material, matrices.length)
    matrices.forEach((matrix, index) => mesh.setMatrixAt(index, matrix))
    mesh.instanceMatrix.needsUpdate = true
    mesh.castShadow = options.shadows
    mesh.receiveShadow = options.shadows
    mesh.computeBoundingSphere()
    group.add(mesh)
  }
  return group
}

/** A sign rendered from text, glowing in the dark. */
export function textTexture(lines: { text: string; size: number; color: string; weight?: number }[], width = 1024, height = 256): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')!
  context.textAlign = 'center'
  context.textBaseline = 'middle'
  const total = lines.reduce((sum, line) => sum + line.size * 1.15, 0)
  let y = (height - total) / 2
  for (const line of lines) {
    y += (line.size * 1.15) / 2
    context.font = `${line.weight ?? 800} ${line.size}px "Helvetica Neue", Arial, sans-serif`
    ;(context as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = `${Math.round(line.size * 0.04)}px`
    context.shadowColor = line.color
    context.shadowBlur = line.size * 0.12
    context.fillStyle = line.color
    context.fillText(line.text, width / 2, y, width * 0.9)
    y += (line.size * 1.15) / 2
  }
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 4
  return texture
}

/** True on phones and small tablets, where the scene is drawn lighter. */
export const isLightDevice = () => window.matchMedia('(pointer: coarse)').matches || window.innerWidth < 900


/**
 * A whole character as one geometry (body, hair and clothes merged), standing on
 * the origin and `height` tall. Clothing color then comes per instance, so one
 * scanned person dresses a whole varied crowd.
 */
export function figureGeometry(model: THREE.Object3D, height: number): THREE.BufferGeometry | null {
  model.updateMatrixWorld(true)
  const pieces: THREE.BufferGeometry[] = []
  model.traverse((child) => {
    const mesh = child as THREE.Mesh
    if (!mesh.isMesh) return
    const piece = new THREE.BufferGeometry()
    piece.setAttribute('position', mesh.geometry.getAttribute('position').clone())
    if (mesh.geometry.index) piece.setIndex(mesh.geometry.index.clone())
    pieces.push(piece.applyMatrix4(mesh.matrixWorld).toNonIndexed())
  })
  if (pieces.length === 0) return null
  const geometry = mergeGeometries(pieces)
  if (!geometry) return null
  geometry.computeVertexNormals()
  geometry.computeBoundingBox()
  const box = geometry.boundingBox!
  const center = box.getCenter(new THREE.Vector3())
  const scale = height / (box.max.y - box.min.y)
  geometry.applyMatrix4(new THREE.Matrix4().makeScale(scale, scale, scale).multiply(new THREE.Matrix4().makeTranslation(-center.x, -box.min.y, -center.z)))
  geometry.computeBoundingBox()
  geometry.computeBoundingSphere()
  return geometry
}
