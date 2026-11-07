import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,readdir,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {normalizeEntry,normalizeStudentRecord} from '../cloud/cloud-model.mjs';
import {buildPages} from '../scripts/build-pages.mjs';

test('cloud schema rejects malformed inputs and strips client metadata',()=>{
  const value={date:'2026-11-07',title:'',content:'일기',mood:'okay',starred:false,admin:true,uid:'other'};
  const entry=normalizeEntry(value);assert.equal(entry.title,'제목 없는 하루');assert.equal('admin' in entry,false);assert.equal('uid' in entry,false);
  for(const change of [{date:'2026-02-30'},{content:' '},{starred:'true'},{mood:'invalid'},{title:'x'.repeat(121)}])assert.throws(()=>normalizeEntry({...value,...change}));
  const student={student_name:'학생',classroom:'1학년 1반',student_number:'1',date:value.date,category:'observation',title:'',content:'관찰',follow_up:'',roster_id:null};
  assert.equal(normalizeStudentRecord(student).title,'제목 없는 기록');assert.throws(()=>normalizeStudentRecord({...student,student_name:''}));assert.throws(()=>normalizeStudentRecord({...student,category:'admin'}));
});
test('Pages package is an explicit static allowlist with relative paths and no private records',async()=>{
  const temporary=await mkdtemp(join(tmpdir(),'hub-pages-')),output=join(temporary,'site'),configPath=join(temporary,'config.json');
  try{
    await writeFile(configPath,JSON.stringify({configured:false}));
    await assert.rejects(buildPages({outputDir:output,configPath}),/Firebase/);
    const files=await buildPages({outputDir:output,configPath,allowUnconfigured:true});
    assert.ok(files.includes('index.html'));assert.ok(files.includes('diary.html'));assert.ok(files.includes('students.html'));
    assert.equal(files.some(f=>/sqlite|xlsx|roster-import|preview|credentials|service.?account/i.test(f)),false);
    for(const file of ['diary.html','students.html']){const html=await readFile(join(output,file),'utf8');assert.doesNotMatch(html,/(?:href|src)="\//);assert.match(html,/Content-Security-Policy/);}
    for(const file of ['app.js','students.js']){const script=await readFile(join(output,file),'utf8');assert.match(script,/cloud-backend/);assert.doesNotMatch(script,/localStorage|async function api\(/);}
    assert.deepEqual((await readdir(output)).sort(),files.sort());
  }finally{await rm(temporary,{recursive:true,force:true});}
});
