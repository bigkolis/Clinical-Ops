import crypto from 'node:crypto';
import postgres from 'postgres';

const BUILTIN_USERS = [
  {login:'milana',name:'Milana',role:'milana',salt:'NDKn_cORQz-zTPGHlssSTw',hash:'Q1VssteZMOo8V5Xtcrn4sCix2q-1OW5-U7OnhkGkKO9bb23Fz8vqZoxrVdeqe_O33qJhXr1riGQelQqm0IJ4-A'},
  {login:'clinical-ops',name:'Clinical Ops Staff',role:'staff',salt:'RnvDfmOYi9r0YZSeWgu1xA',hash:'PENGF4Lq_3TGVtHUXLonY0HYymUf1UDEzDOMbKDZXg2FCYH58DO7jj3tCWQ3caruey_s86NzfLDmikbSWf4WxQ'}
];
const SESSION_COOKIE='clinical_ops_session';
const SESSION_MAX_AGE=60*60*12;
let dbClient;let schemaPromise;

function safeEq(a,b){const A=Buffer.from(String(a)),B=Buffer.from(String(b));return A.length===B.length&&crypto.timingSafeEqual(A,B);}
function fromB64url(v){return Buffer.from(String(v),'base64url');}
function verifyPassword(password,user){const derived=crypto.scryptSync(String(password),fromB64url(user.salt),64,{N:16384,r:8,p:1});return crypto.timingSafeEqual(derived,fromB64url(user.hash));}
function cleanInitials(value){return String(value||'').trim().replace(/[^A-Za-zА-Яа-я0-9._-]/g,'').slice(0,12);}
function parseCookies(req){const out={};String(req.headers?.cookie||'').split(';').forEach(part=>{const i=part.indexOf('=');if(i>0){const k=part.slice(0,i).trim(),v=part.slice(i+1).trim();try{out[k]=decodeURIComponent(v);}catch{out[k]=v;}}});return out;}
function base64Json(value){return Buffer.from(JSON.stringify(value)).toString('base64url');}
function sessionMaterial(){if(process.env.SESSION_SECRET)return `explicit:${process.env.SESSION_SECRET}`;if(process.env.DATABASE_URL)return `db:${process.env.DATABASE_URL}`;return `test-only:${BUILTIN_USERS.map(x=>x.hash).join('|')}`;}
function sessionKey(){return crypto.createHash('sha256').update(`clinical-ops-session-v3|${sessionMaterial()}`).digest();}
function sign(value){return crypto.createHmac('sha256',sessionKey()).update(value).digest('base64url');}
function verifyToken(token){try{const [payload,sig]=String(token||'').split('.');if(!payload||!sig||!safeEq(sign(payload),sig))return null;const data=JSON.parse(Buffer.from(payload,'base64url').toString('utf8'));if(data.v!==3||!data.login||!data.role||Number(data.exp||0)<Date.now())return null;return data;}catch{return null;}}
function secureCookieFlag(){return process.env.NODE_ENV==='production'?'; Secure':'';}

export function credentials(login,password){
  const l=String(login||'').trim(),p=String(password||'');
  if(process.env.AUTH_USE_ENV==='1'){
    const envUsers=[
      {login:process.env.MILANA_LOGIN,password:process.env.MILANA_PASSWORD,name:process.env.MILANA_DISPLAY_NAME||'Milana',role:'milana'},
      {login:process.env.STAFF_LOGIN,password:process.env.STAFF_PASSWORD,name:process.env.STAFF_DISPLAY_NAME||'Clinical Ops Staff',role:'staff'}
    ].filter(x=>x.login&&x.password);
    const hit=envUsers.find(x=>safeEq(l,x.login)&&safeEq(p,x.password));
    return hit?{login:hit.login,name:hit.name,role:hit.role}:null;
  }
  const hit=BUILTIN_USERS.find(x=>safeEq(l,x.login)&&verifyPassword(p,x));
  return hit?{login:hit.login,name:hit.name,role:hit.role}:null;
}

