import { dbEnabled } from '../lib/core.js';
export default function handler(req,res){
  if(req.method!=='GET') return res.status(405).json({error:'Method not allowed'});
  return res.status(200).json({ok:true,service:'clinical-ops-workspace',version:'0.5.0',databaseConfigured:dbEnabled(),timestamp:new Date().toISOString()});
}
