import { z } from "zod";

const optionalText = z
  .string()
  .trim()
  .optional()
  .nullable()
  .transform((value) => {
    if (!value) return null;
    return value;
  });

export const vendorSchema = z.object({
  vendor_name: z
    .string()
    .trim()
    .min(1, "Vendor name is required")
    .max(150, "Vendor name is too long"),

  company_name: optionalText,

  email: z
    .string()
    .trim()
    .email("Enter a valid email address")
    .optional()
    .or(z.literal(""))
    .transform((value) => {
      if (!value) return null;
      return value;
    }),

  phone: optionalText,
  alternate_phone: optionalText,
  tax_number: optionalText,

  address_line_1: optionalText,
  address_line_2: optionalText,
  city: optionalText,
  state: optionalText,
  postal_code: optionalText,
  country: optionalText,

  payment_terms: optionalText,

  default_reminder_days: z.coerce
    .number()
    .min(0, "Reminder days cannot be negative")
    .max(365, "Reminder days are too high"),

  notes: optionalText,
  is_active: z.boolean(),
});

export const vendorBillSchema = z.object({
  bill_number: z
    .string()
    .trim()
    .min(1, "Bill number is required")
    .max(100, "Bill number is too long"),

  bill_date: z.string().min(1, "Bill date is required"),

  due_date: z
    .string()
    .optional()
    .nullable()
    .transform((value) => {
      if (!value) return null;
      return value;
    }),

  total_amount: z.coerce
    .number()
    .min(0, "Total bill amount cannot be negative"),

  paid_amount: z.coerce.number().min(0, "Paid amount cannot be negative"),

  payment_mode: optionalText,
  payment_reference: optionalText,

  reminder_days_before: z.coerce
    .number()
    .min(0, "Reminder days cannot be negative")
    .max(365, "Reminder days are too high"),

  attachment_url: optionalText,
  notes: optionalText,
});

export const vendorPaymentSchema = z.object({
  payment_date: z.string().min(1, "Payment date is required"),
  amount: z.coerce.number().gt(0, "Payment amount must be greater than 0"),
  payment_mode: optionalText,
  reference_number: optionalText,
  notes: optionalText,
});

export type VendorFormValues = z.infer<typeof vendorSchema>;
export type VendorBillFormValues = z.infer<typeof vendorBillSchema>;
export type VendorPaymentFormValues = z.infer<typeof vendorPaymentSchema>;