import { db } from '../db';
import { createClient } from '@supabase/supabase-js';
import { env } from '../env';
export const ADMIN_COOKIE = 'gmz_operations_admin';
export type Admin = { userId: string; scope: string; email: string };
export async function authenticateAdmin(token: string | undefined): Promise<Admin | null> {
  if (!token) return null;
  const { data, error } = await db().auth.getUser(token);
  if (error || !data.user || !data.user.email_confirmed_at) return null;
  const { data: member, error: denied } = await db().from('gmz_operations_admins')
    .select('scope').eq('user_id', data.user.id).eq('active', true).maybeSingle();
  if (denied || !member) return null;
  const { data: integration } = await db().from('gmz_operations_integrations')
    .select('scope').eq('scope', member.scope).eq('active', true).maybeSingle();
  return integration ? { userId: data.user.id, scope: member.scope, email: data.user.email || '' } : null;
}
export function passwordClient() {
  if (!env.supabaseUrl || !env.supabaseServiceKey) throw Error('Admin access is not configured');
  return createClient(env.supabaseUrl, env.supabaseServiceKey, {auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
}
export const privateHeaders = {'Cache-Control':'private, no-store','X-Robots-Tag':'noindex, nofollow'};
export function sameOrigin(request: Request) { return request.headers.get('origin') === new URL(request.url).origin; }
