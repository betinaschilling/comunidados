import {isOwner} from '@/auth';
import {json,sameOrigin} from '@/lib/planner';
import {validRecurrences} from '@/lib/recurrence';
import {readRecurrences,saveRecurrences} from '@/lib/recurrence-store';
export const dynamic='force-dynamic';
export async function GET(){if(!await isOwner())return json({error:'Entre para continuar.'},401);try{return json(await readRecurrences())}catch{return json({error:'Não foi possível carregar as configurações.'},500)}}
export async function POST(req:Request){if(!await isOwner())return json({error:'Entre para continuar.'},401);if(!sameOrigin(req))return json({error:'Origem inválida'},403);try{const body=await req.json();if(!validRecurrences(body.rules)||typeof body.revision!=='string')return json({error:'Confira os nomes, dias e demais campos. Os nomes devem ser únicos.'},400);if(!await saveRecurrences(body.rules,body.revision))return json({error:'As configurações mudaram em outra sessão. Recarregue antes de editar.'},409);return json(await readRecurrences())}catch{return json({error:'Não foi possível salvar as configurações.'},500)}}
