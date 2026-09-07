import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useLenis } from 'lenis/react'
import styles from './ScrollHint.module.css'

export default function ScrollHint({ hidden = false }) {
  const { pathname } = useLocation()
  const lenis = useLenis()
  const [canScroll, setCanScroll] = useState(false)

  useEffect(() => {
    let frameId = 0
    const update = () => {
      frameId = 0
      const root = document.documentElement
      const remaining = root.scrollHeight - window.innerHeight - window.scrollY
      const locked = [root, document.body].some(node =>
        ['hidden', 'clip'].includes(getComputedStyle(node).overflowY),
      )
      setCanScroll(remaining > 24 && !locked)
    }
    const schedule = () => {
      if (!frameId) frameId = requestAnimationFrame(update)
    }
    const resizeObserver = new ResizeObserver(schedule)
    resizeObserver.observe(document.body)
    resizeObserver.observe(document.documentElement)
    const mutationObserver = new MutationObserver(schedule)
    for (const target of [document.body, document.documentElement]) {
      mutationObserver.observe(target, { attributes: true, attributeFilter: ['style', 'class'] })
    }
    window.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('resize', schedule)
    schedule()
    return () => {
      cancelAnimationFrame(frameId)
      resizeObserver.disconnect()
      mutationObserver.disconnect()
      window.removeEventListener('scroll', schedule)
      window.removeEventListener('resize', schedule)
    }
  }, [pathname, hidden])

  const scrollDown = () => {
    const distance = Math.min(360, window.innerHeight * .45)
    const immediate = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (lenis) {
      lenis.scrollTo(window.scrollY + distance, { duration: .9, immediate })
    } else {
      window.scrollBy({ top: distance, behavior: immediate ? 'instant' : 'smooth' })
    }
  }

  if (hidden || !canScroll) return null
  return (
    <button type="button" className={styles.hint} onClick={scrollDown} aria-label="向下滚动，继续浏览" data-scroll-hint>
      <span className={styles.desktop}>向下滚动</span>
      <span className={styles.touch}>上滑继续</span>
      <svg viewBox="0 0 20 24" fill="none" aria-hidden="true">
        <path d="M10 3v16M4 13l6 6 6-6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  )
}
