export type StatCardData = {
  title: string
  value: string
  change: string
  positive?: boolean
  highlight?: boolean
}

export type RecentBill = {
  id: string
  date: string
  amount: string
  status: 'PAID' | 'PENDING'
}

export type LowStockProduct = {
  id: string
  name: string
  sku: string
  left: number
  image: string
}