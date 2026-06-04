import type { VendorBillStatus } from "../../features/vendors/types";

type VendorStatusBadgeProps = {
  status: VendorBillStatus | string;
};

export default function VendorStatusBadge({ status }: VendorStatusBadgeProps) {
  const normalized = status.toLowerCase();

  const styles: Record<string, string> = {
    pending:   "bg-orange-100 dark:bg-orange-950 text-orange-700 dark:text-orange-400 shadow-[inset_0_0_0_1px_rgba(234,88,12,0.16)] dark:shadow-[inset_0_0_0_1px_rgba(234,88,12,0.25)]",
    partial:   "bg-violet-100 dark:bg-violet-950 text-violet-700 dark:text-violet-400 shadow-[inset_0_0_0_1px_rgba(124,58,237,0.16)] dark:shadow-[inset_0_0_0_1px_rgba(124,58,237,0.25)]",
    completed: "bg-slate-100  dark:bg-slate-800  text-slate-600  dark:text-slate-400  shadow-[inset_0_0_0_1px_rgba(71,85,105,0.12)]  dark:shadow-[inset_0_0_0_1px_rgba(71,85,105,0.30)]",
    overdue:   "bg-red-100    dark:bg-red-950    text-red-700    dark:text-red-400    shadow-[inset_0_0_0_1px_rgba(220,38,38,0.16)]  dark:shadow-[inset_0_0_0_1px_rgba(220,38,38,0.25)]",
  };

  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-black capitalize ${
        styles[normalized] || styles.pending
      }`}
    >
      {normalized}
    </span>
  );
}