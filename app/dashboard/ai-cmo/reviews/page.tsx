"use client";

import { useEffect, useState } from "react";
import { PageSkeleton } from "@/components/skeleton";
import EmptyState from "@/components/empty-state";
import { ErrorBoundary } from "@/components/error-boundary";

interface ReviewRequest {
  id: string;
  driver_id: string;
  platform: string;
  sent_via: string;
  sent_at: string;
  opened: boolean;
  clicked: boolean;
  submitted: boolean;
  rating: number | null;
  hired_drivers?: { lead_id: string; driver_leads?: { full_name: string } | null } | null;
}

function ReviewsContent() {
  const [reviews, setReviews] = useState<ReviewRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [manualDriverId, setManualDriverId] = useState("");
  const [manualPlatform, setManualPlatform] = useState("google");

  async function loadReviews() {
    const res = await fetch("/api/reviews");
    if (res.ok) setReviews(await res.json());
    setLoading(false);
  }

  useEffect(() => { loadReviews(); }, []);

  async function handleManualSend() {
    if (!manualDriverId.trim()) return;
    setSending(true);
    await fetch("/api/reviews", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ driver_id: manualDriverId, platform: manualPlatform }),
    });
    setManualDriverId("");
    loadReviews();
    setSending(false);
  }

  if (loading) return <PageSkeleton />;

  // Stats
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const thisMonth = reviews.filter((r) => new Date(r.sent_at) >= monthStart);
  const sentCount = thisMonth.length;
  const openedCount = thisMonth.filter((r) => r.opened).length;
  const submittedCount = thisMonth.filter((r) => r.submitted).length;
  const openRate = sentCount > 0 ? Math.round((openedCount / sentCount) * 100) : 0;
  const convRate = sentCount > 0 ? Math.round((submittedCount / sentCount) * 100) : 0;

  const inputCls = "mt-1 block w-full rounded-lg border border-gray-600 bg-[#0a1628] px-3 py-2 text-sm text-white focus:border-[#c8a951] focus:outline-none";

  return (
    <div className="space-y-6 p-6">
      <h1 className="text-2xl font-bold text-white">Review Requests</h1>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-lg bg-[#111d33] p-4">
          <p className="text-sm text-gray-400">Sent This Month</p>
          <p className="mt-1 text-2xl font-bold text-white">{sentCount}</p>
        </div>
        <div className="rounded-lg bg-[#111d33] p-4">
          <p className="text-sm text-gray-400">Open Rate</p>
          <p className="mt-1 text-2xl font-bold text-white">{openRate}%</p>
        </div>
        <div className="rounded-lg bg-[#111d33] p-4">
          <p className="text-sm text-gray-400">Conversion Rate</p>
          <p className="mt-1 text-2xl font-bold text-white">{convRate}%</p>
        </div>
      </div>

      {/* Manual Send */}
      <div className="rounded-lg bg-[#111d33] p-4">
        <h2 className="mb-3 text-lg font-semibold text-white">Manual Send</h2>
        <div className="flex gap-3">
          <input
            type="text"
            placeholder="Hired driver ID..."
            value={manualDriverId}
            onChange={(e) => setManualDriverId(e.target.value)}
            className={inputCls + " flex-1"}
          />
          <select
            value={manualPlatform}
            onChange={(e) => setManualPlatform(e.target.value)}
            className={inputCls + " w-32"}
          >
            <option value="google">Google</option>
            <option value="facebook">Facebook</option>
          </select>
          <button
            onClick={handleManualSend}
            disabled={sending}
            className="rounded-lg bg-[#c8a951] px-4 py-2 font-semibold text-[#0a1628] hover:bg-[#b8993e] disabled:opacity-50"
          >
            {sending ? "Sending..." : "Send"}
          </button>
        </div>
      </div>

      {/* Table / Cards */}
      {reviews.length === 0 ? (
        <EmptyState message="No review requests sent yet." />
      ) : (
        <>
          {/* Desktop Table */}
          <div className="hidden overflow-x-auto rounded-lg border border-gray-700/50 md:block">
            <table className="w-full text-left text-sm">
              <thead className="bg-[#111d33] text-xs uppercase text-gray-400">
                <tr>
                  <th className="px-4 py-3">Driver</th>
                  <th className="px-4 py-3">Platform</th>
                  <th className="px-4 py-3">Sent</th>
                  <th className="px-4 py-3">Opened</th>
                  <th className="px-4 py-3">Clicked</th>
                  <th className="px-4 py-3">Submitted</th>
                  <th className="px-4 py-3">Rating</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700/30">
                {reviews.map((r) => {
                  const name =
                    r.hired_drivers?.driver_leads?.full_name ??
                    r.driver_id.slice(0, 8);
                  return (
                    <tr key={r.id} className="hover:bg-white/5">
                      <td className="px-4 py-3 font-medium text-white">{name}</td>
                      <td className="px-4 py-3 capitalize text-gray-300">{r.platform}</td>
                      <td className="px-4 py-3 text-gray-400">{new Date(r.sent_at).toLocaleDateString()}</td>
                      <td className="px-4 py-3">{r.opened ? <span className="text-green-400">Yes</span> : <span className="text-gray-500">No</span>}</td>
                      <td className="px-4 py-3">{r.clicked ? <span className="text-green-400">Yes</span> : <span className="text-gray-500">No</span>}</td>
                      <td className="px-4 py-3">{r.submitted ? <span className="text-green-400">Yes</span> : <span className="text-gray-500">No</span>}</td>
                      <td className="px-4 py-3 text-[#c8a951]">{r.rating ?? "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards */}
          <div className="space-y-3 md:hidden">
            {reviews.map((r) => {
              const name =
                r.hired_drivers?.driver_leads?.full_name ??
                r.driver_id.slice(0, 8);
              return (
                <div key={r.id} className="rounded-lg bg-[#111d33] p-4">
                  <div className="flex items-center justify-between">
                    <p className="font-medium text-white">{name}</p>
                    <span className="capitalize text-sm text-gray-400">{r.platform}</span>
                  </div>
                  <p className="mt-1 text-xs text-gray-400">Sent: {new Date(r.sent_at).toLocaleDateString()}</p>
                  <div className="mt-2 flex gap-3 text-xs">
                    <span className={r.opened ? "text-green-400" : "text-gray-500"}>Opened: {r.opened ? "Yes" : "No"}</span>
                    <span className={r.clicked ? "text-green-400" : "text-gray-500"}>Clicked: {r.clicked ? "Yes" : "No"}</span>
                    <span className={r.submitted ? "text-green-400" : "text-gray-500"}>Submitted: {r.submitted ? "Yes" : "No"}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

export default function ReviewsPage() {
  return (
    <ErrorBoundary>
      <ReviewsContent />
    </ErrorBoundary>
  );
}
