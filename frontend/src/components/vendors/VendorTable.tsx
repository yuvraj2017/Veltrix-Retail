import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  ChevronDown,
  Mail,
  MapPin,
  PackageCheck,
  Phone,
  Search,
  Store,
  Truck,
  UsersRound,
  XCircle,
} from 'lucide-react'
import type { Vendor } from '../../features/vendors/types'

type VendorTableProps = {
  vendors: Vendor[]
  totalVendors: number
  isLoading: boolean
  search: string
  onSearchChange: (value: string) => void
  statusFilter: 'all' | 'active' | 'inactive'
  onStatusFilterChange: (value: 'all' | 'active' | 'inactive') => void
  onVendorClick: (vendorId: number) => void
  onAddVendor: () => void
}

const getVendorIcon = (index: number) => {
  const icons = [Building2, PackageCheck, Truck, Store]
  return icons[index % icons.length]
}

const formatLocation = (vendor: Vendor) => {
  const parts = [vendor.city, vendor.state].filter(Boolean)
  return parts.length ? parts.join(', ') : 'Not added'
}

const getPrimaryName = (vendor: Vendor) => {
  return vendor.company_name || vendor.vendor_name || 'Unnamed Vendor'
}

const getSecondaryName = (vendor: Vendor) => {
  if (vendor.company_name && vendor.vendor_name) return vendor.vendor_name
  if (vendor.payment_terms) return vendor.payment_terms
  return 'Supply Partner'
}

