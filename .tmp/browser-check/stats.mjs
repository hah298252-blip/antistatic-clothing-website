import { chromium } from './node_modules/playwright-core/index.mjs'
import assert from 'node:assert/strict'
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true })
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
await page.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle' })
await page.waitForTimeout(1400)
await page.evaluate(() => {
  const panel = document.querySelector('[aria-label="企业数据"]')
  window.scrollTo(0, scrollY + panel.getBoundingClientRect().top)
})
await page.waitForTimeout(3500)
for (const width of [1440, 1024, 390]) {
  await page.setViewportSize({ width, height: 900 })
  await page.waitForTimeout(1500)
  const tops = await page.evaluate(() => [...document.querySelectorAll('[data-stat-item]')].map(el => el.lastElementChild.getBoundingClientRect().top))
  assert.ok(Math.max(...tops) - Math.min(...tops) < 1, `aligned labels at ${width}: ${tops}`)
  console.log(width, tops)
  const numbers = await page.evaluate(() => [...document.querySelectorAll('[data-stat-item]')].map(el => {
    const number = el.firstElementChild
    const digits = number.firstElementChild.getBoundingClientRect()
    const box = number.getBoundingClientRect()
    return { top: digits.top, bottom: digits.bottom, overflow: number.scrollWidth > number.clientWidth + 1, height: box.height }
  }))
  assert.ok(Math.max(...numbers.map(n => n.top)) - Math.min(...numbers.map(n => n.top)) < 1, `number tops aligned at ${width}`)
  assert.ok(Math.max(...numbers.map(n => n.bottom)) - Math.min(...numbers.map(n => n.bottom)) < 1, `number baselines aligned at ${width}`)
  assert.ok(numbers.every(n => !n.overflow), `numbers fit at ${width}: ${JSON.stringify(numbers)}`)
  console.log('numbers', numbers)
}
console.log('PASS: all three labels share the same top across desktop, tablet, mobile')
await browser.close()
