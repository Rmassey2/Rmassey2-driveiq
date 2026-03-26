"use client";

import { useEffect, useState } from "react";
import { PageSkeleton } from "@/components/skeleton";
import EmptyState from "@/components/empty-state";
import { ErrorBoundary } from "@/components/error-boundary";

interface CmoReport {
  id: string;
  report_month: string;
  summary: string | null;
  recommendations: { priority: string; recommendation: string; urgency: string }[] | null;
  metrics: Record<string, unknown> | null;
  created_at: string;
}

function CmoReportContent() {
  const [reports, setReports] = useState<CmoReport[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const res = await fetch("/api/reports/cmo");
      if (res.ok) setReports(await res.json());
      setLoading(false);
    }
    load();
  }, []);

  if (loading) return <PageSkeleton />;
  if (reports.length === 0) {
    return (
      <div className="space-y-6 p-6">
        <h1 className="text-2xl font-bold text-white">CMO Reports</h1>
        <EmptyState message="No CMO reports generated yet. The first report will be generated on the 1st of next month." />
      </div>
    );
  }

  const latest = reports[0];
  const history = reports.slice(1);
  const m = latest.metrics as Record<string, number | string | Record<string, unknown>> | null;

  const priorityColor: Record<string, string> = {
    high: "bg-red-500/10 text-red-400",
    medium: "bg-yellow-500/10 text-yellow-400",
    low: "bg-green-500/10 text-green-400",
  };

  return (
    <div className="space-y-6 p-6">
      <h1 className="text-2xl font-bold text-white">CMO Report — {latest.report_month}</h1>

      {/* Executive Summary */}
      <div className="rounded-lg border border-[#c8a951]/30 bg-[#c8a951]/5 p-6">
        <h2 className="mb-2 text-lg font-semibold text-[#c8a951]">Executive Summary</h2>
        <p className="text-gray-300">{latest.summary}</p>
      </div>

      {/* Key Metrics */}
      {m && (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <div className="rounded-lg bg-[#111d33] p-4">
            <p className="text-sm text-gray-400">Leads</p>
            <p className="mt-1 text-2xl font-bold text-white">{String(m.total_leads ?? 0)}</p>
          </div>
          <div className="rounded-lg bg-[#111d33] p-4">
            <p className="text-sm text-gray-400">Apps</p>
            <p className="mt-1 text-2xl font-bold text-white">{String(m.total_apps ?? 0)}</p>
          </div>
          <div className="rounded-lg bg-[#111d33] p-4">
            <p className="text-sm text-gray-400">Hires</p>
            <p className="mt-1 text-2xl font-bold text-white">{String(m.total_hires ?? 0)}</p>
          </div>
          <div className="rounded-lg bg-[#111d33] p-4">
            <p className="text-sm text-gray-400">Separations</p>
            <p className="mt-1 text-2xl font-bold text-white">{String(m.total_separations ?? 0)}</p>
          </div>
          <div className="rounded-lg bg-[#111d33] p-4">
            <p className="text-sm text-gray-400">Top Departure Reason</p>
            <p className="mt-1 text-lg font-bold text-white">{String(m.top_departure_reason ?? "N/A")}</p>
          </div>
          <div className="rounded-lg bg-[#111d33] p-4">
            <p className="text-sm text-gray-400">Review Requests Sent</p>
            <p className="mt-1 text-2xl font-bold text-white">{String(m.review_requests_sent ?? 0)}</p>
          </div>
          <div className="rounded-lg bg-[#111d33] p-4">
            <p className="text-sm text-gray-400">Review CTR</p>
            <p className="mt-1 text-2xl font-bold text-white">{String(m.review_ctr_pct ?? 0)}%</p>
          </div>
        </div>
      )}

      {/* Recommendations */}
      {latest.recommendations && latest.recommendations.length > 0 && (
        <div className="rounded-lg bg-[#111d33] p-6">
          <h2 className="mb-4 text-lg font-semibold text-white">AI Recommendations</h2>
          <div className="space-y-3">
            {latest.recommendations.map((r, i) => (
              <div key={i} className="flex items-start gap-3 rounded-lg bg-[#0a1628] p-4">
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${priorityColor[r.priority] ?? "bg-gray-500/10 text-gray-400"}`}>
                  {r.priority}
                </span>
                <div>
                  <p className="text-sm text-white">{r.recommendation}</p>
                  <p className="mt-1 text-xs text-gray-400">Timeline: {r.urgency}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* History */}
      {history.length > 0 && (
        <div className="rounded-lg bg-[#111d33] p-4">
          <h2 className="mb-3 text-lg font-semibold text-white">Past Reports</h2>
          <div className="space-y-2">
            {history.map((r) => (
              <div key={r.id} className="flex items-center justify-between rounded-md bg-[#0a1628] px-4 py-3">
                <div>
                  <p className="font-medium text-white">{r.report_month}</p>
                  <p className="text-xs text-gray-400 line-clamp-1">{r.summary}</p>
                </div>
                <p className="text-xs text-gray-500">{new Date(r.created_at).toLocaleDateString()}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function CmoReportPage() {
  return (
    <ErrorBoundary>
      <CmoReportContent />
    </ErrorBoundary>
  );
}
