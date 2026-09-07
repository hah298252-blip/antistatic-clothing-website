import { chromium } from './node_modules/playwright-core/index.mjs'
import assert from 'node:assert/strict'

const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true })
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 })
const errors = []
page.on('pageerror', error => errors.push(error.message))
await page.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle' })
await page.waitForTimeout(2000)
async function checkStage(name, offset, expected) {
  await page.evaluate(y => window.scrollTo(0, y), offset)
  await page.waitForTimeout(2800)
  const state = await page.evaluate(() => {
    const hit = document.elementFromPoint(innerWidth * .6, innerHeight * .85)
    const hitIntro = hit?.closest('[data-company-intro]')
    const rects = [...document.querySelectorAll('#company-manufacturing-clip > rect')]
    return {
      visibleTitle: hitIntro?.querySelector('h2').textContent ?? null,
      rectCount: rects.length,
      openRects: rects.filter(rect => Number(rect.getAttribute('height')) > 0).length,
      active: [...document.querySelectorAll('[data-company-intro]')].map(el => el.dataset.companyIntro),
      overflow: document.documentElement.scrollWidth > innerWidth,
    }
  })
  if (expected) assert.equal(state.visibleTitle, expected, `${name}: expected visible content at photo point`)
  assert.equal(state.rectCount, 60)
  assert.equal(state.overflow, false)
  await page.screenshot({ path: `.tmp/browser-check/${name}.png` })
  console.log(name, JSON.stringify(state))
  return state
}
await checkStage('first', 1400, '洁净 · 更专业')
const transitioning = await checkStage('transition', 1830)
assert.ok(transitioning.openRects > 0 && transitioning.openRects < 60)
await checkStage('second', 2450, '源于制造，品质可见')
const third = await checkStage('third', 3550, '严格质检，稳定品质')
assert.deepEqual(third.active, ['false', 'false', 'true'])
await checkStage('reverse-second', 2450, '源于制造，品质可见')
await checkStage('reverse-first', 1400, '洁净 · 更专业')
await page.setViewportSize({ width: 390, height: 844 })
await page.waitForTimeout(1800)
await checkStage('mobile-second', 2300, '源于制造，品质可见')
await checkStage('mobile-third', 3330, '严格质检，稳定品质')
assert.deepEqual(errors, [])
console.log('PASS: desktop, transition, reverse scrolling, mobile, no page errors')
await browser.close()
