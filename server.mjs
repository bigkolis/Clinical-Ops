import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import authHandler from './api/auth.js';
import workspaceHandler from './api/workspace.js';
import healthHandler from './api/health.js';

const PORT=Number(process.env.PORT||3000);
const ROOT=join(process.cwd(),'dist');
const handlers=new Map([
  ['/api/auth',authHandler],
  ['/api/workspace',workspaceHandler],
  ['/api/health',healthHandler]
]);
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.ico':'image/x-icon','.woff2':'font/woff2'};

function security(res){
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('Referrer-Policy','no-referrer');
  res.setHeader('Permissions-Policy','camera=(), microphone=(), geolocation=()');
  res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'");
}
function adapter(res){
  res.status=(code)=>{res.statusCode=code;return res;};
  res.json=(value)=>{if(!res.headersSent)res.setHeader('Content-Type','application/json; charset=utf-8');res.end(JSON.stringify(value));};
  return res;
}
async function body(req){
  if(req.method==='GET'||req.method==='HEAD') return {};
  let raw='';
  for await(const chunk of req){raw+=chunk;if(raw.length>1_000_000)throw new Error('Request body too large');}
  if(!raw)return {};
  try{return JSON.parse(raw);}catch{return {};}
}
async function serveStatic(url,res){
  let pathname=decodeURIComponent(url.pathname);
  if(pathname==='/'||!extname(pathname)) pathname='/index.html';
  const safe=normalize(pathname).replace(/^(\.\.(\/|\\|$))+/, '');
  let file=join(ROOT,safe);
  if(!file.startsWith(ROOT)) file=join(ROOT,'index.html');
  try{const s=await stat(file);if(!s.isFile())throw new Error();}
  catch{file=join(ROOT,'index.html');}
  const data=await readFile(file);
  res.statusCode=200;
  res.setHeader('Content-Type',types[extname(file)]||'application/octet-stream');
  res.end(data);
}

const server=http.createServer(async(req,res)=>{
  security(res);adapter(res);
  try{
    const url=new URL(req.url||'/',`http://${req.headers.host||'localhost'}`);
    const handler=handlers.get(url.pathname);
    if(handler){
      req.query=Object.fromEntries(url.searchParams.entries());
      req.body=await body(req);
      return await handler(req,res);
    }
    return await serveStatic(url,res);
  }catch(err){
    console.error(err);
    if(!res.headersSent)res.status(500).json({error:'Internal server error'});else res.end();
  }
});
server.listen(PORT,'0.0.0.0',()=>console.log(`Clinical Ops listening on :${PORT}`));
