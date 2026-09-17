import {routeDispatch} from './route-dispatch.ts';
import type {State} from './model';
import type {RouteBook} from './field-feed';
export function staffRoute(state:State,book:RouteBook|null,date:string,rotation:string){
 const rows=routeDispatch(state,book,date,'All crews',rotation);
 return {needsRotation:new Date(date+'T12:00:00Z').getUTCDay()===3&&!rotation&&!state.routes.some(r=>r.date===date),stops:rows.map(row=>({id:row.id,propertyId:row.propertyId,name:row.name,address:row.address,city:row.city,crew:row.crew,truck:row.truck,instructions:row.instructions,adminNotes:state.serviceRequests.filter(r=>r.propertyId===row.propertyId&&(r.visitId===row.id||!r.visitId)).map(r=>({reference:r.reference,note:r.note}))}))};
}
