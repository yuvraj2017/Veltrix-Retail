import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { CreditCard, Loader2, ReceiptText, X } from "lucide-react";
import { vendorsApi } from "../../features/vendors/api";
import type { VendorBill, VendorBillPayment } from "../../features/vendors/types";

type BillPaymentHistoryModalProps = {
  bill: VendorBill | null;
  onClose: () => void;
};

const money = (value: string | number) => {
  const amount = Number(value || 0);
  return amount.toLocaleString("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  });
};

const formatDate = (value?: string | null) => {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const formatDateTime = (value?: string | null) => {
  if (!value) return "-";
  return new Date(value).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export default function BillPaymentHistoryModal({
  bill,
  onClose,
}: BillPaymentHistoryModalProps) {
  const [payments, setPayments] = useState<VendorBillPayment[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const totalRecorded = useMemo(() => {
    return payments.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  }, [payments]);

  useEffect(() => {
    if (!bill) {
      setPayments([]);
      setErrorMessage("");
      return;
    }

    const loadPayments = async () => {
      try {
        setIsLoading(true);
        setErrorMessage("");
        const data = await vendorsApi.getBillPayments(bill.id);
        setPayments(data);
      } catch (error) {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Unable to load payment history"
        );
      } finally {
        setIsLoading(false);
      }
    };

    loadPayments();
  }, [bill]);

  if (!bill) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4 dark:bg-black/50">
      <motion.div
        initial={{ opacity: 0, y: 12, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 8, scale: 0.98 }}
        transition={{ duration: 0.18 }}
        className="w-full max-w-[820px] overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900"
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400">
              <ReceiptText size={19} />
            </div>

            <div>
              <h2 className="text-lg font-black tracking-[-0.02em] text-slate-950 dark:text-white">
                Payment History
              </h2>
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                Bill {bill.bill_number}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-400 transition hover:text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-500 dark:hover:text-slate-300"
          >
            <X size={17} />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3 border-b border-slate-100 bg-slate-50 px-5 py-4 dark:border-slate-800 dark:bg-slate-800/50 md:grid-cols-4">
          <SummaryCard label="Bill Amount" value={money(bill.total_amount)} />
          <SummaryCard label="Paid" value={money(bill.paid_amount)} />
          <SummaryCard label="History" value={money(totalRecorded)} />
          <SummaryCard
            label="Balance"
            value={money(bill.remaining_amount)}
            highlight
          />
        </div>

        <div className="max-h-[460px] overflow-y-auto p-5">
          {isLoading ? (
            <div className="flex min-h-[180px] items-center justify-center">
              <Loader2 size={26} className="animate-spin text-indigo-600" />
            </div>
          ) : errorMessage ? (
            <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 dark:border-red-900/50 dark:bg-red-950/50 dark:text-red-400">
              {errorMessage}
            </div>
          ) : payments.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-5 py-10 text-center dark:border-slate-700 dark:bg-slate-800/50">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400">
                <CreditCard size={22} />
              </div>

              <h3 className="text-base font-black text-slate-950 dark:text-white">
                No payment history yet
              </h3>

              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Payments added for this bill will appear here.
              </p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-700">
              <div className="hidden grid-cols-[1.1fr_1fr_1fr_1.4fr] bg-slate-50 px-4 py-3 text-xs font-black uppercase tracking-[0.12em] text-slate-400 dark:bg-slate-800 dark:text-slate-500 md:grid">
                <div>Amount</div>
                <div>Date</div>
                <div>Mode</div>
                <div>Reference / Notes</div>
              </div>

              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {payments.map((payment, index) => (
                  <motion.div
                    key={payment.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.03, duration: 0.18 }}
                    className="grid gap-3 bg-white px-4 py-3 dark:bg-slate-900 md:grid-cols-[1.1fr_1fr_1fr_1.4fr] md:items-center"
                  >
                    <div>
                      <p className="text-sm font-black text-slate-950 dark:text-white">
                        {money(payment.amount)}
                      </p>
                      <p className="mt-0.5 text-[11px] font-semibold text-slate-400 md:hidden">
                        Amount
                      </p>
                    </div>

                    <div>
                      <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">
                        {formatDate(payment.payment_date)}
                      </p>
                      <p className="mt-0.5 text-[11px] font-semibold text-slate-400 md:hidden">
                        Date
                      </p>
                    </div>

                    <div>
                      <span className="inline-flex rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold capitalize text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400">
                        {(payment.payment_mode || "manual").replaceAll("_", " ")}
                      </span>
                    </div>

                    <div>
                      <p className="break-words text-sm font-semibold text-slate-700 dark:text-slate-300">
                        {payment.reference_number || "-"}
                      </p>

                      <p className="mt-0.5 line-clamp-1 text-xs text-slate-500 dark:text-slate-400">
                        {payment.notes || "No notes"}
                      </p>

                      <p className="mt-1 text-[11px] font-medium text-slate-400 dark:text-slate-500">
                        {formatDateTime(payment.created_at)}
                      </p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border px-3 py-2.5 ${
        highlight
          ? "border-indigo-100 bg-indigo-50 dark:border-indigo-900/50 dark:bg-indigo-950/40"
          : "border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900"
      }`}
    >
      <p
        className={`text-[10px] font-black uppercase tracking-[0.14em] ${
          highlight
            ? "text-indigo-500 dark:text-indigo-400"
            : "text-slate-400 dark:text-slate-500"
        }`}
      >
        {label}
      </p>

      <p
        className={`mt-1 truncate text-sm font-black ${
          highlight
            ? "text-indigo-700 dark:text-indigo-300"
            : "text-slate-950 dark:text-white"
        }`}
      >
        {value}
      </p>
    </div>
  );
}