function VendorFilterDropdown({
  value,
  onChange,
}: {
  value: 'all' | 'active' | 'inactive'
  onChange: (value: 'all' | 'active' | 'inactive') => void
}) {
  const [open, setOpen] = useState(false)
  const wrapperRef = useRef<HTMLDivElement | null>(null)

  const options = [
    {
      label: 'All Vendors',
      value: 'all' as const,
      icon: UsersRound,
      helper: 'Show every partner',
    },
    {
      label: 'Active Only',
      value: 'active' as const,
      icon: CheckCircle2,
      helper: 'Currently enabled',
    },
    {
      label: 'Inactive Only',
      value: 'inactive' as const,
      icon: XCircle,
      helper: 'Paused vendors',
    },
  ]

  const selected = options.find((option) => option.value === value) || options[0]

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!wrapperRef.current?.contains(event.target as Node)) {
        setOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div ref={wrapperRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className={`group flex h-14 min-w-[210px] items-center justify-between gap-4 rounded-[22px] border px-5 text-[15px] font-semibold outline-none transition-all duration-300 ${
          open
            ? 'border-indigo-300 bg-white shadow-[0_18px_42px_rgba(79,70,229,0.14)]'
            : 'border-indigo-100/80 bg-slate-50/90 shadow-[0_10px_28px_rgba(15,23,42,0.04)] hover:-translate-y-[1px] hover:bg-white hover:shadow-[0_16px_38px_rgba(79,70,229,0.10)]'
        }`}
      >
        <span className="flex items-center gap-3 text-slate-700">
          <selected.icon
            size={18}
            className={value === 'inactive' ? 'text-rose-500' : 'text-indigo-600'}
          />
          {selected.label}
        </span>

        <ChevronDown
          size={18}
          className={`text-slate-500 transition-transform duration-300 ${
            open ? 'rotate-180 text-indigo-600' : ''
          }`}
        />
      </button>

      {open && (
        <motion.div
          initial={{ opacity: 0, y: 8, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.16, ease: 'easeOut' }}
          className="absolute right-0 z-30 mt-3 w-[260px] overflow-hidden rounded-[24px] border border-white/70 bg-white/92 p-2 shadow-[0_24px_70px_rgba(15,23,42,0.14)] backdrop-blur-xl"
        >
          {options.map((option) => {
            const Icon = option.icon
            const active = value === option.value

            return (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  onChange(option.value)
                  setOpen(false)
                }}
                className={`flex w-full items-center gap-3 rounded-[18px] px-3 py-3 text-left transition-all duration-200 ${
                  active
                    ? 'bg-gradient-to-r from-indigo-50 to-violet-50 text-indigo-700'
                    : 'text-slate-700 hover:bg-slate-50'
                }`}
              >
                <div
                  className={`flex h-10 w-10 items-center justify-center rounded-2xl ${
                    active
                      ? 'bg-gradient-to-br from-indigo-500 to-violet-600 text-white'
                      : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  <Icon size={18} />
                </div>

                <div>
                  <p className="text-sm font-black">{option.label}</p>
                  <p className="mt-0.5 text-xs text-slate-500">{option.helper}</p>
                </div>
              </button>
            )
          })}
        </motion.div>
      )}
    </div>
  )
}

export default function VendorTable({
  vendors,
  totalVendors,
  isLoading,
  search,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  onVendorClick,
  onAddVendor,
}: VendorTableProps) {
  return (
    <section className="overflow-hidden rounded-[34px] bg-white shadow-[0_24px_70px_rgba(15,23,42,0.06)]">
      {/* Header Controls - stays responsive, wraps on mobile */}
      <div className="flex flex-col gap-4 px-6 pb-7 pt-7 xl:flex-row xl:items-center xl:justify-between">
        <div className="relative w-full xl:max-w-[460px]">
          <Search
            size={19}
            className="pointer-events-none absolute left-5 top-1/2 -translate-y-1/2 text-slate-400"
          />

          <input
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Search by vendor name, email, phone..."
            className="h-14 w-full rounded-[22px] border border-indigo-100/70 bg-slate-50/90 pl-14 pr-5 text-[15px] font-medium text-slate-700 outline-none transition-all duration-300 placeholder:text-slate-400 focus:-translate-y-[1px] focus:border-indigo-300 focus:bg-white focus:shadow-[0_0_0_5px_rgba(99,102,241,0.12)]"
          />
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <VendorFilterDropdown
            value={statusFilter}
            onChange={onStatusFilterChange}
          />

          <motion.button
            whileTap={{ scale: 0.98 }}
            whileHover={{ y: -2 }}
            onClick={onAddVendor}
            className="group inline-flex h-14 items-center justify-center gap-3 rounded-[22px] bg-gradient-to-r from-[#7c6cff] via-[#5b43f3] to-[#3b2be4] px-6 text-sm font-black text-white shadow-[0_18px_42px_rgba(79,70,229,0.30)] transition-all duration-300 hover:shadow-[0_24px_54px_rgba(79,70,229,0.38)]"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/16 transition-transform duration-300 group-hover:rotate-90">
              +
            </span>
            Add Vendor
          </motion.button>
        </div>
      </div>

      {/* Horizontal Scroll Container - preserves desktop layout on all screen sizes */}
      <div className="overflow-x-auto scrollbar-thin scrollbar-track-transparent scrollbar-thumb-slate-200 hover:scrollbar-thumb-slate-300">
        <div className="min-w-[1100px]">
          {/* Table Header - Desktop style preserved */}
          <div className="grid grid-cols-[1.35fr_0.95fr_0.8fr_1.25fr_1fr_0.7fr_0.3fr] px-8 py-5 text-[12px] font-black uppercase tracking-[0.2em] text-slate-500">
            <div>Vendor Details</div>
            <div>Contact Person</div>
            <div>Phone</div>
            <div>Email</div>
            <div>Location</div>
            <div>Status</div>
            <div className="text-right">Action</div>
          </div>

          {isLoading ? (
            <div className="space-y-4 px-6 pb-8">
              {[1, 2, 3, 4, 5].map((item) => (
                <div
                  key={item}
                  className="h-[96px] animate-pulse rounded-[26px] bg-slate-50"
                />
              ))}
            </div>
          ) : vendors.length === 0 ? (
            <div className="flex flex-col items-center justify-center px-6 py-20 text-center">
              <div className="mb-5 flex h-20 w-20 items-center justify-center rounded-[28px] bg-gradient-to-br from-indigo-50 to-violet-50 text-indigo-600 shadow-[inset_0_0_0_1px_rgba(99,102,241,0.08)]">
                <Store size={34} />
              </div>

              <h3 className="text-2xl font-black tracking-[-0.03em] text-slate-950">
                No vendors found
              </h3>

              <p className="mt-3 max-w-md text-sm leading-6 text-slate-500">
                Create your first vendor partner or adjust your search/filter to see
                matching supply partners.
              </p>

              <button
                onClick={onAddVendor}
                className="mt-7 rounded-[20px] bg-gradient-to-r from-[#7c6cff] via-[#5b43f3] to-[#3b2be4] px-6 py-3 text-sm font-black text-white shadow-[0_18px_42px_rgba(79,70,229,0.26)] transition hover:-translate-y-[1px]"
              >
                Add Vendor
              </button>
            </div>
          ) : (
            <div className="px-4 pb-4">
              {vendors.map((vendor, index) => {
                const Icon = getVendorIcon(index)

                return (
                  <motion.button
                    key={vendor.id}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.035, duration: 0.32 }}
                    onClick={() => onVendorClick(vendor.id)}
                    className="group grid w-full grid-cols-[1.35fr_0.95fr_0.8fr_1.25fr_1fr_0.7fr_0.3fr] items-center gap-4 rounded-[26px] px-4 py-5 text-left transition-all duration-300 hover:-translate-y-[1px] hover:bg-slate-50 hover:shadow-[0_18px_42px_rgba(15,23,42,0.05)] lg:px-5"
                  >
                    <div className="flex items-center gap-4">
                      <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-[22px] bg-gradient-to-br from-indigo-50 to-violet-50 text-indigo-600 shadow-[inset_0_0_0_1px_rgba(99,102,241,0.08)] transition duration-300 group-hover:scale-105 group-hover:bg-gradient-to-br group-hover:from-indigo-500 group-hover:to-violet-600 group-hover:text-white">
                        <Icon size={26} />
                      </div>

                      <div className="min-w-0">
                        <h4 className="truncate text-lg font-black tracking-[-0.02em] text-slate-950">
                          {getPrimaryName(vendor)}
                        </h4>
                        <p className="mt-1 truncate text-sm font-medium text-slate-500">
                          {getSecondaryName(vendor)}
                        </p>
                      </div>
                    </div>

                    <div className="text-[15px] font-medium text-slate-700">
                      {vendor.vendor_name || 'Not added'}
                    </div>

                    <div className="inline-flex items-center gap-2 text-[15px] font-medium text-slate-600">
                      <Phone size={15} className="text-slate-400" />
                      {vendor.phone || '—'}
                    </div>

                    <div className="flex min-w-0 items-center gap-2 text-[15px] font-medium text-slate-600">
                      <Mail size={16} className="shrink-0 text-slate-400" />
                      <span className="truncate">{vendor.email || 'No email'}</span>
                    </div>

                    <div>
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-black text-slate-600">
                        <MapPin size={13} />
                        {formatLocation(vendor)}
                      </span>
                    </div>

                    <div>
                      <span
                        className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-black ${
                          vendor.is_active
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'bg-rose-50 text-rose-700'
                        }`}
                      >
                        <span
                          className={`h-2 w-2 rounded-full ${
                            vendor.is_active ? 'bg-emerald-500' : 'bg-rose-500'
                          }`}
                        />
                        {vendor.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </div>

                    <div className="flex justify-end">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-50 text-slate-500 transition duration-300 group-hover:bg-indigo-600 group-hover:text-white">
                        <ArrowRight size={19} />
                      </div>
                    </div>
                  </motion.button>
                )
              })}
            </div>
          )}

          {!isLoading && vendors.length > 0 && (
            <div className="flex flex-col gap-4 px-8 py-6 text-[14px] text-slate-600 sm:flex-row sm:items-center sm:justify-between">
              <div>
                Showing{' '}
                <span className="font-black text-slate-950">
                  1-{vendors.length}
                </span>{' '}
                of <span className="font-black text-slate-950">{totalVendors}</span>{' '}
                vendors
              </div>

              <div className="flex items-center gap-2">
                <button className="rounded-xl px-4 py-2 font-semibold transition hover:bg-slate-100">
                  Previous
                </button>
                <button className="rounded-xl px-4 py-2 font-semibold transition hover:bg-slate-100">
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}