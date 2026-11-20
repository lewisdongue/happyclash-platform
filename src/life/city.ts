import * as THREE from 'three'
import { Sky } from 'three/examples/jsm/objects/Sky.js'
import { WORLD_LIST } from '@/theme/worlds'
import type { WorldId } from '@/types/domain'
import { VEHICLES, type Vehicle } from './garage'
import { LIFE_MODELS } from './assets'
import { bakeParts, figureGeometry, instance, isLightDevice, loadModel, textTexture } from './models'

/**
 * happyClash City: a grid of 10 × 10 blocks. Most blocks hold a building,
 * the four in the middle make a park, and eight are the Talent World arenas,
 * each with a light beam in its color so it can be seen from anywhere.
 * The visitor drives a car between them.
 */

const CELLS = 10
const CELL = 64
const ROAD = 14
const BLOCK = CELL - ROAD
const HALF = (CELLS * CELL) / 2
const SIDEWALK_HEIGHT = 0.18

/** Grid cells of the eight arenas, spread so that every drive is a little trip. */
const VENUE_CELLS: [number, number][] = [
  [1, 1],
  [1, 5],
  [1, 8],
  [5, 1],
  [5, 8],
  [8, 1],
  [8, 5],
  [8, 8],
]
const PARK_CELLS = new Set(['4,4', '4,5', '5,4', '5,5'])

const cellCenter = (column: number, row: number) => new THREE.Vector2(-HALF + column * CELL + CELL / 2, -HALF + row * CELL + CELL / 2)

export interface Venue {
  worldId: WorldId
  name: string
  color: string
  /** Where the car stops: on the road, in front of the entrance. */
  door: THREE.Vector3
  center: THREE.Vector3
  /** The big door on the arena wall: walking into it enters the hall. */
  entry: THREE.Vector3
  /** Footprint of the arena, to know when the visitor is close to it. */
  box: { minX: number; maxX: number; minZ: number; maxZ: number }
}

export interface DriveInput {
  throttle: number
  steer: number
  brake: boolean
}

interface Box {
  minX: number
  maxX: number
  minZ: number
  maxZ: number
}

export interface CityState {
  position: THREE.Vector3
  heading: number
  speed: number
  nearVenue: Venue | null
  walkedIn: Venue | null
}

export class City {
  readonly venues: Venue[] = []
  readonly scene = new THREE.Scene()
  readonly camera = new THREE.PerspectiveCamera(60, 1, 0.5, 2600)

  private readonly obstacles: Box[] = []
  private readonly car = new THREE.Group()
  private readonly beams: THREE.Mesh[] = []
  private readonly light = isLightDevice()
  private readonly sun = new THREE.DirectionalLight('#ffd7a8', 2.4)
  private readonly avatar = new THREE.Group()
  private readonly outfit = new THREE.MeshStandardMaterial({ color: '#ec5d9e', roughness: 0.7 })
  private vehicle: Vehicle = VEHICLES[0]
  private walking = false
  private heading = 0
  private speed = 0
  private wheelTurn = 0
  private elapsed = 0

  async build(onProgress: (fraction: number) => void) {
    const urls = [LIFE_MODELS.car, LIFE_MODELS.trees, LIFE_MODELS.arena, ...LIFE_MODELS.buildings]
    const progress = new Map<string, number>()
    const report = () => onProgress([...progress.values()].reduce((sum, value) => sum + value, 0) / urls.length)
    const [carModel, treeModel, arenaModel, ...buildingModels] = await Promise.all(
      urls.map((url) =>
        loadModel(url, (fraction) => {
          progress.set(url, fraction)
          report()
        }).then((model) => {
          progress.set(url, 1)
          report()
          return model
        }),
      ),
    )

    this.setUpSky()
    this.setUpGround()
    this.placeBuildings(buildingModels)
    this.placeVenues(arenaModel)
    this.placeTrees(treeModel)
    this.setUpCar(carModel)

    // People and the visitor's own character load after the city is drivable.
    void Promise.all([loadModel(LIFE_MODELS.crowd), loadModel(LIFE_MODELS.player)])
      .then(([crowdModel, playerModel]) => {
        this.placePedestrians(crowdModel)
        this.playerModel = playerModel
        if (this.walking) this.dressAvatar()
      })
      .catch(() => undefined)
  }

