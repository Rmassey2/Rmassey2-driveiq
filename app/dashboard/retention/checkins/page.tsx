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

export default function CheckinsPage() {
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

  useEffect(() => {
    fetchCheckins();
  }, [fetchCheckins]);

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
  const weekFromNow = new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0];
  const monthStart = new Date();
  monthStart.setDate(1);

  const overdue = checkins.filter(
    (c) => !c.completed_at && !c.missed && c.scheduled_at < today
  );
  const dueToday = checkins.filter(
    (c) => !c.completed_at && !c.missed && c.scheduled_at === today
  );
  const upcoming = checkins.filter(
    (c) => !c.completed_at && !c.missed && c.scheduled_at > today && c.scheduled_at <= weekFromNow
  );
  const completedThisMonth = checkins.filter(
    (c) => c.completed_at && c.completed_at >= monthStart.toISOString()
  );

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold text-white">Check-ins</h1>

      <Section title="Overdue" color="text-red-400" borderColor="border-l-red-500" items={overdue} names={driverNames} router={router} />
      <Section title="Due Today" color="text-[#c8a951]" borderColor="border-l-[#c8a951]" items={dueToday} names={driverNames} router={router} />
      <Section title="Upcoming This Week" color="text-blue-400" borderColor="border-l-blue-500" items={upcoming} names={driverNames} router={router} />
      <Section title="Completed This Month" color="text-green-400" borderColor="border-l-green-500" items={completedThisMonth} names={driverNames} router={router} completed />
    </div>
  );
}

function Section({
  title,
  color,
  borderColor,
  items,
  names,
  router,
  completed,
}: {
  title: string;
  color: string;
  borderColor: string;
  items: { id: string; driver_id: string; checkin_type: string; scheduled_at: string }[];
  names: Record<string, string>;
  router: ReturnType<typeof import("next/navigation").useRouter>;
  completed?: boolean;
}) {
  return (
    <div>
      <h2 className={`mb-3 text-lg font-semibold ${color}`}>
        {title} ({items.length})
      </h2>
      {items.length === 0 && <p className="text-sm text-gray-500">None</p>}
      <div className="space-y-2">
        {items.map((c) => (
          <div
            key={c.id}
            className={`flex items-center justify-between rounded-lg border-l-4 ${borderColor} bg-[#111d33] p-3 cursor-pointer hover:bg-white/5`}
            onClick={() => !completed && router.push(`/dashboard/retention/checkins/${c.id}`)}
          >
            <div>
              <span className="text-sm font-medium text-white">
                {names[c.driver_id] ?? "Unknown Driver"}
              </span>
              <span className="ml-3 text-xs capitalize text-gray-400">
                {c.checkin_type.replace(/_/g, " ")}
              </span>
            </div>
            <span className="text-xs text-gray-500">
              {new Date(c.scheduled_at).toLocaleDateString()}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
