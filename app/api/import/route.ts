import {serviceAuth} from '@/lib/service-auth';
import {put,list,json,validItem} from '@/lib/planner';
// Owner-private Site: dispatch requires an owner session or supported owner service token.
export const dynamic='force-dynamic';
export async function POST(req:Request){if(!serviceAuth(req))return json({error:"Não autorizado"},401);try{const b=await req.json();if(!Array.isArray(b.items)||b.items.length>500||!b.items.every(validItem))return json({error:'Importação inválida'},400);for(const i of b.items)await put(i,true);return json({ok:true,count:(await list()).length})}catch{return json({error:'Falha na importação'},500)}}
