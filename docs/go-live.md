# Going live: the runbook

Everything the site needs to be the live site is a setting on the Vercel
project or a change at the registrar. Nothing in the repository has to change
on the day, and that is deliberate: the build that has been passing in CI in
the published state is the build that goes live.

There are two switches and they are independent. The client portal can be
turned on today, on the deployment that already exists. The marketing site
opens to search only when the domain moves. Do them in that order.

## 1. Turn the portal on

The portal refuses politely until it has a database and a way to send mail.
Both are environment variables on the Vercel project, for the Production and
Preview environments.

| Variable                    | Value                                                                                   |
| --------------------------- | --------------------------------------------------------------------------------------- |
| `SUPABASE_URL`              | `https://xtilbzmdlelzbufhkpoj.supabase.co`, the `gmz-client-portal` project             |
| `SUPABASE_SERVICE_ROLE_KEY` | the project's service role key, from the Supabase dashboard under Project Settings, API |
| `RESEND_API_KEY`            | the same key the intake form uses                                                       |
| `PORTAL_FROM`               | a sender on a domain verified with the provider; falls back to `ENQUIRY_FROM`           |
| `PORTAL_OFFICE_TO`          | where requests and approvals land; falls back to `ENQUIRY_TO`, then to `site.ts`        |

The service role key bypasses every row-level policy. It is set on the
server, read by `src/server/env.ts`, and never reaches a browser. Do not put
it in a `PUBLIC_` variable, a client script or a commit.

The schema is already applied to the project (`supabase/migrations/0001_portal.sql`)
and the private `portal` storage bucket exists. The two example clients from
the brief are seeded, under `kate.games@example.com` and `heron@example.com`,
so the portal can be walked end to end before a real client is added.

Then, from a machine with the two Supabase variables exported:

```sh
npm run portal -- add --email client@example.com --name "Their Name" --kind garden
npm run portal -- record --email client@example.com --file their-garden.json
npm run portal -- plants --email client@example.com --file their-plants.json
npm run portal -- link --email client@example.com     # a link to read over the phone
npm run portal -- requests                            # anything the office was not emailed about
```

A record that does not fit `src/data/portal/shapes.ts`, or that breaks house
style, is refused with the sentence named. The seed data in
`src/data/portal/garden.ts` and `project.ts` is the worked example of what a
record looks like.

**Test it like a client.** Type the address into `/portal/sign-in`, get the
email, open the link, send a request, and check that the office inbox has it.
A row in the database is not the test; an email someone reads is.

## 2. Open the marketing site to search

Three signals have to agree, and one variable drives all three: `noindex` on
every public page, `Disallow: /` in robots.txt, and whether a sitemap is
generated at all.

`SEARCH_INDEXING=on`, set on the **Production** environment only, opens all
three at the next deploy. Preview deployments stay `noindex` whatever the
variable says, because Vercel marks them so itself, and the branch builds in
CI are proven in both states on every push (see `.github/workflows/build.yml`).

Do not set it before the domain points here. A `vercel.app` address that is
indexable with canonical tags pointing at `gmzlandscape.com`, which still
serves the old site, is a confusion search engines take months to forget.

## 3. Move the domain

The cutover, in order:

1. **Decide the facts that are still open.** `docs/decisions-before-launch.md`
   lists them. An FAQ answer stays off the site until it is marked
   `published`, so the site goes live with the undecided answers absent
   rather than wrong.
2. **Redirects from the old site.** Export the old site's page list (its
   sitemap, or the pages panel) and write each old path against its new home
   in `vercel.json` under `redirects`, permanent. The old site is not reachable
   from this environment, so the map has to be made by hand from that export.
   `scripts/check-redirects.mjs <preview-url> old-paths.txt` fetches every old
   path against a deployment and reports any that do not land on a `200`.
3. **Set `SEARCH_INDEXING=on`** on Production and redeploy. Confirm
   `/robots.txt` reads `Allow: /` with the two `Disallow` lines for
   `/portfolio/` and `/portal/`, and that `/sitemap-index.xml` exists.
4. **Point `www.gmzlandscape.com` and the apex at Vercel** (add the domain to
   the Vercel project first; it gives the DNS records). `SITE_URL` needs no
   change: the site already builds against `https://www.gmzlandscape.com`.
5. **Watch the first day.** Runtime logs on the Vercel project show every
   `/api/enquiry` and portal request with a status code and nothing else. A
   `503` from the intake endpoint means neither a mail provider nor the
   database is configured; a `502` means what is configured refused it.
6. **Retire the old site** once the redirects have been seen to work from a
   phone on mobile data, not only from the office.

## What the repository already enforces

- `npm run build` fails on a schema violation, a missing alt, an em dash, a
  manufacturer name in prose, a photograph carrying a location, or the three
  search signals disagreeing.
- Every portal page is `noindex`, every signed-in portal page is `no-store`,
  and `/portal` and `/portfolio` are disallowed and out of the sitemap in
  both indexing states.
- A portal record is checked against the same house style rules as the site,
  on the way in and on the way out.
