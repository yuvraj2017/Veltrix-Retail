/**
 * Copy and sample figures shared by the auth screens.
 *
 * The hero panel is hidden below `lg`, so the form column re-surfaces a subset
 * of this (the brand line, the trust numbers) in its own compact layout. Both
 * read from here so the two never drift apart.
 */

import { Boxes, CreditCard, TrendingUp, type LucideIcon } from 'lucide-react'

/* ══ YOUR LOGO FILE ═══════════════════════════════════════════════════════
   Imported rather than written as a plain path string, because anything under
   src/ has to go through the bundler to get a real URL. Swap the filename
   here and Vite handles the rest — see BRAND.logoSrc below for the details
   and for the public/ alternative. */
import logoUrl from '../../assets/purple_logo_main.png'

export const BRAND = {
  name: 'Purple Retail',
  tagline: 'Next-gen retail management',

  /**
   * ══ LOGO PLACEHOLDER — set your PNG / SVG file path here ═════════════
   *
   * This one line is the only thing you need to change. It feeds
   * <BrandLogo />, which draws the mark everywhere the login screen shows
   * it — the big plate above the sign-in card and the small tile on the
   * purple hero panel — so they can never drift apart.
   *
   * There are two ways to point this at a file, and mixing them up is the
   * one easy mistake here:
   *
   *   A. src/assets  — IMPORT it. Add a line like the `logoUrl` import at
   *      the top of this file, then assign it below. Vite turns it into a
   *      hashed URL, and a wrong filename fails the BUILD instead of
   *      silently rendering a broken-image icon. This is what we do.
   *
   *   B. public/     — a root-relative STRING. Drop the file in
   *      `frontend/public/` and write `logoSrc: '/acme.png'`; everything
   *      under public/ is served straight from the site root.
   *
   * What does NOT work is a bare source path such as
   * 'frontend/src/assets/acme.png' or 'src/assets/acme.png'. The browser
   * resolves that against the page URL and 404s — src/ is a build input,
   * not a served directory. Use A for src/assets, B for public/.
   *
   * PNG, SVG, JPG and WebP are all fine. Both tiles are WHITE, so a dark or
   * coloured mark reads best; a transparent background looks cleanest. Any
   * aspect ratio works — the artwork is fitted, not cropped or squashed —
   * so a wide wordmark is fine.
   */
  // ▼▼▼ PLACEHOLDER — point this at your own logo (see A / B above) ▼▼▼
  logoSrc: logoUrl,
} as const

export type Feature = { label: string; Icon: LucideIcon }

export const FEATURES: Feature[] = [
  { label: 'Fast billing', Icon: CreditCard },
  { label: 'Live inventory', Icon: Boxes },
  { label: 'Sales insight', Icon: TrendingUp },
]

export type Kpi = {
  label: string
  value: string
  delta: string
  tone: string
  srLabel: string
}

export const KPIS: Kpi[] = [
  {
    label: 'Today',
    value: '₹24,580',
    delta: '+12.4%',
    tone: 'text-emerald-300',
    srLabel: 'Sales today 24,580 rupees, up 12.4 percent',
  },
  {
    label: 'Orders',
    value: '148',
    delta: 'Live',
    tone: 'text-indigo-200',
    srLabel: '148 orders today, updating live',
  },
  {
    label: 'Low stock',
    value: '06',
    delta: 'Review',
    tone: 'text-amber-300',
    srLabel: '6 products low on stock, needs review',
  },
]

/** Height as a % of the tallest day. `peak` drives the accent treatment. */
export type WeekPoint = { pct: number; day: string; peak?: boolean }

export const WEEK: WeekPoint[] = [
  { pct: 44, day: 'M' },
  { pct: 66, day: 'T' },
  { pct: 55, day: 'W' },
  { pct: 79, day: 'T' },
  { pct: 71, day: 'F' },
  { pct: 94, day: 'S', peak: true },
  { pct: 88, day: 'S' },
]

export const WEEK_SUMMARY = {
  srLabel:
    'Weekly sales trend: Monday 44%, Tuesday 66%, Wednesday 55%, Thursday 79%, Friday 71%, Saturday 94%, Sunday 88% of peak.',
  peakLabel: 'Peak Sat',
  peakValue: '₹8,420',
  delta: '+18%',
  deltaLabel: 'vs last week',
}

export type TrustStat = { value: string; label: string; short: string }

export const TRUST: TrustStat[] = [
  { value: '10k+', label: 'Retail actions processed', short: 'Actions processed' },
  { value: '99.9%', label: 'Operational uptime', short: 'Uptime' },
  { value: '24/7', label: 'Access to store data', short: 'Data access' },
]
