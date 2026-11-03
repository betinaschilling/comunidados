import {isOwner} from '@/auth';
import {json,sameOrigin} from '@/lib/planner';
import {createMarketToken,marketConfig,saveMarketConfig,marketSummary,getMarketState,processMarketEvent,ignoreMarketMessage} from '@/lib/whatsapp-store';
export const dynamic='force-dynamic';
export async function GET(){if(!await isOwner())return json({error:'Entre para continuar.'},401);try{return json(await marketSummary())}catch{return json({error:'Não foi possível carregar o Mercado.'},500);}}
export async function POST(req:Request){if(!await isOwner())return json({error:'Entre para continuar.'},401);if(!sameOrigin(req))return json({error:'Origem inválida.'},403);try{const b=await req.json();if(b.action==='token')return json({token:await createMarketToken()});if(b.action==='pause'){const c=await marketConfig();await saveMarketConfig({...c,enabled:false,tokenHash:undefined});return json({ok:true});}
 if(b.action==='ignore'&&typeof b.id==='string'){await ignoreMarketMessage(b.id);return json({ok:true});}
 if(b.action==='approve'&&typeof b.id==='string'&&typeof b.title==='string'&&b.title.trim().length>0&&b.title.trim().length<=140){const c=await marketConfig(),m=(await getMarketState()).messages[b.id];if(!m||!m.review||!c.groupId)return json({error:'Mensagem não encontrada.'},400);return json(await processMarketEvent({kind:'message',messageId:m.id,groupId:c.groupId,at:m.at,text:m.text},b.title.trim()));}
 return json({error:'Operação inválida.'},400);
 }catch{return json({error:'Não foi possível atualizar o Mercado.'},500);}}
