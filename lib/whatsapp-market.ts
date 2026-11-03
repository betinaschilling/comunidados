import {createHash} from 'node:crypto';
import type {Item} from './planner';
export type MarketEvent={kind:'message'|'reaction';groupId:string;messageId:string;at:number;text?:string;actor?:string;emoji?:string};
type Entry={id:string;title:string;baseDone:boolean};
type Reaction={emoji:string;at:number;seen?:string[]};
export type MarketMessage={id:string;text:string;at:number;entries:Entry[];review:boolean;ignored?:boolean;reactions:Record<string,Reaction>};
export type MarketState={messages:Record<string,MarketMessage>};
export const initialMarketState=():MarketState=>({messages:{}});
export const digest=(s:string)=>createHash('sha256').update(s).digest('hex');
export function reactionKind(emoji:string){const clean=emoji.replace(/[\uFE0F\u{1F3FB}-\u{1F3FF}]/gu,'');return clean==='👍'?'feito':['❌','✖','❎'].includes(clean)?'nao-feito':null;}
export function validMarketEvent(e:any):e is MarketEvent{return !!e&&['message','reaction'].includes(e.kind)&&typeof e.groupId==='string'&&/^[\w-]{5,120}@g\.us$/.test(e.groupId)&&typeof e.messageId==='string'&&/^[a-f0-9]{64}$/.test(e.messageId)&&Number.isSafeInteger(e.at)&&e.at>0&&e.at<=Date.now()+300000&&(e.kind==='message'?typeof e.text==='string'&&e.text.length>0&&e.text.length<=4000:typeof e.actor==='string'&&/^[a-f0-9]{64}$/.test(e.actor)&&typeof e.emoji==='string'&&e.emoji.length<=24);}
export function parseMarketText(text:string){
 const lines=text.split(/\n/).map(s=>s.trim().replace(/^(?:[-*•]|\d+[.)])\s*/, '').trim()).filter(Boolean);if(!lines.length||lines.length>30)return null;
 const result:{title:string;done:boolean}[]=[];
 for(let line of lines){const bought=/^(?:comprei|compramos|comprado(?:s|a|as)?)[\s:]+/i.test(line),explicit=/^(?:comprar|(?:preciso|precisamos)(?: de)?|falt(?:a|am)|comprei|compramos|comprado(?:s|a|as)?)[\s:]+/i.test(line);line=line.replace(/^(?:comprar|(?:preciso|precisamos)(?: de)?|falt(?:a|am)|comprei|compramos|comprado(?:s|a|as)?)[\s:]+/i,'').trim();
 if(!line||line.length>140||/[?!]/.test(line)||(!explicit&&(/^(?:sim|n[aã]o|ok|obrigad[oa]|bom dia|boa tarde|boa noite|beleza|valeu|vou|vamos|acho|pode|manda|olha|j[aá]|hoje|amanh[aã]|precisa|eu|vc|voc[eê]|paulo)\b/i.test(line)||line.split(/\s+/).length>10||/[.:]/.test(line))))return null;
 result.push({title:line.charAt(0).toLocaleUpperCase('pt-BR')+line.slice(1),done:bought});}
 return result;
}
const key=(s:string)=>s.normalize('NFD').replace(/\p{Diacritic}/gu,'').toLocaleLowerCase('pt-BR').trim();
export function marketStatus(m:MarketMessage){const active=Object.values(m.reactions).filter(r=>reactionKind(r.emoji)).sort((a,b)=>b.at-a.at||a.emoji.localeCompare(b.emoji));return active[0]?reactionKind(active[0].emoji):null;}
export function applyMarketEvent(state:MarketState,event:MarketEvent,existing:Item[],override?:string){
 const next:MarketState=structuredClone(state),old=next.messages[event.messageId];let m=old;
 if(!m){if(Object.keys(next.messages).length>=1000)throw Error('O histórico do Mercado atingiu o limite. É preciso arquivar antes de continuar.');m={id:event.messageId,text:'',at:event.at,entries:[],review:false,reactions:{}};next.messages[event.messageId]=m;}
 if(event.kind==='message'){
  if(old?.text&&override===undefined)return {state,items:[] as Item[],changed:false};
  m.text=event.text!;m.at=event.at;m.ignored=false;const parsed=override!==undefined?[{title:override,done:false}]:parseMarketText(m.text);m.review=!parsed;
  if(parsed)m.entries=parsed.map((entry,index)=>{const matches=entry.done?existing.filter(i=>i.householdGroup==='Mercado'&&!i.done&&!i.notDone&&key(i.title)===key(entry.title)):[];return {id:matches.length===1?matches[0].id:'market:'+digest(event.messageId+':'+index),title:entry.title,baseDone:entry.done};});
 }else{const previous=m.reactions[event.actor!];if(!reactionKind(event.emoji!)&&(!previous||!reactionKind(previous.emoji)))return {state,items:[] as Item[],changed:false};const eventKey=digest(event.actor+':'+event.at+':'+event.emoji);if(previous&&(previous.at>event.at||previous.seen?.includes(eventKey)||previous.at===event.at&&previous.emoji===event.emoji))return {state,items:[] as Item[],changed:false};m.reactions[event.actor!]={emoji:event.emoji!,at:event.at,seen:[...(previous?.seen||[]),eventKey].slice(-64)};}
 const status=marketStatus(m);const lastAt=Math.max(m.at,...Object.values(m.reactions).map(r=>r.at));const items=m.entries.map(e=>{const oldItem=existing.find(i=>i.id===e.id);const done=status?status==='feito':e.baseDone;return {...oldItem,id:e.id,title:e.title,date:oldItem?.date||'',category:'Casa',householdGroup:'Mercado',routine:false,done,notDone:status==='nao-feito',completedAt:done?new Date(lastAt).toISOString():null,sortOrder:oldItem?.sortOrder??700,amount:0,link:oldItem?.link||'',notes:oldItem?.notes||'Adicionado pelo grupo Mercado do WhatsApp.',measurements:oldItem?.measurements||{},attachments:oldItem?.attachments||[]} as Item;});
 return {state:next,items,changed:true};
}
