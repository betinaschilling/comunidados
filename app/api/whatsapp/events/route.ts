import {json} from '@/lib/planner';
import {validMarketEvent} from '@/lib/whatsapp-market';
import {marketAuthorized,marketHeartbeat,processMarketEvent} from '@/lib/whatsapp-store';
export const dynamic='force-dynamic';
export async function POST(req:Request){try{const config=await marketAuthorized(req);if(!config)return json({error:'Não autorizado.'},401);const raw=await req.text();if(raw.length>12000)return json({error:'Evento muito grande.'},413);const e=JSON.parse(raw);
 if(e.kind==='heartbeat'){if(e.groupName!=='Mercado'||typeof e.groupId!=='string'||!/^[\w-]{5,120}@g\.us$/.test(e.groupId))return json({error:'Grupo inválido.'},400);await marketHeartbeat(e.groupId,config);return json({ok:true});}
 if(!validMarketEvent(e))return json({error:'Evento inválido.'},400);if(!config.groupId||config.groupId!==e.groupId)return json({error:'Grupo não autorizado.'},403);
 return json(await processMarketEvent(e));
 }catch{return json({error:'Não foi possível processar o evento. A ponte deve tentar novamente.'},503);}}
