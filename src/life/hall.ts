import * as THREE from 'three'
import type { TalentWorld } from '@/types/domain'
import { LIFE_MODELS } from './assets'
import { figureGeometry, isLightDevice, loadModel, textTexture } from './models'

/**
 * Inside an arena: a concert hall of about a hundred seats, filled with an
 * audience, the stage lit in the world's color. The visitor sits in the
 * middle of the hall and can look around.
 */

const HALL_LENGTH = 34
const EYE_STANDING = 1.7
const WALK_SPEED = 3.2

export class Hall {
  readonly scene = new THREE.Scene()
  readonly camera = new THREE.PerspectiveCamera(62, 1, 0.1, 400)

  private readonly lights: THREE.SpotLight[] = []
  private yaw = 0
  private pitch = -0.06
  private baseYaw = 0
  private elapsed = 0

  async build(world: TalentWorld, signLine: string) {
    const peopleModel = await loadModel(LIFE_MODELS.crowd)
    const accent = new THREE.Color(world.accent)
    this.scene.background = new THREE.Color('#0a0709')
    this.scene.fog = new THREE.Fog('#0a0709', 40, 90)

    // A real theatre, built to measure: stage at +Z, raked seating rising toward the back (-Z).
    const W = 26
    const L = HALL_LENGTH
    const H = 13
    const hallBox = new THREE.Box3(new THREE.Vector3(-W / 2, 0, -L / 2), new THREE.Vector3(W / 2, H, L / 2))
    const toStage = new THREE.Vector3(0, 0, 1)
    const stage = new THREE.Vector3(0, 1.2, L / 2 - 4)

    this.buildRoom(W, L, H, accent)
    this.buildStage(W, L, accent)
    const seats = this.buildSeats(peopleModel)
    this.lightStage(stage, toStage, accent, hallBox)
    this.addScreen(stage, toStage, world, signLine, hallBox)

    this.seatedEye = seats.visitorEye
    this.baseYaw = Math.atan2(-toStage.x, -toStage.z)
    this.floorY = 0
    this.bounds = new THREE.Box3(new THREE.Vector3(-W / 2 + 1, 0, -L / 2 + 1), new THREE.Vector3(W / 2 - 1, H, L / 2 - 8))
    // Arrive at the back door, facing the stage.
    this.camera.position.set(0, seats.backFloor + EYE_STANDING, -L / 2 + 1.5)
    this.walkFloor = (z: number) => seats.floorAt(z)
    this.seated = false
    this.applyLook()
    this.warmTheRoom(hallBox, accent)
  }

  /** Floor height under the visitor (the seating is raked). */
  private walkFloor: (z: number) => number = () => 0

  private buildRoom(W: number, L: number, H: number, accent: THREE.Color) {
    const wall = new THREE.MeshStandardMaterial({ color: '#2a1a1f', roughness: 0.9 })
    const floor = new THREE.MeshStandardMaterial({ color: '#3b1d22', roughness: 0.95 })
    const ceiling = new THREE.MeshStandardMaterial({ color: '#141015', roughness: 1 })
    const add = (geometry: THREE.BufferGeometry, material: THREE.Material, x: number, y: number, z: number, ry = 0) => {
      const mesh = new THREE.Mesh(geometry, material)
      mesh.position.set(x, y, z)
      mesh.rotation.y = ry
      mesh.receiveShadow = true
      this.scene.add(mesh)
      return mesh
    }
    add(new THREE.BoxGeometry(W, 0.2, L), floor, 0, -0.1, 0)
    add(new THREE.BoxGeometry(W, 0.2, L), ceiling, 0, H, 0)
    add(new THREE.BoxGeometry(0.3, H, L), wall, -W / 2, H / 2, 0)
    add(new THREE.BoxGeometry(0.3, H, L), wall, W / 2, H / 2, 0)
    add(new THREE.BoxGeometry(W, H, 0.3), wall, 0, H / 2, -L / 2)
    add(new THREE.BoxGeometry(W, H, 0.3), wall, 0, H / 2, L / 2)
    // Wooden wall panels and glowing strips in the world's colour.
    const wood = new THREE.MeshStandardMaterial({ color: '#5a3523', roughness: 0.6 })
    const glow = new THREE.MeshBasicMaterial({ color: accent, toneMapped: false })
    for (const side of [-1, 1]) {
      for (let z = -L / 2 + 3; z < L / 2 - 6; z += 4) {
        add(new THREE.BoxGeometry(0.1, 5, 3.4), wood, side * (W / 2 - 0.2), 4, z)
        add(new THREE.BoxGeometry(0.06, 0.12, 3.4), glow, side * (W / 2 - 0.26), 6.7, z)
        const sconce = new THREE.PointLight('#ffb36b', 4, 9, 1.8)
        sconce.position.set(side * (W / 2 - 0.8), 6.2, z)
        this.scene.add(sconce)
      }
    }
    // Ceiling light rows.
    const bulb = new THREE.MeshBasicMaterial({ color: '#ffe2b8', toneMapped: false })
    for (let z = -L / 2 + 4; z < L / 2 - 6; z += 4) {
      for (const x of [-7, 0, 7]) add(new THREE.CylinderGeometry(0.35, 0.35, 0.05, 16), bulb, x, H - 0.1, z)
    }
  }

