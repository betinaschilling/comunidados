import {randomBytes,scrypt as scryptCallback,timingSafeEqual,createHash} from 'node:crypto';
import {promisify} from 'node:util';
const scrypt=promisify(scryptCallback);
export function validPassword(value:unknown):value is string{return typeof value==='string'&&value.length>=12&&value.length<=256;}
export async function hashPassword(password:string){const salt=randomBytes(16).toString('hex');const key=await scrypt(password,salt,64) as Buffer;return `scrypt:${salt}:${key.toString('hex')}`;}
export async function verifyPassword(password:unknown,hash:unknown){if(typeof password!=='string'||password.length>256||typeof hash!=='string'||!/^scrypt:[a-f0-9]{32}:[a-f0-9]{128}$/.test(hash))return false;const[,salt,expected]=hash.split(':');const actual=await scrypt(password,salt,64) as Buffer;return timingSafeEqual(actual,Buffer.from(expected,'hex'));}
export const tokenHash=(token:string)=>createHash('sha256').update(token).digest('hex');
