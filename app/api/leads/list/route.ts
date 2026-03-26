import { NextRequest, NextResponse } from "next/server";
import { svc } from "@/lib/supabase/service";

export async function GET(req: NextRequest) {
  const supabase = svc();

  const orgSlug = req.nextUrl.searchParams.get("org") ?? "maco-transport";
  const disposition = req.nextUrl.searchParams.get("disposition"); // comma-separated
  const dnh = req.nextUrl.searchParams.get("dnh");

  const { data: org } = await supabase
    .from("organizations")
    .select("id")
    .eq("slug", orgSlug)
    .single();

  if (!org) return NextResponse.json({ error: "Org not found" }, { status: 500 });

  let query = supabase
    .from("driver_leads")
    .select("*")
    .eq("org_id", org.id)
    .order("lead_score", { ascending: false });

  if (disposition) {
    query = query.in("disposition", disposition.split(","));
  }

  if (dnh === "false") {
    query = query.eq("do_not_hire", false);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: "Query failed" }, { status: 500 });
  return NextResponse.json(data ?? []);
}
