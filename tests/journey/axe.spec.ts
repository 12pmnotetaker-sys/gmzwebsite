/**
 * The accessibility floor, checked by a browser.
 *
 * content-lint holds the parts of the floor a regex can see: one h1, the
 * skip link, a labelled nav, the focus ring and the reduced-motion block in
 * the built CSS. This is the rest: contrast, accessible names, roles, and
 * the relationships between things, judged by axe against the rendered
 * page, on every public page and on the portal screens a client uses.
 */
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { SEED } from './env';
import { signInByLink } from './helpers';

const PUBLIC = [
  '/',
  '/services',
  '/process',
  '/about',
  '/faq',
  '/work',
  '/where-we-work',
  '/contact',
  '/start',
  '/maintenance-request',
  '/reviews',
  '/portfolio-access',
  '/portal/sign-in',
  '/portal/link-expired',
  '/this-page-does-not-exist',
];

const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

async function noViolations(page: import('@playwright/test').Page, route: string) {
  // The public pages rise into place on load. Contrast is judged on what is
  // on the screen once they have arrived, not on a frame of the fade.
  await page.evaluate(() =>
    Promise.race([
      Promise.all(document.getAnimations().map((animation) => animation.finished.catch(() => {}))),
      new Promise((resolve) => setTimeout(resolve, 3000)),
    ]),
  );
  // What is hidden from assistive technology is decoration by declaration:
  // the faded proposal behind an approve sheet is a picture, not text.
  const results = await new AxeBuilder({ page })
    .withTags(TAGS)
    .exclude('[aria-hidden="true"]')
    .analyze();
  const report = results.violations.map(
    (v) =>
      `${v.id} (${v.impact}): ${v.help}\n` +
      v.nodes
        .slice(0, 5)
        .map((n) => {
          const data = n.any[0]?.data as Record<string, unknown> | undefined;
          const measured = data?.contrastRatio
            ? ` [${data.fgColor} on ${data.bgColor}, ${data.contrastRatio}:1 at ${data.fontSize}]`
            : '';
          return `    ${n.target.join(' ')}${measured}`;
        })
        .join('\n'),
  );
  expect(report, `${route} has accessibility violations`).toEqual([]);
}

for (const route of PUBLIC) {
  test(`${route} has no accessibility violations`, async ({ page }) => {
    await page.goto(route);
    await noViolations(page, route);
  });
}

test('the garden screens have no accessibility violations', async ({ page }) => {
  await signInByLink(page, SEED.garden.email, '/portal/garden');
  for (const route of ['/portal/garden', '/portal/garden/plants', '/portal/garden/ask']) {
    await page.goto(route);
    await noViolations(page, route);
  }
});

test('the project screens have no accessibility violations', async ({ page }) => {
  await signInByLink(page, SEED.project.email, '/portal/project');
  for (const route of [
    '/portal/project',
    '/portal/project/proposal',
    '/portal/project/proposal/approve',
  ]) {
    await page.goto(route);
    await noViolations(page, route);
  }
});
