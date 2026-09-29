/**
 * BrandLogo — the logo tile shown beside the brand name on the auth screens.
 *
 * The artwork itself is a file under `public/`, referenced by `BRAND.logoSrc`
 * in ./authContent.ts — that constant is the one place to change to swap the
 * logo. This component only owns the tile: size, radius, fill and inner
 * hairline, so every screen showing the mark can never drift apart.
 *
 * `tone` picks the tile fill for the surface underneath:
 *   'bare'    no tile at all — the artwork sits straight on the page, so its
 *             own silhouette reads instead of a box around it.
 *   'plate'   solid white — what a dark or coloured logo needs when it has to
 *             hold its own against a saturated background.
 *   'onDark'  translucent white — only for a white/light logo sitting on the
 *             purple panel, where a white plate would look heavy.
 * Borders and shadows are left to the caller's `className` so nothing here
 * has to be fought with a later utility class.
 *
 * Sizing has two modes. By default the artwork is a `size`-px square inside a
 * tile the caller sizes — right for small square marks. Pass `fill` and the
 * artwork instead takes the whole tile minus the caller's padding, so a wide
 * or tall logo (a wordmark, say) is never squeezed into a square.
 *
 * Accessibility: {BRAND.name} always appears as text elsewhere on the auth
 * screens (hero, brand band, footer link), so the mark is decorative and
 * carries no alt text of its own.
 */

import { BRAND } from './authContent'

type BrandLogoProps = {
  /** Tile classes — geometry, padding, ring, shadow: anything the caller needs. */
  className?: string
  /** Square artwork size in px. Ignored when `fill` is set. */
  size?: number
  /** Let the artwork fill the tile (minus the tile's own padding) at any aspect ratio. */
  fill?: boolean
  /** Tile fill, picked for the surface behind it. */
  tone?: 'bare' | 'plate' | 'onDark'
}

const TONE = {
  bare: 'bg-transparent',
  plate: 'bg-white',
  onDark: 'bg-white/15 ring-1 ring-inset ring-white/25',
} as const

export function BrandLogo({
  className = 'h-11 w-11 rounded-2xl',
  size = 24,
  fill = false,
  tone = 'plate',
}: BrandLogoProps) {
  return (
    <span className={`flex shrink-0 items-center justify-center ${TONE[tone]} ${className}`}>
      <img
        src={BRAND.logoSrc}
        alt=""
        aria-hidden
        /* Explicit dimensions so the tile never reflows while the file loads. */
        style={fill ? { width: '100%', height: '100%' } : { width: size, height: size }}
        className="object-contain"
      />
    </span>
  )
}
