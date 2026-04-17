const DEFAULT_NOTIFY_EMAIL = "rahulsheregar1999@gmail.com";

/**
 * Sends transactional mail through Resend’s HTTP API.
 *
 * Env: `RESEND_API_KEY` (required to send), `NOTIFY_EMAIL` (to), `EMAIL_FROM` (from).
 * Without a key, logs a warning and returns false so callers can keep running.
 *
 * `extra` is not sent to Resend; it is only included in server logs when the key is missing.
 */
export async function sendEmail(
  subject: string,
  content: string,
  extra: Record<string, unknown> | null = null,
): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const to = (process.env.NOTIFY_EMAIL?.trim() || DEFAULT_NOTIFY_EMAIL).trim();
  const from =
    process.env.EMAIL_FROM?.trim() || "Recura <onboarding@resend.dev>";

  if (!apiKey) {
    console.warn(
      "[email] RESEND_API_KEY is not set; skipping send. Set it in .env.local to deliver mail.",
      { to, subject, extra },
    );
    return false;
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [to],
        subject,
        text: content,
      }),
    });

    const data = (await res.json().catch(() => ({}))) as { message?: string };
    if (!res.ok) {
      console.error("[email] Resend error", res.status, data?.message ?? data);
      return false;
    }
    return true;
  } catch (e) {
    console.error("[email] send failed", e instanceof Error ? e.message : e);
    return false;
  }
}
