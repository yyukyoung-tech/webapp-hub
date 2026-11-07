import {before,after,test} from 'node:test';
import {readFileSync} from 'node:fs';
import {initializeTestEnvironment,assertFails,assertSucceeds} from '@firebase/rules-unit-testing';
import {doc,setDoc,getDoc,getDocs,collection,updateDoc,deleteDoc,serverTimestamp,Timestamp} from 'firebase/firestore';
let env;
before(async()=>{env=await initializeTestEnvironment({projectId:'demo-webapp-hub',firestore:{host:'127.0.0.1',port:8080,rules:readFileSync(new URL('../firestore.rules',import.meta.url),'utf8')}});});
after(async()=>env?.cleanup());
const owner=()=>env.authenticatedContext('alice',{email_verified:true,firebase:{sign_in_provider:'google.com'}}).firestore();
const record=()=>({date:'2026-11-07',title:'기록',content:'소중한 순간',mood:'okay',starred:false,version:1,created_at:serverTimestamp(),updated_at:serverTimestamp()});
test('unauthenticated and other users cannot read, list, create, update or delete private records',async()=>{
  const db=owner();await assertSucceeds(setDoc(doc(db,'users/alice/entries/private'),record()));
  for(const unauthorized of [env.unauthenticatedContext().firestore(),env.authenticatedContext('bob',{email_verified:true,firebase:{sign_in_provider:'google.com'}}).firestore()]){
    await assertFails(getDoc(doc(unauthorized,'users/alice/entries/private')));
    await assertFails(getDocs(collection(unauthorized,'users/alice/entries')));
    await assertFails(setDoc(doc(unauthorized,'users/alice/entries/injected'),record()));
    await assertFails(updateDoc(doc(unauthorized,'users/alice/entries/private'),{title:'변조'}));
    await assertFails(deleteDoc(doc(unauthorized,'users/alice/entries/private')));
  }
});
test('valid owner CRUD works; forged fields, metadata, versions and missing fields fail',async()=>{
  const db=owner(),ref=doc(db,'users/alice/entries/versions');
  await assertSucceeds(setDoc(ref,record()));await assertSucceeds(getDocs(collection(db,'users/alice/entries')));
  await assertFails(updateDoc(ref,{version:7,updated_at:serverTimestamp()}));
  await assertFails(updateDoc(ref,{version:2,uid:'bob',updated_at:serverTimestamp()}));
  await assertFails(updateDoc(ref,{version:2,created_at:Timestamp.fromMillis(0),updated_at:serverTimestamp()}));
  await assertFails(setDoc(doc(db,'users/alice/entries/invalid'),{...record(),content:''}));
  const missing=record();delete missing.content;await assertFails(setDoc(doc(db,'users/alice/entries/missing'),missing));
  await assertFails(setDoc(doc(db,'users/alice/entries/oversize'),{...record(),title:'x'.repeat(121)}));
  await assertFails(setDoc(doc(db,'users/alice/entries/privilege'),{...record(),admin:true}));
  await assertSucceeds(updateDoc(ref,{title:'수정',version:2,updated_at:serverTimestamp()}));await assertSucceeds(deleteDoc(ref));
});
test('unverified and non-Google accounts are rejected; other collections default to deny',async()=>{
  for(const claims of [{email_verified:false,firebase:{sign_in_provider:'google.com'}},{email_verified:true,firebase:{sign_in_provider:'password'}}])await assertFails(setDoc(doc(env.authenticatedContext('alice',claims).firestore(),'users/alice/entries/not-google'),record()));
  await assertFails(setDoc(doc(owner(),'users/alice/admin/escalate'),{role:'admin'}));
});
test('student data and roster are private and validated; cross-owner roster links are rejected',async()=>{
  const db=owner();
  const student={grade:1,class_no:1,student_number:'1',student_name:'테스트 학생',classroom:'1학년 1반',version:1,created_at:serverTimestamp(),updated_at:serverTimestamp()};
  await assertSucceeds(setDoc(doc(db,'users/alice/roster/student'),student));
  const observation={date:'2026-11-07',title:'관찰',content:'직접 관찰한 사실',student_name:student.student_name,classroom:student.classroom,student_number:'1',category:'observation',follow_up:'',roster_id:'student',version:1,created_at:serverTimestamp(),updated_at:serverTimestamp()};
  await assertSucceeds(setDoc(doc(db,'users/alice/student_records/valid'),observation));
  await assertFails(setDoc(doc(db,'users/alice/student_records/invalid'),{...observation,student_name:'다른 학생'}));
  const bob=env.authenticatedContext('bob',{email_verified:true,firebase:{sign_in_provider:'google.com'}}).firestore();
  await assertFails(getDocs(collection(bob,'users/alice/roster')));await assertFails(getDoc(doc(bob,'users/alice/student_records/valid')));
  await assertFails(setDoc(doc(bob,'users/bob/student_records/stolen-link'),observation));
});
