import {neon} from '@neondatabase/serverless';
import {timingSafeEqual,randomBytes} from 'node:crypto';
import {digest,applyMarketEvent,initialMarketState,type MarketState,type MarketEvent} from './whatsapp-market';
import {parse} from './planner';
export type MarketConfig={tokenHash?:string;enabled:boolean;groupId?:string};
function db(){if(!process.env.DATABASE_URL)throw Error('Missing database');return neon(process.env.DATABASE_URL);}
async function read(key:string){return (await db().query('SELECT value FROM planner_settings WHERE key=$1',[key]))[0]?.value as string|undefined;}
export async function marketConfig():Promise<MarketConfig>{const r=await read('whatsapp:market:config');return r?JSON.parse(r):{enabled:false};}
export async function marketAuthorized(req:Request){const config=await marketConfig();const token=req.headers.get('authorization')?.replace(/^Bearer /,'')||'';if(!config.enabled||!config.tokenHash||token.length<32||token.length>256)return null;const hash=digest(token);return timingSafeEqual(Buffer.from(hash),Buffer.from(config.tokenHash))?config:null;}
export async function saveMarketConfig(c:MarketConfig){await db().query('INSERT INTO planner_settings(key,value) VALUES($1,$2) ON CONFLICT(key) DO UPDATE SET value=excluded.value',['whatsapp:market:config',JSON.stringify(c)]);}
export async function createMarketToken(){const token=randomBytes(32).toString('base64url');const config=await marketConfig();await saveMarketConfig({...config,tokenHash:digest(token),enabled:true});return token;}
export async function getMarketState():Promise<MarketState>{const r=await read('whatsapp:market:state');return r?JSON.parse(r):initialMarketState();}
export async function marketHeartbeat(groupId:string,config:MarketConfig){
 if(config.groupId&&config.groupId!==groupId)throw Error('Grupo não autorizado.');
 if(!config.groupId){const changed=await db().query("UPDATE planner_settings SET value=$1 WHERE key='whatsapp:market:config' AND value=$2 RETURNING key",[JSON.stringify({...config,groupId}),JSON.stringify(config)]);if(!changed.length){const latest=await marketConfig();if(latest.groupId!==groupId)throw Error('Grupo não autorizado.');}}
 await db().query("INSERT INTO planner_settings(key,value) VALUES('whatsapp:market:last-seen',$1) ON CONFLICT(key) DO UPDATE SET value=excluded.value",[new Date().toISOString()]);
}
export async function processMarketEvent(event:MarketEvent,override?:string){
 const sql=db();await sql.query("INSERT INTO planner_settings(key,value) VALUES('whatsapp:market:state',$1) ON CONFLICT(key) DO NOTHING",[JSON.stringify(initialMarketState())]);
 for(let attempt=0;attempt<5;attempt++){
  const raw=(await read('whatsapp:market:state'))!;const state=JSON.parse(raw) as MarketState;
  const existing=(await sql.query("SELECT * FROM planner_items WHERE household_group='Mercado'",[])).map(parse);
  const applied=applyMarketEvent(state,event,existing,override);if(!applied.changed)return {ok:true,duplicate:true};
  const payload=JSON.stringify(applied.items.map(i=>({id:i.id,title:i.title,date:i.date,done:i.done,not_done:!!i.notDone,completed_at:i.completedAt,sort_order:i.sortOrder,notes:i.notes})));
  const rows=await sql.query(`WITH claimed AS (UPDATE planner_settings SET value=$1 WHERE key='whatsapp:market:state' AND value=$2 RETURNING key), updated AS (
   INSERT INTO planner_items(id,title,date,category,routine,done,not_done,completed_at,household_group,sort_order,notes)
   SELECT x.id,x.title,x.date,'Casa',false,x.done,x.not_done,x.completed_at,'Mercado',x.sort_order,x.notes FROM jsonb_to_recordset($3::jsonb) AS x(id text,title text,date text,done boolean,not_done boolean,completed_at text,sort_order integer,notes text) WHERE EXISTS(SELECT 1 FROM claimed)
   ON CONFLICT(id) DO UPDATE SET done=excluded.done,not_done=excluded.not_done,completed_at=excluded.completed_at RETURNING id)
   SELECT EXISTS(SELECT 1 FROM claimed) AS applied,(SELECT count(*) FROM updated) AS affected`,[JSON.stringify(applied.state),raw,payload]);
  if(rows[0]?.applied)return {ok:true,affected:Number(rows[0].affected)};
 }
 throw Error('Mercado está recebendo alterações simultâneas. Tente novamente.');
}
export async function marketSummary(){const config=await marketConfig(),state=await getMarketState();return {configured:!!config.tokenHash,enabled:config.enabled,groupBound:!!config.groupId,lastSeen:(await read('whatsapp:market:last-seen'))||null,reviews:Object.values(state.messages).filter(m=>m.review&&!m.ignored).map(m=>({id:m.id,text:m.text})).slice(-100)};}
export async function ignoreMarketMessage(id:string){const sql=db();for(let i=0;i<5;i++){const raw=await read('whatsapp:market:state');if(!raw)return;const state=JSON.parse(raw) as MarketState;if(!state.messages[id])return;state.messages[id].ignored=true;const r=await sql.query("UPDATE planner_settings SET value=$1 WHERE key='whatsapp:market:state' AND value=$2 RETURNING key",[JSON.stringify(state),raw]);if(r.length)return;}throw Error('Tente novamente.');}
