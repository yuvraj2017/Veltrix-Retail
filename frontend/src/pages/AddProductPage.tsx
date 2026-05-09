import { useState } from "react";
import type { FormEventHandler, ElementType } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Building2,
  CheckCircle2,
  ClipboardCheck,
  Info,
  Loader2,
  MapPin,
  Save,
  Sparkles,
  UserRound,
} from "lucide-react";

import { vendorsApi } from "../features/vendors/api";
import { vendorSchema } from "../features/vendors/schemas";

export default function AddVendorPage() {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    vendor_name: "",
    company_name: "",
    email: "",
    phone: "",
    alternate_phone: "",
    tax_number: "",
    address_line_1: "",
    address_line_2: "",
    city: "",
    state: "",
    postal_code: "",
    country: "India",
    payment_terms: "Net 15",
    default_reminder_days: 7,
    notes: "",
    is_active: true,
  });

  const [errorMessage, setErrorMessage] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const updateField = (
    field: keyof typeof form,
    value: string | number | boolean
  ) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit: FormEventHandler<HTMLFormElement> = async (event) => {
    event.preventDefault();

    try {
      setErrorMessage("");

      const parsed = vendorSchema.safeParse(form);

      if (!parsed.success) {
        setErrorMessage(
          parsed.error.issues[0]?.message || "Invalid vendor data"
        );
        return;
      }

      setIsSaving(true);

      const created = await vendorsApi.createVendor(parsed.data);
      navigate(`/vendors/${created.id}`);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Unable to save vendor"
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-full text-slate-950">
      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: "easeOut" }}
        className="mx-auto max-w-[1280px]"
      >
        <button
          type="button"
          onClick={() => navigate("/vendors")}
          className="mb-6 inline-flex items-center gap-2 rounded-2xl border border-indigo-100 bg-white/75 px-4 py-2.5 text-sm font-black text-slate-700 shadow-[0_12px_30px_rgba(99,102,241,0.08)] backdrop-blur-xl transition-all duration-300 hover:-translate-y-[1px] hover:text-indigo-700"
        >
          <ArrowLeft size={17} />
          Back to Vendors
        </button>

        <div className="mb-9 flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-indigo-100 bg-white/70 px-4 py-2 text-[11px] font-black uppercase tracking-[0.22em] text-indigo-600 shadow-[0_12px_30px_rgba(99,102,241,0.08)] backdrop-blur-xl">
              <Sparkles size={14} />
              Vendors › Add New Vendor
            </div>

            <h1 className="text-[38px] font-black tracking-[-0.055em] text-slate-950 md:text-[54px]">
              Vendor Onboarding
            </h1>

            <p className="mt-3 max-w-2xl text-[17px] leading-8 text-slate-600">
              Create a new supply partner profile with billing terms, contact
              details, and reminder preferences.
            </p>
          </div>

          <div className="hidden rounded-[28px] bg-white/70 p-4 shadow-[0_18px_48px_rgba(99,102,241,0.08)] backdrop-blur-xl lg:block">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-lg">
                <CheckCircle2 size={22} />
              </div>
              <div>
                <p className="text-sm font-black text-slate-950">
                  Guided setup
                </p>
                <p className="text-xs text-slate-500">
                  Vendor data syncs with bills
                </p>
              </div>
            </div>
          </div>
        </div>

        <form
          onSubmit={handleSubmit}
          className="grid gap-8 xl:grid-cols-[1fr_360px]"
        >
          <div className="rounded-[34px] bg-white/78 p-6 shadow-[0_24px_70px_rgba(15,23,42,0.07)] backdrop-blur-xl md:p-8">
            {errorMessage && (
              <div className="mb-6 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
                {errorMessage}
              </div>
            )}

            <SectionTitle icon={Building2} title="Organization Details" />

            <div className="grid gap-5">
              <Input
                label="Vendor Company Name"
                value={form.vendor_name}
                onChange={(value) => updateField("vendor_name", value)}
                placeholder="e.g. Global Logistics Corp"
              />

              <Input
                label="Display / Business Name"
                value={form.company_name}
                onChange={(value) => updateField("company_name", value)}
                placeholder="Optional business name"
              />

              <div className="grid gap-5 md:grid-cols-2">
                <Input
                  label="Payment Terms"
                  value={form.payment_terms}
                  onChange={(value) => updateField("payment_terms", value)}
                  placeholder="Net 15"
                />

                <Input
                  label="Tax ID / VAT"
                  value={form.tax_number}
                  onChange={(value) => updateField("tax_number", value)}
                  placeholder="GST / VAT number"
                />
              </div>

              <div className="grid gap-5 md:grid-cols-2">
                <Input
                  type="number"
                  label="Default Reminder Days"
                  value={form.default_reminder_days}
                  onChange={(value) =>
                    updateField("default_reminder_days", Number(value))
                  }
                  placeholder="7"
                />

                <label className="space-y-2">
                  <span className="text-[12px] font-black uppercase tracking-[0.18em] text-slate-600">
                    Vendor Status
                  </span>

                  <select
                    value={form.is_active ? "active" : "inactive"}
                    onChange={(event) =>
                      updateField("is_active", event.target.value === "active")
                    }
                    className="h-14 w-full rounded-[20px] border border-indigo-100/80 bg-slate-50/90 px-4 text-[15px] font-semibold text-slate-800 outline-none transition-all duration-300 focus:border-indigo-300 focus:bg-white focus:shadow-[0_0_0_5px_rgba(99,102,241,0.12)]"
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </label>
              </div>
            </div>

            <SoftDivider />

            <SectionTitle icon={UserRound} title="Primary Contact" />

            <div className="grid gap-5">
              <div className="grid gap-5 md:grid-cols-2">
                <Input
                  label="Primary Contact Person"
                  value={form.company_name}
                  onChange={(value) => updateField("company_name", value)}
                  placeholder="Full name of contact"
                />

                <Input
                  label="Email Address"
                  value={form.email}
                  onChange={(value) => updateField("email", value)}
                  placeholder="contact@company.com"
                />
              </div>

              <div className="grid gap-5 md:grid-cols-2">
                <Input
                  label="Phone Number"
                  value={form.phone}
                  onChange={(value) => updateField("phone", value)}
                  placeholder="+91 98765 43210"
                />

                <Input
                  label="Alternate Phone"
                  value={form.alternate_phone}
                  onChange={(value) => updateField("alternate_phone", value)}
                  placeholder="Optional"
                />
              </div>
            </div>

            <SoftDivider />

            <SectionTitle icon={MapPin} title="Logistics & Address" />

            <div className="grid gap-5">
              <Input
                label="Address Line 1"
                value={form.address_line_1}
                onChange={(value) => updateField("address_line_1", value)}
                placeholder="Street / building / area"
              />

              <Input
                label="Address Line 2"
                value={form.address_line_2}
                onChange={(value) => updateField("address_line_2", value)}
                placeholder="Optional"
              />

              <div className="grid gap-5 md:grid-cols-2">
                <Input
                  label="City"
                  value={form.city}
                  onChange={(value) => updateField("city", value)}
                  placeholder="Rajkot"
                />

                <Input
                  label="State"
                  value={form.state}
                  onChange={(value) => updateField("state", value)}
                  placeholder="Gujarat"
                />
              </div>

              <div className="grid gap-5 md:grid-cols-2">
                <Input
                  label="Postal Code"
                  value={form.postal_code}
                  onChange={(value) => updateField("postal_code", value)}
                  placeholder="360001"
                />

                <Input
                  label="Country"
                  value={form.country}
                  onChange={(value) => updateField("country", value)}
                  placeholder="India"
                />
              </div>

              <label className="space-y-2">
                <span className="text-[12px] font-black uppercase tracking-[0.18em] text-slate-600">
                  Notes
                </span>
                <textarea
                  value={form.notes}
                  onChange={(event) => updateField("notes", event.target.value)}
                  rows={4}
                  placeholder="Internal vendor notes"
                  className="w-full resize-none rounded-[20px] border border-indigo-100/80 bg-slate-50/90 px-4 py-3 text-[15px] text-slate-800 outline-none transition-all duration-300 placeholder:text-slate-400 focus:border-indigo-300 focus:bg-white focus:shadow-[0_0_0_5px_rgba(99,102,241,0.12)]"
                />
              </label>
            </div>
          </div>

          <aside className="space-y-6">
            <div className="rounded-[34px] bg-white/78 p-6 shadow-[0_24px_70px_rgba(15,23,42,0.07)] backdrop-blur-xl">
              <p className="mb-5 text-[12px] font-black uppercase tracking-[0.2em] text-slate-500">
                Actions
              </p>

              <motion.button
                whileTap={{ scale: 0.98 }}
                whileHover={{ y: -2 }}
                type="submit"
                disabled={isSaving}
                className="inline-flex h-14 w-full items-center justify-center gap-3 rounded-[22px] bg-gradient-to-r from-[#7c6cff] via-[#5b43f3] to-[#3b2be4] text-sm font-black text-white shadow-[0_20px_48px_rgba(79,70,229,0.30)] transition-all duration-300 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isSaving ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : (
                  <Save size={18} />
                )}
                Save Vendor
              </motion.button>

              <button
                type="button"
                onClick={() => navigate("/vendors")}
                className="mt-3 h-14 w-full rounded-[22px] bg-slate-100 text-sm font-black text-slate-800 transition hover:bg-slate-200"
              >
                Cancel
              </button>

              <p className="mt-6 text-sm leading-6 text-slate-500">
                This vendor will be available for purchase bills, payment
                tracking, and due reminders.
              </p>
            </div>

            <div className="rounded-[28px] border border-indigo-100 bg-indigo-50/80 p-6 text-indigo-950 shadow-[0_18px_40px_rgba(99,102,241,0.08)] backdrop-blur-xl">
              <div className="mb-3 flex items-center gap-2 text-sm font-black text-indigo-700">
                <Info size={18} />
                Pro Tip
              </div>
              <p className="text-sm leading-6">
                Accurate payment terms help Veltrix calculate reminders and
                payable insights more clearly.
              </p>
            </div>

            <div className="relative overflow-hidden rounded-[30px] bg-gradient-to-br from-[#1a087a] via-[#2910a8] to-[#4f46e5] p-7 text-white shadow-[0_28px_70px_rgba(49,46,129,0.28)]">
              <ClipboardCheck size={38} className="mb-20 opacity-85" />

              <p className="text-[11px] font-black uppercase tracking-[0.22em] text-white/70">
                Veltrix Global
              </p>

              <h3 className="mt-2 text-2xl font-black tracking-[-0.04em]">
                Empower reliable partnerships.
              </h3>

              <div className="absolute -right-12 -top-12 h-40 w-40 rounded-full bg-white/18 blur-2xl" />
              <div className="absolute bottom-0 right-0 h-32 w-32 rounded-full bg-violet-300/20 blur-3xl" />
            </div>
          </aside>
        </form>
      </motion.div>
    </div>
  );
}

function SectionTitle({
  icon: Icon,
  title,
}: {
  icon: ElementType;
  title: string;
}) {
  return (
    <div className="mb-6 flex items-center gap-4">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 shadow-[inset_0_0_0_1px_rgba(99,102,241,0.08)]">
        <Icon size={22} />
      </div>

      <h2 className="text-xl font-black tracking-[-0.03em] text-slate-950">
        {title}
      </h2>
    </div>
  );
}

function SoftDivider() {
  return <div className="my-9 h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent" />;
}

function Input({
  label,
  value,
  placeholder,
  onChange,
  type = "text",
}: {
  label: string;
  value: string | number;
  placeholder?: string;
  type?: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="space-y-2">
      <span className="text-[12px] font-black uppercase tracking-[0.18em] text-slate-600">
        {label}
      </span>

      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="h-14 w-full rounded-[20px] border border-indigo-100/80 bg-slate-50/90 px-4 text-[15px] text-slate-800 outline-none transition-all duration-300 placeholder:text-slate-400 focus:-translate-y-[1px] focus:border-indigo-300 focus:bg-white focus:shadow-[0_0_0_5px_rgba(99,102,241,0.12)]"
      />
    </label>
  );
}