import { useEffect, useRef } from 'react'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import './ScrollJourney.css'

gsap.registerPlugin(ScrollTrigger)

// The route lives in a viewBox="0 0 100 820" SVG with preserveAspectRatio="none"
// stretched over the fifth-screen journey column, and the CSS sets vector-effect:
// non-scaling-stroke. Under that effect the browser computes the whole stroke
// geometry — including the dash pattern — in SCREEN pixels, while
// path.getTotalLength() only reports viewBox user units (roughly 4x shorter
// than the on-screen path here). Using the user-unit length for the dash
// values is why the line could never be fully drawn; measure the real
// on-screen length instead.
function sampleScreenPath(path) {
  const svg = path.ownerSVGElement
  const viewBox = svg.viewBox.baseVal
  const rect = svg.getBoundingClientRect()
  const scaleX = rect.width / (viewBox.width || 100)
  const scaleY = rect.height / (viewBox.height || 820)
  const userLength = path.getTotalLength()
  const STEPS = 300
  const points = []
  for (let i = 0; i <= STEPS; i++) {
    const point = path.getPointAtLength((userLength * i) / STEPS)
    points.push({ x: point.x * scaleX, y: point.y * scaleY })
  }
  const cumulative = [0]
  for (let i = 1; i <= STEPS; i++) {
    cumulative.push(
      cumulative[i - 1] + Math.hypot(
        points[i].x - points[i - 1].x,
        points[i].y - points[i - 1].y,
      ),
    )
  }
  return { points, cumulative, total: cumulative[STEPS] }
}

export default function ScrollJourney({ nodes = [], images = [], className = '' }) {
  const rootRef = useRef(null)
  const rangeRef = useRef(null)
  const pathRef = useRef(null)
  const nodeSignature = nodes.map((node, index) => `${node}:${images[index] ?? ''}`).join('\u0001')

  useEffect(() => {
    const root = rootRef.current
    const range = rangeRef.current
    const path = pathRef.current
    if (!root || !range || !path) return undefined
    const markers = Array.from(root.querySelectorAll('[data-journey-node]'))

    // Re-measurable state: the dash pattern must always match the CURRENT
    // on-screen path length, which changes whenever the viewport is resized
    // (the SVG is re-stretched non-uniformly).
    const state = { length: 1 }
    const measure = () => {
      const sample = sampleScreenPath(path)
      state.length = Math.ceil(sample.total) || 1
      path.setAttribute('stroke-dasharray', String(state.length))
      // Park the stroke fully hidden until the scrubbed tween takes over.
      path.setAttribute('stroke-dashoffset', String(state.length))
      return sample
    }

    measure()

    const context = gsap.context(() => {
      gsap.set(markers, { autoAlpha: 0, scale: 0.72, transformOrigin: 'center' })

      // A direct journey-line mapping: the percentage of this long SVG region
      // that has crossed the viewport equals the percentage of path drawn.
      // No pin or sticky proxy is involved, so it remains a normal independent
      // fifth screen and cannot inherit screen four's scroll state.
      const timeline = gsap.timeline({
        scrollTrigger: {
          trigger: root,
          start: 'top bottom',
          end: 'bottom 70%',
          scrub: true,
          invalidateOnRefresh: true,
          // Refreshes run on resize: re-measure BEFORE the invalidated tween
          // re-records its start value, so the draw stays in sync.
          onRefreshInit: () => measure(),
        },
      })

      // One dash of the real on-screen length, fully offset, then scrubbed
      // continuously to zero — the canonical line-drawing setup.
      timeline.fromTo(path,
        { attr: { 'stroke-dashoffset': () => state.length } },
        { attr: { 'stroke-dashoffset': 0 }, duration: 1, ease: 'none' },
        0)

      // Each waypoint owns its entrance instead of inheriting the whole path
      // timeline. It cannot finish off-screen: its dot appears only when the
      // node reaches the lower portion of the viewport, then its characters
      // enter one by one.
      markers.forEach((marker) => {
        const chars = marker.querySelectorAll('[data-journey-node-char]')
        const image = marker.querySelector('[data-journey-node-image]')
        gsap.set(chars, { autoAlpha: 0, y: 14 })
        gsap.set(image, { autoAlpha: 0, yPercent: -50, y: 20, scale: .96, transformOrigin: 'center' })
        gsap.timeline({
          scrollTrigger: {
            trigger: marker,
            start: 'top 72%',
            toggleActions: 'play none none reverse',
            invalidateOnRefresh: true,
          },
        })
          .to(marker, { autoAlpha: 1, scale: 1, duration: .18, ease: 'power2.out' })
          .to(chars, {
            autoAlpha: 1,
            y: 0,
            duration: .24,
            stagger: .12,
            ease: 'power3.out',
          }, '-=.08')
          .to(image, {
            autoAlpha: 1,
            y: 0,
            scale: 1,
            duration: .38,
            ease: 'power3.out',
          }, '-=.18')
      })
    }, root)

    // Images and custom fonts can change document height after the first
    // refresh. Recalculate the trigger once the browser has completed this frame.
    const refreshId = requestAnimationFrame(() => ScrollTrigger.refresh())
    return () => {
      cancelAnimationFrame(refreshId)
      context.revert()
    }
    // Rebuild only when the actual node labels change. This is important in
    // development: Fast Refresh can replace a renamed React node while an old
    // ScrollTrigger still targets the removed element.
  }, [nodeSignature])

  return <div ref={rangeRef} className="scrollJourneyRange">
    <div ref={rootRef} className={`scrollJourney ${className}`.trim()} aria-label="企业历程">
      <svg className="scrollJourneyLine" viewBox="0 0 100 820" preserveAspectRatio="none" aria-hidden="true">
        <path
          ref={pathRef}
          d="M 52 0 C 18 82, 84 152, 50 252 S 16 418, 50 502 S 84 652, 50 752"
        />
      </svg>
      {nodes.map((node, index) => <div key={node} className={`scrollJourneyNode scrollJourneyNode${index + 1}`} data-journey-node>
        <div className="scrollJourneyNodeLabel">
          <span className="scrollJourneyDot" aria-hidden="true" />
          <span aria-label={node}>{Array.from(node).map((char, charIndex) => (
            <span key={`${char}-${charIndex}`} data-journey-node-char>{char}</span>
          ))}</span>
        </div>
        {images[index] && <img className="scrollJourneyImage" data-journey-node-image src={images[index]} alt={`${node}活动`} />}
      </div>)}
    </div>
  </div>
}
