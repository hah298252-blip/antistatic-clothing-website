import { useLayoutEffect, useRef, useState } from 'react'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import HeroMask from '../components/HeroMask/HeroMask'
import CompanyIntro from '../components/CompanyIntro/CompanyIntro'
import StickyProductGrid from '../components/StickyProductGrid/StickyProductGrid'
import FourthScreen from '../components/FourthScreen/FourthScreen'
import FifthScreen from '../components/FifthScreen/FifthScreen'
import SixthScreen from '../components/SixthScreen/SixthScreen'
import bgLeft from '../assert/bg_left.png'
import bgRight from '../assert/bg_right.png'
import bgLeftCover from '../assert/bg_left_cover.png'
import bgRightCover from '../assert/bg_right_cover.png'
import product1png from '../assert/product1.png'
import product2png from '../assert/product2.png'
import product3png from '../assert/product3.png'
import product4png from '../assert/product4.png'
import product5png from '../assert/product5.png'
import product6png from '../assert/product6.png'
import background from '../assert/background4.png'
import styles from './Home.module.css'

gsap.registerPlugin(ScrollTrigger)

const BLIND_COUNT = 30
const IMAGES = [
  { src: product1png, alt: 'D级分体服' }, { src: product2png, alt: 'C级连体服' },
  { src: product3png, alt: 'B级连体服' }, { src: product4png, alt: '防静电服装' },
  { src: product5png, alt: '防静电连体服' }, { src: product6png, alt: '防静电配件' },
]

function CompanyStory({ embedded = false, progress = 0 }) {
  const stageRef = useRef(null)
  const blindRefs = useRef([[], [], []])
  const [activeStory, setActiveStory] = useState(0)
  const [viewBoxWidth, setViewBoxWidth] = useState(100)

  useLayoutEffect(() => {
    const updateViewBox = () => setViewBoxWidth((window.innerWidth / window.innerHeight) * 100)
    updateViewBox()
    window.addEventListener('resize', updateViewBox)
    return () => window.removeEventListener('resize', updateViewBox)
  }, [])

  useLayoutEffect(() => {
    if (!embedded) return undefined
    const blindHeight = 100 / BLIND_COUNT
    const setLayer = (layerIndex, amount) => {
      // A wider stagger gives each horizontal leaf a distinct, scroll-led beat.
      const staggerDuration = 1 + (BLIND_COUNT - 1) * 0.05
      const pairAmount = (index) => Math.min(1, Math.max(0, amount * staggerDuration - Math.floor(index / 2) * 0.05))
      gsap.set(blindRefs.current[layerIndex], {
        attr: {
          y: (index) => {
            const center = 100 - (Math.floor(index / 2) + 0.5) * blindHeight
            return index % 2 === 0 ? center - blindHeight * pairAmount(index) : center
          },
          height: (index) => blindHeight * pairAmount(index) + (pairAmount(index) > 0 ? 0.01 : 0),
        },
      })
    }
    // The story has 3.6 viewport heights: each completed image holds for
    // roughly seven standard mouse-wheel steps, then the next blind opens.
    const storyProgress = Math.min(1, Math.max(0, (progress - 1 / 4.6) / (3.6 / 4.6)))
    setLayer(1, Math.min(1, Math.max(0, (storyProgress - 0.26) / 0.11)))
    setLayer(2, Math.min(1, Math.max(0, (storyProgress - 0.63) / 0.11)))
    setActiveStory(storyProgress < 0.26 ? 0 : storyProgress < 0.63 ? 1 : 2)

    return undefined
  }, [embedded, progress, viewBoxWidth])

  useLayoutEffect(() => {
    if (embedded) return undefined
    const stage = stageRef.current
    if (!stage) return undefined
    const blindHeight = 100 / BLIND_COUNT
    const getBlind = (index) => ({
      y: 100 - (index * blindHeight + blindHeight / 2),
      height: blindHeight + 0.01,
    })
    const resetBlinds = (layerIndex) => {
      gsap.set(blindRefs.current[layerIndex], {
        attr: {
          y: (index) => getBlind(Math.floor(index / 2)).y,
          height: 0,
        },
      })
    }

    const context = gsap.context(() => {
      resetBlinds(1)
      resetBlinds(2)
      const openBlinds = (layerIndex, position, timeline) => timeline.to(blindRefs.current[layerIndex], {
        attr: {
          y: (index) => {
            const blind = getBlind(Math.floor(index / 2))
            return index % 2 === 0 ? blind.y - blind.height : blind.y
          },
          height: (index) => getBlind(Math.floor(index / 2)).height,
        },
        duration: 1,
        ease: 'none',
        stagger: { each: 0.02, from: 'start' },
      }, position)

      const timeline = gsap.timeline({
        scrollTrigger: {
          trigger: stage,
          start: 'top top',
          end: '+=200%',
          pin: true,
          scrub: 2.2,
          invalidateOnRefresh: true,
          onUpdate: ({ progress }) => {
            const nextStory = progress < 0.28 ? 0 : progress < 0.76 ? 1 : 2
            setActiveStory((current) => current === nextStory ? current : nextStory)
          },
        },
      })
      timeline.to({}, { duration: 0.25 })
      openBlinds(1, 0.25, timeline)
      openBlinds(2, 1.35, timeline)
      timeline.to({}, { duration: 0.25 })
    }, stage)
    return () => context.revert()
  }, [embedded, viewBoxWidth])

  return (
    <section ref={stageRef} className={styles.companyStory} aria-label="公司实力介绍">
      <div className={styles.storyViewport}>
        <CompanyIntro active={activeStory === 0 && (!embedded || progress >= 1 / 4.6)} />
        <svg className={styles.storyClipDefinitions} aria-hidden="true">
          <defs>
            {['manufacturing', 'quality'].map((variant, offset) => (
              <clipPath key={variant} id={`company-${variant}-clip`} clipPathUnits="objectBoundingBox">
                {/* Direct shapes are required for Chromium to render the clip. */}
                {Array.from({ length: BLIND_COUNT * 2 }, (_, index) => (
                  <rect key={index} ref={(node) => { blindRefs.current[offset + 1][index] = node }}
                    transform={`scale(${1 / viewBoxWidth} 0.01)`}
                    x="0" y={100 - (Math.floor(index / 2) + 0.5) * (100 / BLIND_COUNT)}
                    width={viewBoxWidth} height="0" />
                ))}
              </clipPath>
            ))}
          </defs>
        </svg>
        {['manufacturing', 'quality'].map((variant, offset) => (
          <div key={variant} className={styles.manufacturingLayer}
            style={{ zIndex: offset + 1, clipPath: `url(#company-${variant}-clip)` }}>
            <CompanyIntro variant={variant} active={activeStory === offset + 1} />
          </div>
        ))}
      </div>
    </section>
  )
}

export default function Home() {
  const [sceneProgress, setSceneProgress] = useState(0)

  return <div className={styles.page}>
    <HeroMask
      bgLeft={bgLeft}
      bgRight={bgRight}
      bgLeftCover={bgLeftCover}
      bgRightCover={bgRightCover}
      scrollLength={560}
      contentScrollLength={460}
      onScrollProgress={setSceneProgress}
    >
      <CompanyStory embedded progress={sceneProgress} />
    </HeroMask>
    <StickyProductGrid images={IMAGES} sceneProgress={sceneProgress} />
    <FourthScreen image={background} />
    <FifthScreen />
    <SixthScreen />
  </div>
}
