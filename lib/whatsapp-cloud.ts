import archiver from 'archiver';
import {neon} from '@neondatabase/serverless';
import {randomUUID} from 'node:crypto';
import {mkdtemp,mkdir,rm,writeFile} from 'node:fs/promises';
import path from 'node:path';import {tmpdir} from 'node:os';import {Readable} from 'node:stream';
import {sealWhatsApp,openWhatsApp} from './whatsapp-crypto';
import {digest,reactionKind} from './whatsapp-market';
import {marketConfig,marketHeartbeat,getMarketState,processMarketEvent} from './whatsapp-store';
import {today} from './planner';
const sql=()=>neon(process.env.DATABASE_URL!);
const secret=()=>{if(!process.env.AUTH_SECRET||process.env.AUTH_SECRET.length<32)throw Error('Sessão segura não configurada.');return process.env.AUTH_SECRET;};
async function read(key:string){return (await sql().query('SELECT value FROM planner_settings WHERE key=$1',[key]))[0]?.value as string|undefined;}
async function put(key:string,value:string){await sql().query('INSERT INTO planner_settings(key,value) VALUES($1,$2) ON CONFLICT(key) DO UPDATE SET value=excluded.value',[key,value]);}
async function status(phase:string,message:string,extra:Record<string,unknown>={}){await put('whatsapp:cloud:status',JSON.stringify({phase,message,updatedAt:new Date().toISOString(),...extra}));}
export async function cloudSummary(){const s=await read('whatsapp:cloud:status');const c=await marketConfig();return {status:s?JSON.parse(s):null,paired:!!(await sql().query("SELECT 1 FROM planner_settings WHERE key='whatsapp:cloud:session'",[])).length,cronReady:!!process.env.CRON_SECRET&&digest(process.env.CRON_SECRET)===c.tokenHash,lastSync:(await read('whatsapp:cloud:last-sync'))||null};}
export async function cloudQr(){const raw=await read('whatsapp:cloud:qr');if(!raw)return null;const data=JSON.parse(openWhatsApp(raw,secret()).toString());return data.expires>Date.now()?data.qr as string:null;}
export async function claimCloudJob(pair:boolean){const c=await marketConfig();if(!c.enabled||!c.tokenHash)throw Error('Gere a chave de conexão antes de iniciar.');secret();const id=randomUUID(),at=Date.now();const r=await sql().query("INSERT INTO planner_settings(key,value) VALUES('whatsapp:cloud:lock',$1) ON CONFLICT(key) DO UPDATE SET value=excluded.value WHERE ((planner_settings.value::jsonb)->>'startedAt')::bigint < $2 RETURNING key",[JSON.stringify({id,startedAt:at}),String(at-360000)]);if(!r.length)throw Error('Uma conexão já está em andamento. Aguarde alguns minutos.');await status('iniciando',pair?'Preparando o QR code…':'Abrindo a sessão para sincronizar…');return id;}
async function archiveProfile(authPath:string){return new Promise<Buffer>((resolve,reject)=>{const archive=archiver('zip',{zlib:{level:6}}),chunks:Buffer[]=[];let total=0;archive.on('data',(chunk:Buffer)=>{total+=chunk.length;if(total>24*1024*1024){archive.abort();reject(Error('Sessão maior que o limite de armazenamento.'));return;}chunks.push(chunk)});archive.on('error',reject);archive.on('end',()=>resolve(Buffer.concat(chunks)));archive.directory(authPath,false,(entry:any)=>/(^|\/)(Cache|Code Cache|GPUCache|ShaderCache|GrShaderCache|DawnCache|Crashpad|BrowserMetrics)(\/|$)|(^|\/)Singleton/.test(entry.name)?false:entry);void archive.finalize();});}
async function restoreProfile(bytes:Buffer,authPath:string){const unzipper=await import('unzipper');const stream=Readable.from([bytes]).pipe(unzipper.Parse({forceStream:true}));let total=0;for await(const entry of stream){const dest=path.resolve(authPath,entry.path);if(!dest.startsWith(path.resolve(authPath)+path.sep))throw Error('Arquivo de sessão inválido.');if(entry.type==='Directory'){await mkdir(dest,{recursive:true});entry.autodrain();}else{const bytes=await entry.buffer();total+=bytes.length;if(total>96*1024*1024)throw Error('Arquivo de sessão muito grande.');await mkdir(path.dirname(dest),{recursive:true});await writeFile(dest,bytes,{mode:0o600});}}}
const sdkId=(id:any)=>typeof id==='string'?id:id?._serialized;
export async function runCloudJob(id:string,pair:boolean){
 let client:any,dir:string|undefined,ready=false,finished=false;const started=Date.now();let phase='erro',stage='inicialização';
 try{
  const saved=pair?undefined:await read('whatsapp:cloud:session');if(!pair&&!saved){await status('aguardando-pareamento','Conecte o WhatsApp pelo QR code antes de sincronizar.');return;}
  dir=await mkdtemp(path.join(tmpdir(),'comuni-wa-'));const authPath=path.join(dir,'auth');await mkdir(authPath,{recursive:true,mode:0o700});if(saved)await restoreProfile(openWhatsApp(saved,secret()),authPath);
  stage='abertura do navegador';
  const [{default:chromium},whatsapp]=await Promise.all([import('@sparticuz/chromium'),import('whatsapp-web.js')]);
  const {Client,LocalAuth}=whatsapp.default;
  client=new Client({authStrategy:new LocalAuth({dataPath:authPath,clientId:'market'}),webVersionCache:{type:'local',path:path.join(dir,'web-cache')},puppeteer:{headless:true,executablePath:await chromium.executablePath(),args:chromium.args,timeout:45000}});
  stage='autenticação do WhatsApp';
  const authenticated=new Promise<void>((resolve,reject)=>{
   client.on('qr',(qr:string)=>{if(finished)return;if(!pair){reject(Error('O WhatsApp pediu um novo pareamento. Abra o QR code no planner.'));return;}void put('whatsapp:cloud:qr',sealWhatsApp(Buffer.from(JSON.stringify({qr,expires:Date.now()+45000})),secret())).then(()=>status('qr','Escaneie o QR code em WhatsApp → Aparelhos conectados.')).catch(()=>reject(Error('Não foi possível preparar o pareamento.')));});
   client.once('ready',()=>{ready=true;resolve()});client.once('auth_failure',()=>reject(Error('O WhatsApp recusou a sessão. Faça um novo pareamento.')));
  });
  let timer:ReturnType<typeof setTimeout>|undefined;const timeout=new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(Error(pair?'O tempo do QR code terminou. Tente conectar novamente.':'A conexão com o WhatsApp demorou demais. Tente novamente.')),pair?155000:100000)});
  try{await Promise.race([Promise.all([client.initialize(),authenticated]),timeout])}finally{if(timer)clearTimeout(timer)}
  if(pair){
   stage='salvamento da sessão';
   await status('salvando','Pareamento recebido. Salvando a sessão com segurança…');
   await new Promise(r=>setTimeout(r,5000));
   await client.destroy();client=undefined;finished=true;
   await put('whatsapp:cloud:session',sealWhatsApp(await archiveProfile(authPath),secret()));
   await status('conectado','Sessão salva. Clique em Sincronizar agora para verificar o grupo Mercado.');
   return;
  }
  stage='leitura do grupo Mercado';
  await status('sincronizando','Lendo textos e reações do grupo Mercado…');
  const config=await marketConfig();if(!config.enabled)throw Error('Conexão desativada.');const chats=await client.getChats(),matches=chats.filter((c:any)=>c.isGroup&&(config.groupId?c.id._serialized===config.groupId:c.name==='Mercado'));
  if(matches.length!==1)throw Error(matches.length>1?'Há mais de um grupo Mercado. É necessário selecionar o grupo correto.':'O grupo Mercado não foi encontrado nesta conta.');const chat=matches[0];await marketHeartbeat(chat.id._serialized,config);
  let activated=await read('whatsapp:cloud:activated');if(!activated){activated=String(Date.now());await put('whatsapp:cloud:activated',activated)}
  const state=await getMarketState(),messages=await chat.fetchMessages({limit:200});let count=0;
  for(const m of messages){if(Date.now()-started>210000)throw Error('A sincronização atingiu o limite de tempo. Os registros já recebidos foram preservados.');if(m.type!=='chat'||!m.body?.trim())continue;const messageId=digest(sdkId(m.id)),previous=state.messages[messageId];if(m.timestamp*1000<Number(activated)&&!previous)continue;
   if(!(await marketConfig()).enabled)throw Error('Conexão desativada.');
   await processMarketEvent({kind:'message',groupId:chat.id._serialized,messageId,at:m.timestamp*1000,text:m.body.slice(0,4000)});count++;
   const reactions=await m.getReactions();const seen=new Set<string>();
   for(const list of reactions){for(const r of list.senders||[]){if(!r.senderId)continue;const actor=digest(r.senderId),emoji=r.reaction||list.id||'';seen.add(actor);const at=Math.trunc(r.timestamp>1e12?r.timestamp:r.timestamp*1000);if(!Number.isFinite(at))continue;await processMarketEvent({kind:'reaction',groupId:chat.id._serialized,messageId,actor,emoji,at});}}
   for(const [actor,r]of Object.entries(previous?.reactions||{})){if(!seen.has(actor)&&reactionKind(r.emoji))await processMarketEvent({kind:'reaction',groupId:chat.id._serialized,messageId,actor,emoji:'',at:Date.now()});}
  }
  stage='salvamento da sessão';
  await client.destroy();client=undefined;finished=true;
  await put('whatsapp:cloud:session',sealWhatsApp(await archiveProfile(authPath),secret()));
  const synced=new Date().toISOString();await put('whatsapp:cloud:last-sync',synced);phase='conectado';await status(phase,`${count} mensagem(ns) verificada(s). ${messages.length>=200?'Foram consultadas as últimas 200 mensagens; confira períodos com muitas mensagens.':'Sincronização concluída.'}`,{count});
 }catch(e){const text=e instanceof Error?e.message:'';const safe=/^(O WhatsApp|O tempo|A conexão|O grupo|Há mais|A sincronização|Conexão desativada|Sessão maior)/.test(text)?text:`Falha na etapa: ${stage}. Código: ${/Protocol error|Target closed|Session closed|Connection closed/.test(text)?'WA_BROWSER_CLOSED':/ENOENT|executable|shared libraries/.test(text)?'WA_BROWSER_START':/Evaluation failed|Cannot read properties/.test(text)?'WA_WEB_INIT':'WA_SESSION'}.`;console.error('WhatsApp cloud failure',{stage,code:/Protocol error|Target closed|Session closed|Connection closed/.test(text)?'WA_BROWSER_CLOSED':/ENOENT|executable|shared libraries/.test(text)?'WA_BROWSER_START':/Evaluation failed|Cannot read properties/.test(text)?'WA_WEB_INIT':'WA_SESSION',errorType:e instanceof Error?e.name:'Unknown'});await status('erro',safe).catch(()=>{});
 }finally{finished=true;if(client)await client.destroy().catch(()=>{});if(dir)await rm(dir,{recursive:true,force:true}).catch(()=>{});await sql().query("DELETE FROM planner_settings WHERE key='whatsapp:cloud:qr'",[]).catch(()=>{});await sql().query("DELETE FROM planner_settings WHERE key='whatsapp:cloud:lock' AND (value::jsonb->>'id')=$1",[id]).catch(()=>{});}
}
export async function alreadySyncedToday(){const d=await read('whatsapp:cloud:last-sync');return !!d&&new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(d))===today();}
