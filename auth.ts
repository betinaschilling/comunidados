import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import {isAllowedEmail} from './lib/access';
import {authenticate,currentSession} from './lib/accounts';
export const {handlers,auth,signIn,signOut}=NextAuth({providers:[Credentials({credentials:{email:{label:'E-mail',type:'email'},password:{label:'Senha',type:'password'}},async authorize(credentials){try{return await authenticate(credentials.email,credentials.password)}catch{return null;}}})],session:{strategy:'jwt',maxAge:60*60*24*7},pages:{signIn:'/login',error:'/login'},callbacks:{async jwt({token,user}){if(user)token.sessionVersion=(user as typeof user&{sessionVersion:number}).sessionVersion;return token;},async session({session,token}){(session as typeof session&{sessionVersion:unknown}).sessionVersion=token.sessionVersion;return session;}}});
export async function isOwner(){const session=await auth();if(!isAllowedEmail(session?.user?.email))return false;try{return await currentSession((session as typeof session&{sessionVersion:unknown})?.sessionVersion)}catch{return false;}}
