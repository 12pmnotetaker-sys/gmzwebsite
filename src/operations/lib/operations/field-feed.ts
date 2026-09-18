import { z } from 'zod';
const text = z.string().max(1000);
export const routeBookSchema = z.object({
  source: text,
  asOf: text,
  rows: z
    .array(
      z.object({
        id: text,
        name: text,
        address: text,
        route: z.enum(['monday', 'wed-a', 'wed-b']),
        frequency: z.enum(['weekly', 'biweekly']),
        crew: text,
        sortOrder: z.number().int().min(0),
      }),
    )
    .max(200),
});
export type RouteBook = z.infer<typeof routeBookSchema>;
export type VehicleLocation = {
  id: string;
  name: string;
  lat: number | null;
  lon: number | null;
  reportedAt: string | null;
};
export type FieldFeed = {
  book: RouteBook | null;
  status: 'not-connected' | 'available' | 'unavailable';
  message: string;
  vehicles: VehicleLocation[];
  checkedAt: string;
};
export function vehicleLocations(input: unknown): VehicleLocation[] {
  const rows = z
    .array(
      z.object({
        imei: z.string(),
        nickName: z.string().optional(),
        nickname: z.string().optional(),
        stats: z
          .object({
            lastUpdated: z.string().optional(),
            location: z
              .object({
                lat: z.number().min(-90).max(90).nullable().optional(),
                lon: z.number().min(-180).max(180).nullable().optional(),
              })
              .optional(),
          })
          .optional(),
      }),
    )
    .max(100)
    .parse(input);
  return rows.map((v, i) => ({
    id: v.imei,
    name: v.nickName || v.nickname || `Vehicle ${i + 1}`,
    lat: v.stats?.location?.lat ?? null,
    lon: v.stats?.location?.lon ?? null,
    reportedAt: v.stats?.lastUpdated || null,
  }));
}
export function matchRouteProperty(address: string, properties: { id: string; address: string }[]) {
  const norm = (s: string) =>
    s
      .split(',')[0]
      .toLowerCase()
      .replace(
        /\b(avenue|street|road|drive|lane)\b/g,
        (x) => ({ avenue: 'ave', street: 'st', road: 'rd', drive: 'dr', lane: 'ln' })[x]!,
      )
      .replace(/[^a-z0-9]/g, '');
  const matches = properties.filter((p) => norm(p.address) === norm(address));
  return matches.length === 1 ? matches[0].id : null;
}
