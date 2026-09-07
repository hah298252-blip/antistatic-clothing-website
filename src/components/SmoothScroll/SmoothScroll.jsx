import { ReactLenis } from 'lenis/react'
import { cancelFrame, frame } from 'motion'
import { useEffect, useRef } from 'react'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)

export default function SmoothScroll({ children, options, paused = false }) {
  const lenisRef = useRef(null)
  const pausedRef = useRef(paused)

  useEffect(() => {
    let refreshFrame = null
    let settleFrame = null
    pausedRef.current = paused
    const lenis = lenisRef.current?.lenis
    if (paused) lenis?.stop()
    else {
      lenis?.resize()
      lenis?.start()
      refreshFrame = requestAnimationFrame(() => {
        settleFrame = requestAnimationFrame(() => {
          ScrollTrigger.refresh(true)
          ScrollTrigger.update()
        })
      })
    }
    return () => {
      cancelAnimationFrame(refreshFrame)
      cancelAnimationFrame(settleFrame)
    }
  }, [paused])

  useEffect(() => {
    let resumeFrame = null
    const update = ({ timestamp }) => {
      if (!pausedRef.current) lenisRef.current?.lenis?.raf(timestamp)
    }

    const syncAfterResume = () => {
      if (document.hidden) {
        lenisRef.current?.lenis?.stop()
        return
      }

      // A background tab can resume with a very large frame delta. Reset the
      // smooth-scroll clock first, then recalculate every scroll scene.
      const lenis = lenisRef.current?.lenis
      lenis?.resize()
      if (!pausedRef.current) lenis?.start()
      gsap.ticker.wake()

      cancelAnimationFrame(resumeFrame)
      resumeFrame = requestAnimationFrame(() => {
        ScrollTrigger.refresh(true)
        ScrollTrigger.update()
      })
    }

    frame.update(update, true)
    document.addEventListener('visibilitychange', syncAfterResume)
    window.addEventListener('pageshow', syncAfterResume)

    return () => {
      cancelFrame(update)
      cancelAnimationFrame(resumeFrame)
      document.removeEventListener('visibilitychange', syncAfterResume)
      window.removeEventListener('pageshow', syncAfterResume)
    }
  }, [])

  return (
    <ReactLenis
      root
      ref={lenisRef}
      options={{ syncTouch: true, ...options, autoRaf: false }}
    >
      {children}
    </ReactLenis>
  )
}
