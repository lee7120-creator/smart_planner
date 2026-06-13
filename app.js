// ── Firebase ──
const FB_CONFIG = {
  apiKey: "AIzaSyC4u_IF5_UMygKI8JGt88P1yQFJg9rbSt0",
  authDomain: "my-calendar-1a589.firebaseapp.com",
  databaseURL: "https://my-calendar-1a589-default-rtdb.firebaseio.com",
  projectId: "my-calendar-1a589",
  storageBucket: "my-calendar-1a589.firebasestorage.app",
  messagingSenderId: "75434783601",
  appId: "1:75434783601:web:9144bb9f91f90aa4ab3cd0",
  measurementId: "G-SDMYBKDND0"
};
firebase.initializeApp(FB_CONFIG);
const fbDb = firebase.database();
let fbSaveTimer = null;
let pendingLocal = false; // 로컬 변경이 아직 Firebase에 안 올라간 상태

function setSyncStatus(s) {
  const dot = document.getElementById('syncDot');
  if (!dot) return;
  dot.className = 'sync-dot ' + s;
  const label = s === 'synced' ? '✅ 동기화됨' : s === 'syncing' ? '🔄 동기화 중...' : '❌ 오프라인';
  dot.title = label;
  document.getElementById('syncLive').textContent = label;
}

// Firebase 경로에 쓸 수 없는 문자(. # $ [ ] /) 제거 — 경로 인젝션 방지
function sanitizeUser(raw) {
  return (raw || '').replace(/[.#$\[\]\/\u0000-\u001f]/g, '').trim().slice(0, 40);
}

function fbRef() {
  return USER_ID && USER_ID !== 'demo' ? fbDb.ref(`users/${USER_ID}/tasks`) : null;
}

// ── Constants ──
const DAY_NAMES = ['월','화','수','목','금','토','일'];
const COLORS = [
  {hex:'#1a73e8',name:'파랑'},{hex:'#e53935',name:'빨강'},{hex:'#f9a825',name:'노랑'},
  {hex:'#43a047',name:'초록'},{hex:'#8e24aa',name:'보라'},{hex:'#fb8c00',name:'주황'},
  {hex:'#607d8b',name:'회색'},
];
const REPEAT_OPTS = [['none','없음'],['daily','매일'],['weekdays','평일'],['weekly','매주'],['biweekly','격주'],['monthly','매월']];
const REPEAT_LABEL = {daily:'🔄 매일', weekdays:'🔄 평일', weekly:'🔄 매주', biweekly:'🔄 격주', monthly:'🔄 매월'};
const WMO = {0:'☀️',1:'🌤️',2:'⛅',3:'☁️',45:'🌫️',48:'🌫️',51:'🌦️',53:'🌦️',55:'🌦️',61:'🌧️',63:'🌧️',65:'🌧️',71:'❄️',73:'❄️',75:'❄️',77:'🌨️',80:'🌦️',81:'🌦️',82:'🌦️',85:'❄️',86:'❄️',95:'⛈️',96:'⛈️',99:'⛈️'};
const WMO_D = {0:'맑음',1:'구름조금',2:'구름많음',3:'흐림',45:'안개',48:'안개',51:'이슬비',53:'이슬비',55:'이슬비',61:'비',63:'비',65:'강한비',71:'눈',73:'눈',75:'강한눈',77:'싸락눈',80:'소나기',81:'소나기',82:'강한소나기',85:'눈소나기',86:'눈소나기',95:'뇌우',96:'뇌우',99:'뇌우'};


// ── Seed data ──
const SEED_TASKS = {
  '2026-06-15':[
    {id:'demo1',text:'데모: 할 일을 클릭해 메모를 남겨보세요',starred:true,checked:false,color:'#1a73e8',repeat:'none',completions:{},subs:[{id:'demo1a',text:'하위 할 일도 추가할 수 있어요',checked:false,starred:false,color:null,subs:[]}]},
    {id:'demo2',text:'반복 일정 예시 (매일)',starred:false,checked:false,color:'#43a047',repeat:'daily',completions:{},subs:[]}
  ],
  '2026-06-16':[
    {id:'demo3',text:'완료된 할 일 예시',starred:false,checked:true,color:null,repeat:'none',completions:{},subs:[]}
  ]
};

// ── URL User ──
const URL_PARAMS = new URLSearchParams(window.location.search);
const USER_ID = sanitizeUser(URL_PARAMS.get('u') || '');
const READ_ONLY = URL_PARAMS.get('ro') === '1';
const STORAGE_KEY = USER_ID ? `calTasks_${USER_ID}` : 'calTasks';

// ── Landing page ──
if (!USER_ID) {
  const lastUser = localStorage.getItem('lastUser');
  if (lastUser) {
    window.location.replace(`?u=${encodeURIComponent(lastUser)}`);
  } else {
    document.getElementById('landingOverlay').style.display = 'flex';
    document.getElementById('landingInput').addEventListener('keydown', e => {
      if (e.key === 'Enter') document.getElementById('landingStartBtn').click();
    });
    document.getElementById('landingStartBtn').onclick = () => {
      const name = sanitizeUser(document.getElementById('landingInput').value);
      if (!name) { document.getElementById('landingInput').focus(); return; }
      window.location.href = `?u=${encodeURIComponent(name)}`;
    };
    document.getElementById('landingDarkBtn').onclick = () => {
      const html = document.documentElement;
      const isDark = html.dataset.theme === 'dark';
      html.dataset.theme = isDark ? 'light' : 'dark';
      document.getElementById('landingDarkBtn').textContent = isDark ? '🌙' : '☀️';
      localStorage.setItem('theme', html.dataset.theme);
    };
  }
} else {
  // 데모 방문은 lastUser를 덮어쓰지 않음 (내 캘린더 자동 이동 유지)
  if (USER_ID !== 'demo') localStorage.setItem('lastUser', USER_ID);
  document.getElementById('userChip').style.display = 'flex';
  document.getElementById('userChipName').textContent = USER_ID;
  if (READ_ONLY) document.getElementById('roChip').style.display = 'flex';
  document.getElementById('copyUrlBtn').style.display = 'flex';
  document.getElementById('copyUrlBtn').onclick = () => {
    const url = window.location.href.split('?')[0] + `?u=${encodeURIComponent(USER_ID)}`;
    navigator.clipboard.writeText(url).then(() => {
      const btn = document.getElementById('copyUrlBtn');
      const orig = btn.innerHTML;
      btn.innerHTML = '✅ <span>복사됨!</span>';
      setTimeout(() => { btn.innerHTML = orig; }, 1800);
    });
  };
  document.getElementById('switchUserBtn').style.display = 'flex';
  document.getElementById('switchUserBtn').onclick = () => {
    if (confirm('다른 사용자로 전환할까요? 현재 데이터는 유지됩니다.')) {
      localStorage.removeItem('lastUser');
      window.location.href = window.location.href.split('?')[0];
    }
  };
}

// ── State ──
let currentView = 'week';
let weekStart = getMonday(new Date());
let monthDate = new Date(); monthDate.setDate(1);
let activeInput = null;
let weatherByDate = {};
let weatherLoaded = false;
let weatherLoc = loadWeatherLoc();
let searchQuery = '';
let editCtx = null;
let _editColor = null, _editStarred = false, _editRepeat = 'none', _editTime = '', _editRepeatEnd = '';
let shouldAutoScroll = true;   // 모바일: 보기/주 전환 시에만 오늘로 자동 스크롤
let repeatDelCtx = null;
let dayModalDk = null;

function loadWeatherLoc() {
  try {
    const saved = JSON.parse(localStorage.getItem('weatherLoc') || 'null');
    if (saved && typeof saved.lat === 'number') return saved;
  } catch {}
  return {lat:37.5665, lon:126.978, name:'서울'};
}

// ── Persistence ──
// Firebase는 빈 배열/객체를 저장하지 않으므로(subs:[] 등이 사라짐)
// 로드 경로마다 스키마를 정규화해 undefined 접근 크래시를 방지한다.
function normalizeTasks(raw) {
  const out = {};
  Object.entries(raw || {}).forEach(([dk, list]) => {
    const arr = Array.isArray(list) ? list : Object.values(list || {});
    const clean = arr.filter(t => t && t.text != null).map(t => ({
      id: t.id || uid(),
      text: String(t.text),
      checked: !!t.checked,
      starred: !!t.starred,
      color: t.color || null,
      repeat: t.repeat || 'none',
      repeatEnd: t.repeatEnd || null,
      time: t.time || null,
      memo: t.memo || '',
      memoImgs: Array.isArray(t.memoImgs) ? t.memoImgs.filter(x => typeof x === 'string') : [],
      completions: t.completions || {},
      skips: t.skips || {},
      subComp: t.subComp || {},
      subs: (Array.isArray(t.subs) ? t.subs : Object.values(t.subs || {}))
        .filter(s => s && s.text != null)
        .map(s => ({id: s.id || uid(), text: String(s.text), checked: !!s.checked})),
    }));
    if (clean.length) out[dk] = clean;
  });
  return out;
}

let tasks = loadTasks();

function loadTasks() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    if (USER_ID === 'demo' && Object.keys(stored).length === 0) {
      return normalizeTasks(JSON.parse(JSON.stringify(SEED_TASKS)));
    }
    return normalizeTasks(stored);
  } catch { return {}; }
}

function saveTasks() {
  if (READ_ONLY) return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
  const ref = fbRef();
  if (!ref) return;
  pendingLocal = true;
  setSyncStatus('syncing');
  clearTimeout(fbSaveTimer);
  fbSaveTimer = setTimeout(() => {
    fbSaveTimer = null;
    ref.set(tasks)
      .then(() => { pendingLocal = false; setSyncStatus('synced'); })
      .catch(() => setSyncStatus('offline'));
  }, 300);
}

// 탭을 닫거나 백그라운드로 갈 때 디바운스 중인 저장을 즉시 플러시
window.addEventListener('pagehide', () => {
  if (fbSaveTimer) {
    clearTimeout(fbSaveTimer);
    fbSaveTimer = null;
    const ref = fbRef();
    if (ref) ref.set(tasks);
  }
});
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'hidden') return;
  if (fbSaveTimer) {
    clearTimeout(fbSaveTimer);
    fbSaveTimer = null;
    const ref = fbRef();
    if (ref) ref.set(tasks).then(() => { pendingLocal = false; setSyncStatus('synced'); });
  }
  if (memoSaveTimer2) {
    clearTimeout(memoSaveTimer2);
    memoSaveTimer2 = null;
    const ref2 = memosFbRef();
    if (ref2) ref2.set(memos).then(() => { pendingMemoLocal = false; });
  }
});

function initFirebaseSync() {
  const ref = fbRef();
  if (!ref) return;
  const dot = document.getElementById('syncDot');
  if (dot) dot.style.display = 'block';
  setSyncStatus('syncing');
  ref.on('value', snapshot => {
    // 로컬 변경이 업로드 대기 중이면 원격 스냅샷으로 덮어쓰지 않음 (입력 유실 방지)
    if (pendingLocal) return;
    const remote = snapshot.val();
    if (remote && typeof remote === 'object') {
      tasks = normalizeTasks(remote);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
      render();
    }
    setSyncStatus('synced');
  }, () => setSyncStatus('offline'));
}

// ── Date helpers ──

// ── Repeat helpers ──
function getRepeatTasksForDate(date, dayIdx) {
  const dk = dateKey(date);
  const out = [];
  Object.entries(tasks).forEach(([oDk, list]) => {
    if (oDk === dk || dk < oDk) return;  // 반복은 시작일 이후에만 발생
    list.forEach(t => {
      const rp = t.repeat;
      if (!rp || rp === 'none') return;
      if (t.repeatEnd && dk > t.repeatEnd) return;
      if (t.skips && t.skips[dk]) return;  // "이 날짜만 삭제"된 인스턴스
      let hit = false, adjusted = false;
      if (rp === 'daily') hit = true;
      else if (rp === 'weekdays') hit = dayIdx <= 4;
      else if (rp === 'weekly') hit = dateToDayIdx(parseDk(oDk)) === dayIdx;
      else if (rp === 'biweekly') {
        if (dateToDayIdx(parseDk(oDk)) === dayIdx) {
          const wks = Math.round((getMonday(date) - getMonday(parseDk(oDk))) / (7 * 864e5));
          hit = wks % 2 === 0;
        }
      } else if (rp === 'monthly') {
        const originDay = parseDk(oDk).getDate();
        const adj = adjustedMonthlyDate(date.getFullYear(), date.getMonth(), originDay);
        if (adj && dateKey(adj) === dk) { hit = true; adjusted = adj.getDate() !== originDay; }
      }
      if (hit) out.push({task: t, originDk: oDk, instanceDk: dk, adjusted});
    });
  });
  return out;
}
function isRepeatChecked(task, instanceDk) {
  if (!task.completions) return task.checked;
  return instanceDk in task.completions ? task.completions[instanceDk] : false;
}
function toggleRepeatInst(originDk, taskId, instanceDk) {
  const t=(tasks[originDk]||[]).find(x=>x.id===taskId); if(!t)return;
  if(!t.completions) t.completions={};
  t.completions[instanceDk]=!isRepeatChecked(t,instanceDk);
  saveTasks(); render();
}
// 반복 인스턴스의 서브태스크는 날짜별 체크 상태를 따로 가진다
function isSubChecked(parentTask, sub, instanceDk) {
  if (!instanceDk) return sub.checked;
  return !!(parentTask.subComp && parentTask.subComp[instanceDk] && parentTask.subComp[instanceDk][sub.id]);
}
function toggleRepeatSub(originDk, taskId, subId, instanceDk) {
  const t=(tasks[originDk]||[]).find(x=>x.id===taskId); if(!t)return;
  if(!t.subComp) t.subComp={};
  if(!t.subComp[instanceDk]) t.subComp[instanceDk]={};
  t.subComp[instanceDk][subId]=!t.subComp[instanceDk][subId];
  saveTasks(); render();
}

// 하루치 체크 항목(원본+서브+반복 인스턴스)을 일관된 기준으로 수집 — 진행률 계산 공용
function collectDayEntries(date, dayIdx) {
  const dk = dateKey(date);
  const out = [];
  (tasks[dk]||[]).forEach(t => {
    if (t.repeat && t.repeat !== 'none' && t.skips && t.skips[dk]) return;
    out.push({checked: !!t.checked});
    (t.subs||[]).forEach(s => out.push({checked: !!s.checked}));
  });
  getRepeatTasksForDate(date, dayIdx).forEach(({task, instanceDk}) => {
    out.push({checked: isRepeatChecked(task, instanceDk)});
    (task.subs||[]).forEach(s => out.push({checked: isSubChecked(task, s, instanceDk)}));
  });
  return out;
}

