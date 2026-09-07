import { useCallback, useState } from 'react'
import TopNav from '../components/TopNav/TopNav'
import SmoothScroll from '../components/SmoothScroll/SmoothScroll'
import PageTransition from '../components/PageTransition/PageTransition'
import ScrollHint from '../components/ScrollHint/ScrollHint'
import logo from '../assert/logo.png'
import styles from './RootLayout.module.css'

export default function RootLayout() {
  const [isTransitioning, setIsTransitioning] = useState(false)
  const handleTransitionChange = useCallback((value) => setIsTransitioning(value), [])

  return (
    <SmoothScroll>
      <div className={`${styles.root} ${isTransitioning ? styles.transitioning : ''}`}>
        <div className={styles.orientationLock} role="dialog" aria-label="请横屏浏览网站">
          <div className={styles.phoneIcon} aria-hidden="true">
            <span />
          </div>
          <p>请将手机横屏</p>
          <span className={styles.orientationHint}>为了获得完整的浏览体验，请旋转您的设备</span>
        </div>
        <TopNav logoSrc={logo} />
        <main className={styles.main}>
          <PageTransition onTransitionChange={handleTransitionChange} />
        </main>
        <ScrollHint hidden={isTransitioning} />
      </div>
    </SmoothScroll>
  )
}
