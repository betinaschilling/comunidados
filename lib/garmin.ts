import type {Item} from './planner';
export type GarminActivity={id:string;name:string;type:string;date:string;startedAt:string;endedAt:string;distance?:number;duration?:number;averageHR?:number;maxHR?:number;calories?:number};
const zone=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'});
export function normalizeGarmin(r:any):GarminActivity|null{
 if(!r||!Number.isSafeInteger(r.activityId)||r.activityId<=0||typeof r.startTimeGMT!=='string')return null;
 const utc=r.startTimeGMT.replace(' ','T')+( /(?:Z|[+-]\d{2}:\d{2})$/.test(r.startTimeGMT)?'':'Z');
 const start=new Date(utc);if(!Number.isFinite(start.getTime()))return null;
 const a:GarminActivity={id:String(r.activityId),name:String(r.activityName||'Treino Garmin').slice(0,300),type:String(r.activityType?.typeKey||'unknown'),date:zone.format(start),startedAt:start.toISOString(),endedAt:start.toISOString()};
 for(const k of ['distance','duration','averageHR','maxHR','calories'] as const)if(typeof r[k]==='number'&&Number.isFinite(r[k])&&r[k]>=0)a[k]=r[k];
 if(a.duration!==undefined)a.endedAt=new Date(start.getTime()+a.duration*1000).toISOString();return a;
}
export function garminModality(type:string){if(['running','street_running','track_running','trail_running','treadmill_running','indoor_running','ultra_run','virtual_run'].includes(type))return 'Corrida';if(type==='strength_training')return 'Gym';return null;}
export function garminMatch(a:GarminActivity,items:Item[]):{item?:Item;reason?:string}{
 const modality=garminModality(a.type);if(!modality)return{reason:'Modalidade sem check correspondente.'};
 const candidates=items.filter(i=>i.routine&&i.category==='Exercício'&&i.title===modality&&i.date===a.date);
 if(candidates.length!==1)return{reason:candidates.length?'Mais de um check corresponde ao treino.':'Sem check dessa modalidade na mesma data.'};
 if(candidates[0].notDone)return{reason:'Check marcado manualmente como não feito.'};
 return{item:candidates[0]};
}
export function garminMeasurements(activities:GarminActivity[]){
 const metrics:Record<string,number>={};const sum=(k:'distance'|'duration'|'calories',label:string,div=1)=>{const values=activities.map(a=>a[k]).filter((v):v is number=>v!==undefined);if(values.length)metrics[label]=Math.round(values.reduce((s,v)=>s+v,0)/div*100)/100};
 sum('distance','Garmin · Distância km',1000);sum('duration','Garmin · Duração min',60);sum('calories','Garmin · Calorias kcal');
 const hr=activities.filter(a=>a.averageHR!==undefined&&a.duration!==undefined&&a.duration>0);if(hr.length)metrics['Garmin · FC média bpm']=Math.round(hr.reduce((s,a)=>s+a.averageHR!*a.duration!,0)/hr.reduce((s,a)=>s+a.duration!,0));
 const max=activities.map(a=>a.maxHR).filter((n):n is number=>n!==undefined);if(max.length)metrics['Garmin · FC máxima bpm']=Math.max(...max);
 const km=metrics['Garmin · Distância km'],mins=metrics['Garmin · Duração min'];if(km>0&&mins>0)metrics['Garmin · Ritmo min/km']=Math.round(mins/km*100)/100;
 return metrics;
}
export class GarminError extends Error{}
const base='https://personal.connectapi.garmin.com';
export async function fetchGarmin(from:string,to:string,key:string,fetcher:typeof fetch=fetch){
 async function call(path:string,init:RequestInit){let r:Response;try{r=await fetcher(base+path,{...init,cache:'no-store',signal:AbortSignal.timeout(12000),redirect:'error'})}catch{throw new GarminError('A Garmin não respondeu a tempo. Tenta novamente.');}
 if(!r.ok){if([401,403].includes(r.status))throw new GarminError('A Garmin recusou a autorização. Confira a chave pessoal e sua validade na Vercel.');if(r.status===429)throw new GarminError('Limite de consultas da Garmin atingido. Aguarde antes de tentar novamente.');throw new GarminError('Não foi possível consultar a Garmin agora.');}return r.json();}
 const tokenResponse=await call('/personalapitoken-service/personal-api/personal-api-key/token',{method:'POST',headers:{Authorization:'ApiKey '+key,Accept:'application/json'}});
 const token=tokenResponse.access_token||tokenResponse.accessToken;if(typeof token!=='string'||!token)throw new GarminError('A Garmin não retornou um token de acesso válido.');
 const rows=new Map<string,GarminActivity>();const shift=(d:string,n:number)=>new Date(Date.parse(d+'T12:00:00Z')+n*86400000).toISOString().slice(0,10);
 for(let start=0;start<2000;start+=100){const q=new URLSearchParams({start:String(start),limit:'100',startDate:shift(from,-1),endDate:shift(to,1),sortOrder:'desc',excludeChildren:'true'});const page=await call('/activitylist-service/activities/search/activities?'+q,{headers:{Authorization:'Bearer '+token,Accept:'application/json'}});if(!Array.isArray(page))throw new GarminError('Formato de atividades inesperado na resposta da Garmin.');
 for(const r of page){const a=normalizeGarmin(r);if(!a)throw new GarminError('Um treino veio sem identificador ou horário válido. Nenhuma alteração foi salva.');if(a.date>=from&&a.date<=to)rows.set(a.id,a);}
 if(page.length<100)return [...rows.values()];}
 throw new GarminError('Muitos treinos nesse intervalo. Escolha um período menor.');
}
