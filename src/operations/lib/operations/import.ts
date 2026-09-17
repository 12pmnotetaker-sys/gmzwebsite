import {z} from 'zod';
import {clientSchema,propertySchema,stateSchema,validateState,type State} from './model.ts';
export const importSchema=z.object({batchId:z.string().min(1).max(100),owner:z.string().min(1),clients:z.array(clientSchema).max(500),properties:z.array(propertySchema).max(1000)});
export function mergeImport(current:State,input:z.infer<typeof importSchema>):State{
 if(current.importIds.includes(input.batchId))return current;
 const s=structuredClone(current);
 const sampleClients=new Set(['c1','c2','c3','c4']);
 const sampleProperties=new Set(['p1','p2','p3','p4']);
 // The complete pre-import workspace is archived transactionally by the store.
 // Remove only the original sample records; retain user-created work.
 if(s.dataMode==='sample'){
 const customPropertyIds=new Set(s.properties.filter(p=>!sampleProperties.has(p.id)).map(p=>p.id));
 s.projects=s.projects.filter(p=>!['j1','j2'].includes(p.id));s.visits=s.visits.filter(v=>!['v1','v2','v3','v4'].includes(v.id));
 const used=new Set([...s.visits,...s.projects].map(r=>r.propertyId));
 s.properties=s.properties.filter(p=>customPropertyIds.has(p.id)||used.has(p.id));
 const usedClients=new Set(s.properties.map(p=>p.clientId));s.clients=s.clients.filter(c=>!sampleClients.has(c.id)||usedClients.has(c.id));
 }
 for(const c of input.clients)if(!s.clients.some(x=>x.id===c.id))s.clients.push(c);
 for(const p of input.properties)if(!s.properties.some(x=>x.id===p.id))s.properties.push(p);
 s.dataMode='actual';s.importIds.push(input.batchId);s.activity.unshift({id:crypto.randomUUID(),at:new Date().toISOString(),text:`Imported ${input.properties.length} GMZ property records`});s.activity=s.activity.slice(0,100);validateState(s);return stateSchema.parse(s);
}
