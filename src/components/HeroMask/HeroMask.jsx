import { useRef, useLayoutEffect, useState } from 'react'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import BgShaderImage from '../BgShaderImage/BgShaderImage'
import styles from './HeroMask.module.css'

gsap.registerPlugin(ScrollTrigger)

const LOGO_W = 420
const LOGO_H = 220

const PATH_CIRCLE =
  'M55 194C66.598 194 76 184.598 76 173C76 161.402 66.598 152 55 152C43.402 152 34 161.402 34 173C34 184.598 43.402 194 55 194Z'

const PATH_MAIN =
  'M195.881 14.5021C203.546 7.74601 212.937 3.38634 223.62 4.30095C233.833 5.17528 242.577 10.6618 249.843 17.8439L386.5 164C392.208 169.223 391.729 177.299 386.5 183C381.353 188.612 366.5 183 366.5 183L302 116L195.522 135C187.781 135 181.506 128.732 181.506 121C181.506 113.268 187.781 104.5 195.522 104.5L278 88.5L230.726 38.3224C230.576 38.1846 230.428 38.0438 230.283 37.8996C225.587 33.2087 222.573 32.3137 221.227 32.1984C220.245 32.1143 218.166 32.2497 214.579 35.3644L94.1482 149.17C88.525 154.484 79.6542 154.238 74.3345 148.621C69.0147 143.005 69.2608 134.144 74.8839 128.83L195.522 14.8302L195.881 14.5021Z'

// Reuse the expensive CPU-side distance field when the home route remounts.
let sdfCache = null

// ─── SDF: Felzenszwalb exact Euclidean distance transform ────────────────────

function dt1D(f, n) {
  const INF = 1e20
  const d = new Float32Array(n)
  const v = new Int32Array(n)
  const z = new Float32Array(n + 1)
  let k = 0
  v[0] = 0
  z[0] = -INF
  z[1] = INF
  for (let q = 1; q < n; q++) {
    let s = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * (q - v[k]))
    while (k > 0 && s <= z[k]) {
      k--
      s = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * (q - v[k]))
    }
    k++
    v[k] = q
    z[k] = s
    z[k + 1] = INF
  }
  k = 0
  for (let q = 0; q < n; q++) {
    while (z[k + 1] < q) k++
    d[q] = (q - v[k]) * (q - v[k]) + f[v[k]]
  }
  return d
}

function dt2D(field, w, h) {
  const tmp = new Float32Array(w * h)
  const row = new Float32Array(w)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) row[x] = field[y * w + x]
    const d = dt1D(row, w)
    for (let x = 0; x < w; x++) tmp[y * w + x] = d[x]
  }
  const result = new Float32Array(w * h)
  const col = new Float32Array(h)
  for (let x = 0; x < w; x++) {
    for (let y = 0; y < h; y++) col[y] = tmp[y * w + x]
    const d = dt1D(col, h)
    for (let y = 0; y < h; y++) result[y * w + x] = d[y]
  }
  return result
}

