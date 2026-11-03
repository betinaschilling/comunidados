"use server";
import {AuthError} from 'next-auth';
import {signIn} from '@/auth';
import {requestPassword,resetPassword} from '@/lib/accounts';
import {redirect} from 'next/navigation';
export type FormState={message:string;ok?:boolean};
export async function loginAction(_:FormState,data:FormData):Promise<FormState>{try{await signIn('credentials',{email:data.get('email'),password:data.get('password'),redirectTo:'/planner'});}catch(error){if(error instanceof AuthError)return {message:'E-mail ou senha inválidos, ou limite de tentativas atingido. Tenta novamente mais tarde.'};throw error;}return {message:''};}
export async function requestAction(_:FormState,data:FormData):Promise<FormState>{try{await requestPassword(data.get('email'));return {ok:true,message:'Se o e-mail estiver autorizado, receberás um link para definir tua senha.'};}catch{return {message:'Não foi possível enviar agora. Tenta novamente mais tarde.'};}}
export async function resetAction(_:FormState,data:FormData):Promise<FormState>{if(data.get('password')!==data.get('confirmation'))return {message:'As senhas precisam ser iguais.'};if(!await resetPassword(data.get('token'),data.get('password')))return {message:'Link inválido ou expirado, ou senha com menos de 12 caracteres.'};redirect('/login?changed=1');}
