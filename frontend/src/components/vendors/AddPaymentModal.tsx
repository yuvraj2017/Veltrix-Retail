import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { CreditCard, Loader2, X } from "lucide-react";
import { vendorsApi } from "../../features/vendors/api";
import type { VendorBill } from "../../features/vendors/types";
import { vendorPaymentSchema } from "../../features/vendors/schemas";

type AddPaymentModalProps = {
  bill: VendorBill | null;
  onClose: () => void;
  onSuccess: () => void;
};

const today = new Date().toISOString().slice(0, 10);

// Shared input class
const inputClass =
  "h-12 w-full rounded-2xl bg-[#f4f4f7] dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 px-4 outline-none transition focus:bg-white dark:focus:bg-slate-700 focus:shadow-[0_0_0_4px_rgba(79,70,229,0.10)] dark:focus:shadow-[0_0_0_4px_rgba(99,102,241,0.15)]";

const labelClass =
  "text-[12px] font-black uppercase tracking-[0.18em] text-[#343747] dark:text-slate-400";

export default function AddPaymentModal({
  bill,
  onClose,
  onSuccess,
}: AddPaymentModalProps) {
  const [paymentDate, setPaymentDate] = useState(today);
  const [amount, setAmount] = useState("");
  const [paymentMode, setPaymentMode] = useState("cash");
  const [referenceNumber, setReferenceNumber] = useState("");
  const [notes, setNotes] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const remainingAmount = useMemo(() => {
    return Number(bill?.remaining_amount || 0);
  }, [bill]);

  if (!bill) return null;

  const handleSubmit = async () => {
    try {
      setErrorMessage("");

      const parsed = vendorPaymentSchema.safeParse({
        payment_date: paymentDate,
        amount,
        payment_mode: paymentMode,
        reference_number: referenceNumber,
        notes,
      });

      if (!parsed.success) {
        setErrorMessage(parsed.error.issues[0]?.message || "Invalid payment");
        return;
      }

      setIsSaving(true);

      await vendorsApi.addBillPayment(bill.id, {
        payment_date: parsed.data.payment_date,
        amount: parsed.data.amount,
        payment_mode: parsed.data.payment_mode,
        reference_number: parsed.data.reference_number,
        notes: parsed.data.notes,
      });

      onSuccess();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Unable to add payment"
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#111216]/40 dark:bg-black/60 px-4 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 18 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="w-full max-w-[520px] rounded-[28px] bg-white dark:bg-slate-900 p-6 shadow-[0_30px_90px_rgba(17,18,28,0.22)] dark:shadow-[0_30px_90px_rgba(0,0,0,0.5)] border border-transparent dark:border-slate-800"
      >
        {/* Header */}
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#ece9ff] dark:bg-indigo-950 text-[#1d10e8] dark:text-indigo-400">
              <CreditCard size={24} />
            </div>
            <h2 className="text-2xl font-black tracking-[-0.03em] text-[#111216] dark:text-slate-100">
              Add Payment
            </h2>
            <p className="mt-1 text-sm text-[#686b78] dark:text-slate-400">
              Bill {bill.bill_number} has ₹{remainingAmount.toLocaleString("en-IN")} remaining.
            </p>
          </div>

          <button
            onClick={onClose}
            className="rounded-full bg-[#f1f1f4] dark:bg-slate-800 p-2 text-[#171821] dark:text-slate-300 transition hover:bg-[#e8e8ef] dark:hover:bg-slate-700"
          >
            <X size={18} />
          </button>
        </div>

        {/* Error */}
        {errorMessage && (
          <div className="mb-4 rounded-2xl bg-red-50 dark:bg-red-950/60 border border-transparent dark:border-red-900 px-4 py-3 text-sm font-semibold text-red-700 dark:text-red-400">
            {errorMessage}
          </div>
        )}

        {/* Fields */}
        <div className="grid gap-4">
          <label className="space-y-2">
            <span className={labelClass}>Payment Date</span>
            <input
              type="date"
              value={paymentDate}
              onChange={(e) => setPaymentDate(e.target.value)}
              className={inputClass}
            />
          </label>

          <label className="space-y-2">
            <span className={labelClass}>Amount</span>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className={inputClass}
            />
          </label>

          <label className="space-y-2">
            <span className={labelClass}>Payment Mode</span>
            <select
              value={paymentMode}
              onChange={(e) => setPaymentMode(e.target.value)}
              className={inputClass}
            >
              <option value="cash">Cash</option>
              <option value="upi">UPI</option>
              <option value="bank_transfer">Bank Transfer</option>
              <option value="card">Card</option>
              <option value="cheque">Cheque</option>
            </select>
          </label>

          <label className="space-y-2">
            <span className={labelClass}>Reference Number</span>
            <input
              value={referenceNumber}
              onChange={(e) => setReferenceNumber(e.target.value)}
              placeholder="Transaction / cheque reference"
              className={inputClass}
            />
          </label>

          <label className="space-y-2">
            <span className={labelClass}>Notes</span>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional payment note"
              rows={3}
              className="w-full resize-none rounded-2xl bg-[#f4f4f7] dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 px-4 py-3 outline-none transition focus:bg-white dark:focus:bg-slate-700 focus:shadow-[0_0_0_4px_rgba(79,70,229,0.10)] dark:focus:shadow-[0_0_0_4px_rgba(99,102,241,0.15)]"
            />
          </label>
        </div>

        {/* Actions */}
        <div className="mt-6 flex gap-3">
          <button
            onClick={handleSubmit}
            disabled={isSaving}
            className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#4f46e5] to-[#2f20d6] text-sm font-black text-white shadow-[0_16px_36px_rgba(79,70,229,0.22)] transition disabled:opacity-70"
          >
            {isSaving ? <Loader2 size={18} className="animate-spin" /> : <CreditCard size={18} />}
            Save Payment
          </button>

          <button
            onClick={onClose}
            className="h-12 rounded-2xl bg-[#eeeeef] dark:bg-slate-800 px-6 text-sm font-black text-[#111216] dark:text-slate-300 transition hover:bg-[#e5e5e7] dark:hover:bg-slate-700"
          >
            Cancel
          </button>
        </div>
      </motion.div>
    </div>
  );
}