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
Configure and test Preview on `codex/homepage-refresh` first. Production is a
separate environment and must receive its settings before the approved launch.
Redeploy the updated branch after changing variables; redeploying an older
Production build does not deploy the preview branch.

| Variable                    | Value                                                                                   |
| --------------------------- | --------------------------------------------------------------------------------------- |
| `SUPABASE_URL`              | `https://xtilbzmdlelzbufhkpoj.supabase.co`, the `gmz-client-portal` project             |
| `SUPABASE_SERVICE_ROLE_KEY` | the project's service role key, from the Supabase dashboard under Project Settings, API |
| `RESEND_API_KEY`            | private Resend sending key, entered directly in Vercel                                  |
| `ENQUIRY_FROM`              | verified sender; required by the public enquiry endpoint                                |
| `ENQUIRY_TO`                | monitored office inbox; defaults to the company email in `site.ts`                      |
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
3. **Obtain launch approval** after the preview, redirects and email tests pass.
   Keep the old Wix site published for rollback.
4. **Point `www.gmzlandscape.com` and the apex at Vercel** (add the domain to
   the Vercel project first; it gives the DNS records). `SITE_URL` needs no
   change: the site already builds against `https://www.gmzlandscape.com`.
5. **Enable indexing after the domain serves the new site.** Set
   `SEARCH_INDEXING=on` on Production and redeploy. Confirm `/robots.txt`
   allows public pages, disallows `/portfolio/` and `/portal/`, and that
   `/sitemap-index.xml` exists. Then **watch the first day.** Runtime logs on the Vercel project show every
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

## Email setup checkpoint, September 15, 2026

The Wix DNS API confirmed these records were added without deleting existing
website or business-email records. This confirms DNS configuration, not Resend
verification or email delivery.

| Type  | Relative name                   | Value                                                  |
| ----- | ------------------------------- | ------------------------------------------------------ |
| TXT   | resend._domainkey.notifications | Public DKIM key supplied by the owner and saved in Wix |
| CNAME | rsend.notifications             | rsend.forge.rmta.net                                   |
| CNAME | send.notifications              | send.forge.rmta.net                                    |

The last owner screenshot showed Pending / Checking DNS. Do not label email as
working until Resend confirms verification and a real test reaches an approved
recipient. No receiving MX record was added for the notification subdomain.

Use a sender such as `GMZ Landscaping <portal@notifications.gmzlandscape.com>`
for both `ENQUIRY_FROM` and `PORTAL_FROM`. Never set `PORTAL_MAIL_SINK` on Vercel.
Do not save private API keys or service-role keys in this document or Git.

Test these separately on Preview with an approved test address:

- Portal: the address must belong to a portal client; the example.com seed
  accounts cannot receive real email. Confirm a sign-in email arrives and opens
  the correct account. An unknown address deliberately gets a generic response.
- Public enquiry: confirm the office receives the submitted request.
- Portfolio access: confirm the office receives the request with the correct
  reply-to. The request does not automatically issue a portfolio code.
- A portal request: confirm both the saved request and office notification.

## Rollback preparation

Immediately before cutover, read and save the then-current DNS records. The
September 15 Wix baseline for the website was:

| Record    | Values                                         | TTL  |
| --------- | ---------------------------------------------- | ---- |
| Apex A    | 185.230.63.171, 185.230.63.186, 185.230.63.107 | 3600 |
| www CNAME | cdn3.wixdns.net                                | 3600 |

If a launch must be reversed, restore only the website records changed during
that launch, using the fresh baseline. Preserve mail, notification, app,
portfolio, timesheet and other unrelated records. Keep Wix published until the
new site has passed production checks. Turn search indexing off on the Vercel
deployment if the domain is moved back to Wix.
