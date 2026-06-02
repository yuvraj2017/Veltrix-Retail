import type {
  Vendor,
  VendorBill,
  VendorBillCreatePayload,
  VendorBillPayment,
  VendorBillPaymentCreatePayload,
  VendorBillUpdatePayload,
  VendorCreatePayload,
  VendorSummary,
  VendorUpdatePayload,
  VendorStatsResponse
} from "./types";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";

const getToken = () => {
  return (
    localStorage.getItem("access_token") ||
    localStorage.getItem("token") ||
    localStorage.getItem("authToken")
  );
};

const buildHeaders = (): HeadersInit => {
  const token = getToken();

  const headers: HeadersInit = {
    "Content-Type": "application/json",
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  return headers;
};

const handleResponse = async <T>(response: Response): Promise<T> => {
  if (!response.ok) {
    let message = "Something went wrong";

    try {
      const errorData = await response.json();
      message = errorData?.detail || errorData?.message || message;
    } catch {
      message = response.statusText || message;
    }

    throw new Error(message);
  }

  return response.json();
};

export const vendorsApi = {
  getVendors: async (): Promise<Vendor[]> => {
    const response = await fetch(`${API_BASE_URL}/api/v1/vendors`, {
      method: "GET",
      headers: buildHeaders(),
    });

    return handleResponse<Vendor[]>(response);
  },

  createVendor: async (payload: VendorCreatePayload): Promise<Vendor> => {
    const response = await fetch(`${API_BASE_URL}/api/v1/vendors`, {
      method: "POST",
      headers: buildHeaders(),
      body: JSON.stringify(payload),
    });

    return handleResponse<Vendor>(response);
  },

  getVendor: async (vendorId: number): Promise<Vendor> => {
    const response = await fetch(`${API_BASE_URL}/api/v1/vendors/${vendorId}`, {
      method: "GET",
      headers: buildHeaders(),
    });

    return handleResponse<Vendor>(response);
  },

  updateVendor: async (
    vendorId: number,
    payload: VendorUpdatePayload
  ): Promise<Vendor> => {
    const response = await fetch(`${API_BASE_URL}/api/v1/vendors/${vendorId}`, {
      method: "PUT",
      headers: buildHeaders(),
      body: JSON.stringify(payload),
    });

    return handleResponse<Vendor>(response);
  },

  deleteVendor: async (vendorId: number): Promise<{ message: string }> => {
    const response = await fetch(`${API_BASE_URL}/api/v1/vendors/${vendorId}`, {
      method: "DELETE",
      headers: buildHeaders(),
    });

    return handleResponse<{ message: string }>(response);
  },

  getVendorSummary: async (vendorId: number): Promise<VendorSummary> => {
    const response = await fetch(
      `${API_BASE_URL}/api/v1/vendors/${vendorId}/summary`,
      {
        method: "GET",
        headers: buildHeaders(),
      }
    );

    return handleResponse<VendorSummary>(response);
  },

  getVendorBills: async (
    vendorId: number,
    filters?: {
      search?: string;
      status?: string;
      overdue_only?: boolean;
      due_in_days?: number;
    }
  ): Promise<VendorBill[]> => {
    const params = new URLSearchParams();

    if (filters?.search) params.set("search", filters.search);
    if (filters?.status) params.set("status", filters.status);
    if (filters?.overdue_only) params.set("overdue_only", "true");

    if (filters?.due_in_days !== undefined) {
      params.set("due_in_days", String(filters.due_in_days));
    }

    const query = params.toString();

    const response = await fetch(
      `${API_BASE_URL}/api/v1/vendors/${vendorId}/bills${
        query ? `?${query}` : ""
      }`,
      {
        method: "GET",
        headers: buildHeaders(),
      }
    );

    return handleResponse<VendorBill[]>(response);
  },


  getVendorStats: async (): Promise<VendorStatsResponse> => {
    const response = await fetch(`${API_BASE_URL}/api/v1/vendors/stats`, {
        method: "GET",
        headers: buildHeaders(),
    })

    return handleResponse<VendorStatsResponse>(response)
    },

  createVendorBill: async (
    vendorId: number,
    payload: VendorBillCreatePayload
  ): Promise<VendorBill> => {
    const response = await fetch(
      `${API_BASE_URL}/api/v1/vendors/${vendorId}/bills`,
      {
        method: "POST",
        headers: buildHeaders(),
        body: JSON.stringify(payload),
      }
    );

    return handleResponse<VendorBill>(response);
  },

  getVendorBill: async (billId: number): Promise<VendorBill> => {
    const response = await fetch(
      `${API_BASE_URL}/api/v1/vendors/bills/${billId}`,
      {
        method: "GET",
        headers: buildHeaders(),
      }
    );

    return handleResponse<VendorBill>(response);
  },

  updateVendorBill: async (
    billId: number,
    payload: VendorBillUpdatePayload
  ): Promise<VendorBill> => {
    const response = await fetch(
      `${API_BASE_URL}/api/v1/vendors/bills/${billId}`,
      {
        method: "PUT",
        headers: buildHeaders(),
        body: JSON.stringify(payload),
      }
    );

    return handleResponse<VendorBill>(response);
  },

  getBillPayments: async (billId: number): Promise<VendorBillPayment[]> => {
    const response = await fetch(
      `${API_BASE_URL}/api/v1/vendors/bills/${billId}/payments`,
      {
        method: "GET",
        headers: buildHeaders(),
      }
    );

    return handleResponse<VendorBillPayment[]>(response);
  },

  addBillPayment: async (
    billId: number,
    payload: VendorBillPaymentCreatePayload
  ): Promise<VendorBillPayment> => {
    const response = await fetch(
      `${API_BASE_URL}/api/v1/vendors/bills/${billId}/payments`,
      {
        method: "POST",
        headers: buildHeaders(),
        body: JSON.stringify(payload),
      }
    );

    return handleResponse<VendorBillPayment>(response);
  },
};