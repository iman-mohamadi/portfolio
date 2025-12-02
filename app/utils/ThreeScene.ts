// utils/ThreeScene.ts
import * as THREE from 'three'

export class ThreeScene {
  private scene: THREE.Scene
  private camera: THREE.PerspectiveCamera
  private renderer: THREE.WebGLRenderer
  private cube: THREE.Mesh
  private animationFrameId: number | null = null

  constructor() {
    this.scene = new THREE.Scene()
    this.camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000)
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })

    // Create a simple cube
    const geometry = new THREE.BoxGeometry()
    const material = new THREE.MeshStandardMaterial({ color: 0x00ff00 })
    this.cube = new THREE.Mesh(geometry, material)

    this.setup()
  }

  private setup() {
    this.camera.position.z = 5
    this.scene.add(this.cube)

    // Add some lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5)
    this.scene.add(ambientLight)
    const pointLight = new THREE.PointLight(0xffffff, 0.8)
    pointLight.position.set(5, 5, 5)
    this.scene.add(pointLight)
  }

  // Call this method from the Vue component's onMounted hook
  public init(canvas: HTMLCanvasElement) {
    this.renderer.setSize(canvas.clientWidth, canvas.clientHeight)
    this.renderer.setPixelRatio(window.devicePixelRatio)
    canvas.appendChild(this.renderer.domElement)
    this.updateSize(canvas.clientWidth, canvas.clientHeight)
    this.animate()
  }

  // The animation loop
  private animate() {
    this.animationFrameId = requestAnimationFrame(() => this.animate())

    this.cube.rotation.x += 0.01
    this.cube.rotation.y += 0.01

    this.renderer.render(this.scene, this.camera)
  }

  // Update camera and renderer on window resize
  public updateSize(width: number, height: number) {
    this.camera.aspect = width / height
    this.camera.updateProjectionMatrix()
    this.renderer.setSize(width, height)
  }

  // Cleanup resources when the component is unmounted
  public cleanup() {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId)
    }
    this.renderer.dispose()
    // You should also dispose geometries, materials, textures etc.
  }
}
