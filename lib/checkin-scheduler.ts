import type { SupabaseClient } from "@supabase/supabase-js";

const CHECKIN_SCHEDULE: { type: string; daysAfterHire: number }[] = [
  { type: "day_1", daysAfterHire: 1 },
  { type: "day_7", daysAfterHire: 7 },
  { type: "day_30", daysAfterHire: 30 },
  { type: "day_60", daysAfterHire: 60 },
  { type: "day_90", daysAfterHire: 90 },
  { type: "day_180", daysAfterHire: 180 },
  { type: "annual", daysAfterHire: 365 },
];

export async function scheduleCheckins(
  supabase: SupabaseClient,
  orgId: string,
  driverId: string,
  hireDate: string
) {
  const hire = new Date(hireDate);
  const rows = CHECKIN_SCHEDULE.map((c) => {
    const d = new Date(hire);
    d.setDate(d.getDate() + c.daysAfterHire);
    return {
      org_id: orgId,
      driver_id: driverId,
      checkin_type: c.type,
      scheduled_at: d.toISOString().split("T")[0],
    };
  });
  await supabase.from("checkins").insert(rows);
}
