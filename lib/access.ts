export const OWNER_EMAIL='cheila@comunidados.tech';
export function isAllowedEmail(email:unknown):boolean{return typeof email==='string'&&email.trim().toLowerCase()===OWNER_EMAIL;}
