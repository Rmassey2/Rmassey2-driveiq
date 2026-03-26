import { NextResponse } from "next/server";
import { svc } from "@/lib/supabase/service";

export async function GET() {
  const supabase = svc();

  const { data, error } = await supabase
    .from("cmo_reports")
    .select("*")
    .order("report_month", { ascending: false });

  if (error)
    return NextResponse.json({ error: "Query failed" }, { status: 500 });
  return NextResponse.json(data ?? []);
}