function createSDFTexture(gl) {
  const scale = 8
  const w = LOGO_W * scale   // 3360
  const h = LOGO_H * scale   // 1760
  const INF = 1e20

  if (sdfCache) {
    const tex = gl.createTexture()
    gl.bindTexture(gl.TEXTURE_2D, tex)
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, w, h, 0, gl.LUMINANCE, gl.UNSIGNED_BYTE, sdfCache)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    return tex
  }

  // Draw logo paths to offscreen canvas
  const mc = document.createElement('canvas')
  mc.width = w
  mc.height = h
  const ctx = mc.getContext('2d')
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, w, h)
  ctx.save()
  ctx.scale(scale, scale)
  ctx.fillStyle = '#000'
  ctx.fill(new Path2D(PATH_CIRCLE))
  ctx.fill(new Path2D(PATH_MAIN))
  ctx.restore()

  const pixels = ctx.getImageData(0, 0, w, h).data
  const count = w * h

  // inside[i] = 1 → black logo path pixel → hole (transparent)
  const inside = new Uint8Array(count)
  for (let i = 0; i < count; i++) inside[i] = pixels[i * 4] < 128 ? 1 : 0

  // Seed arrays for two DTs
  const seedIn  = new Float32Array(count)  // seeded at inside pixels
  const seedOut = new Float32Array(count)  // seeded at outside pixels
  for (let i = 0; i < count; i++) {
    seedIn[i]  = inside[i] ? 0 : INF
    seedOut[i] = inside[i] ? INF : 0
  }

  // dt_in[i]  = squared Euclidean distance to nearest inside pixel
  // dt_out[i] = squared Euclidean distance to nearest outside pixel
  const dt_in  = dt2D(seedIn,  w, h)
  const dt_out = dt2D(seedOut, w, h)

  // Signed distance: negative inside (hole), positive outside (overlay)
  // Normalized: 0.5 = edge,  0 = deep inside,  1 = deep outside
  const maxDist = 48  // SDF texels (~12 logo px); controls transition range
  const sdfBytes = new Uint8Array(count)
  for (let i = 0; i < count; i++) {
    const sd = inside[i]
      ? -Math.sqrt(dt_out[i])
      :  Math.sqrt(dt_in[i])
    const norm = 0.5 + sd / (2 * maxDist)
    sdfBytes[i] = Math.max(0, Math.min(255, Math.round(norm * 255)))
  }
  sdfCache = sdfBytes

  const tex = gl.createTexture()
  gl.bindTexture(gl.TEXTURE_2D, tex)
  // No Y-flip: canvas row 0 (logo top) → texture UV y=0; shader uses cssUv
  // which maps logo-top to localUv.y=0, so they match directly.
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false)
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, w, h, 0, gl.LUMINANCE, gl.UNSIGNED_BYTE, sdfBytes)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
  return tex
}

// ─── Shaders ─────────────────────────────────────────────────────────────────

const VERT = `
attribute vec2 aPos;
varying vec2 vUv;
void main() {
  vUv = aPos * 0.5 + 0.5;
  gl_Position = vec4(aPos, 0.0, 1.0);
}
`

const FRAG = `
precision highp float;
varying vec2 vUv;

uniform sampler2D uSDF;
uniform vec2  uTranslateNorm;
uniform vec2  uScaleNorm;
uniform float uProgress;
uniform float uTime;
uniform vec2  uMouse;
uniform float uMouseActive;

float sampleSDF(vec2 cssUv) {
  vec2 localUv = (cssUv - uTranslateNorm) / uScaleNorm;
  if (localUv.x < 0.0 || localUv.x > 1.0 ||
      localUv.y < 0.0 || localUv.y > 1.0) {
    return 1.0;
  }
  return texture2D(uSDF, localUv).r;
}

void main() {
  vec2 cssUv = vec2(vUv.x, 1.0 - vUv.y);

  // ── Logo bounding box (CSS UV space) ────────────────────────────────────
  float logoLeft   = uTranslateNorm.x;
  float logoRight  = uTranslateNorm.x + uScaleNorm.x;
  float logoTop    = uTranslateNorm.y;
  float logoBottom = uTranslateNorm.y + uScaleNorm.y;

  // How close is each logo edge to its screen boundary?
  float contactLeft   = 1.0 - smoothstep(0.0, 0.45, abs(logoLeft));
  float contactRight  = 1.0 - smoothstep(0.0, 0.45, abs(1.0 - logoRight));
  float contactTop    = 1.0 - smoothstep(0.0, 0.45, abs(logoTop));
  float contactBottom = 1.0 - smoothstep(0.0, 0.45, abs(1.0 - logoBottom));

  // ── SDF edge gate ────────────────────────────────────────────────────────
  float rawSDF   = sampleSDF(cssUv);
  float sd0      = rawSDF - 0.5;
  float edgeGate = 1.0 - smoothstep(0.01, 0.30, abs(sd0));

  float progressGate = smoothstep(0.02, 0.20, uProgress);

  // ── Virtual pressure points — one moving point per screen edge ───────────
  // Each point slides along its edge over time, so the effect is a local
  // circular blob (identical to mouse hover), not a uniform line push.
  float slideV = 0.5 + sin(uTime * 0.35) * 0.28;        // Y along left / right edge
  float slideH = 0.5 + sin(uTime * 0.30 + 0.8) * 0.28;  // X along top  / bottom edge

  vec2 vpLeft   = vec2(-0.08, slideV);
  vec2 vpRight  = vec2( 1.08, slideV);
  vec2 vpTop    = vec2(slideH, -0.08);
  vec2 vpBottom = vec2(slideH,  1.08);

  // Each edge contributes independently; all four can fire simultaneously.
  vec2 edgeContactFlow = vec2(0.0);

  float dL   = distance(cssUv, vpLeft);
  float infL = (1.0 - smoothstep(0.0, 0.55, dL)) * contactLeft * progressGate * edgeGate;
  edgeContactFlow += normalize(cssUv - vpLeft   + vec2(0.0001)) * infL * 0.048;

  float dR   = distance(cssUv, vpRight);
  float infR = (1.0 - smoothstep(0.0, 0.55, dR)) * contactRight * progressGate * edgeGate;
  edgeContactFlow += normalize(cssUv - vpRight  + vec2(0.0001)) * infR * 0.048;

  float dT   = distance(cssUv, vpTop);
  float infT = (1.0 - smoothstep(0.0, 0.55, dT)) * contactTop * progressGate * edgeGate;
  edgeContactFlow += normalize(cssUv - vpTop    + vec2(0.0001)) * infT * 0.048;

  float dB   = distance(cssUv, vpBottom);
  float infB = (1.0 - smoothstep(0.0, 0.55, dB)) * contactBottom * progressGate * edgeGate;
  edgeContactFlow += normalize(cssUv - vpBottom + vec2(0.0001)) * infB * 0.048;

  // ── Mouse flow ───────────────────────────────────────────────────────────
  float mouseDist      = distance(cssUv, uMouse);
  float mouseInfluence = (1.0 - smoothstep(0.0, 0.18, mouseDist)) * uMouseActive;
  vec2  mouseDir       = normalize(cssUv - uMouse + vec2(0.0001, 0.0001));
  vec2  mouseFlow      = mouseDir * mouseInfluence * 0.014;

  // ── Compose & cap total flow ─────────────────────────────────────────────
  vec2  flow    = mouseFlow + edgeContactFlow;
  float flowLen = length(flow);
  if (flowLen > 0.052) flow = normalize(flow) * 0.052;

  // ── Sample SDF at distorted UV ───────────────────────────────────────────
  vec2  distortedUv = cssUv - flow;
  float sdfVal      = sampleSDF(distortedUv);
  float sd          = sdfVal - 0.5;

  // One continuous feather from the transparent logo interior to the
  // opaque white exterior. Keeping it as a single curve avoids a dark seam.
  float finalAlpha = smoothstep(-0.34, 0.018, sd);
  finalAlpha = pow(finalAlpha, 0.72);

  gl_FragColor = vec4(1.0, 1.0, 1.0, finalAlpha);
}
`

