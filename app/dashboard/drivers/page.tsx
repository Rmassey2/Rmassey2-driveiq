"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import EmptyState from "@/components/empty-state";

interface HiredDriver {
  id: string;
  lead_id: string;
  hire_date: string;
  segment: string | null;
  status: string;
  retention_risk_score: number;
  truck_number: string | null;
  driver_leads?: { full_name: string; phone: string } | null;
}

export default function MyDriversPage() {
  const router = useRouter();
  const [drivers, setDrivers] = useState<HiredDriver[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDrivers = useCallback(async () => {
    try {
      const res = await fetch("/api/hired-drivers");
      if (res.ok) {
        setDrivers(await res.json());
      } else {
        setError("Failed to load drivers");
      }
    } catch {
      setError("Failed to load drivers");
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchDrivers(); }, [fetchDrivers]);

  if (loading) return <p className="text-gray-400">Loading drivers...</p>;

  if (error) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-white">My Drivers</h1>
        <div className="rounded-lg bg-red-500/10 p-4 text-sm text-red-400">{error}</div>
      </div>
    );
  }

  if (drivers.length === 0) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-white">My Drivers</h1>
        <EmptyState
          message="No active drivers yet — import your driver list or mark applicants as Hired to start tracking retention."
          action="Go to Pipeline"
          onAction={() => router.push("/dashboard/pipeline")}
        />
      </div>
    );
  }

  const active = drivers.filter((d) => d.status === "active");
  const separated = drivers.filter((d) => d.status === "separated");

  function riskColor(score: number) {
    if (score >= 8) return "text-red-400";
    if (score >= 6) return "text-yellow-400";
    return "text-green-400";
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white">My Drivers ({active.length} active)</h1>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="rounded-lg bg-[#111d33] p-4">
          <p className="text-sm text-gray-400">Active</p>
          <p className="mt-1 text-2xl font-bold text-green-400">{active.length}</p>
        </div>
        <div className="rounded-lg bg-[#111d33] p-4">
          <p className="text-sm text-gray-400">Separated</p>
          <p className="mt-1 text-2xl font-bold text-gray-400">{separated.length}</p>
        </div>
      </div>

      {/* Desktop table */}
      <div className="hidden overflow-x-auto rounded-lg border border-gray-700/50 md:block">
        <table className="w-full text-left text-sm">
          <thead className="bg-[#111d33] text-xs uppercase text-gray-400">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Phone</th>
              <th className="px-4 py-3">Segment</th>
              <th className="px-4 py-3">Hire Date</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Risk Score</th>
              <th className="px-4 py-3">Truck</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-700/30">
            {drivers.map((d) => {
              const name = (d.driver_leads as { full_name: string } | null)?.full_name ?? "Unknown";
              const phone = (d.driver_leads as { phone: string } | null)?.phone ?? "—";
              return (
                <tr key={d.id} className="hover:bg-white/5">
                  <td className="px-4 py-3 font-medium text-white">{name}</td>
                  <td className="px-4 py-3 text-gray-300">{phone}</td>
                  <td className="px-4 py-3 text-gray-300">{d.segment ?? "—"}</td>
                  <td className="px-4 py-3 text-gray-400">{new Date(d.hire_date).toLocaleDateString()}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs capitalize ${d.status === "active" ? "bg-green-500/10 text-green-400" : "bg-gray-500/10 text-gray-400"}`}>
                      {d.status}
                    </span>
                  </td>
                  <td className={`px-4 py-3 font-bold ${riskColor(d.retention_risk_score)}`}>
                    {d.retention_risk_score}
                  </td>
                  <td className="px-4 py-3 text-gray-300">{d.truck_number ?? "—"}</td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => router.push(`/dashboard/retention/${d.id}`)}
                      className="rounded bg-[#c8a951]/20 px-2 py-1 text-xs text-[#c8a951] hover:bg-[#c8a951]/30"
                    >
                      View
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="space-y-3 md:hidden">
        {drivers.map((d) => {
          const name = (d.driver_leads as { full_name: string } | null)?.full_name ?? "Unknown";
          return (
            <div
              key={d.id}
              onClick={() => router.push(`/dashboard/retention/${d.id}`)}
              className="cursor-pointer rounded-lg bg-[#111d33] p-4 hover:bg-white/5"
            >
              <div className="flex items-center justify-between">
                <p className="font-medium text-white">{name}</p>
                <span className={`font-bold ${riskColor(d.retention_risk_score)}`}>{d.retention_risk_score}</span>
              </div>
              <div className="mt-1 flex gap-3 text-xs text-gray-400">
                <span>{d.segment ?? "—"}</span>
                <span>Hired: {new Date(d.hire_date).toLocaleDateString()}</span>
                <span className="capitalize">{d.status}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
