import crypto from 'node:crypto';
import postgres from 'postgres';

const COOKIE = 'clinical_ops_session';
const DEMO_SESSION_SECRET = 'clinical-ops-zero-config-demo-session-key-2026';
const DEMO_USERS = [
  {login:'milana',password:'Milana2026!',name:'Milana',role:'milana'},
  {login:'clinical-ops',password:'Staff2026!',name:'Clinical Ops Staff',role:'staff'}
];
let dbClient;
let schemaPromise;

export function authMode(){
  const secure = Boolean(
    process.env.SESSION_SECRET && process.env.SESSION_SECRET.length >= 24 &&
    process.env.MILANA_LOGIN && process.env.MILANA_PASSWORD &&
    process.env.STAFF_LOGIN && process.env.STAFF_PASSWORD
  );
  return secure ? 'production' : 'demo';
}

function secret() {
  return authMode()==='production' ? process.env.SESSION_SECRET : DEMO_SESSION_SECRET;
}
function b64(v){ return Buffer.from(v).toString('base64url'); }
function sign(v){ return crypto.createHmac('sha256', secret()).update(v).digest('base64url'); }
function safeEq(a,b){ const A=Buffer.from(String(a)); const B=Buffer.from(String(b)); return A.length===B.length && crypto.timingSafeEqual(A,B); }

export function credentials(login,password){
  const candidates = authMode()==='production' ? [
    {login:process.env.MILANA_LOGIN,password:process.env.MILANA_PASSWORD,name:process.env.MILANA_DISPLAY_NAME||'Milana',role:'milana'},
    {login:process.env.STAFF_LOGIN,password:process.env.STAFF_PASSWORD,name:process.env.STAFF_DISPLAY_NAME||'Clinical Ops Staff',role:'staff'}
  ] : DEMO_USERS;
  const hit=candidates.find(x=>x.login && x.password && safeEq(login,x.login) && safeEq(password,x.password));
  return hit ? {login:hit.login,name:hit.name,role:hit.role} : null;
}
export function makeSession(user){
  const payload=b64(JSON.stringify({...user,mode:authMode(),exp:Date.now()+1000*60*60*12}));
  return `${payload}.${sign(payload)}`;
}
export function setCookie(res,value){
  res.setHeader('Set-Cookie',`${COOKIE}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=43200`);
}
export function clearCookie(res){ res.setHeader('Set-Cookie',`${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`); }
export function session(req){
  try{
    const raw=(req.headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith(`${COOKIE}=`))?.slice(COOKIE.length+1);
    if(!raw) return null;
    const [payload,sig]=raw.split('.'); if(!payload||!sig||!safeEq(sign(payload),sig)) return null;
    const user=JSON.parse(Buffer.from(payload,'base64url').toString('utf8'));
    if(!user.exp || user.exp<Date.now()) return null;
    if(user.mode!==authMode()) return null;
    return {login:user.login,name:user.name,role:user.role};
  }catch{return null;}
}

// Shared server-side persistence is deliberately disabled in zero-config demo mode.
// This keeps the public-repo demo useful for UI testing without pretending the public
// fallback credentials are suitable for storing central clinical annotations.
export function dbEnabled(){ return authMode()==='production' && Boolean(process.env.DATABASE_URL); }
export function db(){
  if(!dbEnabled()) return null;
  if(!dbClient) dbClient=postgres(process.env.DATABASE_URL,{ssl:'require',max:2,idle_timeout:10,connect_timeout:10});
  return dbClient;
}
export async function ensureSchema(){
  if(!dbEnabled()) return false;
  if(!schemaPromise){
    const sql=db();
    schemaPromise=(async()=>{
      await sql`CREATE TABLE IF NOT EXISTS clinical_ops_annotations (
        study_code text NOT NULL, site_id text NOT NULL, patient_id text NOT NULL, visit_no integer NOT NULL,
        note_text text, override_date date, override_regimen text, updated_by text, updated_role text,
        updated_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(study_code,site_id,patient_id,visit_no)
      )`;
      await sql`CREATE TABLE IF NOT EXISTS clinical_ops_audit (
        id bigserial PRIMARY KEY, study_code text NOT NULL, site_id text, actor text, actor_role text,
        action text NOT NULL, detail text, created_at timestamptz NOT NULL DEFAULT now()
      )`;
    })();
  }
  await schemaPromise; return true;
}
