import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createApp} from '../server.mjs';

test('student records: CRUD, separate diary data, validation, conflicts, export and persistence',async()=>{
  const directory=mkdtempSync(join(tmpdir(),'student-records-'));
  let app,base;
  const start=async()=>{app=createApp({dbPath:join(directory,'test.sqlite')});await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));base=`http://127.0.0.1:${app.server.address().port}`;};
  const stop=async()=>{await new Promise(resolve=>app.server.close(resolve));app.store.close();};
  const call=(path,method='GET',data)=>fetch(base+path,{method,headers:{'Content-Type':'application/json'},body:data===undefined?undefined:JSON.stringify(data)});
  try{
    await start();
    assert.deepEqual(await (await call('/api/student-records')).json(),[]);
    assert.deepEqual(await (await call('/api/roster')).json(),[]);
    const record={student_name:'테스트 학생 <가>',classroom:'3학년 2반',student_number:'7',date:'2026-11-07',category:'observation',title:'수업 참여',content:'모둠 활동에서 친구의 설명을 듣고 의견을 덧붙임.\n발표에 참여함.',follow_up:'다음 활동에서 역할 선택 기회 제공'};
    const response=await call('/api/student-records','POST',record);assert.equal(response.status,201);
    let saved=await response.json();assert.equal(saved.student_name,record.student_name);assert.equal(saved.version,1);
    assert.equal((await (await call('/api/student-records')).json()).length,1);
    assert.deepEqual(await (await call('/api/entries')).json(),[]);
    for(const bad of [null,{...record,student_name:' '},{...record,date:'2026-02-30'},{...record,category:'bad'},{...record,content:''},{...record,follow_up:7},{...record,student_name:'x'.repeat(81)}])assert.equal((await call('/api/student-records','POST',bad)).status,400);
    const updated=await call('/api/student-records/'+saved.id,'PUT',{...saved,category:'counseling',content:'상담 기록 수정'});assert.equal(updated.status,200);saved=await updated.json();assert.equal(saved.version,2);
    assert.equal((await call('/api/student-records/'+saved.id,'PUT',{...saved,version:1})).status,409);
    assert.equal((await call('/api/student-records/'+saved.id+'?version=1','DELETE')).status,409);
    assert.equal((await (await call('/api/student-export')).json()).records[0].follow_up,record.follow_up);
    assert.equal((await (await call('/api/export')).json()).student_records.length,1);
    await stop();await start();
    assert.equal((await (await call('/api/student-records')).json())[0].content,'상담 기록 수정');
    assert.equal((await call('/api/student-records/'+saved.id+'?version=2','DELETE')).status,200);
    assert.deepEqual(await (await call('/api/student-records')).json(),[]);
    assert.equal((await call('/api/student-records/'+saved.id+'?version=2','DELETE')).status,404);
    assert.equal((await call('/students')).status,200);
  }finally{if(app?.server.listening)await stop();rmSync(directory,{recursive:true,force:true});}
});
