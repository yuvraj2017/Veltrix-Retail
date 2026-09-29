/**
 * Shared formatters for the admin screens.
 *
 * Money arrives from the API as a decimal string, so every value is coerced
 * through Number() before formatting. Uses the same en-IN currency conventions
 * as the rest of the application.
 */

const currency = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
})

const currencyPrecise = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 2,
})

const compact = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  notation: 'compact',
  maximumFractionDigits: 1,
})

const plain = new Intl.NumberFormat('en-IN')

export const formatMoney = (value: string | number | null | undefined) =>
  currency.format(Number(value || 0))

export const formatMoneyPrecise = (value: string | number | null | undefined) =>
  currencyPrecise.format(Number(value || 0))

/** For stat tiles, where a seven-figure revenue would otherwise wrap. */
export const formatMoneyCompact = (value: string | number | null | undefined) =>
  compact.format(Number(value || 0))

export const formatCount = (value: number | null | undefined) =>
  plain.format(Number(value || 0))

export const formatDate = (value?: string | null) => {
  if (!value) return '--'
  return new Date(value).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

export const formatDateTime = (value?: string | null) => {
  if (!value) return 'Never'
  return new Date(value).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/** Profit as a share of revenue. Guards the zero-revenue case. */
export const profitMargin = (
  revenue: string | number | null | undefined,
  profit: string | number | null | undefined,
) => {
  const revenueValue = Number(revenue || 0)
  if (revenueValue <= 0) return null
  return (Number(profit || 0) / revenueValue) * 100
}
