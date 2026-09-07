import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import styles from './Contact.module.css'

const CONTACTS = {
  sales: { index: '01', eyebrow: 'BUSINESS INQUIRY', title: '询问产品报价', recipient: '销售总监', description: '告诉我们您的产品需求与采购数量，销售团队将尽快为您提供专属报价。', placeholder: '请填写产品类型、数量、使用场景或其他需求…', button: '发送报价询问' },
  hr: { index: '02', eyebrow: 'CAREER INQUIRY', title: '询问工作机会', recipient: '人力资源部', description: '向我们介绍您自己、感兴趣的岗位与相关经历，HR 团队期待了解更多。', placeholder: '请填写意向岗位、相关经验以及您想告诉我们的内容…', button: '发送求职询问' },
}

export default function Contact() {
  const [searchParams] = useSearchParams()
  const [active, setActive] = useState(() => searchParams.get('type') === 'hr' ? 'hr' : 'sales')
  const [status, setStatus] = useState('idle')
  const [feedback, setFeedback] = useState('')
  const contact = CONTACTS[active]

  const switchContact = (key) => {
    setActive(key)
    setStatus('idle')
    setFeedback('')
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setStatus('sending')
    setFeedback('')
    const form = event.currentTarget
    const data = Object.fromEntries(new FormData(form))

    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, type: active }),
      })
      const result = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(result.error || '邮件发送失败，请稍后重试。')
      form.reset()
      setStatus('success')
      setFeedback(active === 'sales' ? '询价邮件已发送，销售团队会尽快联系您。' : '求职邮件已发送，HR 团队会尽快查看。')
    } catch (error) {
      setStatus('error')
      setFeedback(error.message || '邮件发送失败，请稍后重试。')
    }
  }

  return (
    <section className={styles.page}>
      <div className={styles.grid} aria-hidden="true" />
      <header className={styles.header}>
        <span className={styles.kicker}>CONTACT / 联系我们</span>
        <h1>开始一场<br /><em>有价值的对话</em></h1>
      </header>

      <div className={styles.contactArea}>
        <nav className={styles.switcher} aria-label="选择联系部门">
          {Object.entries(CONTACTS).map(([key, item]) => (
            <button key={key} type="button" className={`${styles.switchButton} ${active === key ? styles.active : ''}`} onClick={() => switchContact(key)} aria-pressed={active === key}>
              <span className={styles.number}>{item.index}</span>
              <span><small>{item.recipient}</small><strong>{item.title}</strong></span>
              <span className={styles.arrow} aria-hidden="true">↗</span>
            </button>
          ))}
        </nav>

        <div className={styles.formPanel} key={active}>
          <div className={styles.formIntro}><span>{contact.eyebrow}</span><h2>{contact.title}</h2><p>{contact.description}</p></div>
          <form className={styles.form} onSubmit={handleSubmit}>
            <div className={styles.fieldRow}>
              <label><span>您的姓名 *</span><input name="name" type="text" autoComplete="name" placeholder="姓名" required disabled={status === 'sending'} /></label>
              <label><span>联系邮箱 *</span><input name="email" type="email" autoComplete="email" placeholder="name@example.com" required disabled={status === 'sending'} /></label>
            </div>
            <label><span>{active === 'sales' ? '公司名称' : '意向岗位'}</span><input name="detail" type="text" autoComplete={active === 'sales' ? 'organization' : 'off'} placeholder={active === 'sales' ? '您的公司（选填）' : '您感兴趣的岗位（选填）'} disabled={status === 'sending'} /></label>
            <label><span>{active === 'sales' ? '采购需求 *' : '自我介绍 *'}</span><textarea name="message" rows="4" placeholder={contact.placeholder} required disabled={status === 'sending'} /></label>
            <button className={styles.submit} type="submit" disabled={status === 'sending'}><span>{status === 'sending' ? '正在发送…' : contact.button}</span><span aria-hidden="true">{status === 'sending' ? '···' : '↗'}</span></button>
            {feedback && <p className={`${styles.feedback} ${status === 'success' ? styles.success : styles.error}`} role="status">{feedback}</p>}
          </form>
        </div>
      </div>
    </section>
  )
}
