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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#111216]/40 px-4 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 18 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="w-full max-w-[520px] rounded-[28px] bg-white p-6 shadow-[0_30px_90px_rgba(17,18,28,0.22)]"
      >
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#ece9ff] text-[#1d10e8]">
              <CreditCard size={24} />
            </div>
            <h2 className="text-2xl font-black tracking-[-0.03em] text-[#111216]">
              Add Payment
            </h2>
            <p className="mt-1 text-sm text-[#686b78]">
              Bill {bill.bill_number} has ₹{remainingAmount.toLocaleString("en-IN")} remaining.
            </p>
          </div>

          <button
            onClick={onClose}
            className="rounded-full bg-[#f1f1f4] p-2 text-[#171821]"
          >
            <X size={18} />
          </button>
        </div>

        {errorMessage && (
          <div className="mb-4 rounded-2xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
            {errorMessage}
          </div>
        )}

        <div className="grid gap-4">
          <label className="space-y-2">
            <span className="text-[12px] font-black uppercase tracking-[0.18em] text-[#343747]">
              Payment Date
            </span>
            <input
              type="date"
              value={paymentDate}
              onChange={(event) => setPaymentDate(event.target.value)}
              className="h-12 w-full rounded-2xl bg-[#f4f4f7] px-4 outline-none focus:bg-white focus:shadow-[0_0_0_4px_rgba(79,70,229,0.10)]"
            />
          </label>

          <label className="space-y-2">
            <span className="text-[12px] font-black uppercase tracking-[0.18em] text-[#343747]">
              Amount
            </span>
            <input
              type="number"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              placeholder="0.00"
              className="h-12 w-full rounded-2xl bg-[#f4f4f7] px-4 outline-none focus:bg-white focus:shadow-[0_0_0_4px_rgba(79,70,229,0.10)]"
            />
          </label>

          <label className="space-y-2">
            <span className="text-[12px] font-black uppercase tracking-[0.18em] text-[#343747]">
              Payment Mode
            </span>
            <select
              value={paymentMode}
              onChange={(event) => setPaymentMode(event.target.value)}
              className="h-12 w-full rounded-2xl bg-[#f4f4f7] px-4 outline-none focus:bg-white focus:shadow-[0_0_0_4px_rgba(79,70,229,0.10)]"
            >
              <option value="cash">Cash</option>
              <option value="upi">UPI</option>
              <option value="bank_transfer">Bank Transfer</option>
              <option value="card">Card</option>
              <option value="cheque">Cheque</option>
            </select>
          </label>

          <label className="space-y-2">
            <span className="text-[12px] font-black uppercase tracking-[0.18em] text-[#343747]">
              Reference Number
            </span>
            <input
              value={referenceNumber}
              onChange={(event) => setReferenceNumber(event.target.value)}
              placeholder="Transaction / cheque reference"
              className="h-12 w-full rounded-2xl bg-[#f4f4f7] px-4 outline-none focus:bg-white focus:shadow-[0_0_0_4px_rgba(79,70,229,0.10)]"
            />
          </label>

          <label className="space-y-2">
            <span className="text-[12px] font-black uppercase tracking-[0.18em] text-[#343747]">
              Notes
            </span>
            <textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Optional payment note"
              rows={3}
              className="w-full resize-none rounded-2xl bg-[#f4f4f7] px-4 py-3 outline-none focus:bg-white focus:shadow-[0_0_0_4px_rgba(79,70,229,0.10)]"
            />
          </label>
        </div>

        <div className="mt-6 flex gap-3">
          <button
            onClick={handleSubmit}
            disabled={isSaving}
            className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#4f46e5] to-[#2f20d6] text-sm font-black text-white shadow-[0_16px_36px_rgba(79,70,229,0.22)] disabled:opacity-70"
          >
            {isSaving ? <Loader2 size={18} className="animate-spin" /> : <CreditCard size={18} />}
            Save Payment
          </button>

          <button
            onClick={onClose}
            className="h-12 rounded-2xl bg-[#eeeeef] px-6 text-sm font-black text-[#111216]"
          >
            Cancel
          </button>
        </div>
      </motion.div>
    </div>
  );
}