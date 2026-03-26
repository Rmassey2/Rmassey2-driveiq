import { createClient, createServiceClient } from "@/lib/supabase/server";
import Link from "next/link";

export default async function DashboardHome() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const svc = createServiceClient();
  const { data: member } = await svc
    .from("org_members")
    .select("role, full_name, org_id")
    .eq("user_id", user!.id)
    .single();

  const name = member?.full_name ?? user?.email ?? "there";
  const role = member?.role ?? "viewer";
  const orgId = member?.org_id;

  // Fetch counts
  let priorityLeads = 0;
  let overdueCheckins = 0;
  let openFlags = 0;
  let pendingApprovals = 0;

  interface PipelineEventRow {
    id: string;
    driver_id: string;
    from_disposition: string | null;
    to_disposition: string | null;
    from_stage: number | null;
    to_stage: number | null;
    occurred_at: string;
    note: string | null;
    driver_leads?: { full_name: string } | null;
  }
  let recentEvents: PipelineEventRow[] = [];

  if (orgId) {
    const today = new Date().toISOString().split("T")[0];

    const [leadsRes, checkinsRes, flagsRes, inboxRes, eventsRes] = await Promise.all([
      svc
        .from("driver_leads")
        .select("id", { count: "exact", head: true })
        .eq("org_id", orgId)
        .gte("lead_score", 70)
        .in("disposition", ["active", "considering"])
        .lt("last_contact_at", today + "T00:00:00"),
      svc
        .from("checkins")
        .select("id", { count: "exact", head: true })
        .eq("org_id", orgId)
        .is("completed_at", null)
        .lt("scheduled_at", today),
      svc
        .from("retention_flags")
        .select("id", { count: "exact", head: true })
        .eq("org_id", orgId)
        .eq("resolved", false),
      svc
        .from("cmo_inbox_items")
        .select("id", { count: "exact", head: true })
        .eq("org_id", orgId)
        .eq("status", "pending"),
      svc
        .from("pipeline_events")
        .select("id, driver_id, from_disposition, to_disposition, from_stage, to_stage, occurred_at, note, driver_leads:driver_id(full_name)")
        .eq("org_id", orgId)
        .order("occurred_at", { ascending: false })
        .limit(10),
    ]);

    priorityLeads = leadsRes.count ?? 0;
    overdueCheckins = checkinsRes.count ?? 0;
    openFlags = flagsRes.count ?? 0;
    pendingApprovals = inboxRes.count ?? 0;
    recentEvents = (eventsRes.data as unknown as PipelineEventRow[]) ?? [];
  }

  function describeEvent(e: PipelineEventRow): string {
    const driverName =
      e.driver_leads?.full_name ?? "Unknown";
    if (e.to_disposition && e.from_disposition) {
      return `${driverName}: ${e.from_disposition} → ${e.to_disposition}`;
    }
    if (e.to_stage !== null && e.from_stage !== null) {
      return `${driverName}: stage ${e.from_stage} → ${e.to_stage}`;
    }
    return `${driverName}: updated`;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white">
          Welcome back, {name}
        </h1>
        <p className="mt-2 text-gray-400">
          Role: <span className="capitalize text-[#c8a951]">{role}</span>
        </p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Link href="/dashboard/pipeline" className="block">
          <div className="rounded-lg bg-[#111d33] p-4 transition hover:border-[#c8a951]/50 border border-transparent">
            <p className="text-sm text-gray-400">Priority Leads</p>
            <p className={`mt-1 text-2xl font-bold ${priorityLeads > 0 ? "text-[#c8a951]" : "text-white"}`}>
              {priorityLeads}
            </p>
            <p className="mt-1 text-xs text-gray-500">Score 70+ not contacted today</p>
          </div>
        </Link>
        <Link href="/dashboard/retention/checkins" className="block">
          <div className="rounded-lg bg-[#111d33] p-4 transition hover:border-[#c8a951]/50 border border-transparent">
            <p className="text-sm text-gray-400">Overdue Check-ins</p>
            <p className={`mt-1 text-2xl font-bold ${overdueCheckins > 0 ? "text-red-400" : "text-white"}`}>
              {overdueCheckins}
            </p>
          </div>
        </Link>
        <Link href="/dashboard/retention/flags" className="block">
          <div className="rounded-lg bg-[#111d33] p-4 transition hover:border-[#c8a951]/50 border border-transparent">
            <p className="text-sm text-gray-400">Open Retention Flags</p>
            <p className={`mt-1 text-2xl font-bold ${openFlags > 0 ? "text-yellow-400" : "text-white"}`}>
              {openFlags}
            </p>
          </div>
        </Link>
        {role === "admin" && (
          <Link href="/dashboard/ai-cmo/inbox" className="block">
            <div className="rounded-lg bg-[#111d33] p-4 transition hover:border-[#c8a951]/50 border border-transparent">
              <p className="text-sm text-gray-400">Pending CMO Approvals</p>
              <p className={`mt-1 text-2xl font-bold ${pendingApprovals > 0 ? "text-[#c8a951]" : "text-white"}`}>
                {pendingApprovals}
              </p>
            </div>
          </Link>
        )}
      </div>

      {/* Recent Activity */}
      <div className="rounded-lg bg-[#111d33] p-4">
        <h2 className="mb-3 text-lg font-semibold text-white">Recent Activity</h2>
        {recentEvents.length === 0 ? (
          <p className="text-sm text-gray-400">No recent pipeline activity.</p>
        ) : (
          <ul className="space-y-2">
            {recentEvents.map((e) => (
              <li key={e.id} className="flex items-center justify-between rounded-md bg-[#0a1628] px-3 py-2">
                <p className="text-sm text-gray-300">{describeEvent(e)}</p>
                <p className="text-xs text-gray-500">
                  {new Date(e.occurred_at).toLocaleDateString()}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
