// End-to-end smoke test: builds nothing itself — run `npm run build` first (or use `npm run smoke`).
// Needs a Chromium: set CHROME_PATH, or run `npx playwright-core install chromium` once.
import { spawn } from 'node:child_process'
import assert from 'node:assert/strict'
import { chromium } from 'playwright-core'

const PORT = 4179, BASE = `http://localhost:${PORT}`
const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore' })
const cleanup = () => server.kill()
process.on('exit', cleanup)

async function waitForServer() {
  for (let i = 0; i < 60; i++) { try { if ((await fetch(BASE)).ok) return } catch (_) { /* not up yet */ } await new Promise((r) => setTimeout(r, 500)) }
  throw new Error('preview server did not start')
}
const step = (name) => console.log('  ✓', name)

await waitForServer()
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })
let failed = false
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } })
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  page.on('console', (m) => { if (m.type() === 'error' && !/favicon|vibrate|Failed to load resource/i.test(m.text())) errors.push(m.text()) })
  // network failures only count when they hit our own origin (third-party fonts/analytics may be blocked in CI)
  page.on('requestfailed', (r) => { if (r.url().startsWith(BASE)) errors.push(`request failed: ${r.url()}`) })
  page.on('response', (r) => { if (r.url().startsWith(BASE) && r.status() >= 400) errors.push(`${r.status()} ${r.url()}`) })

  // static assets
  for (const path of ['/sw.js', '/manifest.webmanifest', '/og.jpg', '/robots.txt', '/Iman-Mohammadi-CV.pdf', '/models/models.json']) {
    const r = await page.request.get(BASE + path); assert.equal(r.status(), 200, `${path} should be served`)
  }
  step('static assets (sw, manifest, og image, cv, models manifest)')

  // arrival screen: quiet, with the 2D portfolio one click away
  await page.goto(`${BASE}/?quality=high`, { waitUntil: 'load' })
  await page.waitForFunction(() => /Enter my world/.test(document.getElementById('startLabel')?.textContent || ''), null, { timeout: 120000 })
  step('arrival screen loads the world (fonts, city, car model)')
  await page.click('#twoDBtn'); await page.waitForSelector('#portfolio2d:not([hidden])')
  assert.ok((await page.textContent('#p2dInner')).includes('Iman'), 'name on the 2D page')
  assert.equal(await page.locator('#p2dInner .grid .card').count(), 6, 'six project cards')
  assert.ok(await page.$('#portfolio2d a[href="/Iman-Mohammadi-CV.pdf"]') && await page.$('#portfolio2d a[href^="mailto:"]'), 'CV + email on the 2D page')
  await page.keyboard.press('Escape'); await page.waitForSelector('#portfolio2d', { state: 'hidden' })
  step('read-without-driving page has every section, CV and email')

  await page.click('#startBtn')
  await page.waitForSelector('#hud.is-on', { timeout: 15000 })
  await page.waitForFunction(() => document.getElementById('objTitle').textContent.trim().length > 1 && document.getElementById('whereDistrict').textContent.trim().length > 1, null, { timeout: 15000 })
  assert.match(await page.textContent('#objTitle'), /Meet Iman/)
  assert.equal(await page.locator('#jbar button').count(), 5, 'five journey steps')
  step('game starts: location, objective and journey are on screen')

  // menu → jump to About → prompt → chapter
  await page.keyboard.press('Tab'); await page.waitForSelector('#menu:not([hidden]).is-on')
  assert.equal(await page.locator('#menuPanel [data-row]').count(), 12, 'twelve locations in the journal')
  await page.click('#menuPanel [data-act="jump"][data-id="about"]')
  await page.waitForFunction(() => /Meet Iman/i.test(document.getElementById('promptText').textContent) && document.getElementById('prompt').classList.contains('is-on'), null, { timeout: 15000 })
  assert.match(await page.textContent('#whereDistrict'), /Profile/)
  step('menu → jump to Profile: district label + contextual prompt appear')
  await page.keyboard.press('e'); await page.waitForSelector('#chapter.is-on', { timeout: 10000 })
  assert.match(await page.textContent('#chTitle'), /Iman Mohammadi/)
  assert.ok(await page.$('#chCard a[href="/Iman-Mohammadi-CV.pdf"]'), 'CV link in the profile chapter')
  await page.keyboard.press('Escape'); await page.waitForSelector('#chapter', { state: 'hidden' })
  await page.waitForFunction(() => /1 \/ 12/.test(document.getElementById('objCount').textContent))
  step('chapter opens on E, shows the profile, closes on Esc, discovery counted')

  // recruiter path: Hire me → contact chapter without driving
  await page.click('#hireBtn'); await page.waitForSelector('#chapter.is-on')
  assert.ok(await page.$('#chCard a[href^="mailto:"]') && await page.$('#chCard a[href="https://github.com/iman-mohamadi"]'), 'email + GitHub in the contact chapter')
  await page.keyboard.press('Escape'); await page.waitForSelector('#chapter', { state: 'hidden' })
  step('Hire me opens the contact chapter with email, GitHub and CV')

  // guided tour
  await page.keyboard.press('t'); await page.waitForFunction(() => document.getElementById('tourChip').classList.contains('is-on') && /Guided tour/.test(document.getElementById('tourChip').textContent), null, { timeout: 8000 })
  await page.keyboard.down('w'); await page.waitForFunction(() => !document.getElementById('tourChip').classList.contains('is-on'), null, { timeout: 5000 }); await page.keyboard.up('w')
  step('guided tour starts and any input cancels it')

  // optional games live in the menu
  await page.keyboard.press('Tab'); await page.waitForSelector('#menu.is-on'); await page.click('#menuPanel [data-tab="play"]')
  assert.ok((await page.locator('#menuPanel [data-play]').count()) >= 4)
  await page.click('#menuPanel [data-play="race"]')
  await page.waitForFunction(() => /Street Circuit|P\d\/4/.test(document.getElementById('tourChip').textContent), null, { timeout: 8000 })
  await page.keyboard.press('Tab'); await page.click('#menuPanel [data-tab="play"]'); await page.click('#menuPanel [data-play="delivery"]')
  await page.waitForFunction(() => /Pick up/.test(document.getElementById('tourChip').textContent), null, { timeout: 8000 })
  await page.keyboard.press('c'); await page.waitForSelector('#garage.is-on', { timeout: 5000 })
  assert.equal(await page.locator('#garageList li').count(), 8)
  await page.keyboard.press('Escape'); await page.waitForFunction(() => document.getElementById('garage').hidden, null, { timeout: 3000 })
  step('Play tab: race, delivery and garage all start from the menu')

  assert.deepEqual(errors, [], 'no page errors: ' + errors.join(' | '))
  step('no console/page errors')
  console.log('\nSmoke test passed.')
} catch (e) { failed = true; console.error('\nSmoke test FAILED:', e.message) }
await browser.close(); cleanup()
process.exit(failed ? 1 : 0)
