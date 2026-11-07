import {randomUUID} from 'node:crypto';
import {AppError} from './app-error.mjs';

export function createRoster(db){
  db.exec(`CREATE TABLE IF NOT EXISTS roster_students (
    id TEXT PRIMARY KEY,grade INTEGER NOT NULL,class_no INTEGER NOT NULL,student_number TEXT NOT NULL,
    student_name TEXT NOT NULL,source TEXT NOT NULL,created_at TEXT NOT NULL,
    UNIQUE(grade,class_no,student_number)
  );`);
  const canonical=row=>row?{...row,classroom:`${row.grade}학년 ${row.class_no}반`}:null;
  const get=id=>canonical(db.prepare('SELECT * FROM roster_students WHERE id=?').get(id));
  return {
    get,
    list:()=>db.prepare(`SELECT s.*,COUNT(r.id) AS record_count FROM roster_students s
      LEFT JOIN student_records r ON r.roster_id=s.id GROUP BY s.id
      ORDER BY s.grade,s.class_no,CAST(s.student_number AS INTEGER),s.student_name`).all().map(canonical),
    import(students,source){
      if(!Array.isArray(students)||!students.length||typeof source!=='string')throw new AppError(400,'명렬표 형식을 확인해 주세요.');
      const seen=new Set();
      for(const s of students){
        if(!Number.isInteger(s.grade)||s.grade<1||s.grade>12||!Number.isInteger(s.class_no)||s.class_no<1||s.class_no>100||!/^\d{1,4}$/.test(s.student_number)||Number(s.student_number)<1||typeof s.student_name!=='string'||!s.student_name.trim()||s.student_name.length>80)throw new AppError(400,'명렬표 학생 정보가 올바르지 않습니다.');
        const key=JSON.stringify([s.grade,s.class_no,String(Number(s.student_number))]);if(seen.has(key))throw new AppError(400,'명렬표에 학년·반·번호가 중복됩니다.');seen.add(key);
      }
      let inserted=0,linked=0;db.exec('BEGIN IMMEDIATE');
      try{
        for(const s of students){
          const number=String(Number(s.student_number)),name=s.student_name.trim();
          const existing=db.prepare('SELECT * FROM roster_students WHERE grade=? AND class_no=? AND student_number=?').get(s.grade,s.class_no,number);
          if(existing&&existing.student_name!==name)throw new AppError(409,'기존 명렬표와 학생 이름이 다릅니다. 학년·반·번호를 확인해 주세요.');
          if(!existing){db.prepare('INSERT INTO roster_students VALUES(?,?,?,?,?,?,?)').run(randomUUID(),s.grade,s.class_no,number,name,source,new Date().toISOString());inserted++;}
        }
        const roster=this.list();
        for(const r of db.prepare('SELECT id,student_name,classroom,student_number FROM student_records WHERE roster_id IS NULL').all()){
          const match=r.classroom.replaceAll(' ','').match(/^(\d+)(?:학년|-)(\d+)반?$/);
          if(!match)continue;
          const student=roster.find(s=>s.grade===Number(match[1])&&s.class_no===Number(match[2])&&Number(s.student_number)===Number(r.student_number)&&s.student_name===r.student_name.trim());
          if(student){db.prepare('UPDATE student_records SET roster_id=? WHERE id=?').run(student.id,r.id);linked++;}
        }
        db.exec('COMMIT');return {inserted,linked,total:this.list().length};
      }catch(error){db.exec('ROLLBACK');throw error;}
    }
  };
}
