/**
 * Outbound mail, through the same provider the intake form uses.
 *
 * Plain text only. A sign-in link and a note to the office do not need a
 * layout, and plain text is what survives every mail client and every
 * screen reader. Returns whether the provider accepted the message: the
 * caller decides what that means, and never tells a person something was sent
 * when it was not.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { env, mailConfigured } from './env';

export interface Mail {
  to: string;
  subject: string;
  text: string;
  replyTo?: string;
}

export async function sendMail(mail: Mail): Promise<boolean> {
  if (!mailConfigured()) return false;

  // The development sink: one file per message, nothing leaves the machine.
  if (env.mailSink) {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    await mkdir(env.mailSink, { recursive: true });
    await writeFile(
      path.join(env.mailSink, `${stamp}-${Math.random().toString(36).slice(2, 8)}.txt`),
      `To: ${mail.to}\nReply-To: ${mail.replyTo ?? ''}\nSubject: ${mail.subject}\n\n${mail.text}\n`,
      'utf8',
    );
    return true;
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.resendKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: env.from,
      to: [mail.to],
      reply_to: mail.replyTo,
      subject: mail.subject,
      text: mail.text,
    }),
  });

  if (!response.ok) {
    // The status and nothing else: the body could carry the address.
    console.error(`portal: mail provider returned ${response.status}`);
    return false;
  }
  return true;
}
