"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

interface NavItem {
  label: string;
  href: string;
  roles: string[];
}

const navItems: NavItem[] = [
  { label: "Home", href: "/dashboard", roles: ["admin", "recruiter", "safety", "dm"] },
  { label: "Pipeline", href: "/dashboard/pipeline", roles: ["admin", "recruiter"] },
  { label: "Import Tenstreet", href: "/dashboard/pipeline/import", roles: ["admin"] },
  { label: "Check-ins", href: "/dashboard/checkins", roles: ["admin", "recruiter"] },
  { label: "My Drivers", href: "/dashboard/drivers", roles: ["admin", "dm"] },
  { label: "Retention", href: "/dashboard/retention", roles: ["admin", "safety", "dm"] },
  { label: "Ret. Check-ins", href: "/dashboard/retention/checkins", roles: ["admin", "safety", "dm"] },
  { label: "Risk Flags", href: "/dashboard/retention/flags", roles: ["admin", "safety", "dm"] },
  { label: "AI CMO", href: "/dashboard/ai-cmo", roles: ["admin"] },
  { label: "CMO Inbox", href: "/dashboard/ai-cmo/inbox", roles: ["admin"] },
  { label: "Ad Studio", href: "/dashboard/ai-cmo/ads", roles: ["admin"] },
  { label: "Content Calendar", href: "/dashboard/ai-cmo/content", roles: ["admin"] },
  { label: "Reviews", href: "/dashboard/ai-cmo/reviews", roles: ["admin"] },
  { label: "Reports", href: "/dashboard/reports", roles: ["admin"] },
  { label: "CMO Reports", href: "/dashboard/reports/cmo-report", roles: ["admin"] },
];

export default function Sidebar({
  role,
  userName,
}: {
  role: string;
  userName: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const visible = navItems.filter((item) => item.roles.includes(role));

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  }

  return (
    <aside className="flex w-64 flex-col border-r border-gray-700/50 bg-[#111d33]">
      {/* Branding */}
      <div className="border-b border-gray-700/50 px-6 py-5">
        <h2 className="text-lg font-bold text-[#c8a951]">DriveIQ</h2>
        <p className="mt-1 truncate text-xs text-gray-400">{userName}</p>
        <span className="mt-1 inline-block rounded-full bg-[#c8a951]/10 px-2 py-0.5 text-xs capitalize text-[#c8a951]">
          {role}
        </span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {visible.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`block rounded-lg px-3 py-2 text-sm font-medium transition ${
                active
                  ? "bg-[#c8a951]/10 text-[#c8a951]"
                  : "text-gray-300 hover:bg-white/5 hover:text-white"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Sign Out */}
      <div className="border-t border-gray-700/50 px-3 py-4">
        <button
          onClick={handleSignOut}
          className="block w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-gray-400 transition hover:bg-red-500/10 hover:text-red-400"
        >
          Sign Out
        </button>
      </div>
    </aside>
  );
}
