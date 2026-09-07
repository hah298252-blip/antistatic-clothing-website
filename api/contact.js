import { createHash } from 'node:crypto'
import { Redis } from '@upstash/redis'

const RECIPIENTS = {
  sales: process.env.SALES_EMAIL || '13921829888@139.com',
  hr: process.env.HR_EMAIL || '1447180327@qq.com',
}

const redisUrl = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN
const redis = redisUrl && redisToken ? new Redis({ url: redisUrl, token: redisToken }) : null
const MONTHLY_SITE_LIMIT = 3000
const MONTHLY_PERSON_LIMIT = 4
const MAX_BODY_BYTES = 12_000

const RATE_LIMIT_SCRIPT = `
local globalCount = tonumber(redis.call('GET', KEYS[1]) or '0')
local ipCount = tonumber(redis.call('GET', KEYS[2]) or '0')
local emailCount = tonumber(redis.call('GET', KEYS[3]) or '0')
if globalCount >= tonumber(ARGV[1]) then return {0, globalCount, ipCount, emailCount} end
if ipCount >= tonumber(ARGV[2]) or emailCount >= tonumber(ARGV[2]) then return {1, globalCount, ipCount, emailCount} end
for index = 1, 3 do
  local count = redis.call('INCR', KEYS[index])
  if count == 1 then redis.call('EXPIREAT', KEYS[index], ARGV[3]) end
end
return {2, globalCount + 1, ipCount + 1, emailCount + 1}
`

const escapeHtml = (value = '') => String(value)
  .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;').replaceAll("'", '&#039;')

const normalizeText = (value, maxLength) => typeof value === 'string'
  ? value.trim().replaceAll('\u0000', '').slice(0, maxLength + 1)
  : ''
const hashIdentity = (value) => createHash('sha256').update(value).digest('hex').slice(0, 32)
const getClientIp = (request) => {
  const forwarded = request.headers['x-forwarded-for']
  const value = Array.isArray(forwarded) ? forwarded[0] : forwarded
  return String(value || request.socket?.remoteAddress || 'unknown').split(',')[0].trim()
}
const setSecurityHeaders = (response) => {
  response.setHeader('Cache-Control', 'no-store')
  response.setHeader('X-Content-Type-Options', 'nosniff')
  response.setHeader('Referrer-Policy', 'no-referrer')
}
const isSameOrigin = (request) => {
  if (request.headers['sec-fetch-site'] === 'cross-site') return false
  const origin = request.headers.origin
  if (!origin) return true
  const host = String(request.headers['x-forwarded-host'] || request.headers.host || '').toLowerCase()
  try { return new URL(origin).host.toLowerCase() === host } catch { return false }
}
const reserveMonthlyQuota = async (ip, email) => {
  const now = new Date()
  const month = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`
  const expiresAt = Math.floor(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 2) / 1000)
  return redis.eval(RATE_LIMIT_SCRIPT, [
    `contact:${month}:global`,
    `contact:${month}:ip:${hashIdentity(ip)}`,
    `contact:${month}:email:${hashIdentity(email.toLowerCase())}`,
  ], [String(MONTHLY_SITE_LIMIT), String(MONTHLY_PERSON_LIMIT), String(expiresAt)])
}

export default async function handler(request, response) {
  setSecurityHeaders(response)
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST')
    return response.status(405).json({ error: '只支持 POST 请求。' })
  }
  if (!isSameOrigin(request)) return response.status(403).json({ error: '请求来源无效。' })
  if (!String(request.headers['content-type'] || '').toLowerCase().startsWith('application/json')) {
    return response.status(415).json({ error: '请求格式无效。' })
  }
  const contentLength = Number(request.headers['content-length'] || 0)
  if (contentLength > MAX_BODY_BYTES || Buffer.byteLength(JSON.stringify(request.body || {}), 'utf8') > MAX_BODY_BYTES) {
    return response.status(413).json({ error: '提交内容过大。' })
  }
  if (!process.env.RESEND_API_KEY) return response.status(503).json({ error: '邮件服务尚未配置。' })
  if (!redis) return response.status(503).json({ error: '邮件限流服务尚未配置。' })

  const { type, website = '' } = request.body || {}
  if (typeof website === 'string' && website.trim()) return response.status(200).json({ ok: true })
  const name = normalizeText(request.body?.name, 80)
  const email = normalizeText(request.body?.email, 254).toLowerCase()
  const detail = normalizeText(request.body?.detail, 200)
  const message = normalizeText(request.body?.message, 2000)
  if (!RECIPIENTS[type] || !name || !email || !message) return response.status(400).json({ error: '请完整填写必填内容。' })
  if (name.length > 80 || email.length > 254 || detail.length > 200 || message.length > 2000) {
    return response.status(400).json({ error: '提交内容超过允许长度。' })
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) || /[\r\n]/.test(email)) {
    return response.status(400).json({ error: '请填写有效的联系邮箱。' })
  }

  let quota
  try {
    quota = await reserveMonthlyQuota(getClientIp(request), email)
  } catch (error) {
    console.error('Rate limit error:', error)
    return response.status(503).json({ error: '邮件服务暂时繁忙，请稍后重试。' })
  }
  if (Number(quota?.[0]) === 0) return response.status(429).json({ error: '本月邮件发送额度已用完，请下月再试。' })
  if (Number(quota?.[0]) === 1) return response.status(429).json({ error: '每位用户每月最多提交 4 次，请下月再试。' })

  const label = type === 'sales' ? '产品报价咨询' : '工作机会咨询'
  const detailLabel = type === 'sales' ? '公司名称' : '意向岗位'
  const subjectName = name.replace(/[\r\n]+/g, ' ')
  const resendResponse = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: '净源科技官网 <website@jsjingyuankeji.com>',
      to: [RECIPIENTS[type]],
      reply_to: email,
      subject: `【官网】${label} - ${subjectName}`,
      html: `<h2>${label}</h2><p><strong>姓名：</strong>${escapeHtml(name)}</p><p><strong>联系邮箱：</strong>${escapeHtml(email)}</p>${detail ? `<p><strong>${detailLabel}：</strong>${escapeHtml(detail)}</p>` : ''}<p><strong>留言内容：</strong></p><p style="white-space:pre-wrap">${escapeHtml(message)}</p>`,
    }),
  })
  const result = await resendResponse.json().catch(() => ({}))
  if (!resendResponse.ok) {
    console.error('Resend error:', result)
    return response.status(502).json({ error: '邮件发送失败，请稍后重试。' })
  }
  return response.status(200).json({ ok: true })
}
