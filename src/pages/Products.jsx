import { useLayoutEffect, useRef } from 'react'
import { gsap } from 'gsap'
import { Draggable } from 'gsap/Draggable'
import { Flip } from 'gsap/Flip'
import { SplitText } from 'gsap/SplitText'
import { InertiaPlugin } from 'gsap/InertiaPlugin'
import styles from './Products.module.css'

import product1Png from '../assert/product1.png'
import product2Png from '../assert/product2.png'
import product3Png from '../assert/product3.png'
import product4Png from '../assert/product4.png'
import product5Png from '../assert/product5.png'
import product6Png from '../assert/product6.png'
import product1Jpg from '../assert/product1.jpeg'
import product2Jpg from '../assert/product2.jpeg'
import product3Jpg from '../assert/product3.jpeg'
import product4Jpg from '../assert/product4.jpeg'
import product5Jpg from '../assert/product5.jpeg'
import product6Jpg from '../assert/product6.jpeg'
import productHero from '../assert/product.png'
import product6Alt from '../assert/product6-1.png'

gsap.registerPlugin(Draggable, Flip, SplitText, InertiaPlugin)

const products = [
  { title: '连体防静电服', text: '一体式洁净防护设计，适用于电子、半导体与高洁净度制造环境。' },
  { title: '分体防静电服', text: '轻盈耐穿，导电纤维均匀织入面料，兼顾灵活活动与静电耗散。' },
  { title: '洁净室连体服', text: '针对洁净环境的严谨工艺，减少微粒脱落，稳定守护生产流程。' },
  { title: '防静电大褂', text: '适合常规电子制造与检验岗位，提供可靠的日常静电防护。' },
  { title: '防静电工作服', text: '以舒适剪裁和稳定性能服务高频作业，让防护成为习惯。' },
  { title: '防静电配套服', text: '可按行业及岗位需求配置，为洁净与安全提供完整解决方案。' },
]

// Build a larger grid (5 columns × 3 rows = 15 cells) so the drag bounds are
// valid and the “products fade in/out as you move” effect is actually visible.
// We use the existing PNG + JPEG variants to keep every cell visually distinct.
const COLUMNS = 4
const RAW_CELLS = [
  { image: product1Png, productIndex: 0 },
  { image: product2Png, productIndex: 1 },
  { image: product3Png, productIndex: 2 },
  { image: product4Png, productIndex: 3 },
  { image: product5Png, productIndex: 4 },
  { image: product6Png, productIndex: 5 },
  { image: product1Jpg, productIndex: 0 },
  { image: product2Jpg, productIndex: 1 },
  { image: product3Jpg, productIndex: 2 },
  { image: product4Jpg, productIndex: 3 },
  { image: product5Jpg, productIndex: 4 },
  { image: product6Jpg, productIndex: 5 },
  { image: productHero, productIndex: 0 },
  { image: product6Alt, productIndex: 5 },
  { image: product1Png, productIndex: 0 },
  { image: product2Png, productIndex: 1 },
]

