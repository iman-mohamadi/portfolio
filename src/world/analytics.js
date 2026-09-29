// Privacy-friendly, cookieless analytics (Vercel Web Analytics). Off in dev and when the visitor sends Do-Not-Track.
import { inject, track as vTrack } from '@vercel/analytics'

const dnt = navigator.doNotTrack === '1' || window.doNotTrack === '1'
export const analyticsOn = import.meta.env.PROD && !dnt
export function initAnalytics() { if (analyticsOn) inject({ mode: 'production' }) }
export function track(name, props) { if (analyticsOn) { try { vTrack(name, props) } catch (_) { /* never break the app */ } } }
