'use client';
import {createContext,useContext,useEffect,useState,type ReactNode} from 'react';
import {matchRouteProperty,type FieldFeed} from '@/operations/lib/operations/field-feed';
import {routeDispatch} from '@/operations/lib/operations/route-dispatch';
import type {State,Property} from '@/operations/lib/operations/model';
const labels={'monday':'Monday','wed-a':'Wednesday A','wed-b':'Wednesday B'};
type RouteContextValue={feed:FieldFeed|null;error:string;rotations:Record<string,string>;choose:(date:string,rotation:string)=>void};
const RouteContext=createContext<RouteContextValue>({feed:null,error:'',rotations:{},choose:()=>{}});
export const useScheduleRoutes=()=>useContext(RouteContext);
export function ScheduleRoutesProvider({children}:{children:ReactNode}){
 const [feed,setFeed]=useState<FieldFeed|null>(null),[error,setError]=useState('');
 useEffect(()=>{const controller=new AbortController();fetch('/api/admin/field-feed?routesOnly=1',{signal:controller.signal}).then(async r=>{const j=await r.json() as FieldFeed&{error?:string};if(!r.ok)throw Error(j.error||'Routes unavailable');setFeed(j)}).catch(e=>{if(!controller.signal.aborted)setError(e.message)});return()=>controller.abort()},[]);
 const [rotations,setRotations]=useState<Record<string,string>>({});
 return <RouteContext.Provider value={{feed,error,rotations,choose:(date,rotation)=>setRotations(previous=>({...previous,[date]:rotation}))}}>{children}</RouteContext.Provider>;
}
export function ScheduleRoutePlan({properties}:{properties:Property[]}){
 const {feed,error}=useScheduleRoutes();
 return <section className="schedule-route-plan"><div className="flex-between"><div><h2>Recurring routes</h2><p className="muted">Your existing route book, alongside the dated work schedule.</p></div><a className="text-button" href="#field">Manage routes →</a></div>{error&&<p role="alert">{error}</p>}{!feed&&!error&&<p>Loading your routes…</p>}{feed?.book?<><div className="schedule-route-grid">{(['monday','wed-a','wed-b'] as const).map(key=>{const rows=feed.book!.rows.filter(r=>r.route===key).sort((a,b)=>a.sortOrder-b.sortOrder);return <article className="panel schedule-route-card" key={key}><header><h3>{labels[key]}</h3><span className="muted">{rows.length} stops</span></header><p className="muted">{rows[0]?.crew||'Crew not recorded'} · 7:00 AM start</p><ol>{rows.map(row=>{const id=matchRouteProperty(row.address,properties),p=properties.find(p=>p.id===id);return <li key={row.id}><div>{p?<a href={'#clients/'+encodeURIComponent(p.clientId)}>{p.name}</a>:<span>{row.name}</span>}<small>{row.frequency==='biweekly'?'Every two weeks':'Weekly'}{!p?' · Property match needed':''}</small></div></li>})}</ol>{!rows.length&&<p>No stops recorded.</p>}</article>})}</div><p className="schedule-route-note">Wednesday A and B are alternating route plans. Their calendar rotation has not been confirmed in the saved route book. Route stops appear in the calendar below. Choose A or B inside a Wednesday to view its plan; work orders remain separate.</p></>:feed&&!error?<p className="empty">No route book is connected.</p>:null}</section>;
}
export function CalendarRouteDay({data,date,crew}:{data:State;date:string;crew:string}){
 const {feed,error,rotations,choose}=useScheduleRoutes();
 const rotation=rotations[date]||'',saved=data.routes.some(r=>r.date===date),wednesday=new Date(date+'T12:00:00Z').getUTCDay()===3;
 const needsChoice=wednesday&&!saved&&!rotation;
 const renderStops=(key:string)=>{
  const stops=routeDispatch(data,feed?.book||null,date,crew,key).filter(r=>r.source!=='Work order');
  return <>{stops.map((r,i)=>{const property=data.properties.find(p=>p.id===r.propertyId);return <article className="calendar-route-stop" key={r.id}><span className="eyebrow">{needsChoice?'Route option':'Planned stop'} {i+1}</span>{property?<a href={'#clients/'+encodeURIComponent(property.clientId)}>{r.name}</a>:<strong>{r.name}</strong>}<small>{r.address}</small><small>{[r.crew,r.truck].filter(Boolean).join(' · ')}</small>{r.instructions&&<details><summary>Service notes</summary><p>{r.instructions}</p></details>}{!property&&<small>Property match needed</small>}</article>})}{!stops.length&&<small className="muted">No additional route stops.</small>}</>;
 };
 return <>{error&&<small role="alert">Routes unavailable: {error}</small>}{!feed&&!error&&<small>Loading routes…</small>}{wednesday&&!saved&&<label className="calendar-route-picker"><span>Wednesday rotation</span><select aria-label={'Wednesday route for '+date} value={rotation} onChange={e=>choose(date,e.target.value)}><option value="">Show both options</option><option value="wed-a">Wednesday A</option><option value="wed-b">Wednesday B</option></select></label>}{needsChoice&&feed?.book?<><small className="muted">Choose the route for this date. These are alternatives.</small>{(['wed-a','wed-b'] as const).map(key=><section className="calendar-route-option" key={key}><header><strong>{labels[key]}</strong><button className="text-button" onClick={()=>choose(date,key)}>Use {key==='wed-a'?'A':'B'}</button></header>{renderStops(key)}</section>)}</>:renderStops(rotation)}</>;
}
export function CalendarStopCount({data,date,crew}:{data:State;date:string;crew:string}){
 const {feed,rotations}=useScheduleRoutes();
 const rows=routeDispatch(data,feed?.book||null,date,crew,rotations[date]||'');
 const uncertain=new Date(date+'T12:00:00Z').getUTCDay()===3&&!data.routes.some(r=>r.date===date)&&!rotations[date]&&!!feed?.book;
 return <small>{uncertain?'A / B routes below':`${rows.length} stops`}</small>;
}
