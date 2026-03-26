"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface InboxItem {
  id: string;
  item_type: string;
  title: string;
  description: string | null;
  priority: string;
  status: string;
  created_at: string;
}

interface AutonomousAction {
  id: string;
  action_type: string;
  description: string;
  created_at: string;
}

export default function AiCmoDashboard() {
  const [pendingCount, setPendingCount] = useState(0);
  const [actionsThisMonth, setActionsThisMonth] = useState(0);
  const [activeCampaigns, setActiveCampaigns] = useState(0);
  const [inboxItems, setInboxItems] = useState<InboxItem[]>([]);
  const [recentActions, setRecentActions] = useState<AutonomousAction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      // Fetch inbox items (pending)
      const inboxRes = await fetch("/api/cmo/inbox?status=pending");
      const inbox: InboxItem[] = inboxRes.ok ? await inboxRes.json() : [];
      setInboxItems(inbox.slice(0, 5));
      setPendingCount(inbox.length);

      // Fetch campaigns
      const campaignsRes = await fetch("/api/cmo/campaigns");
      const campaigns = campaignsRes.ok ? await campaignsRes.json() : [];
      setActiveCampaigns(
        campaigns.filter((c: { status: string }) => c.status !== "archived").length
      );

      // Fetch autonomous actions
      const actionsRes = await fetch("/api/cmo/actions");
      const allActions: AutonomousAction[] = actionsRes.ok ? await actionsRes.json() : [];
      setRecentActions(allActions.slice(0, 5));

      // Count this month
      const monthStart = new Date();
      monthStart.setDate(1);
      monthStart.setHours(0, 0, 0, 0);
      setActionsThisMonth(
        allActions.filter(
          (a: AutonomousAction) => new Date(a.created_at) >= monthStart
        ).length
      );

      setLoading(false);
    }
    load();
  }, []);

  const googleReviewLink = process.env.NEXT_PUBLIC_GOOGLE_REVIEW_LINK || "#";

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-gray-400">Loading AI CMO…</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <h1 className="text-2xl font-bold text-white">AI CMO Dashboard</h1>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Pending Approvals"
          value={pendingCount}
          href="/dashboard/ai-cmo/inbox"
        />
        <StatCard
          label="Autonomous Actions (Month)"
          value={actionsThisMonth}
        />
        <StatCard
          label="Active Campaigns"
          value={activeCampaigns}
          href="/dashboard/ai-cmo/ads"
        />
        <div className="rounded-lg bg-[#111d33] p-4">
          <p className="text-sm text-gray-400">Google Reviews</p>
          <a
            href={googleReviewLink}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1 inline-block text-sm font-semibold text-[#c8a951] hover:underline"
          >
            Open Review Link →
          </a>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* CMO Inbox Preview */}
        <div className="rounded-lg bg-[#111d33] p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">CMO Inbox</h2>
            <Link
              href="/dashboard/ai-cmo/inbox"
              className="text-sm text-[#c8a951] hover:underline"
            >
              View All
            </Link>
          </div>
          {inboxItems.length === 0 ? (
            <p className="text-sm text-gray-400">No pending items</p>
          ) : (
            <ul className="space-y-2">
              {inboxItems.map((item) => (
                <li
                  key={item.id}
                  className="flex items-center justify-between rounded-md bg-[#0a1628] px-3 py-2"
                >
                  <div>
                    <p className="text-sm font-medium text-white">
                      {item.title}
                    </p>
                    <p className="text-xs text-gray-400">{item.item_type}</p>
                  </div>
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
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Recent Autonomous Actions */}
        <div className="rounded-lg bg-[#111d33] p-4">
          <h2 className="mb-3 text-lg font-semibold text-white">
            Recent Autonomous Actions
          </h2>
          {recentActions.length === 0 ? (
            <p className="text-sm text-gray-400">No recent actions</p>
          ) : (
            <ul className="space-y-2">
              {recentActions.map((action) => (
                <li
                  key={action.id}
                  className="rounded-md bg-[#0a1628] px-3 py-2"
                >
                  <p className="text-sm font-medium text-white">
                    {action.description}
                  </p>
                  <p className="text-xs text-gray-400">
                    {action.action_type} —{" "}
                    {new Date(action.created_at).toLocaleDateString()}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Quick Nav */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <NavCard
          title="Approval Inbox"
          desc="Review and approve AI-generated content"
          href="/dashboard/ai-cmo/inbox"
        />
        <NavCard
          title="Ad Studio"
          desc="Generate and manage Facebook ads"
          href="/dashboard/ai-cmo/ads"
        />
        <NavCard
          title="Content Calendar"
          desc="Weekly social media content plan"
          href="/dashboard/ai-cmo/content"
        />
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  href,
}: {
  label: string;
  value: number;
  href?: string;
}) {
  const inner = (
    <div className="rounded-lg bg-[#111d33] p-4">
      <p className="text-sm text-gray-400">{label}</p>
      <p className="mt-1 text-2xl font-bold text-white">{value}</p>
    </div>
  );
  if (href) {
    return (
      <Link href={href} className="block hover:opacity-80 transition">
        {inner}
      </Link>
    );
  }
  return inner;
}

function NavCard({
  title,
  desc,
  href,
}: {
  title: string;
  desc: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="block rounded-lg border border-gray-700/50 bg-[#111d33] p-4 transition hover:border-[#c8a951]/50"
    >
      <h3 className="font-semibold text-[#c8a951]">{title}</h3>
      <p className="mt-1 text-sm text-gray-400">{desc}</p>
    </Link>
  );
}