  private buildStage(W: number, L: number, accent: THREE.Color) {
    const boards = new THREE.MeshStandardMaterial({ color: '#6b4428', roughness: 0.45, metalness: 0.05 })
    const velvet = new THREE.MeshStandardMaterial({ color: '#7a0f1c', roughness: 0.85 })
    const stage = new THREE.Mesh(new THREE.BoxGeometry(W - 4, 1.2, 9), boards)
    stage.position.set(0, 0.6, L / 2 - 4.5)
    stage.receiveShadow = true
    this.scene.add(stage)
    // Lit edge of the stage.
    const edge = new THREE.Mesh(new THREE.BoxGeometry(W - 4, 0.08, 0.08), new THREE.MeshBasicMaterial({ color: accent, toneMapped: false }))
    edge.position.set(0, 1.22, L / 2 - 9)
    this.scene.add(edge)
    // Folded curtains on both sides and a valance on top.
    for (const side of [-1, 1]) {
      const curtain = new THREE.PlaneGeometry(4, 10, 24, 1)
      const position = curtain.getAttribute('position')
      for (let i = 0; i < position.count; i += 1) position.setZ(i, Math.sin(position.getX(i) * 6) * 0.18)
      curtain.computeVertexNormals()
      const mesh = new THREE.Mesh(curtain, velvet)
      mesh.material.side = THREE.DoubleSide
      mesh.position.set(side * (W / 2 - 4), 6.2, L / 2 - 8.6)
      mesh.rotation.y = Math.PI
      this.scene.add(mesh)
    }
    const valance = new THREE.Mesh(new THREE.BoxGeometry(W - 2, 1.6, 0.4), velvet)
    valance.position.set(0, 11.6, L / 2 - 8.6)
    this.scene.add(valance)
  }

