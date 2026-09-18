import { authMode, clearCookie, credentials, makeSession, session, setCookie } from '../lib/core.js';

export default async function handler(req,res){
  const mode=authMode();
  if(req.method==='GET'){
    const user=session(req);
    return res.status(200).json(user?{authenticated:true,user,mode}:{authenticated:false,mode});
  }
  if(req.method!=='POST') return res.status(405).json({error:'Method not allowed'});

  const action=String(req.query?.action||req.body?.action||'login');
  if(action==='logout'){
    clearCookie(res);
    return res.status(200).json({ok:true,mode});
  }

  const user=credentials(String(req.body?.login||'').trim(),String(req.body?.password||''));
  if(!user) return res.status(401).json({error:'Invalid login or password',mode});

  setCookie(res,makeSession(user));
  return res.status(200).json({user,mode});
}
