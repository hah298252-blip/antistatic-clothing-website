import { useRef, useEffect, forwardRef } from 'react'
import { markIntroResourceReady } from '../../utils/introResources'

const MAX_TRAIL = 24

// ── Vertex shader ─────────────────────────────────────────────────────────────
const VERT = `
attribute vec2 aPos;
varying   vec2 vUv;
void main() {
  vUv         = aPos * 0.5 + 0.5;
  gl_Position = vec4(aPos, 0.0, 1.0);
}
`

// ── Fragment shader ───────────────────────────────────────────────────────────
const FRAG = `
precision highp float;

uniform sampler2D uBase;
uniform sampler2D uCover;
uniform float     uTime;
uniform vec2      uTrail[24];
uniform float     uTrailStrength[24];
uniform float     uTrailRadius[24];

varying vec2 vUv;

float hash(vec2 p) {
  p  = fract(p * vec2(127.1, 311.7));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}
float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}
float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  mat2  rot = mat2(0.80, 0.60, -0.60, 0.80);
  for (int i = 0; i < 5; i++) {
    v += a * vnoise(p);
    p  = rot * p * 2.1 + vec2(1.7, 9.2);
    a *= 0.5;
  }
  return v;
}

void main() {
  // ── FBM flow field ────────────────────────────────────────────────────
  float na      = fbm(vUv * 4.5 + uTime * 0.08);
  float nb      = fbm(vUv * 4.5 + uTime * 0.08 + vec2(3.7, 1.9));
  vec2  fbmFlow = vec2(na, nb) - 0.5;

  // ── Canvas-edge suction (same logic as HeroMask edgeFlow) ─────────────
  // Near any canvas edge the reveal boundary gets pulled inward, giving
  // the same liquid-suction feel as the logo mask in HeroMask.
  float leftDist   = vUv.x;
  float rightDist  = 1.0 - vUv.x;
  float topDist    = vUv.y;
  float bottomDist = 1.0 - vUv.y;
  float edgeDist   = min(min(leftDist, rightDist), min(topDist, bottomDist));

  vec2 inwardDir;
  if      (edgeDist == leftDist)   inwardDir = vec2( 1.0,  0.0);
  else if (edgeDist == rightDist)  inwardDir = vec2(-1.0,  0.0);
  else if (edgeDist == topDist)    inwardDir = vec2( 0.0,  1.0);
  else                             inwardDir = vec2( 0.0, -1.0);
  vec2 tangentDir = vec2(-inwardDir.y, inwardDir.x);

  float edgeFactor = 1.0 - smoothstep(0.0, 0.30, edgeDist);
  float wave       = sin(uTime * 0.75 + vUv.x * 8.0 + vUv.y * 6.0);
  vec2  edgeFlow   = inwardDir  * edgeFactor * 0.016
                   + tangentDir * wave * edgeFactor * 0.008;

  // ── Combined flow, magnitude-capped ──────────────────────────────────
  vec2  flow    = edgeFlow + fbmFlow * 0.012;
  float flowLen = length(flow);
  if (flowLen > 0.04) flow = normalize(flow) * 0.04;

  // ── Trail mask at distorted UV ────────────────────────────────────────
  // Key idea (from HeroMask): evaluate the mask at (vUv - flow) instead of
  // vUv. Shifting the sample point moves the perceived circle boundary so
  // the reveal edge follows the flow, not a static disc perimeter.
  vec2  distUv    = vUv - flow;
  float trailMask = 0.0;
  for (int i = 0; i < 24; i++) {
    float d      = distance(distUv, uTrail[i]);
    float r      = uTrailRadius[i];
    float circle = 1.0 - smoothstep(r * 0.45, r, d);
    trailMask    = max(trailMask, circle * uTrailStrength[i]);
  }

  // ── Cover UV distortion (FBM only, weighted by reveal) ───────────────
  vec2 coverUv = vUv + fbmFlow * 0.026 * trailMask;

  // ── Noisy reveal mask (FBM tears the edge into liquid shreds) ─────────
  float edgeNoise  = fbm(vUv * 12.0 + uTime * 0.06 + fbmFlow * 0.9);
  float noisyMask  = trailMask + (edgeNoise - 0.25) * 0.35;
  float revealMask = smoothstep(0.28, 0.46, noisyMask);

  // ── Liquid rim highlight ──────────────────────────────────────────────
  float rimLo = smoothstep(0.26, 0.34, noisyMask);
  float rimHi = 1.0 - smoothstep(0.52, 0.60, noisyMask);
  float rim   = rimLo * rimHi * 0.60;

  // ── Sample & composite ────────────────────────────────────────────────
  vec4 baseColor  = texture2D(uBase,  vUv);
  vec4 coverColor = texture2D(uCover, coverUv);
  vec4 result     = mix(baseColor, coverColor, revealMask);
  result.rgb     += rim * (1.0 - result.rgb) * 0.22;
  result.a        = mix(baseColor.a, coverColor.a, revealMask);
  gl_FragColor    = result;
}
`

