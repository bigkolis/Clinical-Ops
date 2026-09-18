import { dbEnabled, sessionSecurityMode } from '../lib/core.js';
export default function handler(req,res){
  if(req.method!=='GET')return res.status(405).json({error:'Method not allowed'});
  return res.status(200).json({
    ok:true,
    service:'clinical-ops-workspace',
    version:'1.0.0',
    authentication:'http-only-cookie-session',
    sessionSecurity:sessionSecurityMode(),
    databaseConfigured:dbEnabled(),
    sharedPersistence:dbEnabled(),
    timestamp:new Date().toISOString()
  });
}
