import { useCallback, useEffect, useState } from 'react'
import TopNav from '../components/TopNav/TopNav'
import SmoothScroll from '../components/SmoothScroll/SmoothScroll'
import PageTransition from '../components/PageTransition/PageTransition'
import ScrollHint from '../components/ScrollHint/ScrollHint'
import Preloader from '../components/Preloader/Preloader'
import logo from '../assert/logo.png'
import styles from './RootLayout.module.css'

export default function RootLayout() {
  const shouldShowIntro = window.location.pathname === '/'
  const orientationQuery = '(max-width: 932px) and (orientation: portrait), (max-width: 666px)'
  const [orientationBlocked, setOrientationBlocked] = useState(
    () => window.matchMedia(orientationQuery).matches
  )
  const [introStarted, setIntroStarted] = useState(
    () => shouldShowIntro && !window.matchMedia(orientationQuery).matches
  )
  const [isTransitioning, setIsTransitioning] = useState(false)
  const [introReady, setIntroReady] = useState(!shouldShowIntro)
  const handleTransitionChange = useCallback((value) => setIsTransitioning(value), [])
  const handleIntroComplete = useCallback(() => {
    setIntroReady(true)
  }, [])

  useEffect(() => {
    const media = window.matchMedia(orientationQuery)
    const syncOrientation = () => {
      const blocked = media.matches
      setOrientationBlocked(blocked)
      if (shouldShowIntro && !blocked) {
        document.documentElement.classList.add('is-preloading')
        setIntroStarted(true)
      }
    }
    if (media.addEventListener) media.addEventListener('change', syncOrientation)
    else media.addListener(syncOrientation)
    return () => {
      if (media.removeEventListener) media.removeEventListener('change', syncOrientation)
      else media.removeListener(syncOrientation)
    }
  }, [shouldShowIntro])

  const showSite = !orientationBlocked || introStarted
  const showPreloader = shouldShowIntro && introStarted && !introReady

  return (
    <SmoothScroll paused={!introReady}>
      <div className={`${styles.root} ${isTransitioning ? styles.transitioning : ''}`}>
        {showPreloader && <Preloader onComplete={handleIntroComplete} />}
        <div className={styles.orientationLock} role="dialog" aria-label="请横屏浏览网站">
          <div className={styles.phoneIcon} aria-hidden="true">
            <span />
          </div>
          <p>请将手机横屏</p>
          <span className={styles.orientationHint}>为了获得完整的浏览体验，请旋转您的设备</span>
        </div>
        {showSite && <>
          <TopNav logoSrc={logo} />
          <main className={styles.main}>
            <PageTransition onTransitionChange={handleTransitionChange} />
          </main>
          <ScrollHint hidden={isTransitioning} />
        </>}
      </div>
    </SmoothScroll>
  )
}