// ── WebGL helpers ─────────────────────────────────────────────────────────────

function compileShader(gl, type, src) {
  const sh = gl.createShader(type)
  gl.shaderSource(sh, src)
  gl.compileShader(sh)
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    console.error('[BgShaderImage]', gl.getShaderInfoLog(sh))
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
  gl.deleteShader(v)
  gl.deleteShader(f)
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
    console.error('[BgShaderImage]', gl.getProgramInfoLog(p))
    return null
  }
  return p
}

function loadTex(gl, src) {
  return new Promise((resolve, reject) => {
    const tex = gl.createTexture()
    const img = new Image()
    img.onload = () => {
      gl.bindTexture(gl.TEXTURE_2D, tex)
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true)
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
      resolve(tex)
    }
    img.onerror = reject
    img.src = src
  })
}

// ── Single-Z path generator ───────────────────────────────────────────────────
// Returns exactly 4 waypoints (plus optional departure) forming one Z stroke:
//
//   [x1, yA] ──────── [x2, yA]   ← first horizontal
//                  ↗
//   [x1, yB] ──────── [x2, yB]   ← second horizontal
//
// x1/x2 and yA/yB sides are randomised each call so no two Zs look identical.
// A small jitter (±0.03) is applied to each corner so the shape is organic.
//
// startX / startY: if provided, the cursor's last real position is prepended
// as a departure waypoint so the Z begins from where the user left off.
function generateSingleZPath(startX, startY) {
  const pts = []
  if (startX != null) pts.push({ x: startX, y: startY })

  const j  = () => (Math.random() - 0.5) * 0.06   // ±0.03 jitter
  const clamp = (v) => Math.max(0.04, Math.min(0.96, v))

  const xL = 0.10, xR = 0.90
  const yA = 0.18, yB = 0.82

  // Randomise orientation: flip horizontal direction and/or vertical order
  const flipX = Math.random() > 0.5   // whether first stroke goes R→L instead of L→R
  const flipY = Math.random() > 0.5   // whether Z starts from yB instead of yA

  const y1 = flipY ? yB : yA   // y of the first horizontal stroke
  const y2 = flipY ? yA : yB   // y of the second horizontal stroke
  const x1 = flipX ? xR : xL   // x of the "near" side
  const x2 = flipX ? xL : xR   // x of the "far" side

  // Four corners of the Z, each with a tiny independent jitter
  pts.push({ x: clamp(x1 + j()), y: clamp(y1 + j()) })   // corner A
  pts.push({ x: clamp(x2 + j()), y: clamp(y1 + j()) })   // corner B  ← 1st horizontal
  pts.push({ x: clamp(x1 + j()), y: clamp(y2 + j()) })   // corner C  ← diagonal
  pts.push({ x: clamp(x2 + j()), y: clamp(y2 + j()) })   // corner D  ← 2nd horizontal

  return pts
}

// ── Component ─────────────────────────────────────────────────────────────────

