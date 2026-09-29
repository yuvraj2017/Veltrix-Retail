/**
 * Shared styling for the auth forms — login, register and password recovery.
 *
 * These three screens were drifting: three field shells, three button
 * treatments, three label sizes. Everything visual they have in common lives
 * here now, so a change lands on all of them at once and none can quietly
 * fall behind again.
 *
 * Only *classes* live here, not markup. The screens differ enough in
 * structure (one field vs eleven, a dropdown, a file drop) that a shared
 * component would need a prop for every difference; strings compose without
 * that cost.
 *
 * A caution on overriding: two Tailwind utilities for the same property have
 * equal specificity, so the winner is decided by the order Tailwind emits
 * them, NOT by the order you list them. Don't pass `py-2` in `extra` hoping to
 * beat the density — use the `density` option instead.
 */

/* ------------------------------------------------------------------ *
 * Fields
 *
 * The shell rests as a soft tinted well and turns white on focus. That gives
 * focus somewhere to travel to beyond a ring: the active field lifts out of
 * the card while the idle ones recede, so the eye lands on it without every
 * field needing a heavy border.
 *
 * The error variant swaps colours only — the geometry is identical, so a
 * validation message never shifts the layout.
 * ------------------------------------------------------------------ */

const FIELD_SHELL =
  'peer w-full rounded-2xl border text-slate-900 outline-none transition duration-200 placeholder:text-slate-400'

const FIELD_STATE = {
  rest: 'border-slate-200/90 bg-slate-50/70 hover:border-slate-300 focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-500/10',
  error:
    'border-red-200 bg-red-50/50 focus:border-red-400 focus:bg-white focus:ring-4 focus:ring-red-500/10',
  /**
   * The focused look, applied unconditionally. For a control that is not an
   * input and so never matches `:focus` while it is open — the category
   * dropdown is a <button>. Passing `active` instead of layering an override
   * matters: two utilities for one property are decided by Tailwind's output
   * order, not by which you list last.
   */
  active: 'border-indigo-500 bg-white ring-4 ring-indigo-500/10',
} as const

/**
 * `comfortable` (~52px) suits a short form where the fields are the whole
 * page. `compact` (~46px) keeps the eleven-field register form from running
 * off the screen. Both clear the 44px touch target.
 */
const FIELD_DENSITY = {
  comfortable: 'py-3.5 text-[15px]',
  compact: 'py-3 text-sm',
} as const

export type FieldOptions = {
  error?: boolean
  /** Paint the focused look regardless of `:focus` — see FIELD_STATE.active. */
  active?: boolean
  density?: keyof typeof FIELD_DENSITY
  /** Left padding, sized for the leading icon. Use `pl-4` for a field without one. */
  lead?: string
  /** Right padding etc. Never put padding-y or font-size here — see the header note. */
  extra?: string
}

export function fieldClass({
  error = false,
  active = false,
  density = 'comfortable',
  lead = 'pl-11',
  extra = '',
}: FieldOptions = {}): string {
  const state = active ? FIELD_STATE.active : error ? FIELD_STATE.error : FIELD_STATE.rest

  return [FIELD_SHELL, FIELD_DENSITY[density], lead, state, extra].filter(Boolean).join(' ')
}

/**
 * Leading icon, tinted by the field's focus state.
 *
 * `peer-focus:` compiles to a sibling selector, so the icon has to be a
 * sibling that comes AFTER the input in the markup — even though it paints on
 * the left. Put the icon second and let absolute positioning place it.
 */
export const ICON_CLASS =
  'pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 transition-colors duration-200 peer-focus:text-indigo-500'

/** Same as ICON_CLASS but pinned near the top, for a textarea. */
export const ICON_CLASS_TOP =
  'pointer-events-none absolute left-3.5 top-[15px] text-slate-400 transition-colors duration-200 peer-focus:text-indigo-500'

export const LABEL_CLASS = 'text-[13px] font-semibold text-slate-700'

export const LINK_CLASS =
  'rounded font-semibold text-indigo-600 transition hover:text-indigo-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500'

/** Inline validation message. Pair with an <AlertCircle size={13} />. */
export const ERROR_TEXT =
  'mt-1.5 flex items-center gap-1.5 text-xs font-medium text-red-600'

/** Server-side failure, announced via role="alert" at the call site. */
export const ALERT_CLASS =
  'flex items-start gap-2.5 rounded-2xl border border-red-200 bg-red-50 px-3.5 py-3 text-[13px] font-medium text-red-700 sm:text-sm'

/* ------------------------------------------------------------------ *
 * Surfaces
 * ------------------------------------------------------------------ */

export const CARD_CLASS =
  'relative overflow-hidden rounded-3xl border border-slate-200/80 bg-white p-6 shadow-[0_24px_60px_-32px_rgba(15,23,42,0.35)] sm:p-8'

/** Gradient hairline across the top edge of a card. Needs a `relative` parent. */
export const CARD_ACCENT =
  'absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-indigo-500 via-violet-500 to-fuchsia-400'

/** A rule that fades out at both ends, so it stops short of the card edges. */
export const FADE_RULE = 'h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent'

/* ------------------------------------------------------------------ *
 * Actions
 * ------------------------------------------------------------------ */

/**
 * The one primary action per screen. Pair with a `group`-scoped sheen span as
 * the first child — see any of the auth pages.
 */
export const PRIMARY_BUTTON =
  'group relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-2xl bg-gradient-to-r from-indigo-600 via-violet-600 to-indigo-700 px-5 py-4 text-[15px] font-semibold text-white shadow-[0_14px_32px_-10px_rgba(79,70,229,0.65)] transition duration-200 hover:shadow-[0_18px_40px_-10px_rgba(79,70,229,0.75)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 active:scale-[0.995] disabled:cursor-not-allowed disabled:opacity-70 disabled:shadow-none'

/** Sheen that sweeps across PRIMARY_BUTTON on hover. Transform only, no repaint. */
export const PRIMARY_SHEEN =
  'absolute inset-y-0 -left-1/3 w-1/3 -skew-x-12 bg-white/20 opacity-0 transition-all duration-700 group-hover:left-[110%] group-hover:opacity-100'

/** Quieter sibling of PRIMARY_BUTTON, for a second choice on the same screen. */
export const SECONDARY_BUTTON =
  'flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-4 text-[15px] font-semibold text-slate-700 shadow-sm transition duration-200 hover:border-slate-300 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500'

/* ------------------------------------------------------------------ *
 * Checkbox
 *
 * The real <input> stays for keyboard and assistive tech, hidden with
 * `sr-only peer`; this styles the box that paints in its place. The tick
 * inherits `currentColor`, transparent until checked — colour inheritance is
 * what makes it work, because `peer-*` reaches siblings but never descendants.
 * ------------------------------------------------------------------ */

export const CHECKBOX_BOX =
  'flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[6px] border border-slate-300 bg-white text-transparent shadow-sm transition duration-150 peer-checked:border-indigo-600 peer-checked:bg-indigo-600 peer-checked:text-white peer-focus-visible:ring-2 peer-focus-visible:ring-indigo-500/40 peer-focus-visible:ring-offset-2'
