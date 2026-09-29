// End-to-end test for The Pipeline (pipeline.html): manual interaction, then the full auto-play run to the finale.
// Run `npm run build` first. Needs Chromium: CHROME_PATH=/path/to/chrome or `npx playwright-core install chromium`.
import { spawn } from 'node:child_process'
import assert from 'node:assert/strict'
import { chromium } from 'playwright-core'

const PORT = 4181, BASE = `http://localhost:${PORT}`
const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore' })
const cleanup = () => server.kill(); process.on('exit', cleanup)
const step = (n) => console.log('  ✓', n)
for (let i = 0; i < 60; i++) { try { if ((await fetch(BASE)).ok) break } catch (_) { /* wait */ } await new Promise((r) => setTimeout(r, 500)) }

const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })
let failed = false
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } })
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource|favicon/i.test(m.text())) errors.push(m.text()) })
  page.on('response', (r) => { if (r.url().startsWith(BASE) && r.status() >= 400) errors.push(`${r.status()} ${r.url()}`) })

  await page.goto(`${BASE}/pipeline.html`, { waitUntil: 'load' })
  await page.waitForFunction(() => document.querySelector('.start .btn.primary') && !document.querySelector('.start .btn.primary').disabled, null, { timeout: 120000 })
  step('factory builds, start button enabled')

  await page.click('.start .btn.primary')
  await page.waitForSelector('.panel h2', { timeout: 10000 })
  assert.match(await page.textContent('.panel h2'), /Design/)
  const h0 = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--h'))
  await page.$eval('.panel input[type=range]', (el) => { el.value = '190'; el.dispatchEvent(new Event('input', { bubbles: true })) })
  await page.waitForTimeout(400)
  const h1 = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--h'))
  assert.notEqual(h0.trim(), h1.trim()); assert.equal(h1.trim(), '190')
  step('design token slider re-themes the UI (--h 322 → 190)')

  await page.click('.panel .foot .btn.primary')
  await page.waitForFunction(() => /Build/.test(document.querySelector('.panel h2')?.textContent || ''), null, { timeout: 15000 })
  await page.click('.panel .btn.mono:not(.primary)')
  await page.waitForFunction(() => /Assemble/.test(document.querySelector('.panel')?.textContent || ''), null, { timeout: 5000 })
  assert.ok(await page.$('.panel table'))
  step('build station: cut list renders, flat-pack toggles')

  // restart and let the recruiter mode play the entire line
  await page.goto(`${BASE}/pipeline.html`, { waitUntil: 'load' })
  await page.waitForFunction(() => document.querySelector('.start .btn.primary') && !document.querySelector('.start .btn.primary').disabled, null, { timeout: 120000 })
  await page.click('.start .btn:nth-of-type(2)')
  await page.waitForSelector('.caption', { timeout: 20000 })
  step('auto-play starts with captions')
  await page.waitForSelector('.finale', { timeout: 420000 })
  const text = await page.textContent('.finale')
  assert.match(text, /Shipped in/); assert.match(text, /Hire me/); assert.match(text, /Deploy/)
  assert.ok(await page.$('.finale a[href^="mailto:"]')); assert.ok(await page.$('.finale a[href="/Iman-Mohammadi-CV.pdf"]'))
  step('auto-play completes all five stations → finale with Hire me + CV')

  assert.deepEqual(errors, [], 'no errors: ' + errors.join(' | ')); step('no console/page errors')
  console.log('\nPipeline test passed.')
} catch (e) { failed = true; console.error('\nPipeline test FAILED:', e.message) }
await browser.close(); cleanup(); process.exit(failed ? 1 : 0)
