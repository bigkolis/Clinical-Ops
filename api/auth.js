import { clearCookie, credentials, makeSession, session, setCookie } from '../lib/core.js';

function authConfig(){
  return {
    milana:Boolean(process.env.MILANA_LOGIN && process.env.MILANA_PASSWORD),
    staff:Boolean(process.env.STAFF_LOGIN && process.env.STAFF_PASSWORD),
    sessionSecret:Boolean(process.env.SESSION_SECRET && process.env.SESSION_SECRET.length >= 24)
  };
}

export default async function handler(req,res){
  if(req.method==='GET'){
    const user=session(req);
    return res.status(200).json(user?{authenticated:true,user}:{authenticated:false});
  }
  if(req.method!=='POST') return res.status(405).json({error:'Method not allowed'});

  const action=String(req.query?.action||req.body?.action||'login');
  if(action==='logout'){
    clearCookie(res);
    return res.status(200).json({ok:true});
  }

  const cfg=authConfig();
  if((!cfg.milana && !cfg.staff) || !cfg.sessionSecret){
    return res.status(503).json({
      error:'Authentication is not configured on the server. Add the required Vercel Environment Variables and redeploy.'
    });
  }

  const user=credentials(String(req.body?.login||'').trim(),String(req.body?.password||''));
  if(!user) return res.status(401).json({error:'Invalid login or password'});

  try{
    setCookie(res,makeSession(user));
    return res.status(200).json({user});
  }catch{
    return res.status(503).json({error:'Authentication session is not configured correctly on the server.'});
  }
}
