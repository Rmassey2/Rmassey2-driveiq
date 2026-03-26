"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";

interface RetentionDriver {
  id: string;
  org_id: string;
  full_name: string;
  phone: string;
  segment: string | null;
  hire_date: string;
  status: string;
  retention_risk_score: number;
  truck_number: string | null;
  assigned_dm_id: string | null;
  days_employed: number | null;
  risk_level: string | null;
  checkins_completed: number | null;
  last_checkin_at: string | null;
}

type Filter = "all" | "red" | "yellow" | "green" | "separated";

export default function RetentionPage() {
  const router = useRouter();
  const [drivers, setDrivers] = useState<RetentionDriver[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("all");

  const fetchDrivers = useCallback(async () => {
    const res = await fetch("/api/retention/list");
    if (res.ok) setDrivers(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchDrivers();
    const interval = setInterval(fetchDrivers, 60000);
    return () => clearInterval(interval);
  }, [fetchDrivers]);

  const active = drivers.filter((d) => d.status !== "separated");
  const green = active.filter((d) => (d.retention_risk_score ?? 0) <= 5);
  const yellow = active.filter((d) => {
    const s = d.retention_risk_score ?? 0;
    return s >= 6 && s <= 7;
  });
  const red = active.filter((d) => (d.retention_risk_score ?? 0) >= 8);

  const filtered = drivers.filter((d) => {
    if (filter === "red") return (d.retention_risk_score ?? 0) >= 8 && d.status !== "separated";
    if (filter === "yellow") {
      const s = d.retention_risk_score ?? 0;
      return s >= 6 && s <= 7 && d.status !== "separated";
    }
    if (filter === "green") return (d.retention_risk_score ?? 0) <= 5 && d.status !== "separated";
    if (filter === "separated") return d.status === "separated";
    return true;
  });

  function riskColor(score: number) {
    if (score >= 8) return "text-red-400";
    if (score >= 6) return "text-yellow-400";
    return "text-green-400";
  }

  function riskBadge(level: string | null) {
    if (level === "red") return "bg-red-900/40 text-red-300";
    if (level === "yellow") return "bg-yellow-900/40 text-yellow-300";
    return "bg-green-900/40 text-green-300";
  }

  function rowBorder(d: RetentionDriver) {
    const s = d.retention_risk_score ?? 0;
    if (s >= 8) return "border-l-4 border-l-red-500";
    if (s >= 6) return "border-l-4 border-l-[#c8a951]";
    return "";
  }

  if (loading) {
    return <p className="text-gray-400">Loading retention dashboard...</p>;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white">Retention Dashboard</h1>

      {/* Summary cards */}
      <div className="grid grid-cols-4 gap-4">
        <Card label="Total Active" value={active.length} color="text-white" />
        <Card label="Green (0-5)" value={green.length} color="text-green-400" />
        <Card label="Yellow (6-7)" value={yellow.length} color="text-yellow-400" />
        <Card label="Red (8-10)" value={red.length} color="text-red-400" />
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2">
        {(
          [
            ["all", "ALL"],
            ["red", "RED ALERT"],
            ["yellow", "YELLOW ALERT"],
            ["green", "GREEN"],
            ["separated", "SEPARATED"],
          ] as [Filter, string][]
        ).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
              filter === key
                ? "bg-[#c8a951] text-[#0a1628]"
                : "bg-[#111d33] text-gray-400 hover:text-white"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-gray-700/50">
        <table className="w-full text-left text-sm">
          <thead className="bg-[#111d33] text-xs uppercase text-gray-400">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Phone</th>
              <th className="px-4 py-3">Segment</th>
              <th className="px-4 py-3">Days Employed</th>
              <th className="px-4 py-3">Hire Date</th>
              <th className="px-4 py-3">Risk Score</th>
              <th className="px-4 py-3">Risk Level</th>
              <th className="px-4 py-3">Last Check-in</th>
              <th className="px-4 py-3">Check-ins</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-700/30">
            {filtered.map((d) => (
              <tr key={d.id} className={`hover:bg-white/5 ${rowBorder(d)}`}>
                <td className="whitespace-nowrap px-4 py-3 font-medium text-white">{d.full_name}</td>
                <td className="px-4 py-3 text-gray-300">{d.phone}</td>
                <td className="px-4 py-3 text-gray-300">{d.segment ?? "—"}</td>
                <td className="px-4 py-3 text-gray-300">{d.days_employed ?? "—"}</td>
                <td className="px-4 py-3 text-gray-400">{d.hire_date ? new Date(d.hire_date).toLocaleDateString() : "—"}</td>
                <td className={`px-4 py-3 font-bold ${riskColor(d.retention_risk_score ?? 0)}`}>
                  {d.retention_risk_score ?? 0}
                </td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2 py-0.5 text-xs capitalize ${riskBadge(d.risk_level)}`}>
                    {d.risk_level ?? "green"}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-400">
                  {d.last_checkin_at ? new Date(d.last_checkin_at).toLocaleDateString() : "—"}
                </td>
                <td className="px-4 py-3 text-gray-300">{d.checkins_completed ?? 0}</td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => router.push(`/dashboard/retention/${d.id}`)}
                    className="rounded bg-[#c8a951]/20 px-2 py-1 text-xs text-[#c8a951] hover:bg-[#c8a951]/30"
                  >
                    View
                  </button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={10} className="px-4 py-8 text-center text-gray-500">
                  No drivers match this filter
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Card({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="rounded-lg border border-gray-700/50 bg-[#111d33] p-4">
      <p className="text-sm text-gray-400">{label}</p>
      <p className={`text-3xl font-bold ${color}`}>{value}</p>
    </div>
  );
}
