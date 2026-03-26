"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";

interface HiredDriver {
  id: string;
  org_id: string;
  lead_id: string | null;
  hire_date: string;
  segment: string | null;
  assigned_dm_id: string | null;
  truck_number: string | null;
  status: string;
  retention_risk_score: number;
  active_flags: string[] | null;
  separation_date: string | null;
  departure_reason: string | null;
  departure_notes: string | null;
  eligible_for_rehire: boolean | null;
}

interface Checkin {
  id: string;
  checkin_type: string;
  scheduled_at: string;
  completed_at: string | null;
  score_overall: number | null;
  score_pay: number | null;
  score_home_time: number | null;
  score_equipment: number | null;
  score_dispatch: number | null;
  notes: string | null;
  missed: boolean | null;
}

interface Flag {
  id: string;
  trigger_type: string;
  risk_points: number;
  alert_level: string;
  notes: string | null;
  resolved: boolean;
  flagged_at: string;
}

export default function RetentionDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [driver, setDriver] = useState<HiredDriver | null>(null);
  const [leadName, setLeadName] = useState("");
  const [leadPhone, setLeadPhone] = useState("");
  const [checkins, setCheckins] = useState<Checkin[]>([]);
  const [flags, setFlags] = useState<Flag[]>([]);
  const [loading, setLoading] = useState(true);
  const [resolveId, setResolveId] = useState<string | null>(null);
  const [resolveNotes, setResolveNotes] = useState("");

  const fetchAll = useCallback(async () => {
    const [dRes, cRes, fRes] = await Promise.all([
      fetch(`/api/hired-drivers/${id}`),
      fetch(`/api/checkins?driver_id=${id}`),
      fetch(`/api/retention/flags?driver_id=${id}`),
    ]);

    if (dRes.ok) {
      const d = await dRes.json();
      setDriver(d);
      if (d.lead_id) {
        const lRes = await fetch(`/api/leads/${d.lead_id}`);
        if (lRes.ok) {
          const lead = await lRes.json();
          setLeadName(lead.full_name ?? "");
          setLeadPhone(lead.phone ?? "");
        }
      }
    }
    if (cRes.ok) setCheckins(await cRes.json());
    if (fRes.ok) setFlags(await fRes.json());
    setLoading(false);
  }, [id]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

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
    fetchAll();
  }

  const inputCls = "mt-1 block w-full rounded-lg border border-gray-600 bg-[#0a1628] px-3 py-2 text-sm text-white focus:border-[#c8a951] focus:outline-none";

  if (loading) return <p className="text-gray-400">Loading...</p>;
  if (!driver) return <p className="text-red-400">Driver not found</p>;

  const daysEmployed = driver.hire_date
    ? Math.floor((Date.now() - new Date(driver.hire_date).getTime()) / 86400000)
    : 0;

  const riskColor =
    driver.retention_risk_score >= 8
      ? "text-red-400"
      : driver.retention_risk_score >= 6
      ? "text-yellow-400"
      : "text-green-400";

  const openFlags = flags.filter((f) => !f.resolved);
  const completedCheckins = checkins.filter((c) => c.completed_at);

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">{leadName || "Driver"}</h1>
          <p className="mt-1 text-gray-400">
            {leadPhone} &middot; {driver.segment ?? "—"} &middot; Hired {new Date(driver.hire_date).toLocaleDateString()}
            &middot; {daysEmployed} days
          </p>
          {driver.truck_number && (
            <p className="text-sm text-gray-500">Truck: {driver.truck_number}</p>
          )}
        </div>
        <div className="text-center">
          <div className={`text-5xl font-bold ${riskColor}`}>{driver.retention_risk_score}</div>
          <div className="text-xs text-gray-500">Risk Score</div>
        </div>
      </div>

      {/* Stats bar */}
      <div className="flex gap-6 rounded-lg border border-gray-700/50 bg-[#111d33] p-4">
        <Stat label="Status" value={driver.status} />
        <Stat label="Active Flags" value={String(driver.active_flags?.length ?? 0)} />
        <Stat label="Check-ins Done" value={String(completedCheckins.length)} />
        <Stat label="Days Employed" value={String(daysEmployed)} />
      </div>

      {/* Quick actions */}
      <div className="flex gap-3">
        <Link
          href={`/dashboard/retention/${id}/exit-interview`}
          className="rounded-lg bg-red-900/40 px-4 py-2 text-sm text-red-300 hover:bg-red-900/60"
        >
          Mark Separated
        </Link>
        <button
          onClick={() => router.push("/dashboard/retention/flags")}
          className="rounded-lg bg-white/10 px-4 py-2 text-sm text-white hover:bg-white/20"
        >
          Add Retention Flag
        </button>
        <Link
          href="/dashboard/retention/checkins"
          className="rounded-lg bg-white/10 px-4 py-2 text-sm text-white hover:bg-white/20"
        >
          Schedule Check-in
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-8">
        {/* Left: flags */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-white">Active Retention Flags</h2>
          {openFlags.length === 0 && <p className="text-sm text-gray-500">No open flags</p>}
          {openFlags.map((f) => (
            <div key={f.id} className="rounded-lg border border-gray-700/50 bg-white/5 p-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-sm font-medium capitalize text-white">
                    {f.trigger_type.replace(/_/g, " ")}
                  </span>
                  <span className="ml-2 text-xs text-red-400">+{f.risk_points}</span>
                </div>
                <button
                  onClick={() => setResolveId(f.id)}
                  className="rounded bg-green-900/40 px-2 py-1 text-xs text-green-300 hover:bg-green-900/60"
                >
                  Resolve
                </button>
              </div>
              {f.notes && <p className="mt-1 text-xs text-gray-400">{f.notes}</p>}
              <p className="mt-1 text-xs text-gray-500">
                {new Date(f.flagged_at).toLocaleDateString()}
              </p>
            </div>
          ))}
        </div>

        {/* Right: check-in timeline */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-white">Check-in Timeline</h2>
          {checkins.map((c) => (
            <div key={c.id} className="rounded-lg border border-gray-700/50 bg-white/5 p-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium capitalize text-white">
                  {c.checkin_type.replace(/_/g, " ")}
                </span>
                {c.completed_at ? (
                  <span className="rounded-full bg-green-900/40 px-2 py-0.5 text-xs text-green-300">
                    Completed
                  </span>
                ) : c.missed ? (
                  <span className="rounded-full bg-red-900/40 px-2 py-0.5 text-xs text-red-300">
                    Missed
                  </span>
                ) : (
                  <span className="rounded-full bg-gray-700 px-2 py-0.5 text-xs text-gray-300">
                    Scheduled
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-500">
                {c.completed_at
                  ? `Completed ${new Date(c.completed_at).toLocaleDateString()}`
                  : `Scheduled ${new Date(c.scheduled_at).toLocaleDateString()}`}
              </p>
              {c.score_overall !== null && (
                <div className="mt-1 flex gap-3 text-xs text-gray-400">
                  <span>Overall: {c.score_overall}</span>
                  <span>Pay: {c.score_pay}</span>
                  <span>Home: {c.score_home_time}</span>
                  <span>Equip: {c.score_equipment}</span>
                  <span>Dispatch: {c.score_dispatch}</span>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Separation info */}
      {driver.status === "separated" && (
        <div className="rounded-lg border border-red-800 bg-red-900/20 p-4 space-y-2">
          <h2 className="text-lg font-semibold text-red-300">Separated</h2>
          <p className="text-sm text-gray-300">
            Date: {driver.separation_date ? new Date(driver.separation_date).toLocaleDateString() : "—"}
          </p>
          <p className="text-sm text-gray-300">Reason: {driver.departure_reason ?? "—"}</p>
          {driver.departure_notes && (
            <p className="text-sm text-gray-400">{driver.departure_notes}</p>
          )}
          <p className="text-sm text-gray-300">
            Eligible for rehire: {driver.eligible_for_rehire ? "Yes" : "No"}
          </p>
        </div>
      )}

      {/* Resolve modal */}
      {resolveId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="w-full max-w-md rounded-xl bg-[#111d33] p-6 shadow-2xl">
            <h2 className="mb-4 text-lg font-bold text-white">Resolve Flag</h2>
            <label className="block text-sm font-medium text-gray-300">Resolution Notes</label>
            <textarea
              value={resolveNotes}
              onChange={(e) => setResolveNotes(e.target.value)}
              rows={3}
              className={inputCls}
            />
            <div className="mt-4 flex justify-end gap-3">
              <button
                onClick={() => setResolveId(null)}
                className="rounded-lg px-4 py-2 text-sm text-gray-400 hover:text-white"
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

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-center">
      <div className="text-lg font-bold capitalize text-white">{value}</div>
      <div className="text-xs text-gray-500">{label}</div>
    </div>
  );
}
