# Decisions before launch

The site is built. What stands between it and the live domain is a short
list of facts only GMZ can supply, and the build gate is what keeps the site
honest until they arrive: an FAQ answer marked `needsDecision` does not
render, a public project must name a town from the service area, and the
"licensed and insured" claim cannot be written while `claims.licensedAndInsured`
is false.

Each item names who has to answer, what the answer changes, and where it
goes. None of them needs a developer; each is a content file or a flag.

## For Xavier

1. **Which projects go public, and their towns.** `/work` renders an honest
   empty state until `src/content/projects/` has entries. Each needs a title,
   a summary, the town (one of the ten in `serviceArea`), the completion
   month, the service line, the trades, a hero photograph with alt text, and
   the client's agreement to appear. Photographs go through
   `npm run photo:clean` first. The gated portfolio entries are indexed by
   street and cannot be copied across; the public entry is written fresh.
2. **Insurance.** Carrier, coverage amount, whether there is a bond, and
   whether a certificate can be sent to a client on request. Then set
   `claims.licensedAndInsured` to true in `src/data/site.ts` with a dated note,
   and publish `src/content/faqs/licence-and-insurance.md`.
3. **Payment terms** for design and construction: whether a deposit is taken
   at signing and how it is set, what triggers each later payment, when the
   final one is due, how design work is paid for, and which methods are
   accepted. Publishes `deposit-and-payment-terms.md`.
4. **Lead times.** How far out design and construction are booked, whether a
   start date is contractual or an estimate, and how delays are communicated.
   Publishes `how-long-it-takes.md`. A general figure is a promise a client
   will hold GMZ to, which is why `process.ts` states no durations today.
5. **Permits.** Whether GMZ applies in its own name or the owner does, whether
   town fees sit inside the firm price or pass through, and whether
   design-only clients get help with them. Publishes `who-handles-permits.md`.
6. **A workmanship warranty.** Whether one is offered, for how long, what it
   covers and excludes, and how a claim is made. Publishes
   `is-the-work-guaranteed.md`, or deletes it if the answer is no warranty.
7. **Minimum project size.** Whether a floor exists for design and build,
   whether smaller jobs are routed to maintenance, and which prepaid visit
   applies. Publishes `is-my-project-too-small.md`.
8. **Cancellation.** For the consultation, for drawings already in progress,
   and for a build with materials ordered. Publishes `cancelling-or-pausing.md`
   together with item 10.
9. **The family's history in the trade.** `heritage.tradeSince` in `site.ts`
   says the 1960s on the strength of the old website alone. Confirm or
   correct; the About page reads it.

## For Rafael Jr.

10. **Maintenance terms.** The notice period for ending a maintenance
    agreement (the portal's example says month to month with thirty days in
    writing, which is the example's term, not a policy), and whether failed
    plants are replaced, for how long, and on what condition. Publishes
    `what-if-a-plant-dies.md` and the maintenance half of
    `cancelling-or-pausing.md`.

## For whoever holds the accounts

11. **Domain mail.** `@gmzlandscape.com` points at two providers and nobody
    reads either; day-to-day mail runs through the Yahoo address in
    `site.ts`. The portal and the intake form send from a domain verified
    with the mail provider, so one sending domain has to be settled and
    verified before either can send. This blocks the portal's sign-in links.
12. **Reviews that may be quoted.** Each review on `/reviews` needs the
    reviewer's agreement to be repeated on the site, a link to the original,
    and the month it was written. Until then the page lists none and points
    at the Houzz profile.
13. **The old site's page list.** An export of the old site's pages, for the
    redirect map in `vercel.json`. `docs/go-live.md` has the procedure and
    `scripts/check-redirects.mjs` checks the result.

## What is already settled, for the record

The CSLB number, the phones, the email, the hours, the mailing address, the
tagline, the founder and the four roles, the consultation fee, the
maintenance walk, the travel charge and the fact that nothing is credited
toward a later stage, the ten towns, the APLD membership, and the supplier
strip. All in `src/data/site.ts`, each with the date and the person who
confirmed it.
