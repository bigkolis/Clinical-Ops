import { authenticate, actorName, db, dbEnabled, ensureSchema, sameOriginWrite } from '../lib/core.js';
const allowedStudies=new Set(['CL04041383','CL04041109']);
const cleanStudy=v=>allowedStudies.has(String(v||''))?String(v):'CL04041383';
export default async function handler(req,res){
  const user=authenticate(req);if(!user)return res.status(401).json({error:'Unauthorized'});
  const study=cleanStudy(req.query?.study||req.body?.study),site=String(req.query?.site||req.body?.site||'');
  if(!dbEnabled())return res.status(200).json({enabled:false,annotations:[],audit:[],history:[]});
  await ensureSchema();const sql=db(),actor=actorName(req,user);
  if(req.method==='GET'){
    if(req.query?.history==='1'){
      const patient=String(req.query?.patient||''),visit=Number(req.query?.visit);
      if(!site||!patient||!Number.isInteger(visit))return res.status(400).json({error:'site, patient and visit are required'});
      const history=await sql`SELECT id,payload,actor,created_at FROM clinical_ops_annotation_history WHERE study_code=${study} AND site_id=${site} AND patient_id=${patient} AND visit_no=${visit} ORDER BY created_at DESC LIMIT 25`;
      return res.status(200).json({enabled:true,history});
    }
    const annotations=site?await sql`SELECT site_id,patient_id,visit_no,note_text,override_date,override_regimen,deviation_reason,deviation_no,deviation_status,deviation_owner,updated_by,updated_role,updated_at FROM clinical_ops_annotations WHERE study_code=${study} AND site_id=${site} ORDER BY patient_id,visit_no`:[];
    const audit=user.role==='milana'?await sql`SELECT actor,actor_role,action,detail,created_at FROM clinical_ops_audit WHERE study_code=${study} ORDER BY created_at DESC LIMIT 150`:[];
    return res.status(200).json({enabled:true,annotations,audit});
  }
  if(req.method==='POST'){
    if(!sameOriginWrite(req))return res.status(403).json({error:'Cross-site write rejected'});
    const {patient,visit,mode='save'}=req.body||{};const v=Number(visit);
    if(!site||!patient||!Number.isInteger(v))return res.status(400).json({error:'Invalid patient/visit payload'});
    const existing=await sql`SELECT note_text,override_date,override_regimen,deviation_reason,deviation_no,deviation_status,deviation_owner,updated_by,updated_role,updated_at FROM clinical_ops_annotations WHERE study_code=${study} AND site_id=${site} AND patient_id=${String(patient)} AND visit_no=${v}`;
    if(mode==='undo'){
      const previous=await sql`SELECT id,payload FROM clinical_ops_annotation_history WHERE study_code=${study} AND site_id=${site} AND patient_id=${String(patient)} AND visit_no=${v} ORDER BY created_at DESC LIMIT 1`;
      if(!previous.length)return res.status(409).json({error:'No previous version available'});
      const p=previous[0].payload||{};
      await sql`INSERT INTO clinical_ops_annotations(study_code,site_id,patient_id,visit_no,note_text,override_date,override_regimen,deviation_reason,deviation_no,deviation_status,deviation_owner,updated_by,updated_role,updated_at) VALUES(${study},${site},${String(patient)},${v},${p.note_text||null},${p.override_date||null},${p.override_regimen||null},${p.deviation_reason||null},${p.deviation_no||null},${p.deviation_status||null},${p.deviation_owner||null},${actor},${user.role},NOW()) ON CONFLICT(study_code,site_id,patient_id,visit_no) DO UPDATE SET note_text=EXCLUDED.note_text,override_date=EXCLUDED.override_date,override_regimen=EXCLUDED.override_regimen,deviation_reason=EXCLUDED.deviation_reason,deviation_no=EXCLUDED.deviation_no,deviation_status=EXCLUDED.deviation_status,deviation_owner=EXCLUDED.deviation_owner,updated_by=EXCLUDED.updated_by,updated_role=EXCLUDED.updated_role,updated_at=NOW()`;
      await sql`DELETE FROM clinical_ops_annotation_history WHERE id=${previous[0].id}`;
      await sql`INSERT INTO clinical_ops_audit(study_code,site_id,actor,actor_role,action,detail) VALUES(${study},${site},${actor},${user.role},'Undo working change',${`${patient} · Visit ${v}`})`;
      return res.status(200).json({ok:true,restored:p});
    }
    if(existing.length){await sql`INSERT INTO clinical_ops_annotation_history(study_code,site_id,patient_id,visit_no,payload,actor) VALUES(${study},${site},${String(patient)},${v},${sql.json(existing[0])},${actor})`;}
    const {note,overrideDate,overrideRegimen,deviationReason,deviationNo,deviationStatus,deviationOwner,action='Saved visit working data'}=req.body||{};
    await sql`INSERT INTO clinical_ops_annotations(study_code,site_id,patient_id,visit_no,note_text,override_date,override_regimen,deviation_reason,deviation_no,deviation_status,deviation_owner,updated_by,updated_role,updated_at) VALUES(${study},${site},${String(patient)},${v},${typeof note==='string'?note:null},${overrideDate||null},${overrideRegimen||null},${deviationReason||null},${deviationNo||null},${deviationStatus||null},${deviationOwner||null},${actor},${user.role},NOW()) ON CONFLICT(study_code,site_id,patient_id,visit_no) DO UPDATE SET note_text=EXCLUDED.note_text,override_date=EXCLUDED.override_date,override_regimen=EXCLUDED.override_regimen,deviation_reason=EXCLUDED.deviation_reason,deviation_no=EXCLUDED.deviation_no,deviation_status=EXCLUDED.deviation_status,deviation_owner=EXCLUDED.deviation_owner,updated_by=EXCLUDED.updated_by,updated_role=EXCLUDED.updated_role,updated_at=NOW()`;
    await sql`INSERT INTO clinical_ops_audit(study_code,site_id,actor,actor_role,action,detail) VALUES(${study},${site},${actor},${user.role},${String(action)},${`${patient} · Visit ${v}`})`;
    return res.status(200).json({ok:true});
  }
  return res.status(405).json({error:'Method not allowed'});
}
