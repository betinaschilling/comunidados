const planBlock=/\[TREINUS_PLANEJADO\]([\s\S]*?)\[\/TREINUS_PLANEJADO\]/;
export function treinusPlan(notes:string){return notes.match(planBlock)?.[1].trim()||'';}
export function personalNotes(notes:string){return notes.replace(planBlock,'').trim();}
export function updatePersonalNotes(notes:string,text:string){const block=notes.match(planBlock)?.[0];return [text,block].filter(Boolean).join('\n\n');}
