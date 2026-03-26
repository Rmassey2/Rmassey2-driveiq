import type { SupabaseClient } from "@supabase/supabase-js";
import { sendSMS } from "./twilio";
import { sendEmail } from "./resend";

export async function sendYellowAlert(
  supabase: SupabaseClient,
  orgId: string,
  driverId: string,
  driverName: string,
  score: number,
  dmPhone: string | null
) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://driveiq-virid.vercel.app";
  const msg = `YELLOW ALERT — ${driverName} retention risk score is ${score}. Please check in with them today. DriveIQ dashboard: ${appUrl}/dashboard/retention/${driverId}`;

  await supabase.from("autonomous_actions").insert({
    org_id: orgId,
    action_type: "yellow_alert",
    description: `Yellow alert for ${driverName} (score: ${score})`,
    reasoning: "Retention risk score crossed threshold of 6",
    affected_record_id: driverId,
    affected_table: "hired_drivers",
  });

  if (dmPhone) await sendSMS(dmPhone, msg);
}

export async function sendRedAlert(
  supabase: SupabaseClient,
  orgId: string,
  driverId: string,
  driverName: string,
  score: number,
  flags: { trigger_type: string; risk_points: number }[],
  dmPhone: string | null
) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://driveiq-virid.vercel.app";
  const adminPhone = process.env.ADMIN_PHONE;
  const adminEmail = "rmassey@macotransport.com";

  const smsMsg = `RED ALERT — ${driverName} retention risk score is ${score}. Immediate action required. ${appUrl}/dashboard/retention/${driverId}`;

  await supabase.from("autonomous_actions").insert({
    org_id: orgId,
    action_type: "red_alert",
    description: `Red alert for ${driverName} (score: ${score})`,
    reasoning: "Retention risk score crossed threshold of 8",
    affected_record_id: driverId,
    affected_table: "hired_drivers",
    meta: { flags },
  });

  if (dmPhone) await sendSMS(dmPhone, smsMsg);
  if (adminPhone) await sendSMS(adminPhone, smsMsg);

  const flagList = flags.map((f) => `• ${f.trigger_type} (+${f.risk_points})`).join("\n");
  await sendEmail(
    adminEmail,
    `RED ALERT — Immediate Action Required — ${driverName}`,
    `<h2>RED ALERT — ${driverName}</h2>
     <p>Retention risk score: <strong>${score}</strong></p>
     <h3>Active Flags:</h3>
     <pre>${flagList}</pre>
     <p><a href="${appUrl}/dashboard/retention/${driverId}">View in DriveIQ</a></p>`
  );
}
