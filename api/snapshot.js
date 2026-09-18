import { authenticate, actorName, db, dbEnabled, ensureSchema } from '../lib/core.js';
const allowedStudies=new Set(['CL04041383','CL04041109']);
const cleanStudy=v=>allowedStudies.has(String(v||''))?String(v):'CL04041383';
export default async function handler(req,res){
  const user=authenticate(req);if(!user)return res.status(401).json({error:'Unauthorized'});
  const study=cleanStudy(req.query?.study||req.body?.study);
  if(!dbEnabled())return res.status(200).json({enabled:false,snapshot:null,history:[]});
  await ensureSchema();const sql=db();
  if(req.method==='GET'){
    const rows=await sql`SELECT id,snapshot,actor,actor_role,created_at FROM clinical_ops_snapshots WHERE study_code=${study} ORDER BY created_at DESC LIMIT 10`;
    return res.status(200).json({enabled:true,snapshot:rows[0]||null,history:rows.map(({id,actor,actor_role,created_at})=>({id,actor,actor_role,created_at}))});
  }
  if(req.method==='POST'){
    const snapshot=req.body?.snapshot;
    if(!snapshot||typeof snapshot!=='object')return res.status(400).json({error:'Snapshot payload required'});
    const safe={version:1,study,selectRows:Array.isArray(snapshot.selectRows)?snapshot.selectRows.slice(0,10000):[],visitRows:Array.isArray(snapshot.visitRows)?snapshot.visitRows.slice(0,20000):[],sources:snapshot.sources&&typeof snapshot.sources==='object'?snapshot.sources:{},publishedAt:new Date().toISOString()};
    const actor=actorName(req,user);
    const [row]=await sql`INSERT INTO clinical_ops_snapshots(study_code,snapshot,actor,actor_role) VALUES(${study},${sql.json(safe)},${actor},${user.role}) RETURNING id,created_at`;
    await sql`INSERT INTO clinical_ops_audit(study_code,site_id,actor,actor_role,action,detail) VALUES(${study},NULL,${actor},${user.role},'Published shared workspace snapshot',${`${safe.selectRows.length} SelectControls rows · ${safe.visitRows.length} visit rows`})`;
    return res.status(200).json({ok:true,id:row.id,created_at:row.created_at});
  }
  return res.status(405).json({error:'Method not allowed'});
}
