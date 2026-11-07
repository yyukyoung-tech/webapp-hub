import {execFileSync} from 'node:child_process';
import {readFileSync,existsSync,statSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
const root=fileURLToPath(new URL('../../',import.meta.url));
const files=execFileSync('git',['ls-files','--cached','--others','--exclude-standard','-z'],{cwd:root,encoding:'utf8'}).split('\0').filter(Boolean);
const privatePath=/(?:^|\/)(?:data|node_modules|\.firebase|\.tools)\/|(?:^|\/)\.env(?:\.|$)|\.(?:xlsx?|sqlite(?:-wal|-shm)?|db|csv|log)$|(?:^|\/)preview[^/]*\.png$|service[-_]?account|credentials\.json/i;
const tokens=[/gh[pousr]_[A-Za-z0-9]{20,}/,/github_pat_[A-Za-z0-9_]{30,}/,/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,/"(?:private_key|refresh_token|client_secret)"\s*:\s*"[^"\s]+"/];
const rosterPath=join(root,'diary-app/data/roster-import.json');
const names=existsSync(rosterPath)?JSON.parse(readFileSync(rosterPath,'utf8')).students.map(s=>s.student_name):[];
const problems=[];
for(const file of files){
  if(privatePath.test(file))problems.push({file,reason:'private-path'});
  const path=join(root,file);if(!existsSync(path)||!statSync(path).isFile()||/\.(?:png|jpg|webp|svg)$/i.test(file))continue;
  const content=readFileSync(path,'utf8');
  if(tokens.some(pattern=>pattern.test(content)))problems.push({file,reason:'secret-pattern'});
  if(names.some(name=>name.length>1&&content.includes(name)))problems.push({file,reason:'student-name'});
}
if(problems.length){console.error(JSON.stringify({status:'FAIL',problems},null,2));process.exitCode=1;}
else console.log(JSON.stringify({status:'PASS',reviewed_files:files.length,private_roster_checked:names.length>0,private_files:'excluded',secrets:'no matches',student_names:'no matches'}));
