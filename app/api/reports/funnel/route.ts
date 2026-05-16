import { NextResponse } from "next/server";
import { svc } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";

interface FunnelRow {
  utm_source: string;
  utm_campaign: string;
  utm_content: string;
  page_views: number;
  form_starts: number;
  form_submits: number;
  form_errors: number;
}

export async function GET() {
  const supabase = svc();
  const { data, error } = await supabase
    .from("v_landing_funnel")
    .select("*");

  if (error) {
    return NextResponse.json(
      { error: error.message, rows: [], totals: emptyTotals() },
      { status: 500 }
    );
  }

  const rows = ((data as FunnelRow[] | null) ?? []).map((r) => {
    const pv_to_fs = r.page_views ? Math.round((r.form_starts / r.page_views) * 100) : 0;
    const fs_to_sub = r.form_starts ? Math.round((r.form_submits / r.form_starts) * 100) : 0;
    const pv_to_sub = r.page_views ? Math.round((r.form_submits / r.page_views) * 100) : 0;
    return { ...r, pv_to_fs_pct: pv_to_fs, fs_to_sub_pct: fs_to_sub, pv_to_sub_pct: pv_to_sub };
  });

  const totals = rows.reduce(
    (acc, r) => {
      acc.page_views += r.page_views;
      acc.form_starts += r.form_starts;
      acc.form_submits += r.form_submits;
      acc.form_errors += r.form_errors;
      return acc;
    },
    emptyTotals()
  );
  totals.pv_to_sub_pct = totals.page_views
    ? Math.round((totals.form_submits / totals.page_views) * 100)
    : 0;

  rows.sort((a, b) => b.page_views - a.page_views);

  return NextResponse.json({ rows, totals });
}

function emptyTotals() {
  return {
    page_views: 0,
    form_starts: 0,
    form_submits: 0,
    form_errors: 0,
    pv_to_sub_pct: 0,
  };
}
