"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { PageSkeleton } from "@/components/skeleton";
import EmptyState from "@/components/empty-state";
import { ErrorBoundary } from "@/components/error-boundary";

const BarChart = dynamic(
  () => import("recharts").then((mod) => mod.BarChart),
  { ssr: false }
);
const Bar = dynamic(
  () => import("recharts").then((mod) => mod.Bar),
  { ssr: false }
);
const XAxis = dynamic(
  () => import("recharts").then((mod) => mod.XAxis),
  { ssr: false }
);
const YAxis = dynamic(
  () => import("recharts").then((mod) => mod.YAxis),
  { ssr: false }
);
const Tooltip = dynamic(
  () => import("recharts").then((mod) => mod.Tooltip),
  { ssr: false }
);
const Legend = dynamic(
  () => import("recharts").then((mod) => mod.Legend),
  { ssr: false }
);
const ResponsiveContainer = dynamic(
  () => import("recharts").then((mod) => mod.ResponsiveContainer),
  { ssr: false }
);

interface ChannelRow {
  channel: string;
  leads: number;
  apps: number;
  hires: number;
  lead_to_app_pct: number;
  app_to_hire_pct: number;
  lead_to_hire_pct: number;
}

interface Attribution {
  days: number;
  total_leads: number;
  total_apps: number;
  total_hires: number;
  best_channel: string;
  channels: ChannelRow[];
}

