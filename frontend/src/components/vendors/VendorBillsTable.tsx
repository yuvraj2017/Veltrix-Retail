import { motion } from "framer-motion";
import { CreditCard, Filter, Plus, ReceiptText } from "lucide-react";
import type { VendorBill } from "../../features/vendors/types";
import VendorStatusBadge from "./VendorStatusBadge";

type VendorBillsTableProps = {
  bills: VendorBill[];
  isLoading: boolean;
  onAddBill: () => void;
  onAddPayment: (bill: VendorBill) => void;
};

const money = (value: string | number) => {
  const amount = Number(value || 0);
  return amount.toLocaleString("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  });
};

const formatDate = (date?: string | null) => {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

export default function VendorBillsTable({
  bills,
  isLoading,
  onAddBill,
  onAddPayment,
}: VendorBillsTableProps) {
  return (
    <section className="overflow-hidden rounded-[24px] bg-white shadow-[0_18px_50px_rgba(17,18,28,0.05)]">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4 px-4 py-5 sm:px-6 sm:py-6">
        <div>
          <h2 className="text-xl font-black tracking-[-0.02em] text-[#111216]">
            Bill Ledger
          </h2>
          <p className="mt-1 text-sm text-[#686b78]">
            Track purchase bills, paid amount, balance, and current status.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button className="rounded-xl bg-[#f1f1f4] p-3 text-[#171821] transition hover:bg-[#e8e8ef]">
            <Filter size={18} />
          </button>
          <button
            onClick={onAddBill}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#4f46e5] to-[#2f20d6] px-4 py-3 text-sm font-black text-white shadow-[0_14px_34px_rgba(79,70,229,0.18)]"
          >
            <Plus size={17} />
            Add Bill
          </button>
        </div>
      </div>

      {/* Desktop column headers */}
      <div className="hidden grid-cols-[1fr_1fr_1fr_1fr_1fr_1fr_0.9fr_0.8fr] px-6 py-4 text-[11px] font-black uppercase tracking-[0.18em] text-[#303344] lg:grid">
        <div>Bill No.</div>
        <div>Date</div>
        <div>Due Date</div>
        <div>Total Amount</div>
        <div>Paid</div>
        <div>Balance</div>
        <div>Status</div>
        <div className="text-right">Action</div>
      </div>

      {/* Loading skeleton */}
      {isLoading ? (
        <div className="space-y-3 p-4 sm:p-6">
          {[1, 2, 3, 4].map((item) => (
            <div
              key={item}
              className="h-[76px] animate-pulse rounded-[18px] bg-[#f3f3f6]"
            />
          ))}
        </div>
      ) : bills.length === 0 ? (
        /* Empty state */
        <div className="flex flex-col items-center justify-center px-4 py-14 text-center sm:px-6">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-[20px] bg-[#ece9ff] text-[#1d10e8]">
            <ReceiptText size={30} />
          </div>
          <h3 className="text-lg font-black text-[#111216]">
            No bills added yet
          </h3>
          <p className="mt-2 max-w-md text-sm leading-6 text-[#686b78]">
            Add your first vendor bill to start tracking due amount and payment
            reminders.
          </p>
          <button
            onClick={onAddBill}
            className="mt-6 rounded-xl bg-gradient-to-r from-[#4f46e5] to-[#2f20d6] px-5 py-3 text-sm font-black text-white"
          >
            Add Bill
          </button>
        </div>
      ) : (
        <div>
          {bills.map((bill, index) => (
            <motion.div
              key={bill.id}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.04 }}
              className={`transition hover:bg-[#f7f7fb] ${
                bill.status === "overdue" ? "bg-red-50/40" : ""
              }`}
            >
              {/* ── Desktop row (lg+) ── */}
              <div className="hidden grid-cols-[1fr_1fr_1fr_1fr_1fr_1fr_0.9fr_0.8fr] items-center gap-4 px-6 py-5 text-sm lg:grid">
                <div className="font-black text-[#111216]">{bill.bill_number}</div>
                <div className="text-[#343747]">{formatDate(bill.bill_date)}</div>
                <div
                  className={`font-semibold ${
                    bill.status === "overdue" ? "text-red-600" : "text-[#343747]"
                  }`}
                >
                  {formatDate(bill.due_date)}
                </div>
                <div className="font-black text-[#111216]">
                  {money(bill.total_amount)}
                </div>
                <div className="text-[#343747]">{money(bill.paid_amount)}</div>
                <div className="font-black text-[#1500d8]">
                  {money(bill.remaining_amount)}
                </div>
                <div>
                  <VendorStatusBadge status={bill.status} />
                </div>
                <div className="flex justify-end">
                  <button
                    onClick={() => onAddPayment(bill)}
                    className="inline-flex items-center gap-2 rounded-xl bg-[#f1f1f4] px-3 py-2 text-xs font-black text-[#171821] transition hover:bg-[#e8e8ef]"
                  >
                    <CreditCard size={15} />
                    Pay
                  </button>
                </div>
              </div>

              {/* ── Mobile / Tablet card (< lg) ── */}
              <div className="flex flex-col gap-3 px-4 py-4 text-sm sm:px-6 lg:hidden">
                {/* Card top row: bill number + status + pay button */}
                <div className="flex items-center justify-between gap-2">
                  <span className="text-base font-black text-[#111216]">
                    {bill.bill_number}
                  </span>
                  <div className="flex items-center gap-2">
                    <VendorStatusBadge status={bill.status} />
                    <button
                      onClick={() => onAddPayment(bill)}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-[#f1f1f4] px-3 py-2 text-xs font-black text-[#171821] transition hover:bg-[#e8e8ef]"
                    >
                      <CreditCard size={14} />
                      Pay
                    </button>
                  </div>
                </div>

                {/* Key-value grid */}
                <div className="grid grid-cols-2 gap-x-4 gap-y-2 rounded-[14px] bg-[#f7f7fb] px-4 py-3 sm:grid-cols-3">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-[#686b78]">
                      Date
                    </p>
                    <p className="mt-0.5 font-semibold text-[#343747]">
                      {formatDate(bill.bill_date)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-[#686b78]">
                      Due Date
                    </p>
                    <p
                      className={`mt-0.5 font-semibold ${
                        bill.status === "overdue"
                          ? "text-red-600"
                          : "text-[#343747]"
                      }`}
                    >
                      {formatDate(bill.due_date)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-[#686b78]">
                      Total
                    </p>
                    <p className="mt-0.5 font-black text-[#111216]">
                      {money(bill.total_amount)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-[#686b78]">
                      Paid
                    </p>
                    <p className="mt-0.5 text-[#343747]">
                      {money(bill.paid_amount)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-[#686b78]">
                      Balance
                    </p>
                    <p className="mt-0.5 font-black text-[#1500d8]">
                      {money(bill.remaining_amount)}
                    </p>
                  </div>
                </div>
              </div>

              {/* Divider between cards */}
              <div className="mx-4 border-b border-[#f1f1f4] sm:mx-6 lg:hidden" />
            </motion.div>
          ))}
        </div>
      )}
    </section>
  );
}