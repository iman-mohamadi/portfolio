// Privacy-friendly, cookieless analytics (Vercel Web Analytics). Off in dev, on localhost, when the visitor sends Do-Not-Track,
// or when built with VITE_ANALYTICS=off.
import { inject, track as vTrack } from '@vercel/analytics'

const dnt = navigator.doNotTrack === '1' || window.doNotTrack === '1'
const local = /^(localhost|127\.|\[::1\]|0\.0\.0\.0)/.test(location.hostname)
export const analyticsOn = import.meta.env.PROD && !dnt && !local && import.meta.env.VITE_ANALYTICS !== 'off'
export function initAnalytics() { if (analyticsOn) inject({ mode: 'production' }) }
export function track(name, props) { if (analyticsOn) { try { vTrack(name, props) } catch (_) { /* never break the app */ } } }