function ReportsContent() {
  const [data, setData] = useState<Attribution | null>(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(90);

  async function loadData(d: number) {
    setLoading(true);
    const res = await fetch(`/api/reports/attribution?days=${d}`);
    if (res.ok) setData(await res.json());
    setLoading(false);
  }

  useEffect(() => { loadData(days); }, [days]);

  if (loading) return <PageSkeleton />;
  if (!data) return <EmptyState message="Failed to load attribution data." />;

  const fbRow = data.channels.find((c) => c.channel?.toLowerCase().includes("facebook"));
  const jobBoardRows = data.channels.filter((c) =>
    c.channel?.toLowerCase().includes("job board") || c.channel?.toLowerCase().includes("indeed") || c.channel?.toLowerCase().includes("ziprecruiter")
  );
  const jobBoardAvgHireRate = jobBoardRows.length > 0
    ? Math.round(jobBoardRows.reduce((s, r) => s + r.lead_to_hire_pct, 0) / jobBoardRows.length)
    : 0;

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Source Attribution</h1>
        <div className="flex items-center gap-2">
          {[30, 60, 90, 180].map((d) => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                days === d
                  ? "bg-[#c8a951] text-[#0a1628]"
                  : "bg-[#111d33] text-gray-400 hover:text-white"
              }`}
            >
              {d}d
            </button>
          ))}
          <Link
            href="/dashboard/reports/cmo-report"
            className="ml-4 rounded-lg bg-[#111d33] px-3 py-1.5 text-xs font-medium text-[#c8a951] hover:bg-[#c8a951]/10"
          >
            CMO Reports
          </Link>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <div className="rounded-lg bg-[#111d33] p-4">
          <p className="text-sm text-gray-400">Total Leads</p>
          <p className="mt-1 text-2xl font-bold text-white">{data.total_leads}</p>
        </div>
        <div className="rounded-lg bg-[#111d33] p-4">
          <p className="text-sm text-gray-400">Total Apps</p>
          <p className="mt-1 text-2xl font-bold text-white">{data.total_apps}</p>
        </div>
        <div className="rounded-lg bg-[#111d33] p-4">
          <p className="text-sm text-gray-400">Total Hires</p>
          <p className="mt-1 text-2xl font-bold text-white">{data.total_hires}</p>
        </div>
        <div className="rounded-lg bg-[#111d33] p-4">
          <p className="text-sm text-gray-400">Blended CPL</p>
          <p className="mt-1 text-2xl font-bold text-white">—</p>
        </div>
        <div className="rounded-lg bg-[#111d33] p-4">
          <p className="text-sm text-gray-400">Best Channel</p>
          <p className="mt-1 text-lg font-bold text-[#c8a951]">{data.best_channel}</p>
        </div>
      </div>

      {/* Facebook Callout */}
      {fbRow && data.total_hires >= 20 && fbRow.lead_to_hire_pct > jobBoardAvgHireRate ? (
        <div className="rounded-lg border border-green-500/30 bg-green-500/10 p-4">
          <p className="font-semibold text-green-400">
            Facebook outperforming job boards: {fbRow.lead_to_hire_pct}% lead-to-hire vs {jobBoardAvgHireRate}% job board average
          </p>
        </div>
      ) : data.total_hires < 20 ? (
        <div className="rounded-lg border border-gray-600 bg-[#111d33] p-4">
          <p className="text-sm text-gray-400">
            Collecting data — check back after 20+ hires for Facebook quality comparison.
          </p>
        </div>
      ) : null}

      {/* Chart */}
      {data.channels.length > 0 && (
        <div className="rounded-lg bg-[#111d33] p-4">
          <h2 className="mb-4 text-lg font-semibold text-white">Leads vs Apps vs Hires by Channel</h2>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.channels}>
                <XAxis dataKey="channel" tick={{ fill: "#9ca3af", fontSize: 12 }} />
                <YAxis tick={{ fill: "#9ca3af", fontSize: 12 }} />
                <Tooltip
                  contentStyle={{ backgroundColor: "#111d33", border: "1px solid #374151", color: "#fff" }}
                />
                <Legend />
                <Bar dataKey="leads" fill="#c8a951" name="Leads" />
                <Bar dataKey="apps" fill="#3b82f6" name="Apps" />
                <Bar dataKey="hires" fill="#22c55e" name="Hires" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Table */}
      {data.channels.length === 0 ? (
        <EmptyState message="No source data available for this period." />
      ) : (
        <>
          {/* Desktop */}
          <div className="hidden overflow-x-auto rounded-lg border border-gray-700/50 md:block">
            <table className="w-full text-left text-sm">
              <thead className="bg-[#111d33] text-xs uppercase text-gray-400">
                <tr>
                  <th className="px-4 py-3">Channel</th>
                  <th className="px-4 py-3">Leads</th>
                  <th className="px-4 py-3">Apps</th>
                  <th className="px-4 py-3">Hires</th>
                  <th className="px-4 py-3">Lead→App%</th>
                  <th className="px-4 py-3">App→Hire%</th>
                  <th className="px-4 py-3">Lead→Hire%</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700/30">
                {data.channels.map((c) => (
                  <tr key={c.channel} className="hover:bg-white/5">
                    <td className="px-4 py-3 font-medium text-white">{c.channel}</td>
                    <td className="px-4 py-3 text-gray-300">{c.leads}</td>
                    <td className="px-4 py-3 text-gray-300">{c.apps}</td>
                    <td className="px-4 py-3 text-gray-300">{c.hires}</td>
                    <td className="px-4 py-3 text-gray-300">{c.lead_to_app_pct}%</td>
                    <td className="px-4 py-3 text-gray-300">{c.app_to_hire_pct}%</td>
                    <td className="px-4 py-3 font-medium text-[#c8a951]">{c.lead_to_hire_pct}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile */}
          <div className="space-y-3 md:hidden">
            {data.channels.map((c) => (
              <div key={c.channel} className="rounded-lg bg-[#111d33] p-4">
                <p className="font-medium text-white">{c.channel}</p>
                <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
                  <div><span className="text-gray-400">Leads:</span> <span className="text-white">{c.leads}</span></div>
                  <div><span className="text-gray-400">Apps:</span> <span className="text-white">{c.apps}</span></div>
                  <div><span className="text-gray-400">Hires:</span> <span className="text-white">{c.hires}</span></div>
                  <div><span className="text-gray-400">L→A:</span> <span className="text-white">{c.lead_to_app_pct}%</span></div>
                  <div><span className="text-gray-400">A→H:</span> <span className="text-white">{c.app_to_hire_pct}%</span></div>
                  <div><span className="text-gray-400">L→H:</span> <span className="text-[#c8a951]">{c.lead_to_hire_pct}%</span></div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default function ReportsPage() {
  return (
    <ErrorBoundary>
      <ReportsContent />
    </ErrorBoundary>
  );
}
