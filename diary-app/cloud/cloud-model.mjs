function text(value,label,max,required=false){
  if(typeof value!=='string'||value.length>max||(required&&!value.trim()))throw Error(`${label}을 확인해 주세요. (최대 ${max.toLocaleString()}자)`);
  return value;
}
function base(value){
  if(!value||typeof value!=='object'||Array.isArray(value))throw Error('기록 형식이 올바르지 않습니다.');
  const date=value.date;
  if(typeof date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date))||new Date(date).toISOString().slice(0,10)!==date)throw Error('올바른 날짜를 선택해 주세요.');
  return {date,title:text(value.title,'제목',120).trim(),content:text(value.content,'본문',100000,true)};
}
export function normalizeEntry(value){
  const data=base(value);if(!['great','good','okay','low','sad'].includes(value.mood)||typeof value.starred!=='boolean')throw Error('기분과 즐겨찾기를 확인해 주세요.');
  return {...data,title:data.title||'제목 없는 하루',mood:value.mood,starred:value.starred};
}
export function normalizeStudentRecord(value){
  const data=base(value);
  if(!['observation','counseling','learning','school-life'].includes(value.category))throw Error('기록 분류를 확인해 주세요.');
  if(value.roster_id!==null&&value.roster_id!==undefined&&(typeof value.roster_id!=='string'||value.roster_id.length>128))throw Error('명렬표 학생을 다시 선택해 주세요.');
  return {...data,title:data.title||'제목 없는 기록',student_name:text(value.student_name,'학생 이름',80,true).trim(),classroom:text(value.classroom,'학년·반',80).trim(),student_number:text(value.student_number,'번호',20).trim(),category:value.category,follow_up:text(value.follow_up,'후속 계획',10000),roster_id:value.roster_id||null};
}
