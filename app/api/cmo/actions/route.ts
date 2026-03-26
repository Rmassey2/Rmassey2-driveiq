import { NextResponse } from "next/server";
import { svc } from "@/lib/supabase/service";

export async function GET() {
  const supabase = svc();
  const { data, error } = await supabase
    .from("autonomous_actions")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) return NextResponse.json({ error: "Query failed" }, { status: 500 });
  return NextResponse.json(data ?? []);
}
