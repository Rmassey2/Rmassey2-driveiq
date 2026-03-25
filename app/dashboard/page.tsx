import { createClient } from "@/lib/supabase/server";

export default async function DashboardHome() {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: member } = await supabase
    .from("org_members")
    .select("role, full_name")
    .eq("user_id", user!.id)
    .single();

  const name = member?.full_name ?? user?.email ?? "there";
  const role = member?.role ?? "viewer";

  return (
    <div>
      <h1 className="text-3xl font-bold text-white">
        Welcome back, {name}
      </h1>
      <p className="mt-2 text-gray-400">
        Role: <span className="capitalize text-[#c8a951]">{role}</span>
      </p>
    </div>
  );
}
