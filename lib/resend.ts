export async function sendEmail(
  to: string,
  subject: string,
  html: string,
  from?: string
): Promise<{ success: boolean; id?: string; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn("Resend not configured — skipping email");
    return { success: false, error: "Resend not configured" };
  }

  const fromAddr = from ?? process.env.RESEND_FROM_RECRUITING ?? "recruiting@macotransport.com";

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from: fromAddr, to, subject, html }),
  });

  const data = await res.json();
  if (!res.ok) {
    console.error("Resend error:", data);
    return { success: false, error: data.message ?? "Email send failed" };
  }
  return { success: true, id: data.id };
}
