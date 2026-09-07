import { useEffect, useRef, useState } from 'react'
import background6 from '../../assert/background6.png'
import LanyardCards from './LanyardCards'
import styles from './SixthScreen.module.css'

export default function SixthScreen() {
  const sectionRef = useRef(null)
  const frameRef = useRef(null)
  const mediaRef = useRef(null)
  const scrimRef = useRef(null)
  const joinTextRef = useRef(null)
  const dragTextRef = useRef(null)
  const [cardsVisible, setCardsVisible] = useState(false)
  const [cardsMounted, setCardsMounted] = useState(false)

  useEffect(() => {
    const section = sectionRef.current
    const frame = frameRef.current
    const media = mediaRef.current
    const scrim = scrimRef.current
    const joinText = joinTextRef.current
    const dragText = dragTextRef.current
    if (!section || !frame || !media) return undefined

    const clamp = (value, min, max) => Math.min(max, Math.max(min, value))
    const smoothstep = (value) => {
      const progress = clamp(value, 0, 1)
      return progress * progress * (3 - 2 * progress)
    }

    let frameId = 0
    const render = () => {
      frameId = 0
      const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      const distance = Math.max(1, window.innerHeight * 1.25)
      const progress = reducedMotion ? 1 : clamp(-section.getBoundingClientRect().top / distance, 0, 1)
      if (progress >= .96) setCardsMounted(true)
      setCardsVisible((visible) => {
        // A little hysteresis prevents touch jitter at the threshold, while a
        // deliberate upward scroll still hides the cards again.
        const next = progress >= (visible ? .86 : .96)
        return visible === next ? visible : next
      })
      const eased = smoothstep(progress)
      const width = 42 + 58 * eased
      const height = 58 + 42 * eased
      const insetX = (100 - width) / 2
      const insetY = (100 - height) / 2
      const radius = 24 * (1 - eased)

      frame.style.clipPath = `inset(${insetY}% ${insetX}% ${insetY}% ${insetX}% round ${radius}px)`
      media.style.transform = `scale(${1.32 - .32 * eased})`
      if (scrim) scrim.style.opacity = String(.26 * eased)
      if (joinText) {
        const joinProgress = smoothstep(progress / .58)
        joinText.style.opacity = String(1 - joinProgress)
        joinText.style.transform = `translate(-50%, -50%) scale(${1 + .08 * joinProgress})`
      }
      if (dragText) {
        const dragProgress = smoothstep((progress - .78) / .18)
        dragText.style.opacity = String(dragProgress)
        dragText.style.transform = `translate(-50%, -50%) translateY(${24 * (1 - dragProgress)}px)`
      }
    }
    const requestRender = () => {
      if (!frameId) frameId = requestAnimationFrame(render)
    }

    render()
    window.addEventListener('scroll', requestRender, { passive: true })
    window.addEventListener('resize', requestRender)
    const observer = new ResizeObserver(requestRender)
    observer.observe(section)
    return () => {
      if (frameId) cancelAnimationFrame(frameId)
      window.removeEventListener('scroll', requestRender)
      window.removeEventListener('resize', requestRender)
      observer.disconnect()
    }
  }, [])

  return (
    <section ref={sectionRef} className={styles.sixth} aria-label="第六屏，品牌展示">
      <div className={styles.stage}>
        <div ref={frameRef} className={styles.frame}>
          <img ref={mediaRef} className={styles.media} src={background6} alt="净源科技展示" draggable="false" />
          <div ref={scrimRef} className={styles.scrim} aria-hidden="true" />
          <p ref={joinTextRef} className={styles.joinText}>加入我们</p>
          <p ref={dragTextRef} className={styles.dragText}>拖动工牌试一试</p>
        </div>
        {cardsMounted && <LanyardCards visible={cardsVisible} />}
      </div>
    </section>
  )
}
