import { Store } from 'lucide-react'
import { APP_NAME } from '../../lib/constants'

export function BrandLogo() {
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-sm">
        <Store size={20} />
      </div>
      <div>
        <p className="text-sm font-semibold text-slate-900">{APP_NAME}</p>
        <p className="text-xs text-slate-500">Retail management suite</p>
      </div>
    </div>
  )
}