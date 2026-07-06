import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { CreditCard, X, Check, Banknote, Smartphone, Building2, FileText } from "lucide-react";
import { vendorsApi } from "../../features/vendors/api";
import type { VendorBill } from "../../features/vendors/types";
import { vendorPaymentSchema } from "../../features/vendors/schemas";

type AddPaymentModalProps = {
  bill: VendorBill | null;
  onClose: () => void;
  onSuccess: () => void;
};

const PAYMENT_MODES = [
  { value: "cash", label: "Cash", icon: Banknote },
  { value: "upi", label: "UPI", icon: Smartphone },
  { value: "bank_transfer", label: "Bank", icon: Building2 },
  { value: "card", label: "Card", icon: CreditCard },
  { value: "cheque", label: "Cheque", icon: FileText },
];

const today = new Date().toISOString().slice(0, 10);

export default function AddPaymentModal({ bill, onClose, onSuccess }: AddPaymentModalProps) {
  const [paymentDate, setPaymentDate] = useState(today);
  const [amount, setAmount] = useState("");
  const [paymentMode, setPaymentMode] = useState("cash");
  const [referenceNumber, setReferenceNumber] = useState("");
  const [notes, setNotes] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const remainingAmount = useMemo(() => Number(bill?.remaining_amount || 0), [bill]);

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
      setErrorMessage(error instanceof Error ? error.message : "Unable to add payment");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 dark:bg-black/50 px-4">
      <style>{`
        input[data-hide-number-spinner='true']::-webkit-inner-spin-button,
        input[data-hide-number-spinner='true']::-webkit-outer-spin-button {
          -webkit-appearance: none;
          margin: 0;
        }

        input[data-hide-number-spinner='true'] {
          -moz-appearance: textfield;
          appearance: textfield;
        }
      `}</style>

      <motion.div
        initial={{ opacity: 0, y: 16, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 8, scale: 0.98 }}
        transition={{ duration: 0.18, ease: "easeOut" }}
        className="w-full max-w-[440px] rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700"
      >
        {/* Header */}
        <div className="px-6 pt-6">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2.5">
              <CreditCard size={18} className="text-gray-400 dark:text-gray-500" />
              <span className="text-[15px] font-medium text-gray-900 dark:text-gray-100">
                Add payment
              </span>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 transition-colors p-0.5"
            >
              <X size={18} />
            </button>
          </div>

          {/* Bill summary */}
          <div className="flex items-center justify-between bg-gray-50 dark:bg-gray-800 rounded-xl px-4 py-3.5 mb-6">
            <div>
              <p className="text-[11px] text-gray-400 dark:text-gray-500 tracking-wide mb-0.5">
                Bill {bill.bill_number}
              </p>
              <p className="text-[22px] font-medium text-gray-900 dark:text-gray-100 leading-none">
                ₹{remainingAmount.toLocaleString("en-IN")}
              </p>
            </div>
            <span className="text-[12px] font-medium text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950 px-3 py-1 rounded-full">
              Pending
            </span>
          </div>
        </div>

        {/* Form */}
        <div className="px-6 grid gap-4">
          {errorMessage && (
            <div className="text-[13px] text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950 rounded-xl px-4 py-2.5">
              {errorMessage}
            </div>
          )}

          {/* Date + Amount */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[12px] text-gray-500 dark:text-gray-400 block mb-1.5">Date</label>
              <input
                type="date"
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
                className="h-9 w-full rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 px-3 text-[13px] text-gray-900 dark:text-gray-100 outline-none focus:border-gray-400 dark:focus:border-gray-500 focus:bg-white dark:focus:bg-gray-750 transition"
              />
            </div>
            <div>
              <label className="text-[12px] text-gray-500 dark:text-gray-400 block mb-1.5">Amount (₹)</label>
              <input
                type="number"
                data-hide-number-spinner="true"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="h-9 w-full rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 px-3 text-[13px] text-gray-900 dark:text-gray-100 placeholder-gray-300 dark:placeholder-gray-600 outline-none focus:border-gray-400 dark:focus:border-gray-500 focus:bg-white dark:focus:bg-gray-750 transition"
              />
            </div>
          </div>

          {/* Payment mode */}
          <div>
            <label className="text-[12px] text-gray-500 dark:text-gray-400 block mb-2">Payment mode</label>
            <div className="grid grid-cols-5 gap-1.5">
              {PAYMENT_MODES.map(({ value, label, icon: Icon }) => (
                <button
                  key={value}
                  onClick={() => setPaymentMode(value)}
                  className={`flex flex-col items-center gap-1 py-2.5 rounded-lg text-[11px] font-medium border transition-all ${
                    paymentMode === value
                      ? "bg-gray-100 dark:bg-gray-700 border-gray-300 dark:border-gray-500 text-gray-900 dark:text-gray-100"
                      : "bg-transparent border-gray-100 dark:border-gray-800 text-gray-400 dark:text-gray-600 hover:border-gray-200 dark:hover:border-gray-600 hover:text-gray-600 dark:hover:text-gray-400"
                  }`}
                >
                  <Icon size={17} />
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Reference */}
          <div>
            <label className="text-[12px] text-gray-500 dark:text-gray-400 block mb-1.5">Reference number</label>
            <input
              type="text"
              value={referenceNumber}
              onChange={(e) => setReferenceNumber(e.target.value)}
              placeholder="Transaction / cheque ref"
              className="h-9 w-full rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 px-3 text-[13px] text-gray-900 dark:text-gray-100 placeholder-gray-300 dark:placeholder-gray-600 outline-none focus:border-gray-400 dark:focus:border-gray-500 focus:bg-white dark:focus:bg-gray-750 transition"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="text-[12px] text-gray-500 dark:text-gray-400 block mb-1.5">
              Notes{" "}
              <span className="text-gray-300 dark:text-gray-600 text-[11px]">optional</span>
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add a note…"
              rows={2}
              className="w-full rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 px-3 py-2 text-[13px] text-gray-900 dark:text-gray-100 placeholder-gray-300 dark:placeholder-gray-600 outline-none focus:border-gray-400 dark:focus:border-gray-500 focus:bg-white dark:focus:bg-gray-750 transition resize-none"
            />
          </div>
        </div>

        {/* Actions */}
        <div className="px-6 py-5 mt-2 flex gap-2.5 border-t border-gray-100 dark:border-gray-800">
          <button
            onClick={handleSubmit}
            disabled={isSaving}
            className="flex-1 h-9 rounded-lg bg-[#742DFC] dark:bg-gray-100 text-white dark:text-gray-900 text-[13px] font-medium flex items-center justify-center gap-2 hover:bg-gray-800 dark:hover:bg-gray-200 transition disabled:opacity-50"
          >
            {isSaving ? (
              <span className="h-4 w-4 border-2 border-white/30 dark:border-gray-900/30 border-t-white dark:border-t-gray-900 rounded-full animate-spin" />
            ) : (
              <Check size={15} />
            )}
            Save payment
          </button>
          <button
            onClick={onClose}
            className="h-9 px-4 rounded-lg text-[13px] text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition"
          >
            Cancel
          </button>
        </div>
      </motion.div>
    </div>
  );
}
