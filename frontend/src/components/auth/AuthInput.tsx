import type { InputHTMLAttributes } from 'react'
import type { FieldError } from 'react-hook-form'

type Props = InputHTMLAttributes<HTMLInputElement> & {
  label: string
  error?: FieldError
}

export function AuthInput({ label, error, ...props }: Props) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-slate-700">{label}</label>
      <input
        {...props}
        className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
      />
      {error && <p className="text-xs text-red-500">{error.message}</p>}
    </div>
  )
}