import { Resend } from "resend";

export interface SendEmailConfig {
  apiKey: string;
  from: string;
}

export interface SendEmailInput {
  html: string;
  subject: string;
  text: string;
  to: string;
}

export async function sendEmail(
  config: SendEmailConfig,
  input: SendEmailInput
): Promise<void> {
  const resend = new Resend(config.apiKey);
  const { error } = await resend.emails.send({
    from: config.from,
    html: input.html,
    subject: input.subject,
    text: input.text,
    to: input.to,
  });

  if (error) {
    throw new Error(error.message);
  }
}

export function verificationEmailContent(url: string): {
  html: string;
  text: string;
} {
  return {
    html: `<p>Verify your email address by clicking the link below:</p><p><a href="${url}">Verify email</a></p><p>If you did not create an account, you can ignore this message.</p>`,
    text: `Verify your email address: ${url}\n\nIf you did not create an account, you can ignore this message.`,
  };
}

export function resetPasswordEmailContent(url: string): {
  html: string;
  text: string;
} {
  return {
    html: `<p>Reset your password by clicking the link below:</p><p><a href="${url}">Reset password</a></p><p>If you did not request a reset, you can ignore this message.</p>`,
    text: `Reset your password: ${url}\n\nIf you did not request a reset, you can ignore this message.`,
  };
}