// ── Task mutations ──
function uid() { return Date.now().toString(36)+Math.random().toString(36).slice(2); }
function addTask(dk,text,color,starred,repeat,parentId,time) {
  if (READ_ONLY) return;
  if(!tasks[dk]) tasks[dk]=[];
  const t={id:uid(),text,checked:false,starred:!!starred,color:color||null,repeat:repeat||'none',repeatEnd:null,time:time||null,memo:'',memoImgs:[],completions:{},skips:{},subComp:{},subs:[]};
  if(parentId){const p=tasks[dk].find(x=>x.id===parentId);if(p)p.subs.push({id:t.id,text,checked:false});}
  else tasks[dk].push(t);
  saveTasks(); render();
}
function toggleTask(dk,id,subId) {
  if (READ_ONLY) return;
  const list=tasks[dk]||[];
  if(subId){const p=list.find(x=>x.id===id);if(p){const s=(p.subs||[]).find(x=>x.id===subId);if(s)s.checked=!s.checked;}}
  else{const t=list.find(x=>x.id===id);if(t)t.checked=!t.checked;}
  saveTasks(); render();
}
function toggleStar(dk,id){
  if (READ_ONLY) return;
  const t=(tasks[dk]||[]).find(x=>x.id===id);if(t){t.starred=!t.starred;saveTasks();render();}
}
function deleteTask(dk,id,subId) {
  if (READ_ONLY) return;
  if(!tasks[dk])return;
  if(subId){
    const p=tasks[dk].find(x=>x.id===id);
    if(p){
      const idx=(p.subs||[]).findIndex(x=>x.id===subId);
      if(idx<0)return;
      const [removed]=p.subs.splice(idx,1);
      saveTasks(); render();
      showToast(`"${removed.text}" 삭제됨`, ()=>{
        const pp=(tasks[dk]||[]).find(x=>x.id===id);
        if(pp){ if(!pp.subs)pp.subs=[]; pp.subs.splice(Math.min(idx,pp.subs.length),0,removed); saveTasks(); render(); }
      });
    }
  } else {
    const idx=tasks[dk].findIndex(x=>x.id===id);
    if(idx<0)return;
    const [removed]=tasks[dk].splice(idx,1);
    if(!tasks[dk].length) delete tasks[dk];
    saveTasks(); render();
    showToast(`"${removed.text}" 삭제됨`, ()=>{
      if(!tasks[dk])tasks[dk]=[];
      tasks[dk].splice(Math.min(idx,tasks[dk].length),0,removed);
      saveTasks(); render();
    });
  }
}
// 반복 태스크: 특정 날짜 인스턴스만 숨김
function skipRepeatInstance(originDk, taskId, instanceDk) {
  if (READ_ONLY) return;
  const t=(tasks[originDk]||[]).find(x=>x.id===taskId); if(!t)return;
  if(!t.skips) t.skips={};
  t.skips[instanceDk]=true;
  saveTasks(); render();
  showToast('이 날짜의 반복 항목을 삭제했어요', ()=>{
    const tt=(tasks[originDk]||[]).find(x=>x.id===taskId);
    if(tt && tt.skips){ delete tt.skips[instanceDk]; saveTasks(); render(); }
  });
}
// 태스크를 다른 날짜로 이동 (드래그앤드롭 / 내일로 미루기)
function moveTask(fromDk, id, toDk, beforeId) {
  if (READ_ONLY) return;
  if (fromDk === toDk && !beforeId) return;
  const list = tasks[fromDk]||[];
  const idx = list.findIndex(t=>t.id===id);
  if (idx < 0) return;
  const [t] = list.splice(idx,1);
  if (!list.length) delete tasks[fromDk];
  if (!tasks[toDk]) tasks[toDk]=[];
  let insertAt = tasks[toDk].length;
  if (beforeId) {
    const bi = tasks[toDk].findIndex(x=>x.id===beforeId);
    if (bi >= 0) insertAt = bi;
  }
  tasks[toDk].splice(insertAt,0,t);
  saveTasks(); render();
  return true;
}
// 다음 날이 주말·공휴일이면 다음 영업일까지 건너뜀
function postponeTask(dk, id) {
  const toDk = nextWorkdayAfter(dk);
  const t=(tasks[dk]||[]).find(x=>x.id===id);
  const name = t ? t.text : '';
  if (moveTask(dk, id, toDk)) {
    const d = parseDk(toDk);
    showToast(`"${name}" → ${d.getMonth()+1}/${d.getDate()}(${DAY_NAMES[dateToDayIdx(d)]})로 이동`, ()=>{ moveTask(toDk, id, dk); });
  }
}
// 어제 미완료 항목을 오늘로 이월
function carryOverFrom(fromDk, toDk) {
  if (READ_ONLY) return;
  const pending = (tasks[fromDk]||[]).filter(t=>!t.checked && (!t.repeat||t.repeat==='none'));
  if (!pending.length) return;
  const ids = pending.map(t=>t.id);
  ids.forEach(id => {
    const list = tasks[fromDk]||[];
    const idx = list.findIndex(t=>t.id===id);
    if (idx < 0) return;
    const [t] = list.splice(idx,1);
    if (!tasks[toDk]) tasks[toDk]=[];
    tasks[toDk].push(t);
  });
  if (tasks[fromDk] && !tasks[fromDk].length) delete tasks[fromDk];
  saveTasks(); render();
  showToast(`미완료 ${ids.length}개를 오늘로 가져왔어요`, ()=>{
    ids.forEach(id => moveTaskSilent(toDk, id, fromDk));
    saveTasks(); render();
  });
}
function moveTaskSilent(fromDk, id, toDk) {
  const list = tasks[fromDk]||[];
  const idx = list.findIndex(t=>t.id===id);
  if (idx < 0) return;
  const [t] = list.splice(idx,1);
  if (!list.length) delete tasks[fromDk];
  if (!tasks[toDk]) tasks[toDk]=[];
  tasks[toDk].push(t);
}

// ── Toast / Undo ──
function showToast(msg, undoFn, ms) {
  const cont = document.getElementById('toastContainer');
  const toast = el('div','toast');
  toast.appendChild(el('span','',{textContent:msg}));
  if (undoFn) {
    const btn = el('button','toast-undo',{textContent:'실행 취소'});
    btn.onclick = ()=>{ undoFn(); toast.remove(); };
    toast.appendChild(btn);
  }
  cont.appendChild(toast);
  setTimeout(()=>toast.remove(), ms || 6000);
}

// ── Edit modal ──
function buildEditColors() {
  const cp = document.getElementById('editColors'); cp.innerHTML='';
  const none=el('div','cp-dot selected');
  none.style.background='#e8eaed'; none.title='없음'; none.dataset.color='';
  none.onclick=()=>{_editColor=null;cp.querySelectorAll('.cp-dot').forEach(d=>d.classList.remove('selected'));none.classList.add('selected');};
  cp.appendChild(none);
  COLORS.forEach(c=>{
    const dot=el('div','cp-dot'); dot.style.background=c.hex; dot.title=c.name; dot.dataset.color=c.hex;
    dot.onclick=()=>{_editColor=c.hex;cp.querySelectorAll('.cp-dot').forEach(d=>d.classList.remove('selected'));dot.classList.add('selected');};
    cp.appendChild(dot);
  });
}
function buildEditRepeatOpts() {
  const sel = document.getElementById('editRepeatSel'); sel.innerHTML='';
  REPEAT_OPTS.forEach(([val,label])=>{
    const b=el('button','repeat-opt',{type:'button',textContent:label});
    b.dataset.val=val;
    b.onclick=()=>{
      _editRepeat=val;
      sel.querySelectorAll('.repeat-opt').forEach(x=>x.classList.remove('active'));
      b.classList.add('active');
      document.getElementById('editRepeatEndRow').style.display = val==='none' ? 'none':'flex';
    };
    sel.appendChild(b);
  });
}
function openEdit(dk,task,isRepeatInst,originDk) {
  if (READ_ONLY) return;
  const targetDk=isRepeatInst?originDk:dk;
  const targetTask=isRepeatInst?(tasks[originDk]||[]).find(t=>t.id===task.id):task;
  if(!targetTask)return;
  editCtx={dk:targetDk,taskId:targetTask.id};
  _editColor=targetTask.color; _editStarred=targetTask.starred; _editRepeat=targetTask.repeat||'none';
  _editTime=targetTask.time||''; _editRepeatEnd=targetTask.repeatEnd||'';
  buildEditColors();
  buildEditRepeatOpts();
  const starBtn=document.getElementById('editStarBtn');
  starBtn.classList.toggle('on',_editStarred);
  const cp=document.getElementById('editColors');
  cp.querySelectorAll('.cp-dot').forEach(d=>{
    d.classList.toggle('selected',(d.dataset.color||'')===(targetTask.color||''));
  });
  document.querySelectorAll('#editRepeatSel .repeat-opt').forEach(b=>{
    b.classList.toggle('active',b.dataset.val===_editRepeat);
  });
  document.getElementById('editRepeatEndRow').style.display = _editRepeat==='none' ? 'none':'flex';
  document.getElementById('editTime').value=_editTime;
  document.getElementById('editRepeatEnd').value=_editRepeatEnd;
  document.getElementById('editInput').value=targetTask.text;
  document.getElementById('editModal').classList.remove('hidden');
  setTimeout(()=>{const inp=document.getElementById('editInput');inp.focus();inp.select();},50);
}
function closeEdit() { document.getElementById('editModal').classList.add('hidden'); editCtx=null; }
document.getElementById('editStarBtn').onclick=function(){
  _editStarred=!_editStarred; this.classList.toggle('on',_editStarred);
};
document.getElementById('editTimeClear').onclick=()=>{document.getElementById('editTime').value='';};
document.getElementById('editRepeatEndClear').onclick=()=>{document.getElementById('editRepeatEnd').value='';};
document.getElementById('editSaveBtn').onclick=()=>{
  if(!editCtx)return;
  const text=document.getElementById('editInput').value.trim();
  if(!text)return;
  const t=(tasks[editCtx.dk]||[]).find(x=>x.id===editCtx.taskId);
  if(t){
    t.text=text;t.color=_editColor;t.starred=_editStarred;t.repeat=_editRepeat;
    t.time=document.getElementById('editTime').value||null;
    t.repeatEnd=_editRepeat!=='none'?(document.getElementById('editRepeatEnd').value||null):null;
    if(!t.completions)t.completions={};
  }
  saveTasks(); closeEdit(); render();
};
document.getElementById('editCancelBtn').onclick=closeEdit;
document.getElementById('editModal').onclick=e=>{if(e.target===document.getElementById('editModal'))closeEdit();};
document.getElementById('editModal').addEventListener('keydown',e=>trapFocus(document.getElementById('editModal'),e));

// 포커스 트랩 (모달 안에서 Tab 순환)
function trapFocus(modalEl, e) {
  if (e.key !== 'Tab') return;
  const f = modalEl.querySelectorAll('button,input,textarea,select,[tabindex="0"]');
  if (!f.length) return;
  const first = f[0], last = f[f.length-1];
  if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
  else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
}

// ── Repeat delete choice modal ──
function openRepeatDel(originDk, taskId, shownDk) {
  repeatDelCtx = {originDk, taskId, shownDk};
  const t=(tasks[originDk]||[]).find(x=>x.id===taskId);
  document.getElementById('repeatDelText').textContent =
    `"${t?t.text:''}" — 이 날짜(${shownDk})에서만 지울까요, 반복 전체를 지울까요?`;
  document.getElementById('repeatDelModal').classList.remove('hidden');
}
function closeRepeatDel(){ document.getElementById('repeatDelModal').classList.add('hidden'); repeatDelCtx=null; }
document.getElementById('repeatDelOnce').onclick=()=>{
  if(repeatDelCtx) skipRepeatInstance(repeatDelCtx.originDk, repeatDelCtx.taskId, repeatDelCtx.shownDk);
  closeRepeatDel();
};
document.getElementById('repeatDelAll').onclick=()=>{
  if(repeatDelCtx) deleteTask(repeatDelCtx.originDk, repeatDelCtx.taskId, null);
  closeRepeatDel();
};
document.getElementById('repeatDelCancel').onclick=closeRepeatDel;
document.getElementById('repeatDelModal').onclick=e=>{if(e.target===document.getElementById('repeatDelModal'))closeRepeatDel();};

// ── Memo ──
let memoCtx = null, memoTimer = null;

function openMemo(dk, taskId, anchorEl) {
  const task = (tasks[dk]||[]).find(t=>t.id===taskId);
  if (!task) return;
  memoCtx = {dk, taskId};
  document.getElementById('memoTitle').textContent = task.text;
  const ta = document.getElementById('memoTextarea');
  ta.value = task.memo || '';
  ta.readOnly = READ_ONLY;
  updateMemoCount();
  setMemoStatus('saved');
  renderMemoImgs(task);
  positionMemo(anchorEl);
  document.getElementById('memoOverlay').classList.remove('hidden');
  setTimeout(()=>ta.focus(), 60);
}

function positionMemo(anchor) {
  const pop = document.getElementById('memoPopup');
  if (window.innerWidth <= 768) return;
  const rect = anchor.getBoundingClientRect();
  const popW = 330, popH = 280;
  let left = rect.right + 14;
  let top  = rect.top - 8;
  if (left + popW > window.innerWidth - 12) left = rect.left - popW - 14;
  if (left < 12) left = 12;
  if (top + popH > window.innerHeight - 12) top = window.innerHeight - popH - 12;
  if (top < 8) top = 8;
  pop.style.left = left + 'px';
  pop.style.top  = top + 'px';
}

function closeMemo() {
  clearTimeout(memoTimer);
  if (memoCtx) saveMemoNow();
  document.getElementById('memoOverlay').classList.add('hidden');
  memoCtx = null;
}

function saveMemoNow() {
  if (!memoCtx || READ_ONLY) return;
  const task = (tasks[memoCtx.dk]||[]).find(t=>t.id===memoCtx.taskId);
  if (task) {
    task.memo = document.getElementById('memoTextarea').value;
    saveTasks();
    render();
  }
}

function setMemoStatus(state) {
  const elx = document.getElementById('memoStatus');
  elx.className = 'memo-status ' + (state==='saved'?'ok':'saving');
  elx.textContent = state==='saved' ? '자동 저장됨 ✓' : '저장 중...';
}

function updateMemoCount() {
  document.getElementById('memoCharCount').textContent = document.getElementById('memoTextarea').value.length + '자';
}

