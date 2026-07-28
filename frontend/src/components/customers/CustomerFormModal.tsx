import { useEffect, useMemo, useState } from 'react'
import { Loader2, UserRound, X } from 'lucide-react'

import { getApiErrorMessage } from '../../lib/api-error'
import { customerSchema, type CustomerFormValues } from '../../features/customers/schemas'
import type { CustomerPayload, CustomerRecord } from '../../features/customers/types'

type CustomerFormModalProps = {
  open: boolean
  mode: 'create' | 'edit'
  customer?: CustomerRecord | null
  loading?: boolean
  onClose: () => void
  onSubmit: (payload: CustomerPayload) => Promise<void>
}

const emptyValues: CustomerFormValues = {
  first_name: '',
  last_name: null,
  phone: '',
  email: null,
  address: null,
  city: null,
  state: null,
  pincode: null,
  gst_number: null,
}

function toFormValues(customer?: CustomerRecord | null): CustomerFormValues {
  if (!customer) return emptyValues

  return {
    first_name: customer.first_name || '',
    last_name: customer.last_name || null,
    phone: customer.phone || '',
    email: customer.email || null,
    address: customer.address || null,
    city: customer.city || null,
    state: customer.state || null,
    pincode: customer.pincode || null,
    gst_number: customer.gst_number || null,
  }
}

