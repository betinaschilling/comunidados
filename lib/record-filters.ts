import type {Item} from './planner';
import {activityOrder,activityStatus,householdGroup} from './activity';
export const emptyRecordFilters={from:'',to:'',dateMode:'todos',order:'',category:'',group:'',type:'',evidence:''};
export type RecordFilters=typeof emptyRecordFilters;
export function matchesRecord(i:Item,f:RecordFilters,query:string,status:string,today:string,items:Item[]){
 const q=query.trim().toLocaleLowerCase('pt-BR');
 if(q&&!i.title.toLocaleLowerCase('pt-BR').includes(q))return false;
 if(status!=='todos'&&activityStatus(i,today,items)!==status)return false;
 if(f.dateMode==='sem-data'&&i.date)return false;
 if(f.dateMode==='com-data'&&!i.date)return false;
 if(f.from&&(!i.date||i.date<f.from))return false;
 if(f.to&&(!i.date||i.date>f.to))return false;
 if(f.order!==''&&activityOrder(i)!==Number(f.order))return false;
 if(f.category&&i.category!==f.category)return false;
 if(f.group&&(!['Casa','Casal e família'].includes(i.category)||householdGroup(i)!==f.group))return false;
 if(f.type&&(f.type==='rotina')!==i.routine)return false;
 const has=i.attachments.length>0||!!i.link||!!i.notes.trim()||Object.keys(i.measurements).length>0;
 if(f.evidence==='com'&&!has||f.evidence==='sem'&&has)return false;
 if(f.evidence==='anexos'&&!i.attachments.length||f.evidence==='link'&&!i.link||f.evidence==='notas'&&!i.notes.trim()||f.evidence==='medidas'&&!Object.keys(i.measurements).length)return false;
 return true;
}