  // ---------------------------------------------------------------------------
  // Pedestrians: hundreds of people on the sidewalks, each dressed differently.
  // ---------------------------------------------------------------------------

  private walkers: { vertical: boolean; line: number; along: number; speed: number }[] = []
  private walkerMesh: THREE.InstancedMesh | null = null
  private playerModel: THREE.Group | null = null

  private placePedestrians(model: THREE.Group) {
    const geometry = figureGeometry(model, 1.78)
    if (!geometry) return
    const count = this.light ? 160 : 340
    const mesh = new THREE.InstancedMesh(geometry, new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.75 }), count)
    const palette = ['#2f6fbf', '#ec5d9e', '#ffd54f', '#6a5ba8', '#e8e2cf', '#1f2430', '#7a4b2a', '#2d4a3e', '#b23a48', '#f2f2f2', '#5b2c3a', '#3a7d8c']
    const color = new THREE.Color()
    for (let index = 0; index < count; index += 1) {
      const line = Math.floor(Math.random() * (CELLS + 1))
      const side = Math.random() < 0.5 ? -1 : 1
      this.walkers.push({
        vertical: Math.random() < 0.5,
        line: -HALF + line * CELL + side * (ROAD / 2 + 1.6 + Math.random() * 1.4),
        along: (Math.random() - 0.5) * 2 * HALF,
        speed: (Math.random() < 0.5 ? -1 : 1) * (1 + Math.random() * 0.9),
      })
      mesh.setColorAt(index, color.set(palette[index % palette.length]).multiplyScalar(0.75 + Math.random() * 0.5))
    }
    mesh.castShadow = !this.light
    mesh.frustumCulled = false
    this.walkerMesh = mesh
    this.scene.add(mesh)
    this.moveWalkers(0)
  }

  private readonly walkerMatrix = new THREE.Matrix4()
  private readonly walkerTurn = new THREE.Quaternion()
  private readonly walkerScale = new THREE.Vector3(1, 1, 1)
  private readonly walkerSpot = new THREE.Vector3()
  private readonly up = new THREE.Vector3(0, 1, 0)

  private moveWalkers(step: number) {
    const mesh = this.walkerMesh
    if (!mesh) return
    this.walkers.forEach((walker, index) => {
      walker.along += walker.speed * step
      if (walker.along > HALF) walker.along = -HALF
      if (walker.along < -HALF) walker.along = HALF
      const bob = Math.abs(Math.sin(this.elapsed * 6 + index)) * 0.04
      if (walker.vertical) this.walkerSpot.set(walker.line, 0.12 + bob, walker.along)
      else this.walkerSpot.set(walker.along, 0.12 + bob, walker.line)
      const facing = walker.vertical ? (walker.speed > 0 ? 0 : Math.PI) : walker.speed > 0 ? Math.PI / 2 : -Math.PI / 2
      this.walkerTurn.setFromAxisAngle(this.up, facing)
      mesh.setMatrixAt(index, this.walkerMatrix.compose(this.walkerSpot, this.walkerTurn, this.walkerScale))
    })
    mesh.instanceMatrix.needsUpdate = true
  }

  /** The visitor's own character, tinted with the outfit picked in the shop. */
  private dressAvatar() {
    if (!this.playerModel || this.avatar.userData.dressed) return
    const figure = bakeParts(this.playerModel.clone(true), { height: 1.8 })
    this.avatar.clear()
    for (const part of figure.parts) {
      const mesh = new THREE.Mesh(part.geometry, part.material as THREE.Material)
      mesh.castShadow = true
      this.avatar.add(mesh)
    }
    this.avatar.userData.dressed = true
  }

  // ---------------------------------------------------------------------------
  // World
  // ---------------------------------------------------------------------------

  private setUpSky() {
    const sky = new Sky()
    sky.scale.setScalar(5000)
    const uniforms = sky.material.uniforms
    uniforms.turbidity.value = 6
    uniforms.rayleigh.value = 2.2
    uniforms.mieCoefficient.value = 0.006
    uniforms.mieDirectionalG.value = 0.86
    // Golden hour: the light beams of the arenas stand out against the sky.
    const sunDirection = new THREE.Vector3().setFromSphericalCoords(1, THREE.MathUtils.degToRad(84), THREE.MathUtils.degToRad(210))
    uniforms.sunPosition.value.copy(sunDirection)
    this.scene.add(sky)
    this.scene.fog = new THREE.Fog('#c9a98f', 260, 1100)

    this.scene.add(new THREE.HemisphereLight('#b9d3ff', '#3a2c22', 1.1))
    this.sun.position.copy(sunDirection).multiplyScalar(300)
    this.sun.castShadow = !this.light
    this.sun.shadow.mapSize.set(2048, 2048)
    const reach = 90
    Object.assign(this.sun.shadow.camera, { left: -reach, right: reach, top: reach, bottom: -reach, near: 10, far: 700 })
    this.sun.shadow.camera.updateProjectionMatrix()
    this.sun.shadow.bias = -0.0005
    this.scene.add(this.sun, this.sun.target)
  }

  private setUpGround() {
    const size = CELLS * CELL + 200
    const asphalt = new THREE.Mesh(new THREE.PlaneGeometry(size, size), new THREE.MeshStandardMaterial({ color: '#2b2d31', roughness: 0.95 }))
    asphalt.rotation.x = -Math.PI / 2
    asphalt.receiveShadow = !this.light
    this.scene.add(asphalt)

    // Sidewalk blocks, and green for the park.
    const sidewalk = new THREE.MeshStandardMaterial({ color: '#8d8a84', roughness: 0.9 })
    const grass = new THREE.MeshStandardMaterial({ color: '#4e7a3a', roughness: 1 })
    const blockGeometry = new THREE.BoxGeometry(BLOCK, SIDEWALK_HEIGHT, BLOCK)
    const blocks: THREE.Matrix4[] = []
    for (let column = 0; column < CELLS; column += 1) {
      for (let row = 0; row < CELLS; row += 1) {
        const center = cellCenter(column, row)
        blocks.push(new THREE.Matrix4().makeTranslation(center.x, SIDEWALK_HEIGHT / 2, center.y))
        if (PARK_CELLS.has(`${column},${row}`)) {
          const lawn = new THREE.Mesh(new THREE.PlaneGeometry(BLOCK - 4, BLOCK - 4), grass)
          lawn.rotation.x = -Math.PI / 2
          lawn.position.set(center.x, SIDEWALK_HEIGHT + 0.01, center.y)
          lawn.receiveShadow = !this.light
          this.scene.add(lawn)
        }
      }
    }
    const blockMesh = new THREE.InstancedMesh(blockGeometry, sidewalk, blocks.length)
    blocks.forEach((matrix, index) => blockMesh.setMatrixAt(index, matrix))
    blockMesh.receiveShadow = !this.light
    this.scene.add(blockMesh)

    // Dashed center lines on every road.
    const dash = new THREE.PlaneGeometry(0.25, 3)
    dash.rotateX(-Math.PI / 2)
    const dashes: THREE.Matrix4[] = []
    for (let line = 0; line <= CELLS; line += 1) {
      const offset = -HALF + line * CELL
      for (let along = -HALF; along < HALF; along += 7) {
        dashes.push(new THREE.Matrix4().makeTranslation(offset, 0.02, along + 3.5))
        dashes.push(new THREE.Matrix4().makeRotationY(Math.PI / 2).setPosition(along + 3.5, 0.02, offset))
      }
    }
    const dashMesh = new THREE.InstancedMesh(dash, new THREE.MeshBasicMaterial({ color: '#e8e2cf' }), dashes.length)
    dashes.forEach((matrix, index) => dashMesh.setMatrixAt(index, matrix))
    this.scene.add(dashMesh)

    // The city ends at a low wall so nobody drives into the void.
    const limit = HALF + ROAD / 2
    this.obstacles.push(
      { minX: -limit - 10, maxX: -limit, minZ: -limit - 10, maxZ: limit + 10 },
      { minX: limit, maxX: limit + 10, minZ: -limit - 10, maxZ: limit + 10 },
      { minX: -limit - 10, maxX: limit + 10, minZ: -limit - 10, maxZ: -limit },
      { minX: -limit - 10, maxX: limit + 10, minZ: limit, maxZ: limit + 10 },
    )
  }

  private placeBuildings(models: THREE.Group[]) {
    const types = models.map((model) => bakeParts(model, { footprint: BLOCK - 10 }))
    const placements: THREE.Matrix4[][] = types.map(() => [])
    let seed = 7
    const random = () => {
      seed = (seed * 16807) % 2147483647
      return seed / 2147483647
    }
    const venues = new Set(VENUE_CELLS.map(([column, row]) => `${column},${row}`))

    for (let column = 0; column < CELLS; column += 1) {
      for (let row = 0; row < CELLS; row += 1) {
        const key = `${column},${row}`
        if (venues.has(key) || PARK_CELLS.has(key)) continue
        // Towers rise toward the middle of town; low buildings at the edges.
        const central = Math.max(Math.abs(column - 4.5), Math.abs(row - 4.5)) < 3
        const pool = central ? [1, 2, 3, 5] : [0, 1, 4, 5]
        const type = pool[Math.floor(random() * pool.length)]
        const turn = Math.floor(random() * 4) * (Math.PI / 2)
        const center = cellCenter(column, row)
        placements[type].push(new THREE.Matrix4().makeRotationY(turn).setPosition(center.x, SIDEWALK_HEIGHT, center.y))

        const size = types[type].size
        const quarter = Math.round(turn / (Math.PI / 2)) % 2 === 1
        const halfX = (quarter ? size.z : size.x) / 2
        const halfZ = (quarter ? size.x : size.z) / 2
        this.obstacles.push({ minX: center.x - halfX, maxX: center.x + halfX, minZ: center.y - halfZ, maxZ: center.y + halfZ })
      }
    }

    types.forEach((type, index) => this.scene.add(instance(type.parts, placements[index], { shadows: !this.light })))
  }

  private placeVenues(arenaModel: THREE.Group) {
    const arena = bakeParts(arenaModel, { footprint: BLOCK - 8 })
    const matrices: THREE.Matrix4[] = []

    VENUE_CELLS.forEach(([column, row], index) => {
      const world = WORLD_LIST[index]
      const center = cellCenter(column, row)
      matrices.push(new THREE.Matrix4().makeTranslation(center.x, SIDEWALK_HEIGHT, center.y))
      const halfX = arena.size.x / 2
      const halfZ = arena.size.z / 2
      this.obstacles.push({ minX: center.x - halfX, maxX: center.x + halfX, minZ: center.y - halfZ, maxZ: center.y + halfZ })

      // The entrance faces the park, on the side of the block closest to the middle of town.
      const towardCenter = new THREE.Vector2(-center.x, -center.y)
      const alongX = Math.abs(towardCenter.x) > Math.abs(towardCenter.y)
      const side = new THREE.Vector2(alongX ? Math.sign(towardCenter.x) : 0, alongX ? 0 : Math.sign(towardCenter.y))
      const edge = center.clone().add(side.clone().multiplyScalar(BLOCK / 2))
      const door = new THREE.Vector3(edge.x + side.x * (ROAD / 2 - 3), 0, edge.y + side.y * (ROAD / 2 - 3))

      const color = new THREE.Color(world.accent)
      this.addBeam(center, color, arena.size.y)
      this.addGate(edge, side, world.name, world.accent)

      const reach = alongX ? halfX : halfZ
      const entry = new THREE.Vector3(center.x + side.x * (reach + 0.4), 0, center.y + side.y * (reach + 0.4))
      this.addDoor(entry, side, world.accent)
      this.venues.push({
        worldId: world.id,
        name: `${world.name} World`,
        color: world.accent,
        door,
        center: new THREE.Vector3(center.x, 0, center.y),
        entry,
        box: { minX: center.x - halfX, maxX: center.x + halfX, minZ: center.y - halfZ, maxZ: center.y + halfZ },
      })
    })

    this.scene.add(instance(arena.parts, matrices, { shadows: !this.light }))
  }

  /** A column of light rising from the arena into the sky. */
  private addBeam(center: THREE.Vector2, color: THREE.Color, arenaHeight: number) {
    const height = 900
    const geometry = new THREE.CylinderGeometry(2.2, 7, height, 24, 1, true)
    geometry.translate(0, height / 2, 0)
    const material = new THREE.ShaderMaterial({
      uniforms: { color: { value: color }, time: { value: 0 } },
      vertexShader: `
        varying float vHeight;
        varying vec3 vNormalView;
        varying vec3 vView;
        void main() {
          vHeight = position.y / ${height.toFixed(1)};
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          vNormalView = normalize(normalMatrix * normal);
          vView = normalize(-mv.xyz);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: `
        uniform vec3 color;
        uniform float time;
        varying float vHeight;
        varying vec3 vNormalView;
        varying vec3 vView;
        void main() {
          float edge = pow(1.0 - abs(dot(vNormalView, vView)), 1.6);
          float fade = pow(1.0 - vHeight, 1.4);
          float pulse = 0.85 + 0.15 * sin(time * 1.6 - vHeight * 18.0);
          gl_FragColor = vec4(color * 1.6, (0.25 + 0.75 * (1.0 - edge)) * fade * pulse * 0.75);
        }`,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      fog: false,
    })
    const beam = new THREE.Mesh(geometry, material)
    beam.position.set(center.x, arenaHeight * 0.6, center.y)
    beam.frustumCulled = false
    this.beams.push(beam)
    this.scene.add(beam)

    const glow = new THREE.PointLight(color, 900, 90, 1.6)
    glow.position.set(center.x, arenaHeight + 6, center.y)
    this.scene.add(glow)
  }

  private readonly doors: THREE.Group[] = []

  /** A tall glowing door on the arena wall, with ENTER above it. It lights up when the visitor comes close. */
  private addDoor(entry: THREE.Vector3, side: THREE.Vector2, accent: string) {
    const door = new THREE.Group()
    const panel = new THREE.Mesh(new THREE.PlaneGeometry(6, 7.5), new THREE.MeshBasicMaterial({ color: accent, transparent: true, opacity: 0.85, toneMapped: false }))
    panel.position.y = 3.75
    door.add(panel)
    const frame = new THREE.Mesh(new THREE.BoxGeometry(7, 8.3, 0.3), new THREE.MeshStandardMaterial({ color: '#111216', metalness: 0.6, roughness: 0.3 }))
    frame.position.set(0, 4.15, -0.2)
    door.add(frame)
    const label = new THREE.Mesh(
      new THREE.PlaneGeometry(8, 2),
      new THREE.MeshBasicMaterial({ map: textTexture([{ text: 'ENTER ▸', size: 150, color: '#ffffff' }]), transparent: true, toneMapped: false }),
    )
    label.position.y = 9.4
    door.add(label)
    const light = new THREE.PointLight(accent, 30, 22, 1.4)
    light.position.set(0, 4, 2.5)
    door.add(light)
    door.position.set(entry.x, SIDEWALK_HEIGHT, entry.z)
    door.rotation.y = Math.atan2(side.x, side.y)
    door.userData.panel = panel
    door.userData.light = light
    this.doors.push(door)
    this.scene.add(door)
  }

  /** A lit gate with the world's name, where the visitor parks and walks in. */
  private addGate(edge: THREE.Vector2, side: THREE.Vector2, worldName: string, accent: string) {
    const gate = new THREE.Group()
    const frame = new THREE.MeshStandardMaterial({ color: '#15161c', metalness: 0.6, roughness: 0.35 })
    const glow = new THREE.MeshBasicMaterial({ color: accent })
    const width = 16
    for (const offset of [-width / 2, width / 2]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.8, 9, 0.8), frame)
      post.position.set(offset, 4.5, 0)
      gate.add(post)
      const strip = new THREE.Mesh(new THREE.BoxGeometry(0.2, 8.6, 0.85), glow)
      strip.position.set(offset, 4.5, 0)
      gate.add(strip)
    }
    const signTexture = textTexture([
      { text: worldName.toUpperCase(), size: 120, color: accent },
      { text: 'WORLD', size: 64, color: '#ffffff', weight: 700 },
    ])
    const sign = new THREE.Mesh(
      new THREE.PlaneGeometry(width + 2, (width + 2) / 4),
      new THREE.MeshBasicMaterial({ map: signTexture, transparent: true, side: THREE.DoubleSide, toneMapped: false }),
    )
    sign.position.set(0, 10.6, 0)
    gate.add(sign)
    const backing = new THREE.Mesh(new THREE.BoxGeometry(width + 2.4, (width + 2) / 4 + 0.6, 0.4), frame)
    backing.position.set(0, 10.6, -0.35)
    gate.add(backing)

    gate.position.set(edge.x - side.x * 2, SIDEWALK_HEIGHT, edge.y - side.y * 2)
    gate.rotation.y = Math.atan2(side.x, side.y)
    this.scene.add(gate)
  }

  private placeTrees(treeModel: THREE.Group) {
    const trees = bakeParts(treeModel, { height: 11 })
    // The pack holds two trees side by side; each placement shows a pair, rotated for variety.
    const matrices: THREE.Matrix4[] = []
    const add = (x: number, z: number, turn: number, scale: number) =>
      matrices.push(new THREE.Matrix4().makeRotationY(turn).scale(new THREE.Vector3(scale, scale, scale)).setPosition(x, SIDEWALK_HEIGHT, z))

    let seed = 11
    const random = () => {
      seed = (seed * 48271) % 2147483647
      return seed / 2147483647
    }
    for (let column = 0; column < CELLS; column += 1) {
      for (let row = 0; row < CELLS; row += 1) {
        const center = cellCenter(column, row)
        if (PARK_CELLS.has(`${column},${row}`)) {
          for (let index = 0; index < 7; index += 1) add(center.x + (random() - 0.5) * (BLOCK - 10), center.y + (random() - 0.5) * (BLOCK - 10), random() * 6.28, 0.6 + random() * 0.3)
          continue
        }
        // Street trees in the corners of every block.
        const inset = BLOCK / 2 - 2.5
        for (const [dx, dz] of [
          [-1, -1],
          [1, -1],
          [-1, 1],
          [1, 1],
        ]) {
          add(center.x + dx * inset, center.y + dz * inset, random() * 6.28, 0.32 + random() * 0.12)
        }
      }
    }
    this.scene.add(instance(trees.parts, matrices, { shadows: false }))
  }

  private setUpCar(carModel: THREE.Group) {
    const car = bakeParts(carModel.clone(true), { length: 4.4 })
    for (const part of car.parts) {
      const mesh = new THREE.Mesh(part.geometry, part.material as THREE.Material)
      mesh.castShadow = true
      this.car.add(mesh)
    }
    // Headlights so the car reads as alive at dusk.
    const beam = new THREE.SpotLight('#fff1d6', 60, 60, 0.5, 0.6, 1.2)
    beam.position.set(0, 0.9, 2)
    beam.target.position.set(0, 0, 18)
    this.car.add(beam, beam.target)

    // Start on the avenue beside the park, facing a beam.
    this.car.position.set(-HALF + 5 * CELL, 0, 20)
    this.heading = Math.PI
    this.scene.add(this.car)
  }

  // ---------------------------------------------------------------------------
  // Driving
  // ---------------------------------------------------------------------------

  /** Puts the car back in front of a venue's gate, facing the road (after leaving a hall). */
  parkAt(venue: Venue) {
    // On foot the visitor walks out of the gate; otherwise the car waits there.
    ;(this.walking ? this.avatar : this.car).position.copy(venue.door)
    const away = new THREE.Vector3().subVectors(venue.door, venue.center)
    this.heading = Math.atan2(away.x, away.z) + Math.PI / 2
    this.speed = 0
  }

  /** Swaps the vehicle (shop): body proportions, paint and top speed. */
  setVehicle(id: Vehicle['id'], paint?: string) {
    this.vehicle = VEHICLES.find((vehicle) => vehicle.id === id) ?? VEHICLES[0]
    this.car.scale.set(...this.vehicle.scale)
    if (paint) {
      // Repaint the biggest painted surface: the body.
      let body: THREE.MeshStandardMaterial | null = null
      let best = 0
      this.car.traverse((object) => {
        const mesh = object as THREE.Mesh
        if (!mesh.isMesh) return
        const size = mesh.geometry.boundingSphere?.radius ?? 0
        if (size > best && (mesh.material as THREE.MeshStandardMaterial).color) {
          best = size
          body = mesh.material as THREE.MeshStandardMaterial
        }
      })
      if (body) {
        const painted = (body as THREE.MeshStandardMaterial).clone()
        painted.color.set(paint)
        this.car.traverse((object) => {
          const mesh = object as THREE.Mesh
          if (mesh.isMesh && mesh.material === body) mesh.material = painted
        })
      }
    }
  }

  setOutfit(color: string) {
    this.outfit.color.set(color)
  }

  get isWalking() {
    return this.walking
  }

  /** Steps out of the vehicle to walk, or back in when standing next to it. Returns false if too far. */
  toggleWalk(): boolean {
    if (!this.walking) {
      if (this.avatar.children.length === 0) this.buildAvatar()
      this.dressAvatar()
      const side = new THREE.Vector3(Math.cos(this.heading) * 2.4, 0, -Math.sin(this.heading) * 2.4)
      this.avatar.position.copy(this.car.position).add(side)
      this.avatar.rotation.y = this.heading
      this.scene.add(this.avatar)
      this.walking = true
      this.speed = 0
      return true
    }
    // The car comes to the visitor, wherever it was left: one tap and you drive.
    const side = new THREE.Vector3(Math.cos(this.heading) * 2.4, 0, -Math.sin(this.heading) * 2.4)
    const spot = this.avatar.position.clone().add(side)
    this.car.position.copy(this.blocked(spot.x, spot.z) ? this.avatar.position : spot).setY(0)
    this.car.rotation.y = this.heading
    this.scene.remove(this.avatar)
    this.walking = false
    this.speed = 0
    this.heading = this.car.rotation.y
    return true
  }

  private buildAvatar() {
    const skin = new THREE.MeshStandardMaterial({ color: '#c58c62', roughness: 0.8 })
    const dark = new THREE.MeshStandardMaterial({ color: '#22232a', roughness: 0.9 })
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.34, 0.75, 6, 14), this.outfit)
    body.position.y = 1.15
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.24, 18, 14), skin)
    head.position.y = 1.95
    const legs = [-0.15, 0.15].map((x) => {
      const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.12, 0.55, 4, 8), dark)
      leg.position.set(x, 0.42, 0)
      return leg
    })
    for (const mesh of [body, head, ...legs]) {
      mesh.castShadow = true
      this.avatar.add(mesh)
    }
    this.avatar.userData.legs = legs
  }

  private blocked(x: number, z: number) {
    const radius = this.walking ? 0.5 : 1.6
    return this.obstacles.some((box) => x + radius > box.minX && x - radius < box.maxX && z + radius > box.minZ && z - radius < box.maxZ)
  }

  update(delta: number, input: DriveInput): CityState {
    const step = Math.min(delta, 0.05)
    this.elapsed += step

    // Arcade driving: responsive, forgiving, no spin-outs.
    const maxForward = this.walking ? 6 : this.vehicle.maxForward
    const maxReverse = this.walking ? 3 : 7
    if (input.brake) this.speed -= Math.sign(this.speed) * Math.min(Math.abs(this.speed), 30 * step)
    if (input.throttle > 0) this.speed += input.throttle * (this.speed < 0 ? 22 : 11) * step
    if (input.throttle < 0) this.speed += input.throttle * (this.speed > 0 ? 22 : 8) * step
    if (input.throttle === 0 && !input.brake) this.speed -= Math.sign(this.speed) * Math.min(Math.abs(this.speed), 4 * step)
    this.speed = THREE.MathUtils.clamp(this.speed, -maxReverse, maxForward)

    this.wheelTurn = THREE.MathUtils.lerp(this.wheelTurn, input.steer, Math.min(1, step * 8))
    const grip = this.walking ? 1 : Math.min(1, Math.abs(this.speed) / 6)
    this.heading -= this.wheelTurn * grip * step * (1.9 - Math.min(Math.abs(this.speed) / maxForward, 1) * 0.8) * Math.sign(this.speed || 1)

    const dx = Math.sin(this.heading) * this.speed * step
    const dz = Math.cos(this.heading) * this.speed * step
    const body = this.walking ? this.avatar : this.car
    const position = body.position
    // Slide along walls instead of stopping dead.
    // Already overlapping something (parked or summoned on a tight spot): drive out freely instead of sticking.
    if (this.blocked(position.x, position.z)) position.set(position.x + dx, 0, position.z + dz)
    else if (!this.blocked(position.x + dx, position.z + dz)) position.set(position.x + dx, 0, position.z + dz)
    else if (!this.blocked(position.x + dx, position.z)) position.x += dx
    else if (!this.blocked(position.x, position.z + dz)) position.z += dz
    else this.speed = 0

    body.rotation.y = this.heading
    if (this.walking) {
      // Simple stride: legs swing with speed.
      const swing = Math.sin(this.elapsed * 9) * Math.min(Math.abs(this.speed) / 4, 1) * 0.5
      const legs = this.avatar.userData.dressed ? null : (this.avatar.userData.legs as THREE.Mesh[])
      if (legs) {
        legs[0].rotation.x = swing
        legs[1].rotation.x = -swing
      } else this.avatar.position.y = Math.abs(swing) * 0.08
    } else {
      // A touch of body roll in turns.
      this.car.rotation.z = -this.wheelTurn * Math.min(Math.abs(this.speed) / maxForward, 1) * 0.05
    }

    this.updateCamera(step)
    this.moveWalkers(step)
    for (const beam of this.beams) (beam.material as THREE.ShaderMaterial).uniforms.time.value = this.elapsed

    // Shadows follow the car so they stay sharp where the visitor looks.
    this.sun.target.position.copy(position)
    this.sun.position.copy(position).add(new THREE.Vector3(-150, 220, -260))

    // Near = in front of the gate or anywhere around the arena walls.
    const distanceToArena = (venue: Venue) =>
      Math.hypot(Math.max(venue.box.minX - position.x, 0, position.x - venue.box.maxX), Math.max(venue.box.minZ - position.z, 0, position.z - venue.box.maxZ))
    const nearVenue = this.venues.find((venue) => venue.door.distanceTo(position) < 13 || distanceToArena(venue) < 14) ?? null
    // Doors breathe brighter as the visitor approaches.
    this.doors.forEach((door, index) => {
      const near = this.venues[index] === nearVenue
      ;(door.userData.panel.material as THREE.MeshBasicMaterial).opacity = near ? 0.75 + Math.sin(this.elapsed * 4) * 0.2 : 0.45
      ;(door.userData.light as THREE.PointLight).intensity = near ? 60 : 12
    })
    // On foot, stepping into the door walks you into the hall.
    const walkedIn = this.walking && nearVenue && nearVenue.entry.distanceTo(position) < 3.2 ? nearVenue : null
    return { position: position.clone(), heading: this.heading, speed: this.speed, nearVenue, walkedIn }
  }

  private readonly cameraTarget = new THREE.Vector3()
  private cameraReady = false

  private updateCamera(step: number) {
    const subject = this.walking ? this.avatar : this.car
    const distance = this.walking ? 5 : this.light ? 10.5 : 9
    const behind = new THREE.Vector3(-Math.sin(this.heading) * distance, this.walking ? 2.6 : 4.2, -Math.cos(this.heading) * distance)
    const desired = subject.position.clone().add(behind)
    if (!this.cameraReady) {
      this.camera.position.copy(desired)
      this.cameraReady = true
    }
    this.camera.position.lerp(desired, Math.min(1, step * 4))
    this.cameraTarget.lerp(subject.position.clone().add(new THREE.Vector3(0, 1.6, 0)), Math.min(1, step * 8))
    this.camera.lookAt(this.cameraTarget)
  }

  /** Bird's-eye data for the minimap. */
  get mapExtent() {
    return HALF + ROAD / 2
  }

  dispose() {
    this.scene.traverse((object) => {
      const mesh = object as THREE.Mesh
      if (!mesh.isMesh) return
      mesh.geometry.dispose()
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
      for (const material of materials) {
        const map = (material as THREE.MeshBasicMaterial).map
        if (map instanceof THREE.CanvasTexture) map.dispose()
      }
    })
  }
}

