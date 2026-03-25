"use client";

import { useState } from "react";

interface Props {
  onClose: () => void;
  onCreated: () => void;
}

export default function AddLeadModal({ onClose, onCreated }: Props) {
  const [form, setForm] = useState({
    full_name: "",
    phone: "",
    email: "",
    zip_code: "",
    cdl_class: "A",
    years_experience: "less_than_2",
    segment_interest: "OTR",
    source: "Walk-In",
    notes: "",
    referral_driver_id: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set(field: string, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const res = await fetch("/api/leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "Failed to create lead");
      setLoading(false);
      return;
    }

    onCreated();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="w-full max-w-lg rounded-xl bg-[#111d33] p-6 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-white">Add Lead</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            &times;
          </button>
        </div>

        {error && (
          <div className="mb-4 rounded bg-red-900/40 px-3 py-2 text-sm text-red-300">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input label="Full Name *" value={form.full_name} onChange={(v) => set("full_name", v)} required />
            <Input label="Phone *" value={form.phone} onChange={(v) => set("phone", v)} required />
            <Input label="Email" value={form.email} onChange={(v) => set("email", v)} />
            <Input label="Zip Code" value={form.zip_code} onChange={(v) => set("zip_code", v)} />

            <Select label="CDL Class" value={form.cdl_class} onChange={(v) => set("cdl_class", v)} options={["A", "B", "C"]} />
            <Select
              label="Years Experience"
              value={form.years_experience}
              onChange={(v) => set("years_experience", v)}
              options={[
                ["less_than_2", "Less than 2"],
                ["2_3", "2-3 years"],
                ["4_5", "4-5 years"],
                ["5_plus", "5+ years"],
              ]}
            />
            <Select
              label="Segment Interest"
              value={form.segment_interest}
              onChange={(v) => set("segment_interest", v)}
              options={["OTR", "Regional", "Local", "Dedicated", "Owner-Op"]}
            />
            <Select
              label="Source"
              value={form.source}
              onChange={(v) => set("source", v)}
              options={["Walk-In", "Phone Call", "Referral", "Other"]}
            />
          </div>

          <Input label="Referral Driver ID" value={form.referral_driver_id} onChange={(v) => set("referral_driver_id", v)} />

          <div>
            <label className="block text-sm font-medium text-gray-300">Notes</label>
            <textarea
              value={form.notes}
              onChange={(e) => set("notes", e.target.value)}
              rows={3}
              className="mt-1 block w-full rounded-lg border border-gray-600 bg-[#0a1628] px-3 py-2 text-sm text-white focus:border-[#c8a951] focus:outline-none"
            />
          </div>

          <div className="flex justify-end gap-3">
            <button type="button" onClick={onClose} className="rounded-lg px-4 py-2 text-sm text-gray-400 hover:text-white">
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="rounded-lg bg-[#c8a951] px-4 py-2 text-sm font-semibold text-[#0a1628] disabled:opacity-50"
            >
              {loading ? "Creating..." : "Add Lead"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Input({
  label,
  value,
  onChange,
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-300">{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        className="mt-1 block w-full rounded-lg border border-gray-600 bg-[#0a1628] px-3 py-2 text-sm text-white focus:border-[#c8a951] focus:outline-none"
      />
    </div>
  );
}

function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: (string | [string, string])[];
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-300">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 block w-full rounded-lg border border-gray-600 bg-[#0a1628] px-3 py-2 text-sm text-white focus:border-[#c8a951] focus:outline-none"
      >
        {options.map((opt) => {
          const [val, lbl] = Array.isArray(opt) ? opt : [opt, opt];
          return (
            <option key={val} value={val}>
              {lbl}
            </option>
          );
        })}
      </select>
    </div>
  );
}
