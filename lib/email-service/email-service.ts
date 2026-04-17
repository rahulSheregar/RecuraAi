export function sendEmail(
  subject: string,
  content: string,
  extra: Record<string, unknown> | null = null,
) {
  console.log(
    `Sending email with subject ${subject} and content ${content} extra: ${JSON.stringify(
      extra,
    )}`,
  );
}