export function CustomerFormModal({
  open,
  mode,
  customer,
  loading = false,
  onClose,
  onSubmit,
}: CustomerFormModalProps) {
  const [values, setValues] = useState<CustomerFormValues>(emptyValues)
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    if (!open) return
    setValues(toFormValues(customer))
    setErrorMessage('')
  }, [open, customer])

  const title = useMemo(
    () => (mode === 'create' ? 'Add Customer' : 'Edit Customer'),
    [mode],
  )

  if (!open) return null

  const handleChange = <K extends keyof CustomerFormValues>(key: K, value: CustomerFormValues[K]) => {
    setValues((current) => ({ ...current, [key]: value }))
  }

  const handleSubmit = async () => {
    try {
      setErrorMessage('')
      const parsed = customerSchema.safeParse(values)

      if (!parsed.success) {
        setErrorMessage(parsed.error.issues[0]?.message || 'Please check customer details')
        return
      }

      const payload: CustomerPayload = {
        first_name: parsed.data.first_name,
        last_name: parsed.data.last_name ?? null,
        phone: parsed.data.phone,
        email: parsed.data.email ?? null,
        address: parsed.data.address ?? null,
        city: parsed.data.city ?? null,
        state: parsed.data.state ?? null,
        pincode: parsed.data.pincode ?? null,
        gst_number: parsed.data.gst_number ?? null,
      }

      await onSubmit(payload)
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error, 'Unable to save customer'))
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 px-4 py-6 backdrop-blur-sm">
      <div className="w-full max-w-3xl overflow-hidden rounded-[2rem] border border-white/60 bg-white shadow-[0_26px_80px_rgba(15,23,42,0.24)] dark:border-slate-700 dark:bg-slate-900">
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-5 dark:border-slate-800 sm:px-8">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.22em] text-indigo-500">
              Customer Module
            </p>
            <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-950 dark:text-white">
              {title}
            </h2>
            <p className="mt-2 max-w-xl text-sm font-medium leading-6 text-slate-500 dark:text-slate-400">
              Save customer identity, contact details, and billing metadata in one place.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-2xl border border-slate-200 bg-white p-2.5 text-slate-500 transition hover:text-indigo-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
          >
            <X size={18} />
          </button>
        </div>

        <div className="max-h-[72vh] overflow-y-auto px-6 py-6 sm:px-8">
          {errorMessage ? (
            <div className="mb-5 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-semibold text-red-600 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-400">
              {errorMessage}
            </div>
          ) : null}

          <div className="grid gap-4 md:grid-cols-2">
            <Field label="First Name*">
              <input
                value={values.first_name}
                onChange={(event) => handleChange('first_name', event.target.value)}
                placeholder="Enter first name"
                className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-medium text-slate-700 outline-none transition focus:border-indigo-300 focus:bg-white focus:ring-4 focus:ring-indigo-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:focus:border-indigo-500 dark:focus:bg-slate-900 dark:focus:ring-indigo-950"
              />
            </Field>

            <Field label="Last Name">
              <input
                value={values.last_name || ''}
                onChange={(event) => handleChange('last_name', event.target.value || null)}
                placeholder="Enter last name"
                className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-medium text-slate-700 outline-none transition focus:border-indigo-300 focus:bg-white focus:ring-4 focus:ring-indigo-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:focus:border-indigo-500 dark:focus:bg-slate-900 dark:focus:ring-indigo-950"
              />
            </Field>

            <Field label="Phone Number*">
              <input
                value={values.phone}
                onChange={(event) => handleChange('phone', event.target.value)}
                placeholder="Enter phone number"
                className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-medium text-slate-700 outline-none transition focus:border-indigo-300 focus:bg-white focus:ring-4 focus:ring-indigo-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:focus:border-indigo-500 dark:focus:bg-slate-900 dark:focus:ring-indigo-950"
              />
            </Field>

            <Field label="Email Address">
              <input
                value={values.email || ''}
                onChange={(event) => handleChange('email', event.target.value || null)}
                placeholder="Enter email address"
                className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-medium text-slate-700 outline-none transition focus:border-indigo-300 focus:bg-white focus:ring-4 focus:ring-indigo-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:focus:border-indigo-500 dark:focus:bg-slate-900 dark:focus:ring-indigo-950"
              />
            </Field>

            <Field label="City">
              <input
                value={values.city || ''}
                onChange={(event) => handleChange('city', event.target.value || null)}
                placeholder="Enter city"
                className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-medium text-slate-700 outline-none transition focus:border-indigo-300 focus:bg-white focus:ring-4 focus:ring-indigo-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:focus:border-indigo-500 dark:focus:bg-slate-900 dark:focus:ring-indigo-950"
              />
            </Field>

            <Field label="State">
              <input
                value={values.state || ''}
                onChange={(event) => handleChange('state', event.target.value || null)}
                placeholder="Enter state"
                className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-medium text-slate-700 outline-none transition focus:border-indigo-300 focus:bg-white focus:ring-4 focus:ring-indigo-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:focus:border-indigo-500 dark:focus:bg-slate-900 dark:focus:ring-indigo-950"
              />
            </Field>

            <Field label="Pincode">
              <input
                value={values.pincode || ''}
                onChange={(event) => handleChange('pincode', event.target.value || null)}
                placeholder="Enter pincode"
                className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-medium text-slate-700 outline-none transition focus:border-indigo-300 focus:bg-white focus:ring-4 focus:ring-indigo-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:focus:border-indigo-500 dark:focus:bg-slate-900 dark:focus:ring-indigo-950"
              />
            </Field>

            <Field label="GST Number">
              <input
                value={values.gst_number || ''}
                onChange={(event) => handleChange('gst_number', event.target.value || null)}
                placeholder="Enter GST number"
                className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-medium text-slate-700 outline-none transition focus:border-indigo-300 focus:bg-white focus:ring-4 focus:ring-indigo-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:focus:border-indigo-500 dark:focus:bg-slate-900 dark:focus:ring-indigo-950"
              />
            </Field>
          </div>

          <div className="mt-4 grid gap-4">
            <Field label="Address">
              <textarea
                value={values.address || ''}
                onChange={(event) => handleChange('address', event.target.value || null)}
                placeholder="Enter address"
                rows={4}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700 outline-none transition focus:border-indigo-300 focus:bg-white focus:ring-4 focus:ring-indigo-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:focus:border-indigo-500 dark:focus:bg-slate-900 dark:focus:ring-indigo-950"
              />
            </Field>
          </div>
        </div>

        <div className="flex flex-col-reverse gap-3 border-t border-slate-100 px-6 py-5 dark:border-slate-800 sm:flex-row sm:justify-end sm:px-8">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-12 items-center justify-center rounded-2xl border border-slate-200 px-5 text-sm font-bold text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            Cancel
          </button>

          <button
            type="button"
            disabled={loading}
            onClick={handleSubmit}
            className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-slate-950 px-5 text-sm font-black text-white shadow-[0_16px_34px_rgba(15,23,42,0.18)] transition hover:-translate-y-[1px] hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-indigo-600 dark:hover:bg-indigo-500"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <UserRound size={16} />}
            {mode === 'create' ? 'Save Customer' : 'Update Customer'}
          </button>
        </div>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-2 block text-[11px] font-black uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
        {label}
      </span>
      {children}
    </label>
  )
}

