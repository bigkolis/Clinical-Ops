import crypto from 'node:crypto';
import postgres from 'postgres';

const BUILTIN_USERS = [
  {
    login: 'milana',
    name: 'Milana',
    role: 'milana',
    salt: 'NDKn_cORQz-zTPGHlssSTw',
    hash: 'Q1VssteZMOo8V5Xtcrn4sCix2q-1OW5-U7OnhkGkKO9bb23Fz8vqZoxrVdeqe_O33qJhXr1riGQelQqm0IJ4-A'
  },
  {
    login: 'clinical-ops',
    name: 'Clinical Ops Staff',
    role: 'staff',
    salt: 'RnvDfmOYi9r0YZSeWgu1xA',
    hash: 'PENGF4Lq_3TGVtHUXLonY0HYymUf1UDEzDOMbKDZXg2FCYH58DO7jj3tCWQ3caruey_s86NzfLDmikbSWf4WxQ'
  }
];

let dbClient;
let schemaPromise;

function safeEq(a,b){
  const A=Buffer.from(String(a));
  const B=Buffer.from(String(b));
  return A.length===B.length && crypto.timingSafeEqual(A,B);
}
function fromB64url(v){ return Buffer.from(String(v),'base64url'); }
function verifyPassword(password,user){
  const derived=crypto.scryptSync(String(password),fromB64url(user.salt),64,{N:16384,r:8,p:1});
  return crypto.timingSafeEqual(derived,fromB64url(user.hash));
}

export function credentials(login,password){
  const l=String(login||'').trim();
  const p=String(password||'');

  const envUsers=[
    {login:process.env.MILANA_LOGIN,password:process.env.MILANA_PASSWORD,name:process.env.MILANA_DISPLAY_NAME||'Milana',role:'milana'},
    {login:process.env.STAFF_LOGIN,password:process.env.STAFF_PASSWORD,name:process.env.STAFF_DISPLAY_NAME||'Clinical Ops Staff',role:'staff'}
  ].filter(x=>x.login&&x.password);

  if(envUsers.length){
    const hit=envUsers.find(x=>safeEq(l,x.login)&&safeEq(p,x.password));
    return hit?{login:hit.login,name:hit.name,role:hit.role}:null;
  }

  const hit=BUILTIN_USERS.find(x=>safeEq(l,x.login)&&verifyPassword(p,x));
  return hit?{login:hit.login,name:hit.name,role:hit.role}:null;
}

export function authenticate(req){
  try{
    const header=String(req.headers?.authorization||'');
    if(!header.startsWith('Basic ')) return null;
    const raw=Buffer.from(header.slice(6),'base64').toString('utf8');
    const i=raw.indexOf(':');
    if(i<1) return null;
    return credentials(raw.slice(0,i),raw.slice(i+1));
  }catch{return null;}
}

export function dbEnabled(){ return Boolean(process.env.DATABASE_URL); }
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
