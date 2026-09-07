import { useEffect, useRef, useState } from 'react'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import ScrollJourney from '../ui/ScrollJourney'
import activity1 from '../../assert/activity1.png'
import activity2 from '../../assert/activity2.png'
import activity3 from '../../assert/activity3.png'
import screenDecor1 from '../../assert/5screen1.png'
import screenDecor2 from '../../assert/5screen2.png'
import screenDecor3 from '../../assert/5screen3.png'
import screenDecor4 from '../../assert/5screen4.png'
import screenDecor5 from '../../assert/5screen5.png'
import screenDecor6 from '../../assert/5screen6.png'
import screenDecor7 from '../../assert/5screen7.png'
import screenDecor8 from '../../assert/5screen8.png'
import styles from './FifthScreen.module.css'

gsap.registerPlugin(ScrollTrigger)

const BACKGROUND_ASSETS = [
  screenDecor1, screenDecor2, screenDecor3, screenDecor4,
  screenDecor5, screenDecor6, screenDecor7, screenDecor8,
]

const INITIAL_ASSET_POSITIONS = [
  // 1 / 2 / 4: a triangle in the open area below the certificate node.
  { x: 54, y: 46 }, { x: 84, y: 49 }, { x: 18, y: 30 }, { x: 69, y: 64 },
  // 5 / 6 / 7: a second triangle below the exhibition node.
  { x: 5, y: 71 }, { x: 38, y: 74 }, { x: 21, y: 90 }, { x: 73, y: 89 },
]

function DraggableBackgroundAssets() {
  const layerRef = useRef(null)
  const dragRef = useRef(null)
  const [positions, setPositions] = useState(INITIAL_ASSET_POSITIONS)

  const startDrag = (event, index) => {
    const layer = layerRef.current
    if (!layer || event.button !== 0) return
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    dragRef.current = {
      index,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      position: positions[index],
      bounds: layer.getBoundingClientRect(),
    }
  }

  const moveDrag = (event) => {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    const x = Math.min(96, Math.max(4, drag.position.x + ((event.clientX - drag.startX) / drag.bounds.width) * 100))
    const y = Math.min(96, Math.max(4, drag.position.y + ((event.clientY - drag.startY) / drag.bounds.height) * 100))
    setPositions((current) => current.map((position, index) => index === drag.index ? { x, y } : position))
  }

  const endDrag = (event) => {
    if (dragRef.current?.pointerId !== event.pointerId) return
    dragRef.current = null
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
  }

  return (
    <div ref={layerRef} className={styles.draggableBackground} aria-label="可拖动的第五屏背景素材">
      {BACKGROUND_ASSETS.map((asset, index) => (
        <button
          key={asset}
          type="button"
          className={styles.draggableAsset}
          aria-label={`移动背景图片 ${index + 1}`}
          style={{
            left: `${positions[index].x}%`,
            top: `${positions[index].y}%`,
            '--sticker-tilt': `${[-8, 7, -5, 9, 5, -9, 8, -6][index]}deg`,
          }}
          onPointerDown={(event) => startDrag(event, index)}
          onPointerMove={moveDrag}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
        >
          <span className={styles.stickerContainer}>
            <span className={styles.stickerMain}>
              <img src={asset} alt="" draggable="false" />
            </span>
            <span className={styles.stickerFlap} aria-hidden="true">
              <img src={asset} alt="" draggable="false" />
            </span>
          </span>
        </button>
      ))}
    </div>
  )
}

export default function FifthScreen() {
  const titleRef = useRef(null)
  const keywordRef = useRef(null)

  useEffect(() => {
    const title = titleRef.current
    const keyword = keywordRef.current
    if (!title || !keyword) return undefined
    // Keep the heading visible from the moment screen five enters. The former
    // fade-in tween left an initial autoAlpha: 0 state behind this scene.
    gsap.set(title, { autoAlpha: 1, y: 0, yPercent: 0, filter: 'none' })
    const timeline = gsap.timeline({
      scrollTrigger: {
        trigger: title,
        start: 'top 88%',
        toggleActions: 'play none none reset',
      },
    })
      .to(keyword, { '--underline-scale': 1, duration: .42, ease: 'power2.out' })
    return () => timeline.kill()
  }, [])

  return (
    <section className={styles.fifth} data-journey-range data-fifth-screen aria-label="第五屏，企业理念">
      <div className={styles.fifthScene}>
        <DraggableBackgroundAssets />
        <div className={styles.titleWrap}>
          <h2 ref={titleRef} className={styles.title}>
            不 止 制 造，<br />
            更 在 <span ref={keywordRef} className={styles.titleKeyword}>不 断 向 前</span>
          </h2>
        </div>
        <ScrollJourney
          className={styles.journey}
          nodes={['证书', '展会', '奖状']}
          images={[activity1, activity2, activity3]}
        />
      </div>
    </section>
  )
}