const BgShaderImage = forwardRef(function BgShaderImage(
  { baseSrc, coverSrc, className, readyKey },
  ref
) {
  const wrapRef   = useRef(null)
  const canvasRef = useRef(null)

  const mergeRef = (el) => {
    wrapRef.current = el
    if (typeof ref === 'function') ref(el)
    else if (ref) ref.current = el
  }

  useEffect(() => {
    const wrap   = wrapRef.current
    const canvas = canvasRef.current
    if (!wrap || !canvas) return

    // ── WebGL ─────────────────────────────────────────────────────────────
    const gl = canvas.getContext('webgl', {
      alpha: true,
      premultipliedAlpha: false,
      antialias: false,
    })
    if (!gl) return

    gl.clearColor(0, 0, 0, 0)
    gl.enable(gl.BLEND)
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA)

    const prog = buildProgram(gl)
    if (!prog) return
    gl.useProgram(prog)

    const quadBuf = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, quadBuf)
    gl.bufferData(gl.ARRAY_BUFFER,
      new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), gl.STATIC_DRAW)
    const aLoc = gl.getAttribLocation(prog, 'aPos')
    gl.enableVertexAttribArray(aLoc)
    gl.vertexAttribPointer(aLoc, 2, gl.FLOAT, false, 0, 0)

    const uBaseLoc  = gl.getUniformLocation(prog, 'uBase')
    const uCoverLoc = gl.getUniformLocation(prog, 'uCover')
    const uTimeLoc  = gl.getUniformLocation(prog, 'uTime')
    const uTrailLoc = gl.getUniformLocation(prog, 'uTrail[0]')
    const uStrLoc   = gl.getUniformLocation(prog, 'uTrailStrength[0]')
    const uRadLoc   = gl.getUniformLocation(prog, 'uTrailRadius[0]')

    const trailFlat = new Float32Array(MAX_TRAIL * 2)
    const strFlat   = new Float32Array(MAX_TRAIL)
    const radFlat   = new Float32Array(MAX_TRAIL).fill(0.08)

    // ── Textures ──────────────────────────────────────────────────────────
    let baseTex = null, coverTex = null, ready = false
    gl.uniform1i(uBaseLoc, 0)
    gl.uniform1i(uCoverLoc, 1)
    Promise.all([loadTex(gl, baseSrc), loadTex(gl, coverSrc)])
      .then(([bt, ct]) => {
        baseTex = bt
        coverTex = ct
        syncSize()
        ready = true
        markIntroResourceReady(readyKey)
      })
      .catch(console.error)

    // ── Canvas sizing ─────────────────────────────────────────────────────
    const syncSize = () => {
      const w = wrap.clientWidth, h = wrap.clientHeight
      if (!w || !h) return
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      canvas.width  = Math.round(w * dpr)
      canvas.height = Math.round(h * dpr)
      canvas.style.width  = `${w}px`
      canvas.style.height = `${h}px`
      gl.viewport(0, 0, canvas.width, canvas.height)
    }
    syncSize()

    // ── Trail ─────────────────────────────────────────────────────────────
    const trailPts = []

    // minDist = 0 → no distance gate (used by auto mode).
    const addPoint = (ux, uy, strength, radius, minDist = 0.012) => {
      if (minDist > 0 && trailPts.length > 0) {
        const last = trailPts[0]
        if ((ux - last.x) ** 2 + (uy - last.y) ** 2 < minDist * minDist) return
      }
      trailPts.unshift({ x: ux, y: uy, strength, radius })
      if (trailPts.length > MAX_TRAIL) trailPts.pop()
    }

    // ── Real-pointer state ────────────────────────────────────────────────
    let lastMx = -1, lastMy = -1, lastMoveMs = 0
    let lastPointerTime = performance.now()

    // ── Auto-reveal (single-Z) state ─────────────────────────────────────
    const IDLE_MS     = 2500   // ms idle before auto kicks in
    const AUTO_SPEED  = 0.9    // UV / second along the path
    const AUTO_ADD_MS = 20     // ms between trail-point injections

    let autoMode       = false
    let autoPauseUntil = 0      // timestamp (ms) until which we are pausing between Zs
    let autoWaypts     = []     // [{x,y}, …] current generated path
    let autoWayptIdx   = 1      // index of the waypoint we're currently heading TO
    let autoWayptProg  = 0      // 0..1 progress between (idx-1) and idx
    let autoLastAddMs  = 0

    // Start (or restart) a fresh single-Z path.
    // sx/sy: departure UV — pass last cursor pos when first entering autoMode,
    //        null when looping (Z starts from a random corner).
    const startSingleZ = (sx, sy) => {
      autoWaypts     = generateSingleZPath(sx, sy)
      autoWayptIdx   = 1
      autoWayptProg  = 0
      autoPauseUntil = 0
    }

    // ── Pointer handler ───────────────────────────────────────────────────
    const onPointerMove = (e) => {
      const now = performance.now()
      const r   = canvas.getBoundingClientRect()
      const ux  = (e.clientX - r.left) / r.width
      const uy  = 1.0 - (e.clientY - r.top) / r.height   // flip Y

      if (autoMode) autoMode = false
      lastPointerTime = now

      let vel = 0
      if (lastMx >= 0) {
        const dx = ux - lastMx, dy = uy - lastMy
        const dt = Math.max(now - lastMoveMs, 1) / 1000
        vel = Math.min(Math.sqrt(dx * dx + dy * dy) / dt, 2.0)
      }
      lastMx = ux; lastMy = uy; lastMoveMs = now

      addPoint(ux, uy, Math.min(0.85 + vel * 0.15, 1.0), Math.min(0.26 + vel * 0.04, 0.36), 0.012)
    }
    canvas.addEventListener('pointermove', onPointerMove)

    // ── RAF loop ──────────────────────────────────────────────────────────
    let rafId = null, lastFrame = performance.now()

    const tick = (now) => {
      rafId = requestAnimationFrame(tick)
      const dt = Math.min((now - lastFrame) * 0.001, 0.05)
      lastFrame = now

      // ── Enter auto mode after idle ───────────────────────────────────
      if (!autoMode && now - lastPointerTime > IDLE_MS) {
        autoMode = true
        startSingleZ(
          lastMx >= 0 ? lastMx : null,
          lastMy >= 0 ? lastMy : null,
        )
        autoLastAddMs = 0
      }

      // ── Cooldown between Z loops ─────────────────────────────────────
      if (autoMode && autoPauseUntil > 0) {
        if (now >= autoPauseUntil) {
          // Pause over — kick off the next Z from a random start position.
          startSingleZ(null, null)
        }
        // While pausing: skip movement and trail injection entirely.
      }

      // ── Auto cursor movement along single-Z path ─────────────────────
      if (autoMode && autoPauseUntil === 0 && autoWaypts.length >= 2) {
        const fromPt = autoWaypts[autoWayptIdx - 1]
        const toPt   = autoWaypts[autoWayptIdx]

        const dx   = toPt.x - fromPt.x
        const dy   = toPt.y - fromPt.y
        const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 0.001)

        autoWayptProg += (AUTO_SPEED * dt) / dist

        // Advance through waypoints; guard against degenerate tiny segments.
        let guard = 0
        while (autoWayptProg >= 1.0 && guard++ < 8) {
          autoWayptProg -= 1.0
          autoWayptIdx++
          if (autoWayptIdx >= autoWaypts.length) {
            // One full Z done → pause 1.5–3 s, then start a fresh Z.
            autoPauseUntil = now + 1500 + Math.random() * 1500
            break
          }
        }

        // Safety: clamp in case of rounding / very short segments.
        const safeIdx  = Math.min(autoWayptIdx, autoWaypts.length - 1)
        const safePrev = Math.max(safeIdx - 1, 0)
        const fp = autoWaypts[safePrev]
        const tp = autoWaypts[safeIdx]
        const prog = Math.min(autoWayptProg, 1.0)
        const ux = fp.x + (tp.x - fp.x) * prog
        const uy = fp.y + (tp.y - fp.y) * prog

        // Inject trail point — only while not in cooldown pause.
        if (autoPauseUntil === 0 && now - autoLastAddMs >= AUTO_ADD_MS) {
          autoLastAddMs = now
          // Vary strength and radius slightly to feel alive, not mechanical.
          const strength = 0.80 + Math.random() * 0.18     // 0.80 – 0.98
          const radius   = 0.26 + Math.random() * 0.08    // 0.26 – 0.34
          addPoint(ux, uy, strength, radius, 0)
        }
      }

      // ── Decay trail ───────────────────────────────────────────────────
      const decay = Math.pow(0.93, dt * 60)
      for (let i = trailPts.length - 1; i >= 0; i--) {
        trailPts[i].strength *= decay
        if (trailPts[i].strength < 0.005) trailPts.splice(i, 1)
      }

      // ── Upload trail uniforms ─────────────────────────────────────────
      for (let i = 0; i < MAX_TRAIL; i++) {
        const pt = trailPts[i]
        if (pt) {
          trailFlat[i * 2] = pt.x; trailFlat[i * 2 + 1] = pt.y
          strFlat[i] = pt.strength; radFlat[i] = pt.radius
        } else {
          trailFlat[i * 2] = trailFlat[i * 2 + 1] = 0
          strFlat[i] = 0; radFlat[i] = 0.08
        }
      }
      gl.uniform1f(uTimeLoc, now * 0.001)
      gl.uniform2fv(uTrailLoc, trailFlat)
      gl.uniform1fv(uStrLoc,   strFlat)
      gl.uniform1fv(uRadLoc,   radFlat)

      if (!ready) return
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, baseTex)
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, coverTex)
      gl.clear(gl.COLOR_BUFFER_BIT)
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
    }

    rafId = requestAnimationFrame(tick)

    // ── ResizeObserver ────────────────────────────────────────────────────
    let resizeTimer = null
    const ro = new ResizeObserver(() => {
      clearTimeout(resizeTimer)
      resizeTimer = setTimeout(syncSize, 100)
    })
    ro.observe(wrap)

    return () => {
      cancelAnimationFrame(rafId)
      clearTimeout(resizeTimer)
      ro.disconnect()
      canvas.removeEventListener('pointermove', onPointerMove)
      if (baseTex)  gl.deleteTexture(baseTex)
      if (coverTex) gl.deleteTexture(coverTex)
      gl.deleteBuffer(quadBuf)
      gl.deleteProgram(prog)
    }
  }, [baseSrc, coverSrc, readyKey])

  return (
    <div ref={mergeRef} className={className} data-intro-hero-media>
      <img
        src={baseSrc}
        alt=""
        aria-hidden="true"
        style={{ display: 'block', width: '100%', visibility: 'hidden', pointerEvents: 'none', userSelect: 'none' }}
      />
      <canvas
        ref={canvasRef}
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'auto' }}
      />
    </div>
  )
})

export default BgShaderImage
