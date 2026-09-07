import { ReactLenis } from 'lenis/react'
import { cancelFrame, frame } from 'motion'
import { useEffect, useRef } from 'react'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)

export default function SmoothScroll({ children, options }) {
  const lenisRef = useRef(null)

  useEffect(() => {
    let resumeFrame = null
    const update = ({ timestamp }) => {
      lenisRef.current?.lenis?.raf(timestamp)
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
      lenis?.start()
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
