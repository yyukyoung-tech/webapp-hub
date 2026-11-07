import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createStore} from '../store.mjs';

test('roster is independent of records, idempotent, preserves records and canonicalizes identity',()=>{
  const store=createStore(':memory:');
  try{
    const students=[{grade:1,class_no:2,student_number:'10',student_name:'동명이인'},{grade:1,class_no:1,student_number:'2',student_name:'동명이인'},{grade:1,class_no:1,student_number:'1',student_name:'다른학생'}];
    assert.equal(store.roster.import(students,'test.xlsx').inserted,3);
    let roster=store.roster.list();assert.equal(roster.length,3);assert.equal(roster[0].student_number,'1');assert.equal(roster[0].classroom,'1학년 1반');
    assert.equal(store.students.list().length,0);
    const ids=roster.map(s=>s.id);assert.equal(store.roster.import(students,'test.xlsx').inserted,0);assert.deepEqual(store.roster.list().map(s=>s.id),ids);
    const person=roster[1];
    const saved=store.students.save({student_name:'잘못입력',classroom:'',student_number:'',date:'2026-11-07',category:'observation',title:'관찰',content:'사실에 기반한 관찰',follow_up:'',roster_id:person.id});
    assert.equal(saved.student_name,person.student_name);assert.equal(saved.classroom,person.classroom);assert.equal(saved.student_number,person.student_number);assert.equal(saved.roster_id,person.id);
    assert.equal(store.roster.list().find(s=>s.id===person.id).record_count,1);
    assert.equal(store.roster.list().filter(s=>s.record_count===0).length,2);
    assert.throws(()=>store.students.save({...saved,roster_id:'missing'}),/명렬표/);
    assert.throws(()=>store.roster.import([...students,{...students[0],student_name:'충돌'}],'test.xlsx'),/중복/);
    assert.equal(store.roster.list().length,3);assert.equal(store.students.list().length,1);
    const legacy=store.students.save({student_name:'다른학생',classroom:'1-1',student_number:'01',date:'2026-11-07',category:'learning',title:'기존 기록',content:'명렬표 가져오기 전 기록',follow_up:''});
    const result=store.roster.import(students,'test.xlsx');assert.equal(result.linked,1);
    const linked=store.students.list().find(r=>r.id===legacy.id);assert.equal(linked.classroom,'1학년 1반');assert.equal(linked.student_number,'1');assert.equal(linked.version,1);assert.ok(linked.roster_id);
  }finally{store.close();}
});
