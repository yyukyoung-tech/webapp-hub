const $=id=>document.getElementById(id);
const categories={observation:'관찰',counseling:'상담',learning:'학습','school-life':'생활'};
const paths={plus:'M12 5v14M5 12h14',book:'M4 3h13a3 3 0 0 1 3 3v15H7a3 3 0 0 1-3-3V3Zm0 14h16M8 3v14',students:'M9 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8ZM2 21v-3a6 6 0 0 1 12 0v3M17 3a4 4 0 0 1 0 8m2 4a5 5 0 0 1 3 5v1',search:'M10.5 3a7.5 7.5 0 1 0 0 15 7.5 7.5 0 0 0 0-15Zm5.5 13 5 5',calendar:'M4 5h16v16H4V5Zm0 5h16M8 3v4m8-4v4',trash:'M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7',download:'M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5',check:'m5 12 4 4L19 6'};
const icon=name=>`<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="${paths[name]}"/></svg>`;
document.querySelectorAll('[data-icon]').forEach(el=>el.innerHTML=icon(el.dataset.icon));
const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const today=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;};
const dateLabel=date=>new Date(date+'T12:00:00').toLocaleDateString('ko-KR',{year:'numeric',month:'long',day:'numeric'});
const identity=r=>JSON.stringify([r.student_name,r.classroom,r.student_number]);
const studentLabel=r=>[r.student_name,r.classroom,r.student_number?`${r.student_number}번`:''].filter(Boolean).join(' · ');
const fields={student_name:'student-name',classroom:'student-classroom',student_number:'student-number',date:'student-date',category:'student-category',title:'student-title',content:'student-content',follow_up:'student-follow-up'};
const state={records:[],roster:[],active:null,baseline:'',busy:false,loading:true,filter:''};
const recordIdentity=r=>identity(state.roster.find(s=>s.id===r.roster_id)||r);
function directory(){
  const students=new Map(state.roster.map(s=>[identity(s),{...s,count:0}]));
  for(const r of state.records){const key=recordIdentity(r);if(!students.has(key))students.set(key,{...r,id:null,count:0});students.get(key).count++;}
  return [...students].sort((a,b)=>a[1].classroom.localeCompare(b[1].classroom,'ko',{numeric:true})||a[1].student_number.localeCompare(b[1].student_number,'ko',{numeric:true})||a[1].student_name.localeCompare(b[1].student_name,'ko'));
}
function selectedStudent(){return new Map(directory()).get($('student-filter').value);}
function syncFormRoster(){
  const person=state.roster.find(s=>identity(s)===identity(value()));$('student-roster').value=person?.id||'';
  for(const id of ['student-name','student-classroom','student-number'])$(id).readOnly=Boolean(person);
}
const draftKey='private-sentences.student-draft.v1';
let toastTimer;
function toast(text){clearTimeout(toastTimer);$('student-toast').textContent=text;$('student-toast').hidden=false;toastTimer=setTimeout(()=>$('student-toast').hidden=true,4000);}
async function api(path,options={}){
  let response;try{response=await fetch(path,{...options,headers:{'Content-Type':'application/json',...options.headers}});}catch{throw Error('서버에 연결하지 못했습니다. 작성 내용은 그대로 남아 있습니다. 실행 창을 확인해 주세요.');}
  const data=await response.json();if(!response.ok)throw Error(data.error||'기록을 처리하지 못했습니다.');return data;
}
const value=()=>Object.fromEntries(Object.entries(fields).map(([key,id])=>[key,$(id).value]));
const dirty=()=>state.baseline!==JSON.stringify(value());
function clearDraft(){try{localStorage.removeItem(draftKey);}catch{}}
function updateCount(){$('student-char-count').textContent=`${($('student-content').value.length+$('student-follow-up').value.length).toLocaleString('ko-KR')}자`;}
function trackDraft(){
  updateCount();$('student-error').hidden=true;
  if(dirty()){
    try{localStorage.setItem(draftKey,JSON.stringify({record:value(),id:state.active?.id,version:state.active?.version}));$('student-save-status').textContent='브라우저에 초안 보관 중 · 저장 전';}
    catch{$('student-save-status').textContent='초안을 보관하지 못했습니다 · 저장해 주세요.';}
  }else{clearDraft();$('student-save-status').textContent=state.active?'저장된 학생 기록입니다.':'새로운 학생 기록을 남겨보세요.';}
}
function fill(record=null,student=null){
  state.active=record;
  const data=record||{student_name:student?.student_name||'',classroom:student?.classroom||'',student_number:student?.student_number||'',date:today(),category:'observation',title:'',content:'',follow_up:''};
  for(const [key,id] of Object.entries(fields))$(id).value=data[key];
  syncFormRoster();
  state.baseline=JSON.stringify(value());$('student-editor-heading').textContent=record?'함께 기억할 학생의 한 장면':'새로운 학생 기록';$('student-delete').hidden=!record;$('student-error').hidden=true;
  $('student-save-status').textContent=record?`저장됨 · ${new Date(record.updated_at).toLocaleString('ko-KR',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'})}`:'새로운 학생 기록을 남겨보세요.';
  updateCount();renderList();
}
function ask(title,message,action){return new Promise(resolve=>{const d=$('student-dialog');$('student-dialog-title').textContent=title;$('student-dialog-message').textContent=message;$('student-dialog-action').textContent=action;d.returnValue='';d.addEventListener('close',()=>resolve(d.returnValue==='confirm'),{once:true});d.showModal();});}
async function mayLeave(){
  if(state.busy||state.loading)return false;
  if(dirty()&&!await ask('저장하지 않은 학생 기록이 있어요','현재 입력한 내용을 버리고 이동할까요? 기록을 남기려면 돌아가서 먼저 저장해 주세요.','내용 버리고 이동'))return false;
  clearDraft();return true;
}
function filtered(){
  const q=$('student-search').value.trim().toLocaleLowerCase(),selected=$('student-filter').value,category=$('student-category-filter').value,classroom=$('student-class-filter').value;
  return state.records.filter(r=>(!selected||recordIdentity(r)===selected)&&(!classroom||(state.roster.find(s=>s.id===r.roster_id)||r).classroom===classroom)&&(!category||r.category===category)&&(!q||[r.student_name,r.classroom,r.student_number,r.title,r.content,r.follow_up].join(' ').toLocaleLowerCase().includes(q)));
}
function renderList(){
  const records=filtered();$('student-list-count').textContent=`${records.length}건의 기록`;
  const student=selectedStudent();$('student-selection').hidden=!student;$('student-selection').textContent=student?`${studentLabel(student)} · 전체 기록 ${student.count}건`:'';
  $('student-records').innerHTML=records.length?records.map(r=>`<button class="entry-card ${state.active?.id===r.id?'selected':''}" data-record-id="${r.id}" aria-pressed="${state.active?.id===r.id}" aria-label="${escape(studentLabel(r)+' · '+r.title)}"><span class="student-record-name">${escape(r.student_name)}<small>${escape([r.classroom,r.student_number?`${r.student_number}번`:''].filter(Boolean).join(' · ')||'반·번호 미입력')}</small></span><div class="entry-card-top"><span>${dateLabel(r.date)}</span><span class="student-category-tag">${categories[r.category]}</span></div><h3>${escape(r.title)}</h3><p>${escape(r.content)}</p></button>`).join(''):`<div class="empty-state">${icon('students')}<h3>${student?'이 학생의 표시할 기록이 없어요':state.records.length?'조건에 맞는 기록이 없어요':'아직 학생 기록이 없어요'}</h3><p>${student?'선택한 학생의 첫 관찰이나 상담을<br>새 기록으로 남겨보세요.':state.records.length?'반이나 학생, 분류, 검색어를 바꿔보세요.':'명렬표에서 학생을 선택하고<br>첫 기록을 남겨보세요.'}</p><button id="student-empty-new" class="text-button">${student||!state.records.length?'학생 기록 작성':'전체 기록 보기'}</button></div>`;
}
function render(){
  const selected=$('student-filter').value,all=directory(),classroom=$('student-class-filter').value;
  const classes=[...new Set(all.map(([,s])=>s.classroom))].filter(Boolean);
  $('student-class-filter').innerHTML='<option value="">모든 반</option>'+classes.map(c=>`<option value="${escape(c)}">${escape(c)}</option>`).join('');$('student-class-filter').value=classes.includes(classroom)?classroom:'';
  const sorted=all.filter(([,s])=>!$('student-class-filter').value||s.classroom===$('student-class-filter').value);
  $('student-filter').innerHTML='<option value="">모든 학생</option>'+sorted.map(([key,r])=>`<option value="${escape(key)}">${escape(studentLabel(r))} (${r.count}건)</option>`).join('');
  $('student-filter').value=sorted.some(([key])=>key===selected)?selected:'';state.filter=$('student-filter').value;
  const currentRoster=$('student-roster').value;
  $('student-roster').innerHTML='<option value="">직접 입력 (명렬표 외 학생)</option>'+state.roster.map(s=>`<option value="${s.id}">${escape(studentLabel(s))}</option>`).join('');$('student-roster').value=currentRoster;
  $('student-total').textContent=all.length;$('student-record-total').textContent=state.records.length;$('student-nav-count').textContent=state.records.length;
  $('student-month-total').textContent=state.records.filter(r=>r.date.startsWith(today().slice(0,7))).length;renderList();
}
function setBusy(busy){state.busy=busy;$('student-form').inert=busy;$('student-save').disabled=busy;$('student-delete').disabled=busy;$('student-save').innerHTML=icon('check')+(busy?'저장 중…':'학생 기록 저장');}
function showError(message){$('student-error').textContent=message;$('student-error').hidden=false;}
async function newRecord(){
  if(!await mayLeave())return;
  const selected=selectedStudent();
  fill(null,selected);$('student-name').focus();$('student-editor').scrollIntoView({behavior:'smooth',block:'start'});
}
$('student-new').onclick=newRecord;
$('student-records').onclick=async event=>{
  const button=event.target.closest('[data-record-id]');
  if(button){if(button.dataset.recordId===state.active?.id)return;if(await mayLeave()){fill(state.records.find(r=>r.id===button.dataset.recordId));if(innerWidth<1001)$('student-editor').scrollIntoView({behavior:'smooth',block:'start'});}}
  else if(event.target.closest('#student-empty-new')){if(selectedStudent()||!state.records.length)await newRecord();else{$('student-class-filter').value='';$('student-filter').value='';state.filter='';$('student-category-filter').value='';$('student-search').value='';render();}}
};
for(const id of Object.values(fields))$(id).addEventListener('input',trackDraft);
$('student-search').oninput=renderList;$('student-category-filter').onchange=renderList;
$('student-filter').onchange=async()=>{
  if(!await mayLeave()){$('student-filter').value=state.filter;return;}
  state.filter=$('student-filter').value;const person=selectedStudent();
  const latest=person&&state.records.find(r=>recordIdentity(r)===state.filter);fill(latest||null,person);renderList();
};
let previousClass='';
$('student-class-filter').onchange=async()=>{
  if(!await mayLeave()){$('student-class-filter').value=previousClass;return;}
  previousClass=$('student-class-filter').value;$('student-filter').value='';state.filter='';render();fill();
};
$('student-roster').onchange=async()=>{
  const id=$('student-roster').value;
  if(!await mayLeave()){syncFormRoster();return;}
  const person=state.roster.find(s=>s.id===id);fill(null,person);
  if(person){$('student-class-filter').value=person.classroom;previousClass=person.classroom;render();$('student-filter').value=identity(person);state.filter=identity(person);renderList();}
  else{$('student-class-filter').value='';previousClass='';$('student-filter').value='';state.filter='';render();}
};
$('student-form').onsubmit=async event=>{
  event.preventDefault();if(state.busy||state.loading)return;
  const data=value();if(!data.student_name.trim()||!data.content.trim()){showError('학생 이름과 기록 내용을 입력해 주세요.');(!data.student_name.trim()?$('student-name'):$('student-content')).focus();return;}
  setBusy(true);$('student-error').hidden=true;
  try{
    const roster=state.roster.find(s=>identity(s)===identity(data));
    const saved=await api('/api/student-records'+(state.active?'/'+state.active.id:''),{method:state.active?'PUT':'POST',body:JSON.stringify({...data,roster_id:roster?.id||null,version:state.active?.version})});
    state.records=state.records.filter(r=>r.id!==saved.id).concat(saved).sort((a,b)=>b.date.localeCompare(a.date)||b.created_at.localeCompare(a.created_at));clearDraft();fill(saved);render();$('student-connection').textContent='이 컴퓨터에 보관 중';toast('학생의 소중한 한 장면을 저장했어요.');
  }catch(error){showError(error.message);$('student-save-status').textContent='저장 실패 · 입력 내용 유지됨';}finally{setBusy(false);}
};
$('student-delete').onclick=async()=>{
  if(state.busy||!state.active)return;
  if(!await ask('이 학생 기록을 삭제할까요?','저장된 기록과 현재 수정 내용이 삭제됩니다. 삭제한 기록은 되돌릴 수 없어요.','학생 기록 삭제'))return;
  const current=state.active;setBusy(true);
  try{await api(`/api/student-records/${current.id}?version=${current.version}`,{method:'DELETE'});state.records=state.records.filter(r=>r.id!==current.id);clearDraft();fill();render();toast('학생 기록을 삭제했어요.');}catch(error){showError(error.message);}finally{setBusy(false);}
};
$('student-export').onclick=async()=>{
  $('student-export').disabled=true;
  try{const data=await api('/api/student-export');const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=`학생기록-백업-${today()}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('저장한 학생 기록 전체를 내보냈어요.');}catch(error){toast(error.message);}finally{$('student-export').disabled=false;}
};
window.addEventListener('beforeunload',event=>{if(dirty()){event.preventDefault();event.returnValue='';}});
document.addEventListener('keydown',event=>{if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='s'){event.preventDefault();if(!state.busy&&!state.loading)$('student-form').requestSubmit();}});
$('student-today').textContent=dateLabel(today());fill();
try{
  [state.records,state.roster]=await Promise.all([api('/api/student-records'),api('/api/roster')]);$('student-connection').textContent='이 컴퓨터에 보관 중';render();
  let draft;try{draft=JSON.parse(localStorage.getItem(draftKey));}catch{}
  if(draft?.record&&Object.keys(fields).every(key=>typeof draft.record[key]==='string')&&categories[draft.record.category]){
    const existing=state.records.find(r=>r.id===draft.id);fill(existing||null);if(existing)state.active={...existing,version:draft.version};
    for(const [key,id] of Object.entries(fields))$(id).value=draft.record[key];syncFormRoster();trackDraft();toast('작성 중이던 학생 기록 초안을 불러왔어요.');
  }else if(state.records.length)fill(state.records[0]);
}catch(error){showError(error.message);$('student-connection').textContent='서버 연결을 확인해 주세요';}
finally{state.loading=false;$('student-form').inert=false;if(!$('student-error').hidden)$('student-save-status').textContent='연결 확인 후 저장해 주세요.';}
