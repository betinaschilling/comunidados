import {after} from 'next/server';import {json} from '@/lib/planner';
import {marketAuthorized} from '@/lib/whatsapp-store';import {alreadySyncedToday,claimCloudJob,runCloudJob} from '@/lib/whatsapp-cloud';
export const runtime='nodejs';export const dynamic='force-dynamic';export const maxDuration=300;
export async function GET(req:Request){try{if(!await marketAuthorized(req))return json({error:'Não autorizado.'},401);if(await alreadySyncedToday())return json({ok:true,skipped:true});const id=await claimCloudJob(false);after(()=>runCloudJob(id,false));return json({ok:true},202)}catch{return json({error:'Não foi possível iniciar a consulta diária.'},503)}}
