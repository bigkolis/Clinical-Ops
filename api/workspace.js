import { authenticate, db, dbEnabled, ensureSchema } from '../lib/core.js';
const STUDY='CL04041383';
export default async function handler(req,res){
  const user=authenticate(req); if(!user) return res.status(401).json({error:'Unauthorized'});
  if(!dbEnabled()) return res.status(200).json({enabled:false,annotations:[],audit:[]});
  await ensureSchema(); const sql=db(); const site=String(req.query?.site||req.body?.site||'10');
  if(req.method==='GET'){
    const annotations=await sql`SELECT site_id,patient_id,visit_no,note_text,override_date,override_regimen,updated_by,updated_role,updated_at FROM clinical_ops_annotations WHERE study_code=${STUDY} AND site_id=${site} ORDER BY patient_id,visit_no`;
    const audit=user.role==='milana'?await sql`SELECT actor,actor_role,action,detail,created_at FROM clinical_ops_audit WHERE study_code=${STUDY} ORDER BY created_at DESC LIMIT 100`:[];
    return res.status(200).json({enabled:true,annotations,audit});
  }
  if(req.method==='POST'){
    const {patient,visit,note,overrideDate,overrideRegimen,action='Workspace update'}=req.body||{};
    const v=Number(visit); if(!patient||!Number.isInteger(v)) return res.status(400).json({error:'Invalid patient/visit payload'});
    await sql`INSERT INTO clinical_ops_annotations (study_code,site_id,patient_id,visit_no,note_text,override_date,override_regimen,updated_by,updated_role,updated_at)
      VALUES (${STUDY},${site},${String(patient)},${v},${typeof note==='string'?note:null},${overrideDate||null},${overrideRegimen||null},${user.name||user.login},${user.role},NOW())
      ON CONFLICT(study_code,site_id,patient_id,visit_no) DO UPDATE SET note_text=COALESCE(EXCLUDED.note_text,clinical_ops_annotations.note_text),override_date=EXCLUDED.override_date,override_regimen=EXCLUDED.override_regimen,updated_by=EXCLUDED.updated_by,updated_role=EXCLUDED.updated_role,updated_at=NOW()`;
    await sql`INSERT INTO clinical_ops_audit(study_code,site_id,actor,actor_role,action,detail) VALUES(${STUDY},${site},${user.name||user.login},${user.role},${String(action)},${`${patient} · Visit ${v}`})`;
    return res.status(200).json({ok:true});
  }
  return res.status(405).json({error:'Method not allowed'});
}
