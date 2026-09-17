import {z} from 'zod';
const text=z.string().trim().max(4000),id=text.min(1);
export const timesheetSchema=z.object({id,employeeId:id,employeeName:id,date:z.string().regex(/^\d{4}-\d{2}-\d{2}$/),clockIn:z.string().datetime({offset:true}),clockOut:z.string().datetime({offset:true}).nullable(),breakMinutes:z.number().int().min(0).max(1440),propertyId:text.default(''),status:z.enum(['pending','approved','rejected']),notes:text.default(''),reviewedAt:z.string().nullable().default(null),source:z.enum(['GMZ Staff'])}).superRefine((v,ctx)=>{if(v.clockOut){const mins=(Date.parse(v.clockOut)-Date.parse(v.clockIn))/60000;if(mins<=0||mins>1440||v.breakMinutes>mins)ctx.addIssue({code:'custom',message:'Invalid shift or break duration'});}});
export type Timesheet=z.infer<typeof timesheetSchema>;

export function timeHours(t:Timesheet){return t.clockOut?Math.round(((Date.parse(t.clockOut)-Date.parse(t.clockIn))/60000-t.breakMinutes)/60*100)/100:null;}
export function reviewTimesheet(rows:Timesheet[],value:unknown,now:string){const v=z.object({id,status:z.enum(['pending','approved','rejected']),notes:text}).parse(value),t=rows.find(t=>t.id===v.id);if(!t)throw Error('Timesheet not found');if(v.status==='approved'&&!t.clockOut)throw Error('Clock out before approving');if(v.status==='rejected'&&!v.notes)throw Error('Give the staff member a reason for the return');t.status=v.status;t.notes=v.notes;t.reviewedAt=v.status==='pending'?null:now;return 'Timesheet reviewed: '+t.employeeName;}

const absenceDate=z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v=>!isNaN(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v);
export const absenceSchema=z.object({id,employeeName:id,employeeId:text.default(''),from:absenceDate,to:absenceDate,kind:z.enum(['Sick day','Missed day','Time off']),notes:text.default(''),status:z.enum(['pending','approved','rejected']).default('pending'),reviewedAt:z.string().nullable().default(null)}).refine(v=>v.to>=v.from,'End date must follow the start date');
export type Absence=z.infer<typeof absenceSchema>;
export function absenceCommand(rows:Absence[],action:string,value:unknown,now:string){
 if(action==='absence'){const v=absenceSchema.parse(value),old=rows.find(r=>r.id===v.id);if(old?.status==='approved')throw Error('Reopen the absence before editing');v.status='pending';v.reviewedAt=null;if(old)Object.assign(old,v);else rows.push(v);return 'Absence saved: '+v.employeeName;}
 const v=z.object({id,status:z.enum(['pending','approved','rejected']),notes:text}).parse(value),row=rows.find(r=>r.id===v.id);if(!row)throw Error('Absence not found');if(v.status==='rejected'&&!v.notes)throw Error('Add a reason for returning this absence');row.status=v.status;row.notes=v.notes;row.reviewedAt=v.status==='pending'?null:now;return 'Absence reviewed: '+row.employeeName;
}

export const timesheetFields={timesheets:z.array(timesheetSchema).max(10000).default([]),absences:z.array(absenceSchema).max(10000).default([])};