export function issueSession(user,initials=''){
  const actorInitials=cleanInitials(initials);
  const payload=base64Json({v:3,login:user.login,name:user.name,role:user.role,actorInitials,iat:Date.now(),exp:Date.now()+SESSION_MAX_AGE*1000});
  return `${payload}.${sign(payload)}`;
}
export function sessionCookie(token){return `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${SESSION_MAX_AGE}${secureCookieFlag()}`;}
export function clearSessionCookie(){return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${secureCookieFlag()}`;}
export function sessionSecurityMode(){return process.env.SESSION_SECRET?'explicit-secret':process.env.DATABASE_URL?'database-derived':'test-only-no-db';}
export function sanitizeInitials(value){return cleanInitials(value);}

export function authenticate(req){
  try{
    const cookieSession=verifyToken(parseCookies(req)[SESSION_COOKIE]);
    if(cookieSession)return {login:cookieSession.login,name:cookieSession.name,role:cookieSession.role,actorInitials:cookieSession.actorInitials||'',session:'cookie'};
    const header=String(req.headers?.authorization||'');
    if(!header.startsWith('Basic '))return null;
    const raw=Buffer.from(header.slice(6),'base64').toString('utf8'),i=raw.indexOf(':');
    if(i<1)return null;
    const user=credentials(raw.slice(0,i),raw.slice(i+1));
    return user?{...user,actorInitials:cleanInitials(req.headers?.['x-actor-initials']),session:'basic'}:null;
  }catch{return null;}
}
export function publicUser(user){return user?{login:user.login,name:user.name,role:user.role,initials:user.actorInitials||''}:null;}
export function actorName(req,user){const initials=user?.actorInitials||(user?.session==='basic'?cleanInitials(req.headers?.['x-actor-initials']):'');return initials?`${user.name||user.login} · ${initials}`:(user.name||user.login);}
export function requestIp(req){return String(req.headers?.['x-forwarded-for']||req.headers?.['x-real-ip']||req.socket?.remoteAddress||'unknown').split(',')[0].trim().slice(0,128);}
export function auditIpHash(req){return crypto.createHmac('sha256',sessionKey()).update(requestIp(req)).digest('hex').slice(0,32);}
export function sameOriginWrite(req){
  const method=String(req.method||'GET').toUpperCase();
  if(method==='GET'||method==='HEAD'||method==='OPTIONS')return true;
  const fetchSite=String(req.headers?.['sec-fetch-site']||'').toLowerCase();
  if(fetchSite&&!['same-origin','same-site','none'].includes(fetchSite))return false;
  const origin=String(req.headers?.origin||'');
  if(!origin)return true;
  try{
    const expected=String(req.headers?.['x-forwarded-host']||req.headers?.host||'').toLowerCase();
    return Boolean(expected)&&new URL(origin).host.toLowerCase()===expected;
  }catch{return false;}
}

export function dbEnabled(){return Boolean(process.env.DATABASE_URL);}
export function db(){if(!dbEnabled())return null;if(!dbClient)dbClient=postgres(process.env.DATABASE_URL,{ssl:process.env.DB_SSL==='disable'?false:'require',max:3,idle_timeout:10,connect_timeout:10});return dbClient;}
export async function ensureSchema(){
  if(!dbEnabled())return false;
  if(!schemaPromise){const sql=db();schemaPromise=(async()=>{
    await sql`CREATE TABLE IF NOT EXISTS clinical_ops_annotations (study_code text NOT NULL,site_id text NOT NULL,patient_id text NOT NULL,visit_no integer NOT NULL,note_text text,override_date date,override_regimen text,updated_by text,updated_role text,updated_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(study_code,site_id,patient_id,visit_no))`;
    await sql`ALTER TABLE clinical_ops_annotations ADD COLUMN IF NOT EXISTS deviation_reason text`;
    await sql`ALTER TABLE clinical_ops_annotations ADD COLUMN IF NOT EXISTS deviation_no text`;
    await sql`ALTER TABLE clinical_ops_annotations ADD COLUMN IF NOT EXISTS deviation_status text`;
    await sql`ALTER TABLE clinical_ops_annotations ADD COLUMN IF NOT EXISTS deviation_owner text`;
    await sql`CREATE TABLE IF NOT EXISTS clinical_ops_annotation_history (id bigserial PRIMARY KEY,study_code text NOT NULL,site_id text NOT NULL,patient_id text NOT NULL,visit_no integer NOT NULL,payload jsonb NOT NULL,actor text,created_at timestamptz NOT NULL DEFAULT now())`;
    await sql`CREATE INDEX IF NOT EXISTS clinical_ops_annotation_history_lookup ON clinical_ops_annotation_history(study_code,site_id,patient_id,visit_no,created_at DESC)`;
    await sql`CREATE TABLE IF NOT EXISTS clinical_ops_audit (id bigserial PRIMARY KEY,study_code text NOT NULL,site_id text,actor text,actor_role text,action text NOT NULL,detail text,created_at timestamptz NOT NULL DEFAULT now())`;
    await sql`CREATE TABLE IF NOT EXISTS clinical_ops_snapshots (id bigserial PRIMARY KEY,study_code text NOT NULL,snapshot jsonb NOT NULL,actor text,actor_role text,created_at timestamptz NOT NULL DEFAULT now())`;
    await sql`CREATE INDEX IF NOT EXISTS clinical_ops_snapshots_latest ON clinical_ops_snapshots(study_code,created_at DESC)`;
    await sql`CREATE TABLE IF NOT EXISTS clinical_ops_login_audit (id bigserial PRIMARY KEY,login text,role text,initials text,event text NOT NULL,success boolean NOT NULL DEFAULT false,ip_hash text,user_agent text,created_at timestamptz NOT NULL DEFAULT now())`;
    await sql`CREATE INDEX IF NOT EXISTS clinical_ops_login_audit_time ON clinical_ops_login_audit(created_at DESC)`;
    await sql`CREATE INDEX IF NOT EXISTS clinical_ops_login_audit_ip ON clinical_ops_login_audit(ip_hash,created_at DESC)`;
  })();}
  try{await schemaPromise;return true;}catch(err){schemaPromise=null;throw err;}
}
