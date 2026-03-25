"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

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
  { label: "Retention", href: "/dashboard/retention", roles: ["admin", "safety"] },
  { label: "AI CMO", href: "/dashboard/ai-cmo", roles: ["admin"] },
  { label: "Reports", href: "/dashboard/reports", roles: ["admin"] },
];

export default function Sidebar({
  role,
  userName,
}: {
  role: string;
  userName: string;
}) {
  const pathname = usePathname();
  const visible = navItems.filter((item) => item.roles.includes(role));

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
      <nav className="flex-1 space-y-1 px-3 py-4">
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
    </aside>
  );
}
