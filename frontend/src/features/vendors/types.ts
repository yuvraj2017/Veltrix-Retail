export type Vendor = {
  id: number;
  shop_id: number;

  vendor_name: string;
  company_name?: string | null;
  email?: string | null;
  phone?: string | null;
  alternate_phone?: string | null;
  tax_number?: string | null;

  address_line_1?: string | null;
  address_line_2?: string | null;
  city?: string | null;
  state?: string | null;
  postal_code?: string | null;
  country?: string | null;

  payment_terms?: string | null;
  default_reminder_days: number;
  notes?: string | null;
  is_active: boolean;

  created_at: string;
  updated_at: string;
};

export type VendorCreatePayload = {
  vendor_name: string;
  company_name?: string | null;
  email?: string | null;
  phone?: string | null;
  alternate_phone?: string | null;
  tax_number?: string | null;

  address_line_1?: string | null;
  address_line_2?: string | null;
  city?: string | null;
  state?: string | null;
  postal_code?: string | null;
  country?: string | null;

  payment_terms?: string | null;
  default_reminder_days: number;
  notes?: string | null;
  is_active: boolean;
};

export type VendorUpdatePayload = Partial<VendorCreatePayload>;

export type VendorSummary = {
  vendor_id: number;
  total_bills: number;
  total_bill_amount: string | number;
  total_paid_amount: string | number;
  total_remaining_amount: string | number;
  overdue_bills_count: number;
  due_soon_bills_count: number;
};

export type VendorBillStatus = "pending" | "partial" | "completed" | "overdue";

export type VendorBill = {
  id: number;
  shop_id: number;
  vendor_id: number;

  bill_number: string;
  bill_date: string;
  due_date?: string | null;

  total_amount: string | number;
  paid_amount: string | number;
  remaining_amount: string | number;
  status: VendorBillStatus;

  payment_mode?: string | null;
  payment_reference?: string | null;
  reminder_days_before: number;
  attachment_url?: string | null;
  notes?: string | null;

  created_at: string;
  updated_at: string;
};

export type VendorBillCreatePayload = {
  bill_number: string;
  bill_date: string;
  due_date?: string | null;
  total_amount: number;
  paid_amount: number;
  payment_mode?: string | null;
  payment_reference?: string | null;
  reminder_days_before: number;
  attachment_url?: string | null;
  notes?: string | null;
};

export type VendorBillUpdatePayload = Partial<{
  bill_number: string;
  bill_date: string;
  due_date: string | null;
  total_amount: number;
  payment_mode: string | null;
  payment_reference: string | null;
  reminder_days_before: number;
  attachment_url: string | null;
  notes: string | null;
}>;

export type VendorBillPayment = {
  id: number;
  shop_id: number;
  vendor_bill_id: number;
  payment_date: string;
  amount: string | number;
  payment_mode?: string | null;
  reference_number?: string | null;
  notes?: string | null;
  created_at: string;
  updated_at: string;
};

export type VendorBillPaymentCreatePayload = {
  payment_date: string;
  amount: number;
  payment_mode?: string | null;
  reference_number?: string | null;
  notes?: string | null;
};



export type VendorStatsResponse = {
  total_vendors: number
  active_vendors: number
  inactive_vendors: number

  total_bills: number
  total_bill_amount: string | number
  total_paid_amount: string | number
  total_remaining_amount: string | number

  pending_bills: number
  partial_bills: number
  overdue_bills: number
  completed_bills: number
  due_soon_bills: number
}