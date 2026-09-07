import { chromium } from './node_modules/playwright-core/index.mjs'
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true })
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
const errors = []
page.on('pageerror', e => { errors.push(e.message); console.log('ERROR', e.message) })
await page.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle' })
await page.waitForTimeout(1600)
async function inspect(name) {
  console.log(name, JSON.stringify(await page.evaluate(() => {
    const section = document.querySelector('[aria-label="防静电服装系列"]')
    const stage = section.firstElementChild
    const content = stage.lastElementChild
    const grid = stage.firstElementChild
    const r = section.getBoundingClientRect()
    const s = stage.getBoundingClientRect()
    const fourth = section.nextElementSibling.getBoundingClientRect()
    return { y: scrollY, start: scrollY+r.top, height: r.height, stageY:s.y, stageH:s.height, opacity:getComputedStyle(stage).opacity, visibility:getComputedStyle(stage).visibility, position:getComputedStyle(stage).position, mask:stage.style.getPropertyValue('--reveal-half'), grid: grid.style.transform, item: grid.firstElementChild.style.transform, title: content.querySelector('h2')?.getAttribute('style'), fourth: scrollY+fourth.top }
  })))
}
for (const y of [3550, 4550, 5200, 6500, 7800, 8450, 9000, 9600]) {
  await page.evaluate(y => scrollTo(0,y), y)
  await page.waitForTimeout(1600)
  await inspect(String(y))
  if ([4550, 6500, 8450, 9000].includes(y)) await page.screenshot({ path: `.tmp/browser-check/journey-${y}.png` })
}
await page.evaluate(() => scrollTo(0, 6500))
await page.waitForTimeout(1000)
await page.reload({ waitUntil: 'networkidle' })
await page.waitForTimeout(2600)
await inspect('reload')
await page.screenshot({ path: '.tmp/browser-check/journey-reload.png' })
console.log(JSON.stringify({ errors }))
await browser.close()
