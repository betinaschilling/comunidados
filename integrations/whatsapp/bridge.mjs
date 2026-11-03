import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import pkg from 'whatsapp-web.js';
import QRCode from 'qrcode';
const {Client,LocalAuth}=pkg;
const url=new URL(process.env.PLANNER_WEBHOOK_URL||'https://comunidados.vercel.app/api/whatsapp/events');
if(url.protocol!=='https:'||url.pathname!=='/api/whatsapp/events'||url.username||url.password)throw Error('Configure uma URL HTTPS de /api/whatsapp/events.');
const token=process.env.WHATSAPP_BRIDGE_TOKEN||'';if(token.length<32)throw Error('Configure a chave privada da ponte no arquivo .env.');
const port=Number(process.env.PORT||3077),dir=path.resolve(process.env.DATA_DIR||'./data');await fs.mkdir(dir,{recursive:true,mode:0o700});
const hash=s=>createHash('sha256').update(s).digest('hex');
async function read(name,fallback){try{return JSON.parse(await fs.readFile(path.join(dir,name),'utf8'))}catch(e){if(e.code==='ENOENT')return fallback;throw e}}
async function write(name,value){const dest=path.join(dir,name);await fs.writeFile(dest+'.tmp',JSON.stringify(value),{mode:0o600});await fs.rename(dest+'.tmp',dest)}
let queue=await read('queue.json',[]),binding=await read('group.json',null),qr=null,phase='Iniciando',lastError='',selected=null,candidates=[],processing=false,serial=Promise.resolve();
function serially(fn){serial=serial.then(fn).catch(()=>{lastError='Não foi possível ler ou guardar um evento. Verifique a ponte.'});return serial;}
async function enqueue(event){if(queue.length>=5000){lastError='Fila cheia. Corrija a conexão antes de continuar.';return;}const id=hash(JSON.stringify(event));if(!queue.some(q=>q.id===id)){queue.push({id,event});await write('queue.json',queue);}void deliver();}
async function post(event){const r=await fetch(url,{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify(event),signal:AbortSignal.timeout(12000),redirect:'error'});if(!r.ok){const label=[401,403].includes(r.status)?'Confira a chave e o grupo autorizado.':'O planner não recebeu o evento. A ponte tentará novamente.';throw Error(label);}}
async function deliver(){if(processing||!selected)return;processing=true;try{while(queue.length){const entry=queue[0];await post(entry.event);await serially(async()=>{queue=queue.filter(q=>q.id!==entry.id);await write('queue.json',queue)});}lastError='';}catch(e){lastError=e.message;}finally{processing=false;}}
const idOf=id=>typeof id==='string'?id:id?._serialized;
function groupOf(m){return m.fromMe?m.to:m.from;}
async function message(m,force=false){if(!selected||groupOf(m)!==selected.id._serialized||m.type!=='chat'||!m.body?.trim())return;if(!force&&m.timestamp*1000<binding.startedAt)return;await enqueue({kind:'message',groupId:selected.id._serialized,messageId:hash(idOf(m.id)),at:m.timestamp*1000,text:m.body.slice(0,4000)});}
const puppeteer={headless:true};if(process.env.CHROME_EXECUTABLE_PATH)puppeteer.executablePath=process.env.CHROME_EXECUTABLE_PATH;
const client=new Client({authStrategy:new LocalAuth({dataPath:path.join(dir,'session')}),puppeteer});
client.on('qr',value=>{qr=value;phase='Leia o QR code no WhatsApp';});
client.on('authenticated',()=>{qr=null;phase='Conectando';});
client.on('auth_failure',()=>{qr=null;phase='Falha na autenticação';lastError='Reinicie a ponte e conecte novamente pelo QR code.';});
client.on('disconnected',()=>{qr=null;selected=null;phase='WhatsApp desconectado';});
client.on('ready',()=>serially(async()=>{
 const chats=await client.getChats(),wanted=process.env.WHATSAPP_GROUP_ID||binding?.groupId;
 const matches=chats.filter(c=>c.isGroup&&(wanted?c.id._serialized===wanted:c.name==='Mercado'));
 candidates=matches.map(c=>({name:c.name,id:c.id._serialized}));if(matches.length!==1||matches[0].name!=='Mercado'){phase='Escolha o grupo Mercado';lastError=matches.length>1?'Há mais de um grupo Mercado. Configure WHATSAPP_GROUP_ID com o grupo correto.':'Não encontrei o grupo Mercado. Confira se este WhatsApp participa dele.';return;}
 selected=matches[0];binding={groupId:selected.id._serialized,startedAt:binding?.startedAt||Date.now()};await write('group.json',binding);
 try{await post({kind:'heartbeat',groupId:selected.id._serialized,groupName:'Mercado'});phase='Conectado ao grupo Mercado';lastError='';}catch(e){lastError=e.message;}
 // Somente mensagens desde a ativação. Histórico anterior não é importado.
 const recent=await selected.fetchMessages({limit:100});for(const m of recent)await message(m);void deliver();
}));
client.on('message_create',m=>serially(()=>message(m)));
client.on('message_reaction',r=>serially(async()=>{
 if(!selected||!r.senderId)return;const original=await client.getMessageById(idOf(r.msgId));if(!original||groupOf(original)!==selected.id._serialized||original.type!=='chat')return;
 await message(original,true);const ts=Number.isFinite(r.timestamp)?(r.timestamp>1e12?r.timestamp:r.timestamp*1000):Date.now();
 await enqueue({kind:'reaction',groupId:selected.id._serialized,messageId:hash(idOf(original.id)),actor:hash(r.senderId),emoji:r.reaction||'',at:Math.trunc(ts)});
}));
setInterval(()=>{if(!selected)return;post({kind:'heartbeat',groupId:selected.id._serialized,groupName:'Mercado'}).catch(e=>{lastError=e.message});void deliver()},30000);
const html=String.raw`<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>ComuniDados · WhatsApp</title><style>body{font:16px Arial;background:#f7f8f3;color:#233d35;max-width:650px;margin:50px auto;padding:20px}section{background:white;padding:28px;border-radius:16px}img{width:280px;max-width:100%}small{display:block;line-height:1.7;color:#65776e}#error{color:#a14c3b}</style><section><h1>WhatsApp · Mercado</h1><p id="status">Carregando…</p><img id="qr" hidden alt="QR code de conexão do WhatsApp"><p id="error"></p><small>Abra WhatsApp → Aparelhos conectados → Conectar aparelho. Escaneie o QR code aqui. Somente textos e reações do grupo Mercado serão encaminhados ao planner. Esta conexão é não oficial e pode desconectar ou sofrer bloqueio.</small><p id="queue"></p><pre id="groups"></pre></section><script>async function refresh(){try{const d=await(await fetch('/status')).json();document.getElementById('status').textContent=d.phase;document.getElementById('error').textContent=d.error;document.getElementById('queue').textContent=d.pending+' evento(s) aguardando envio';document.getElementById('groups').textContent=d.candidates.length>1?d.candidates.map(c=>c.name+': '+c.id).join('\n'):'';const img=document.getElementById('qr');img.hidden=!d.qr;if(d.qr)img.src='/qr?t='+Date.now();}catch{document.getElementById('status').textContent='Ponte indisponível'}}refresh();setInterval(refresh,3000)</script></html>`;
http.createServer(async(req,res)=>{if(![`127.0.0.1:${port}`,`localhost:${port}`].includes(req.headers.host)||req.method!=='GET'){res.writeHead(403);return res.end();}res.setHeader('Cache-Control','no-store');res.setHeader('X-Frame-Options','DENY');res.setHeader('Referrer-Policy','no-referrer');try{const route=req.url.split('?')[0];if(route==='/'){res.setHeader('Content-Type','text/html; charset=utf-8');return res.end(html)}if(route==='/status'){res.setHeader('Content-Type','application/json');return res.end(JSON.stringify({phase,error:lastError,pending:queue.length,qr:!!qr,candidates}))}if(route==='/qr'&&qr){res.setHeader('Content-Type','image/png');return res.end(await QRCode.toBuffer(qr))}res.writeHead(404);res.end();}catch{res.writeHead(500);res.end('Ponte indisponível');}}).listen(port,'127.0.0.1',()=>console.log(`Ponte local disponível em http://127.0.0.1:${port}`));
process.on('SIGINT',async()=>{await serial;await client.destroy();process.exit(0)});
client.initialize().catch(()=>{phase='Não foi possível iniciar o navegador';lastError='Confira a instalação do Chrome/Chromium e reinicie a ponte.'});
