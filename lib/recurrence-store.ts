import {neon} from '@neondatabase/serverless';
import {routines,shift,today} from './planner';
import {activityOrder} from './activity';
import {occurs,validRecurrences,type Recurrence} from './recurrence';
const db=()=>neon(process.env.DATABASE_URL!);
const key='routine:definitions:v1';
export async function readRecurrences():Promise<{rules:Recurrence[];revision:string;effectiveDate?:string}>{
 const rows=await db().query('SELECT key,value FROM planner_settings WHERE key=$1 OR key=$2',[key,'household:daily']);
 const saved=rows.find(r=>r.key===key)?.value;if(saved){const data=JSON.parse(saved);if(!validRecurrences(data.rules))throw Error('Configuração inválida');return data}
 const rules:Recurrence[]=[];
 for(let day=0;day<7;day++)for(const[title,category,amount]of routines(shift('2026-11-01',day))){let r=rules.find(x=>x.title===title);if(!r){r={id:'health-'+rules.length,title,category,amount,days:[],sortOrder:activityOrder({title,category} as any),enabled:true};rules.push(r)}r.days.push(day)}
 const household=rows.find(r=>r.key==='household:daily')?.value;
 if(household)for(const item of JSON.parse(household).items)rules.push({id:'house-'+rules.length,title:item.title,category:'Casa',householdGroup:item.group,amount:0,days:[0,1,2,3,4,5,6],sortOrder:600+rules.length,enabled:true});
 return {rules,revision:''};
}
export async function generateConfigured(){const data=await readRecurrences();if(!data.revision)return false;await reconcile(data.rules,data.effectiveDate&&data.effectiveDate>today()?data.effectiveDate:today());return true}
async function reconcile(rules:Recurrence[],start:string){
 const sql=db(),end=shift(today(),14),records=[];
 for(let d=start;d<=end;d=shift(d,1))for(const r of rules)if(occurs(r,d))records.push({id:'routine:'+d+':'+r.title,title:r.title,date:d,category:r.category,amount:r.amount,sort_order:r.sortOrder,household_group:r.householdGroup||null});
 await sql.query(`INSERT INTO planner_items(id,title,date,category,routine,done,amount,sort_order,household_group)
 SELECT id,title,date,category,true,false,amount,sort_order,household_group FROM jsonb_to_recordset($1::jsonb) AS x(id text,title text,date text,category text,amount integer,sort_order integer,household_group text) ON CONFLICT(id) DO NOTHING`,[JSON.stringify(records)]);
}
export async function saveRecurrences(rules:Recurrence[],revision:string){
 const sql=db(),next=JSON.stringify({rules,revision:crypto.randomUUID(),effectiveDate:shift(today(),1)}),start=shift(today(),1),end=shift(today(),14),records=[];
 for(let d=start;d<=end;d=shift(d,1))for(const r of rules)if(occurs(r,d))records.push({id:'routine:'+d+':'+r.title,title:r.title,date:d,category:r.category,amount:r.amount,sort_order:r.sortOrder,household_group:r.householdGroup||null});
 // A row lock serializes configuration edits; stale versions leave all records unchanged.
 const results=await sql.transaction([
 sql.query("INSERT INTO planner_settings(key,value) VALUES($1,$2) ON CONFLICT(key) DO NOTHING",[key,JSON.stringify({rules:[],revision:''})]),
 sql.query(`UPDATE planner_settings SET value=$1 WHERE key=$2 AND value::jsonb->>'revision'=$3 RETURNING value`,[next,key,revision]),
 sql.query(`DELETE FROM planner_items WHERE routine=true AND date >= $1 AND done=false AND COALESCE(not_done,false)=false AND COALESCE(notes,'')='' AND COALESCE(link,'')='' AND COALESCE(attachments,'[]'::jsonb)='[]'::jsonb AND COALESCE(measurements,'{}'::jsonb)='{}'::jsonb AND source_id IS NULL AND EXISTS(SELECT 1 FROM planner_settings WHERE key=$2 AND value=$3)`,[start,key,next]),
 sql.query(`INSERT INTO planner_items(id,title,date,category,routine,done,amount,sort_order,household_group) SELECT id,title,date,category,true,false,amount,sort_order,household_group FROM jsonb_to_recordset($1::jsonb) AS x(id text,title text,date text,category text,amount integer,sort_order integer,household_group text) WHERE EXISTS(SELECT 1 FROM planner_settings WHERE key=$2 AND value=$3) ON CONFLICT(id) DO NOTHING`,[JSON.stringify(records),key,next])]);
 return results[1].length>0;
}
