import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import {
  CheckCircle2,
  Mail,
  MapPin,
  Phone,
  Plus,
  Search,
  UserRound,
  X,
} from 'lucide-react'

import { billingApi } from '../../features/billing/api'
import type {
  CustomerPayload,
  CustomerSearchResult,
} from '../../features/billing/types'

type CustomerSelectorProps = {
  customer: CustomerPayload
  onCustomerChange: (customer: CustomerPayload) => void
}

const emptyCustomer: CustomerPayload = {
  id: null,
  first_name: '',
  last_name: '',
  phone: '',
  email: '',
  address: '',
  city: '',
  state: '',
  pincode: '',
  gst_number: '',
}

const splitFullName = (fullName: string) => {
  const parts = fullName.trim().split(' ').filter(Boolean)
  const firstName = parts[0] || ''
  const lastName = parts.slice(1).join(' ') || ''

  return {
    first_name: firstName,
    last_name: lastName,
  }
}

export default function CustomerSelector({
  customer,
  onCustomerChange,
}: CustomerSelectorProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<CustomerSearchResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [showResults, setShowResults] = useState(false)

  const updateField = (field: keyof CustomerPayload, value: string) => {
    onCustomerChange({
      ...customer,
      [field]: value,
    })
  }

  const selectCustomer = (item: CustomerSearchResult) => {
    const nameParts = splitFullName(item.full_name)

    onCustomerChange({
      id: item.id,
      first_name: nameParts.first_name,
      last_name: nameParts.last_name,
      phone: item.phone,
      email: item.email || '',
      address: item.address || '',
      city: item.city || '',
      state: item.state || '',
      pincode: item.pincode || '',
      gst_number: item.gst_number || '',
    })

    setQuery(item.full_name)
    setResults([])
    setShowResults(false)
  }

  const clearCustomer = () => {
    onCustomerChange(emptyCustomer)
    setQuery('')
    setResults([])
    setShowResults(false)
  }

  useEffect(() => {
    const cleaned = query.trim()

    if (cleaned.length < 2) {
      setResults([])
      return
    }

    const timer = setTimeout(async () => {
      try {
        setIsSearching(true)

        const data = await billingApi.searchCustomers(cleaned)
        setResults(data)
        setShowResults(true)
      } catch (error) {
        console.error('Failed to search customers', error)
        setResults([])
      } finally {
        setIsSearching(false)
      }
    }, 300)

    return () => clearTimeout(timer)
  }, [query])

  return (
    <section className="rounded-[34px] bg-white/80 p-6 shadow-[0_24px_70px_rgba(15,23,42,0.06)] backdrop-blur-xl md:p-8">
      <div className="mb-7 flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
            <UserRound size={24} />
          </div>

          <div>
            <h2 className="text-2xl font-black tracking-[-0.035em] text-slate-950">
              Customer Selection
            </h2>
            <p className="mt-1 text-sm font-medium text-slate-500">
              Search existing customers or add a new customer manually.
            </p>
          </div>
        </div>

        {customer.id && (
          <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-4 py-2 text-sm font-black text-emerald-700">
            <CheckCircle2 size={16} />
            Existing Customer Selected
          </div>
        )}
      </div>

      <div className="relative mb-7">
        <Search
          size={20}
          className="pointer-events-none absolute left-5 top-1/2 -translate-y-1/2 text-slate-400"
        />

        <input
          value={query}
          onChange={(event) => {
            setQuery(event.target.value)
            setShowResults(true)
          }}
          placeholder="Search by customer name, phone, or email..."
          className="h-14 w-full rounded-[22px] border border-indigo-100/80 bg-slate-50/90 pl-14 pr-14 text-[15px] font-medium text-slate-700 outline-none transition-all duration-300 placeholder:text-slate-400 focus:-translate-y-[1px] focus:border-indigo-300 focus:bg-white focus:shadow-[0_0_0_5px_rgba(99,102,241,0.12)]"
        />

        {query && (
          <button
            type="button"
            onClick={() => {
              setQuery('')
              setResults([])
            }}
            className="absolute right-4 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-slate-100 text-slate-500 transition hover:bg-slate-200"
          >
            <X size={15} />
          </button>
        )}

        {showResults && results.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="absolute left-0 right-0 top-[64px] z-30 overflow-hidden rounded-[26px] border border-white/70 bg-white/95 p-2 shadow-[0_24px_70px_rgba(15,23,42,0.16)] backdrop-blur-xl"
          >
            {results.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => selectCustomer(item)}
                className="flex w-full items-center gap-4 rounded-[20px] px-4 py-3 text-left transition hover:bg-indigo-50"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 text-sm font-black text-white">
                  {item.full_name.charAt(0).toUpperCase()}
                </div>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-black text-slate-950">
                    {item.full_name}
                  </p>
                  <p className="mt-1 flex flex-wrap gap-3 text-xs font-medium text-slate-500">
                    <span className="inline-flex items-center gap-1">
                      <Phone size={12} />
                      {item.phone}
                    </span>
                    {item.email && (
                      <span className="inline-flex items-center gap-1">
                        <Mail size={12} />
                        {item.email}
                      </span>
                    )}
                  </p>
                </div>
              </button>
            ))}
          </motion.div>
        )}

        {isSearching && (
          <p className="mt-2 text-xs font-semibold text-indigo-600">
            Searching customers...
          </p>
        )}
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <Input
          label="First Name"
          value={customer.first_name}
          onChange={(value) => updateField('first_name', value)}
          placeholder="Customer first name"
        />

        <Input
          label="Last Name"
          value={customer.last_name || ''}
          onChange={(value) => updateField('last_name', value)}
          placeholder="Customer last name"
        />

        <Input
          label="Phone Number"
          value={customer.phone}
          onChange={(value) => updateField('phone', value)}
          placeholder="+91 98765 43210"
        />

        <Input
          label="Email Address"
          value={customer.email || ''}
          onChange={(value) => updateField('email', value)}
          placeholder="customer@email.com"
        />

        <div className="md:col-span-2">
          <Input
            label="Address"
            value={customer.address || ''}
            onChange={(value) => updateField('address', value)}
            placeholder="Customer address"
          />
        </div>

        <Input
          label="City"
          value={customer.city || ''}
          onChange={(value) => updateField('city', value)}
          placeholder="Rajkot"
        />

        <Input
          label="State"
          value={customer.state || ''}
          onChange={(value) => updateField('state', value)}
          placeholder="Gujarat"
        />

        <Input
          label="Pincode"
          value={customer.pincode || ''}
          onChange={(value) => updateField('pincode', value)}
          placeholder="360001"
        />

        <Input
          label="GST Number"
          value={customer.gst_number || ''}
          onChange={(value) => updateField('gst_number', value)}
          placeholder="Optional"
        />
      </div>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="flex items-center gap-2 text-sm font-semibold text-slate-500">
          <MapPin size={16} className="text-indigo-500" />
          Duplicate customer detection will happen using phone number.
        </p>

        <button
          type="button"
          onClick={clearCustomer}
          className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-100 px-4 py-3 text-sm font-black text-slate-700 transition hover:bg-slate-200"
        >
          <Plus size={16} />
          Reset Customer
        </button>
      </div>
    </section>
  )
}

function Input({
  label,
  value,
  placeholder,
  onChange,
}: {
  label: string
  value: string
  placeholder?: string
  onChange: (value: string) => void
}) {
  return (
    <label className="space-y-2">
      <span className="text-[12px] font-black uppercase tracking-[0.18em] text-slate-600">
        {label}
      </span>

      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="h-14 w-full rounded-[20px] border border-indigo-100/80 bg-slate-50/90 px-4 text-[15px] text-slate-800 outline-none transition-all duration-300 placeholder:text-slate-400 focus:-translate-y-[1px] focus:border-indigo-300 focus:bg-white focus:shadow-[0_0_0_5px_rgba(99,102,241,0.12)]"
      />
    </label>
  )
}