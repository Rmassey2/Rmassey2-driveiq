"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";

const TRIGGER_TYPES = [
  "miles_low",
  "no_home_time",
  "dispatch_complaints",
  "pay_discrepancy",
  "missed_checkin",
  "mentions_competitor",
  "equipment_breakdown",
  "three_month_mark",
  "family_stress",
  "wrong_lane",
  "pay_satisfaction_low",
];

interface CheckinData {
  id: string;
  org_id: string;
  driver_id: string;
  checkin_type: string;
  scheduled_at: string;
  completed_at: string | null;
  score_overall: number | null;
  score_pay: number | null;
  score_home_time: number | null;
  score_equipment: number | null;
  score_dispatch: number | null;
  notes: string | null;
  flags_raised: string[] | null;
  missed: boolean | null;
}

export default function CheckinFormPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [checkin, setCheckin] = useState<CheckinData | null>(null);
  const [driverName, setDriverName] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [scores, setScores] = useState({
    score_overall: 3,
    score_pay: 3,
    score_home_time: 3,
    score_equipment: 3,
    score_dispatch: 3,
  });
  const [notes, setNotes] = useState("");
  const [flagsRaised, setFlagsRaised] = useState<string[]>([]);
  const [missed, setMissed] = useState(false);

  const fetchCheckin = useCallback(async () => {
    const res = await fetch(`/api/checkins/${id}`);
    if (res.ok) {
      const data = await res.json();
      setCheckin(data);

      // Fetch driver name
      const dRes = await fetch(`/api/hired-drivers/${data.driver_id}`);
      if (dRes.ok) {
        const hd = await dRes.json();
        if (hd.lead_id) {
          const lRes = await fetch(`/api/leads/${hd.lead_id}`);
          if (lRes.ok) {
            const lead = await lRes.json();
            setDriverName(lead.full_name ?? "");
          }
        }
      }
    }
    setLoading(false);
  }, [id]);

  useEffect(() => {
    fetchCheckin();
  }, [fetchCheckin]);

  function toggleFlag(flag: string) {
    setFlagsRaised((prev) =>
      prev.includes(flag) ? prev.filter((f) => f !== flag) : [...prev, flag]
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    await fetch(`/api/checkins/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        completed_at: missed ? null : new Date().toISOString(),
        missed,
        ...scores,
        notes,
        flags_raised: flagsRaised.length > 0 ? flagsRaised : null,
      }),
    });

    router.push("/dashboard/retention/checkins");
  }

  const inputCls =
    "mt-1 block w-full rounded-lg border border-gray-600 bg-[#0a1628] px-3 py-2 text-sm text-white focus:border-[#c8a951] focus:outline-none";
  const labelCls = "block text-sm font-medium text-gray-300";

  if (loading) return <p className="text-gray-400">Loading...</p>;
  if (!checkin) return <p className="text-red-400">Check-in not found</p>;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">
          {checkin.checkin_type.replace(/_/g, " ").toUpperCase()} Check-in
        </h1>
        <p className="mt-1 text-gray-400">
          {driverName} &middot; Scheduled: {new Date(checkin.scheduled_at).toLocaleDateString()}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Satisfaction sliders */}
        <div className="space-y-4 rounded-lg border border-gray-700/50 bg-[#111d33] p-4">
          <h2 className="text-lg font-semibold text-white">Satisfaction Scores</h2>
          {(
            [
              ["score_overall", "Overall Satisfaction"],
              ["score_pay", "Pay Satisfaction"],
              ["score_home_time", "Home Time Satisfaction"],
              ["score_equipment", "Equipment Satisfaction"],
              ["score_dispatch", "Dispatch Relationship"],
            ] as [keyof typeof scores, string][]
          ).map(([key, label]) => (
            <div key={key}>
              <div className="flex items-center justify-between">
                <label className={labelCls}>{label}</label>
                <span className="text-sm font-bold text-[#c8a951]">{scores[key]}</span>
              </div>
              <input
                type="range"
                min={1}
                max={5}
                value={scores[key]}
                onChange={(e) =>
                  setScores((s) => ({ ...s, [key]: Number(e.target.value) }))
                }
                className="mt-1 w-full accent-[#c8a951]"
              />
              <div className="flex justify-between text-xs text-gray-500">
                <span>1 — Very Dissatisfied</span>
                <span>5 — Very Satisfied</span>
              </div>
            </div>
          ))}
        </div>

        {/* Notes */}
        <div>
          <label className={labelCls}>Notes</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            className={inputCls}
          />
        </div>

        {/* Flags raised */}
        <div className="space-y-2">
          <label className={labelCls}>Flags Raised</label>
          <div className="flex flex-wrap gap-2">
            {TRIGGER_TYPES.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => toggleFlag(t)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                  flagsRaised.includes(t)
                    ? "bg-red-700 text-white"
                    : "bg-white/10 text-gray-400 hover:bg-white/20"
                }`}
              >
                {t.replace(/_/g, " ")}
              </button>
            ))}
          </div>
        </div>

        {/* Missed */}
        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            checked={missed}
            onChange={(e) => setMissed(e.target.checked)}
            className="h-4 w-4 accent-[#c8a951]"
          />
          <label className="text-sm text-gray-300">Mark as Missed</label>
        </div>

        <button
          type="submit"
          disabled={saving}
          className="w-full rounded-lg bg-[#c8a951] px-4 py-3 font-semibold text-[#0a1628] disabled:opacity-50"
        >
          {saving ? "Saving..." : "Submit Check-in"}
        </button>
      </form>
    </div>
  );
}
