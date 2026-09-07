const RECIPIENTS = {
  sales: process.env.SALES_EMAIL || '13921829888@139.com',
  hr: process.env.HR_EMAIL || '1447180327@qq.com',
}

const escapeHtml = (value = '') => String(value)
  .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;').replaceAll("'", '&#039;')

export default async function handler(request, response) {
  if (request.method !== 'POST') return response.status(405).json({ error: '只支持 POST 请求。' })
  if (!process.env.RESEND_API_KEY) return response.status(500).json({ error: '邮件服务尚未配置。' })

  const { type, name, email, detail = '', message } = request.body || {}
  if (!RECIPIENTS[type] || !name?.trim() || !email?.trim() || !message?.trim()) {
    return response.status(400).json({ error: '请完整填写必填内容。' })
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return response.status(400).json({ error: '请填写有效的联系邮箱。' })
  if ([name, email, detail, message].some((value) => String(value).length > 5000)) return response.status(400).json({ error: '提交内容过长。' })

  const label = type === 'sales' ? '产品报价咨询' : '工作机会咨询'
  const detailLabel = type === 'sales' ? '公司名称' : '意向岗位'
  const resendResponse = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: process.env.CONTACT_FROM_EMAIL || 'Website <onboarding@resend.dev>',
      to: [RECIPIENTS[type]],
      reply_to: email.trim(),
      subject: `【官网】${label} - ${name.trim()}`,
      html: `<h2>${label}</h2><p><strong>姓名：</strong>${escapeHtml(name.trim())}</p><p><strong>联系邮箱：</strong>${escapeHtml(email.trim())}</p>${detail.trim() ? `<p><strong>${detailLabel}：</strong>${escapeHtml(detail.trim())}</p>` : ''}<p><strong>留言内容：</strong></p><p style="white-space:pre-wrap">${escapeHtml(message.trim())}</p>`,
    }),
  })

  const result = await resendResponse.json().catch(() => ({}))
  if (!resendResponse.ok) {
    console.error('Resend error:', result)
    return response.status(502).json({ error: '邮件发送失败，请稍后重试。' })
  }
  return response.status(200).json({ ok: true })
}
