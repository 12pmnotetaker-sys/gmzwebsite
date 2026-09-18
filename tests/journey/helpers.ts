/**
 * The two things every journey does: sign a client in the way a client
 * does, by asking for a link and following it, and read what the portal
 * wrote to the mail sink instead of sending.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { expect, type Page } from '@playwright/test';
import { MAIL_SINK } from './env';

export interface Mail {
  file: string;
  to: string;
  subject: string;
  text: string;
}

/** Every message in the sink, newest first. */
export function mails(): Mail[] {
  let files: string[] = [];
  try {
    files = readdirSync(MAIL_SINK).filter((name) => name.endsWith('.txt'));
  } catch {
    return [];
  }
  return files
    .map((name) => path.join(MAIL_SINK, name))
    .sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs)
    .map((file) => {
      const text = readFileSync(file, 'utf8');
      return {
        file,
        to: text.match(/^To: (.*)$/m)?.[1] ?? '',
        subject: text.match(/^Subject: (.*)$/m)?.[1] ?? '',
        text,
      };
    });
}

/** The newest message to an address, once it exists. */
export async function mailTo(address: string, tries = 40): Promise<Mail> {
  for (let i = 0; i < tries; i += 1) {
    const found = mails().find((mail) => mail.to === address);
    if (found) return found;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`no mail to ${address} arrived in the sink`);
}

/**
 * Ask for a link on the sign-in screen, read it from the sink, and follow it.
 * Resolves once the client's landing has rendered.
 */
export async function signInByLink(page: Page, email: string, landing: string): Promise<void> {
  const before = mails().length;
  await page.goto('/portal/sign-in');
  await page.getByLabel('Email').fill(email);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('heading', { name: 'A link is on its way' })).toBeAttached();

  let mail = await mailTo(email);
  for (let i = 0; i < 40 && mails().length <= before; i += 1) {
    await new Promise((resolve) => setTimeout(resolve, 250));
    mail = await mailTo(email);
  }
  const link = mail.text.match(/https?:\/\/\S+\/portal\/auth\/[A-Za-z0-9_-]+/)?.[0];
  if (!link) throw new Error(`the sign-in mail to ${email} carries no link`);

  await page.goto(link);
  await expect(page).toHaveURL(new RegExp(`${landing.replace(/\//g, '\\/')}\\/?$`));
}