document.getElementById('memoTextarea').addEventListener('input', ()=>{
  updateMemoCount();
  setMemoStatus('saving');
  clearTimeout(memoTimer);
  memoTimer = setTimeout(()=>{ saveMemoNow(); setMemoStatus('saved'); }, 700);
});
document.getElementById('memoClose').onclick = closeMemo;
// 바깥 클릭으로는 닫히지 않음 — ✕ 버튼 또는 ESC로만 닫힘 (오버레이는 클릭 통과)

// ── 메모 팝업 드래그 이동 (데스크톱) ──
document.getElementById('memoHeader').addEventListener('mousedown', e => {
  if (window.innerWidth <= 768) return;
  if (e.target.closest('button')) return;
  e.preventDefault();
  const pop = document.getElementById('memoPopup');
  const sx = e.clientX, sy = e.clientY, ox = pop.offsetLeft, oy = pop.offsetTop;
  const mv = ev => {
    let nx = ox + ev.clientX - sx, ny = oy + ev.clientY - sy;
    nx = Math.max(4, Math.min(nx, window.innerWidth - 80));
    ny = Math.max(4, Math.min(ny, window.innerHeight - 50));
    pop.style.left = nx + 'px'; pop.style.top = ny + 'px';
  };
  const up = () => {
    document.removeEventListener('mousemove', mv);
    document.removeEventListener('mouseup', up);
  };
  document.addEventListener('mousemove', mv);
  document.addEventListener('mouseup', up);
});

// ── 메모 이미지 첨부 (IndexedDB 로컬 저장) ──
function renderMemoImgs(task) {
  const strip = document.getElementById('memoImgStrip');
  strip.innerHTML = '';
  const imgs = task.memoImgs || [];
  strip.style.display = imgs.length ? 'flex' : 'none';
  imgs.forEach(id => {
    const wrap = el('div', 'memo-thumb');
    const img = el('img', '', {alt: '첨부 이미지'});
    idbGet(id).then(data => {
      if (data) {
        img.src = data;
        img.onclick = () => openLightbox(data);
      } else {
        wrap.classList.add('missing');
        wrap.title = '이미지는 첨부한 기기에서만 보여요';
      }
    });
    wrap.appendChild(img);
    if (!READ_ONLY) {
      const x = el('button', 'memo-thumb-del', {textContent: '✕', title: '이미지 삭제'});
      x.onclick = () => {
        const t = (tasks[memoCtx.dk]||[]).find(tt => tt.id === memoCtx.taskId);
        if (!t) return;
        t.memoImgs = (t.memoImgs||[]).filter(i => i !== id);
        saveTasks(); renderMemoImgs(t); render();
      };
      wrap.appendChild(x);
    }
    strip.appendChild(wrap);
  });
}
async function attachMemoImage(file) {
  if (!memoCtx || READ_ONLY || !file) return;
  const task = (tasks[memoCtx.dk]||[]).find(t => t.id === memoCtx.taskId);
  if (!task) return;
  const dataUrl = await compressImage(file);
  if (!dataUrl) { showToast('⚠️ 이미지를 읽을 수 없어요'); return; }
  const id = uid();
  await idbPut(id, dataUrl);
  if (!task.memoImgs) task.memoImgs = [];
  task.memoImgs.push(id);
  saveTasks(); renderMemoImgs(task); render();
  showToast('🖼 이미지 첨부됨 (이 기기에만 저장)');
}
document.getElementById('memoImgBtn').onclick = () => {
  if (READ_ONLY) return;
  document.getElementById('memoImgInput').click();
};
document.getElementById('memoImgInput').addEventListener('change', e => {
  attachMemoImage(e.target.files[0]);
  e.target.value = '';
});
// 드래그앤드롭 첨부
const memoPopupEl = document.getElementById('memoPopup');
memoPopupEl.addEventListener('dragover', e => {
  if ([...(e.dataTransfer?.types||[])].includes('Files')) {
    e.preventDefault();
    memoPopupEl.classList.add('drag-over');
  }
});
memoPopupEl.addEventListener('dragleave', () => memoPopupEl.classList.remove('drag-over'));
memoPopupEl.addEventListener('drop', e => {
  memoPopupEl.classList.remove('drag-over');
  const files = [...(e.dataTransfer?.files||[])].filter(f => f.type.startsWith('image/'));
  if (!files.length) return;
  e.preventDefault();
  files.forEach(f => attachMemoImage(f));
});
// 붙여넣기 첨부
document.getElementById('memoTextarea').addEventListener('paste', e => {
  const items = [...(e.clipboardData?.items||[])].filter(i => i.type.startsWith('image/'));
  if (!items.length) return;
  e.preventDefault();
  items.forEach(it => attachMemoImage(it.getAsFile()));
});

// ── 라이트박스 ──
function openLightbox(src) {
  document.getElementById('lightboxImg').src = src;
  document.getElementById('lightbox').classList.remove('hidden');
}
function closeLightbox() { document.getElementById('lightbox').classList.add('hidden'); }
document.getElementById('lightbox').onclick = closeLightbox;

