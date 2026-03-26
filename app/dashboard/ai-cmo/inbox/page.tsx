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

export default function CmoInboxPage() {
  const [items, setItems] = useState<InboxItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  async function loadItems() {
    const res = await fetch("/api/cmo/inbox?status=pending");
    if (res.ok) {
      const data: InboxItem[] = await res.json();
      // Sort by priority: high > medium > low
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

  async function handleAction(id: string, status: string) {
    setActionLoading(id);
    const res = await fetch(`/api/cmo/inbox/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (res.ok) {
      setItems((prev) => prev.filter((i) => i.id !== id));
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
          {items.map((item) => (
            <div
              key={item.id}
              className="rounded-lg border border-gray-700/50 bg-[#111d33] p-4"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
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
                  </div>
                  <h3 className="mt-2 text-lg font-semibold text-white">
                    {item.title}
                  </h3>
                  {item.description && (
                    <p className="mt-1 text-sm text-gray-300">
                      {item.description}
                    </p>
                  )}
                  <p className="mt-2 text-xs text-gray-500">
                    {new Date(item.created_at).toLocaleString()}
                  </p>
                </div>
              </div>

              <div className="mt-4 flex gap-2">
                <button
                  onClick={() => handleAction(item.id, "approved")}
                  disabled={actionLoading === item.id}
                  className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50"
                >
                  Approve
                </button>
                <button
                  onClick={() => handleAction(item.id, "edited")}
                  disabled={actionLoading === item.id}
                  className="rounded-lg bg-[#c8a951] px-4 py-2 text-sm font-semibold text-[#0a1628] hover:bg-[#b8993e] disabled:opacity-50"
                >
                  Edit
                </button>
                <button
                  onClick={() => handleAction(item.id, "dismissed")}
                  disabled={actionLoading === item.id}
                  className="rounded-lg bg-gray-600 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-700 disabled:opacity-50"
                >
                  Dismiss
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