// ─── WebGL helpers ───────────────────────────────────────────────────────────

function compileShader(gl, type, src) {
  const sh = gl.createShader(type)
  gl.shaderSource(sh, src)
  gl.compileShader(sh)
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    console.error('Shader error:', gl.getShaderInfoLog(sh))
    gl.deleteShader(sh)
    return null
  }
  return sh
}

function buildProgram(gl) {
  const v = compileShader(gl, gl.VERTEX_SHADER,   VERT)
  const f = compileShader(gl, gl.FRAGMENT_SHADER, FRAG)
  if (!v || !f) return null
  const p = gl.createProgram()
  gl.attachShader(p, v)
  gl.attachShader(p, f)
  gl.linkProgram(p)
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
    console.error('Program link error:', gl.getProgramInfoLog(p))
    return null
  }
  return p
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function HeroMask({ children, bgLeft, bgRight, bgLeftCover, bgRightCover, revealBackground, scrollLength = 100, contentScrollLength = scrollLength, onScrollProgress }) {
  const [contextVersion, setContextVersion] = useState(0)
  const wrapRef    = useRef(null)
  const behindRef  = useRef(null)
  // Stable refs so GSAP closures always call the latest callbacks
  const canvasRef  = useRef(null)
  const labelRef   = useRef(null)
  const hintRef    = useRef(null)
  const bgLeftRef  = useRef(null)
  const bgRightRef = useRef(null)

  useLayoutEffect(() => {
    const wrap   = wrapRef.current
    const canvas = canvasRef.current
    if (!wrap || !canvas) return

    let W = 0, H = 0, tl = null, entryTl = null, resizeTimer = null, rafId = null, scrollRefreshId = null, resumeId = null
    let entryDone = false
    let viewportWidth = window.innerWidth
    let restoreTimelineState = null
    const t0 = performance.now()

    // ── WebGL init ────────────────────────────────────────────────────────
    const gl = canvas.getContext('webgl', { alpha: true, premultipliedAlpha: false })
    if (!gl) return

    const onContextLost = (event) => {
      event.preventDefault()
      // Browsers may discard WebGL resources while a tab is in the background.
      // Remounting the canvas rebuilds the shaders, buffers and SDF texture.
      setContextVersion((version) => version + 1)
    }
    canvas.addEventListener('webglcontextlost', onContextLost, { once: true })

    gl.clearColor(0, 0, 0, 0)
    gl.enable(gl.BLEND)
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA)

    const prog = buildProgram(gl)
    if (!prog) return
    gl.useProgram(prog)

    // Fullscreen quad
    const quadBuf = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, quadBuf)
    gl.bufferData(gl.ARRAY_BUFFER,
      new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), gl.STATIC_DRAW)
    const aPosLoc = gl.getAttribLocation(prog, 'aPos')
    gl.enableVertexAttribArray(aPosLoc)
    gl.vertexAttribPointer(aPosLoc, 2, gl.FLOAT, false, 0, 0)

    // Uniform locations
    const uSDFLoc         = gl.getUniformLocation(prog, 'uSDF')
    const uTransLoc       = gl.getUniformLocation(prog, 'uTranslateNorm')
    const uScaleLoc       = gl.getUniformLocation(prog, 'uScaleNorm')
    const uProgressLoc    = gl.getUniformLocation(prog, 'uProgress')
    const uTimeLoc        = gl.getUniformLocation(prog, 'uTime')
    const uMouseLoc       = gl.getUniformLocation(prog, 'uMouse')
    const uMouseActiveLoc = gl.getUniformLocation(prog, 'uMouseActive')

    // Build SDF texture (one-time, synchronous)
    gl.activeTexture(gl.TEXTURE0)
    const sdfTex = createSDFTexture(gl)
    gl.uniform1i(uSDFLoc, 0)

    // Mutable uniform state
    const uni = { tx: 0, ty: 0, sx: 1, sy: 1, progress: 0 }

    // Mouse state: smoothed toward target
    const mouse   = { x: 0.5, y: 0.5, active: 0 }
    const mouseT  = { x: 0.5, y: 0.5, active: 0 }

    const onMouseMove = (e) => {
      const r = wrap.getBoundingClientRect()
      mouseT.x = (e.clientX - r.left) / r.width
      mouseT.y = (e.clientY - r.top)  / r.height
      mouseT.active = 1
    }
    const onMouseLeave = () => { mouseT.active = 0 }
    wrap.addEventListener('mousemove', onMouseMove)
    wrap.addEventListener('mouseleave', onMouseLeave)

    // RAF render loop
    const render = () => {
      const t = (performance.now() - t0) * 0.001

      // Smooth mouse
      const k = 0.06
      mouse.x      += (mouseT.x      - mouse.x)      * k
      mouse.y      += (mouseT.y      - mouse.y)      * k
      mouse.active += (mouseT.active - mouse.active)  * k

      gl.clear(gl.COLOR_BUFFER_BIT)
      gl.uniform2f(uTransLoc,       uni.tx, uni.ty)
      gl.uniform2f(uScaleLoc,       uni.sx, uni.sy)
      gl.uniform1f(uProgressLoc,    uni.progress)
      gl.uniform1f(uTimeLoc,        t)
      gl.uniform2f(uMouseLoc,       mouse.x, mouse.y)
      gl.uniform1f(uMouseActiveLoc, mouse.active)
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)

      rafId = requestAnimationFrame(render)
    }
    rafId = requestAnimationFrame(render)

    // ── GSAP (unchanged logic) ────────────────────────────────────────────
    const layout = () => {
      // Layout dimensions ignore the scale applied by the route transition.
      W = wrap.clientWidth
      H = wrap.clientHeight
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      canvas.width  = Math.round(W * dpr)
      canvas.height = Math.round(H * dpr)
      canvas.style.width  = `${W}px`
      canvas.style.height = `${H}px`
      gl.viewport(0, 0, canvas.width, canvas.height)
      return Math.min(W / LOGO_W, H / LOGO_H) * 0.55
    }

    const buildTimeline = () => {
      if (tl) { tl.scrollTrigger?.kill(); tl.kill(); tl = null }

      const totalDuration = scrollLength / 100
      const contentDuration = Math.min(totalDuration, contentScrollLength / 100)

      // ScrollTrigger can be refreshed while a tab is inactive. Reapply the
      // visual endpoint from its real progress so the WebGL logo never stays
      // at the previous (fully faded) opacity when the user returns to top.
      const syncSideImages = (progress) => {
        // The side illustrations leave during the first 0.30 seconds of the
        // scroll timeline. Set their position from live progress as well as
        // tweening it, so a route return cannot leave an old entry tween in
        // control of the same transform.
        const exitProgress = Math.min(1, (progress * totalDuration) / 0.30)
        if (bgLeftRef.current) gsap.set(bgLeftRef.current, { x: `${-110 * exitProgress}%` })
        if (bgRightRef.current) gsap.set(bgRightRef.current, { x: `${110 * exitProgress}%` })
      }
      restoreTimelineState = (progress = tl?.scrollTrigger?.progress ?? 0) => {
        const clampedProgress = Math.min(1, Math.max(0, progress))
        const timelineTime = clampedProgress * totalDuration
        const logoOpacity = timelineTime <= 0.94
          ? 1
          : Math.max(0, 1 - (timelineTime - 0.94) / 0.10)
        uni.progress = clampedProgress
        if (entryDone) gsap.set(canvas, { opacity: logoOpacity })
        if (entryDone || clampedProgress > 0.001) syncSideImages(clampedProgress)
        onScrollProgress?.(Math.min(1, clampedProgress * totalDuration / contentDuration))
      }

      const baseScale = layout()
      // Only force canvas visible after the entry animation has finished
      if (entryDone) gsap.set(canvas, { opacity: 1 })

      if (behindRef.current) {
        gsap.set(behindRef.current, { scale: 1.15, yPercent: 0, transformOrigin: 'center center' })
      }

      const proxy = { zoom: 1 }

      const setLogoTransform = () => {
        const scale = baseScale * proxy.zoom
        const x = W / 2 - (LOGO_W / 2) * scale
        const y = H / 2 - (LOGO_H / 2) * scale
        uni.tx = x / W
        uni.ty = y / H
        uni.sx = (LOGO_W * scale) / W
        uni.sy = (LOGO_H * scale) / H
      }
      setLogoTransform()

      // When the pinned scene is released while scrolling back to the top,
      // ScrollTrigger's scrubbed tween can otherwise leave one paint frame of
      // the enlarged logo on screen. Reset every canvas-related value before
      // changing the stacking order so the base mask is the only frame seen.
      const resetHeroAtTop = () => {
        if (entryTl && !entryDone) entryTl.kill()
        entryDone = true
        proxy.zoom = 1
        setLogoTransform()
        uni.progress = 0
        gsap.set(canvas, { opacity: 1 })
        syncSideImages(0)
        onScrollProgress?.(0)
      }

      const uiTargets = [labelRef.current, hintRef.current].filter(Boolean)
      if (uiTargets.length) gsap.set(uiTargets, { opacity: 1 })
      const initialScrollProgress = tl?.scrollTrigger?.progress ?? 0
      if (initialScrollProgress > 0.001) syncSideImages(initialScrollProgress)
      else {
        if (bgLeftRef.current) gsap.set(bgLeftRef.current, { x: '0%' })
        if (bgRightRef.current) gsap.set(bgRightRef.current, { x: '0%' })
      }

      // This timeline contains only the logo transition now. Its former
      // product-corridor phases needed a much longer pinned scroll range.

      // ── Phase 1 (tl time 0→1): logo zoom animation ───────────────────────
      // ── Phase 2 (tl time 1→2): corridor camera travel ────────────────────
      // Doubling the scroll range keeps the logo animation at the same speed.
      tl = gsap.timeline({
        scrollTrigger: {
          trigger: wrap,
          pin: true,
          start: 'top top',
          end: `+=${scrollLength}%`,
          scrub: 0.2,
          invalidateOnRefresh: true,
          // This pin changes every downstream trigger's document position.
          // Create and refresh it before nested fourth-screen triggers measure.
          refreshPriority: 10,
          // While pinned, this scene sits above the next section. Once the
          // pin releases it naturally scrolls upward, uncovering that scene.
          onEnter: (st) => {
            gsap.set(wrap, { zIndex: 5 })
            restoreTimelineState?.(st.progress)
          },
          onEnterBack: (st) => {
            gsap.set(wrap, { zIndex: 5 })
            restoreTimelineState?.(st.progress)
          },
          onLeave: () => gsap.set(wrap, { zIndex: 0 }),
          onLeaveBack: () => {
            resetHeroAtTop()
            gsap.set(wrap, { zIndex: 0 })
          },
          onUpdate: (st) => {
            restoreTimelineState?.(st.progress)
            // Once the user starts scrolling, the entrance animation must stop
            // writing to the same canvas/background properties as this timeline.
            if (st.progress > 0.001 && entryTl && !entryDone) {
              entryTl.kill()
              entryDone = true
              if (st.progress * totalDuration < 0.94) gsap.set(canvas, { opacity: 1 })
              restoreTimelineState?.(st.progress)
            }
          },
        },
      })

      // 0.00 → 0.55：正常放大，保持优雅入场节奏
      tl.to(proxy, { zoom: 10,  ease: 'power1.inOut', duration: 0.55, onUpdate: setLogoTransform }, 0)
      // 0.55 → 0.78：继续推进
      tl.to(proxy, { zoom: 26,  ease: 'power2.in',    duration: 0.23, onUpdate: setLogoTransform }, 0.55)
      // 0.78 → 0.90：开始明显加速
      tl.to(proxy, { zoom: 70,  ease: 'power3.in',    duration: 0.12, onUpdate: setLogoTransform }, 0.78)
      // 0.90 → 1.00：punch-through，快速冲过最后缝隙
      tl.to(proxy, { zoom: 180, ease: 'expo.in',      duration: 0.10, onUpdate: setLogoTransform }, 0.90)

      if (behindRef.current) {
        tl.to(behindRef.current, { scale: 1, ease: 'none', duration: 1 }, 0)
      }
      // Label + hint: fade immediately on scroll start
      if (uiTargets.length) {
        tl.to(uiTargets, { opacity: 0, ease: 'none', duration: 0.1 }, 0)
      }
      // Bg images: slide back out to their respective sides
      if (bgLeftRef.current) {
        tl.fromTo(bgLeftRef.current,  { x: '0%' }, { x: '-110%', ease: 'power2.in', duration: 0.3 }, 0)
      }
      if (bgRightRef.current) {
        tl.fromTo(bgRightRef.current, { x: '0%' }, { x:  '110%', ease: 'power2.in', duration: 0.3 }, 0)
      }
      // Explicit endpoints are essential here: the separate entrance animation
      // temporarily sets opacity to 0. A plain `to()` could capture that value
      // as its start, leaving the logo invisible even after scrolling to top.
      tl.fromTo(
        canvas,
        { opacity: 1 },
        { opacity: 0, ease: 'power2.inOut', duration: 0.10, immediateRender: false },
        0.94,
      )

      // Keep this shared scene pinned after the logo has finished expanding.
      // Consumers can use this remaining scroll range for content behind it.
      if (scrollLength > 100) {
        tl.to({}, { duration: totalDuration - 1 }, 1)

        // The final, dedicated viewport is the hand-off to the
        // product section. Move the second-screen wrapper from its normal
        // position to one full viewport above it, just like the tutorial's
        // `top bottom` -> `top top` parallax. Keeping this on `behind` avoids
        // competing with ScrollTrigger's transform used to pin `wrap`.
        tl.to(behindRef.current, {
          yPercent: -100,
          ease: 'none',
          duration: totalDuration - contentDuration,
        }, contentDuration)
      }

      // ── Phase 2: scattered product scroll (tl time 1.0 → 2.0) ─────────────
      // ── Phase 3: text reveal (tl time 2.0 → 3.0) ────────────────────────
    }

    buildTimeline()
    // The following product section also has ScrollTriggers. Refresh after
    // this pin spacer exists so their start/end points are not measured as if
    // the long second-screen scene were absent.
    scrollRefreshId = requestAnimationFrame(() => ScrollTrigger.refresh())

    // ── Entry animation (once on mount) ──────────────────────────────────
    // Logo canvas fades in, then bg images slide in from the sides.
    gsap.set(canvas, { opacity: 0 })
    const bgs = [bgLeftRef.current, bgRightRef.current].filter(Boolean)
    if (bgLeftRef.current)  gsap.set(bgLeftRef.current,  { x: '-110%' })
    if (bgRightRef.current) gsap.set(bgRightRef.current, { x:  '110%' })

    entryTl = gsap.timeline({
      delay: 0.2,
      onComplete: () => { entryDone = true },
    })
    // Logo appears
    entryTl.to(canvas, { opacity: 1, duration: 0.75, ease: 'power2.out' }, 0)
    // Bg images slide in while logo is finishing its fade
    if (bgs.length) {
      entryTl.to(bgs, { x: '0%', duration: 1.1, ease: 'power3.out', stagger: 0 }, 0.4)
    }

    const onResize = () => {
      // Browser UI appearing/disappearing can continuously change viewport
      // height while scrolling on mobile. Only rebuild for a real width change.
      if (Math.abs(window.innerWidth - viewportWidth) < 2) return
      viewportWidth = window.innerWidth
      clearTimeout(resizeTimer)
      if (scrollRefreshId) cancelAnimationFrame(scrollRefreshId)
      resizeTimer = setTimeout(buildTimeline, 150)
    }
    window.addEventListener('resize', onResize)
    // Keep the side illustrations tied to the pin's real scroll position,
    // independently of GSAP's scrub callback. This is important immediately
    // after a route transition, when the first Lenis tick can precede a normal
    // ScrollTrigger onUpdate.
      const syncHeroScrollState = () => {
        ScrollTrigger.update()
        const progress = tl?.scrollTrigger?.progress ?? 0
        if (progress <= 0.001) {
          if (entryDone) resetHeroAtTop()
          return
        }
      if (entryTl && !entryDone) entryTl.kill()
      entryDone = true
      if (progress * (scrollLength / 100) < 0.94) gsap.set(canvas, { opacity: 1 })
      restoreTimelineState?.(progress)
    }
    window.addEventListener('scroll', syncHeroScrollState, { passive: true })
    const onPageResume = () => {
      if (document.hidden) return
      cancelAnimationFrame(resumeId)
      resumeId = requestAnimationFrame(() => {
        ScrollTrigger.refresh(true)
        const progress = tl?.scrollTrigger?.progress ?? 0
        tl?.progress(progress)
        restoreTimelineState?.(progress)
        syncHeroScrollState()
      })
    }
    window.addEventListener('pageshow', onPageResume)
    document.addEventListener('visibilitychange', onPageResume)

    return () => {
      clearTimeout(resizeTimer)
      window.removeEventListener('resize', onResize)
      window.removeEventListener('scroll', syncHeroScrollState)
      canvas.removeEventListener('webglcontextlost', onContextLost)
      cancelAnimationFrame(rafId)
      cancelAnimationFrame(resumeId)
      wrap.removeEventListener('mousemove', onMouseMove)
      wrap.removeEventListener('mouseleave', onMouseLeave)
      window.removeEventListener('pageshow', onPageResume)
      document.removeEventListener('visibilitychange', onPageResume)
      entryTl.kill()
      if (tl) { tl.scrollTrigger?.kill(); tl.kill() }
      gl.deleteTexture(sdfTex)
      gl.deleteBuffer(quadBuf)
      gl.deleteProgram(prog)
    }
  }, [contentScrollLength, contextVersion, onScrollProgress, scrollLength])

  return (
    <div ref={wrapRef} className={styles.wrap}>
      <div ref={behindRef} className={styles.behind}>
        {revealBackground && (
          <div
            className={styles.revealBackground}
            style={{ backgroundImage: `url(${revealBackground})` }}
            aria-hidden="true"
          />
        )}
        {children}
      </div>

      {bgLeft  && (
        <BgShaderImage
          ref={bgLeftRef}
          baseSrc={bgLeft}
          coverSrc={bgLeftCover || bgLeft}
          className={styles.bgLeft}
        />
      )}
      {bgRight && (
        <BgShaderImage
          ref={bgRightRef}
          baseSrc={bgRight}
          coverSrc={bgRightCover || bgRight}
          className={styles.bgRight}
        />
      )}

      <canvas key={contextVersion} ref={canvasRef} className={styles.svg} aria-hidden="true" />
      <p ref={labelRef} className={styles.label}>净源科技 · 防静电服饰</p>
    </div>
  )
}
