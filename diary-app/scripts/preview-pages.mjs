import {createServer} from 'node:http';
import {readFile,readdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
const root=fileURLToPath(new URL('../dist/',import.meta.url)),files=new Set(await readdir(root));
const types={html:'text/html',js:'text/javascript',mjs:'text/javascript',css:'text/css',png:'image/png',svg:'image/svg+xml',json:'application/json'};
createServer(async(req,res)=>{
  const pathname=new URL(req.url,'http://localhost').pathname;
  const file=pathname.startsWith('/webapp-hub/')?pathname.slice('/webapp-hub/'.length)||'index.html':null;
  if(!files.has(file)){res.writeHead(404);return res.end();}
  try{res.setHeader('Content-Type',(types[file.split('.').pop()]||'text/plain')+'; charset=utf-8');res.end(await readFile(join(root,file)));}catch{res.writeHead(404);res.end();}
}).listen(4319,'127.0.0.1',()=>console.log('Hub preview http://127.0.0.1:4319/webapp-hub/'));
