"use client";

import { useEffect, useState } from "react";

interface InboxItem {
  id: string;
  item_type: string;
  title: string;
  description: string | null;
  priority: string;
  status: string;
  meta: Record<string, unknown> | null;
  created_at: string;
}

const EXECUTABLE_ACTIONS = new Set([
  "pause_adset",
  "pause_campaign",
  "shift_budget",
]);

export default function CmoInboxPage() {
  const [items, setItems] = useState<InboxItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Record<string, { type: "success" | "error"; message: string }>>({});

  async function loadItems() {
    const res = await fetch("/api/cmo/inbox?status=pending");
    if (res.ok) {
      const data: InboxItem[] = await res.json();
      const priorityOrder: Record<string, number> = {
        high: 0,
        medium: 1,
        low: 2,
      };
      data.sort(
        (a, b) =>
          (priorityOrder[a.priority] ?? 9) - (priorityOrder[b.priority] ?? 9)
      );
      setItems(data);
    }
    setLoading(false);
  }

  useEffect(() => {
    loadItems();
  }, []);

  function setItemFeedback(id: string, type: "success" | "error", message: string) {
    setFeedback((f) => ({ ...f, [id]: { type, message } }));
  }

  function clearItemFeedback(id: string) {
    setFeedback((f) => {
      const next = { ...f };
      delete next[id];
      return next;
    });
  }

  async function handleAction(id: string, status: string) {
    setActionLoading(id);
    clearItemFeedback(id);
    const res = await fetch(`/api/cmo/inbox/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (res.ok) {
      setItems((prev) => prev.filter((i) => i.id !== id));
    } else {
      const data = await safeJson(res);
      setItemFeedback(id, "error", asString(data?.error) ?? `Update failed (${res.status})`);
    }
    setActionLoading(null);
  }

  async function handleExecute(id: string) {
    setActionLoading(id);
    clearItemFeedback(id);
    const res = await fetch(`/api/cmo/inbox/${id}/execute`, {
      method: "POST",
    });
    const data = await safeJson(res);
    if (res.ok && data?.ok) {
      const detail = asString(data.detail) ?? "completed";
      const msg = data.executed
        ? `Executed: ${detail}`
        : `Approved (manual action required): ${detail}`;
      setItemFeedback(id, "success", msg);
      setTimeout(() => {
        setItems((prev) => prev.filter((i) => i.id !== id));
      }, 1500);
    } else {
      setItemFeedback(id, "error", asString(data?.error) ?? `Execute failed (${res.status})`);
    }
    setActionLoading(null);
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-gray-400">Loading inbox…</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <h1 className="text-2xl font-bold text-white">CMO Approval Inbox</h1>
      <p className="text-sm text-gray-400">
        {items.length} pending item{items.length !== 1 ? "s" : ""} requiring
        your review
      </p>

      {items.length === 0 ? (
        <div className="rounded-lg bg-[#111d33] p-8 text-center">
          <p className="text-gray-400">All caught up — no pending approvals.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {items.map((item) => {
            const meta = item.meta ?? {};
            const actionType =
              typeof meta.action_type === "string" ? meta.action_type : null;
            const proposedBudget =
              typeof meta.proposed_daily_budget_dollars === "number"
                ? meta.proposed_daily_budget_dollars
                : null;
            const campaignId =
              typeof meta.campaign_id === "string" ? meta.campaign_id : null;
            const adsetId =
              typeof meta.adset_id === "string" ? meta.adset_id : null;
            const utmContent =
              typeof meta.utm_content === "string" ? meta.utm_content : null;
            const isMetaOpt = item.item_type === "meta_optimization";
            const canExecute = isMetaOpt && actionType !== null && EXECUTABLE_ACTIONS.has(actionType);
            const fb = feedback[item.id];

            return (
              <div
                key={item.id}
                className="rounded-lg border border-gray-700/50 bg-[#111d33] p-4"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          item.priority === "high"
                            ? "bg-red-500/10 text-red-400"
                            : item.priority === "medium"
                              ? "bg-yellow-500/10 text-yellow-400"
                              : "bg-green-500/10 text-green-400"
                        }`}
                      >
                        {item.priority}
                      </span>
                      <span className="rounded-full bg-[#c8a951]/10 px-2 py-0.5 text-xs text-[#c8a951]">
                        {item.item_type}
                      </span>
                      {actionType && (
                        <span className="rounded-full bg-blue-500/10 px-2 py-0.5 text-xs text-blue-300">
                          {actionType}
                        </span>
                      )}
                    </div>
                    <h3 className="mt-2 text-lg font-semibold text-white">
                      {item.title}
                    </h3>
                    {item.description && (
                      <p className="mt-1 text-sm text-gray-300">
                        {item.description}
                      </p>
                    )}
                    {(campaignId || adsetId || utmContent || proposedBudget !== null) && (
                      <div className="mt-2 flex flex-wrap gap-3 text-xs text-gray-400">
                        {campaignId && <span>campaign: <span className="font-mono text-gray-300">{campaignId}</span></span>}
                        {adsetId && <span>ad set: <span className="font-mono text-gray-300">{adsetId}</span></span>}
                        {utmContent && <span>utm_content: <span className="font-mono text-gray-300">{utmContent}</span></span>}
                        {proposedBudget !== null && (
                          <span>
                            proposed daily budget:{" "}
                            <span className="font-mono text-gray-300">${proposedBudget}</span>
                          </span>
                        )}
                      </div>
                    )}
                    <p className="mt-2 text-xs text-gray-500">
                      {new Date(item.created_at).toLocaleString()}
                    </p>
                  </div>
                </div>

                {fb && (
                  <div
                    className={`mt-3 rounded-md px-3 py-2 text-sm ${
                      fb.type === "success"
                        ? "bg-green-500/10 text-green-300"
                        : "bg-red-500/10 text-red-300"
                    }`}
                  >
                    {fb.message}
                  </div>
                )}

                <div className="mt-4 flex flex-wrap gap-2">
                  {canExecute && (
                    <button
                      onClick={() => handleExecute(item.id)}
                      disabled={actionLoading === item.id}
                      className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50"
                      title="Apply this change directly to Meta via the Ads API"
                    >
                      {actionLoading === item.id ? "Working…" : "Approve & Execute"}
                    </button>
                  )}
                  <button
                    onClick={() => handleAction(item.id, "approved")}
                    disabled={actionLoading === item.id}
                    className={`rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-50 ${
                      canExecute
                        ? "bg-[#111d33] text-gray-200 ring-1 ring-gray-600 hover:bg-gray-700"
                        : "bg-green-600 text-white hover:bg-green-700"
                    }`}
                    title={canExecute ? "Mark approved without calling the Meta API" : "Approve"}
                  >
                    {canExecute ? "Approve (manual)" : "Approve"}
                  </button>
                  {!isMetaOpt && (
                    <button
                      onClick={() => handleAction(item.id, "edited")}
                      disabled={actionLoading === item.id}
                      className="rounded-lg bg-[#c8a951] px-4 py-2 text-sm font-semibold text-[#0a1628] hover:bg-[#b8993e] disabled:opacity-50"
                    >
                      Edit
                    </button>
                  )}
                  <button
                    onClick={() => handleAction(item.id, "dismissed")}
                    disabled={actionLoading === item.id}
                    className="rounded-lg bg-gray-600 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-700 disabled:opacity-50"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

async function safeJson(res: Response): Promise<Record<string, unknown> | null> {
  try {
    return (await res.json()) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function asString(v: unknown): string | null {
  return typeof v === "string" ? v : null;
}
