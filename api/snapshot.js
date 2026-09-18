import { authenticate, actorName, db, dbEnabled, ensureSchema } from '../lib/core.js';
const allowedStudies=new Set(['CL04041383','CL04041109']);
const cleanStudy=v=>allowedStudies.has(String(v||''))?String(v):'CL04041383';
const siteKeys=['Site #','Site','Site No','Site Number'];
const idKeys=['Randomization #','Screening #','Столбец1'];
const regimenKeys=[];for(const v of [0,2,3,4,5,6,7,8,9,10,11]){regimenKeys.push(`V${v}_DISP_REGIMEN`,`V${v}_DISP_REGIMEN1`);}
const selectKeys=[...siteKeys,...idKeys,'Status',...regimenKeys];
const visitKeys=[...siteKeys,...idKeys,'Activity','Scheduled min','Scheduled max','Actual visit date','Overdue'];
function scalar(v){if(v===null||v===undefined)return null;if(typeof v==='number'||typeof v==='boolean')return v;return String(v).slice(0,500);}
function pickRows(rows,keys,limit){if(!Array.isArray(rows))return[];return rows.slice(0,limit).map(row=>{const out={};for(const k of keys)if(Object.prototype.hasOwnProperty.call(row||{},k))out[k]=scalar(row[k]);return out;});}
function safeSources(value){const v=value&&typeof value==='object'?value:{};return {select:String(v.select||'').slice(0,220),visits:String(v.visits||'').slice(0,220)};}

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
    const safe={
      version:2,
      study,
      selectRows:pickRows(snapshot.selectRows,selectKeys,10000),
      visitRows:pickRows(snapshot.visitRows,visitKeys,20000),
      sources:safeSources(snapshot.sources),
      publishedAt:new Date().toISOString()
    };
    const actor=actorName(req,user);
    const [row]=await sql`INSERT INTO clinical_ops_snapshots(study_code,snapshot,actor,actor_role) VALUES(${study},${sql.json(safe)},${actor},${user.role}) RETURNING id,created_at`;
    await sql`INSERT INTO clinical_ops_audit(study_code,site_id,actor,actor_role,action,detail) VALUES(${study},NULL,${actor},${user.role},'Published shared workspace snapshot',${`${safe.selectRows.length} SelectControls rows · ${safe.visitRows.length} visit rows · minimized columns`})`;
    return res.status(200).json({ok:true,id:row.id,created_at:row.created_at,minimized:true});
  }
  return res.status(405).json({error:'Method not allowed'});
}
