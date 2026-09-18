import { authenticate, publicUser, credentials, issueSession, sessionCookie, clearSessionCookie, sanitizeInitials, dbEnabled, db, ensureSchema, auditIpHash, sessionSecurityMode } from '../lib/core.js';

const memoryAttempts=new Map();
function userAgent(req){return String(req.headers?.['user-agent']||'').slice(0,240);}
function attemptKey(req){try{return auditIpHash(req);}catch{return 'unknown';}}
function memoryBlocked(key){const now=Date.now(),arr=(memoryAttempts.get(key)||[]).filter(t=>now-t<15*60*1000);memoryAttempts.set(key,arr);return arr.length>=8;}
function memoryFail(key){const arr=memoryAttempts.get(key)||[];arr.push(Date.now());memoryAttempts.set(key,arr.slice(-12));}
function memorySuccess(key){memoryAttempts.delete(key);}
async function recordEvent(req,{login='',role='',initials='',event='login',success=false}={}){
  if(!dbEnabled())return;
  await ensureSchema();const sql=db();
  await sql`INSERT INTO clinical_ops_login_audit(login,role,initials,event,success,ip_hash,user_agent) VALUES(${String(login).slice(0,120)||null},${String(role).slice(0,40)||null},${String(initials).slice(0,20)||null},${String(event).slice(0,40)},${Boolean(success)},${attemptKey(req)},${userAgent(req)||null})`;
}
async function blocked(req){
  const key=attemptKey(req);
  if(!dbEnabled())return memoryBlocked(key);
  await ensureSchema();const sql=db();
  const [row]=await sql`SELECT count(*)::int AS n FROM clinical_ops_login_audit WHERE ip_hash=${key} AND success=false AND event='login' AND created_at > now()-interval '15 minutes'`;
  return Number(row?.n||0)>=8;
}

export default async function handler(req,res){
  const action=String(req.query?.action||req.body?.action||'').toLowerCase();
  if(req.method==='GET'){
    const user=authenticate(req);
    if(action==='audit'){
      if(!user)return res.status(401).json({error:'Unauthorized'});
      if(user.role!=='milana')return res.status(403).json({error:'Milana role required'});
      if(!dbEnabled())return res.status(200).json({enabled:false,events:[],securityMode:sessionSecurityMode()});
      await ensureSchema();const sql=db();
      const events=await sql`SELECT login,role,initials,event,success,ip_hash,user_agent,created_at FROM clinical_ops_login_audit ORDER BY created_at DESC LIMIT 200`;
      return res.status(200).json({enabled:true,events,securityMode:sessionSecurityMode()});
    }
    return res.status(200).json(user?{authenticated:true,user:publicUser(user),securityMode:sessionSecurityMode()}:{authenticated:false,securityMode:sessionSecurityMode()});
  }
  if(req.method!=='POST')return res.status(405).json({error:'Method not allowed'});

  if(action==='logout'){
    const user=authenticate(req);
    if(user)await recordEvent(req,{login:user.login,role:user.role,initials:user.actorInitials,event:'logout',success:true});
    res.setHeader('Set-Cookie',clearSessionCookie());
    return res.status(200).json({ok:true});
  }

  if(await blocked(req))return res.status(429).json({error:'Too many failed sign-in attempts. Try again later.'});
  const login=String(req.body?.login||'').trim(),password=String(req.body?.password||''),initials=sanitizeInitials(req.body?.initials||'');
  const user=credentials(login,password);
  if(!user){
    if(!dbEnabled())memoryFail(attemptKey(req));
    await recordEvent(req,{login,event:'login',success:false});
    return res.status(401).json({error:'Invalid login or password'});
  }
  if(user.role==='staff'&&initials.length<2){
    await recordEvent(req,{login:user.login,role:user.role,initials,event:'login',success:false});
    return res.status(400).json({error:'Staff initials are required for audit.'});
  }
  if(!dbEnabled())memorySuccess(attemptKey(req));
  const token=issueSession(user,initials);
  res.setHeader('Set-Cookie',sessionCookie(token));
  await recordEvent(req,{login:user.login,role:user.role,initials,event:'login',success:true});
  return res.status(200).json({user:{...user,initials},sessionPersistent:true,securityMode:sessionSecurityMode()});
}
