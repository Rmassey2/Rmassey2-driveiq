export async function sendSMS(
  to: string,
  body: string,
  fromOverride?: string
): Promise<{ success: boolean; sid?: string; error?: string }> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const messagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID;
  const defaultFrom = process.env.TWILIO_FROM_NUMBER;

  // Precedence: explicit fromOverride > messaging service > default from-number.
  const sender: { type: "from"; value: string } | { type: "service"; value: string } | null =
    fromOverride
      ? { type: "from", value: fromOverride }
      : messagingServiceSid
        ? { type: "service", value: messagingServiceSid }
        : defaultFrom
          ? { type: "from", value: defaultFrom }
          : null;

  if (!accountSid || !authToken || !sender) {
    console.warn("Twilio not configured — skipping SMS");
    return { success: false, error: "Twilio not configured" };
  }

  const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
  const params = new URLSearchParams({ To: to, Body: body });
  if (sender.type === "service") {
    params.set("MessagingServiceSid", sender.value);
  } else {
    params.set("From", sender.value);
  }

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: "Basic " + Buffer.from(`${accountSid}:${authToken}`).toString("base64"),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  });

  const data = await res.json();
  if (!res.ok) {
    console.error("Twilio error:", data);
    return { success: false, error: data.message ?? "SMS send failed" };
  }
  return { success: true, sid: data.sid };
}
