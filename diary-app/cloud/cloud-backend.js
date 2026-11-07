import {normalizeEntry,normalizeStudentRecord} from './cloud-model.mjs';

let auth,db,authSDK,firestore,user;
const gate=document.createElement('section');gate.className='auth-gate';gate.setAttribute('aria-label','Google 로그인');
gate.setAttribute('role','dialog');gate.setAttribute('aria-modal','true');
const workspace=document.querySelector('.app-shell');workspace.inert=true;
gate.innerHTML='<div class="auth-card"><p class="eyebrow">PRIVATE WORKSPACE</p><h1>나에게만 열리는 기록</h1><p>Google 계정으로 로그인하면 본인의 일기와 학생 기록을 이용할 수 있습니다.</p><p class="cloud-notice">기존 컴퓨터의 일기·학생 명단은 자동 업로드되지 않습니다. 공용 기기에서는 사용 후 로그아웃하세요.</p><button class="primary" id="cloud-login" disabled>연결 확인 중…</button><p id="cloud-auth-error" class="auth-error" role="alert" hidden></p><p><a href="./index.html">웹앱 허브로 돌아가기</a></p></div>';
document.body.append(gate);
const login=gate.querySelector('button'),message=gate.querySelector('#cloud-auth-error');
function authError(text){message.textContent=text;message.hidden=false;}
const errors={'auth/popup-blocked':'팝업이 차단되었습니다. 이 사이트의 팝업을 허용하고 다시 로그인해 주세요.','auth/popup-closed-by-user':'로그인 창이 닫혔습니다. 다시 시도할 수 있습니다.','auth/unauthorized-domain':'배포 도메인이 Firebase 로그인 허용 목록에 등록되지 않았습니다.','permission-denied':'기록에 접근할 권한이 없습니다. 본인 계정과 Firebase 보안 규칙을 확인해 주세요.','unavailable':'저장소에 연결하지 못했습니다. 입력 내용을 보존한 채 다시 시도해 주세요.'};
function readable(error){return new Error(errors[error.code]||error.message||'연결에 문제가 생겼습니다. 잠시 후 다시 시도해 주세요.');}
async function initialize(){
  const response=await fetch(new URL('./firebase-config.public.json',import.meta.url),{cache:'no-store'});if(!response.ok)throw Error('Firebase 설정을 불러오지 못했습니다.');
  const config=await response.json();if(!config.configured||!config.projectId||!config.apiKey||!config.authDomain||!config.appId)throw Error('Firebase 프로젝트 연결을 준비 중입니다. 설정 완료 후 다시 열어 주세요.');
  const [appSDK,a,f]=await Promise.all([import('https://www.gstatic.com/firebasejs/13.2.0/firebase-app.js'),import('https://www.gstatic.com/firebasejs/13.2.0/firebase-auth.js'),import('https://www.gstatic.com/firebasejs/13.2.0/firebase-firestore.js')]);
  authSDK=a;firestore=f;const app=appSDK.initializeApp({apiKey:config.apiKey,authDomain:config.authDomain,projectId:config.projectId,appId:config.appId});
  auth=a.getAuth(app);db=f.getFirestore(app);await a.setPersistence(auth,a.browserSessionPersistence);
  login.disabled=false;login.textContent='Google 계정으로 로그인';
  login.focus();
  login.onclick=async()=>{login.disabled=true;message.hidden=true;try{const provider=new a.GoogleAuthProvider();provider.setCustomParameters({prompt:'select_account'});await a.signInWithPopup(auth,provider);}catch(error){authError(readable(error).message);}finally{login.disabled=false;}};
  user=await new Promise((resolve,reject)=>{const stop=a.onAuthStateChanged(auth,current=>{if(current){stop();resolve(current);}},reject);});
  if(!user.emailVerified||!user.providerData.some(p=>p.providerId==='google.com'))throw Error('인증된 Google 계정으로 로그인해 주세요.');
  gate.remove();workspace.inert=false;
  const account=document.createElement('div');account.className='cloud-account';const label=document.createElement('span');label.textContent=user.displayName||'내 계정';const logout=document.createElement('button');logout.className='text-button';logout.textContent='로그아웃';account.append(label,logout);document.querySelector('.sidebar-bottom').append(account);
  logout.onclick=async()=>{
    if(!confirm('저장하지 않은 초안은 삭제됩니다. 로그아웃할까요?'))return;
    try{for(let i=sessionStorage.length-1;i>=0;i--){const key=sessionStorage.key(i);if(key?.startsWith('hub:'+user.uid+':'))sessionStorage.removeItem(key);}}catch{}
    logout.disabled=true;try{await a.signOut(auth);document.body.replaceChildren();location.reload();}catch(error){logout.disabled=false;alert(readable(error).message);}
  };
  a.onAuthStateChanged(auth,current=>{if(!current||current.uid!==user.uid){document.body.replaceChildren();location.reload();}});
}
try{await initialize();}catch(error){authError(readable(error).message);login.disabled=false;login.textContent='다시 확인하기';login.onclick=()=>location.reload();await new Promise(()=>{});}

