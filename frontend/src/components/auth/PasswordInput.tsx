/**
 * PasswordInput — a labelled password field with a show/hide toggle.
 *
 * Used by the register form, which is why it defaults to the `compact`
 * density; pass `density="comfortable"` on a short form.
 *
 * The label is bound with a real htmlFor/id pair. An `id` can be passed in;
 * otherwise one is derived from the label, because two of these sit side by
 * side (Password and Confirm Password) and an unbound label would leave both
 * unreachable by clicking and ambiguous to a screen reader.
 */

import { AlertCircle, Eye, EyeOff, LockKeyhole } from 'lucide-react'
import { useId, useState, type InputHTMLAttributes } from 'react'
import type { FieldError } from 'react-hook-form'

import { ERROR_TEXT, fieldClass, ICON_CLASS, LABEL_CLASS, type FieldOptions } from './formStyles'

type Props = InputHTMLAttributes<HTMLInputElement> & {
  label: string
  error?: FieldError
  density?: FieldOptions['density']
}

export function PasswordInput({ label, error, density = 'compact', id, ...props }: Props) {
  const [show, setShow] = useState(false)
  /** Stable across renders, and unique even with two of these on one form. */
  const fallbackId = useId()
  const inputId = id ?? fallbackId
  const errorId = `${inputId}-error`

  return (
    <div>
      <label htmlFor={inputId} className={`mb-1.5 block ${LABEL_CLASS}`}>
        {label}
      </label>

      <div className="relative">
        <input
          {...props}
          id={inputId}
          type={show ? 'text' : 'password'}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorId : undefined}
          className={fieldClass({ error: Boolean(error), density, extra: 'pr-11' })}
        />

        {/* Both siblings come after the input so `peer-focus:` can reach them —
            it compiles to a sibling selector and cannot look backwards. */}
        <LockKeyhole size={16} className={ICON_CLASS} aria-hidden />

        <button
          type="button"
          onClick={() => setShow((prev) => !prev)}
          aria-label={show ? 'Hide password' : 'Show password'}
          aria-pressed={show}
          className="absolute right-1.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
        >
          {show ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>

      {error?.message && (
        <p id={errorId} className={ERROR_TEXT}>
          <AlertCircle size={13} className="shrink-0" aria-hidden />
          {error.message}
        </p>
      )}
    </div>
  )
}
