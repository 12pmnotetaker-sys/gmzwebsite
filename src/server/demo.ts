/** The two seeded walkthrough accounts only. Never infer demo status from a form. */
export function isDemoClient(client: { email: string } | null | undefined): boolean {
  return Boolean(client && ['kate.games@example.com', 'heron@example.com'].includes(client.email.toLowerCase()));
}