export const draftStorage={getItem:key=>sessionStorage.getItem(`hub:${user.uid}:${key}`),setItem:(key,value)=>sessionStorage.setItem(`hub:${user.uid}:${key}`,value),removeItem:key=>sessionStorage.removeItem(`hub:${user.uid}:${key}`)};
const checkUser=()=>{if(!auth.currentUser||auth.currentUser.uid!==user.uid)throw Error('다시 로그인해 주세요.');};
const collection=name=>{checkUser();return firestore.collection(db,'users',user.uid,name);};
const reference=(name,id)=>{checkUser();return firestore.doc(db,'users',user.uid,name,id);};
const serialize=snapshot=>{const d=snapshot.data();return {...d,id:snapshot.id,created_at:d.created_at?.toDate?.().toISOString()||'',updated_at:d.updated_at?.toDate?.().toISOString()||''};};
async function list(name){return (await firestore.getDocsFromServer(collection(name))).docs.map(serialize).sort((a,b)=>(b.date||'').localeCompare(a.date||'')||b.created_at.localeCompare(a.created_at));}
async function roster(){const [students,records]=await Promise.all([list('roster'),list('student_records')]);return students.map(s=>({...s,record_count:records.filter(r=>r.roster_id===s.id).length})).sort((a,b)=>a.grade-b.grade||a.class_no-b.class_no||Number(a.student_number)-Number(b.student_number));}
export async function api(path,options={}){
  checkUser();const method=options.method||'GET',url=new URL(path,'https://private.invalid'),match=url.pathname.match(/^\/api\/(entries|student-records)(?:\/([a-zA-Z0-9_-]{1,128}))?$/);
  try{
    if(method==='GET'){
      if(url.pathname==='/api/entries')return await list('entries');
      if(url.pathname==='/api/student-records')return await list('student_records');
      if(url.pathname==='/api/roster')return await roster();
      if(url.pathname==='/api/student-export')return {format:'student-records',version:2,exported_at:new Date().toISOString(),roster:await roster(),records:await list('student_records')};
      if(url.pathname==='/api/export')return {format:'private-sentences',version:3,exported_at:new Date().toISOString(),entries:await list('entries'),student_records:await list('student_records'),roster:await roster()};
    }
    if(!match)throw Error('지원하지 않는 요청입니다.');
    const name=match[1]==='entries'?'entries':'student_records',id=match[2];
    if(method==='DELETE'&&id){
      const version=Number(url.searchParams.get('version')),ref=reference(name,id);
      await firestore.runTransaction(db,async transaction=>{checkUser();const old=await transaction.get(ref);if(!old.exists())throw Error('이미 삭제된 기록입니다.');if(old.data().version!==version)throw Error('다른 창에서 수정된 기록입니다. 새로고침 후 삭제해 주세요.');transaction.delete(ref);});return {ok:true};
    }
    if((method==='POST'&&!id)||(method==='PUT'&&id)){
      const input=JSON.parse(options.body);let data=name==='entries'?normalizeEntry(input):normalizeStudentRecord(input);
      if(name==='student_records'&&data.roster_id){const person=await firestore.getDocFromServer(reference('roster',data.roster_id));if(!person.exists())throw Error('명렬표 학생을 다시 선택해 주세요.');const s=person.data();data={...data,student_name:s.student_name,classroom:s.classroom,student_number:s.student_number};}
      const ref=reference(name,id||crypto.randomUUID());
      await firestore.runTransaction(db,async transaction=>{
        checkUser();const old=await transaction.get(ref);
        if(id&&!old.exists())throw Error('기록을 찾을 수 없습니다.');
        if(id&&old.data().version!==input.version)throw Error('다른 창에서 수정된 기록입니다. 내용을 복사한 뒤 새로고침해 주세요.');
        transaction.set(ref,{...data,version:id?old.data().version+1:1,created_at:id?old.data().created_at:firestore.serverTimestamp(),updated_at:firestore.serverTimestamp()});
      });return serialize(await firestore.getDocFromServer(ref));
    }
    throw Error('지원하지 않는 요청입니다.');
  }catch(error){throw readable(error);}
}
