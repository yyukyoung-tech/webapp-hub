import {DatabaseSync} from 'node:sqlite';
import {mkdirSync} from 'node:fs';
import {dirname} from 'node:path';
import {randomUUID} from 'node:crypto';
import {AppError} from './app-error.mjs';
import {createRoster} from './roster.mjs';

export {AppError};
function validate(value){
  if(!value||typeof value!=='object'||Array.isArray(value))throw new AppError(400,'일기 형식을 확인해 주세요.');
  const {date,title,content,mood,starred}=value;
  if(typeof date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date))||new Date(date).toISOString().slice(0,10)!==date)throw new AppError(400,'올바른 날짜를 선택해 주세요.');
  if(typeof title!=='string'||title.length>120)throw new AppError(400,'제목은 120자 이내로 적어 주세요.');
  if(typeof content!=='string'||!content.trim()||content.length>100000)throw new AppError(400,'본문은 1자 이상 100,000자 이내로 적어 주세요.');
  if(!['great','good','okay','low','sad'].includes(mood)||typeof starred!=='boolean')throw new AppError(400,'기분과 즐겨찾기 값을 확인해 주세요.');
  return {date,title:title.trim()||'제목 없는 하루',content,mood,starred:Number(starred)};
}
const entry=row=>row?{...row,starred:Boolean(row.starred)}:null;
function createStudentRecords(db){
  db.exec(`CREATE TABLE IF NOT EXISTS student_records (
    id TEXT PRIMARY KEY,student_name TEXT NOT NULL,classroom TEXT NOT NULL,student_number TEXT NOT NULL,
    date TEXT NOT NULL,category TEXT NOT NULL,title TEXT NOT NULL,content TEXT NOT NULL,follow_up TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 1,created_at TEXT NOT NULL,updated_at TEXT NOT NULL
  ); CREATE INDEX IF NOT EXISTS student_records_date ON student_records(date DESC);`);
  if(!db.prepare('PRAGMA table_info(student_records)').all().some(c=>c.name==='roster_id'))db.exec('ALTER TABLE student_records ADD COLUMN roster_id TEXT');
  db.exec('CREATE INDEX IF NOT EXISTS student_records_roster ON student_records(roster_id)');
  const canonical=row=>{
    if(!row?.roster_id)return row;
    const student=db.prepare('SELECT * FROM roster_students WHERE id=?').get(row.roster_id);
    return student?{...row,student_name:student.student_name,classroom:`${student.grade}학년 ${student.class_no}반`,student_number:student.student_number}:row;
  };
  const get=id=>canonical(db.prepare('SELECT * FROM student_records WHERE id=?').get(id));
  return {
    list:()=>db.prepare('SELECT * FROM student_records ORDER BY date DESC,created_at DESC').all().map(canonical),
    save(value,id){
      if(!value||typeof value!=='object'||Array.isArray(value))throw new AppError(400,'학생 기록 형식을 확인해 주세요.');
      let rosterId=null;
      if(value.roster_id){
        if(typeof value.roster_id!=='string')throw new AppError(400,'명렬표 학생을 다시 선택해 주세요.');
        const student=db.prepare('SELECT * FROM roster_students WHERE id=?').get(value.roster_id);
        if(!student)throw new AppError(400,'명렬표 학생을 찾을 수 없습니다. 다시 선택해 주세요.');
        value={...value,student_name:student.student_name,classroom:`${student.grade}학년 ${student.class_no}반`,student_number:student.student_number};rosterId=student.id;
      }
      const base=validate({...value,mood:'okay',starred:false});
      for(const [key,label,max] of [['student_name','학생 이름',80],['classroom','학년·반',80],['student_number','번호',20],['follow_up','후속 계획',10000]]){
        if(typeof value[key]!=='string'||value[key].length>max)throw new AppError(400,`${label}은 ${max}자 이내로 입력해 주세요.`);
      }
      if(!value.student_name.trim())throw new AppError(400,'학생 이름을 입력해 주세요.');
      if(!['observation','counseling','learning','school-life'].includes(value.category))throw new AppError(400,'기록 분류를 선택해 주세요.');
      const fields=[value.student_name.trim(),value.classroom.trim(),value.student_number.trim(),base.date,value.category,value.title.trim()||'제목 없는 기록',base.content,value.follow_up];
      const now=new Date().toISOString();
      if(id){
        if(!get(id))throw new AppError(404,'학생 기록을 찾을 수 없습니다.');
        if(!Number.isInteger(value.version))throw new AppError(400,'기록 버전이 필요합니다.');
        if(!db.prepare('UPDATE student_records SET student_name=?,classroom=?,student_number=?,date=?,category=?,title=?,content=?,follow_up=?,roster_id=?,updated_at=?,version=version+1 WHERE id=? AND version=?').run(...fields,rosterId,now,id,value.version).changes)throw new AppError(409,'다른 창에서 수정된 기록입니다. 내용을 복사한 뒤 새로고침해 주세요.');
      }else{
        id=randomUUID();db.prepare('INSERT INTO student_records(id,student_name,classroom,student_number,date,category,title,content,follow_up,roster_id,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)').run(id,...fields,rosterId,now,now);
      }
      return get(id);
    },
    remove(id,version){
      if(!get(id))throw new AppError(404,'이미 삭제된 학생 기록입니다.');
      if(!Number.isInteger(version)||version<1)throw new AppError(400,'기록 버전이 필요합니다.');
      if(!db.prepare('DELETE FROM student_records WHERE id=? AND version=?').run(id,version).changes)throw new AppError(409,'다른 창에서 수정되었습니다. 새로고침 후 삭제해 주세요.');
    }
  };
}
export function createStore(path){
  mkdirSync(dirname(path),{recursive:true});
  const db=new DatabaseSync(path);
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
    CREATE TABLE IF NOT EXISTS entries (
      id TEXT PRIMARY KEY,date TEXT NOT NULL,title TEXT NOT NULL,content TEXT NOT NULL,
      mood TEXT NOT NULL,starred INTEGER NOT NULL DEFAULT 0,version INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,updated_at TEXT NOT NULL
    ); CREATE INDEX IF NOT EXISTS entries_date ON entries(date DESC);`);
  const get=id=>entry(db.prepare('SELECT * FROM entries WHERE id=?').get(id));
  const students=createStudentRecords(db),roster=createRoster(db);
  return {
    students,roster,
    list:()=>db.prepare('SELECT * FROM entries ORDER BY date DESC,created_at DESC').all().map(entry),
    save(value,id){
      const data=validate(value),now=new Date().toISOString();
      if(id){
        if(!get(id))throw new AppError(404,'일기를 찾을 수 없습니다.');
        if(!Number.isInteger(value.version))throw new AppError(400,'일기 버전이 필요합니다.');
        const result=db.prepare('UPDATE entries SET date=?,title=?,content=?,mood=?,starred=?,updated_at=?,version=version+1 WHERE id=? AND version=?').run(data.date,data.title,data.content,data.mood,data.starred,now,id,value.version);
        if(!result.changes)throw new AppError(409,'다른 창에서 수정된 일기입니다. 현재 내용을 복사한 뒤 새로고침해 주세요.');
      }else{
        id=randomUUID();db.prepare('INSERT INTO entries(id,date,title,content,mood,starred,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?)').run(id,data.date,data.title,data.content,data.mood,data.starred,now,now);
      }
      return get(id);
    },
    remove(id,version){
      if(!get(id))throw new AppError(404,'이미 삭제된 일기입니다.');
      if(!Number.isInteger(version)||version<1)throw new AppError(400,'일기 버전이 필요합니다.');
      if(!db.prepare('DELETE FROM entries WHERE id=? AND version=?').run(id,version).changes)throw new AppError(409,'다른 창에서 수정되었습니다. 새로고침 후 삭제해 주세요.');
    },
    close:()=>db.close()
  };
}
