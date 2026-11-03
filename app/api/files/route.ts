import {put,get} from '@vercel/blob';
import {isOwner} from '@/auth';
import {json,sameOrigin} from '@/lib/planner';
export const dynamic='force-dynamic';
export async function POST(req:Request){if(!await isOwner())return json({error:'Não autorizado'},401);if(!sameOrigin(req))return json({error:'Origem inválida'},403);const f=(await req.formData()).get('file');if(!(f instanceof File)||f.size>4*1024*1024||!['image/jpeg','image/png','image/webp','application/pdf'].includes(f.type))return json({error:'Envie JPG, PNG, WebP ou PDF de até 4 MB.'},400);const key='planner/'+crypto.randomUUID();await put(key,f,{access:'private',addRandomSuffix:false,contentType:f.type});return json({key})}
export async function GET(req:Request){if(!await isOwner())return json({error:'Não autorizado'},401);const key=new URL(req.url).searchParams.get('key')||'';if(!/^planner\/[a-f0-9-]{36}$/.test(key))return json({error:'Arquivo inválido'},400);const f=await get(key,{access:'private'});if(f?.statusCode!==200)return json({error:'Não encontrado'},404);return new Response(f.stream,{headers:{'Content-Type':f.blob.contentType,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}})}
