import type { VendorBillStatus } from "../../features/vendors/types";

type VendorStatusBadgeProps = {
  status: VendorBillStatus | string;
};

export default function VendorStatusBadge({ status }: VendorStatusBadgeProps) {
  const normalized = status.toLowerCase();

  const styles: Record<string, string> = {
    pending: "bg-orange-100 text-orange-700 shadow-[inset_0_0_0_1px_rgba(234,88,12,0.16)]",
    partial: "bg-violet-100 text-violet-700 shadow-[inset_0_0_0_1px_rgba(124,58,237,0.16)]",
    completed: "bg-slate-100 text-slate-600 shadow-[inset_0_0_0_1px_rgba(71,85,105,0.12)]",
    overdue: "bg-red-100 text-red-700 shadow-[inset_0_0_0_1px_rgba(220,38,38,0.16)]",
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