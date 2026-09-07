import { useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useGSAP } from '@gsap/react'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import SplitText from '../SplitText/SplitText'
import SpecularButton from '../ui/SpecularButton'
import styles from './FourthScreen.module.css'
import cooperation from '../../assert/cooperation.webp'
import cooperation2 from '../../assert/cooperation2.webp'
import cooperation3 from '../../assert/cooperation3.webp'
import cooperation4 from '../../assert/cooperation4.webp'
import cooperation5 from '../../assert/cooperation5.webp'
import cooperation6 from '../../assert/cooperation6.webp'
import cooperation7 from '../../assert/cooperation7.webp'
import cooperation8 from '../../assert/cooperation8.webp'
import billboard from '../../assert/billboard.png'
import frame from '../../assert/frame.png'

gsap.registerPlugin(ScrollTrigger)

export default function FourthScreen({ image }) {
  const navigate = useNavigate()
  const screensRef = useRef(null)
  const circleRef = useRef(null)
  const trustTitleRef = useRef(null)
  const statsRef = useRef(null)
  const billboardRef = useRef(null)
  const billboardRangeRef = useRef(null)

  useGSAP(() => {
    const fourth = screensRef.current?.querySelector('[data-circle-stage]')
    const fourthVisual = screensRef.current?.querySelector('[data-cylinder-wrapper]')
    const circle = circleRef.current
    const circleItems = circle?.querySelectorAll('[data-circle-item]')
    if (!fourth || !fourthVisual || !circle || !circleItems?.length) return undefined

    const logoLayers = screensRef.current?.querySelectorAll('[data-partner-logo]')
    const trustTitle = trustTitleRef.current
    const billboardRange = billboardRangeRef.current
    const statItems = gsap.utils.toArray('[data-stat-item]', statsRef.current)
    let circleScrollY = 0
    let trustTween = null
    let trustExitTween = null
    let trustObserver = null
    let statsTimeline = null
    let statisticsObserver = null

    // SplitText creates its characters after fonts are ready. Once available,
    // bind their stagger to the 120vh circular reveal itself so scroll controls
    // each character's entry instead of a separate time-based trigger.
    const setupTrustReveal = () => {
      const chars = trustTitle?.querySelectorAll('.split-char')
      if (!chars?.length || trustTween) return Boolean(trustTween)
      trustTween = gsap.fromTo(chars,
        { autoAlpha: 0, y: 42, filter: 'blur(7px)' },
        {
          autoAlpha: 1,
          y: 0,
          filter: 'blur(0px)',
          duration: 0.38,
          stagger: 0.16,
          ease: 'back.out(1.25)',
          scrollTrigger: {
            trigger: fourth,
            start: 'top top',
            end: 'top -120%',
            scrub: 0.3,
            invalidateOnRefresh: true,
          },
        },
      )
      // Return the title character by character while the billboard range
      // approaches. Its exit completes before the shared billboard/data row
      // begins rising into view.
      trustExitTween = gsap.to(chars, {
        autoAlpha: 0,
        y: -38,
        filter: 'blur(6px)',
        duration: 0.32,
        stagger: { each: 0.09, from: 'end' },
        ease: 'power2.in',
        immediateRender: false,
        scrollTrigger: {
          trigger: billboardRange || fourth,
          start: 'top bottom',
          end: 'top 35%',
          scrub: 0.35,
          invalidateOnRefresh: true,
        },
      })
      return true
    }

    if (!setupTrustReveal() && trustTitle) {
      trustObserver = new MutationObserver(() => {
        if (setupTrustReveal()) {
          trustObserver?.disconnect()
          trustObserver = null
          ScrollTrigger.refresh()
        }
      })
      trustObserver.observe(trustTitle, { childList: true, subtree: true })
    }

    // The statistics live inside the same sticky presentation row as the
    // billboard. This helper lets that row start the count directly instead
    // of relying solely on its document-flow trigger position.
    const playStatistics = () => {
      if (statsTimeline && statsTimeline.progress() < 0.999) statsTimeline.play()
    }

    if (statItems.length) {
      // Keep this timeline independent from ScrollTrigger. The row itself is
      // inside a sticky scene, and a browser can leave a nested ScrollTrigger
      // paused at zero after a background-tab resume. The billboard's own
      // progress and visibility checks below explicitly start this timeline.
      statsTimeline = gsap.timeline({ paused: true })

      // ScrollTrigger can miss its initial onEnter after the browser throttles
      // a background tab. Observe the actual, transformed data row as a
      // second source of truth and resume the same timeline when it is shown.
      if ('IntersectionObserver' in window && statsRef.current) {
        statisticsObserver = new IntersectionObserver((entries) => {
          if (entries.some((entry) => entry.isIntersecting)) playStatistics()
        }, { threshold: 0.01 })
        statisticsObserver.observe(statsRef.current)
      }

      gsap.set(statItems, { autoAlpha: 0, y: 28 })
      statItems.forEach((item, index) => {
        const valueNode = item.querySelector('[data-count-value]')
        const target = Number(valueNode?.dataset.countValue ?? 0)
        const counter = { value: 0 }
        const at = index * 0.18

        statsTimeline
          .to(item, { autoAlpha: 1, y: 0, duration: 0.45, ease: 'power2.out' }, at)
          .to(counter, {
            value: target,
            duration: 1.35,
            ease: 'power2.out',
            onUpdate: () => {
              if (valueNode) valueNode.textContent = String(Math.round(counter.value))
            },
          }, at + 0.04)
      })
    }

    const billboardStage = billboardRef.current
    const billboardImage = billboardStage?.querySelector('img')
    const statisticsPanel = statsRef.current
    if (billboardStage && billboardRange && billboardImage) {
      // The board and the statistics form one shared row: reveal them with
      // the exact same transform so neither drifts while scrolling.
      gsap.fromTo([billboardImage, statisticsPanel].filter(Boolean),
        { yPercent: 100 },
        {
          yPercent: 0,
          ease: 'none',
          scrollTrigger: {
            // The board itself is absolutely positioned inside a sticky
            // scene. Measure the normal-flow range instead, so its progress
            // cannot finish early when that scene becomes sticky.
            trigger: billboardRange,
            start: 'top 13%',
            // Finish before the sticky presentation beat ends, leaving a
            // clear still moment before screen five is allowed to enter.
            end: () => `+=${window.innerHeight * 0.65}`,
            scrub: 0.75,
            onEnter: playStatistics,
            onEnterBack: playStatistics,
            onRefresh: (self) => {
              // Refresh can place this trigger directly inside its active
              // range (for example after a tab resume), without an onEnter.
              if (self.progress > 0 || self.isActive) playStatistics()
            },
            onUpdate: (self) => {
              // Start as soon as the row begins its reveal. Waiting for a
              // deeper threshold could be skipped by a momentum scroll.
              if (self.progress >= 0.01) playStatistics()
            },
            invalidateOnRefresh: true,
            // HeroMask's pin expands the document above this nested range.
            // Measure this trigger after that pin has supplied its spacer.
            refreshPriority: -10,
          },
        },
      )
    }

    // The tutorial's left-circle calculation, kept as 2D motion only. The
    // wrapper width defines the radius and scroll progress turns the circle
    // through half a revolution.
    const updateCircleItems = (scrollY = 0) => {
      const radius = circle.offsetWidth / 2
      const centerX = circle.offsetWidth / 2
      const centerY = circle.offsetHeight / 2
      const spacing = Math.PI / circleItems.length

      circleItems.forEach((item, index) => {
        const angle = Math.PI / 2 + index * spacing - scrollY * Math.PI * 2
        const x = centerX + Math.cos(angle) * radius
        const y = centerY + Math.sin(angle) * radius
        const rotation = (angle * 180) / Math.PI
        gsap.set(item, { x, y, rotation, transformOrigin: 'center center' })

        // Mirror this orbit on the right. Its centre is placed beyond the
        // right edge, so only the left-hand half of the logo circle is seen.
        const logoLayer = logoLayers?.[index]
        if (logoLayer) {
          gsap.set(logoLayer, {
            autoAlpha: 1,
            xPercent: -50,
            yPercent: -50,
            x: window.innerWidth - Math.cos(angle) * radius,
            y,
            rotation: 0,
            transformOrigin: 'center center',
          })
        }
      })
    }

    const getCircleProgress = () => {
      // The orbit starts after the fourth screen has travelled 120vh upward
      // and completes at its original 500vh endpoint. Deriving this from the
      // live DOM position remains reliable after Lenis/visibility refreshes.
      const startOffset = window.innerHeight * 1.2
      const travel = window.innerHeight * 3.8
      const travelled = -fourth.getBoundingClientRect().top - startOffset
      return Math.min(1, Math.max(0, travelled / Math.max(1, travel)))
    }
    const updateCircleFromScroll = () => {
      const circleProgress = getCircleProgress()
      circleScrollY = circleProgress * 0.75
      updateCircleItems(circleScrollY)
    }

    updateCircleFromScroll()
    const resizeCircle = () => updateCircleFromScroll()
    window.addEventListener('resize', resizeCircle)

    // Browsers throttle animation callbacks in inactive tabs. Refresh this
    // custom math-based effect independently when the page returns, rather
    // than relying only on ScrollTrigger's normal onUpdate callback.
    let refreshFrame = null
    const syncCircle = () => {
      ScrollTrigger.update()
      updateCircleFromScroll()
      syncStatistics()
    }
    const syncStatistics = () => {
      if (!statsTimeline || !statsRef.current) return
      const bounds = statsRef.current.getBoundingClientRect()
      const isInView = bounds.top < window.innerHeight * 0.8 && bounds.bottom > 0
      // A background tab can resume after ScrollTrigger's normal onEnter was
      // skipped. If the statistics are already visible and still at zero,
      // restart their count-up rather than leaving a frozen initial state.
      if (isInView) playStatistics()
    }
    const refreshCircle = () => {
      if (document.hidden) return
      cancelAnimationFrame(refreshFrame)
      refreshFrame = requestAnimationFrame(() => {
        gsap.ticker.wake()
        ScrollTrigger.refresh(true)
        syncCircle()
        syncStatistics()
      })
    }

    // A route entry can mount this scene before image decoding, font layout,
    // and HeroMask's pin spacer have all settled. Refresh on two animation
    // frames (and once on load) so the billboard range never keeps an early
    // measurement from that transient layout.
    let layoutRefreshFrame = null
    const refreshAfterLayout = () => {
      cancelAnimationFrame(layoutRefreshFrame)
      layoutRefreshFrame = requestAnimationFrame(() => {
        layoutRefreshFrame = requestAnimationFrame(() => {
          ScrollTrigger.refresh(true)
          ScrollTrigger.update()
        })
      })
    }

    window.addEventListener('scroll', syncCircle, { passive: true })
    window.addEventListener('focus', refreshCircle)
    window.addEventListener('pageshow', refreshCircle)
    window.addEventListener('load', refreshAfterLayout)
    document.addEventListener('visibilitychange', refreshCircle)
    document.fonts?.ready?.then(refreshAfterLayout)
    refreshAfterLayout()

    return () => {
      cancelAnimationFrame(refreshFrame)
      cancelAnimationFrame(layoutRefreshFrame)
      trustObserver?.disconnect()
      trustTween?.kill()
      trustExitTween?.kill()
      statsTimeline?.kill()
      statisticsObserver?.disconnect()
      window.removeEventListener('resize', resizeCircle)
      window.removeEventListener('scroll', syncCircle)
      window.removeEventListener('focus', refreshCircle)
      window.removeEventListener('pageshow', refreshCircle)
      window.removeEventListener('load', refreshAfterLayout)
      document.removeEventListener('visibilitychange', refreshCircle)
    }
  }, { scope: screensRef })

  const partners = [
    'BLAC博力安特',
    'OPM奥浦迈',
    '汤臣倍健',
    '白云山光华制药',
    '鑫禾科技',
    '血霁生物',
    '万通药业',
    '中国生物',
  ]

  const partnerLogos = [
    cooperation,
    cooperation2,
    cooperation3,
    cooperation4,
    cooperation5,
    cooperation6,
    cooperation7,
    cooperation8,
  ]

  const statistics = [
    { value: 120, suffix: '+', label: '累计服务企业' },
    { value: 300, suffix: '万+', label: '年生产能力' },
    { value: 3000, suffix: '㎡+', label: '生产基地' },
  ]

  return (
    <div ref={screensRef} className={styles.screens} data-snap-group aria-label="第四至第六屏展示">
      <section
        className={`${styles.screen} ${styles.fourth}`}
        data-circle-stage
        aria-label="合作伙伴展示"
        style={{ '--fourth-background': `url("${image}")` }}
      >
        <picture className={styles.fourthLongBackground} data-fourth-background aria-hidden="true">
          <img src={image} alt="" className={styles.fourthLongImage} />
        </picture>
        <div className={styles.fourthStickyRange}>
          <div className={styles.fourthVisual} data-cylinder-wrapper>
          <div ref={trustTitleRef}>
            <SplitText
              text="他们的选择"
              tag="h2"
              className={styles.trustTitle}
              delay={85}
              duration={0.68}
              ease="power3.out"
              splitType="chars"
              from={{ opacity: 0, y: 42, filter: 'blur(7px)' }}
              to={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              threshold={0.55}
              rootMargin="0px"
              textAlign="center"
              manual
            />
          </div>
          <div className={styles.circle} aria-label="合作伙伴名单">
            <ul ref={circleRef} className={styles.circleText}>
              {partners.map((partner) => (
                <li key={partner} className={styles.circleItem} data-circle-item>{partner}</li>
              ))}
            </ul>
          </div>
          <div className={styles.partnerLogos} aria-hidden="true">
            {partnerLogos.map((logo, index) => (
              <div key={logo} className={styles.partnerLogoLayer} data-partner-logo={index}>
                <img className={styles.partnerLogo} src={logo} alt="" />
              </div>
            ))}
          </div>
          </div>
        </div>
        <div ref={billboardRangeRef} className={styles.fourthBottomRange}>
          <div className={styles.fourthBottomVisual}>
            <section ref={statsRef} className={styles.fourthExtension} aria-label="企业数据">
              <div className={styles.statisticsContent}>
                <div className={styles.statistics}>
                  {statistics.map((stat) => (
                    <article key={stat.label} className={styles.statistic} data-stat-item>
                      <p className={styles.statNumber}>
                        <span data-count-value={stat.value}>0</span><span className={styles.statSuffix}>{stat.suffix}</span>
                      </p>
                      <p className={styles.statLabel}>{stat.label}</p>
                    </article>
                  ))}
                </div>
                <SpecularButton
                  onClick={() => navigate('/contact')}
                  textColor="#3b7799"
                  background="rgba(246, 252, 255, 0.72)"
                  hoverBackground="rgba(255, 255, 255, 0.92)"
                  lineColor="#ffffff"
                  baseColor="#88bfe0"
                  intensity={1.1}
                >
                  获取专属报价
                </SpecularButton>
              </div>
            </section>
            <section ref={billboardRef} className={styles.billboardStage} aria-label="广告牌展示">
              <img src={billboard} alt="净源科技广告牌" className={styles.billboardImage} />
            </section>
          </div>
        </div>
        <img src={frame} alt="" className={styles.fourthFrame} aria-hidden="true" />
      </section>
    </div>
  )
}