  /** Raked rows of red seats, most of them taken by a seated audience. */
  private buildSeats(peopleModel: THREE.Group) {
    const rows = 11
    const columns = 18
    const pitch = 1.05
    const rise = 0.32
    const frontZ = 5
    const seatWidth = 0.62
    const floorAt = (z: number) => (z > frontZ + pitch / 2 ? 0 : THREE.MathUtils.clamp(Math.floor((frontZ - z) / pitch + 0.5) + 1, 1, rows) * rise)
    // Step platforms.
    const step = new THREE.MeshStandardMaterial({ color: '#3b1d22', roughness: 0.95 })
    for (let row = 0; row < rows; row += 1) {
      const platform = new THREE.Mesh(new THREE.BoxGeometry(22, rise * (row + 1), pitch), step)
      platform.position.set(0, (rise * (row + 1)) / 2, frontZ - row * pitch)
      platform.receiveShadow = true
      this.scene.add(platform)
    }
    // Back landing behind the last row, where the visitor comes in.
    const landingDepth = HALL_LENGTH / 2 - (rows - 1) * pitch + frontZ - pitch / 2
    const landing = new THREE.Mesh(new THREE.BoxGeometry(26, rise * rows, landingDepth), step)
    landing.position.set(0, (rise * rows) / 2, frontZ - (rows - 1) * pitch - pitch / 2 - landingDepth / 2)
    landing.receiveShadow = true
    this.scene.add(landing)
    // Seats (instanced: cushion + backrest).
    const red = new THREE.MeshStandardMaterial({ color: '#9d1b2b', roughness: 0.7 })
    const cushion = new THREE.InstancedMesh(new THREE.BoxGeometry(0.52, 0.14, 0.5), red, rows * columns)
    const back = new THREE.InstancedMesh(new THREE.BoxGeometry(0.54, 0.7, 0.1), red, rows * columns)
    const matrix = new THREE.Matrix4()
    let index = 0
    const aisle = (column: number) => column === 4 || column === 13
    const spots: THREE.Vector3[] = []
    for (let row = 0; row < rows; row += 1) {
      for (let column = 0; column < columns; column += 1) {
        if (aisle(column)) continue
        const x = (column - (columns - 1) / 2) * seatWidth * 1.15
        const z = frontZ - row * pitch
        const y = rise * (row + 1)
        cushion.setMatrixAt(index, matrix.makeTranslation(x, y + 0.45, z))
        back.setMatrixAt(index, matrix.makeTranslation(x, y + 0.85, z - 0.27))
        spots.push(new THREE.Vector3(x, y, z))
        index += 1
      }
    }
    cushion.count = index
    back.count = index
    this.scene.add(cushion, back)

    // The visitor's seat: row 6, centre.
    const mine = spots.reduce((best, spot) =>
      Math.abs(spot.z - (frontZ - 6 * pitch)) + Math.abs(spot.x) < Math.abs(best.z - (frontZ - 6 * pitch)) + Math.abs(best.x) ? spot : best,
    )

    // Audience: torso and head above the backrest, facing the stage.
    const figure = figureGeometry(peopleModel, 1.7)
    if (figure) {
      const palette = ['#2f3a56', '#7a2a3a', '#2d4a3e', '#6a4b2a', '#8a8f9a', '#1f2430', '#b0583a', '#4c3f75', '#d9c7a8', '#245a6b'].map((hex) => new THREE.Color(hex))
      const audience = new THREE.InstancedMesh(figure, new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.8 }), spots.length)
      let seed = 7
      const random = () => {
        seed = (seed * 16807) % 2147483647
        return seed / 2147483647
      }
      let count = 0
      for (const spot of spots) {
        if (spot === mine || random() < 0.18) continue
        matrix.makeRotationY(Math.PI + (random() - 0.5) * 0.25 + Math.PI).setPosition(spot.x, spot.y - 0.25, spot.z - 0.05)
        audience.setMatrixAt(count, matrix)
        audience.setColorAt(count, palette[Math.floor(random() * palette.length)])
        count += 1
      }
      audience.count = count
      if (audience.instanceColor) audience.instanceColor.needsUpdate = true
      this.scene.add(audience)
    }
    return { visitorEye: new THREE.Vector3(mine.x, mine.y + 1.2, mine.z), backFloor: floorAt(-HALL_LENGTH / 2 + 1.5), floorAt }
  }

  private lightStage(stage: THREE.Vector3, toStage: THREE.Vector3, accent: THREE.Color, hall: THREE.Box3) {
    const across = new THREE.Vector3(toStage.z, 0, -toStage.x)
    const top = hall.max.y - 0.6
    const colors = [accent, new THREE.Color('#ffffff'), accent]
    ;[-5, 0, 5].forEach((offset, index) => {
      const light = new THREE.SpotLight(colors[index], index === 1 ? 260 : 420, 50, 0.42, 0.55, 1.4)
      light.position.copy(stage).addScaledVector(toStage, -9).addScaledVector(across, offset)
      light.position.y = top
      light.target.position.copy(stage).addScaledVector(across, offset * 0.4)
      light.castShadow = !isLightDevice() && index === 1
      this.scene.add(light, light.target)
      this.lights.push(light)
    })
    const wash = new THREE.PointLight(accent, 120, 30, 1.8)
    wash.position.copy(stage).add(new THREE.Vector3(0, 4, 0))
    this.scene.add(wash)
  }

  private addScreen(stage: THREE.Vector3, toStage: THREE.Vector3, world: TalentWorld, signLine: string, hall: THREE.Box3) {
    const texture = textTexture(
      [
        { text: `${world.name.toUpperCase()} WORLD`, size: 120, color: world.accent },
        { text: signLine, size: 58, color: '#ffffff', weight: 600 },
      ],
      2048,
      640,
    )
    const height = Math.min(6, (hall.max.y - hall.min.y) * 0.45)
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(height * 2.56, height), new THREE.MeshBasicMaterial({ map: texture, toneMapped: false }))
    screen.position.copy(stage).addScaledVector(toStage, 1.2)
    screen.position.y = hall.min.y + 2.6 + height / 2
    screen.lookAt(stage.clone().addScaledVector(toStage, -20).setY(screen.position.y))
    this.scene.add(screen)
    this.screen = screen
    this.screenSign = texture
  }

  private screen: THREE.Mesh | null = null
  private screenSign: THREE.Texture | null = null
  private liveTexture: THREE.VideoTexture | null = null

  /** Shows a live video on the big stage screen (null brings the world sign back). */
  showLive(video: HTMLVideoElement | null) {
    const material = this.screen?.material as THREE.MeshBasicMaterial | undefined
    if (!material) return
    this.liveTexture?.dispose()
    this.liveTexture = null
    if (video) {
      this.liveTexture = new THREE.VideoTexture(video)
      this.liveTexture.colorSpace = THREE.SRGBColorSpace
      material.map = this.liveTexture
    } else material.map = this.screenSign
    material.needsUpdate = true
  }

  private seatedEye = new THREE.Vector3()
  private seated = false
  private floorY = 0
  private bounds = new THREE.Box3()

  /** Sit in the free seat kept for the visitor, or stand up in the aisle next to it. */
  setSeated(seated: boolean) {
    this.seated = seated
    const eye = this.seatedEye.clone()
    if (!seated) eye.y = this.walkFloor(eye.z) + EYE_STANDING
    this.camera.position.copy(eye)
    this.yaw = 0
    this.pitch = -0.06
    this.applyLook()
  }

  /** Soft wall lights and a glow in the world's color, so every hall feels warm and alive. */
  private warmTheRoom(box: THREE.Box3, accent: THREE.Color) {
    // House lights: the room must be readable, not a black box.
    this.scene.add(new THREE.HemisphereLight('#fff1dd', '#2a2030', 1.4))
    const height = box.max.y - 1
    const corners = [
      [box.min.x + 1, box.min.z + 1],
      [box.max.x - 1, box.min.z + 1],
      [box.min.x + 1, box.max.z - 1],
      [box.max.x - 1, box.max.z - 1],
    ]
    corners.forEach(([x, z], index) => {
      const light = new THREE.PointLight(index % 2 ? '#ffb877' : accent, 6, 26, 1.6)
      light.position.set(x, height, z)
      this.scene.add(light)
    })
    const glow = new THREE.Mesh(
      new THREE.PlaneGeometry(box.max.x - box.min.x, box.max.z - box.min.z),
      new THREE.MeshBasicMaterial({ color: accent, transparent: true, opacity: 0.06, depthWrite: false }),
    )
    glow.rotation.x = -Math.PI / 2
    glow.position.set((box.min.x + box.max.x) / 2, this.floorY + 0.02, (box.min.z + box.max.z) / 2)
    this.scene.add(glow)
  }

  get isSeated() {
    return this.seated
  }

  /** Look around from the seat by dragging. */
  look(deltaX: number, deltaY: number) {
    this.yaw = this.seated ? THREE.MathUtils.clamp(this.yaw - deltaX * 0.005, -1.4, 1.4) : this.yaw - deltaX * 0.005
    this.pitch = THREE.MathUtils.clamp(this.pitch - deltaY * 0.004, -0.5, 0.45)
    this.applyLook()
  }

  private applyLook() {
    this.camera.rotation.set(this.pitch, this.baseYaw + this.yaw, 0, 'YXZ')
  }

  update(delta: number, input?: { throttle: number; steer: number }) {
    this.elapsed += delta
    // On foot: walk where you look (up/down), turn with left/right; walls keep you inside.
    if (!this.seated && input) {
      const step = Math.min(delta, 0.05)
      this.yaw -= input.steer * 1.8 * step
      const facing = this.baseYaw + this.yaw
      const move = input.throttle * WALK_SPEED * step
      const position = this.camera.position
      position.x = THREE.MathUtils.clamp(position.x - Math.sin(facing) * move, this.bounds.min.x, this.bounds.max.x)
      position.z = THREE.MathUtils.clamp(position.z - Math.cos(facing) * move, this.bounds.min.z, this.bounds.max.z)
      position.y = this.walkFloor(position.z) + EYE_STANDING + Math.abs(Math.sin(this.elapsed * 8)) * 0.04 * Math.abs(input.throttle)
      this.applyLook()
    }
    // Stage lights sweep slowly, like during a show.
    this.lights.forEach((light, index) => {
      if (index === 1) return
      light.target.position.x += Math.sin(this.elapsed * 0.8 + index) * 0.02
      light.target.position.z += Math.cos(this.elapsed * 0.6 + index) * 0.02
    })
  }

  dispose() {
    this.scene.traverse((object) => {
      const mesh = object as THREE.Mesh
      if (mesh.isMesh) mesh.geometry.dispose()
    })
  }
}
