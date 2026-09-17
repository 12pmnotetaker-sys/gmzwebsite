import {matchRouteProperty,type RouteBook} from './field-feed.ts';
import type {State} from './model';
export type DispatchStop={id:string;propertyId:string;name:string;address:string;city:string;crew:string;truck:string;start:string;minutes:number|null;source:string;instructions:string};
export function routeDispatch(s:State,book:RouteBook|null,date:string,crew:string,rotation:string){
 const weekday=new Date(date+'T12:00:00Z').getUTCDay(),key=weekday===1?'monday':weekday===3&&['wed-a','wed-b'].includes(rotation)?rotation:'';
 const visits=s.visits.filter(v=>v.date===date&&v.status!=='Skipped'),skipped=new Set(s.visits.filter(v=>v.date===date&&v.status==='Skipped').map(v=>v.propertyId));
 const saved=s.routes.filter(r=>r.date===date);const plans:DispatchStop[]=[];
 const pending=(pid:string)=>s.serviceRequests.filter(r=>r.propertyId===pid&&!r.visitId).map(r=>`Client request ${r.reference}: ${r.note}`).join('\n');
 const push=(pid:string,name:string,address:string,routeCrew:string,truck:string)=>{if(pid&&skipped.has(pid))return;if(pid&&plans.some(r=>r.propertyId===pid))return;const p=s.properties.find(p=>p.id===pid),v=visits.find(v=>v.propertyId===pid);const row={id:v?.id||pid||address,propertyId:pid,name:p?.name||name,address:p?.address||address,city:p?.city||'',crew:v?.crew||p?.crew||routeCrew,truck:v?.truck||truck||p?.truck||'',start:v?.start||'',minutes:v?.budgetMinutes??p?.budgetMinutes??null,source:v?'Work order':pid?'Route plan':'Property match needed',instructions:v?.instructions||[p?.notes,pending(pid)].filter(Boolean).join('\n\n')};if(crew==='All crews'||row.crew===crew)plans.push(row);};
 if(saved.length){for(const route of saved)for(const id of route.propertyIds){const p=s.properties.find(p=>p.id===id);if(p)push(id,p.name,p.address,p.crew,route.truck)}}
 else if(key&&book){for(const row of book.rows.filter(r=>r.route===key).sort((a,b)=>a.sortOrder-b.sortOrder))push(matchRouteProperty(row.address,s.properties)||'',row.name,row.address,row.crew,'');}
 for(const v of visits){const p=s.properties.find(p=>p.id===v.propertyId);if(p&&!plans.some(r=>r.id===v.id)&&(crew==='All crews'||v.crew===crew)){plans.push({id:v.id,propertyId:p.id,name:p.name,address:p.address,city:p.city,crew:v.crew,truck:v.truck,start:v.start,minutes:v.budgetMinutes,source:'Work order',instructions:v.instructions})}}
 return plans;
}
export function routeDispatchCSV(rows:DispatchStop[],date:string){const cell=(v:unknown)=>{let s=String(v??'');if(/^\s*[=+@-]/.test(s))s="'"+s;return '"'+s.replaceAll('"','""')+'"'};return '\uFEFF'+[['Date','Stop','Property','Address','City','Crew','Truck','Start (Pacific)','Budget minutes','Source','Crew instructions'],...rows.map((r,i)=>[date,i+1,r.name,r.address,r.city,r.crew,r.truck,r.start,r.minutes,r.source,r.instructions])].map(r=>r.map(cell).join(',')).join('\r\n');}