// ── Weather ──
async function fetchWeather(lat,lon) {
  try {
    const r=await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=temperature_2m_max,temperature_2m_min,weathercode,precipitation_probability_max&timezone=auto&forecast_days=16`);
    const d=await r.json();
    (d.daily.time||[]).forEach((dt,i)=>{
      const code=d.daily.weathercode[i]??0;
      weatherByDate[dt]={emoji:WMO[code]||'🌡️',desc:WMO_D[code]||'',max:Math.round(d.daily.temperature_2m_max[i]),min:Math.round(d.daily.temperature_2m_min[i]),rain:d.daily.precipitation_probability_max[i]??0};
    });
    weatherLoaded = true;
    render();
  } catch(e){ weatherLoaded = true; console.warn('날씨 로드 실패',e); render(); }
}
document.getElementById('locationBtn').onclick=()=>{
  if(!navigator.geolocation)return;
  navigator.geolocation.getCurrentPosition(p=>{
    weatherLoc={lat:p.coords.latitude,lon:p.coords.longitude,name:'내 위치'};
    localStorage.setItem('weatherLoc', JSON.stringify(weatherLoc));
    fetchWeather(weatherLoc.lat,weatherLoc.lon);
    showToast('📍 내 위치 날씨로 변경했어요 (저장됨)');
  },()=>fetchWeather(weatherLoc.lat,weatherLoc.lon));
};

// ── DOM helper ──
function el(tag,cls,attrs){const e=document.createElement(tag);if(cls)e.className=cls;if(attrs)Object.assign(e,attrs);return e;}

// 배경색 밝기에 따라 검정/흰색 글자 선택 (노란색 가독성 문제 해결)
function textColorFor(hex) {
  const n = parseInt(hex.slice(1), 16);
  const r = (n>>16)&255, g = (n>>8)&255, b = n&255;
  return (r*299 + g*587 + b*114) / 1000 > 150 ? '#1a1a1a' : '#fff';
}

const IS_TOUCH = window.matchMedia('(hover: none)').matches;

// ── Task item builder ──
function buildTaskItem(dk,task,isSub,parentId,isRepeatInst,originDk,instanceDk,adjusted,parentTask) {
  const item=el('div',`task-item${isSub?' sub':''}`);
  const checked = isSub
    ? (isRepeatInst ? isSubChecked(parentTask,task,instanceDk) : task.checked)
    : (isRepeatInst ? isRepeatChecked(task,instanceDk) : task.checked);
  // 지난 날짜의 미완료 항목 강조
  if (!checked && dk < todayKey()) item.classList.add('overdue');

  if(!isSub){
    const star=el('button',`task-star${task.starred?' on':''}`,{textContent:'★',title:'중요 표시'});
    star.setAttribute('aria-label', task.starred?'중요 해제':'중요 표시');
    star.onclick=e=>{e.stopPropagation();toggleStar(isRepeatInst?originDk:dk,task.id);};
    item.appendChild(star);
  }
  if(task.color){const dot=el('div','color-dot');dot.style.background=task.color;item.appendChild(dot);}
  const cb=el('button',`task-cb${checked?' checked':''}`);
  cb.setAttribute('role','checkbox');
  cb.setAttribute('aria-checked', checked?'true':'false');
  cb.setAttribute('aria-label', task.text);
  if (!READ_ONLY) {
    cb.onclick=e=>{
      e.stopPropagation();
      if(isSub){
        if(isRepeatInst) toggleRepeatSub(originDk,parentId,task.id,instanceDk);
        else toggleTask(dk,parentId,task.id);
      } else {
        if(isRepeatInst) toggleRepeatInst(originDk,task.id,instanceDk);
        else toggleTask(dk,task.id,null);
      }
    };
  } else { cb.style.cursor='default'; cb.disabled=true; }
  item.appendChild(cb);
  const body=el('div','task-body');
  const textWrap=el('div','task-text-wrap');
  const txt=el('div',`task-text${checked?' done':''}`,{textContent:task.text});
  textWrap.appendChild(txt);
  if(!isSub&&(task.memo||(task.memoImgs&&task.memoImgs.length))){ const dot=el('span','memo-dot',{title:'메모 있음'}); textWrap.appendChild(dot); }
  if(!isSub){
    textWrap.onclick=e=>{e.stopPropagation();openMemo(isRepeatInst?originDk:dk,task.id,textWrap);};
  }
  body.appendChild(textWrap);
  if(!isSub&&task.time){
    body.appendChild(el('span','task-time-badge',{textContent:'🕐 '+task.time}));
  }
  if(!isSub&&task.repeat&&task.repeat!=='none'){
    body.appendChild(el('div','repeat-badge',{textContent:REPEAT_LABEL[task.repeat]||'🔄'}));
  }
  if(!isSub&&adjusted){
    body.appendChild(el('div','repeat-adjusted-badge',{textContent:'📅 일정 앞당김'}));
  }
  if(!isSub&&task.subs&&task.subs.length){
    const sl=el('div','subtask-list');
    task.subs.forEach(s=>sl.appendChild(buildTaskItem(dk,s,true,task.id,isRepeatInst,originDk,instanceDk,false,task)));
    body.appendChild(sl);
  }
  if(!isSub&&!isRepeatInst&&!READ_ONLY){
    const addSub=el('button','add-sub-btn',{textContent:'+ 하위 항목'});
    addSub.onclick=e=>{e.stopPropagation();activeInput={dateKey:dk,parentId:task.id};render();};
    body.appendChild(addSub);
  }
  item.appendChild(body);
  if (!READ_ONLY) {
    const actions=el('div','task-actions');
    if(!isSub && IS_TOUCH){
      actions.classList.add('collapsible');
      const more=el('button','task-act-btn more',{textContent:'⋯',title:'더보기'});
      more.setAttribute('aria-label','작업 메뉴 펼치기');
      more.onclick=e=>{e.stopPropagation();item.classList.toggle('show-acts');};
      actions.appendChild(more);
    }
    if(!isSub){
      const editBtn=el('button','task-act-btn',{textContent:'✏️',title:'수정'});
      editBtn.setAttribute('aria-label','수정');
      editBtn.onclick=e=>{e.stopPropagation();openEdit(dk,task,isRepeatInst,originDk);};
      actions.appendChild(editBtn);
      if(!isRepeatInst){
        const pstBtn=el('button','task-act-btn',{textContent:'⏭',title:'다음 영업일로 미루기'});
        pstBtn.setAttribute('aria-label','다음 영업일로 미루기');
        pstBtn.onclick=e=>{e.stopPropagation();postponeTask(dk,task.id);};
        actions.appendChild(pstBtn);
      }
    }
    const delBtn=el('button','task-act-btn del',{textContent:'✕',title:'삭제'});
    delBtn.setAttribute('aria-label','삭제');
    delBtn.onclick=e=>{
      e.stopPropagation();
      if(isSub){
        if(isRepeatInst) return; // 반복 인스턴스의 서브는 원본에서 삭제
        deleteTask(dk,parentId,task.id);
      } else if(isRepeatInst||(task.repeat&&task.repeat!=='none')){
        openRepeatDel(isRepeatInst?originDk:dk, task.id, dk);
      } else {
        deleteTask(dk,task.id,null);
      }
    };
    if(!(isSub&&isRepeatInst)) actions.appendChild(delBtn);
    item.appendChild(actions);

    // 드래그 앤 드롭 (데스크톱, 최상위 항목만)
    if(!isSub && !isRepeatInst && !IS_TOUCH){
      item.draggable = true;
      item.addEventListener('dragstart', e=>{
        e.dataTransfer.setData('text/plain', JSON.stringify({dk, id:task.id}));
        e.dataTransfer.effectAllowed = 'move';
        item.classList.add('dragging');
      });
      item.addEventListener('dragend', ()=>item.classList.remove('dragging'));
      item.addEventListener('dragover', e=>{e.preventDefault();e.stopPropagation();});
      item.addEventListener('drop', e=>{
        e.preventDefault(); e.stopPropagation();
        try {
          const src = JSON.parse(e.dataTransfer.getData('text/plain'));
          if (src.id !== task.id) moveTask(src.dk, src.id, dk, task.id);
        } catch {}
      });
    }
  }
  return item;
}

// ── Input form builder ──
function buildInputForm(dk,parentId){
  let selColor=null,starred=false,selRepeat='none';
  const form=el('div','input-form');
  const row=el('div','input-row');
  const inp=el('input','task-input');
  inp.type='text';inp.placeholder='할 일 입력...';inp.id=`inp-${dk}-${parentId||'main'}`;
  row.appendChild(inp);
  let timeInp=null;
  if(!parentId){
    timeInp=el('input','time-input');timeInp.type='time';timeInp.title='시간 (선택)';
    row.appendChild(timeInp);
    const sb=el('button','star-toggle',{type:'button',textContent:'★'});
    sb.setAttribute('aria-label','중요 표시');
    sb.onclick=()=>{starred=!starred;sb.classList.toggle('on',starred);};
    row.appendChild(sb);
  }
  form.appendChild(row);
  if(!parentId){
    const cp=el('div','color-picker');
    const none=el('div','cp-dot selected');none.style.background='#e8eaed';none.title='없음';
    none.onclick=()=>{selColor=null;cp.querySelectorAll('.cp-dot').forEach(d=>d.classList.remove('selected'));none.classList.add('selected');};
    cp.appendChild(none);
    COLORS.forEach(c=>{
      const dot=el('div','cp-dot');dot.style.background=c.hex;dot.title=c.name;
      dot.onclick=()=>{selColor=c.hex;cp.querySelectorAll('.cp-dot').forEach(d=>d.classList.remove('selected'));dot.classList.add('selected');};
      cp.appendChild(dot);
    });
    form.appendChild(cp);
    const rs=el('div','repeat-selector');
    REPEAT_OPTS.forEach(([val,label])=>{
      const btn=el('button',`repeat-opt${val==='none'?' active':''}`,{type:'button',textContent:label});
      btn.onclick=()=>{selRepeat=val;rs.querySelectorAll('.repeat-opt').forEach(b=>b.classList.remove('active'));btn.classList.add('active');};
      rs.appendChild(btn);
    });
    form.appendChild(rs);
  }
  const acts=el('div','form-actions');
  const addBtn=el('button','btn-add',{type:'button',textContent:'추가'});
  const cancelBtn=el('button','btn-cancel',{type:'button',textContent:'닫기'});
  addBtn.onclick=()=>{
    const v=inp.value.trim();
    if(v){ addTask(dk,v,selColor,starred,selRepeat,parentId,timeInp?timeInp.value:null); }
    else { activeInput=null;render(); }
  };
  cancelBtn.onclick=()=>{activeInput=null;render();};
  inp.addEventListener('keydown',e=>{if(e.key==='Enter')addBtn.click();if(e.key==='Escape')cancelBtn.click();});
  acts.appendChild(addBtn);acts.appendChild(cancelBtn);form.appendChild(acts);
  return form;
}

// ── Weather bar ──
function buildWeatherBar(dk){
  const bar=el('div','weather-bar');
  const w=weatherByDate[dk];
  if(!w){
    bar.appendChild(el('span','weather-skeleton',{textContent: weatherLoaded ? '예보 없음' : '날씨 로드 중...'}));
  } else {
    bar.appendChild(el('span','weather-emoji',{textContent:w.emoji}));
    const info=el('div','weather-info');
    const temp=el('div','weather-temp');
    temp.innerHTML=`<span class="hi">${w.max}°</span> / <span class="lo">${w.min}°</span>`;
    info.appendChild(temp);
    info.appendChild(el('div','weather-desc',{textContent:w.desc}));
    if(w.rain>0)info.appendChild(el('div','weather-rain',{textContent:`💧 ${w.rain}%`}));
    bar.appendChild(info);
  }
  return bar;
}

// ── Day column ──
function sortDayTasks(list){
  return [...list].sort((a,b)=>{
    if((b.starred?1:0)!==(a.starred?1:0)) return (b.starred?1:0)-(a.starred?1:0);
    const at=a.time||'99:99', bt=b.time||'99:99';
    return at.localeCompare(bt);
  });
}
function buildDayCol(date,dayIdx){
  const dk=dateKey(date);
  const isToday=date.getTime()===today().getTime();
  const isWeekend=dayIdx>=5;
  const holiday=HOLIDAYS[dk];
  const col=el('div',`day-col${isToday?' is-today':''}${isWeekend?' is-weekend':''}${holiday?' is-holiday':''}`);
  // header
  const hdr=el('div','day-header');
  hdr.appendChild(el('div','day-name',{textContent:DAY_NAMES[dayIdx]+'요일'}));
  const nw=el('div','day-num-wrap');
  nw.appendChild(el('div','day-num',{textContent:date.getDate()}));
  hdr.appendChild(nw);
  hdr.appendChild(el('div','day-month',{textContent:`${date.getMonth()+1}월`}));
  if(holiday) hdr.appendChild(el('div','holiday-label',{textContent:'🎌 '+holiday}));
  // 진행률: 서브태스크·반복 인스턴스 포함, 인스턴스는 completions 기준
  const entries=collectDayEntries(date,dayIdx);
  const total=entries.length;
  const done=entries.filter(e=>e.checked).length;
  if(total>0){
    const meta=el('div','day-meta');
    meta.appendChild(el('span','task-count-badge',{textContent:`${total}개`}));
    const bar=el('div','day-progress');
    const fill=el('div','day-progress-fill');
    fill.style.width=`${Math.round(done/total*100)}%`;
    bar.appendChild(fill); meta.appendChild(bar);
    hdr.appendChild(meta);
  }
  col.appendChild(hdr);
  // 어제 미완료 이월 배너 (오늘 컬럼에만)
  if(isToday && !READ_ONLY){
    const y=new Date(date); y.setDate(y.getDate()-1);
    const ydk=dateKey(y);
    const pending=(tasks[ydk]||[]).filter(t=>!t.checked&&(!t.repeat||t.repeat==='none')).length;
    if(pending>0){
      const banner=el('button','carryover-banner',{textContent:`⏬ 어제 미완료 ${pending}개 가져오기`});
      banner.onclick=()=>carryOverFrom(ydk,dk);
      col.appendChild(banner);
    }
  }
  // tasks
  const list=el('div','tasks-list');
  const dayTasks=(tasks[dk]||[]).filter(t=>!(t.repeat&&t.repeat!=='none'&&t.skips&&t.skips[dk]));
  sortDayTasks(dayTasks).forEach(t=>list.appendChild(buildTaskItem(dk,t,false,null,false,null,null)));
  const repeats=getRepeatTasksForDate(date,dayIdx);
  repeats.forEach(({task,originDk,instanceDk,adjusted})=>{
    list.appendChild(buildTaskItem(dk,task,false,null,true,originDk,instanceDk,adjusted));
  });
  if(dayTasks.length+repeats.length===0){
    const empty=el('div','day-empty');
    empty.appendChild(el('div','day-empty-icon',{textContent:'○'}));
    empty.appendChild(el('div','day-empty-text',{textContent:'할 일 없음'}));
    list.appendChild(empty);
  }
  const ai=activeInput;
  if(ai&&ai.dateKey===dk&&ai.parentId) list.appendChild(buildInputForm(dk,ai.parentId));
  col.appendChild(list);
  if(!READ_ONLY){
    if(ai&&ai.dateKey===dk&&!ai.parentId) col.appendChild(buildInputForm(dk,null));
    else{
      const addBtn=el('button','add-task-btn',{innerHTML:'+ 할 일 추가'});
      addBtn.onclick=()=>{activeInput={dateKey:dk,parentId:null};render();};
      col.appendChild(addBtn);
    }
    // 드롭 대상: 다른 날짜로 태스크 이동
    if(!IS_TOUCH){
      col.addEventListener('dragover',e=>{e.preventDefault();col.classList.add('drag-over');});
      col.addEventListener('dragleave',()=>col.classList.remove('drag-over'));
      col.addEventListener('drop',e=>{
        e.preventDefault(); col.classList.remove('drag-over');
        try {
          const src=JSON.parse(e.dataTransfer.getData('text/plain'));
          moveTask(src.dk,src.id,dk);
        } catch {}
      });
    }
  }
  col.appendChild(buildWeatherBar(dk));
  return col;
}

// ── Month view ──
function buildMonthView(){
  const wrap=el('div','month-wrap');
  const year=monthDate.getFullYear(), month=monthDate.getMonth();
  const firstDay=new Date(year,month,1);
  const lastDay=new Date(year,month+1,0);
  const start=getMonday(firstDay);
  const hdrs=el('div','month-day-headers');
  DAY_NAMES.forEach(n=>hdrs.appendChild(el('div','month-day-header',{textContent:n})));
  wrap.appendChild(hdrs);
  const grid=el('div','month-grid');
  let cur=new Date(start);
  while(true){
    const week=el('div','month-week');
    for(let i=0;i<7;i++){
      week.appendChild(buildMonthCell(new Date(cur),month));
      cur.setDate(cur.getDate()+1);
    }
    grid.appendChild(week);
    if(cur>lastDay&&cur.getDay()===1) break;
  }
  wrap.appendChild(grid);
  return wrap;
}
function buildMonthCell(date,curMonth){
  const dk=dateKey(date);
  const dayIdx=dateToDayIdx(date);
  const isToday=date.getTime()===today().getTime();
  const isOther=date.getMonth()!==curMonth;
  const isWeekend=date.getDay()===0||date.getDay()===6;
  const holiday=HOLIDAYS[dk];
  const cell=el('div',`month-cell${isToday?' is-today':''}${isOther?' other-month':''}${isWeekend?' is-weekend':''}${holiday?' is-holiday':''}`);
  if(isToday){const c=el('div','month-today-circle',{textContent:date.getDate()});cell.appendChild(c);}
  else cell.appendChild(el('div','month-date-num',{textContent:date.getDate()}));
  if(holiday) cell.appendChild(el('div','month-holiday-label',{textContent:'🎌 '+holiday}));
  // 직접 입력 + 반복 인스턴스 모두 표시
  const items=[];
  (tasks[dk]||[]).forEach(t=>{
    if(t.repeat&&t.repeat!=='none'&&t.skips&&t.skips[dk])return;
    items.push({text:t.text,checked:t.checked,color:t.color,starred:t.starred,repeat:false});
  });
  getRepeatTasksForDate(date,dayIdx).forEach(({task,instanceDk})=>{
    items.push({text:task.text,checked:isRepeatChecked(task,instanceDk),color:task.color,starred:task.starred,repeat:true});
  });
  items.slice(0,3).forEach(t=>{
    const pill=el('div',`month-pill${t.checked?' done':''}`);
    if(t.color){
      pill.style.background=t.color;
      pill.style.color=textColorFor(t.color);
      pill.style.opacity=t.checked?'.5':'1';
    }
    pill.textContent=(t.starred?'★ ':'')+(t.repeat?'🔄 ':'')+t.text;
    cell.appendChild(pill);
  });
  if(items.length>3) cell.appendChild(el('div','month-more',{textContent:`+${items.length-3}개 더`}));
  cell.onclick=()=>openDayModal(dk);
  return cell;
}

// ── Day detail modal (월간 보기에서 날짜 클릭) ──
function openDayModal(dk){
  dayModalDk = dk;
  const d = parseDk(dk);
  document.getElementById('dayModalTitle').textContent =
    `${d.getFullYear()}년 ${d.getMonth()+1}월 ${d.getDate()}일 (${DAY_NAMES[dateToDayIdx(d)]})`;
  const holiday = HOLIDAYS[dk];
  document.getElementById('dayModalSub').textContent = holiday ? '🎌 '+holiday : '';
  document.getElementById('dayModalAddRow').style.display = READ_ONLY ? 'none':'flex';
  renderDayModalList();
  document.getElementById('dayModal').classList.remove('hidden');
  if (!READ_ONLY) setTimeout(()=>document.getElementById('dayModalInput').focus(),60);
}
function renderDayModalList(){
  if(!dayModalDk) return;
  const dk = dayModalDk;
  const d = parseDk(dk);
  const dayIdx = dateToDayIdx(d);
  const list = document.getElementById('dayModalList');
  list.innerHTML='';
  const rows=[];
  (tasks[dk]||[]).forEach(t=>{
    if(t.repeat&&t.repeat!=='none'&&t.skips&&t.skips[dk])return;
    rows.push({task:t, inst:false});
  });
  getRepeatTasksForDate(d,dayIdx).forEach(r=>rows.push({task:r.task, inst:true, originDk:r.originDk, instanceDk:r.instanceDk}));
  if(!rows.length){
    list.appendChild(el('div','day-modal-empty',{textContent:'이 날짜에 할 일이 없습니다'}));
    return;
  }
  rows.forEach(({task,inst,originDk,instanceDk})=>{
    const row=el('div','day-modal-row');
    const checked = inst ? isRepeatChecked(task,instanceDk) : task.checked;
    const cb=el('button',`task-cb${checked?' checked':''}`);
    cb.setAttribute('role','checkbox');
    cb.setAttribute('aria-checked',checked?'true':'false');
    if(!READ_ONLY){
      cb.onclick=()=>{
        if(inst){
          const t=(tasks[originDk]||[]).find(x=>x.id===task.id);
          if(t){if(!t.completions)t.completions={};t.completions[instanceDk]=!isRepeatChecked(t,instanceDk);}
        } else {
          const t=(tasks[dk]||[]).find(x=>x.id===task.id);
          if(t)t.checked=!t.checked;
        }
        saveTasks(); renderDayModalList(); render();
      };
    } else cb.disabled=true;
    row.appendChild(cb);
    const txt=el('span',`row-text${checked?' done':''}`,{textContent:(task.starred?'★ ':'')+(inst?'🔄 ':'')+task.text+(task.time?` · 🕐${task.time}`:'')});
    row.appendChild(txt);
    if(!READ_ONLY && !inst){
      const del=el('button','task-act-btn del',{textContent:'✕',title:'삭제'});
      del.onclick=()=>{
        if(task.repeat&&task.repeat!=='none'){ closeDayModal(); openRepeatDel(dk,task.id,dk); }
        else { deleteTask(dk,task.id,null); renderDayModalList(); }
      };
      row.appendChild(del);
    }
    list.appendChild(row);
  });
}
function closeDayModal(){ document.getElementById('dayModal').classList.add('hidden'); dayModalDk=null; }
document.getElementById('dayModalClose').onclick=closeDayModal;
document.getElementById('dayModal').onclick=e=>{if(e.target===document.getElementById('dayModal'))closeDayModal();};
document.getElementById('dayModal').addEventListener('keydown',e=>trapFocus(document.getElementById('dayModal'),e));
document.getElementById('dayModalAddBtn').onclick=()=>{
  const inp=document.getElementById('dayModalInput');
  const v=inp.value.trim();
  if(v&&dayModalDk){ addTask(dayModalDk,v,null,false,'none',null,null); inp.value=''; renderDayModalList(); }
  inp.focus();
};
document.getElementById('dayModalInput').addEventListener('keydown',e=>{
  if(e.key==='Enter')document.getElementById('dayModalAddBtn').click();
});
document.getElementById('dayModalGoWeek').onclick=()=>{
  if(!dayModalDk)return;
  const d=parseDk(dayModalDk);
  closeDayModal();
  switchView('week');
  weekStart=getMonday(d);
  shouldAutoScroll=true;
  render();
};

// ── Search ──
function buildSearchView(query){
  const wrap=el('div','search-results-wrap');
  if(!query.trim()){wrap.appendChild(el('div','search-empty',{textContent:'검색어를 입력하세요'}));return wrap;}
  const q=query.toLowerCase();
  const results=[];
  Object.entries(tasks).forEach(([dk,list])=>{
    list.forEach(t=>{
      const subs=t.subs||[];
      const textHit=t.text.toLowerCase().includes(q);
      const subHits=subs.filter(s=>s.text.toLowerCase().includes(q));
      const memoHit=(t.memo||'').toLowerCase().includes(q);
      if(textHit||subHits.length||memoHit)
        results.push({dk,task:t,subHits,memoHit});
    });
  });
  results.sort((a,b)=>b.dk.localeCompare(a.dk));
  // 스탠드얼론 메모 검색 (제목·본문·태그)
  const noteHits=Object.values(memos).filter(mm=>(mm.title+' '+mm.text).toLowerCase().includes(q));
  if(noteHits.length){
    const grp=el('div','search-result-group');
    grp.appendChild(el('div','search-result-date',{textContent:`📝 메모 (${noteHits.length})`}));
    noteHits.forEach(mm=>{
      const item=el('div','search-result-item');
      item.appendChild(el('span','search-result-text',{textContent:'📄 '+memoLabel(mm)}));
      const txt=mm.text.trim();
      if(txt){
        const i2=txt.toLowerCase().indexOf(q);
        const snip=i2>=0?txt.slice(Math.max(0,i2-15),i2+q.length+30):txt.slice(0,45);
        item.appendChild(el('span','search-result-sub',{textContent:'…'+snip.replace(/\n/g,' ')+'…'}));
      }
      item.onclick=()=>{
        mm.open=true;bringNoteToFront(mm.id);
        if(!READ_ONLY)saveMemos();
        renderNoteWins();
      };
      grp.appendChild(item);
    });
    wrap.appendChild(grp);
  }
  if(!results.length&&!noteHits.length){wrap.appendChild(el('div','search-empty',{textContent:`"${query}" 검색 결과 없음`}));return wrap;}
  if(!results.length)return wrap;
  const groups={};
  results.forEach(r=>{if(!groups[r.dk])groups[r.dk]=[];groups[r.dk].push(r);});
  Object.entries(groups).sort((a,b)=>b[0].localeCompare(a[0])).forEach(([dk,list])=>{
    const grp=el('div','search-result-group');
    const d=parseDk(dk);
    grp.appendChild(el('div','search-result-date',{textContent:`${d.getFullYear()}년 ${d.getMonth()+1}월 ${d.getDate()}일 (${DAY_NAMES[dateToDayIdx(d)]})`}));
    list.forEach(({task:t,subHits,memoHit})=>{
      const item=el('div','search-result-item');
      if(t.color){const dot=el('div','color-dot');dot.style.background=t.color;dot.style.flexShrink='0';item.appendChild(dot);}
      const cb=el('button',`task-cb${t.checked?' checked':''}`);
      cb.setAttribute('role','checkbox');
      cb.setAttribute('aria-checked',t.checked?'true':'false');
      if(!READ_ONLY) cb.onclick=e=>{e.stopPropagation();toggleTask(dk,t.id,null);};
      else cb.disabled=true;
      item.appendChild(cb);
      item.appendChild(el('span','search-result-text',{textContent:(t.starred?'★ ':'')+t.text}));
      // 어떤 서브태스크/메모가 매칭됐는지 표시
      subHits.forEach(s=>{
        item.appendChild(el('span','search-result-sub',{textContent:'↳ '+s.text}));
      });
      if(memoHit){
        const memo=(t.memo||'');
        const i=memo.toLowerCase().indexOf(q);
        const snippet=memo.slice(Math.max(0,i-15), i+q.length+25);
        item.appendChild(el('span','search-result-sub',{textContent:'📝 …'+snippet+'…'}));
      }
      item.onclick=()=>{
        switchView('week');
        weekStart=getMonday(parseDk(dk));
        searchQuery='';document.getElementById('searchInput').value='';
        shouldAutoScroll=true;
        render();
      };
      grp.appendChild(item);
    });
    wrap.appendChild(grp);
  });
  return wrap;
}

// ── Stats view ──
function weekProgressFor(monday){
  let total=0,done=0;
  for(let i=0;i<7;i++){
    const d=new Date(monday);d.setDate(d.getDate()+i);
    collectDayEntries(d,i).forEach(e=>{total++;if(e.checked)done++;});
  }
  return {total,done};
}
function buildStatsView(){
  const wrap=el('div','stats-wrap');
  // 카드
  const thisWeek=weekProgressFor(getMonday(new Date()));
  const pct=thisWeek.total?Math.round(thisWeek.done/thisWeek.total*100):0;
  let overdueCnt=0, starredPending=0, totalAll=0, doneAll=0;
  const tk=todayKey();
  Object.entries(tasks).forEach(([dk,list])=>{
    list.forEach(t=>{
      totalAll++; if(t.checked)doneAll++;
      if(!t.checked&&dk<tk&&(!t.repeat||t.repeat==='none'))overdueCnt++;
      if(!t.checked&&t.starred)starredPending++;
      (t.subs||[]).forEach(s=>{totalAll++;if(s.checked)doneAll++;});
    });
  });
  const cards=el('div','stats-cards');
  [['이번 주 완료율',`${pct}<small>%</small>`,`${thisWeek.done}/${thisWeek.total}`],
   ['지연된 할 일',`${overdueCnt}<small>개</small>`,'지난 날짜 미완료'],
   ['중요 미완료',`${starredPending}<small>개</small>`,'★ 표시 중 미완료'],
   ['전체 완료',`${doneAll}<small>/${totalAll}</small>`,'누적']].forEach(([label,val,sub])=>{
    const c=el('div','stats-card');
    c.appendChild(el('div','stats-card-label',{textContent:label}));
    const v=el('div','stats-card-value'); v.innerHTML=val; c.appendChild(v);
    c.appendChild(el('div','stats-card-label',{textContent:sub}));
    cards.appendChild(c);
  });
  wrap.appendChild(cards);
  // 8주 추이
  const sec=el('div','stats-section');
  sec.appendChild(el('div','stats-section-title',{textContent:'📈 주간 완료율 추이 (최근 8주)'}));
  const bars=el('div','stats-bars');
  const curMon=getMonday(new Date());
  for(let w=7;w>=0;w--){
    const m=new Date(curMon); m.setDate(m.getDate()-w*7);
    const {total,done}=weekProgressFor(m);
    const p=total?Math.round(done/total*100):0;
    const colWrap=el('div','stats-bar-col');
    colWrap.appendChild(el('div','stats-bar-pct',{textContent:total?`${p}%`:'-'}));
    const bar=el('div',`stats-bar${w===0?' cur':''}`);
    bar.style.height=`${Math.max(p,2)}%`;
    bar.title=`${done}/${total}`;
    colWrap.appendChild(bar);
    colWrap.appendChild(el('div','stats-bar-label',{textContent:`${m.getMonth()+1}/${m.getDate()}`}));
    bars.appendChild(colWrap);
  }
  sec.appendChild(bars);
  wrap.appendChild(sec);
  // 요일 패턴
  const sec2=el('div','stats-section');
  sec2.appendChild(el('div','stats-section-title',{textContent:'📅 요일별 완료 패턴 (전체 기간)'}));
  const dayTotals=[0,0,0,0,0,0,0], dayDone=[0,0,0,0,0,0,0];
  Object.entries(tasks).forEach(([dk,list])=>{
    const idx=dateToDayIdx(parseDk(dk));
    list.forEach(t=>{dayTotals[idx]++;if(t.checked)dayDone[idx]++;});
  });
  const bars2=el('div','stats-bars');
  for(let i=0;i<7;i++){
    const p=dayTotals[i]?Math.round(dayDone[i]/dayTotals[i]*100):0;
    const colWrap=el('div','stats-bar-col');
    colWrap.appendChild(el('div','stats-bar-pct',{textContent:dayTotals[i]?`${p}%`:'-'}));
    const bar=el('div','stats-bar');
    bar.style.height=`${Math.max(p,2)}%`;
    bar.style.background=i>=5?'var(--red)':'var(--primary)';
    bar.title=`${dayDone[i]}/${dayTotals[i]}`;
    colWrap.appendChild(bar);
    colWrap.appendChild(el('div','stats-bar-label',{textContent:DAY_NAMES[i]}));
    bars2.appendChild(colWrap);
  }
  sec2.appendChild(bars2);
  wrap.appendChild(sec2);
  return wrap;
}

// ── Progress (week) ──
function calcProgress(){
  return weekProgressFor(weekStart);
}

// ── Render ──
function render(){
  const view=document.getElementById('mainView');
  // 리렌더 전에 가로 스크롤 위치 보존 (모바일에서 체크할 때마다 오늘로 튀는 문제 해결)
  const prevWrap=view.querySelector('.calendar-wrap');
  const prevScrollLeft=prevWrap?prevWrap.scrollLeft:null;
  view.innerHTML='';
  // week label
  if(searchQuery){
    document.getElementById('weekLabel').textContent='검색 결과';
  } else if(currentView==='week'){
    const end=new Date(weekStart);end.setDate(end.getDate()+6);
    document.getElementById('weekLabel').textContent=`${weekStart.getFullYear()}년 ${weekStart.getMonth()+1}월 ${weekStart.getDate()}일 ~ ${end.getMonth()+1}월 ${end.getDate()}일`;
  } else if(currentView==='month'){
    document.getElementById('weekLabel').textContent=`${monthDate.getFullYear()}년 ${monthDate.getMonth()+1}월`;
  } else {
    document.getElementById('weekLabel').textContent='통계';
  }
  // main content
  if(searchQuery){
    view.appendChild(buildSearchView(searchQuery));
  } else if(currentView==='week'){
    const wrap=el('div','calendar-wrap');
    if(window.innerWidth<=768){
      const hint=el('div','scroll-hint',{innerHTML:'← 스와이프해서 날짜 이동 →'});
      view.appendChild(hint);
    }
    const grid=el('div','calendar-grid');
    for(let i=0;i<7;i++){const d=new Date(weekStart);d.setDate(d.getDate()+i);grid.appendChild(buildDayCol(d,i));}
    wrap.appendChild(grid); view.appendChild(wrap);
    if(shouldAutoScroll && window.innerWidth<=768){
      // 보기/주 전환 시에만 오늘로 자동 스크롤
      setTimeout(()=>{
        const cols=document.querySelectorAll('.day-col');
        let todayIdx=-1;
        for(let i=0;i<7;i++){
          const d=new Date(weekStart);d.setDate(d.getDate()+i);
          if(d.getTime()===today().getTime()){todayIdx=i;break;}
        }
        const target=cols[todayIdx>=0?todayIdx:0];
        if(target) target.scrollIntoView({behavior:'smooth',inline:'start',block:'nearest'});
      },80);
    } else if(prevScrollLeft!=null){
      wrap.scrollLeft=prevScrollLeft;
    }
    shouldAutoScroll=false;
  } else if(currentView==='month'){
    view.appendChild(buildMonthView());
  } else {
    view.appendChild(buildStatsView());
  }
  // progress
  const {total,done}=calcProgress();
  const pct=total?Math.round(done/total*100):0;
  const pi=document.getElementById('progressInfo');
  pi.innerHTML=total>0?`${done}/${total} <span class="progress-bar-wrap"><span class="progress-bar-fill" style="width:${pct}%"></span></span>`:'';
  // focus
  if(activeInput){
    setTimeout(()=>{const inp=document.getElementById(`inp-${activeInput.dateKey}-${activeInput.parentId||'main'}`);if(inp)inp.focus();},30);
  }
}

// ── Nav ──
function switchView(v){
  currentView=v;
  ['btnWeek','btnMonth','btnStats'].forEach(id=>document.getElementById(id).classList.remove('active'));
  document.getElementById(v==='week'?'btnWeek':v==='month'?'btnMonth':'btnStats').classList.add('active');
}
document.getElementById('prevBtn').onclick=()=>{
  if(currentView==='week'){weekStart.setDate(weekStart.getDate()-7);shouldAutoScroll=true;}
  else if(currentView==='month')monthDate.setMonth(monthDate.getMonth()-1);
  render();
};
document.getElementById('nextBtn').onclick=()=>{
  if(currentView==='week'){weekStart.setDate(weekStart.getDate()+7);shouldAutoScroll=true;}
  else if(currentView==='month')monthDate.setMonth(monthDate.getMonth()+1);
  render();
};
document.getElementById('todayBtn').onclick=()=>{
  weekStart=getMonday(new Date()); monthDate=new Date(); monthDate.setDate(1);
  shouldAutoScroll=true; render();
};
document.getElementById('btnWeek').onclick=()=>{switchView('week');shouldAutoScroll=true;render();};
document.getElementById('btnMonth').onclick=()=>{switchView('month');render();};
document.getElementById('btnStats').onclick=()=>{switchView('stats');render();};

// ── Search (디바운스: 키 입력마다 풀스캔 방지) ──
let searchTimer=null;
document.getElementById('searchInput').addEventListener('input',e=>{
  clearTimeout(searchTimer);
  searchTimer=setTimeout(()=>{
    searchQuery=e.target.value;
    render();
  },150);
});

// ── Settings menu ──
const settingsMenu=document.getElementById('settingsMenu');
document.getElementById('settingsBtn').onclick=e=>{
  e.stopPropagation();
  document.getElementById('notesMenu').classList.add('hidden');
  settingsMenu.classList.toggle('hidden');
};
document.addEventListener('click',e=>{
  if(!settingsMenu.classList.contains('hidden') && !e.target.closest('.settings-wrap'))
    settingsMenu.classList.add('hidden');
});
// JSON 내보내기
document.getElementById('exportBtn').onclick=()=>{
  settingsMenu.classList.add('hidden');
  const blob=new Blob([JSON.stringify({_v:2,tasks,memos},null,2)],{type:'application/json'});
  const a=document.createElement('a');
  a.href=URL.createObjectURL(blob);
  a.download=`calendar-tasks-${USER_ID||'local'}-${todayKey()}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
  showToast('📤 백업 파일을 다운로드했어요');
};
// JSON 가져오기
document.getElementById('importBtn').onclick=()=>{
  settingsMenu.classList.add('hidden');
  if(READ_ONLY){showToast('읽기 전용 모드에서는 가져올 수 없어요');return;}
  document.getElementById('importFile').click();
};
document.getElementById('importFile').addEventListener('change',e=>{
  const file=e.target.files[0];
  if(!file)return;
  const reader=new FileReader();
  reader.onload=()=>{
    try{
      const parsed=JSON.parse(reader.result);
      // v2 백업({tasks,memos}) 또는 구버전(태스크만) 모두 지원
      const isV2=parsed&&typeof parsed==='object'&&parsed.tasks;
      const imported=normalizeTasks(isV2?parsed.tasks:parsed);
      const importedMemos=isV2?normalizeMemos(parsed.memos||{}):null;
      const replace=confirm('확인: 기존 데이터를 백업 파일로 교체합니다.\n취소: 기존 데이터와 병합합니다.');
      if(replace){
        tasks=imported;
        if(importedMemos)memos=importedMemos;
      } else {
        Object.entries(imported).forEach(([dk,list])=>{
          if(!tasks[dk]){tasks[dk]=list;return;}
          const ids=new Set(tasks[dk].map(t=>t.id));
          list.forEach(t=>{if(!ids.has(t.id))tasks[dk].push(t);});
        });
        if(importedMemos)Object.entries(importedMemos).forEach(([id,m])=>{if(!memos[id])memos[id]=m;});
      }
      saveTasks(); if(importedMemos){saveMemos();renderNoteWins();} render();
      showToast(`📥 ${replace?'교체':'병합'} 완료`);
    }catch{
      showToast('⚠️ 올바른 백업 파일이 아니에요');
    }
    e.target.value='';
  };
  reader.readAsText(file);
});
// 읽기전용 링크
document.getElementById('roLinkBtn').onclick=()=>{
  settingsMenu.classList.add('hidden');
  if(!USER_ID){showToast('사용자 URL에서만 가능해요');return;}
  const url=window.location.href.split('?')[0]+`?u=${encodeURIComponent(USER_ID)}&ro=1`;
  navigator.clipboard.writeText(url).then(()=>showToast('👁 읽기전용 링크를 복사했어요'));
};
// 알림 권한
document.getElementById('notifyBtn').onclick=()=>{
  settingsMenu.classList.add('hidden');
  if(!('Notification' in window)){showToast('이 브라우저는 알림을 지원하지 않아요');return;}
  Notification.requestPermission().then(p=>{
    showToast(p==='granted'?'🔔 시간 알림이 켜졌어요 (앱이 열려 있을 때 동작)':'알림 권한이 거부됐어요');
  });
};

// ── 시간 알림 (페이지가 열려 있는 동안 해당 시각에 알림) ──
const notifiedKeys=new Set();
function checkTimeNotifications(){
  if(!('Notification' in window)||Notification.permission!=='granted')return;
  const now=new Date();
  const dk=dateKey(now);
  const nowMin=now.getHours()*60+now.getMinutes();
  const candidates=[];
  (tasks[dk]||[]).forEach(t=>{if(t.time&&!t.checked)candidates.push({key:dk+'|'+t.id,text:t.text,time:t.time});});
  getRepeatTasksForDate(now,dateToDayIdx(now)).forEach(({task,instanceDk})=>{
    if(task.time&&!isRepeatChecked(task,instanceDk))candidates.push({key:instanceDk+'|'+task.id,text:task.text,time:task.time});
  });
  candidates.forEach(c=>{
    const [h,m]=c.time.split(':').map(Number);
    const tMin=h*60+m;
    // 정각 ±1분 안에서만 발화 (페이지 로드 시 과거 시간 일괄 발화 방지)
    if(nowMin>=tMin&&nowMin-tMin<=1&&!notifiedKeys.has(c.key)){
      notifiedKeys.add(c.key);
      try{ new Notification('📅 '+c.text,{body:`${c.time} 할 일 시간이에요`,icon:'icon-192.png'}); }catch{}
    }
  });
}
setInterval(checkTimeNotifications,30000);

// ── Dark mode ──
document.getElementById('darkBtn').onclick=()=>{
  const html=document.documentElement;
  const isDark=html.dataset.theme==='dark';
  html.dataset.theme=isDark?'light':'dark';
  document.getElementById('darkBtn').textContent=isDark?'🌙':'☀️';
  localStorage.setItem('theme',html.dataset.theme);
};
(()=>{const t=document.documentElement.dataset.theme||'light';document.getElementById('darkBtn').textContent=t==='dark'?'☀️':'🌙';})();

// ── Keyboard shortcuts ──
document.addEventListener('keydown',e=>{
  if(e.target.tagName==='INPUT'||e.target.tagName==='TEXTAREA') return;
  if(e.key==='ArrowLeft'){document.getElementById('prevBtn').click();}
  if(e.key==='ArrowRight'){document.getElementById('nextBtn').click();}
  if(e.key==='t'||e.key==='T'){document.getElementById('todayBtn').click();}
  if(e.key==='/'){e.preventDefault();document.getElementById('searchInput').focus();}
  if(e.key==='d'||e.key==='D'){document.getElementById('darkBtn').click();}
  if(e.key==='w'||e.key==='W'){document.getElementById('btnWeek').click();}
  if(e.key==='m'||e.key==='M'){document.getElementById('btnMonth').click();}
  if(e.key==='s'||e.key==='S'){document.getElementById('btnStats').click();}
  if(e.key==='Escape'){
    closeMemo();closeEdit();closeRepeatDel();closeDayModal();
    closeNoteHist();closeCanvas();closeSlashMenu();closeLightbox();
    settingsMenu.classList.add('hidden');
    notesMenu.classList.add('hidden');
    activeInput=null;searchQuery='';document.getElementById('searchInput').value='';render();
  }
});

// ═══════════════════════════════════════
// 스탠드얼론 메모장 v2 — 노션식 하위 뎁스 + 마크다운 + 슬래시 명령 + 이미지(로컬)
// ═══════════════════════════════════════
const MEMOS_KEY = USER_ID ? `calMemos_${USER_ID}` : 'calMemos';
let memoSaveTimer2 = null, pendingMemoLocal = false;
const NOTE_Z_BASE = 410; // 모달(500)·태스크메모(450)보다 아래
const NOTE_COLORS = [null, '#f9a825', '#1a73e8', '#43a047', '#e91e63', '#8e24aa'];
const noteEditState = {}; // memoId → true(편집 모드)

function memosFbRef() {
  return USER_ID && USER_ID !== 'demo' ? fbDb.ref(`users/${USER_ID}/memos`) : null;
}

function normalizeMemos(raw) {
  const out = {};
  Object.values(raw || {}).forEach(m => {
    if (!m || !m.id) return;
    out[m.id] = {
      id: m.id, title: m.title || '', text: m.text || '',
      parentId: m.parentId || null, open: !!m.open,
      x: typeof m.x === 'number' ? m.x : 80, y: typeof m.y === 'number' ? m.y : 120,
      w: typeof m.w === 'number' ? m.w : 300, h: typeof m.h === 'number' ? m.h : 280,
      z: typeof m.z === 'number' ? m.z : 0, created: m.created || Date.now(),
      color: m.color || null, pinned: !!m.pinned,
      cx: typeof m.cx === 'number' ? m.cx : null, cy: typeof m.cy === 'number' ? m.cy : null,
      hist: Array.isArray(m.hist) ? m.hist.filter(h => h && h.t).map(h => ({t: h.t, title: String(h.title||''), text: String(h.text||'')})) : [],
    };
  });
  // 부모가 삭제된 메모는 루트로 승격
  Object.values(out).forEach(m => { if (m.parentId && !out[m.parentId]) m.parentId = null; });
  return out;
}

let memos = (() => {
  try { return normalizeMemos(JSON.parse(localStorage.getItem(MEMOS_KEY) || '{}')); }
  catch { return {}; }
})();

function saveMemos() {
  if (READ_ONLY) return;
  localStorage.setItem(MEMOS_KEY, JSON.stringify(memos));
  const ref = memosFbRef();
  if (!ref) return;
  pendingMemoLocal = true;
  setSyncStatus('syncing');
  clearTimeout(memoSaveTimer2);
  memoSaveTimer2 = setTimeout(() => {
    memoSaveTimer2 = null;
    ref.set(memos)
      .then(() => { pendingMemoLocal = false; setSyncStatus('synced'); })
      .catch(() => setSyncStatus('offline'));
  }, 300);
}
window.addEventListener('pagehide', () => {
  if (memoSaveTimer2) {
    clearTimeout(memoSaveTimer2); memoSaveTimer2 = null;
    const ref = memosFbRef(); if (ref) ref.set(memos);
  }
});

function initMemoSync() {
  const ref = memosFbRef();
  if (!ref) return;
  ref.on('value', snap => {
    if (pendingMemoLocal) return;
    const remote = snap.val();
    if (remote && typeof remote === 'object') {
      memos = normalizeMemos(remote);
      localStorage.setItem(MEMOS_KEY, JSON.stringify(memos));
      renderNoteWins();
    }
  }, () => {});
}

function memoChildren(id) {
  return Object.values(memos).filter(m => m.parentId === id).sort((a,b) => a.created - b.created);
}
function memoRoots() {
  return Object.values(memos).filter(m => !m.parentId).sort((a,b) => a.created - b.created);
}
function memoLabel(m) { return m.title.trim() || (m.text.trim() ? m.text.trim().slice(0,18) : '제목 없음'); }

// ── 태그: #태그 추출 ──
function extractTags(m) {
  const out = new Set();
  const re = /(^|\s)#([\p{L}\d_]+)/gu;
  let match;
  const src = m.title + ' ' + m.text;
  while ((match = re.exec(src))) out.add(match[2]);
  return [...out];
}
function allNoteTags() {
  const counts = {};
  Object.values(memos).forEach(m => extractTags(m).forEach(t => { counts[t] = (counts[t]||0)+1; }));
  return Object.entries(counts).sort((a,b) => b[1]-a[1]);
}
let notesTagFilter = null;

// ── 이미지: IndexedDB 로컬 저장 (기기 간 동기화 안 됨) ──
let _idb = null;
function idbOpen() {
  if (!('indexedDB' in window) || !window.indexedDB) return Promise.resolve(null);
  if (_idb) return Promise.resolve(_idb);
  return new Promise(res => {
    const rq = indexedDB.open('calNotesImg', 1);
    rq.onupgradeneeded = () => rq.result.createObjectStore('img');
    rq.onsuccess = () => { _idb = rq.result; res(_idb); };
    rq.onerror = () => res(null);
  });
}
function idbPut(id, data) {
  return idbOpen().then(db => db && new Promise(res => {
    const tx = db.transaction('img','readwrite');
    tx.objectStore('img').put(data, id);
    tx.oncomplete = res; tx.onerror = res;
  }));
}
function idbGet(id) {
  return idbOpen().then(db => db ? new Promise(res => {
    const rq = db.transaction('img').objectStore('img').get(id);
    rq.onsuccess = () => res(rq.result || null);
    rq.onerror = () => res(null);
  }) : null);
}
function compressImage(file) {
  return new Promise(res => {
    const img = new Image();
    img.onload = () => {
      const max = 1280;
      let w = img.width, h = img.height;
      if (w > max) { h = Math.round(h*max/w); w = max; }
      const cv = document.createElement('canvas');
      cv.width = w; cv.height = h;
      cv.getContext('2d').drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(img.src);
      res(cv.toDataURL('image/jpeg', .82));
    };
    img.onerror = () => res(null);
    img.src = URL.createObjectURL(file);
  });
}
async function insertImageFile(m, ta, file) {
  if (READ_ONLY || !file) return;
  const dataUrl = await compressImage(file);
  if (!dataUrl) { showToast('⚠️ 이미지를 읽을 수 없어요'); return; }
  const id = uid();
  await idbPut(id, dataUrl);
  const tag = `![이미지](local:${id})`;
  const pos = ta.selectionStart;
  const pre = ta.value.slice(0, pos), post = ta.value.slice(pos);
  ta.value = pre + (pre && !pre.endsWith('\n') ? '\n' : '') + tag + '\n' + post;
  m.text = ta.value;
  saveMemos();
  showToast('🖼 이미지 첨부됨 (이 기기에만 저장)');
}

// ── 마크다운 렌더러 (HTML 이스케이프 후 안전한 토큰만 치환) ──
function escapeHtml(s) {
  return s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function mdInline(s) { // s는 이미 escape됨
  s = s.replace(/!\[([^\]]*)\]\(local:([a-z0-9]+)\)/g, '<img class="nv-img" data-img="$2" alt="$1">');
  s = s.replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>');
  s = s.replace(/(^|[^*])\*([^*\s][^*]*)\*/g, '$1<i>$2</i>');
  s = s.replace(/`([^`]+)`/g, '<code class="nv-code">$1</code>');
  s = s.replace(/(https?:\/\/[^\s<]+)/g, '<a class="nv-link" href="$1" target="_blank" rel="noopener noreferrer">$1</a>');
  s = s.replace(/@(\d{4}-\d{2}-\d{2})/g, '<button class="nv-date" data-date="$1">@$1</button>');
  s = s.replace(/@(\d{1,2}\/\d{1,2})/g, '<button class="nv-date" data-md="$1">@$1</button>');
  s = s.replace(/(^|\s)#([\p{L}\d_]+)/gu, '$1<span class="nv-tag" data-tag="$2">#$2</span>');
  return s;
}
function renderMarkdown(text) {
  const lines = text.split('\n');
  let html = '';
  lines.forEach((line, i) => {
    let m;
    if (/^---+\s*$/.test(line)) { html += '<hr class="nv-hr">'; return; }
    if ((m = line.match(/^(#{1,3})\s+(.+)/))) {
      html += `<div class="nv-h${m[1].length}">${mdInline(escapeHtml(m[2]))}</div>`; return;
    }
    if ((m = line.match(/^\s*\[( |x)\]\s?(.*)$/))) {
      const done = m[1] === 'x';
      html += `<button class="nv-check${done?' done':''}" data-line="${i}"><span class="nv-cb${done?' on':''}"></span><span class="nv-check-text">${mdInline(escapeHtml(m[2]))}</span></button>`;
      return;
    }
    if ((m = line.match(/^\s*-\s+(.+)/))) {
      html += `<div class="nv-li">•&nbsp;${mdInline(escapeHtml(m[1]))}</div>`; return;
    }
    if (line.trim() === '') { html += '<div class="nv-gap"></div>'; return; }
    html += `<div class="nv-p">${mdInline(escapeHtml(line))}</div>`;
  });
  return html || '<div class="nv-placeholder">클릭해서 작성... ( / 로 블록 삽입 )</div>';
}
// 체크리스트 라인 토글 (뷰 모드에서 클릭)
function toggleCheckLine(text, i) {
  const lines = text.split('\n');
  const m = lines[i] && lines[i].match(/^(\s*)\[( |x)\](.*)$/);
  if (!m) return text;
  lines[i] = `${m[1]}[${m[2]==='x' ? ' ' : 'x'}]${m[3]}`;
  return lines.join('\n');
}
function gotoDateMention(dateStr, mdStr) {
  let d = null;
  if (dateStr) d = parseDk(dateStr);
  else if (mdStr) {
    const [mo, da] = mdStr.split('/').map(Number);
    d = new Date(today().getFullYear(), mo-1, da);
  }
  if (!d || isNaN(d)) return;
  switchView('week');
  weekStart = getMonday(d);
  shouldAutoScroll = true;
  render();
}

// ── 버전 이력 ──
function snapshotMemo(m) {
  if (READ_ONLY) return;
  const last = m.hist[m.hist.length-1];
  if (last && last.text === m.text && last.title === m.title) return;
  if (!m.text.trim() && !m.title.trim()) return;
  m.hist.push({t: Date.now(), title: m.title, text: m.text});
  if (m.hist.length > 15) m.hist.shift();
}
let histCtx = null;
function openNoteHist(m) {
  histCtx = m.id;
  const list = document.getElementById('noteHistList');
  list.innerHTML = '';
  if (!m.hist.length) {
    list.appendChild(el('div','day-modal-empty',{textContent:'저장된 버전이 없습니다 (편집을 마치면 자동 기록)'}));
  }
  [...m.hist].reverse().forEach((h, ri) => {
    const idx = m.hist.length - 1 - ri;
    const row = el('div','hist-row');
    const d = new Date(h.t);
    const info = el('div','hist-info');
    info.appendChild(el('div','hist-time',{textContent:`${d.getMonth()+1}/${d.getDate()} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`}));
    info.appendChild(el('div','hist-preview',{textContent:(h.title?h.title+' — ':'')+h.text.slice(0,48).replace(/\n/g,' ')}));
    row.appendChild(info);
    if (!READ_ONLY) {
      const btn = el('button','btn-secondary',{textContent:'복원',style:'padding:4px 10px;font-size:11px'});
      btn.onclick = () => {
        const mm = memos[histCtx];
        if (!mm) return;
        snapshotMemo(mm); // 복원 전 현재 상태도 기록
        mm.title = m.hist[idx].title; mm.text = m.hist[idx].text;
        saveMemos(); closeNoteHist(); renderNoteWins();
        showToast('🕘 이전 버전으로 복원했어요');
      };
      row.appendChild(btn);
    }
    list.appendChild(row);
  });
  document.getElementById('noteHistModal').classList.remove('hidden');
}
function closeNoteHist() { document.getElementById('noteHistModal').classList.add('hidden'); histCtx = null; }
document.getElementById('noteHistClose').onclick = closeNoteHist;
document.getElementById('noteHistModal').onclick = e => { if (e.target === document.getElementById('noteHistModal')) closeNoteHist(); };

// ── 슬래시 명령 ──
const SLASH_ITEMS = [
  {icon:'H1', label:'제목 1', snippet:'# '},
  {icon:'H2', label:'제목 2', snippet:'## '},
  {icon:'☑', label:'체크리스트', snippet:'[ ] '},
  {icon:'•', label:'글머리 목록', snippet:'- '},
  {icon:'―', label:'구분선', snippet:'---\n'},
  {icon:'📅', label:'오늘 날짜', snippet:() => '@'+todayKey()+' '},
  {icon:'🖼', label:'이미지 첨부', action:'image'},
];
let slashCtx = null, slashSel = 0;
const slashMenu = document.getElementById('slashMenu');
function openSlashMenu(m, ta) {
  slashCtx = {m, ta, pos: ta.selectionStart};
  slashSel = 0;
  renderSlashMenu();
  // 캐럿 근처에 표시 (줄 수 기반 근사)
  const rect = ta.getBoundingClientRect();
  const lines = ta.value.slice(0, ta.selectionStart).split('\n').length;
  const lh = 21;
  let top = rect.top + Math.min(lines*lh - ta.scrollTop, rect.height - 10) + 6;
  let left = rect.left + 16;
  if (top + 240 > window.innerHeight) top = window.innerHeight - 250;
  slashMenu.style.top = top+'px';
  slashMenu.style.left = left+'px';
  slashMenu.classList.remove('hidden');
}
function renderSlashMenu() {
  slashMenu.innerHTML = '';
  SLASH_ITEMS.forEach((it, i) => {
    const row = el('button', `slash-item${i===slashSel?' sel':''}`);
    row.appendChild(el('span','slash-icon',{textContent:it.icon}));
    row.appendChild(el('span','',{textContent:it.label}));
    row.onmousedown = e => { e.preventDefault(); applySlash(i); };
    slashMenu.appendChild(row);
  });
}
function closeSlashMenu() { slashMenu.classList.add('hidden'); slashCtx = null; }
function applySlash(i) {
  if (!slashCtx) return;
  const {m, ta, pos} = slashCtx;
  const it = SLASH_ITEMS[i];
  // 입력했던 '/' 제거
  const pre = ta.value.slice(0, pos-1), post = ta.value.slice(pos);
  if (it.action === 'image') {
    ta.value = pre + post;
    m.text = ta.value; saveMemos();
    pendingImgTarget = {m, ta};
    document.getElementById('noteImgInput').click();
  } else {
    const snip = typeof it.snippet === 'function' ? it.snippet() : it.snippet;
    ta.value = pre + snip + post;
    const cur = pre.length + snip.length;
    ta.setSelectionRange(cur, cur);
    m.text = ta.value; saveMemos();
    ta.focus();
  }
  closeSlashMenu();
}
let pendingImgTarget = null;
document.getElementById('noteImgInput').addEventListener('change', async e => {
  const f = e.target.files[0];
  if (f && pendingImgTarget) {
    await insertImageFile(pendingImgTarget.m, pendingImgTarget.ta, f);
    renderNoteWins();
  }
  pendingImgTarget = null;
  e.target.value = '';
});

// ── 생성/삭제/탐색 ──
function createMemo(parentId, x, y) {
  if (READ_ONLY) return null;
  const id = uid();
  const n = Object.keys(memos).length;
  memos[id] = {
    id, title: '', text: '', parentId: parentId || null, open: true,
    x: x != null ? x : 90 + (n * 26) % 220,
    y: y != null ? y : 130 + (n * 22) % 160,
    w: 300, h: 280, z: 0, created: Date.now(),
    color: null, pinned: false, cx: null, cy: null, hist: [],
  };
  noteEditState[id] = true;
  bringNoteToFront(id);
  saveMemos(); renderNoteWins();
  const elw = noteWinEls[id];
  if (elw) setTimeout(() => { const t = elw.querySelector('.note-title-input'); if (t) t.focus(); }, 50);
  return id;
}

function deleteMemoTree(id) {
  if (READ_ONLY) return;
  const removed = {};
  (function collect(mid) {
    if (!memos[mid]) return;
    removed[mid] = memos[mid];
    memoChildren(mid).forEach(c => collect(c.id));
    delete memos[mid];
  })(id);
  saveMemos(); renderNoteWins();
  const cnt = Object.keys(removed).length;
  showToast(`메모 ${cnt}개 삭제됨`, () => {
    Object.assign(memos, removed);
    saveMemos(); renderNoteWins();
  });
}

// 같은 창 안에서 하위/상위 메모로 이동 (노션식 탐색) — 창 위치·크기를 물려줌
function navigateNote(fromId, toId) {
  const from = memos[fromId], to = memos[toId];
  if (!from || !to) return;
  snapshotMemo(from);
  to.x = from.x; to.y = from.y; to.w = from.w; to.h = from.h;
  from.open = false; to.open = true;
  bringNoteToFront(toId);
  saveMemos(); renderNoteWins();
}

function bringNoteToFront(id) {
  const t = memos[id]; if (!t) return;
  const others = Object.values(memos).filter(m => m.open && m.id !== id);
  const np = others.filter(m => !m.pinned).sort((a,b) => a.z-b.z);
  const pn = others.filter(m => m.pinned).sort((a,b) => a.z-b.z);
  // 📌 고정 메모는 항상 위
  const order = t.pinned ? [...np, ...pn, t] : [...np, t, ...pn];
  order.forEach((m, i) => { m.z = i; });
  Object.entries(noteWinEls).forEach(([mid, elw]) => {
    if (memos[mid]) elw.style.zIndex = NOTE_Z_BASE + memos[mid].z;
  });
}

const noteWinEls = {}; // memoId → 창 엘리먼트

function applyNoteColor(win, head, m) {
  if (m.color) {
    win.style.borderTop = `3px solid ${m.color}`;
    head.style.background = `color-mix(in srgb, ${m.color} 16%, var(--surface2))`;
  } else {
    win.style.borderTop = '';
    head.style.background = '';
  }
}

function buildNoteWin(m) {
  const win = el('div', 'note-win');
  win.style.left = m.x + 'px'; win.style.top = m.y + 'px';
  win.style.width = m.w + 'px'; win.style.height = m.h + 'px';
  win.style.zIndex = NOTE_Z_BASE + m.z;
  win.addEventListener('mousedown', () => bringNoteToFront(m.id));

  // ── 헤더 ──
  const head = el('div', 'note-head');
  applyNoteColor(win, head, m);
  if (m.parentId && memos[m.parentId]) {
    const crumb = el('button', 'note-crumb', {textContent: '‹ ' + memoLabel(memos[m.parentId]), title: '상위 메모로'});
    crumb.onclick = e => { e.stopPropagation(); navigateNote(m.id, m.parentId); };
    head.appendChild(crumb);
  } else {
    head.appendChild(el('span', 'memo-icon', {textContent: '📝'}));
  }
  const title = el('input', 'note-title-input');
  title.type = 'text'; title.placeholder = '제목'; title.value = m.title; title.readOnly = READ_ONLY;
  title.addEventListener('input', () => { m.title = title.value; saveMemos(); });
  head.appendChild(title);
  if (!READ_ONLY) {
    const colorBtn = el('button', 'note-btn', {textContent: '🎨', title: '색상 변경'});
    colorBtn.onclick = e => {
      e.stopPropagation();
      const i = NOTE_COLORS.indexOf(m.color);
      m.color = NOTE_COLORS[(i+1) % NOTE_COLORS.length];
      applyNoteColor(win, head, m);
      saveMemos();
    };
    head.appendChild(colorBtn);
    const pinBtn = el('button', `note-btn${m.pinned?' pinned':''}`, {textContent: '📌', title: m.pinned?'고정 해제':'항상 위 고정'});
    pinBtn.onclick = e => {
      e.stopPropagation();
      m.pinned = !m.pinned;
      pinBtn.classList.toggle('pinned', m.pinned);
      bringNoteToFront(m.id);
      saveMemos();
    };
    head.appendChild(pinBtn);
  }
  const histBtn = el('button', 'note-btn', {textContent: '🕘', title: '버전 이력'});
  histBtn.onclick = e => { e.stopPropagation(); openNoteHist(m); };
  head.appendChild(histBtn);
  if (!READ_ONLY) {
    const delBtn = el('button', 'note-btn del', {textContent: '🗑', title: '메모 삭제 (하위 포함)'});
    delBtn.onclick = e => { e.stopPropagation(); deleteMemoTree(m.id); };
    head.appendChild(delBtn);
  }
  const closeBtn = el('button', 'note-btn', {textContent: '✕', title: '닫기 (보관됨)'});
  closeBtn.setAttribute('aria-label', '메모 닫기');
  closeBtn.onclick = e => {
    e.stopPropagation();
    snapshotMemo(m);
    m.open = false;
    delete noteEditState[m.id];
    if (!READ_ONLY) saveMemos();
    renderNoteWins();
  };
  head.appendChild(closeBtn);
  win.appendChild(head);

  // 헤더 드래그로 이동 (모바일은 바텀시트라 비활성)
  head.addEventListener('mousedown', e => {
    if (window.innerWidth <= 768) return;
    if (e.target.closest('input,button,textarea')) return;
    e.preventDefault();
    const sx = e.clientX, sy = e.clientY, ox = win.offsetLeft, oy = win.offsetTop;
    const mv = ev => {
      let nx = ox + ev.clientX - sx, ny = oy + ev.clientY - sy;
      nx = Math.max(4, Math.min(nx, window.innerWidth - 80));
      ny = Math.max(4, Math.min(ny, window.innerHeight - 50));
      win.style.left = nx + 'px'; win.style.top = ny + 'px';
    };
    const up = () => {
      document.removeEventListener('mousemove', mv);
      document.removeEventListener('mouseup', up);
      m.x = win.offsetLeft; m.y = win.offsetTop;
      saveMemos();
    };
    document.addEventListener('mousemove', mv);
    document.addEventListener('mouseup', up);
  });

  // ── 본문: 뷰(렌더된 마크다운) ↔ 편집(textarea) ──
  const bodyWrap = el('div', 'note-body-wrap');
  win.appendChild(bodyWrap);
  renderNoteBody(m, bodyWrap, win, noteEditState[m.id] === true);

  // ── 하위 메모 목록 ──
  const kids = memoChildren(m.id);
  if (kids.length || !READ_ONLY) {
    const box = el('div', 'note-children');
    kids.forEach(c => {
      const row = el('div', 'note-child');
      row.appendChild(el('span', '', {textContent: '📄'}));
      row.appendChild(el('span', 'note-child-title', {textContent: memoLabel(c) + (memoChildren(c.id).length ? ` (${memoChildren(c.id).length})` : '')}));
      row.onclick = () => navigateNote(m.id, c.id);
      if (!READ_ONLY) {
        const d = el('button', 'note-btn del', {textContent: '✕', title: '하위 메모 삭제'});
        d.onclick = e => { e.stopPropagation(); deleteMemoTree(c.id); };
        row.appendChild(d);
      }
      box.appendChild(row);
    });
    if (!READ_ONLY) {
      const add = el('button', 'note-add-child', {textContent: '+ 하위 메모'});
      add.onclick = () => {
        const cid = createMemo(m.id);
        if (cid) navigateNote(m.id, cid);
      };
      box.appendChild(add);
    }
    win.appendChild(box);
  }

  // 이미지 드래그앤드롭 첨부
  if (!READ_ONLY) {
    win.addEventListener('dragover', e => {
      if ([...(e.dataTransfer?.types||[])].includes('Files')) e.preventDefault();
    });
    win.addEventListener('drop', async e => {
      const files = [...(e.dataTransfer?.files||[])].filter(f => f.type.startsWith('image/'));
      if (!files.length) return;
      e.preventDefault();
      noteEditState[m.id] = true;
      renderNoteBody(m, bodyWrap, win);
      const ta = bodyWrap.querySelector('.note-textarea');
      if (ta) {
        for (const f of files) await insertImageFile(m, ta, f);
        renderNoteWins();
      }
    });
  }

  // 리사이즈 추적 (CSS resize 핸들)
  if ('ResizeObserver' in window) {
    let roTimer = null;
    new ResizeObserver(() => {
      clearTimeout(roTimer);
      roTimer = setTimeout(() => {
        if (window.innerWidth <= 768) return;
        const w = win.offsetWidth, h = win.offsetHeight;
        if (w && h && (w !== m.w || h !== m.h)) { m.w = w; m.h = h; saveMemos(); }
      }, 250);
    }).observe(win);
  }
  return win;
}

function renderNoteBody(m, bodyWrap, win, focusEdit) {
  bodyWrap.innerHTML = '';
  const editing = !READ_ONLY && (noteEditState[m.id] || (!m.text.trim() && !memoChildren(m.id).length));
  if (editing) {
    const ta = el('textarea', 'note-textarea');
    ta.placeholder = '메모를 입력하세요...  ( / 입력 → 블록 메뉴, 이미지 붙여넣기 가능 )';
    ta.value = m.text;
    ta.addEventListener('input', () => {
      m.text = ta.value;
      saveMemos();
      // 슬래시 명령 감지: 줄 시작 또는 공백 뒤 '/'
      const pos = ta.selectionStart;
      if (ta.value[pos-1] === '/') {
        const before = ta.value.slice(0, pos-1);
        const lineStart = before.lastIndexOf('\n') + 1;
        if (/^\s*$/.test(before.slice(lineStart))) { openSlashMenu(m, ta); return; }
      }
      if (slashCtx) closeSlashMenu();
    });
    ta.addEventListener('keydown', e => {
      if (slashCtx) {
        if (e.key === 'ArrowDown') { e.preventDefault(); slashSel = (slashSel+1)%SLASH_ITEMS.length; renderSlashMenu(); return; }
        if (e.key === 'ArrowUp') { e.preventDefault(); slashSel = (slashSel-1+SLASH_ITEMS.length)%SLASH_ITEMS.length; renderSlashMenu(); return; }
        if (e.key === 'Enter') { e.preventDefault(); applySlash(slashSel); return; }
        if (e.key === 'Escape') { e.stopPropagation(); closeSlashMenu(); return; }
      }
      if (e.key === 'Escape') {
        e.stopPropagation();
        noteEditState[m.id] = false;
        snapshotMemo(m); saveMemos();
        renderNoteBody(m, bodyWrap, win);
      }
    });
    ta.addEventListener('blur', () => {
      setTimeout(() => {
        if (slashCtx && slashCtx.ta === ta) return; // 슬래시 메뉴 조작 중
        if (document.activeElement === ta) return;
        noteEditState[m.id] = false;
        snapshotMemo(m);
        if (!READ_ONLY) saveMemos();
        if (bodyWrap.isConnected) renderNoteBody(m, bodyWrap, win);
      }, 150);
    });
    ta.addEventListener('paste', e => {
      const items = [...(e.clipboardData?.items||[])].filter(i => i.type.startsWith('image/'));
      if (!items.length) return;
      e.preventDefault();
      (async () => {
        for (const it of items) await insertImageFile(m, ta, it.getAsFile());
        noteEditState[m.id] = true;
        renderNoteBody(m, bodyWrap, win, true);
      })();
    });
    bodyWrap.appendChild(ta);
    if (focusEdit) setTimeout(() => ta.focus(), 30);
  } else {
    const view = el('div', 'note-view');
    view.innerHTML = renderMarkdown(m.text);
    // 이미지 하이드레이션 (IndexedDB)
    view.querySelectorAll('img[data-img]').forEach(img => {
      idbGet(img.dataset.img).then(data => {
        if (data) { img.src = data; img.onclick = ev => { ev.stopPropagation(); openLightbox(data); }; }
        else { img.alt = '🖼 이미지는 첨부한 기기에서만 보여요'; img.classList.add('missing'); }
      });
    });
    view.addEventListener('click', e => {
      const cb = e.target.closest('.nv-check');
      if (cb) {
        e.stopPropagation();
        if (READ_ONLY) return;
        m.text = toggleCheckLine(m.text, Number(cb.dataset.line));
        saveMemos();
        renderNoteBody(m, bodyWrap, win);
        return;
      }
      const dateBtn = e.target.closest('.nv-date');
      if (dateBtn) { e.stopPropagation(); gotoDateMention(dateBtn.dataset.date, dateBtn.dataset.md); return; }
      const tag = e.target.closest('.nv-tag');
      if (tag) {
        e.stopPropagation();
        notesTagFilter = tag.dataset.tag;
        renderNotesMenu();
        notesMenu.classList.remove('hidden');
        return;
      }
      if (e.target.closest('a,img')) { e.stopPropagation(); return; }
      if (READ_ONLY) return;
      noteEditState[m.id] = true;
      renderNoteBody(m, bodyWrap, win, true);
    });
    bodyWrap.appendChild(view);
  }
}

function renderNoteWins() {
  Object.keys(noteWinEls).forEach(id => {
    noteWinEls[id].remove();
    delete noteWinEls[id];
  });
  Object.values(memos).filter(m => m.open).forEach(m => {
    const win = buildNoteWin(m);
    noteWinEls[m.id] = win;
    document.body.appendChild(win);
  });
}

// ── 빈 영역 더블클릭 → 그 자리에 새 메모 ──
document.addEventListener('dblclick', e => {
  if (READ_ONLY) return;
  const t = e.target;
  const blank = t === document.body || t.id === 'mainView' ||
    (t.classList && ['calendar-wrap','calendar-grid','month-wrap','month-grid','stats-wrap','search-results-wrap'].some(c => t.classList.contains(c)));
  if (!blank) return;
  const x = Math.min(e.clientX - 16, window.innerWidth - 320);
  const y = Math.min(e.clientY - 12, window.innerHeight - 300);
  createMemo(null, Math.max(4, x), Math.max(4, y));
});

// ── 마크다운 내보내기 (노션 임포트 호환) ──
function notesToMarkdown() {
  let md = '';
  const walk = (m, depth) => {
    md += `${'#'.repeat(Math.min(depth, 6))} ${memoLabel(m)}\n\n`;
    if (m.text.trim()) {
      md += m.text.replace(/!\[([^\]]*)\]\(local:[a-z0-9]+\)/g, '*[$1 — 로컬 이미지 첨부]*') + '\n\n';
    }
    memoChildren(m.id).forEach(c => walk(c, depth+1));
  };
  memoRoots().forEach(r => walk(r, 1));
  return md;
}
function exportNotesMd() {
  const md = notesToMarkdown();
  if (!md.trim()) { showToast('내보낼 메모가 없어요'); return; }
  const blob = new Blob([md], {type:'text/markdown'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `notes-${USER_ID||'local'}-${todayKey()}.md`;
  a.click();
  URL.revokeObjectURL(a.href);
  showToast('📤 마크다운 파일을 다운로드했어요');
}

// ── 🗺 캔버스 모드 (화이트보드: 자유 배치 + 부모-자식 연결선) ──
let canvasPan = {x: 0, y: 0};
function ensureCanvasCoords() {
  let rootIdx = 0;
  const place = (m, depth, slot) => {
    if (m.cx == null || m.cy == null) {
      m.cx = 60 + slot * 250 + depth * 40;
      m.cy = 80 + depth * 150;
    }
    memoChildren(m.id).forEach((c, i) => place(c, depth+1, slot + i));
  };
  memoRoots().forEach(r => { place(r, 0, rootIdx); rootIdx += Math.max(1, memoChildren(r.id).length); });
}
function openCanvas() {
  ensureCanvasCoords();
  document.getElementById('canvasOverlay').classList.remove('hidden');
  renderCanvas();
}
function closeCanvas() { document.getElementById('canvasOverlay').classList.add('hidden'); }
document.getElementById('canvasClose').onclick = closeCanvas;
function renderCanvas() {
  const board = document.getElementById('canvasBoard');
  board.innerHTML = '';
  const svgNS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(svgNS, 'svg');
  svg.setAttribute('class', 'canvas-lines');
  board.appendChild(svg);
  const CARD_W = 190, CARD_H = 40;
  const drawLines = () => {
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    Object.values(memos).forEach(m => {
      if (!m.parentId || !memos[m.parentId]) return;
      const p = memos[m.parentId];
      const line = document.createElementNS(svgNS, 'line');
      line.setAttribute('x1', p.cx + CARD_W/2 + canvasPan.x);
      line.setAttribute('y1', p.cy + CARD_H + canvasPan.y);
      line.setAttribute('x2', m.cx + CARD_W/2 + canvasPan.x);
      line.setAttribute('y2', m.cy + canvasPan.y);
      line.setAttribute('class', 'canvas-line');
      svg.appendChild(line);
    });
  };
  drawLines();
  Object.values(memos).forEach(m => {
    const card = el('div', 'canvas-card');
    card.style.left = (m.cx + canvasPan.x) + 'px';
    card.style.top = (m.cy + canvasPan.y) + 'px';
    if (m.color) card.style.borderLeft = `4px solid ${m.color}`;
    card.appendChild(el('div', 'canvas-card-title', {textContent: (m.pinned?'📌 ':'') + memoLabel(m)}));
    const preview = m.text.trim().replace(/\n/g,' ').slice(0, 36);
    if (preview) card.appendChild(el('div', 'canvas-card-preview', {textContent: preview}));
    const tags = extractTags(m);
    if (tags.length) card.appendChild(el('div', 'canvas-card-tags', {textContent: tags.map(t=>'#'+t).join(' ')}));
    // 드래그 재배치
    card.addEventListener('mousedown', e => {
      e.preventDefault(); e.stopPropagation();
      const sx = e.clientX, sy = e.clientY, ox = m.cx, oy = m.cy;
      const mv = ev => {
        m.cx = ox + ev.clientX - sx; m.cy = oy + ev.clientY - sy;
        card.style.left = (m.cx + canvasPan.x) + 'px';
        card.style.top = (m.cy + canvasPan.y) + 'px';
        drawLines();
      };
      const up = () => {
        document.removeEventListener('mousemove', mv);
        document.removeEventListener('mouseup', up);
        if (!READ_ONLY) saveMemos();
      };
      document.addEventListener('mousemove', mv);
      document.addEventListener('mouseup', up);
    });
    card.addEventListener('dblclick', e => {
      e.stopPropagation();
      m.open = true;
      bringNoteToFront(m.id);
      if (!READ_ONLY) saveMemos();
      closeCanvas();
      renderNoteWins();
    });
    board.appendChild(card);
  });
  if (!Object.keys(memos).length) {
    board.appendChild(el('div', 'canvas-empty', {textContent: '메모가 없습니다 — 캘린더 빈 곳을 더블클릭해 만들어보세요'}));
  }
  // 배경 드래그로 팬
  board.onmousedown = e => {
    if (e.target !== board && e.target !== svg) return;
    const sx = e.clientX, sy = e.clientY, ox = canvasPan.x, oy = canvasPan.y;
    const mv = ev => { canvasPan.x = ox + ev.clientX - sx; canvasPan.y = oy + ev.clientY - sy; renderCanvas(); };
    const up = () => { document.removeEventListener('mousemove', mv); document.removeEventListener('mouseup', up); };
    document.addEventListener('mousemove', mv);
    document.addEventListener('mouseup', up);
  };
}

// ── 📝 메모 보관함 메뉴 ──
const notesMenu = document.getElementById('notesMenu');
function renderNotesMenu() {
  notesMenu.innerHTML = '';
  if (!READ_ONLY) {
    const add = el('button', 'settings-item', {textContent: '➕ 새 메모'});
    add.setAttribute('role', 'menuitem');
    add.onclick = () => { notesMenu.classList.add('hidden'); createMemo(null); };
    notesMenu.appendChild(add);
  }
  const canvasBtn = el('button', 'settings-item', {textContent: '🗺 캔버스 보기 (전체 배치)'});
  canvasBtn.setAttribute('role', 'menuitem');
  canvasBtn.onclick = () => { notesMenu.classList.add('hidden'); openCanvas(); };
  notesMenu.appendChild(canvasBtn);
  const mdBtn = el('button', 'settings-item', {textContent: '📤 마크다운 내보내기'});
  mdBtn.setAttribute('role', 'menuitem');
  mdBtn.onclick = () => { notesMenu.classList.add('hidden'); exportNotesMd(); };
  notesMenu.appendChild(mdBtn);
  // 태그 필터 칩
  const tags = allNoteTags();
  if (tags.length) {
    const chips = el('div', 'notes-tag-chips');
    tags.slice(0, 12).forEach(([tag, cnt]) => {
      const chip = el('button', `notes-tag-chip${notesTagFilter===tag?' active':''}`, {textContent:`#${tag} ${cnt}`});
      chip.onclick = e => {
        e.stopPropagation();
        notesTagFilter = notesTagFilter === tag ? null : tag;
        renderNotesMenu();
      };
      chips.appendChild(chip);
    });
    notesMenu.appendChild(chips);
  } else {
    notesTagFilter = null;
  }
  // 메모 목록 (태그 필터 적용: 본인 또는 자손이 태그 보유 시 표시)
  const hasTagDeep = (m, tag) => extractTags(m).includes(tag) || memoChildren(m.id).some(c => hasTagDeep(c, tag));
  const roots = memoRoots().filter(m => !notesTagFilter || hasTagDeep(m, notesTagFilter));
  if (!roots.length) {
    notesMenu.appendChild(el('div', 'settings-item', {textContent: notesTagFilter ? '이 태그의 메모 없음' : '메모 없음 — 빈 곳을 더블클릭해 만들 수 있어요', style: 'cursor:default;color:var(--text3);font-size:11px'}));
  }
  roots.forEach(m => {
    const item = el('button', 'settings-item');
    item.setAttribute('role', 'menuitem');
    const kidCnt = memoChildren(m.id).length;
    item.textContent = `${m.open ? '🟢' : '📄'} ${m.pinned?'📌 ':''}${memoLabel(m)}${kidCnt ? ` (${kidCnt})` : ''}`;
    item.onclick = () => {
      notesMenu.classList.add('hidden');
      m.open = true;
      bringNoteToFront(m.id);
      if (!READ_ONLY) saveMemos();
      renderNoteWins();
    };
    notesMenu.appendChild(item);
  });
}
document.getElementById('notesBtn').onclick = e => {
  e.stopPropagation();
  settingsMenu.classList.add('hidden');
  renderNotesMenu();
  notesMenu.classList.toggle('hidden');
};
document.addEventListener('click', e => {
  if (!notesMenu.classList.contains('hidden') && !e.target.closest('.settings-wrap'))
    notesMenu.classList.add('hidden');
  if (slashCtx && !e.target.closest('#slashMenu') && !e.target.closest('.note-textarea'))
    closeSlashMenu();
});

// ── PWA service worker ──
if('serviceWorker' in navigator && location.protocol.startsWith('http')){
  window.addEventListener('load',()=>{
    navigator.serviceWorker.register('sw.js').catch(()=>{});
  });
}

// ── Init ──
render();
renderNoteWins();
fetchWeather(weatherLoc.lat,weatherLoc.lon);
initFirebaseSync();
initMemoSync();
