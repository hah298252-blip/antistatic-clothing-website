import { useLayoutEffect, useRef } from 'react'
import factory from '../../assert/background1.jpg'
import workshop from '../../assert/manufacturing-layout.png'
import cleanroom from '../../assert/background3.jpg'
import styles from './CompanyIntro.module.css'

const features = [
  { title: '防静电防护', detail: '安全可靠', path: 'M24 3 7 10v13c0 11 17 21 17 21s17-10 17-21V10L24 3Zm2 9-9 15h8l-3 10 10-16h-8l2-9Z' },
  { title: '标准化生产', detail: '稳定品质', path: 'm19 4-1 6-5 3-6-2-4 7 5 4v6l-5 4 4 7 6-2 5 3 1 6h9l1-6 5-3 6 2 4-7-5-4v-6l5-4-4-7-6 2-5-3-1-6h-9ZM32 25a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z' },
  { title: '洁净制造', detail: '严控环境', path: 'M7 5v37h35V20l-12 6V15l-12 8V5M15 32h5v5h-5Zm15 0h5v5h-5ZM32 12V7h10v5' },
  { title: '专业服务', detail: '快速响应', path: 'M32 13a8 8 0 1 1-16 0 8 8 0 0 1 16 0ZM11 26c-6 0-8 5-8 11v5h7m27-16c6 0 8 5 8 11v5h-7M16 27c-5 2-6 7-6 15h28c0-8-1-13-6-15M10 10a6 6 0 0 0 0 12m28-12a6 6 0 0 1 0 12' },
]

const manufacturingFeatures = [
  { title: '规范车间', detail: '洁净生产', path: 'M5 44V5h18v39M23 18h18v26M3 44h42M11 12h5v5h-5Zm0 11h5v5h-5Zm0 11h5v5h-5ZM29 25h6v6h-6Zm0 12h6v7h-6Z' },
  { ...features[1], title: '流程管理', detail: '标准执行' },
  { title: '品质检验', detail: '层层把关', path: 'M24 3 6 10v13c0 12 18 21 18 21s18-9 18-21V10L24 3ZM15 23l6 6 12-13' },
  { ...features[3], title: '专业团队', detail: '稳定交付' },
]

export default function CompanyIntro({ active, variant = 'company' }) {
  const copyRef = useRef(null)
  const manufacturing = variant === 'manufacturing'
  const quality = variant === 'quality'
  const photo = quality ? cleanroom : manufacturing ? workshop : factory
  const items = quality ? [
    { ...manufacturingFeatures[0], title: '原料把控', detail: '源头保障' },
    { ...features[0], title: '性能检测', detail: '静电防护' },
    { ...manufacturingFeatures[2], title: '严格质检', detail: '细节把关' },
    { ...features[1], title: '稳定品质', detail: '可靠交付' },
  ] : manufacturing ? manufacturingFeatures : features

  useLayoutEffect(() => {
    if (!manufacturing && !quality) return undefined
    const copy = copyRef.current
    if (!copy) return undefined

    const alignWithFirstPanel = () => {
      copy.style.transform = ''
      copy.style.setProperty('--copy-align-offset', '0px')
      const compactLayout = window.matchMedia(
        '(max-width: 768px), (max-height: 500px) and (orientation: landscape)'
      ).matches
      if (compactLayout) return
      const firstTitle = document.querySelector('[data-company-variant="company"] h2')
      const currentTitle = copy.querySelector('h2')
      if (!firstTitle || !currentTitle) return
      const offset = firstTitle.getBoundingClientRect().top - currentTitle.getBoundingClientRect().top
      copy.style.setProperty('--copy-align-offset', `${offset}px`)
    }

    alignWithFirstPanel()
    document.fonts?.ready.then(alignWithFirstPanel)
    window.addEventListener('resize', alignWithFirstPanel)
    return () => window.removeEventListener('resize', alignWithFirstPanel)
  }, [manufacturing, quality])

  return (
    <div className={`${styles.intro} ${manufacturing || quality ? styles.manufacturing : ''}`} data-company-intro={active} data-company-variant={variant} inert={!active} aria-hidden={!active}>
      <div className={styles.photo} role="img" aria-label={quality ? '身着防静电防护服的工作人员走过洁净室' : manufacturing ? '洁净生产车间内，穿着防护服的员工进行服装缝制' : '蓝天下的现代化洁净生产厂房'}>
        <svg viewBox={quality ? '0 0 1448 1086' : manufacturing ? '581 353 848 588' : '0 0 7952 4428'} preserveAspectRatio="xMidYMid slice" aria-hidden="true">
          <image href={photo} width={quality ? 1448 : manufacturing ? 1672 : 7952} height={quality ? 1086 : manufacturing ? 941 : 5304} />
        </svg>
      </div>
      <div className={styles.navSpace} aria-hidden="true" />
      <div className={styles.wordmark} aria-label="JINGYUAN">JINGYUAN</div>
      <div className={styles.content}>
        <div ref={copyRef} className={styles.copy}>
          <h2>{quality ? '质检 · 稳定品质' : manufacturing ? '制造 · 品质可见' : '洁净 · 更专业'}</h2>
          <div className={styles.rule} />
          {quality ? <p>让每一件防静电服，都经得起检验。<br />从原材料选择到成品出厂，严格进行质量检查与性能检测，<br className={styles.desktopBreak} />关注防静电性能、做工细节与成衣品质，<br className={styles.desktopBreak} />为客户提供稳定、可靠的防静电服装产品。</p> : manufacturing ? <p>从面料到成衣，严格把控每一道生产工序。<br />拥有规范化生产车间与专业生产团队，严格执行生产流程，<br className={styles.desktopBreak} />从面料裁剪、缝制加工到成品检验，层层把关，<br className={styles.desktopBreak} />确保每一件防静电服装稳定可靠。</p> : <p>专注防静电服装，守护洁净与安全。<br />以专业的生产能力、稳定的产品品质和<br className={styles.desktopBreak} />严谨的制造标准，为电子、半导体、医药、<br className={styles.desktopBreak} />精密制造等行业提供可靠的防静电服装解决方案。</p>}
          <ul className={styles.features}>
            {items.map(({ title, detail, path }) => <li key={title}>
              <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinejoin="round" aria-hidden="true"><path d={path} /></svg>
              <strong>{title}</strong><span>{detail}</span>
            </li>)}
          </ul>
        </div>
      </div>
    </div>
  )
}
