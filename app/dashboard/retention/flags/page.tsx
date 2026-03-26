"use client";

import { useEffect, useState, useCallback } from "react";

interface Flag {
  id: string;
  org_id: string;
  driver_id: string;
  trigger_type: string;
  risk_points: number;
  alert_level: string;
  notes: string | null;
  resolved: boolean;
  flagged_at: string;
}

const TRIGGER_DEFAULTS: Record<string, number> = {
  miles_low: 2,
  no_home_time: 3,
  dispatch_complaints: 2,
  pay_discrepancy: 3,
  missed_checkin: 1,
  mentions_competitor: 3,
  equipment_breakdown: 2,
  three_month_mark: 1,
  family_stress: 1,
  wrong_lane: 2,
  pay_satisfaction_low: 2,
};

interface HiredDriverOption {
  id: string;
  full_name: string;
  org_id: string;
}

export default function FlagsPage() {
  const [flags, setFlags] = useState<Flag[]>([]);
  const [driverNames, setDriverNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [drivers, setDrivers] = useState<HiredDriverOption[]>([]);
  const [resolveId, setResolveId] = useState<string | null>(null);
  const [resolveNotes, setResolveNotes] = useState("");

  // Create form
  const [newFlag, setNewFlag] = useState({
    driver_id: "",
    trigger_type: "miles_low",
    risk_points: 2,
    notes: "",
  });

  const fetchData = useCallback(async () => {
    const res = await fetch("/api/retention/flags-list");
    if (res.ok) {
      const json = await res.json();
      const allFlags = (json.flags ?? []) as Flag[];
      // Only show unresolved
      setFlags(allFlags.filter((f) => !f.resolved));

      // Build driver name map from the drivers list
      const driverList = (json.drivers ?? []) as { id: string; full_name: string }[];
      const nameMap: Record<string, string> = {};
      for (const d of driverList) nameMap[d.id] = d.full_name;
      setDriverNames(nameMap);

      // Set drivers for the create form (add a fake org_id since API handles it)
      setDrivers(driverList.map((d) => ({ ...d, org_id: "" })));
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  async function createFlag(e: React.FormEvent) {
    e.preventDefault();
    const driver = drivers.find((d) => d.id === newFlag.driver_id);
    if (!driver) return;

    await fetch("/api/retention/flags", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        org_id: driver.org_id,
        driver_id: newFlag.driver_id,
        trigger_type: newFlag.trigger_type,
        risk_points: newFlag.risk_points,
        alert_level: newFlag.risk_points >= 3 ? "yellow" : "yellow",
        notes: newFlag.notes || null,
      }),
    });

    setShowCreate(false);
    setNewFlag({ driver_id: "", trigger_type: "miles_low", risk_points: 2, notes: "" });
    fetchData();
  }

  async function resolveFlag() {
    if (!resolveId) return;
    await fetch(`/api/retention/flags/${resolveId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        resolved: true,
        resolved_at: new Date().toISOString(),
        resolution_notes: resolveNotes,
      }),
    });
    setResolveId(null);
    setResolveNotes("");
    fetchData();
  }

  const inputCls =
    "mt-1 block w-full rounded-lg border border-gray-600 bg-[#0a1628] px-3 py-2 text-sm text-white focus:border-[#c8a951] focus:outline-none";
  const labelCls = "block text-sm font-medium text-gray-300";

  if (loading) return <p className="text-gray-400">Loading flags...</p>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Retention Flags ({flags.length} open)</h1>
        <button
          onClick={() => setShowCreate(true)}
          className="rounded-lg bg-[#c8a951] px-4 py-2 text-sm font-semibold text-[#0a1628]"
        >
          Create New Flag
        </button>
      </div>

      {/* Flag list */}
      <div className="space-y-2">
        {flags.map((f) => {
          const daysOpen = Math.floor(
            (Date.now() - new Date(f.flagged_at).getTime()) / 86400000
          );
          return (
            <div
              key={f.id}
              className="flex items-center justify-between rounded-lg border border-gray-700/50 bg-[#111d33] p-4"
            >
              <div>
                <span className="text-sm font-medium text-white">
                  {driverNames[f.driver_id] ?? "Unknown"}
                </span>
                <span className="ml-3 text-sm capitalize text-gray-400">
                  {f.trigger_type.replace(/_/g, " ")}
                </span>
                <span className="ml-2 text-xs font-bold text-red-400">+{f.risk_points}</span>
                {f.notes && (
                  <p className="mt-1 text-xs text-gray-500">{f.notes}</p>
                )}
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-gray-500">{daysOpen}d open</span>
                <button
                  onClick={() => setResolveId(f.id)}
                  className="rounded bg-green-900/40 px-3 py-1 text-xs text-green-300 hover:bg-green-900/60"
                >
                  Resolve
                </button>
              </div>
            </div>
          );
        })}
        {flags.length === 0 && (
          <p className="text-center text-gray-500">No open retention flags</p>
        )}
      </div>

      {/* Create modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="w-full max-w-md rounded-xl bg-[#111d33] p-6 shadow-2xl">
            <h2 className="mb-4 text-lg font-bold text-white">Create Retention Flag</h2>
            <form onSubmit={createFlag} className="space-y-4">
              <div>
                <label className={labelCls}>Driver</label>
                <select
                  value={newFlag.driver_id}
                  onChange={(e) => setNewFlag((f) => ({ ...f, driver_id: e.target.value }))}
                  className={inputCls}
                  required
                >
                  <option value="">Select driver...</option>
                  {drivers.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.full_name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelCls}>Trigger Type</label>
                <select
                  value={newFlag.trigger_type}
                  onChange={(e) =>
                    setNewFlag((f) => ({
                      ...f,
                      trigger_type: e.target.value,
                      risk_points: TRIGGER_DEFAULTS[e.target.value] ?? 2,
                    }))
                  }
                  className={inputCls}
                >
                  {Object.keys(TRIGGER_DEFAULTS).map((t) => (
                    <option key={t} value={t}>
                      {t.replace(/_/g, " ")} (+{TRIGGER_DEFAULTS[t]})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelCls}>Risk Points</label>
                <input
                  type="number"
                  value={newFlag.risk_points}
                  onChange={(e) =>
                    setNewFlag((f) => ({ ...f, risk_points: Number(e.target.value) }))
                  }
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Notes</label>
                <textarea
                  value={newFlag.notes}
                  onChange={(e) => setNewFlag((f) => ({ ...f, notes: e.target.value }))}
                  rows={2}
                  className={inputCls}
                />
              </div>
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowCreate(false)}
                  className="rounded-lg px-4 py-2 text-sm text-gray-400"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-[#c8a951] px-4 py-2 text-sm font-semibold text-[#0a1628]"
                >
                  Create Flag
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Resolve modal */}
      {resolveId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="w-full max-w-md rounded-xl bg-[#111d33] p-6 shadow-2xl">
            <h2 className="mb-4 text-lg font-bold text-white">Resolve Flag</h2>
            <label className={labelCls}>Resolution Notes</label>
            <textarea
              value={resolveNotes}
              onChange={(e) => setResolveNotes(e.target.value)}
              rows={3}
              className={inputCls}
            />
            <div className="mt-4 flex justify-end gap-3">
              <button
                onClick={() => setResolveId(null)}
                className="rounded-lg px-4 py-2 text-sm text-gray-400"
              >
                Cancel
              </button>
              <button
                onClick={resolveFlag}
                className="rounded-lg bg-green-700 px-4 py-2 text-sm font-semibold text-white"
              >
                Resolve
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
