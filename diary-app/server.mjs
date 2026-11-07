import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {join,dirname} from 'node:path';
import {spawn} from 'node:child_process';
import {createStore,AppError} from './store.mjs';

const root=dirname(fileURLToPath(import.meta.url));
const assets={'/students':['students.html','text/html; charset=utf-8'],'/students.js':['students.js','text/javascript; charset=utf-8'],'/spring-background.png':['spring-background.png','image/png'],'/':['index.html','text/html; charset=utf-8'],'/app.js':['app.js','text/javascript; charset=utf-8'],'/style.css':['style.css','text/css; charset=utf-8'],'/favicon.svg':['favicon.svg','image/svg+xml']};
export function createApp({dbPath=join(root,'data','diary.sqlite')}={}){
  const store=createStore(dbPath);
  const server=createServer(async(req,res)=>{
    const send=(status,data,headers={})=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",...headers});res.end(typeof data==='string'||Buffer.isBuffer(data)?data:JSON.stringify(data));};
    try{
      const port=server.address()?.port;
      if(![`127.0.0.1:${port}`,`localhost:${port}`].includes(req.headers.host))throw new AppError(403,'로컬 주소로 접속해 주세요.');
      if(req.headers.origin&&!['http://127.0.0.1:'+port,'http://localhost:'+port].includes(req.headers.origin))throw new AppError(403,'허용되지 않은 요청입니다.');
      if(req.headers['sec-fetch-site']==='cross-site')throw new AppError(403,'허용되지 않은 요청입니다.');
      const url=new URL(req.url,'http://127.0.0.1');
      const match=url.pathname.match(/^\/api\/(entries|student-records)\/([a-f0-9-]{36})$/);
      const studentRoute=url.pathname==='/api/student-records'||match?.[1]==='student-records';
      const records=studentRoute?store.students:store;
      if(req.method==='GET'){
        if(url.pathname==='/api/entries')return send(200,store.list());
        if(url.pathname==='/api/student-records')return send(200,store.students.list());
        if(url.pathname==='/api/roster')return send(200,store.roster.list());
        if(url.pathname==='/api/student-export')return send(200,{format:'student-records',version:2,exported_at:new Date().toISOString(),roster:store.roster.list(),records:store.students.list()},{'Content-Disposition':'attachment; filename="student-records.json"'});
        if(url.pathname==='/api/health')return send(200,{status:'ok',storage:'SQLite (local)'});
        if(url.pathname==='/api/export')return send(200,{format:'private-sentences',version:3,exported_at:new Date().toISOString(),entries:store.list(),student_records:store.students.list(),roster:store.roster.list()},{'Content-Disposition':'attachment; filename="diary-backup.json"'});
        if(assets[url.pathname]){const [file,type]=assets[url.pathname];return send(200,await readFile(join(root,'public',file)),{'Content-Type':type});}
      }
      if(req.method==='DELETE'&&match){records.remove(match[2],Number(url.searchParams.get('version')));return send(200,{ok:true});}
      if((req.method==='POST'&&['/api/entries','/api/student-records'].includes(url.pathname))||(req.method==='PUT'&&match)){
        if(req.headers['content-type']?.split(';')[0]!=='application/json')throw new AppError(415,'JSON 형식으로 요청해 주세요.');
        let size=0,chunks=[];
        for await(const chunk of req){size+=chunk.length;if(size>1024*1024)throw new AppError(413,'일기가 너무 깁니다.');chunks.push(chunk);}
        let body;try{body=JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{throw new AppError(400,'일기 형식을 확인해 주세요.');}
        return send(req.method==='POST'?201:200,records.save(body,match?.[2]));
      }
      send(404,{error:'요청한 내용을 찾을 수 없습니다.'});
    }catch(error){if(!(error instanceof AppError))console.error(error);if(!res.headersSent)send(error.status||500,{error:error.status?error.message:'저장 중 문제가 생겼습니다. 잠시 후 다시 시도해 주세요.'});}
  });
  return {server,store};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  const port=Number(process.env.PORT||4317);
  const {server,store}=createApp();
  server.on('error',error=>{console.error(error.code==='EADDRINUSE'?`포트 ${port}가 사용 중입니다. http://127.0.0.1:${port} 를 확인하세요.`:error.message);store.close();process.exitCode=1;});
  server.listen(port,'127.0.0.1',()=>{
    const url=`http://127.0.0.1:${port}`;
    console.log(`사적인 문장 · ${url}\n데이터베이스: ${join(root,'data','diary.sqlite')}\n종료: Ctrl+C`);
    if(process.argv.includes('--open')){
      const command=process.platform==='win32'?'explorer.exe':process.platform==='darwin'?'open':'xdg-open';
      const child=spawn(command,[url],{detached:true,stdio:'ignore'});child.on('error',()=>console.log(`브라우저에서 ${url} 를 열어 주세요.`));child.unref();
    }
  });
  for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>server.close(()=>{store.close();process.exit(0);}));
}