function Products() {
  const domRef = useRef(null)
  const gridRef = useRef(null)
  const detailsRef = useRef(null)
  const detailsThumbRef = useRef(null)
  const detailsTitleRef = useRef(null)
  const detailsTextRef = useRef(null)
  const productRefs = useRef(new Map())

  useLayoutEffect(() => {
    const dom = domRef.current
    const grid = gridRef.current
    const details = detailsRef.current
    const detailsThumb = detailsThumbRef.current
    const detailsTitle = detailsTitleRef.current
    const detailsText = detailsTextRef.current
    const productNodes = Array.from(productRefs.current.values()).filter(Boolean)

    if (!dom || !grid || !details || !detailsThumb || !detailsTitle || !detailsText || productNodes.length === 0) {
      return undefined
    }

    let currentProduct = null
    let originalParent = null
    let originalNextSibling = null
    let placeholder = null
    let splitTitles = null
    let splitTexts = null
    let isDetailsOpen = false
    let wasDragging = false
    let gridXBeforeDetails = 0
    let gridYBeforeDetails = 0
    const closeCursor = dom.querySelector(`.${styles.closeCursor}`)
    const mobileCloseButton = details.querySelector(`.${styles.mobileClose}`)

    const clamp = (value, min, max) => Math.min(Math.max(value, min), max)

    const centerGrid = () => {
      const gridWidth = grid.offsetWidth
      const gridHeight = grid.offsetHeight
      const centerX = (window.innerWidth - gridWidth) / 2
      const centerY = (window.innerHeight - gridHeight) / 2
      gsap.set(grid, { x: centerX, y: centerY })
    }

    const computeBounds = () => {
      const minX = -(grid.offsetWidth - window.innerWidth) - 200
      const maxX = 200
      const minY = -(grid.offsetHeight - window.innerHeight) - 100
      const maxY = 100
      // Defensive: when the grid is smaller than the viewport the raw minX/minY
      // can end up larger than maxX/maxY, which breaks Draggable. Clamp them.
      return {
        minX: Math.min(minX, maxX),
        maxX: Math.max(minX, maxX),
        minY: Math.min(minY, maxY),
        maxY: Math.max(minY, maxY),
      }
    }

    centerGrid()

    // Keep the viewport-sized background stationary and scale only the product
    // scene. Scaling `dom` would shrink the background itself and expose its
    // edges at the beginning of the transition.
    dom.classList.add(styles.isEntering)
    const intro = gsap.timeline()
    intro.set(grid, { scale: 0.5, transformOrigin: '50% 50%' })
    intro.set(productNodes, { scale: 0.5, opacity: 0 })
    intro.to(productNodes, {
      scale: 1,
      opacity: 1,
      duration: 0.6,
      ease: 'power3.out',
      stagger: { amount: 1.2, from: 'random' },
    })
    intro.to(grid, {
      scale: 1,
      duration: 1.2,
      ease: 'power3.inOut',
      onComplete: () => dom.classList.remove(styles.isEntering),
    })

    let bounds = computeBounds()
    const draggable = Draggable.create(grid, {
      type: 'x,y',
      bounds,
      inertia: true,
      allowEventDefault: true,
      edgeResistance: 0.9,
      onPress: () => {
        wasDragging = false
        grid.classList.add(styles.isDragging)
      },
      onDragStart: () => {
        wasDragging = true
      },
      onRelease: () => {
        grid.classList.remove(styles.isDragging)
      },
    })[0]

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.target === currentProduct) return
        if (entry.isIntersecting) {
          gsap.to(entry.target, { scale: 1, opacity: 1, duration: 0.5, ease: 'power2.out' })
        } else {
          gsap.to(entry.target, { opacity: 0, scale: 0.5, duration: 0.5, ease: 'power2.in' })
        }
      })
    }, { root: null, threshold: 0.1 })

    productNodes.forEach((product) => observer.observe(product))

    const showDetails = (product) => {
      if (isDetailsOpen || currentProduct) return

      isDetailsOpen = true
      currentProduct = product
      originalParent = product.parentNode
      originalNextSibling = product.nextSibling
      draggable.disable()
      productNodes.forEach((node) => {
        observer.unobserve(node)
        gsap.killTweensOf(node)
      })

      const productData = products[Number(product.dataset.productIndex)]
      detailsTitle.textContent = productData.title
      detailsText.textContent = productData.text

      splitTitles?.revert()
      splitTexts?.revert()
      splitTitles = null
      splitTexts = null

      // The panel becomes visible before the Flip flight finishes. Keep the
      // raw, unsplit copy hidden until SplitText has prepared its start state,
      // otherwise it flashes once before the intended reveal animation.
      gsap.set([detailsTitle, detailsText], { autoAlpha: 0 })

      const shift = details.offsetWidth
      gridXBeforeDetails = Number(gsap.getProperty(grid, 'x')) || 0
      gridYBeforeDetails = Number(gsap.getProperty(grid, 'y')) || 0
      gsap.set(details, { visibility: 'visible', pointerEvents: 'auto' })
      const detailsTimeline = gsap.timeline({ defaults: { duration: 1.2, ease: 'power3.inOut' } })
      detailsTimeline.to(details, { x: -shift, opacity: 1 }, 0)
      detailsTimeline.to(grid, { x: gridXBeforeDetails - shift, y: gridYBeforeDetails }, 0)

      const state = Flip.getState(product)
      const rect = product.getBoundingClientRect()
      placeholder = document.createElement('div')
      placeholder.style.width = `${rect.width}px`
      placeholder.style.height = `${rect.height}px`
      placeholder.style.flex = '0 0 auto'
      placeholder.style.visibility = 'hidden'
      placeholder.style.pointerEvents = 'none'
      originalParent.insertBefore(placeholder, product)
      detailsThumb.appendChild(product)
      gsap.set(product, { clearProps: 'transform,opacity' })
      product.classList.add(styles.isFlipping)

      Flip.from(state, {
        absolute: true,
        // Animate the actual box dimensions. Using scale here applies separate
        // scaleX/scaleY values while moving from a portrait card to the square
        // detail slot, which visibly stretches the image during the flight.
        scale: false,
        nested: true,
        duration: 1.2,
        ease: 'power3.inOut',
        onComplete: () => {
          product.classList.remove(styles.isFlipping)
          splitTitles = new SplitText(detailsTitle, { type: 'lines, chars', mask: 'lines', charsClass: styles.char })
          splitTexts = new SplitText(detailsText, { type: 'lines', mask: 'lines', linesClass: styles.line })
          gsap.set(splitTitles.chars, { y: '100%' })
          gsap.set(splitTexts.lines, { y: '100%' })
          gsap.set([detailsTitle, detailsText], { autoAlpha: 1 })
          gsap.to(splitTitles.chars, { y: 0, duration: 1.1, delay: 0.2, ease: 'power3.inOut', stagger: 0.025 })
          gsap.to(splitTexts.lines, { y: 0, duration: 1, delay: 0.35, ease: 'power3.inOut', stagger: 0.05 })
        },
      })
    }

    const hideDetails = () => {
      if (!currentProduct) return

      const product = currentProduct
      const state = Flip.getState(product)

      if (placeholder && placeholder.parentNode) {
        // Keep the placeholder in flow for the entire return animation. If it
        // is removed here, the next card immediately moves up to fill the gap
        // while the returning product is temporarily positioned absolutely.
        placeholder.parentNode.insertBefore(product, placeholder)
      }
      gsap.set(product, { clearProps: 'transform,opacity' })
      // Later siblings in the column otherwise paint over the returning Flip
      // element for a frame while Flip switches it back from absolute layout.
      product.classList.add(styles.isFlipping)
      gsap.to(details, { x: 0, opacity: 0, duration: 1.2, ease: 'power3.inOut' })
      gsap.to(grid, { x: gridXBeforeDetails, y: gridYBeforeDetails, duration: 1.2, ease: 'power3.inOut' })

      splitTitles?.revert()
      splitTexts?.revert()
      splitTitles = null
      splitTexts = null

      Flip.from(state, {
        absolute: true,
        scale: false,
        nested: true,
        duration: 1.2,
        ease: 'power3.inOut',
        onComplete: () => {
          if (placeholder?.parentNode) placeholder.remove()
          placeholder = null
          product.classList.remove(styles.isFlipping)
          gsap.set(product, { clearProps: 'zIndex,position,top,right,bottom,left,width,height' })
          gsap.set(details, { visibility: 'hidden', pointerEvents: 'none' })
          productNodes.forEach((node) => observer.observe(node))
          currentProduct = null
          originalParent = null
          originalNextSibling = null
          isDetailsOpen = false
          draggable.enable()
        },
      })
    }

    const onWheel = (event) => {
      event.preventDefault()
      if (isDetailsOpen) return

      const deltaX = -event.deltaX * 7
      const deltaY = -event.deltaY * 7
      const currentX = gsap.getProperty(grid, 'x')
      const currentY = gsap.getProperty(grid, 'y')
      const b = draggable.vars.bounds

      gsap.to(grid, {
        x: clamp(currentX + deltaX, b.minX, b.maxX),
        y: clamp(currentY + deltaY, b.minY, b.maxY),
        duration: 0.3,
        ease: 'power3.out',
      })
    }

    const onResize = () => {
      if (isDetailsOpen) return
      centerGrid()
      bounds = computeBounds()
      draggable.applyBounds(bounds)
    }

    const clickHandlers = new Map()
    productNodes.forEach((product) => {
      const handler = () => {
        if (wasDragging) return
        showDetails(product)
      }
      clickHandlers.set(product, handler)
      product.addEventListener('click', handler)
    })

    const moveCloseCursor = (event) => {
      if (!closeCursor) return
      const isOutsideDetails = isDetailsOpen && !details.contains(event.target)
      const rect = dom.getBoundingClientRect()
      gsap.set(closeCursor, { x: event.clientX - rect.left, y: event.clientY - rect.top })
      gsap.to(closeCursor, { autoAlpha: isOutsideDetails ? 1 : 0, scale: isOutsideDetails ? 1 : 0.7, duration: 0.2, overwrite: true })
    }
    const hideCloseCursor = () => closeCursor && gsap.to(closeCursor, { autoAlpha: 0, scale: 0.7, duration: 0.2 })
    const closeFromOutside = (event) => {
      if (isDetailsOpen && !details.contains(event.target)) {
        hideCloseCursor()
        hideDetails()
      }
    }
    const closeFromKeyboard = (event) => {
      if (event.key === 'Escape' && isDetailsOpen) {
        event.preventDefault()
        hideDetails()
      }
    }
    dom.addEventListener('click', closeFromOutside)
    dom.addEventListener('mousemove', moveCloseCursor)
    dom.addEventListener('mouseleave', hideCloseCursor)
    window.addEventListener('keydown', closeFromKeyboard)
    mobileCloseButton?.addEventListener('click', hideDetails)

    dom.addEventListener('wheel', onWheel, { passive: false })
    window.addEventListener('resize', onResize)

    return () => {
      intro.kill()
      dom.classList.remove(styles.isEntering)
      draggable.kill()
      observer.disconnect()
      splitTitles?.revert()
      splitTexts?.revert()
      dom.removeEventListener('wheel', onWheel)
      window.removeEventListener('resize', onResize)
      clickHandlers.forEach((handler, product) => product.removeEventListener('click', handler))
      dom.removeEventListener('click', closeFromOutside)
      dom.removeEventListener('mousemove', moveCloseCursor)
      dom.removeEventListener('mouseleave', hideCloseCursor)
      window.removeEventListener('keydown', closeFromKeyboard)
      mobileCloseButton?.removeEventListener('click', hideDetails)

      if (currentProduct && originalParent) {
        currentProduct.classList.remove(styles.isFlipping)
        if (placeholder && placeholder.parentNode) {
          placeholder.parentNode.insertBefore(currentProduct, placeholder)
          placeholder.remove()
          placeholder = null
        } else if (originalNextSibling) {
          originalParent.insertBefore(currentProduct, originalNextSibling)
        } else {
          originalParent.appendChild(currentProduct)
        }
      }
    }
  }, [])

  return (
    <main ref={domRef} className={styles.container} data-lenis-prevent>
      <div ref={gridRef} className={styles.grid}>
        {Array.from({ length: COLUMNS }, (_, columnIndex) => (
          <div key={columnIndex} className={styles.column}>
            {RAW_CELLS.filter((_, i) => i % COLUMNS === columnIndex).map((cell, rowIndex) => {
              const cellKey = `c${columnIndex}-${rowIndex}`
              return (
                <div
                  key={cellKey}
                  ref={(node) => {
                    if (node) productRefs.current.set(cellKey, node)
                    else productRefs.current.delete(cellKey)
                  }}
                  className={styles.product}
                  data-product-index={cell.productIndex}
                >
                  <div>
                    <img src={cell.image} alt={products[cell.productIndex].title} />
                  </div>
                </div>
              )
            })}
          </div>
        ))}
      </div>

      <section ref={detailsRef} className={styles.details} aria-label="产品详情">
        <button type="button" className={styles.mobileClose} aria-label="关闭产品详情">
          <span aria-hidden="true">&times;</span>
        </button>
        <div className={styles.detailsTitle}>
          <p ref={detailsTitleRef}>产品名称</p>
        </div>
        <div className={styles.detailsBody}>
          <div ref={detailsThumbRef} className={styles.detailsThumb} />
          <div className={styles.detailsTexts}>
            <p ref={detailsTextRef}>产品说明</p>
          </div>
        </div>
      </section>
      <span className={styles.closeCursor} aria-hidden="true">&times;</span>
    </main>
  )
}

export default Products
