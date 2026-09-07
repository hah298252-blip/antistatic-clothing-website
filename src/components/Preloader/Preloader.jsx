import { useLayoutEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import bgLeft from '../../assert/bg_left.png'
import bgRight from '../../assert/bg_right.png'
import bgLeftCover from '../../assert/bg_left_cover.png'
import bgRightCover from '../../assert/bg_right_cover.png'
import factory from '../../assert/background1.jpg'
import logo from '../../assert/logo.png'
import { waitForIntroResource } from '../../utils/introResources'
import styles from './Preloader.module.css'

gsap.registerPlugin(ScrollTrigger)

const HERO_IMAGES = [logo, bgLeft, bgRight, bgLeftCover, bgRightCover, factory]
const PROGRESS_STEPS = [0, 12, 27, 46, 68, 82, 91, 97, 100]

const preloadImage = (src) => new Promise((resolve) => {
  const image = new Image()
  image.onload = image.onerror = resolve
  image.src = src
  if (image.complete) resolve()
})

export default function Preloader({ onComplete }) {
  const location = useLocation()
  const rootRef = useRef(null)
  const currentRef = useRef(null)
  const nextRef = useRef(null)
  const currentValueRef = useRef(0)

  useLayoutEffect(() => {
    const root = rootRef.current
    const current = currentRef.current
    const next = nextRef.current
    if (!root || !current || !next) return undefined

    let disposed = false
    let rollTimeline = null
    let finishTimeline = null
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const progress = { value: 0 }

    document.documentElement.classList.add('is-preloading')
    window.scrollTo(0, 0)

    const showNumber = (value) => {
      const rounded = Math.max(0, Math.min(100, Math.round(value)))
      const nextValue = PROGRESS_STEPS.reduce((result, step) => step <= rounded ? step : result, 0)
      if (nextValue === currentValueRef.current) return
      const formatted = String(nextValue).padStart(2, '0')
      currentValueRef.current = nextValue
      if (reducedMotion) {
        current.textContent = formatted
        return
      }
      rollTimeline?.kill()
      next.textContent = formatted
      gsap.set(next, { yPercent: 110 })
      rollTimeline = gsap.timeline({
        onComplete: () => {
          current.textContent = formatted
          gsap.set(current, { yPercent: 0 })
          gsap.set(next, { yPercent: 110 })
        },
      })
        .to(current, { yPercent: -110, duration: .12, ease: 'power2.in' }, 0)
        .to(next, { yPercent: 0, duration: .16, ease: 'power3.out' }, .035)
    }

    const updateNumber = () => showNumber(progress.value)
    const pace = gsap.timeline({ paused: true })
      .to(progress, { value: 20, duration: reducedMotion ? .05 : .22, ease: 'power2.out', onUpdate: updateNumber })
      .to(progress, { value: 70, duration: reducedMotion ? .05 : .72, ease: 'none', onUpdate: updateNumber })
      .to(progress, { value: 90, duration: reducedMotion ? .05 : .48, ease: 'power1.out', onUpdate: updateNumber })
      .to(progress, { value: 94, duration: reducedMotion ? .05 : .38, ease: 'power2.out', onUpdate: updateNumber })
    pace.play()

    const resourceTasks = [document.fonts?.ready || Promise.resolve()]
    if (location.pathname === '/') {
      resourceTasks.push(...HERO_IMAGES.map(preloadImage))
      resourceTasks.push(waitForIntroResource('hero-mask-webgl'))
      resourceTasks.push(waitForIntroResource('hero-left-textures'))
      resourceTasks.push(waitForIntroResource('hero-right-textures'))
    }

    Promise.allSettled(resourceTasks).then(() => {
      if (disposed) return
      pace.eventCallback('onComplete', () => {
        if (disposed) return
        rollTimeline?.kill()
        finishTimeline = gsap.timeline({
          defaults: { overwrite: 'auto' },
          onComplete: () => {
            document.documentElement.classList.remove('is-preloading')
            onComplete?.()
            window.dispatchEvent(new CustomEvent('jingyuan:intro-complete'))
          },
        })
          .to(progress, {
            value: 100,
            duration: reducedMotion ? .08 : .72,
            ease: 'power3.out',
            onUpdate: updateNumber,
            onComplete: () => {
              current.textContent = '100'
              currentValueRef.current = 100
            },
          })
          .to({}, { duration: reducedMotion ? .05 : .3 })

        const heroBackground = document.querySelector('[data-intro-hero-bg]')
        const heroTitle = document.querySelector('[data-intro-hero-title]')
        const heroSubtitle = document.querySelector('[data-intro-hero-subtitle]')
        const heroMedia = gsap.utils.toArray('[data-intro-hero-media]')
        const nav = document.querySelector('[data-intro-nav]')
        const revealAt = finishTimeline.duration()

        if (heroBackground) finishTimeline.fromTo(heroBackground, { scale: 1.08 }, { scale: 1, duration: reducedMotion ? .1 : 1.25, ease: 'power3.out' }, revealAt)
        if (heroMedia.length) finishTimeline.fromTo(heroMedia, { scale: 1.04 }, { x: '0%', scale: 1, duration: reducedMotion ? .1 : 1.2, ease: 'power3.out', stagger: 0 }, revealAt)
        if (heroTitle) finishTimeline.fromTo(heroTitle, { yPercent: 110, opacity: 0 }, { yPercent: 0, opacity: 1, duration: reducedMotion ? .1 : 1.05, ease: 'power4.out' }, revealAt + .08)
        if (heroSubtitle) finishTimeline.fromTo(heroSubtitle, { y: 20, opacity: 0 }, { y: 0, opacity: 1, duration: reducedMotion ? .1 : .7, ease: 'power3.out' }, revealAt + .32)
        if (nav) finishTimeline.fromTo(nav, { y: -30, opacity: 0 }, { y: 0, opacity: 1, duration: reducedMotion ? .1 : .75, ease: 'power3.out' }, revealAt + .38)
        finishTimeline.to(root, { clipPath: 'inset(0% 0% 100% 0%)', duration: reducedMotion ? .12 : 1.05, ease: 'power4.inOut' }, revealAt)
      })
      if (pace.progress() === 1) pace.eventCallback('onComplete')?.()
    })

    return () => {
      disposed = true
      pace.kill()
      rollTimeline?.kill()
      finishTimeline?.kill()
      document.documentElement.classList.remove('is-preloading')
    }
  }, [location.pathname, onComplete])

  return (
    <div ref={rootRef} className={styles.preloader} role="status" aria-label="网站正在加载">
      <span className={`${styles.meta} ${styles.topLeft}`}>JINGYUAN TECHNOLOGY</span>
      <span className={`${styles.meta} ${styles.topRight}`}>LOADING EXPERIENCE</span>
      <div className={styles.counter} aria-live="polite">
        <span ref={currentRef}>00</span>
        <span ref={nextRef}>00</span>
      </div>
      <span className={`${styles.meta} ${styles.bottomLeft}`}>CLEANROOM GARMENTS</span>
      <span className={`${styles.meta} ${styles.bottomRight}`}>YANCHENG · CHINA</span>
    </div>
  )
}
