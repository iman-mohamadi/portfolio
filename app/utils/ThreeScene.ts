// utils/ThreeScene.ts
import * as THREE from "three"
import gsap from "gsap"

export class ThreeScene {
  private scene!: THREE.Scene
  private camera!: THREE.PerspectiveCamera
  private renderer!: THREE.WebGLRenderer
  private particlesMesh!: THREE.Points
  private animationFrameId: number | null = null

  // Interaction State
  private mouse = { x: 0, y: 0 }
  private targetScroll = 0

  constructor() {
    if (typeof window === "undefined") return

    this.scene = new THREE.Scene()

    // Minimal Fog to blend particles into the background depth
    this.scene.fog = new THREE.FogExp2(0x000000, 0.02)

    this.camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000)
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: "high-performance"
    })

    this.setup()
  }

  private setup() {
    this.camera.position.z = 6
    this.camera.position.y = 0

    // Create the Main Object
    this.createModernParticles()
  }

  // --------------------------------------------
  //  ✨ The "Cool" Part: Abstract Particle Sphere
  // --------------------------------------------
  private createModernParticles() {
    // 1. Create a high-detail Icosahedron (looks like a sphere)
    const geometry = new THREE.IcosahedronGeometry(2.5, 12) // Radius 2.5, Detail 12

    // 2. Create the Material (Dots)
    const material = new THREE.PointsMaterial({
      size: 0.015,         // Very small, elegant dots
      color: 0xffffff,     // White (will be dimmed by opacity)
      transparent: true,
      opacity: 0.6,        // Minimal look
      blending: THREE.AdditiveBlending // Makes overlapping dots glow
    })

    // 3. Create the Mesh
    this.particlesMesh = new THREE.Points(geometry, material)
    this.scene.add(this.particlesMesh)
  }

  // --------------------------------------------
  //  Init & Render Loop
  // --------------------------------------------
  public init(container: HTMLElement) {
    if (!this.renderer) return

    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)) // Limit pixel ratio for performance
    this.renderer.setSize(container.clientWidth, container.clientHeight)
    container.appendChild(this.renderer.domElement)

    this.animate()
  }

  private animate() {
    this.animationFrameId = requestAnimationFrame(() => this.animate())

    if (this.particlesMesh) {
      // 1. Constant minimal rotation (Idling)
      this.particlesMesh.rotation.y += 0.001
      this.particlesMesh.rotation.x += 0.0005

      // 2. Mouse Parallax (Smooth follow)
      // We gently tilt the sphere based on mouse position
      gsap.to(this.particlesMesh.rotation, {
        x: "+=" + this.mouse.y * 0.05,
        y: "+=" + this.mouse.x * 0.05,
        duration: 1,
        ease: "power2.out"
      })
    }

    this.renderer.render(this.scene, this.camera)
  }

  // --------------------------------------------
  //  Event Handlers
  // --------------------------------------------

  // Called when user scrolls
  public onScroll(scrollY: number, totalHeight: number) {
    if (!this.particlesMesh) return

    // Calculate scroll percentage (0 to 1)
    const scrollPercent = scrollY / (totalHeight - window.innerHeight)

    // GSAP Magic:
    // As you scroll down, the sphere scales up and rotates faster
    gsap.to(this.particlesMesh.scale, {
      x: 1 + scrollPercent * 0.5, // Grow by 50%
      y: 1 + scrollPercent * 0.5,
      z: 1 + scrollPercent * 0.5,
      duration: 1,
      ease: "power2.out"
    })

    gsap.to(this.particlesMesh.rotation, {
      z: scrollPercent * Math.PI * 2, // Full rotation on Z axis
      duration: 1.5,
      ease: "power2.out"
    })

    // Move camera slightly for depth effect
    gsap.to(this.camera.position, {
        y: -scrollPercent * 2, // Move camera down slightly
        duration: 1,
        ease: "power1.out"
    })
  }

  // Called when mouse moves
  public onMouseMove(clientX: number, clientY: number) {
    // Normalize coordinates to -1 to 1
    this.mouse.x = (clientX / window.innerWidth) * 2 - 1
    this.mouse.y = -(clientY / window.innerHeight) * 2 + 1
  }

  public updateSize(width: number, height: number) {
    if (!this.renderer) return
    this.camera.aspect = width / height
    this.camera.updateProjectionMatrix()
    this.renderer.setSize(width, height)
  }

  public cleanup() {
    if (this.animationFrameId) cancelAnimationFrame(this.animationFrameId)
    if (this.renderer) this.renderer.dispose()
    if (this.particlesMesh) {
        this.particlesMesh.geometry.dispose();
        (this.particlesMesh.material as THREE.Material).dispose();
    }
  }
}
