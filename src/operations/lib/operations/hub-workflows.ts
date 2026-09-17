import {z} from 'zod';
import type {State,Visit} from './model';
const text=z.string().trim().max(4000),id=text.min(1),amount=z.number().finite().min(0).max(100000000);
export const calendarDate=z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v=>!isNaN(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v,'Enter a valid date');
export const purchaseSchema=z.object({id,itemId:id,targetType:z.enum(['visit','project']),targetId:id,quantity:amount.positive(),unitCost:amount,name:id,vendor:id,unit:id,status:z.enum(['Needed','Ordered','Shipped','Arrived','Installed','Cancelled']),eta:calendarDate.or(z.literal('')),notes:text,posted:z.boolean().default(false),orderedAt:text.default(''),arrivedAt:text.default('')});
export const fuelSchema=z.object({id,assetId:id,date:calendarDate,gallons:amount.positive(),cost:amount,meter:amount,station:text,crew:id});
export const officeTaskSchema=z.object({id,title:id,owner:id,due:calendarDate,status:z.enum(['Open','Done']),notes:text,projectId:text});
export const hubFields={purchases:z.array(purchaseSchema).max(3000).default([]),fuelLogs:z.array(fuelSchema).max(5000).default([]),officeTasks:z.array(officeTaskSchema).max(1000).default([])};
export const serviceTemplates:Record<string,string[]>={
 'General service':['Confirm today’s scope and property access','Complete assigned landscape work','Clear paths and leave the site clean'],
 'Hardscape':['Confirm layout, elevations and approved materials','Check excavation and base preparation against the plan','Check drainage and finished elevations','Record completed work and leave the site safe'],
 'Planting':['Confirm plant locations and material quantities','Check soil preparation and planting depth','Water in and verify irrigation coverage','Clean up and record follow-up care'],
 'Repair':['Confirm the reported problem and approved repair scope','Complete repair and test operation','Record materials used and any follow-up needed']
};
function put<T extends {id:string}>(rows:T[],v:T){const at=rows.findIndex(x=>x.id===v.id);if(at<0)rows.push(v);else rows[at]=v;}
export function applyHubCommand(s:State,action:string,value:unknown,now:string){
 if(action==='purchase'){
 const input=purchaseSchema.omit({name:true,vendor:true,unit:true,unitCost:true,posted:true,orderedAt:true,arrivedAt:true}).parse(value),old=s.purchases.find(x=>x.id===input.id);
 if(old?.posted)throw Error('Posted purchases are locked to preserve job costs');
 const item=s.items.find(x=>x.id===input.itemId);if(!item)throw Error('Choose a price book material first');
 const target=input.targetType==='visit'?s.visits.find(x=>x.id===input.targetId):s.projects.find(x=>x.id===input.targetId);if(!target)throw Error('Choose an existing work order or project');
 const sameItem=old?.itemId===input.itemId;
 put(s.purchases,{...input,name:sameItem?old.name:item.name,vendor:sameItem?old.vendor:item.vendor,unit:sameItem?old.unit:item.unit,unitCost:sameItem?old.unitCost:item.cost,posted:false,orderedAt:old?.orderedAt||(['Ordered','Shipped','Arrived','Installed'].includes(input.status)?now:''),arrivedAt:old?.arrivedAt||(['Arrived','Installed'].includes(input.status)?now:'')});return 'Material order saved';
 }
 if(action==='postPurchase'){
 const {id:pid}=z.object({id}).parse(value),p=s.purchases.find(x=>x.id===pid);if(!p)throw Error('Purchase not found');if(p.posted)return 'Purchase already posted';if(!['Arrived','Installed'].includes(p.status))throw Error('Mark materials arrived before posting their cost');
 const target=p.targetType==='visit'?s.visits.find(x=>x.id===p.targetId):s.projects.find(x=>x.id===p.targetId);if(!target)throw Error('Job not found');
 const total=Math.round(p.quantity*p.unitCost*100)/100;
 if('materials' in target)target.materials=Math.round(((target.materials||0)+total)*100)/100;else target.materialCost=Math.round(((target.materialCost||0)+total)*100)/100;
 s.allocations.push({id:'purchase-'+p.id,itemId:p.itemId,targetType:p.targetType,targetId:p.targetId,quantity:p.quantity,unitCost:p.unitCost,total,name:p.name,at:now});p.posted=true;return 'Purchase cost added to job';
 }
 if(action==='fuel'){
 const v=fuelSchema.parse(value);if(s.fuelLogs.some(x=>x.id===v.id))return 'Fuel already logged';const a=s.assets.find(x=>x.id===v.assetId);if(!a)throw Error('Equipment not found');if(v.meter<a.meter)throw Error('Meter must be at least the current equipment reading');s.fuelLogs.push(v);a.meter=v.meter;return 'Fuel purchase logged';
 }
 if(action==='officeTask'){const v=officeTaskSchema.parse(value);if(v.projectId&&!s.projects.some(p=>p.id===v.projectId))throw Error('Project not found');put(s.officeTasks,v);return 'Office follow-up saved';}
 throw Error('Unsupported Hub action');
}
export function officeBrief(s:State,day:string){return {
 overdueVisits:s.visits.filter(v=>v.date<day&&['Scheduled','In progress'].includes(v.status)),
 reports:s.visits.filter(v=>v.status==='Completed'&&v.reportStatus==='Draft'),
 deliveries:s.purchases.filter(p=>p.eta&&p.eta<=day&&['Ordered','Shipped'].includes(p.status)),
 projects:s.projects.filter(p=>p.due<day&&p.stage!=='Complete'),
 tasks:s.officeTasks.filter(t=>t.status==='Open'&&t.due<=day),
 service:s.assets.filter(a=>a.meter-a.lastService>=a.interval)
};}
export function dispatchCSV(visits:Visit[],s:State){const cell=(v:unknown)=>{let str=String(v??'');if(/^[\s]*[=+@-]/.test(str))str="'"+str;return '"'+str.replaceAll('"','""')+'"';};const rows=[['Date','Start (Pacific)','Property','Address','City','Crew','Truck','Budget minutes','Status','Work instructions'],...visits.map(v=>{const p=s.properties.find(p=>p.id===v.propertyId)!;return [v.date,v.start,p.name,p.address,p.city,v.crew,v.truck,v.budgetMinutes,v.status,v.instructions];})];return '\uFEFF'+rows.map(r=>r.map(cell).join(',')).join('\r\n');}
