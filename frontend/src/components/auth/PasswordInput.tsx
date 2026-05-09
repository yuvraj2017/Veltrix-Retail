import { Eye, EyeOff } from 'lucide-react'
import { useState, type InputHTMLAttributes } from 'react'
import type { FieldError } from 'react-hook-form'

type Props = InputHTMLAttributes<HTMLInputElement> & {
  label: string
  error?: FieldError
}

export function PasswordInput({ label, error, ...props }: Props) {
  const [show, setShow] = useState(false)

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-slate-700">{label}</label>
      <div className="relative">
        <input
          {...props}
          type={show ? 'text' : 'password'}
          className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 pr-12 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
        />
        <button
          type="button"
          onClick={() => setShow((prev) => !prev)}
          className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-slate-500"
        >
          {show ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </div>
      {error && <p className="text-xs text-red-500">{error.message}</p>}
    </div>
  )
}