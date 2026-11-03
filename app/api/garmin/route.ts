import {neon} from '@neondatabase/serverless';
import {isOwner} from '@/auth';
import {json,sameOrigin,validDate,list,ensure,today,shift} from '@/lib/planner';
import {fetchGarmin,GarminError,garminMatch,garminMeasurements,type GarminActivity} from '@/lib/garmin';
export const dynamic='force-dynamic';export const maxDuration=60;
type Stored={activity:GarminActivity;itemId?:string;reason?:string};
function db(){if(!process.env.DATABASE_URL)throw Error('Missing database');return neon(process.env.DATABASE_URL);}
async function stored(){const rows=await db().query("SELECT value FROM planner_settings WHERE key LIKE 'garmin:activity:%'",[]);return rows.map(r=>JSON.parse(r.value) as Stored);}
export async function GET(){if(!await isOwner())return json({error:'Entre para continuar.'},401);try{const last=await db().query("SELECT value FROM planner_settings WHERE key='garmin:last-sync'",[]);return json({configured:!!process.env.GARMIN_PERSONAL_API_KEY,lastSync:last[0]?.value||null,activities:(await stored()).sort((a,b)=>b.activity.startedAt.localeCompare(a.activity.startedAt)).slice(0,200)});}catch{return json({error:'Não foi possível carregar a integração Garmin.'},500);}}
export async function POST(req:Request){if(!await isOwner())return json({error:'Entre para continuar.'},401);if(!sameOrigin(req))return json({error:'Origem inválida.'},403);
 try{const body=await req.json();const from=body.from||shift(today(),-29),to=body.to||today();if(!validDate(from)||!validDate(to)||from>to||to>today()||(Date.parse(to)-Date.parse(from))/86400000>89)return json({error:'Escolha um intervalo de até 90 dias, sem datas futuras.'},400);
 const key=process.env.GARMIN_PERSONAL_API_KEY;if(!key)return json({error:'Cadastre GARMIN_PERSONAL_API_KEY na Vercel (Production) e publique novamente.'},400);
 const sql=db();const claimed=await sql.query("INSERT INTO planner_settings(key,value) VALUES('garmin:sync-lock',$1) ON CONFLICT(key) DO UPDATE SET value=excluded.value WHERE planner_settings.value::bigint < $2 RETURNING key",[String(Date.now()),String(Date.now()-60000)]);if(!claimed.length)return json({error:'Uma sincronização acabou de iniciar. Aguarde um minuto.'},429);
 const activities=await fetchGarmin(from,to,key);await ensure();const items=await list();const old=await stored();const all=new Map(old.map(x=>[x.activity.id,x]));let linked=0;
 for(const a of activities){const previous=all.get(a.id);if(previous?.itemId){all.set(a.id,{...previous,activity:a});continue;}const match=garminMatch(a,items);all.set(a.id,{activity:a,itemId:match.item?.id,reason:match.reason});if(match.item)linked++;}
 const touched=new Set(activities.map(a=>all.get(a.id)?.itemId).filter((s):s is string=>!!s));const queries=[];
 for(const id of touched){const related=[...all.values()].filter(x=>x.itemId===id).map(x=>x.activity);const original=items.find(i=>i.id===id);if(!original)continue;const newlyLinked=activities.some(a=>all.get(a.id)?.itemId===id&&!old.some(o=>o.activity.id===a.id&&o.itemId===id));
 const finish=related.map(a=>a.endedAt).sort().at(-1)!;const link='https://connect.garmin.com/modern/activity/'+related[0].id;
 queries.push(sql.query(`UPDATE planner_items SET measurements=measurements || $2::jsonb,link=CASE WHEN link='' THEN $3 ELSE link END,done=CASE WHEN $4 AND NOT not_done THEN true ELSE done END,completed_at=CASE WHEN $4 AND NOT not_done AND NOT done THEN $5 ELSE completed_at END WHERE id=$1`,[id,JSON.stringify(garminMeasurements(related)),link,newlyLinked,finish]));}
 for(const a of activities)queries.push(sql.query('INSERT INTO planner_settings(key,value) VALUES($1,$2) ON CONFLICT(key) DO UPDATE SET value=excluded.value',['garmin:activity:'+a.id,JSON.stringify(all.get(a.id))]));
 const now=new Date().toISOString();queries.push(sql.query("INSERT INTO planner_settings(key,value) VALUES('garmin:last-sync',$1) ON CONFLICT(key) DO UPDATE SET value=excluded.value",[now]));await sql.transaction(queries);
 return json({ok:true,imported:activities.length,linked,review:activities.filter(a=>!all.get(a.id)?.itemId).length,lastSync:now});
 }catch(e){return json({error:e instanceof GarminError?e.message:'Não foi possível sincronizar. Tenta novamente.'},502);}}
