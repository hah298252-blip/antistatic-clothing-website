import { useRef } from 'react'
import { Link } from 'react-router-dom'
import { useGSAP } from '@gsap/react'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import styles from './StickyProductGrid.module.css'

gsap.registerPlugin(ScrollTrigger)

export default function StickyProductGrid({ images, sceneProgress = 0 }) {
  const sectionRef = useRef(null)
  const stageRef = useRef(null)
  const gridRef = useRef(null)
  const contentRef = useRef(null)
  const titleRef = useRef(null)
  const detailsRef = useRef(null)
  const sceneProgressRef = useRef(sceneProgress)
  const galleryImages = [...images, ...images]
  sceneProgressRef.current = sceneProgress

  useGSAP(() => {
    const section = sectionRef.current
    const stage = stageRef.current
    const grid = gridRef.current
    const content = contentRef.current
    const title = titleRef.current
    const details = detailsRef.current
    const items = gsap.utils.toArray('[data-grid-item]', grid)
    if (!section || !stage || !grid || !content || !title || !details || !items.length) return undefined


    const columns = Array.from({ length: 3 }, () => [])
    items.forEach((item, index) => columns[index % 3].push(item))

    // Match the tutorial's dynamic centring rather than hard-coding a pixel
    // position. The invisible supporting copy still occupies the layout, so
    // this offset makes the title appear optically centred on its own.
    const getTitleOffsetY = () => {
      const dy = (content.offsetHeight - title.offsetHeight) / 2
      return (dy / content.offsetHeight) * 100
    }
    let titleOffsetY = getTitleOffsetY()
    gsap.set(title, { autoAlpha: 0, yPercent: titleOffsetY })
    gsap.set(details, { autoAlpha: 0, pointerEvents: 'none' })

    // The grid is centred. This distance is precisely what carries each
    // column beyond its nearest viewport edge, regardless of its real height.
    const getRevealDistance = () => window.innerHeight - (window.innerHeight - grid.offsetHeight) / 2

    const timeline = gsap.timeline({ paused: true })

    columns.forEach((column, columnIndex) => {
      const fromTop = columnIndex % 2 === 0
      timeline.fromTo(column,
        { y: () => getRevealDistance() * (fromTop ? -1 : 1) },
        { y: 0, stagger: { each: 0.06, from: fromTop ? 'end' : 'start' }, ease: 'power1.inOut', duration: 1 },
        // The image reveal starts near the end of the one-viewport hand-off,
        // when roughly 90% of the third screen is uncovered.
        0.55,
      )
    })

    timeline
      .to(grid, { scale: 2.05, ease: 'power3.inOut', duration: 1 }, 0.90)
      .to(columns[0], { xPercent: -40, ease: 'power3.inOut', duration: 1 }, 0.90)
      .to(columns[2], { xPercent: 40, ease: 'power3.inOut', duration: 1 }, 0.90)
      .to(columns[1], {
        yPercent: (index) => (index < Math.floor(columns[1].length / 2) ? -1 : 1) * 40,
        ease: 'power1.inOut', duration: 0.5,
      }, 1.40)

    let targetProgress = 0
    let renderedProgress = 0
    let frameId = null
    let initialSyncFrame = null
    let titleIsVisible = false
    let titleTween = null
    let contentIsVisible = false
    let contentTween = null
    gsap.set(stage, { '--reveal-half': '0%', '--mask-overlap': '0px' })
    const edgeSnapEase = gsap.parseEase('power3.out')

    const getTitleRevealProgress = () => {
      const travel = Math.max(1, section.offsetHeight - window.innerHeight)
      // The second screen rises exactly one viewport during the hand-off.
      // Half that rise is the same as half the third screen being visible.
      return Math.min(1, (window.innerHeight * 0.5) / travel)
    }

    const toggleContent = (isVisible) => {
      contentTween?.kill()
      contentTween = gsap.timeline({ defaults: { overwrite: true } })
        .to(title, {
          yPercent: isVisible ? 0 : titleOffsetY,
          duration: 0.7,
          ease: 'power2.inOut',
        })
        .to(details, {
          autoAlpha: isVisible ? 1 : 0,
          y: isVisible ? 0 : 28,
          pointerEvents: isVisible ? 'auto' : 'none',
          duration: 0.4,
          ease: `power1.${isVisible ? 'inOut' : 'out'}`,
        }, isVisible ? '-=90%' : '<')
    }
    const updateTarget = () => {
      // Never use the moment this component happens to mount as the origin.
      // On a reload in screen four, HeroMask's React progress first arrives
      // as zero and is corrected a frame later. Using that later frame as a
      // new origin made the already-scrolled third-screen transition replay.
      // The section's document position is stable through reloads, history
      // restores and ScrollTrigger refreshes, so it is the only valid origin.
      const sectionStart = window.scrollY + section.getBoundingClientRect().top
      const travel = Math.max(1, section.offsetHeight - window.innerHeight)
      targetProgress = Math.min(1, Math.max(0, (window.scrollY - sectionStart) / travel))
    }
    const render = () => {
      renderedProgress += (targetProgress - renderedProgress) * 0.16
      if (Math.abs(targetProgress - renderedProgress) < 0.0002) renderedProgress = targetProgress
      // The third screen owns all of the progress before the hand-off. Map
      // that whole interval onto its grid timeline, so the grid and its copy
      // are complete and held before the circular fourth-screen reveal begins.
      // The fourth screen reaches the viewport exactly at that hand-off.
      // Expand over 120vh with no post-reveal hold. The sticky third stage
      // ends at the exact frame the circle reaches the viewport corners, so
      // the fourth screen takes over without an intermediary panel.
      const stageTravel = Math.max(1, section.offsetHeight - window.innerHeight)
      const spotlightTravel = Math.min(window.innerHeight * 1.2, stageTravel)
      const spotlightHold = 0
      const spotlightStart = 1 - (spotlightTravel + spotlightHold) / stageTravel
      const spotlightEnd = 1 - spotlightHold / stageTravel
      const thirdSceneProgress = spotlightStart > 0
        ? Math.min(1, renderedProgress / spotlightStart)
        : renderedProgress
      timeline.progress(thirdSceneProgress)
      const spotlightProgress = Math.min(1, Math.max(0, (renderedProgress - spotlightStart) / (spotlightEnd - spotlightStart)))
      // A CSS sticky element is allowed to release at its containing block's
      // edge. During the hand-off that would make screen three travel with
      // the document instead of opening in place. Hold the stage to the
      // viewport for this interval; the fourth screen can then be obtained
      // only through the horizontal mask expansion.
      stage.style.position = spotlightProgress > 0.001 && spotlightProgress < 0.999
        ? 'fixed'
        : 'sticky'
      stage.style.inset = spotlightProgress > 0.001 && spotlightProgress < 0.999
        ? '0 auto auto 0'
        : ''
      // Lock only the mask's two horizontal reveal edges at the exact 50%
      // geometry for a short stretch. It is intentionally visible, while the
      // document itself keeps scrolling and all later fourth-screen motion is
      // untouched.
      const midpointLockStart = 0.465
      const midpointLockEnd = 0.535
      const revealProgress = spotlightProgress < midpointLockStart
        ? (spotlightProgress / midpointLockStart) * 0.5
        : spotlightProgress <= midpointLockEnd
          ? 0.5
          : 0.5 + ((spotlightProgress - midpointLockEnd) / (1 - midpointLockEnd)) * 0.5
      const edgeSnapStart = 0.82
      const edgeProgress = revealProgress <= edgeSnapStart
        ? revealProgress
        : edgeSnapStart + (1 - edgeSnapStart) * edgeSnapEase(
          (revealProgress - edgeSnapStart) / (1 - edgeSnapStart),
        )
      stage.style.setProperty('--reveal-half', `${edgeProgress * 50.1}%`)
      stage.style.setProperty('--mask-overlap', spotlightProgress > 0.01 ? '1.25px' : '0px')
      const retreatBrightness = 1 - spotlightProgress * 0.52
      stage.style.filter = `brightness(${retreatBrightness})`
      // The third stage remains the foreground only while the radial wipe is
      // actively opening. Once it is fully open, lower that stage behind the
      // fourth scene so its white base cannot cover the rings or the image.
      stage.style.zIndex = spotlightProgress >= 0.999 ? '0' : '1'

      // Equivalent to the tutorial's non-scrub title ScrollTrigger:
      // play a short fade at the reveal point, then reset only when scrolling
      // back above it. The heading itself is not transformed by later scroll.
      if (targetProgress >= getTitleRevealProgress()) {
        if (!titleIsVisible) {
          titleIsVisible = true
          titleTween?.kill()
          titleTween = gsap.to(title, { autoAlpha: 1, duration: 0.7, ease: 'power1.out' })
        }
      } else if (titleIsVisible) {
        titleIsVisible = false
        titleTween?.kill()
        titleOffsetY = getTitleOffsetY()
        gsap.set(title, { autoAlpha: 0, yPercent: titleOffsetY })
      }

      // This deliberately is not a tween inside the scrubbed grid timeline.
      // It mirrors the tutorial's callback-based toggle: scroll reaches a
      // state, then the content settles in real time and stays put.
      // Keep the centred title still throughout the grid choreography. The
      // later content settlement happens only once that choreography is over.
      // Start the final copy 170vh before the stage releases. The circular
      // reveal occupies the final 60vh, leaving a clear 95vh pause for
      // the description and product link to complete their fade-in first.
      const contentTravel = Math.max(1, section.offsetHeight - window.innerHeight)
      const contentLead = Math.min(window.innerHeight * 1.7, contentTravel)
      // Always leave a full lead-in for the copy before the mask is allowed
      // to open; it must never compete with the fourth-screen transition.
      const contentToggleProgress = Math.max(0, spotlightStart - contentLead / contentTravel)
      if (targetProgress >= contentToggleProgress && !contentIsVisible) {
        contentIsVisible = true
        toggleContent(true)
      } else if (targetProgress < contentToggleProgress && contentIsVisible) {
        contentIsVisible = false
        toggleContent(false)
      }
      frameId = requestAnimationFrame(render)
    }

    // A browser restores its scroll position before all pinned scenes have
    // completed their first measurement. Do not expose the third-screen
    // default (closed) mask during that tiny window on a restored deep link.
    // Otherwise it flashes once over screen four before the real progress is
    // applied.
    const isRestoringBelowHero = window.scrollY > 2
    if (isRestoringBelowHero) gsap.set(stage, { autoAlpha: 0 })

    updateTarget()
    // A restored page can mount anywhere in this long scene. Render its real
    // state immediately instead of smoothing from zero through the hand-off.
    renderedProgress = targetProgress
    render()
    if (isRestoringBelowHero) {
      initialSyncFrame = requestAnimationFrame(() => {
        initialSyncFrame = requestAnimationFrame(() => {
          ScrollTrigger.refresh(true)
          updateTarget()
          renderedProgress = targetProgress
          if (frameId) cancelAnimationFrame(frameId)
          render()
          gsap.set(stage, { autoAlpha: 1 })
        })
      })
    }
    const syncAfterResume = () => {
      if (document.hidden) return
      // requestAnimationFrame can be throttled while the tab is inactive.
      // Snap this custom (non-ScrollTrigger) scene to the actual scroll
      // position on return, so an outdated white stage cannot remain over
      // the fourth-screen reveal.
      updateTarget()
      renderedProgress = targetProgress
    }
    window.addEventListener('scroll', updateTarget, { passive: true })
    window.addEventListener('resize', updateTarget)
    window.addEventListener('pageshow', syncAfterResume)
    document.addEventListener('visibilitychange', syncAfterResume)
    return () => {
      window.removeEventListener('scroll', updateTarget)
      window.removeEventListener('resize', updateTarget)
      window.removeEventListener('pageshow', syncAfterResume)
      document.removeEventListener('visibilitychange', syncAfterResume)
      if (frameId) cancelAnimationFrame(frameId)
      if (initialSyncFrame) cancelAnimationFrame(initialSyncFrame)
      stage.style.zIndex = ''
      stage.style.filter = ''
      stage.style.position = ''
      stage.style.inset = ''
      stage.style.opacity = ''
      stage.style.visibility = ''
      titleTween?.kill()
      contentTween?.kill()
      timeline.kill()
    }
  }, { scope: sectionRef, dependencies: [images] })

  return (
    <section ref={sectionRef} className={styles.section} aria-label="防静电服装系列">
      <div ref={stageRef} className={styles.stage}>
        <div ref={gridRef} className={styles.grid} aria-hidden="true">
          {galleryImages.map((image, index) => (
            <figure key={`${image.src}-${index}`} className={styles.item} data-grid-item>
              <img src={image.src} alt="" className={styles.image} />
            </figure>
          ))}
        </div>
        <div ref={contentRef} className={styles.content}>
          <h2 ref={titleRef} className={styles.title}>防静电服装系列</h2>
          <div ref={detailsRef} className={styles.details}>
            <p className={styles.description}>为精密制造与洁净环境打造的专业防护</p>
            <Link className={styles.link} to="/products">查看全部产品</Link>
          </div>
        </div>
      </div>
    </section>
  )
}
