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

  // classic version
  await page.goto(`${BASE}/classic.html`, { waitUntil: 'load' })
  assert.match(await page.textContent('h1'), /Iman/)
  step('classic version renders')

  // 3D world
  await page.goto(`${BASE}/?quality=high`, { waitUntil: 'load' })
  await page.waitForFunction(() => /Press Enter/.test(document.getElementById('startLabel')?.textContent || ''), null, { timeout: 120000 })
  step('world loads (fonts, scene, car model)')
  await page.keyboard.press('Enter')
  await page.waitForSelector('#hud.is-on', { timeout: 15000 })
  step('game starts, HUD visible')

  await page.keyboard.press('2'); await page.waitForFunction(() => /About/.test(document.getElementById('loc').textContent), null, { timeout: 15000 })
  assert.ok(await page.isVisible('#panel.is-on'))
  step('fast travel → About panel')

  await page.keyboard.press('6'); await page.waitForFunction(() => /Contact/.test(document.getElementById('loc').textContent), null, { timeout: 15000 })
  assert.ok(await page.$('#panel a[href="/Iman-Mohammadi-CV.pdf"]'))
  assert.ok(await page.$('#panel a[href^="mailto:"]'))
  step('Contact panel has Hire me + CV download')

  await page.keyboard.press('t'); await page.waitForFunction(() => document.getElementById('tourChip').classList.contains('is-on') && /Auto tour/.test(document.getElementById('tourChip').textContent), null, { timeout: 8000 })
  await page.keyboard.down('w'); await page.waitForFunction(() => !document.getElementById('tourChip').classList.contains('is-on'), null, { timeout: 5000 }); await page.keyboard.up('w')
  step('auto tour starts and any input cancels it')

  await page.keyboard.press('r'); await page.waitForFunction(() => /Time trial|→/.test(document.getElementById('tourChip').textContent), null, { timeout: 8000 })
  await page.keyboard.press('r')
  step('time trial starts and cancels')

  await page.click('#qualBtn'); assert.match(await page.textContent('#qualBtn'), /⚙/)
  step('quality selector')

  assert.deepEqual(errors, [], 'no page errors: ' + errors.join(' | '))
  step('no console/page errors')
  console.log('\nSmoke test passed.')
} catch (e) { failed = true; console.error('\nSmoke test FAILED:', e.message) }
await browser.close(); cleanup()
process.exit(failed ? 1 : 0)
