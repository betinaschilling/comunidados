import type {Item} from './planner';
export type ActivityStatus='feito'|'nao-feito'|'pendente'|'atrasado';
const meals=['Pré-treino','Café da manhã','Almoço','Lanche','Café da tarde','Janta'];
export function activityOrder(i:Item){if(i.sortOrder!==undefined)return i.sortOrder;if(i.category==='Comida'){const n=meals.indexOf(i.title);return n<0?9:n;}if(i.category==='Água')return 100+(Number(i.title.match(/Água (\d+)/)?.[1])||0);if(i.category==='Exercício')return i.title==='Pesagem e medidas'?200:201;if(i.category==='Remédios e vitaminas'){const n=['Atentah','Vurtuoso','Pillfood — 1 de 2','Pillfood — 2 de 2','Baristar / vitaminas — 1 de 2','Baristar / vitaminas — 2 de 2','Vitamina B12 — sublingual','Vitamina D — junto com almoço'].indexOf(i.title);return 300+(n<0?9:n);}return 500;}
export function activityStatus(i:Item,today:string):ActivityStatus{if(i.done)return 'feito';if(i.notDone||(i.routine&&i.date<today))return 'nao-feito';if(!i.routine&&i.date<today)return 'atrasado';return 'pendente';}
export function isPending(i:Item,today:string){return ['pendente','atrasado'].includes(activityStatus(i,today));}
export function compareActivities(a:Item,b:Item){return a.date.localeCompare(b.date)||activityOrder(a)-activityOrder(b)||a.title.localeCompare(b.title,'pt-BR')||a.id.localeCompare(b.id);}
