import { useEffect, useMemo, useState } from 'react'
import type { ElementType } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  ArrowLeft,
  Building2,
  CreditCard,
  Edit3,
  Mail,
  Phone,
  Plus,
  Sparkles,
  Truck,
} from 'lucide-react'

import { AppShell } from '../components/layout/AppShell'
import AddPaymentModal from '../components/vendors/AddPaymentModal'
import VendorBillsTable from '../components/vendors/VendorBillsTable'
import { vendorsApi } from '../features/vendors/api'
import type {
  Vendor,
  VendorBill,
  VendorSummary,
} from '../features/vendors/types'

const money = (value: string | number) => {
  const amount = Number(value || 0)
  return amount.toLocaleString('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  })
}

export default function VendorDetailsPage() {
  const navigate = useNavigate()
  const { vendorId } = useParams()

  const id = Number(vendorId)

  const [vendor, setVendor] = useState<Vendor | null>(null)
  const [summary, setSummary] = useState<VendorSummary | null>(null)
  const [bills, setBills] = useState<VendorBill[]>([])
  const [selectedBill, setSelectedBill] = useState<VendorBill | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const pendingBills = useMemo(() => {
    return bills.filter((bill) => bill.status !== 'completed').length
  }, [bills])

  const loadDetails = async () => {
    try {
      setIsLoading(true)
      const [vendorData, summaryData, billData] = await Promise.all([
        vendorsApi.getVendor(id),
        vendorsApi.getVendorSummary(id),
        vendorsApi.getVendorBills(id),
      ])
      setVendor(vendorData)
      setSummary(summaryData)
      setBills(billData)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (!Number.isNaN(id)) {
      loadDetails()
    }
  }, [id])

  if (!vendor && isLoading) {
    return (
      <AppShell>
        <div className="mx-auto max-w-[1600px] space-y-5">
          <div className="h-32 animate-pulse rounded-[34px] bg-white/70 dark:bg-slate-800/70" />
          <div className="grid gap-4 lg:grid-cols-3">
            <div className="h-40 animate-pulse rounded-[30px] bg-white/70 dark:bg-slate-800/70" />
            <div className="h-40 animate-pulse rounded-[30px] bg-white/70 dark:bg-slate-800/70" />
            <div className="h-40 animate-pulse rounded-[30px] bg-white/70 dark:bg-slate-800/70" />
          </div>
          <div className="h-96 animate-pulse rounded-[34px] bg-white/70 dark:bg-slate-800/70" />
        </div>
      </AppShell>
    )
  }

  if (!vendor) {
    return (
      <AppShell>
        <div className="mx-auto max-w-[760px] rounded-[34px] bg-white/80 p-10 text-center shadow-[0_24px_70px_rgba(15,23,42,0.07)]
          dark:bg-slate-900/80 dark:shadow-[0_24px_70px_rgba(0,0,0,0.3)]">
          <h1 className="text-2xl font-black text-slate-950 dark:text-white">Vendor not found</h1>
          <button
            onClick={() => navigate('/vendors')}
            className="mt-5 rounded-2xl bg-slate-950 px-5 py-3 text-sm font-black text-white
              dark:bg-white dark:text-slate-950"
          >
            Back to Vendors
          </button>
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell>
      <div className="mx-auto mt-2 max-w-[1600px]">

        {/* Back button */}
        <button
          onClick={() => navigate('/vendors')}
          className="mb-6 inline-flex items-center gap-2 rounded-2xl border border-indigo-100 bg-white/75 px-4 py-2.5 text-sm font-black text-slate-700 shadow-[0_12px_30px_rgba(99,102,241,0.08)] backdrop-blur-xl transition-all duration-300 hover:-translate-y-[1px] hover:text-indigo-700
            dark:border-indigo-900/50 dark:bg-slate-800/75 dark:text-slate-200 dark:hover:text-indigo-400"
        >
          <ArrowLeft size={17} />
          Back to Vendors
        </button>

        {/* Vendor header card */}
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8 rounded-[36px] bg-white/78 p-6 shadow-[0_24px_70px_rgba(15,23,42,0.07)] backdrop-blur-xl md:p-8
            dark:bg-slate-900/80 dark:shadow-[0_24px_70px_rgba(0,0,0,0.3)]"
        >
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-5">
              {/* Icon */}
              <div className="flex h-20 w-20 items-center justify-center rounded-[26px] bg-gradient-to-br from-indigo-50 to-violet-50 text-indigo-600 shadow-[inset_0_0_0_1px_rgba(99,102,241,0.10)]
                dark:from-indigo-950/60 dark:to-violet-950/60 dark:text-indigo-400 dark:shadow-[inset_0_0_0_1px_rgba(99,102,241,0.15)]">
                <Truck size={38} />
              </div>

              <div>
                <div className="mb-2 inline-flex rounded-full bg-indigo-50 px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.18em] text-indigo-600
                  dark:bg-indigo-950/60 dark:text-indigo-400">
                  Vendor Partner
                </div>

                <h1 className="text-[36px] font-black tracking-[-0.04em] text-slate-950 md:text-[52px] dark:text-white">
                  {vendor.company_name || vendor.vendor_name}
                </h1>

                <div className="mt-3 flex flex-wrap gap-4 text-sm font-medium text-slate-600 dark:text-slate-400">
                  <span className="inline-flex items-center gap-2">
                    <Mail size={16} className="text-indigo-500 dark:text-indigo-400" />
                    {vendor.email || 'No email added'}
                  </span>
                  <span className="inline-flex items-center gap-2">
                    <Phone size={16} className="text-indigo-500 dark:text-indigo-400" />
                    {vendor.phone || 'No phone added'}
                  </span>
                </div>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex flex-col gap-3 sm:flex-row">
              <button className="inline-flex h-14 items-center justify-center gap-2 rounded-[22px] bg-slate-100 px-5 text-sm font-black text-slate-800 transition hover:-translate-y-[1px] hover:bg-slate-200
                dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700">
                <Edit3 size={17} />
                Edit Vendor
              </button>

              <button
                onClick={() => navigate(`/vendors/${vendor.id}/bills/new`)}
                className="inline-flex h-14 items-center justify-center gap-2 rounded-[22px] bg-gradient-to-r from-[#7c6cff] via-[#5b43f3] to-[#3b2be4] px-6 text-sm font-black text-white shadow-[0_20px_48px_rgba(79,70,229,0.30)] transition-all duration-300 hover:-translate-y-[1px]"
              >
                <Plus size={18} />
                Add Bill
              </button>
            </div>
          </div>
        </motion.div>

        {/* Info cards row */}
        <div className="mb-8 grid gap-4 lg:grid-cols-[1fr_1fr_2fr]">
          <InfoCard
            label="Total Outstanding"
            value={money(summary?.total_remaining_amount || 0)}
            helper={`${summary?.overdue_bills_count || 0} overdue bills`}
            icon={CreditCard}
          />

          <InfoCard
            label="Pending Bills"
            value={pendingBills}
            helper="Requiring action"
            icon={Building2}
          />

          {/* Fast-track promo card */}
          <motion.div
            whileHover={{ y: -3 }}
            className="relative overflow-hidden rounded-[30px] bg-gradient-to-br from-indigo-100 via-violet-100 to-indigo-50 p-7 text-indigo-950 shadow-[0_20px_54px_rgba(99,102,241,0.12)]
              dark:from-indigo-950/80 dark:via-violet-950/80 dark:to-indigo-950/60 dark:text-indigo-100 dark:shadow-[0_20px_54px_rgba(99,102,241,0.06)]"
          >
            <h3 className="text-2xl font-black tracking-[-0.04em]">
              Fast-Track Payments
            </h3>
            <p className="mt-3 max-w-md text-sm leading-6 text-indigo-900/70 dark:text-indigo-300/70">
              Maintain recurring payment workflows and keep vendor relationships
              healthy with clear balance visibility.
            </p>
            <button className="mt-6 rounded-2xl bg-[#16007a] px-5 py-3 text-sm font-black text-white shadow-[0_16px_36px_rgba(49,46,129,0.22)] transition hover:-translate-y-[1px]
              dark:bg-indigo-600 dark:shadow-[0_16px_36px_rgba(99,102,241,0.20)]">
              Activate Auto-Pay
            </button>
            <div className="absolute -right-10 -top-16 h-48 w-48 rounded-full bg-white/45 blur-xl dark:bg-indigo-400/10" />
          </motion.div>
        </div>

        {/* Bills table card */}
        <div className="rounded-[34px] bg-white/72 p-5 shadow-[0_24px_70px_rgba(15,23,42,0.06)] backdrop-blur-xl
          dark:bg-slate-900/80 dark:shadow-[0_24px_70px_rgba(0,0,0,0.25)]">
          <VendorBillsTable
            bills={bills}
            isLoading={isLoading}
            onAddBill={() => navigate(`/vendors/${vendor.id}/bills/new`)}
            onAddPayment={(bill) => setSelectedBill(bill)}
            onEditBill={(bill) => navigate(`/vendors/${vendor.id}/bills/${bill.id}/edit`)}
          />
        </div>

        {/* Financial Health Insights banner */}
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-8 grid gap-6 rounded-[34px] bg-white/80 p-8 shadow-[0_28px_80px_rgba(15,23,42,0.08)] backdrop-blur-xl md:grid-cols-[90px_1fr]
            dark:bg-slate-900/80 dark:shadow-[0_28px_80px_rgba(0,0,0,0.3)]"
        >
          <div className="flex h-[86px] w-[86px] items-center justify-center rounded-full bg-gradient-to-br from-[#7c6cff] to-[#2f20d6] text-white shadow-[0_22px_50px_rgba(79,70,229,0.28)]">
            <Sparkles size={36} />
          </div>

          <div>
            <h2 className="text-3xl font-black tracking-[-0.04em] text-slate-950 dark:text-white">
              Financial Health Insights
            </h2>
            <p className="mt-3 max-w-3xl text-[16px] leading-8 text-slate-600 dark:text-slate-400">
              Track outstanding balance, bill status, due dates, and payment
              history to strengthen procurement planning and vendor credit
              reliability.
            </p>
          </div>
        </motion.div>
      </div>

      <AddPaymentModal
        bill={selectedBill}
        onClose={() => setSelectedBill(null)}
        onSuccess={() => {
          setSelectedBill(null)
          loadDetails()
        }}
      />
    </AppShell>
  )
}

function InfoCard({
  label,
  value,
  helper,
  icon: Icon,
}: {
  label: string
  value: string | number
  helper: string
  icon: ElementType
}) {
  return (
    <motion.div
      whileHover={{ y: -3 }}
      className="rounded-[30px] bg-white/78 p-6 shadow-[0_20px_54px_rgba(15,23,42,0.06)] backdrop-blur-xl
        dark:bg-slate-900/80 dark:shadow-[0_20px_54px_rgba(0,0,0,0.25)]"
    >
      <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600
        dark:bg-indigo-950/60 dark:text-indigo-400">
        <Icon size={22} />
      </div>

      <p className="text-[12px] font-black uppercase tracking-[0.18em] text-slate-500 dark:text-slate-500">
        {label}
      </p>

      <h3 className="mt-3 text-[30px] font-black tracking-[-0.04em] text-slate-950 dark:text-white">
        {value}
      </h3>

      <p className="mt-2 text-sm font-semibold text-slate-500 dark:text-slate-400">{helper}</p>
    </motion.div>
  )
}
