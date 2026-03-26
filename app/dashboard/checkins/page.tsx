"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import EmptyState from "@/components/empty-state";

interface CheckinRow {
  id: string;
  driver_id: string;
  checkin_type: string;
  scheduled_at: string;
  completed_at: string | null;
  missed: boolean | null;
}

export default function RecruitingCheckinsPage() {
  const router = useRouter();
  const [checkins, setCheckins] = useState<CheckinRow[]>([]);
  const [driverNames, setDriverNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCheckins = useCallback(async () => {
    try {
      const res = await fetch("/api/retention/checkins-list");
      if (res.ok) {
        const json = await res.json();
        setCheckins((json.checkins ?? []) as CheckinRow[]);
        setDriverNames((json.names ?? {}) as Record<string, string>);
      } else {
        setError("Failed to load check-ins");
      }
    } catch {
      setError("Failed to load check-ins");
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchCheckins(); }, [fetchCheckins]);

  if (loading) return <p className="text-gray-400">Loading check-ins...</p>;

  if (error) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-white">Check-ins</h1>
        <div className="rounded-lg bg-red-500/10 p-4 text-sm text-red-400">{error}</div>
      </div>
    );
  }

  if (checkins.length === 0) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-white">Check-ins</h1>
        <EmptyState message="No check-ins scheduled yet. Check-ins are auto-created when a driver is marked as Hired." />
      </div>
    );
  }

  const today = new Date().toISOString().split("T")[0];
  const overdue = checkins.filter((c) => !c.completed_at && !c.missed && c.scheduled_at < today);
  const dueToday = checkins.filter((c) => !c.completed_at && !c.missed && c.scheduled_at === today);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white">Check-ins</h1>

      {overdue.length > 0 && (
        <div>
          <h2 className="mb-2 text-lg font-semibold text-red-400">Overdue ({overdue.length})</h2>
          <div className="space-y-2">
            {overdue.map((c) => (
              <div
                key={c.id}
                onClick={() => router.push(`/dashboard/retention/checkins/${c.id}`)}
                className="flex cursor-pointer items-center justify-between rounded-lg border-l-4 border-l-red-500 bg-[#111d33] p-3 hover:bg-white/5"
              >
                <div>
                  <span className="text-sm font-medium text-white">{driverNames[c.driver_id] ?? "Unknown"}</span>
                  <span className="ml-3 text-xs capitalize text-gray-400">{c.checkin_type.replace(/_/g, " ")}</span>
                </div>
                <span className="text-xs text-gray-500">{new Date(c.scheduled_at).toLocaleDateString()}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {dueToday.length > 0 && (
        <div>
          <h2 className="mb-2 text-lg font-semibold text-[#c8a951]">Due Today ({dueToday.length})</h2>
          <div className="space-y-2">
            {dueToday.map((c) => (
              <div
                key={c.id}
                onClick={() => router.push(`/dashboard/retention/checkins/${c.id}`)}
                className="flex cursor-pointer items-center justify-between rounded-lg border-l-4 border-l-[#c8a951] bg-[#111d33] p-3 hover:bg-white/5"
              >
                <div>
                  <span className="text-sm font-medium text-white">{driverNames[c.driver_id] ?? "Unknown"}</span>
                  <span className="ml-3 text-xs capitalize text-gray-400">{c.checkin_type.replace(/_/g, " ")}</span>
                </div>
                <span className="text-xs text-gray-500">Today</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {overdue.length === 0 && dueToday.length === 0 && (
        <div className="rounded-lg bg-green-500/10 p-4 text-sm text-green-400">
          All caught up — no overdue or due-today check-ins.
        </div>
      )}
    </div>
  );
}
