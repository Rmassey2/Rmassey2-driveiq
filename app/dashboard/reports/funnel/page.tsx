"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PageSkeleton } from "@/components/skeleton";
import EmptyState from "@/components/empty-state";
import { ErrorBoundary } from "@/components/error-boundary";

interface FunnelRow {
  utm_source: string;
  utm_campaign: string;
  utm_content: string;
  page_views: number;
  form_starts: number;
  form_submits: number;
  form_errors: number;
  pv_to_fs_pct: number;
  fs_to_sub_pct: number;
  pv_to_sub_pct: number;
}

interface FunnelResponse {
  rows: FunnelRow[];
  totals: {
    page_views: number;
    form_starts: number;
    form_submits: number;
    form_errors: number;
    pv_to_sub_pct: number;
  };
}

function FunnelContent() {
  const [data, setData] = useState<FunnelResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/reports/funnel");
      if (res.ok) setData(await res.json());
      setLoading(false);
    })();
  }, []);

  if (loading) return <PageSkeleton />;
  if (!data) return <EmptyState message="Failed to load funnel data." />;

  const t = data.totals;

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Landing Page Funnel</h1>
        <Link
          href="/dashboard/reports"
          className="rounded-lg bg-[#111d33] px-3 py-1.5 text-xs font-medium text-[#c8a951] hover:bg-[#c8a951]/10"
        >
          Source Attribution
        </Link>
      </div>

      <p className="text-sm text-gray-400">
        Last 30 days of /apply and /apply-oo traffic. Each row is one distinct
        utm_source / utm_campaign / utm_content combination. Low PV→Submit means
        the landing page is the bottleneck; pump more spend at it and you&apos;ll
        just waste budget until the page converts better.
      </p>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <Stat label="Page Views" value={t.page_views} />
        <Stat label="Form Starts" value={t.form_starts} />
        <Stat label="Form Submits" value={t.form_submits} />
        <Stat label="Errors" value={t.form_errors} />
        <Stat label="Overall PV→Submit" value={`${t.pv_to_sub_pct}%`} accent />
      </div>

      {data.rows.length === 0 ? (
        <EmptyState message="No funnel events yet. Visit /apply with utm params to generate data." />
      ) : (
        <>
          <div className="hidden overflow-x-auto rounded-lg border border-gray-700/50 md:block">
            <table className="w-full text-left text-sm">
              <thead className="bg-[#111d33] text-xs uppercase text-gray-400">
                <tr>
                  <th className="px-4 py-3">Source</th>
                  <th className="px-4 py-3">Campaign</th>
                  <th className="px-4 py-3">Content</th>
                  <th className="px-4 py-3">Views</th>
                  <th className="px-4 py-3">Starts</th>
                  <th className="px-4 py-3">Submits</th>
                  <th className="px-4 py-3">PV→Start%</th>
                  <th className="px-4 py-3">Start→Sub%</th>
                  <th className="px-4 py-3">PV→Sub%</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700/30">
                {data.rows.map((r, i) => (
                  <tr key={i} className="hover:bg-white/5">
                    <td className="px-4 py-3 text-gray-300">{r.utm_source}</td>
                    <td className="px-4 py-3 text-gray-300">{r.utm_campaign}</td>
                    <td className="px-4 py-3 text-gray-300">{r.utm_content}</td>
                    <td className="px-4 py-3 text-gray-300">{r.page_views}</td>
                    <td className="px-4 py-3 text-gray-300">{r.form_starts}</td>
                    <td className="px-4 py-3 text-gray-300">{r.form_submits}</td>
                    <td className="px-4 py-3 text-gray-300">{r.pv_to_fs_pct}%</td>
                    <td className="px-4 py-3 text-gray-300">{r.fs_to_sub_pct}%</td>
                    <td
                      className={`px-4 py-3 font-medium ${
                        r.pv_to_sub_pct >= 5
                          ? "text-green-400"
                          : r.pv_to_sub_pct >= 2
                            ? "text-[#c8a951]"
                            : "text-red-400"
                      }`}
                    >
                      {r.pv_to_sub_pct}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="space-y-3 md:hidden">
            {data.rows.map((r, i) => (
              <div key={i} className="rounded-lg bg-[#111d33] p-4">
                <p className="text-sm font-medium text-white">
                  {r.utm_source} / {r.utm_campaign}
                </p>
                <p className="text-xs text-gray-400">{r.utm_content}</p>
                <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
                  <div>
                    <span className="text-gray-400">Views:</span>{" "}
                    <span className="text-white">{r.page_views}</span>
                  </div>
                  <div>
                    <span className="text-gray-400">Starts:</span>{" "}
                    <span className="text-white">{r.form_starts}</span>
                  </div>
                  <div>
                    <span className="text-gray-400">Subs:</span>{" "}
                    <span className="text-white">{r.form_submits}</span>
                  </div>
                  <div className="col-span-3">
                    <span className="text-gray-400">PV→Sub:</span>{" "}
                    <span
                      className={`font-medium ${
                        r.pv_to_sub_pct >= 5
                          ? "text-green-400"
                          : r.pv_to_sub_pct >= 2
                            ? "text-[#c8a951]"
                            : "text-red-400"
                      }`}
                    >
                      {r.pv_to_sub_pct}%
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: number | string;
  accent?: boolean;
}) {
  return (
    <div className="rounded-lg bg-[#111d33] p-4">
      <p className="text-sm text-gray-400">{label}</p>
      <p
        className={`mt-1 text-2xl font-bold ${
          accent ? "text-[#c8a951]" : "text-white"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

export default function FunnelPage() {
  return (
    <ErrorBoundary>
      <FunnelContent />
    </ErrorBoundary>
  );
}
