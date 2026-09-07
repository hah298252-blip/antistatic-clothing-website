import styles from './About.module.css'
import about1 from '../assert/about1.png'
import about2 from '../assert/about2.png'
import about3 from '../assert/about3.png'
import about4 from '../assert/about4.png'

const SECTIONS = [
  { title: '企业起源', english: 'Our Origin', image: about1, alt: '净源科技企业起源' },
  { title: '发展历程', english: 'Our Journey', image: about2, alt: '净源科技发展历程' },
  { title: '企业文化', english: 'Our Culture', image: about3, alt: '净源科技企业文化' },
  { title: '荣誉与认可', english: 'Honors & Recognition', image: about4, alt: '净源科技荣誉与认可' },
]

export default function About() {
  return (
    <main className={styles.page}>
      <div className={styles.noise} aria-hidden="true" />
      <nav className={styles.menu} aria-label="关于净源科技">
        {SECTIONS.map((item, index) => (
          <div className={styles.item} key={item.title}>
            <button className={styles.itemLink} type="button">
              <sup>{String(index + 1).padStart(2, '0')}</sup>
              {item.title}
            </button>
            <img className={styles.itemImage} src={item.image} alt={item.alt} />
            <div className={styles.marquee} aria-hidden="true">
              <div className={styles.marqueeInner}>
                {Array.from({ length: 4 }, (_, repeat) => (
                  <span key={repeat}>{item.title} <em>{item.english}</em></span>
                ))}
              </div>
            </div>
          </div>
        ))}
      </nav>
    </main>
  )
}
