import { NavLink } from 'react-router-dom'
import styles from './TopNav.module.css'

const ITEMS = [
  { label: '首页', href: '/' },
  { label: '产品', href: '/products' },
  { label: '关于', href: '/about' },
  { label: '联系', href: '/contact' },
]

export default function TopNav({ logoSrc }) {
  return (
    <nav className={styles.nav} aria-label="主导航">
      {/* Logo */}
      {logoSrc && (
        <NavLink to="/" className={styles.logo} aria-label="回到首页">
          <img src={logoSrc} alt="净源科技" className={styles.logoImg} />
        </NavLink>
      )}

      {/* Nav links */}
      <ul className={styles.links} role="list">
        {ITEMS.map(({ label, href }) => (
          <li key={href}>
            <NavLink
              to={href}
              end={href === '/'}
              className={({ isActive }) =>
                [styles.link, isActive ? styles.active : ''].join(' ').trim()
              }
            >
              {label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}
