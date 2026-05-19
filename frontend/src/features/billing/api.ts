import type {
  BillingProduct,
  CustomerPayload,
  CustomerSearchResult,
  Invoice,
  InvoiceCreatePayload,
  InvoiceListResponse,
  InvoicePreviewResponse,
  InvoiceShareResponse,
  InvoiceStats,
} from './types'

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000'

const TOKEN_KEYS = [
  'access_token',
  'token',
  'authToken',
  'veltrix_token',
  'veltrix_access_token',
]

const getToken = () => {
  for (const key of TOKEN_KEYS) {
    const value = localStorage.getItem(key)

    if (value) {
      return value
    }
  }

  return null
}

const clearAuthStorage = () => {
  TOKEN_KEYS.forEach((key) => localStorage.removeItem(key))
}

const buildHeaders = (): HeadersInit => {
  const token = getToken()

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  }

  if (token) {
    headers.Authorization = `Bearer ${token}`
  }

  return headers
}

const handleResponse = async <T>(response: Response): Promise<T> => {
  if (response.status === 401) {
    clearAuthStorage()

    if (window.location.pathname !== '/login') {
      window.location.href = '/login'
    }

    throw new Error('Your session has expired. Please login again.')
  }

  if (!response.ok) {
    let message = 'Something went wrong'

    try {
      const errorData = await response.json()
      message = errorData?.detail || errorData?.message || message
    } catch {
      message = response.statusText || message
    }

    throw new Error(message)
  }

  return response.json()
}

export const billingApi = {
  searchCustomers: async (query: string): Promise<CustomerSearchResult[]> => {
    const params = new URLSearchParams()
    params.set('query', query)

    const response = await fetch(
      `${API_BASE_URL}/api/v1/customers/search?${params.toString()}`,
      {
        method: 'GET',
        headers: buildHeaders(),
      }
    )

    return handleResponse<CustomerSearchResult[]>(response)
  },

  createCustomer: async (payload: CustomerPayload): Promise<CustomerSearchResult> => {
    const response = await fetch(`${API_BASE_URL}/api/v1/customers`, {
      method: 'POST',
      headers: buildHeaders(),
      body: JSON.stringify(payload),
    })

    return handleResponse<CustomerSearchResult>(response)
  },

  searchBillingProducts: async (code: string): Promise<BillingProduct[]> => {
    const params = new URLSearchParams()
    params.set('code', code)

    const response = await fetch(
      `${API_BASE_URL}/api/v1/billing/products/search?${params.toString()}`,
      {
        method: 'GET',
        headers: buildHeaders(),
      }
    )

    return handleResponse<BillingProduct[]>(response)
  },

  getBillingProductByCode: async (productCode: string): Promise<BillingProduct> => {
    const response = await fetch(
      `${API_BASE_URL}/api/v1/billing/products/${encodeURIComponent(productCode)}`,
      {
        method: 'GET',
        headers: buildHeaders(),
      }
    )

    return handleResponse<BillingProduct>(response)
  },

  getInvoices: async (filters?: {
    search?: string
    payment_status?: string
    invoice_status?: string
    invoice_date?: string
    page?: number
    page_size?: number
  }): Promise<InvoiceListResponse> => {
    const params = new URLSearchParams()

    if (filters?.search) params.set('search', filters.search)
    if (filters?.payment_status) params.set('payment_status', filters.payment_status)
    if (filters?.invoice_status) params.set('invoice_status', filters.invoice_status)
    if (filters?.invoice_date) params.set('invoice_date', filters.invoice_date)
    if (filters?.page) params.set('page', String(filters.page))
    if (filters?.page_size) params.set('page_size', String(filters.page_size))

    const query = params.toString()

    const response = await fetch(
      `${API_BASE_URL}/api/v1/invoices${query ? `?${query}` : ''}`,
      {
        method: 'GET',
        headers: buildHeaders(),
      }
    )

    return handleResponse<InvoiceListResponse>(response)
  },

  getInvoiceStats: async (): Promise<InvoiceStats> => {
    const response = await fetch(`${API_BASE_URL}/api/v1/invoices/stats`, {
      method: 'GET',
      headers: buildHeaders(),
    })

    return handleResponse<InvoiceStats>(response)
  },

  createInvoice: async (payload: InvoiceCreatePayload): Promise<Invoice> => {
    const response = await fetch(`${API_BASE_URL}/api/v1/invoices`, {
      method: 'POST',
      headers: buildHeaders(),
      body: JSON.stringify(payload),
    })

    return handleResponse<Invoice>(response)
  },

  getInvoice: async (invoiceId: number): Promise<Invoice> => {
    const response = await fetch(`${API_BASE_URL}/api/v1/invoices/${invoiceId}`, {
      method: 'GET',
      headers: buildHeaders(),
    })

    return handleResponse<Invoice>(response)
  },

  getInvoicePreview: async (
    invoiceId: number
  ): Promise<InvoicePreviewResponse> => {
    const response = await fetch(
      `${API_BASE_URL}/api/v1/invoices/${invoiceId}/preview`,
      {
        method: 'GET',
        headers: buildHeaders(),
      }
    )

    return handleResponse<InvoicePreviewResponse>(response)
  },

  updateInvoice: async (
    invoiceId: number,
    payload: Partial<{
      payment_status: string
      payment_mode: string | null
      paid_amount: number
      invoice_status: string
      notes: string | null
    }>
  ): Promise<Invoice> => {
    const response = await fetch(`${API_BASE_URL}/api/v1/invoices/${invoiceId}`, {
      method: 'PUT',
      headers: buildHeaders(),
      body: JSON.stringify(payload),
    })

    return handleResponse<Invoice>(response)
  },

  deleteInvoice: async (invoiceId: number): Promise<{ message: string }> => {
    const response = await fetch(`${API_BASE_URL}/api/v1/invoices/${invoiceId}`, {
      method: 'DELETE',
      headers: buildHeaders(),
    })

    return handleResponse<{ message: string }>(response)
  },

  shareInvoice: async (
    invoiceId: number,
    payload?: {
      phone?: string
      message?: string
    }
  ): Promise<InvoiceShareResponse> => {
    const response = await fetch(
      `${API_BASE_URL}/api/v1/invoices/${invoiceId}/share`,
      {
        method: 'POST',
        headers: buildHeaders(),
        body: JSON.stringify(payload || {}),
      }
    )

    return handleResponse<InvoiceShareResponse>(response)
  },
}