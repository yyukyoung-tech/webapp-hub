import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {request} from 'node:http';
import {createApp} from '../server.mjs';

test('local diary HTTP lifecycle, validation, persistence and access boundaries', async () => {
  const dir=mkdtempSync(join(tmpdir(),'diary-test-'));
  let app;
  const start=async()=>{app=createApp({dbPath:join(dir,'test.sqlite')});await new Promise(r=>app.server.listen(0,'127.0.0.1',r));return `http://127.0.0.1:${app.server.address().port}`;};
  const stop=async()=>{await new Promise(r=>app.server.close(r));app.store.close();};
  try {
    let base=await start();
    const background=await fetch(base+'/spring-background.png');
    assert.equal(background.status,200);
    assert.equal(background.headers.get('content-type'),'image/png');
    assert.deepEqual([...new Uint8Array(await background.arrayBuffer()).slice(0,8)],[137,80,78,71,13,10,26,10]);
    const call=(path,method='GET',body,extra={})=>fetch(base+path,{method,headers:{'Content-Type':'application/json',...extra},body:body===undefined?undefined:JSON.stringify(body)});
    assert.deepEqual(await (await call('/api/entries')).json(),[]);
    const entry={date:'2026-11-07',title:'가을 <script>',content:'나의 하루\n작은 행복',mood:'good',starred:true};
    let res=await call('/api/entries','POST',entry);assert.equal(res.status,201);
    let saved=await res.json();assert.ok(saved.id);assert.equal(saved.version,1);
    assert.equal((await (await call('/api/entries')).json())[0].content,entry.content);
    assert.equal((await call('/api/entries','POST',{...entry,date:'2026-02-30'})).status,400);
    assert.equal((await call('/api/entries','POST',{...entry,content:'  '})).status,400);
    assert.equal((await call('/api/entries','POST',{...entry,mood:'bogus'})).status,400);
    assert.equal((await call('/api/entries','POST',null)).status,400);
    assert.equal((await call('/api/entries','POST',{...entry,title:'x'.repeat(121)})).status,400);
    assert.equal((await call('/api/entries','POST',entry,{Origin:'https://foreign.example'})).status,403);
    assert.equal((await call('/api/entries','POST',entry,{'Content-Type':'text/plain'})).status,415);
    const foreignHostStatus=await new Promise((resolve,reject)=>{const req=request(base+'/api/entries',{headers:{Host:'foreign.example'}},res=>{res.resume();resolve(res.statusCode);});req.on('error',reject);req.end();});
    assert.equal(foreignHostStatus,403);
    assert.equal((await call('/data/diary.sqlite')).status,404);
    assert.equal((await call('/server.mjs')).status,404);
    res=await call(`/api/entries/${saved.id}`,'PUT',{...saved,title:'수정한 일기'});assert.equal(res.status,200);saved=await res.json();assert.equal(saved.version,2);
    assert.equal((await call(`/api/entries/${saved.id}`,'PUT',{...saved,version:1})).status,409);
    assert.equal((await call(`/api/entries/${saved.id}?version=1`,'DELETE')).status,409);
    const backup=await (await call('/api/export')).json();assert.equal(backup.entries[0].title,'수정한 일기');
    await stop();base=await start();
    assert.equal((await (await call('/api/entries')).json())[0].title,'수정한 일기');
    assert.equal((await call(`/api/entries/${saved.id}?version=2`,'DELETE')).status,200);
    assert.deepEqual(await (await call('/api/entries')).json(),[]);
    assert.equal((await call(`/api/entries/${saved.id}`,'PUT',saved)).status,404);
  } finally {if(app?.server.listening)await stop();rmSync(dir,{recursive:true,force:true});}
});
