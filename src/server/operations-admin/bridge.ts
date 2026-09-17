// Server-only: call only after requireAdmin verifies an active database membership.
import {addServiceRequest} from '../../operations/lib/operations/service-requests';
import {applyCommand,stateSchema} from '../../operations/lib/operations/model';
import {hydratePortal,requestPhotoPaths,requestProposal,publication,announcementSchema,announcementVisible} from '../../operations/lib/operations/portal-model';
import {proseProblems} from './copy-rules.mjs';
const hash=async(s:string|Uint8Array)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',typeof s==='string'?new TextEncoder().encode(s):new Uint8Array(s)))).map(v=>v.toString(16).padStart(2,'0')).join('');
const json=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Los_Angeles',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const safeProse=(value:unknown)=>{for(const s of JSON.stringify(value).matchAll(/"((?:[^"\\]|\\.)*)"/g)){const text=JSON.parse('"'+s[1]+'"');if(proseProblems(text).length)throw Error('Client content needs review: '+proseProblems(text).map((v:any)=>v[0]).join(', '));}};
export async function handleBridge(req:Request, db:any, scope:string){
 if(req.method!=='POST')return json({error:'POST required'},405);
 try{
  const raw=await req.text();if(raw.length>6500000)return json({error:'Request too large'},413);const b=JSON.parse(raw);
  const must=async(q:any)=>{const {data,error}=await q;if(error){console.error('bridge-database-failure',error.code);throw Error(error.message?.includes('Workspace changed')?'Workspace changed. Refresh before saving.':'The portal could not save this change. Check for duplicate email addresses and refresh.');}return data;};
  const snapshot=async()=>must(db.rpc('gmz_ops_snapshot',{p_scope:scope}));
  let snap=await snapshot();
  if(b.action==='load'){
   if(!snap.workspace)throw Error('Operations workspace has not been migrated');
   return json(hydratePortal(snap));
  }
  const current=hydratePortal(snap);if(!current)throw Error('Open the operations workspace first');
  const mapped=(id:string)=>{const c=snap.clients.find((c:any)=>c.localId===id);if(!c)throw Error('Client is not linked to the portal');return c;};
  const resolveVisit=(id:string)=>{const v=current.state.visits.find(v=>v.id===id);if(!v)throw Error('Visit not found');const p=current.state.properties.find(p=>p.id===v.propertyId)!;return {v,p,c:mapped(p.clientId)};};
  const checkVersion=()=>{if(b.version!==current.version||b.fingerprint!==current.fingerprint)throw Error('Workspace changed. Refresh before saving.');};
  if(b.action==='save'){
   checkVersion();const state=applyCommand(current.state,b.command);
   const saved=await must(db.rpc('gmz_ops_commit',{p_scope:scope,p_version:current.version,p_fingerprint:current.fingerprint,p_state:state}));return json(hydratePortal(saved));
  }
  if(b.action==='upload'){
   checkVersion();const {v,p,c}=resolveVisit(b.visitId);if(v.status!=='Completed'||v.reportStatus!=='Reviewed'||p.internal)throw Error('Review the client report first');
   if(!v.photos.some(x=>x.id===b.photoId&&x.visible))throw Error('Photo is not selected for this report');
   const bytes=Uint8Array.from(atob(b.bytes),(s)=>s.charCodeAt(0));if(bytes.length>4000000)throw Error('Photo too large');const dec=new TextDecoder();if(dec.decode(bytes.slice(0,4))!=='RIFF'||dec.decode(bytes.slice(8,12))!=='WEBP')throw Error('Invalid photo');
   for(let at=12;at+8<=bytes.length;){const tag=dec.decode(bytes.slice(at,at+4));if(tag==='EXIF'||tag==='XMP ')throw Error('Photo metadata must be removed');const n=new DataView(bytes.buffer).getUint32(at+4,true);at+=8+n+n%2;}
   const path=c.id+'/operations/'+await hash(v.id)+'/'+await hash(bytes)+'.webp';
   await must(db.storage.from('portal').upload(path,bytes,{contentType:'image/webp',upsert:true}));return json({path});
  }
  if(b.action==='publish'){
   checkVersion();const {v,p,c}=resolveVisit(b.visitId);const paths=b.photoPaths||{};
   for(const path of Object.values(paths)){if(typeof path!=='string'||!path.startsWith(c.id+'/operations/'+await hash(v.id)+'/')||!/^[-a-zA-Z0-9/.]+$/.test(path))throw Error('Photo destination mismatch');await must(db.storage.from('portal').createSignedUrl(path,30));}
   const report=publication(current.state,v.id,c.id,paths);safeProse({summary:report.summary,tasks:report.tasks,photos:report.photos.map(p=>p.caption)});
   const revision=await hash(JSON.stringify(report));v.reportStatus='Published to portal';v.publishedAt=new Date().toISOString();current.state.activity.unshift({id:crypto.randomUUID(),at:v.publishedAt,text:'Published client report: '+p.name});current.state.activity=current.state.activity.slice(0,100);
   const saved=await must(db.rpc('gmz_ops_commit',{p_scope:scope,p_version:current.version,p_fingerprint:current.fingerprint,p_state:current.state,p_report:{visitId:v.id,propertyId:p.id,clientId:c.id,revision,report}}));return json(hydratePortal(saved));
  }
  const clientList=snap.clients.map((c:any)=>({id:c.id,localId:c.localId,name:c.name,kind:c.kind,email:c.email,access:/@(pending\.invalid|example\.com)$/.test(c.email)?'Placeholder email. not ready for invitations':'Email on file'}));
  if(b.action==='link'){
   const c=await must(db.from('portal_clients').select('id,name,email').eq('id',b.clientId).single());
   if(snap.clients.some((x:any)=>x.id===c.id))return json(current);
   const state=applyCommand(current.state,{type:'client',value:{id:'portal-'+c.id,name:c.name,email:c.email,contact:'',phone:''}});
   return json(hydratePortal(await must(db.rpc('gmz_ops_commit',{p_scope:scope,p_version:current.version,p_fingerprint:current.fingerprint,p_state:state}))));
  }
  if(b.action==='requestService'){
   const request=await must(db.from('portal_requests').select('id,client_id,reference').eq('id',b.id).single());
   const c=clientList.find((c:any)=>c.id===request.client_id);if(!c)throw Error('Link the client account first');
   const result=addServiceRequest(current.state,request,c.localId,b.propertyId,b.note,new Date().toISOString(),today());
   const saved=await must(db.rpc('gmz_ops_commit',{p_scope:scope,p_version:current.version,p_fingerprint:current.fingerprint,p_state:stateSchema.parse(current.state)}));
   return json({...hydratePortal(saved),serviceRequest:result});
  }
  if(b.action==='requestProposal'){
   const request=await must(db.from('portal_requests').select('id,client_id,reference,about,body,details').eq('id',b.id).single());
   const c=clientList.find((c:any)=>c.id===request.client_id);if(!c)throw Error('Link the client account first');
   const lead=requestProposal(current.state,request,c.localId,b.propertyId);
   const saved=await must(db.rpc('gmz_ops_commit',{p_scope:scope,p_version:current.version,p_fingerprint:current.fingerprint,p_state:stateSchema.parse(current.state)}));
   return json({...hydratePortal(saved),proposalId:lead.id});
  }
  if(b.action==='requestPhotos'){
   const request=await must(db.from('portal_requests').select('client_id,photo_paths').eq('id',b.id).single());
   if(!clientList.some((c:any)=>c.id===request.client_id))throw Error('Link this client before viewing request photos');
   const paths=requestPhotoPaths(request.client_id,request.photo_paths);
   const photos=await Promise.all(paths.map(async(path)=>{const result=await must(db.storage.from('portal').createSignedUrl(path,300));return {url:result.signedUrl};}));
   return json({photos});
  }
  if(b.action==='inbox'){
   const [requests,approvals,tracking]=await Promise.all([must(db.from('portal_requests').select('id,client_id,reference,kind,about,body,details,photo_paths,created_at,notified').order('created_at',{ascending:false}).limit(500)),must(db.from('portal_approvals').select('id,client_id,subject,typed_name,amount,created_at').order('created_at',{ascending:false}).limit(500)),must(db.from('gmz_portal_inbox').select('*'))]);
   const portalClients=await must(db.from('portal_clients').select('id,name,email,kind'));return json({clients:portalClients.map((c:any)=>({...c,localId:snap.clients.find((x:any)=>x.id===c.id)?.localId||'',linked:snap.clients.some((x:any)=>x.id===c.id)})),requests:requests.map((r:any)=>{const {photo_paths,...row}=r;return {...row,photoCount:requestPhotoPaths(r.client_id,photo_paths).length};}),approvals,tracking,serviceRequests:current.state.serviceRequests.map(r=>({...r,date:current.state.visits.find(v=>v.id===r.visitId)?.date||null,visitStatus:current.state.visits.find(v=>v.id===r.visitId)?.status||null})),properties:current.state.properties.filter(p=>!p.internal).map(p=>({id:p.id,clientId:p.clientId,name:p.name})),proposals:current.state.leads.filter(l=>l.sourceRequestId).map(l=>({id:l.id,sourceRequestId:l.sourceRequestId,clientId:l.clientId,propertyId:l.propertyId,sentOn:l.sentOn,sentReference:l.sentReference,projectId:l.projectId,status:l.status}))});
  }
  if(b.action==='track'){
   if(!['request','approval'].includes(b.kind)||!['Open','In progress','Resolved'].includes(b.status)||typeof b.notes!=='string'||b.notes.length>4000)throw Error('Invalid inbox update');
   const source=await must(db.from(b.kind==='request'?'portal_requests':'portal_approvals').select('client_id').eq('id',b.id).single());if(!clientList.some((c:any)=>c.id===source.client_id))throw Error('Client is not linked');
   await must(db.from('gmz_portal_inbox').upsert({kind:b.kind,source_id:b.id,status:b.status,notes:b.notes,updated_at:new Date().toISOString()}));return json({saved:true});
  }
  if(b.action==='announcements')return json({clients:clientList,items:await must(db.from('gmz_portal_announcements').select('*').eq('scope',scope).order('updated_at',{ascending:false}))});
  if(b.action==='announcementSave'){
   const a=announcementSchema.parse(b.value);for(const id of a.client_ids)if(!clientList.some((c:any)=>c.id===id))throw Error('Audience includes an unlinked client');
   const existing=await must(db.from('gmz_portal_announcements').select('*').eq('scope',scope).eq('id',a.id).maybeSingle());
   if(existing&&existing.version!==a.version||!existing&&a.version!==0)throw Error('Announcement changed. Refresh before saving.');
   // Publishing requires a separate action on an already saved, reviewed draft.
   if(b.publish){if(!existing||existing.status!=='Draft')throw Error('Save a draft and preview it before publishing');if(JSON.stringify({...a,status:'Draft',version:0})!==JSON.stringify({...announcementSchema.parse(existing),status:'Draft',version:0}))throw Error('Save your edits before publishing');safeProse({title:a.title,body:a.body,link:a.link_label});a.status='Published';}
   else if(a.status!=='Archived')a.status='Draft';
   const row={...a,scope,version:a.version+1,updated_at:new Date().toISOString()};
   const saved=existing?await must(db.from('gmz_portal_announcements').update(row).eq('id',a.id).eq('scope',scope).eq('version',a.version).select('id')):await must(db.from('gmz_portal_announcements').insert(row).select('id'));
   if(!saved.length)throw Error('Announcement changed. Refresh before saving.');return json({saved:true});
  }
  if(b.action==='preview'){
   const c=mapped(b.clientId);const [garden,project,reports,announcements]=await Promise.all([must(db.from('portal_gardens').select('record').eq('client_id',c.id).maybeSingle()),must(db.from('portal_projects').select('record').eq('client_id',c.id).maybeSingle()),must(db.from('gmz_portal_reports').select('id,visit_id,report,published_at').eq('scope',scope).eq('client_id',c.id).order('published_at',{ascending:false}).limit(200)),must(db.from('gmz_portal_announcements').select('*').eq('scope',scope).eq('status','Published'))]);
   const seen=new Set();const latest=reports.filter((r:any)=>{if(seen.has(r.visit_id))return false;seen.add(r.visit_id);return true;});
   for(const r of latest)for(const p of r.report.photos){if(!p.path.startsWith(c.id+'/operations/'))throw Error('Invalid report photo');const result=await must(db.storage.from('portal').createSignedUrl(p.path,300));p.url=result.signedUrl;}
   return json({client:clientList.find((x:any)=>x.id===c.id),properties:current.state.properties.filter(p=>p.clientId===c.localId&&!p.internal).map(p=>({id:p.id,name:p.name,city:p.city,cadence:p.cadence})),garden:garden?.record||null,project:project?.record||null,reports:latest,announcements:announcements.filter((a:any)=>announcementVisible(a,c,today())).map((a:any)=>({id:a.id,title:a.title,body:a.body,kind:a.kind,link_url:a.link_url,link_label:a.link_label}))});
  }
  return json({error:'Unknown action'},400);
 }catch(e){const msg=e instanceof Error?e.message:'Portal unavailable';return json({error:msg},msg.includes('changed')?409:400);}
}
