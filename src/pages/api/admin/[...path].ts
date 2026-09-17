import type { APIRoute } from 'astro';
import { ADMIN_COOKIE, authenticateAdmin, privateHeaders } from '../../../server/operations-admin/auth';
import { adminApi } from '../../../server/operations-admin/api';
export const prerender = false;
export const ALL: APIRoute = async ({request,cookies,params})=>{
 try{
  const admin=await authenticateAdmin(cookies.get(ADMIN_COOKIE)?.value);
  if(!admin)return Response.json({error:'GMZ Admin sign-in required'},{status:401,headers:privateHeaders});
  return await adminApi(request,admin,params.path||'');
 }catch{return Response.json({error:'Admin service unavailable'},{status:503,headers:privateHeaders});}
};
