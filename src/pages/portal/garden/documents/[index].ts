/**
 * Opens the nth document on the client's shelf.
 *
 * The file lives in the private bucket, so the browser is sent to a signed
 * URL that lives for a few minutes rather than to the file itself. The index
 * is looked up in the signed-in client's own record, so a guessed number
 * opens nothing that is not theirs.
 */
import type { APIRoute } from 'astro';
import { routes } from '@data/portal/routes';
import { signedUrl } from '../../../../server/db';
import { RecordUnreadable, loadGarden } from '../../../../server/records';

export const prerender = false;

export const GET: APIRoute = async ({ params, locals, redirect }) => {
  const client = locals.client;
  if (!client || client.kind !== 'garden') return redirect(routes.signIn, 302);

  let garden;
  try {
    garden = await loadGarden(client);
  } catch (cause) {
    if (cause instanceof RecordUnreadable) {
      console.error(cause.message);
      return redirect(routes.documents, 302);
    }
    throw cause;
  }
  const index = Number(params.index);
  const doc = garden?.documents[index];
  if (!doc?.path) return redirect(routes.documents, 302);

  const url = await signedUrl(doc.path, 120);
  if (!url) return redirect(routes.documents, 302);
  return redirect(url, 302);
};
