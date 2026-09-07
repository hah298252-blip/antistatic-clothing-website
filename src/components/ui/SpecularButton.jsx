import { useEffect, useRef } from 'react'
import { Color, Mesh, Program, Renderer, Triangle } from 'ogl'
import './SpecularButton.css'

const PAD = 20
const vertex = `#version 300 es
in vec2 position;
void main() { gl_Position = vec4(position, 0.0, 1.0); }`
const fragment = `#version 300 es
precision highp float;
uniform vec2 uCenter, uHalfSize;
uniform float uRadius, uAngle, uPx, uIntensity, uShineSize, uShineFade, uThickness, uBaseWidth;
uniform vec3 uLineColor, uBaseColor;
out vec4 fragColor;
float roundedRect(vec2 p, vec2 b, float r) { vec2 q = abs(p) - b + r; return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r; }
float gaussian(float d, float s) { float x = d / (s + .000001); return exp(-mix(1., 1.6, smoothstep(0., 1.5, x)) * x * x); }
void main() {
  vec2 p = gl_FragCoord.xy - uCenter;
  float d = roundedRect(p, uHalfSize, uRadius);
  vec2 light = vec2(cos(uAngle), sin(uAngle));
  float base = (1. - smoothstep(0., uBaseWidth, abs(d))) * .45;
  vec2 normal = normalize(p / (uHalfSize * uHalfSize) + .000001);
  float phi = acos(clamp(abs(dot(normal, light)), 0., 1.));
  float rim = 1. - smoothstep(uShineSize - uShineFade, uShineSize + uShineFade + .0001, phi);
  float edge = 1. - smoothstep(.5 * uPx, 3. * uPx, abs(d));
  float shine = gaussian(d, uThickness) * rim * edge * uIntensity;
  fragColor = vec4(uBaseColor * base + uLineColor * shine, clamp(base + shine, 0., 1.));
}`

export default function SpecularButton({ children, className = '', onClick, radius = 18, textColor = '#f5f5f5', background = 'rgba(255, 255, 255, .035)', hoverBackground = 'rgba(255, 255, 255, .08)', lineColor = '#fff', baseColor = '#525252', intensity = 1, shineSize = 10, shineFade = 40, thickness = 1, speed = .35, proximity = 250 }) {
  const buttonRef = useRef(null)
  const effectRef = useRef(null)
  const propsRef = useRef({})
  propsRef.current = { radius, lineColor, baseColor, intensity, shineSize, shineFade, thickness, speed, proximity }

  useEffect(() => {
    const button = buttonRef.current
    const effect = effectRef.current
    if (!button || !effect) return undefined
    const dpr = window.devicePixelRatio || 1
    const renderer = new Renderer({ alpha: true, premultipliedAlpha: true, antialias: true, dpr })
    const gl = renderer.gl
    gl.clearColor(0, 0, 0, 0); gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA)
    const geometry = new Triangle(gl)
    if (geometry.attributes.uv) delete geometry.attributes.uv
    const program = new Program(gl, { vertex, fragment, uniforms: {
      uCenter: { value: [0, 0] }, uHalfSize: { value: [1, 1] }, uRadius: { value: 0 }, uAngle: { value: 2.4 }, uPx: { value: dpr },
      uLineColor: { value: [1, 1, 1] }, uBaseColor: { value: [.32, .32, .32] }, uIntensity: { value: 1 },
      uShineSize: { value: .17 }, uShineFade: { value: .7 }, uThickness: { value: 1 }, uBaseWidth: { value: dpr },
    } })
    const mesh = new Mesh(gl, { geometry, program })
    effect.appendChild(gl.canvas)
    const size = { width: 1, height: 1 }
    const resize = () => {
      const rect = button.getBoundingClientRect()
      size.width = rect.width; size.height = rect.height
      renderer.setSize(rect.width + PAD * 2, rect.height + PAD * 2)
      program.uniforms.uCenter.value = [(PAD + rect.width / 2) * dpr, (PAD + rect.height / 2) * dpr]
      program.uniforms.uHalfSize.value = [(rect.width / 2) * dpr, (rect.height / 2) * dpr]
    }
    const observer = new ResizeObserver(resize); observer.observe(button); resize()
    let targetAngle = null; let proximityT = 0
    const move = (event) => {
      const rect = button.getBoundingClientRect(), cx = rect.left + rect.width / 2, cy = rect.top + rect.height / 2
      const distance = Math.hypot(Math.max(rect.left - event.clientX, 0, event.clientX - rect.right), Math.max(rect.top - event.clientY, 0, event.clientY - rect.bottom))
      targetAngle = distance ? Math.atan2(cy - event.clientY, event.clientX - cx) : Math.atan2(2 / rect.height, -2 / rect.width)
      const t = Math.max(0, 1 - distance / Math.max(propsRef.current.proximity, 1)); proximityT = t * t * (3 - 2 * t)
    }
    window.addEventListener('pointermove', move)
    const line = new Color(), base = new Color(); let angle = 2.4, idleAngle = angle, brightness = 0, last = performance.now(), frame = 0
    const render = (now) => {
      frame = requestAnimationFrame(render)
      const delta = Math.min((now - last) / 1000, .05); last = now; const props = propsRef.current
      idleAngle += props.speed * delta
      const target = targetAngle === null ? idleAngle : targetAngle
      angle += (((target - angle + Math.PI * 3) % (Math.PI * 2)) - Math.PI) * (1 - Math.exp(-delta * 7))
      brightness += (proximityT - brightness) * (1 - Math.exp(-delta * 8)); line.set(props.lineColor); base.set(props.baseColor)
      program.uniforms.uAngle.value = angle; program.uniforms.uRadius.value = Math.min(props.radius, Math.min(size.width, size.height) / 2) * dpr
      program.uniforms.uLineColor.value = [line.r, line.g, line.b]; program.uniforms.uBaseColor.value = [base.r, base.g, base.b]
      program.uniforms.uIntensity.value = props.intensity * brightness; program.uniforms.uShineSize.value = props.shineSize * Math.PI / 180
      program.uniforms.uShineFade.value = props.shineFade * Math.PI / 180; program.uniforms.uThickness.value = props.thickness * dpr
      renderer.render({ scene: mesh })
    }
    frame = requestAnimationFrame(render)
    return () => { cancelAnimationFrame(frame); observer.disconnect(); window.removeEventListener('pointermove', move); gl.canvas.remove(); gl.getExtension('WEBGL_lose_context')?.loseContext() }
  }, [])

  return <button ref={buttonRef} type="button" onClick={onClick} className={`specularButton ${className}`} style={{ '--sb-text': textColor, '--sb-background': background, '--sb-hover-background': hoverBackground }}>
    <span ref={effectRef} className="specularButtonEffect" aria-hidden="true" />
    <span className="specularButtonLabel">{children}</span>
  </button>
}
