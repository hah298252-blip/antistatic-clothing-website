import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useLocation, useOutlet } from 'react-router-dom'
import { useLenis } from 'lenis/react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import * as THREE from 'three'
import styles from './PageTransition.module.css'

gsap.registerPlugin(ScrollTrigger)

const VERTEX_SHADER = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const FRAGMENT_SHADER = `
  varying vec2 vUv;
  uniform float uProgress;
  uniform vec3 uColor;
  float rand(vec2 n) { return fract(sin(dot(n, vec2(12.9898, 4.1414))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 ip = floor(p);
    vec2 u = fract(p);
    u = u * u * (3.0 - 2.0 * u);
    float result = mix(mix(rand(ip), rand(ip + vec2(1.0, 0.0)), u.x), mix(rand(ip + vec2(0.0, 1.0)), rand(ip + vec2(1.0, 1.0)), u.x), u.y);
    return result * result;
  }
  void main() {
    float grain = noise(vUv * 5.0);
    float edge = 0.185;
    float dissolve = smoothstep(1.0 - uProgress - edge, 1.0 - uProgress + edge, grain);
    gl_FragColor = vec4(uColor, 1.0 - dissolve);
  }
`

const ROUTE_COLORS = {
  '/': '#ffffff',
  '/products': '#f4f2ec',
  '/about': '#f4e9da',
  '/contact': '#f4f2ec',
}

const getTransitionColor = (pathname) => ROUTE_COLORS[pathname] ?? '#ffffff'

export default function PageTransition({ onTransitionChange }) {
  const location = useLocation()
  const outlet = useOutlet()
  const lenis = useLenis()
  const webglLayerRef = useRef(null)
  const webglRef = useRef(null)
  const isTransitioningRef = useRef(false)
  const timelineRef = useRef(null)
  const [current, setCurrent] = useState(() => ({ key: location.key, pathname: location.pathname, outlet }))
  const [next, setNext] = useState(null)

  useEffect(() => {
    const layer = webglLayerRef.current
    if (!layer) return undefined

    const scene = new THREE.Scene()
    const cameraZ = 100
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 1000)
    camera.position.z = cameraZ
    scene.add(camera)
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true })
    renderer.setClearColor(0x000000, 0)
    layer.appendChild(renderer.domElement)

    const material = new THREE.ShaderMaterial({
      uniforms: {
        uColor: { value: new THREE.Color(getTransitionColor(location.pathname)) },
        uProgress: { value: 1.5 },
      },
      vertexShader: VERTEX_SHADER,
      fragmentShader: FRAGMENT_SHADER,
      transparent: true,
    })
    const geometry = new THREE.PlaneGeometry(1, 1)
    const mesh = new THREE.Mesh(geometry, material)
    scene.add(mesh)
    const render = () => renderer.render(scene, camera)
    const resize = () => {
      const width = window.innerWidth
      const height = window.innerHeight
      camera.aspect = width / height
      camera.fov = 2 * Math.atan(height / 2 / cameraZ) * (180 / Math.PI)
      camera.updateProjectionMatrix()
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1))
      renderer.setSize(width, height)
      mesh.scale.set(width, height, 1)
      render()
    }
    let frameId = 0
    const loop = () => {
      render()
      frameId = requestAnimationFrame(loop)
    }

    resize()
    loop()
    window.addEventListener('resize', resize)
    webglRef.current = { material, render }

    return () => {
      cancelAnimationFrame(frameId)
      window.removeEventListener('resize', resize)
      geometry.dispose()
      material.dispose()
      renderer.dispose()
      renderer.domElement.remove()
      webglRef.current = null
    }
  }, [])

  useLayoutEffect(() => {
    if (location.key === current.key || next || isTransitioningRef.current) return
    setNext({ key: location.key, pathname: location.pathname, outlet })
  }, [location.key, location.pathname, outlet, current.key, next])

  useLayoutEffect(() => {
    if (!next || isTransitioningRef.current) return undefined
    const webgl = webglRef.current
    const layer = webglLayerRef.current
    if (!webgl || !layer) {
      setCurrent(next)
      setNext(null)
      return undefined
    }

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const duration = reducedMotion ? 0.01 : 0.9
    isTransitioningRef.current = true
    onTransitionChange?.(true)
    lenis?.stop()
    webgl.material.uniforms.uColor.value.set(getTransitionColor(next.pathname))
    webgl.material.uniforms.uProgress.value = 1.5
    webgl.render()
    gsap.set(layer, { autoAlpha: 1, pointerEvents: 'auto' })

    const timeline = gsap.timeline()
    timelineRef.current = timeline
    timeline.to(webgl.material.uniforms.uProgress, { value: -0.75, duration, ease: 'power1.in', onUpdate: webgl.render })
    timeline.call(() => {
      if (lenis) lenis.scrollTo(0, { immediate: true, force: true })
      else window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
      setCurrent(next)
      setNext(null)
    })
    timeline.to(webgl.material.uniforms.uProgress, { value: 1.5, duration, ease: 'power1.out', onUpdate: webgl.render })
    timeline.call(() => {
      gsap.set(layer, { autoAlpha: 0, pointerEvents: 'none' })
      isTransitioningRef.current = false
      onTransitionChange?.(false)
      lenis?.start()
      ScrollTrigger.refresh(true)
      ScrollTrigger.update()
    })
    return undefined
  }, [next, lenis, onTransitionChange])

  useEffect(() => () => timelineRef.current?.kill(), [])

  return (
    <div className={styles.viewport} aria-live="polite">
      <div className={styles.container} key={current.key}>{current.outlet}</div>
      <div ref={webglLayerRef} className={styles.webglLayer} aria-hidden="true" />
    </div>
  )
}
