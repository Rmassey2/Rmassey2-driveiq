"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";

const DEPARTURE_REASONS = [
  "pay",
  "home_time",
  "equipment",
  "dispatch",
  "personal",
  "unknown",
  "terminated",
];

export default function ExitInterviewPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [form, setForm] = useState({
    separation_date: new Date().toISOString().split("T")[0],
    departure_reason: "unknown",
    departure_notes: "",
    eligible_for_rehire: false,
    scores: {
      overall: 3,
      pay: 3,
      home_time: 3,
      equipment: 3,
      dispatch: 3,
    },
  });
  const [loading, setLoading] = useState(false);

  function setField(field: string, value: unknown) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  function setScore(dim: string, val: number) {
    setForm((f) => ({
      ...f,
      scores: { ...f.scores, [dim]: val },
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    const res = await fetch(`/api/hired-drivers/${id}/separate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });

    if (res.ok) {
      router.push(`/dashboard/retention/${id}`);
    }
    setLoading(false);
  }

  const inputCls =
    "mt-1 block w-full rounded-lg border border-gray-600 bg-[#0a1628] px-3 py-2 text-sm text-white focus:border-[#c8a951] focus:outline-none";
  const labelCls = "block text-sm font-medium text-gray-300";

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold text-white">Exit Interview</h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Separation Date</label>
            <input
              type="date"
              value={form.separation_date}
              onChange={(e) => setField("separation_date", e.target.value)}
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>Departure Reason</label>
            <select
              value={form.departure_reason}
              onChange={(e) => setField("departure_reason", e.target.value)}
              className={inputCls}
            >
              {DEPARTURE_REASONS.map((r) => (
                <option key={r} value={r}>
                  {r.replace(/_/g, " ")}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className={labelCls}>Departure Notes</label>
          <textarea
            value={form.departure_notes}
            onChange={(e) => setField("departure_notes", e.target.value)}
            rows={3}
            className={inputCls}
          />
        </div>

        <div className="flex items-center gap-3">
          <label className={labelCls}>Eligible for Rehire</label>
          <button
            type="button"
            onClick={() => setField("eligible_for_rehire", !form.eligible_for_rehire)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${
              form.eligible_for_rehire ? "bg-green-600" : "bg-gray-600"
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
                form.eligible_for_rehire ? "translate-x-6" : "translate-x-1"
              }`}
            />
          </button>
          <span className="text-sm text-gray-400">
            {form.eligible_for_rehire ? "Yes" : "No"}
          </span>
        </div>

        {/* Satisfaction scores */}
        <div className="space-y-4 rounded-lg border border-gray-700/50 bg-[#111d33] p-4">
          <h2 className="text-lg font-semibold text-white">Final Satisfaction Scores</h2>
          {(
            [
              ["overall", "Overall Satisfaction"],
              ["pay", "Pay Satisfaction"],
              ["home_time", "Home Time Satisfaction"],
              ["equipment", "Equipment Satisfaction"],
              ["dispatch", "Dispatch Relationship"],
            ] as [string, string][]
          ).map(([key, label]) => (
            <div key={key}>
              <div className="flex items-center justify-between">
                <label className={labelCls}>{label}</label>
                <span className="text-sm font-bold text-[#c8a951]">
                  {form.scores[key as keyof typeof form.scores]}
                </span>
              </div>
              <input
                type="range"
                min={1}
                max={5}
                value={form.scores[key as keyof typeof form.scores]}
                onChange={(e) => setScore(key, Number(e.target.value))}
                className="mt-1 w-full accent-[#c8a951]"
              />
              <div className="flex justify-between text-xs text-gray-500">
                <span>Very Dissatisfied</span>
                <span>Very Satisfied</span>
              </div>
            </div>
          ))}
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-red-700 px-4 py-3 font-semibold text-white disabled:opacity-50"
        >
          {loading ? "Submitting..." : "Submit Exit Interview & Mark Separated"}
        </button>
      </form>
    </div>
  );
}
