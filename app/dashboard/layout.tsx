import { redirect } from "next/navigation";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import Sidebar from "./sidebar";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const svc = createServiceClient();
  const { data: member } = await svc
    .from("org_members")
    .select("role, full_name")
    .eq("user_id", user.id)
    .single();

  const role = (member?.role as string) ?? "viewer";
  const fullName = (member?.full_name as string) ?? user.email ?? "User";

  return (
    <div className="flex min-h-screen bg-[#0a1628]">
      <Sidebar role={role} userName={fullName} />
      <main className="flex-1 p-8">{children}</main>
    </div>
  );
}
