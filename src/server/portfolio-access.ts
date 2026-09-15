import { env } from './env';
import { sendMail } from './mail';

export const interests = ['Design', 'Construction', 'Maintenance'] as const;
export interface AccessRequest {
  name: string;
  email: string;
  town: string;
  interest: string;
}
export function validateAccess(input: Record<string, unknown>): AccessRequest | null {
  const fields = ['name', 'email', 'town', 'interest'] as const;
  if (fields.some((key) => typeof input[key] !== 'string')) return null;
  const data = Object.fromEntries(
    fields.map((key) => [key, (input[key] as string).trim()]),
  ) as unknown as AccessRequest;
  if (
    !data.name ||
    data.name.length > 100 ||
    !data.town ||
    data.town.length > 100 ||
    data.email.length > 254
  )
    return null;
  if (Object.values(data).some((value) => /[\r\n\x00-\x1f]/.test(value))) return null;
  if (
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email) ||
    !interests.some((interest) => interest === data.interest)
  )
    return null;
  return data;
}

export async function requestPortfolioAccess(
  data: AccessRequest,
  deliver = sendMail,
): Promise<boolean> {
  try {
    return await deliver({
      to: env.enquiryTo,
      replyTo: data.email,
      subject: `Portfolio access request: ${data.name}`,
      text: [
        'A visitor has requested access to the private portfolio.',
        '',
        `Name: ${data.name}`,
        `Email: ${data.email}`,
        `Project town: ${data.town}`,
        `Interest: ${data.interest}`,
        '',
        'Review the request, then reply to this email with the portfolio access code if approved.',
        'No access code has been sent automatically.',
      ].join('\n'),
    });
  } catch {
    return false;
  }
}
