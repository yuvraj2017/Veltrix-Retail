import { useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { AlertCircle, ArrowUpRight, Building2 } from 'lucide-react'

import VendorStats from '../components/vendors/VendorStats'
import VendorTable from '../components/vendors/VendorTable'
import { vendorsApi } from '../features/vendors/api'
import { useBranch } from '../context/BranchContext'
import { branchQueryKey, branchQueryPrefix } from '../lib/branch-query-keys'
import type { Vendor, VendorStatsResponse } from '../features/vendors/types'

const emptyVendorStats: VendorStatsResponse = {
  total_vendors: 0,
  active_vendors: 0,
  inactive_vendors: 0,
  total_bills: 0,
  total_bill_amount: 0,
  total_paid_amount: 0,
  total_remaining_amount: 0,
  pending_bills: 0,
  partial_bills: 0,
  overdue_bills: 0,
  completed_bills: 0,
  due_soon_bills: 0,
}

const VENDORS_STALE_MS = 2 * 60 * 1000

export default function VendorsPage() {
  const { selectedBranchId } = useBranch()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const vendorsQuery = useQuery({
    queryKey: branchQueryKey(selectedBranchId, 'vendors', 'list'),
    queryFn: vendorsApi.getVendors,
    staleTime: VENDORS_STALE_MS,
  })

  const statsQuery = useQuery({
    queryKey: branchQueryKey(selectedBranchId, 'vendors', 'stats'),
    queryFn: vendorsApi.getVendorStats,
    staleTime: VENDORS_STALE_MS,
  })

  const vendors: Vendor[] = vendorsQuery.data ?? []
  // Stats are decorative here, so a failure falls back to zeros rather than
  // blocking the page -- matching the previous behaviour.
  const stats: VendorStatsResponse = statsQuery.data ?? emptyVendorStats
  const isLoading = vendorsQuery.isPending
  const isStatsLoading = statsQuery.isPending
  const errorMessage = vendorsQuery.error
    ? vendorsQuery.error instanceof Error
      ? vendorsQuery.error.message
      : 'Unable to load vendors'
    : ''

  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all')

  const filteredVendors = useMemo(() => {
    const query = searchTerm.trim().toLowerCase()
    return vendors.filter((vendor) => {
      const matchesSearch =
        !query ||
        [
          vendor.vendor_name,
          vendor.company_name,
          vendor.email,
          vendor.phone,
          vendor.alternate_phone,
          vendor.city,
          vendor.state,
          vendor.country,
          vendor.payment_terms,
          vendor.tax_number,
          vendor.address_line_1,
          vendor.address_line_2,
          vendor.postal_code,
          vendor.notes,
        ]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(query))

      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'active' && vendor.is_active) ||
        (statusFilter === 'inactive' && !vendor.is_active)

      return matchesSearch && matchesStatus
    })
  }, [vendors, searchTerm, statusFilter])

  // Invalidating the 'vendors' key refetches both the list and the stats.
  const refreshVendorsPage = async () => {
    await queryClient.invalidateQueries({ queryKey: branchQueryPrefix(selectedBranchId, 'vendors') })
  }

  return (
    <div className="mx-auto max-w-[1600px]">
      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: 'easeOut' }}
      >
        <div className="mb-8 flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-indigo-100 bg-white/70 px-4 py-2 text-[11px] font-black uppercase tracking-[0.22em] text-indigo-600 shadow-[0_12px_30px_rgba(99,102,241,0.08)] backdrop-blur-xl dark:border-indigo-900 dark:bg-slate-800/70 dark:text-indigo-400">
              <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-indigo-500" />
              Supply Chain Partners
            </div>

            <h1 className="text-[42px] font-black tracking-[-0.04em] text-slate-950 dark:text-slate-100 md:text-[56px]">
              Vendor Directory
            </h1>

            <p className="mt-3 max-w-2xl text-[18px] leading-8 text-slate-600 dark:text-slate-400">
              Manage supply partners, payable records, purchase bills, and vendor relationships
              from one calm operational workspace.
            </p>
          </div>
        </div>

        {errorMessage && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 flex items-start gap-3 rounded-[24px] border border-red-100 bg-red-50/80 p-5 text-red-700 shadow-[0_16px_36px_rgba(220,38,38,0.08)] dark:border-red-900 dark:bg-red-950/50 dark:text-red-400"
          >
            <AlertCircle className="mt-0.5 shrink-0" size={20} />
            <div>
              <p className="font-black">Unable to load vendors</p>
              <p className="mt-1 text-sm leading-6">{errorMessage}</p>
              <button
                type="button"
                onClick={() => void refreshVendorsPage()}
                className="mt-3 rounded-xl bg-red-600 px-4 py-2 text-sm font-black text-white transition hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-600"
              >
                Try Again
              </button>
            </div>
          </motion.div>
        )}

        <VendorStats
          activeVendors={isStatsLoading ? 0 : Number(stats.active_vendors || 0)}
          totalBillsAmount={isStatsLoading ? 0 : Number(stats.total_bill_amount || 0)}
          pendingBills={isStatsLoading ? 0 : Number(stats.pending_bills || 0)}
        />

        <div className="mt-8">
          <VendorTable
            vendors={filteredVendors.slice(0, 8)}
            totalVendors={filteredVendors.length}
            isLoading={isLoading}
            search={searchTerm}
            onSearchChange={setSearchTerm}
            statusFilter={statusFilter}
            onStatusFilterChange={setStatusFilter}
            onVendorClick={(vendorId) => navigate(`/vendors/${vendorId}`)}
            onAddVendor={() => navigate('/vendors/new')}
          />
        </div>

        <motion.section
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.2 }}
          className="relative mt-8 overflow-hidden rounded-[34px] bg-gradient-to-br from-[#1a087a] via-[#2910a8] to-[#4f46e5] px-8 py-9 text-white shadow-[0_30px_80px_rgba(49,46,129,0.28)] md:px-10"
        >
          <div className="relative z-10 grid gap-8 lg:grid-cols-[1fr_330px] lg:items-center">
            <div>
              <div className="mb-4 inline-flex rounded-full bg-white/8 px-4 py-2 text-[11px] font-black uppercase tracking-[0.22em] text-white/80">
                Payables Automation
              </div>
              <h2 className="text-[28px] font-black tracking-[-0.04em] md:text-[36px]">
                Automate your vendor bills.
              </h2>
              <p className="mt-3 max-w-2xl text-[16px] leading-8 text-white/75">
                Connect vendor profiles with purchase bills, due reminders, and payment tracking to
                reduce manual follow-ups.
              </p>
            </div>

            <button
              type="button"
              onClick={() => navigate('/vendors/new')}
              className="group inline-flex h-14 items-center justify-center gap-3 rounded-[20px] bg-white px-6 text-sm font-black text-indigo-700 shadow-[0_18px_40px_rgba(255,255,255,0.12)] transition-all duration-300 hover:-translate-y-[1px]"
            >
              Get Started
              <ArrowUpRight
                size={18}
                className="transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
              />
            </button>
          </div>

          <motion.div
            animate={{ y: [0, -12, 0], rotate: [0, 5, 0] }}
            transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
            className="absolute right-16 top-1/2 h-44 w-44 -translate-y-1/2 rounded-full bg-white/18"
          />
          <div className="absolute -right-20 -top-24 h-72 w-72 rounded-full bg-violet-300/20 blur-3xl" />
          <div className="absolute -bottom-24 left-20 h-72 w-72 rounded-full bg-indigo-300/20 blur-3xl" />
          <Building2 size={160} className="absolute bottom-4 right-10 text-white/5" />
        </motion.section>
      </motion.div>
    </div>
  )
}
