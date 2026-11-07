import {readFile,writeFile,mkdir,readdir} from 'node:fs/promises';
import {dirname,join} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const csp="default-src 'self'; script-src 'self' https://www.gstatic.com; style-src 'self'; img-src 'self' data:; connect-src 'self' https://*.googleapis.com https://*.firebaseapp.com https://*.firebaseio.com wss://*.firebaseio.com; frame-src https://*.firebaseapp.com https://accounts.google.com; object-src 'none'; base-uri 'none'; form-action 'self'";
const files=['index.html','diary.html','students.html','app.js','students.js','style.css','favicon.svg','spring-background.png','cloud.css','cloud-backend.js','cloud-model.mjs','firebase-config.public.json','.nojekyll'];
export async function buildPages({outputDir=join(root,'dist'),configPath=join(root,'cloud','firebase-config.public.json'),allowUnconfigured=false}={}){
  const config=JSON.parse(await readFile(configPath,'utf8'));
  if(!allowUnconfigured&&(!config.configured||!['apiKey','authDomain','projectId','appId'].every(k=>typeof config[k]==='string'&&config[k])))throw Error('Firebase 프로젝트 설정을 완료한 뒤 빌드해 주세요.');
  const allowedConfig=Object.fromEntries(['configured','apiKey','authDomain','projectId','appId'].map(k=>[k,config[k]]));
  await mkdir(outputDir,{recursive:true});
  const existing=await readdir(outputDir);if(existing.some(f=>!files.includes(f)))throw Error('배포 폴더에 허용되지 않은 파일이 있습니다. 검토 후 별도 빈 폴더를 사용해 주세요.');
  const html=content=>content.replace('<head>',`<head><meta http-equiv="Content-Security-Policy" content="${csp}"><meta name="referrer" content="strict-origin-when-cross-origin">`).replace('</head>','<link rel="stylesheet" href="./cloud.css"></head>');
  for(const file of files){
    let content;
    if(file==='.nojekyll')content='';
    else if(file==='firebase-config.public.json')content=JSON.stringify(allowedConfig,null,2)+'\n';
    else if(file==='index.html')content=html(await readFile(join(root,'cloud','hub.html'),'utf8'));
    else if(file==='diary.html'||file==='students.html'){
      const student=file==='students.html';content=await readFile(join(root,'public',student?'students.html':'index.html'),'utf8');
      content=content.replaceAll('href="/students"','href="./students.html"').replaceAll('href="/"',student?'href="./diary.html"':'href="./index.html"').replace('<a class="brand" href="./diary.html"','<a class="brand" href="./index.html"').replaceAll('src="/','src="./').replaceAll('href="/','href="./');
      content=content.replaceAll('이 컴퓨터의 SQLite','본인의 Firebase 계정').replaceAll('이 컴퓨터','본인의 계정').replaceAll('이 브라우저에','현재 세션에');content=html(content);
    }else if(file==='app.js'||file==='students.js'){
      content=await readFile(join(root,'public',file),'utf8');const start=content.indexOf('async function api('),end=content.indexOf(file==='app.js'?'const formValue=':'const value=',start);
      if(start<0||end<0)throw Error('API 연결 위치를 찾을 수 없습니다.');
      content="import {api,draftStorage} from './cloud-backend.js';\n"+content.slice(0,start)+content.slice(end);
      content=content.replaceAll('localStorage','draftStorage').replaceAll('이 컴퓨터에 안전하게 보관 중','본인 계정에 보관 중').replaceAll('이 컴퓨터에 보관 중','본인 계정에 보관 중').replaceAll('이 브라우저에 초안 보관 중','현재 세션에 초안 보관 중').replaceAll('브라우저에 초안 보관 중','현재 세션에 초안 보관 중');
    }else if(['cloud.css','cloud-backend.js','cloud-model.mjs'].includes(file))content=await readFile(join(root,'cloud',file));
    else if(file==='style.css')content=(await readFile(join(root,'public',file),'utf8')).replaceAll('/spring-background.png','./spring-background.png');
    else content=await readFile(join(root,'public',file));
    await writeFile(join(outputDir,file),content);
  }
  return [...files];
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)console.log('Pages files:',(await buildPages({allowUnconfigured:process.argv.includes('--preview')})).length);
