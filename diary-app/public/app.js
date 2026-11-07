const $=id=>document.getElementById(id);
const paths={plus:'M12 5v14M5 12h14',book:'M4 3h13a3 3 0 0 1 3 3v15H7a3 3 0 0 1-3-3V3Zm0 14h16M8 3v14',star:'m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9L12 3Z',sun:'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8ZM12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5',calendar:'M4 5h16v16H4V5Zm0 5h16M8 3v4m8-4v4M8 14h2m4 0h2m-8 3h2',leaf:'M20 3C10 2 3 7 5 14c2 7 13 6 15-11ZM4 21 15 9M9 15H5m8-4V7',download:'M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5',left:'m14 6-6 6 6 6',right:'m10 6 6 6-6 6',search:'M10.5 3a7.5 7.5 0 1 0 0 15 7.5 7.5 0 0 0 0-15Zm5.5 13 5 5',trash:'M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7',check:'m5 12 4 4L19 6'};
const icon=name=>`<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="${paths[name]||paths.book}"/></svg>`;
const moods={great:{label:'아주 좋음',mouth:'M7 13q5 8 10 0Z'},good:{label:'좋음',mouth:'M7 14q5 5 10 0'},okay:{label:'평온함',mouth:'M8 15h8'},low:{label:'지침',mouth:'M8 16q4-3 8 0'},sad:{label:'속상함',mouth:'M7 17q5-7 10 0'}};
const face=key=>`<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M8 9h.1M16 9h.1${moods[key].mouth}"/></svg>`;
document.querySelectorAll('[data-icon]').forEach(el=>el.innerHTML=icon(el.dataset.icon));
$('content').placeholder=$('content').placeholder.replaceAll('\\n','\n');
document.querySelector('.sidebar-bottom').classList.add('mobile-actions');
const localDate=(d=new Date())=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const fromDate=s=>new Date(s+'T12:00:00');
const fmt=(s,options={month:'long',day:'numeric',weekday:'short'})=>fromDate(s).toLocaleDateString('ko-KR',options);
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const state={entries:[],active:null,view:'all',filterDate:'',month:new Date(new Date().getFullYear(),new Date().getMonth(),1),mood:'okay',starred:false,baseline:'',busy:false};
const draftKey='private-sentences.draft.v1';
let toastTimer,draftWarned=false;
function toast(message){clearTimeout(toastTimer);$('toast').textContent=message;$('toast').hidden=false;toastTimer=setTimeout(()=>$('toast').hidden=true,4000);}
async function api(path,options={}){
  let response;try{response=await fetch(path,{...options,headers:{'Content-Type':'application/json',...options.headers}});}catch{throw Error('서버에 연결할 수 없습니다. 실행 창을 확인해 주세요. 작성 내용은 그대로 남아 있습니다.');}
  const data=await response.json();if(!response.ok)throw Error(data.error||'요청을 처리하지 못했습니다.');return data;
}
const formValue=()=>({date:$('entry-date').value,title:$('title').value,content:$('content').value,mood:state.mood,starred:state.starred});
const dirty=()=>JSON.stringify(formValue())!==state.baseline;
function updateEditor(){
  $('star').setAttribute('aria-pressed',String(state.starred));
  $('star').setAttribute('aria-label',state.starred?'아껴둔 문장에서 해제':'아껴둔 문장으로 저장');
  $('moods').innerHTML=Object.entries(moods).map(([key,m])=>`<button type="button" class="mood-button" data-mood="${key}" aria-pressed="${state.mood===key}">${face(key)}${m.label}</button>`).join('');
  $('delete').hidden=!state.active;
  $('char-count').textContent=`${$('content').value.length.toLocaleString('ko-KR')}자`;
  $('editor-heading').textContent=state.active?'기억해 둔 한 페이지':'오늘의 한 페이지';
}
function trackDraft(){
  updateEditor();$('form-error').hidden=true;
  if(dirty()){
    try{localStorage.setItem(draftKey,JSON.stringify({entry:formValue(),active:state.active}));$('save-status').textContent='이 브라우저에 초안 보관 중 · 저장 전';}
    catch{if(!draftWarned){toast('초안 보관 공간이 부족합니다. 기록 저장 버튼으로 저장해 주세요.');draftWarned=true;}$('save-status').textContent='아직 저장하지 않은 기록';}
  }else{$('save-status').textContent=state.active?'저장된 기록입니다.':'나만의 첫 문장을 남겨보세요.';try{localStorage.removeItem(draftKey);}catch{}}
}
function fill(entry=null,date=state.filterDate||localDate()){
  state.active=entry;state.mood=entry?.mood||'okay';state.starred=entry?.starred||false;
  $('entry-date').value=entry?.date||date;$('title').value=entry?.title||'';$('content').value=entry?.content||'';
  state.baseline=JSON.stringify(formValue());$('form-error').hidden=true;
  $('save-status').textContent=entry?`저장됨 · ${new Date(entry.updated_at).toLocaleString('ko-KR',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'})}`:'나만의 첫 문장을 남겨보세요.';
  updateEditor();renderList();
}
function ask(title,message,action){
  return new Promise(resolve=>{const d=$('confirm-dialog');$('dialog-title').textContent=title;$('dialog-message').textContent=message;$('dialog-confirm').textContent=action;d.returnValue='';d.addEventListener('close',()=>resolve(d.returnValue==='confirm'),{once:true});d.showModal();});
}
async function mayLeave(){
  if(state.busy)return false;
  if(dirty()&&!await ask('아직 저장하지 않은 문장이 있어요','현재 내용을 버리고 이동할까요? 계속 간직하려면 돌아가서 기록을 저장해 주세요.','내용 버리고 이동'))return false;
  try{localStorage.removeItem(draftKey);}catch{}return true;
}
function filtered(){
  const q=$('search').value.trim().toLocaleLowerCase(),m=$('mood-filter').value;
  let entries=state.entries.filter(e=>(state.view!=='starred'||e.starred)&&(state.view!=='today'||e.date===localDate())&&(!state.filterDate||e.date===state.filterDate)&&(!m||e.mood===m)&&(!q||(e.title+' '+e.content).toLocaleLowerCase().includes(q)));
  if($('sort').value==='asc')entries=entries.toReversed();return entries;
}
function renderList(){
  const entries=filtered();
  $('list-title').textContent=state.filterDate?fmt(state.filterDate,{month:'long',day:'numeric'}):({all:'모든 기록',starred:'아껴둔 문장',today:'오늘의 기록'}[state.view]);
  $('list-count').textContent=`${entries.length}편의 이야기`;
  $('entries').innerHTML=entries.length?entries.map(e=>`<button class="entry-card ${state.active?.id===e.id?'selected':''}" data-id="${e.id}" aria-label="${escape(e.title)} · ${fmt(e.date)}" aria-pressed="${state.active?.id===e.id}"><div class="entry-card-top"><span>${fmt(e.date,{year:'numeric',month:'2-digit',day:'2-digit',weekday:'short'})}</span>${e.starred?icon('star'):''}</div><h3>${escape(e.title)}</h3><p>${escape(e.content)}</p><div class="entry-card-bottom">${face(e.mood)}<span>${moods[e.mood].label}</span></div></button>`).join(''):`<div class="empty-state">${icon('leaf')}<h3>${state.entries.length?'아직 이곳에 남긴 기록이 없어요':'아직 쓰이지 않은 이야기'}</h3><p>${state.entries.length?'검색어나 날짜, 기분을 바꿔보세요.':'평범했던 오늘의 한 장면을<br>첫 번째 문장으로 남겨보세요.'}</p><button class="text-button" id="empty-action">${state.entries.length?'모든 기록 보기':'첫 일기 쓰기'} ${icon('right')}</button></div>`;
}
function renderCalendar(){
  const year=state.month.getFullYear(),month=state.month.getMonth();
  $('calendar-title').textContent=`${year}년 ${month+1}월`;
  const dates=new Set(state.entries.map(e=>e.date));let html='';
  for(let i=0;i<new Date(year,month,1).getDay();i++)html+='<span></span>';
  for(let day=1;day<=new Date(year,month+1,0).getDate();day++){
    const date=localDate(new Date(year,month,day));
    html+=`<button class="day ${date===localDate()?'today':''} ${dates.has(date)?'recorded':''} ${state.filterDate===date?'selected':''}" data-date="${date}" aria-pressed="${state.filterDate===date}" aria-label="${year}년 ${month+1}월 ${day}일${dates.has(date)?', 기록 있음':''}">${day}</button>`;
  }
  $('calendar').innerHTML=html;$('clear-date').hidden=!state.filterDate;
}
function renderStats(){
  const today=localDate(),dates=new Set(state.entries.map(e=>e.date));let streak=0,d=fromDate(today);
  if(!dates.has(localDate(d)))d.setDate(d.getDate()-1);
  while(dates.has(localDate(d))){streak++;d.setDate(d.getDate()-1);}
  $('all-count').textContent=state.entries.length;$('star-count').textContent=state.entries.filter(e=>e.starred).length;
  $('total-stat').textContent=state.entries.length;$('month-stat').textContent=state.entries.filter(e=>e.date.startsWith(today.slice(0,7))).length;$('streak-stat').textContent=streak;
}
function render(){renderList();renderCalendar();renderStats();}
function resetFilters(){state.view='all';state.filterDate='';$('search').value='';$('mood-filter').value='';updateNav();render();}
function updateNav(){document.querySelectorAll('[data-view]').forEach(b=>{const selected=b.dataset.view===state.view;b.classList.toggle('active',selected);if(selected)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');});}
function setBusy(value){state.busy=value;$('entry-form').inert=value;$('star').disabled=value;$('delete').disabled=value;$('save').disabled=value;$('save').innerHTML=icon(value?'book':'check')+(value?'저장 중…':'기록 저장하기');}
$('new-entry').onclick=async()=>{if(await mayLeave()){fill();$('title').focus();$('editor').scrollIntoView({behavior:'smooth',block:'start'});}};
$('entries').onclick=async event=>{
  const button=event.target.closest('[data-id]');
  if(button){if(button.dataset.id===state.active?.id)return;if(await mayLeave()){fill(state.entries.find(e=>e.id===button.dataset.id));if(innerWidth<981)$('editor').scrollIntoView({behavior:'smooth',block:'start'});}}
  else if(event.target.closest('#empty-action')){if(state.entries.length)resetFilters();else $('title').focus();}
};
document.querySelectorAll('[data-view]').forEach(button=>button.onclick=()=>{state.view=button.dataset.view;state.filterDate='';updateNav();renderList();renderCalendar();});
$('search').oninput=renderList;$('mood-filter').onchange=renderList;$('sort').onchange=renderList;
for(const [id,direction] of [['prev-month',-1],['next-month',1]])$(id).onclick=()=>{state.month.setMonth(state.month.getMonth()+direction);renderCalendar();};
$('calendar').onclick=e=>{const b=e.target.closest('[data-date]');if(b){state.filterDate=state.filterDate===b.dataset.date?'':b.dataset.date;state.view='all';updateNav();renderCalendar();renderList();}};
$('clear-date').onclick=()=>{state.filterDate='';renderCalendar();renderList();};
for(const id of ['title','content','entry-date'])$(id).addEventListener('input',trackDraft);
$('moods').onclick=e=>{const b=e.target.closest('[data-mood]');if(b&&!state.busy){state.mood=b.dataset.mood;trackDraft();$('moods').querySelector(`[data-mood="${state.mood}"]`).focus();}};
$('star').onclick=()=>{state.starred=!state.starred;trackDraft();};
$('entry-form').onsubmit=async event=>{
  event.preventDefault();if(state.busy)return;
  if(!$('content').value.trim()){$('form-error').hidden=false;$('form-error').textContent='오늘의 이야기를 한 글자 이상 적어 주세요.';$('content').focus();return;}
  setBusy(true);$('form-error').hidden=true;
  try{
    const current=state.active;
    const saved=await api('/api/entries'+(current?'/'+current.id:''),{method:current?'PUT':'POST',body:JSON.stringify({...formValue(),version:current?.version})});
    state.entries=state.entries.filter(e=>e.id!==saved.id).concat(saved).sort((a,b)=>b.date.localeCompare(a.date)||b.created_at.localeCompare(a.created_at));
    try{localStorage.removeItem(draftKey);}catch{}
    fill(saved);render();$('connection').textContent='이 컴퓨터에 안전하게 보관 중';toast('오늘의 문장을 차곡차곡 보관했어요.');
  }catch(error){$('form-error').textContent=error.message;$('form-error').hidden=false;$('save-status').textContent='저장하지 못했습니다 · 입력 내용 유지됨';}
  finally{setBusy(false);}
};
$('delete').onclick=async()=>{
  if(!state.active||state.busy)return;
  if(!await ask('이 페이지를 지울까요?','저장된 일기와 이 화면의 수정 내용이 삭제됩니다. 삭제한 일기는 되돌릴 수 없어요.','일기 삭제'))return;
  const current=state.active;setBusy(true);
  try{await api(`/api/entries/${current.id}?version=${current.version}`,{method:'DELETE'});state.entries=state.entries.filter(e=>e.id!==current.id);try{localStorage.removeItem(draftKey);}catch{}fill();render();toast('일기를 삭제했어요.');}
  catch(error){$('form-error').textContent=error.message;$('form-error').hidden=false;}finally{setBusy(false);}
};
$('export').onclick=async()=>{
  $('export').disabled=true;
  try{const data=await api('/api/export');const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=`사적인문장-백업-${localDate()}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('저장한 모든 기록을 JSON 파일로 내보냈어요.');}catch(error){toast(error.message);}finally{$('export').disabled=false;}
};
window.addEventListener('beforeunload',event=>{if(dirty()){event.preventDefault();event.returnValue='';}});
document.addEventListener('keydown',event=>{if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='s'){event.preventDefault();$('entry-form').requestSubmit();}});
$('today-label').textContent=fmt(localDate(),{month:'long',day:'numeric',weekday:'long'});
fill();render();
try{
  state.entries=await api('/api/entries');$('connection').textContent='이 컴퓨터에 안전하게 보관 중';
  let draft;try{draft=JSON.parse(localStorage.getItem(draftKey));}catch{}
  if(draft?.entry&&typeof draft.entry.content==='string'&&typeof draft.entry.title==='string'&&moods[draft.entry.mood]&&/^\d{4}-\d{2}-\d{2}$/.test(draft.entry.date)){
    const existing=draft.active&&state.entries.find(e=>e.id===draft.active.id);
    fill(existing||null);if(existing)state.active={...existing,version:draft.active.version};
    $('entry-date').value=draft.entry.date;$('title').value=draft.entry.title;$('content').value=draft.entry.content;state.mood=draft.entry.mood;state.starred=Boolean(draft.entry.starred);trackDraft();toast('지난번 작성 중이던 초안을 불러왔어요.');
  }else if(state.entries.length)fill(state.entries[0]);
  render();
}catch(error){$('connection').textContent='서버 연결을 확인해 주세요';$('form-error').textContent=error.message;$('form-error').hidden=false;}
