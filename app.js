// ── Firebase ──
const FB_CONFIG = {
  apiKey: "AIzaSyC4u_IF5_UMygKI8JGt88P1yQFJg9rbSt0",
  authDomain: "my-calendar-1a589.firebaseapp.com",
  databaseURL: "https://my-calendar-1a589-default-rtdb.firebaseio.com",
  projectId: "my-calendar-1a589",
  storageBucket: "my-calendar-1a589.firebasestorage.app",
  messagingSenderId: "75434783601",
  appId: "1:75434783601:web:9144bb9f91f90aa4ab3cd0"
};
let fbDb = null;
let fbSaveTimer = null;
try {
  firebase.initializeApp(FB_CONFIG);
  fbDb = firebase.database();
} catch(e) { console.warn('Firebase 초기화 실패:', e); setTimeout(()=>setSyncStatus('local'),500); }

function setSyncStatus(s) {
  const dot = document.getElementById('syncDot');
  if (!dot) return;
  dot.className = 'sync-dot ' + s;
  dot.title = s === 'synced' ? '✅ 동기화됨' : s === 'syncing' ? '🔄 동기화 중...' : s === 'local' ? '💾 로컬 저장' : '❌ 오프라인 (로컬 저장됨)';
}

function fbRef() {
  return fbDb && FB_UID && USER_ID !== 'demo' ? fbDb.ref(`users/${FB_UID}/tasks`) : null;
}

// ── Constants ──
const DAY_NAMES = ['월','화','수','목','금','토','일'];
const COLORS = [
  {hex:'#1a73e8',name:'파랑'},{hex:'#e53935',name:'빨강'},{hex:'#f9a825',name:'노랑'},
  {hex:'#43a047',name:'초록'},{hex:'#8e24aa',name:'보라'},{hex:'#fb8c00',name:'주황'},
  {hex:'#607d8b',name:'회색'},
];
const WMO = {0:'☀️',1:'🌤️',2:'⛅',3:'☁️',45:'🌫️',48:'🌫️',51:'🌦️',53:'🌦️',55:'🌦️',61:'🌧️',63:'🌧️',65:'🌧️',71:'❄️',73:'❄️',75:'❄️',77:'🌨️',80:'🌦️',81:'🌦️',82:'🌦️',85:'❄️',86:'❄️',95:'⛈️',96:'⛈️',99:'⛈️'};
const WMO_D = {0:'맑음',1:'구름조금',2:'구름많음',3:'흐림',45:'안개',48:'안개',51:'이슬비',53:'이슬비',55:'이슬비',61:'비',63:'비',65:'강한비',71:'눈',73:'눈',75:'강한눈',77:'싸락눈',80:'소나기',81:'소나기',82:'강한소나기',85:'눈소나기',86:'눈소나기',95:'뇌우',96:'뇌우',99:'뇌우'};

// ── 2026 공휴일 (대체공휴일 포함) ──
const HOLIDAYS = {
  '2026-01-01': '신정',
  '2026-02-16': '설날 연휴',
  '2026-02-17': '설날',
  '2026-02-18': '설날 연휴',
  '2026-03-01': '삼일절',
  '2026-03-02': '삼일절 대체공휴일',   // 3/1 일요일
  '2026-05-01': '근로자의 날',
  '2026-05-05': '어린이날',
  '2026-05-24': '부처님오신날',
  '2026-05-25': '부처님오신날 대체공휴일', // 5/24 일요일
  '2026-06-06': '현충일',
  '2026-08-15': '광복절',
  '2026-08-17': '광복절 대체공휴일',    // 8/15 토요일
  '2026-09-24': '추석 연휴',
  '2026-09-25': '추석',
  '2026-09-26': '추석 연휴',
  '2026-09-28': '추석 대체공휴일',      // 9/26 토요일
  '2026-10-03': '개천절',
  '2026-10-05': '개천절 대체공휴일',    // 10/3 토요일
  '2026-10-09': '한글날',
  '2026-12-25': '성탄절',
  '2027-01-01': '신정',
  '2027-02-05': '설날 연휴',
  '2027-02-06': '설날',
  '2027-02-07': '설날 연휴',
  '2027-02-08': '설날 대체공휴일',
  '2027-03-01': '삼일절',
  '2027-05-01': '근로자의 날',
  '2027-05-05': '어린이날',
  '2027-05-13': '부처님오신날',
  '2027-06-06': '현충일',
  '2027-08-15': '광복절',
  '2027-08-16': '광복절 대체공휴일',
  '2027-09-14': '추석 연휴',
  '2027-09-15': '추석',
  '2027-09-16': '추석 연휴',
  '2027-10-03': '개천절',
  '2027-10-04': '개천절 대체공휴일',
  '2027-10-09': '한글날',
  '2027-10-11': '한글날 대체공휴일',
  '2027-12-25': '성탄절',
  '2027-12-27': '성탄절 대체공휴일',
};
function isHoliday(dk) { return !!HOLIDAYS[dk]; }
function isRestDay(date) {
  const day = date.getDay();
  return day === 0 || day === 6 || isHoliday(dateKey(date)) || !!offDays[dateKey(date)];
}
// 공휴일/수동휴무만(주말 제외) — 주간/격주는 지정 요일이 의도된 선택이라 주말엔 안 밀고 '휴일'에만 민다
function isHolidayShift(date) { const dk = dateKey(date); return isHoliday(dk) || !!offDays[dk]; }
// 휴일이면 다음 평일로 이동 (date 포함 — date가 휴일이면 다음 영업일 반환)
function nextWorkday(date) {
  let d = new Date(date);
  let guard = 0;
  while (isRestDay(d) && guard++ < 366) d.setDate(d.getDate() + 1);
  return d;
}
// 날짜지정형 반복(주/매월/N째주)의 원본일이 휴일이면 '다음 영업일'로 밀려 표시되므로,
// 원본 날짜(저장 위치)에는 표시하지 않음(중복 방지). 격주·첫/말영업일은 원본일이 발생일이 아니라 제외.
function isDisplacedRecurringOrigin(t, dk) {
  if (!t) return false;
  if (t.repeat === 'monthly' || t.repeat === 'monthlyNth') return isRestDay(parseDk(dk));
  if (t.repeat === 'weekly') return isHolidayShift(parseDk(dk)); // 주간 원본이 공휴일/휴무일이면 다음 영업일로
  return false;
}
// 해당 날짜에 '저장된' 태스크 중 화면에 보일 것 (휴일로 밀린 반복 원본 제외)
function visibleStored(dk) {
  return (tasks[dk] || []).filter(t => !isDisplacedRecurringOrigin(t, dk));
}
// 해당 날짜에 표시할 태스크 항목 통합(저장 + 반복 인스턴스) — 저장→반복 순.
// visibleStored와 getRepeatTasksForDate를 항상 짝지어 호출(누락으로 인한 중복/누락 버그 방지).
function tasksForDate(date, dayIdx) {
  const dk = dateKey(date);
  const out = [];
  visibleStored(dk).forEach(t => {
    if (t && !(t.repeat && t.repeat !== 'none' && t.skips && t.skips[dk]))
      out.push({ task: t, isRepeat: false, originDk: null, instanceDk: null, adjusted: false });
  });
  getRepeatTasksForDate(date, dayIdx).forEach(e =>
    out.push({ task: e.task, isRepeat: true, originDk: e.originDk, instanceDk: e.instanceDk, adjusted: !!e.adjusted }));
  return out;
}
// 해당 월의 첫/마지막 영업일
function firstBizDay(year, month) {
  let d = new Date(year, month, 1), g = 0;
  while (isRestDay(d) && g++ < 20) d.setDate(d.getDate() + 1);
  return d;
}
function lastBizDay(year, month) {
  let d = new Date(year, month + 1, 0), g = 0;
  while (isRestDay(d) && g++ < 20) d.setDate(d.getDate() - 1);
  return d;
}

// ── Seed data ──
const SEED_TASKS = {
  '2026-03-30':[{id:'s001',text:'오전) 개인화 검수',starred:true,checked:false,color:null,repeat:'none',completions:{},subs:[{id:'s001a',text:'재방_7시반 이자벨마랑&뻐두',checked:false,starred:false,color:null,subs:[]}]}],
  '2026-03-31':[{id:'s002',text:'첫구매런 > 앱푸쉬',starred:true,checked:false,color:null,repeat:'none',completions:{},subs:[]},{id:'s003',text:'최종 기획전 검토',starred:false,checked:false,color:null,repeat:'none',completions:{},subs:[]},{id:'s004',text:'전관행사 쿠폰 및 연결',starred:false,checked:false,color:null,repeat:'none',completions:{},subs:[]},{id:'s005',text:'퇴근 전 결재',starred:false,checked:false,color:null,repeat:'none',completions:{},subs:[]}],
  '2026-04-01':[{id:'s006',text:'첫구매런 > 앱푸쉬',starred:true,checked:false,color:null,repeat:'none',completions:{},subs:[]},{id:'s007',text:'웰컴 4월 문서변경',starred:false,checked:true,color:null,repeat:'none',completions:{},subs:[]},{id:'s008',text:'전관행사 쿠폰 생성 및 연결',starred:false,checked:true,color:null,repeat:'none',completions:{},subs:[]},{id:'s009',text:'기획전 검토',starred:false,checked:true,color:null,repeat:'none',completions:{},subs:[]}],
  '2026-04-02':[{id:'s010',text:'오전) 개인화 검수',starred:true,checked:false,color:null,repeat:'none',completions:{},subs:[{id:'s010a',text:'오픈예정3건',checked:false,starred:false,color:null,subs:[]}]},{id:'s011',text:'출석체크 푸쉬 취합',starred:false,checked:true,color:null,repeat:'none',completions:{},subs:[]}],
  '2026-04-03':[{id:'s012',text:'첫구매런 페이지 검수',starred:true,checked:false,color:null,repeat:'none',completions:{},subs:[]},{id:'s013',text:'전관행사 쿠폰 및 세팅',starred:false,checked:true,color:null,repeat:'none',completions:{},subs:[{id:'s013a',text:'앨페스타',checked:true,starred:false,color:null,subs:[]}]}],
  '2026-04-06':[{id:'s014',text:'7시반_재방_헤지스/닥스골프',starred:false,checked:false,color:null,repeat:'none',completions:{},subs:[{id:'s014a',text:'퇴근 전 결재',checked:false,starred:false,color:null,subs:[]}]},{id:'s015',text:'5월 웰컴 쿠폰 생성>미승인',starred:false,checked:true,color:null,repeat:'none',completions:{},subs:[]},{id:'s016',text:'웰컴>유의사항&카운트 수정',starred:false,checked:true,color:null,repeat:'none',completions:{},subs:[]},{id:'s017',text:'앨페스타 문구 수정',starred:false,checked:true,color:null,repeat:'none',completions:{},subs:[]}],
  '2026-04-07':[{id:'s018',text:'오전) 개인화 검수',starred:true,checked:false,color:null,repeat:'none',completions:{},subs:[{id:'s018a',text:'7시반 본방',checked:false,starred:false,color:null,subs:[]},{id:'s018b',text:'퇴근 전 결재',checked:false,starred:false,color:null,subs:[]}]}],
  '2026-04-08':[{id:'s019',text:'첫구매런 > 앱푸쉬',starred:true,checked:false,color:null,repeat:'none',completions:{},subs:[{id:'s019a',text:'7시반 본방',checked:false,starred:false,color:null,subs:[]}]},{id:'s020',text:'레스타 알림 문자 발송 → 12시 발송',starred:false,checked:true,color:null,repeat:'none',completions:{},subs:[{id:'s020a',text:'11시 결재',checked:true,starred:false,color:null,subs:[]}]},{id:'s021',text:'웰컴 디자인 요청',starred:false,checked:true,color:null,repeat:'none',completions:{},subs:[]},{id:'s022',text:'첫구매런 할인 취합 요청 > (목)까지',starred:false,checked:true,color:null,repeat:'none',completions:{},subs:[]},{id:'s023',text:'메일 세팅(자주 필요일까지)',starred:false,checked:true,color:null,repeat:'none',completions:{},subs:[]},{id:'s024',text:'마일리지지급_4/9일세팅',starred:false,checked:true,color:null,repeat:'none',completions:{},subs:[]},{id:'s025',text:'거래선코드',starred:false,checked:true,color:null,repeat:'none',completions:{},subs:[]}],
  '2026-04-09':[{id:'s026',text:'오전) 개인화 검수',starred:true,checked:false,color:null,repeat:'none',completions:{},subs:[{id:'s026a',text:'오픈예정3건',checked:false,starred:false,color:null,subs:[]},{id:'s026b',text:'7시반_재방',checked:false,starred:false,color:null,subs:[]}]},{id:'s027',text:'10시 웰컴 페이지 확인',starred:false,checked:true,color:null,repeat:'none',completions:{},subs:[]},{id:'s028',text:'첫구매런 앱푸쉬 취합',starred:false,checked:true,color:null,repeat:'none',completions:{},subs:[]},{id:'s029',text:'111214 >> LMS 지원요청',starred:false,checked:true,color:null,repeat:'none',completions:{},subs:[]},{id:'s030',text:'기획전 오픈X',starred:false,checked:true,color:null,repeat:'none',completions:{},subs:[]},{id:'s031',text:'AP-260402579 > 마일리지지급',starred:false,checked:true,color:null,repeat:'none',completions:{},subs:[]}],
  '2026-04-10':[{id:'s032',text:'첫구매런 페이지 검수',starred:true,checked:false,color:null,repeat:'none',completions:{},subs:[{id:'s032a',text:'11시 재방_(빈스/바쉬/뻐두)',checked:false,starred:false,color:null,subs:[]}]},{id:'s033',text:'출석체크 참여자 추출',starred:false,checked:true,color:null,repeat:'none',completions:{},subs:[]},{id:'s034',text:'출석체크 쿠폰 생성',starred:false,checked:true,color:null,repeat:'none',completions:{},subs:[]},{id:'s035',text:'오후) CR 쿠폰 생성',starred:false,checked:true,color:null,repeat:'none',completions:{},subs:[]},{id:'s036',text:'오후) 첫구매_장바구니보유_SMS',starred:false,checked:false,color:null,repeat:'none',completions:{},subs:[{id:'s036a',text:'모수 26,000명으로 추후 발송',checked:false,starred:false,color:null,subs:[]}]},{id:'s037',text:'오후) 출석체크 쿠폰 발급요청 > LMS 발송',starred:false,checked:true,color:null,repeat:'none',completions:{},subs:[]},{id:'s038',text:'5월출석체크/친구초대 원스피어 세팅 완료',starred:false,checked:true,color:null,repeat:'none',completions:{},subs:[]}],
  '2026-04-13':[{id:'s039',text:'7시반_재방',starred:false,checked:false,color:null,repeat:'none',completions:{},subs:[{id:'s039a',text:'퇴근 후 결재',checked:false,starred:false,color:null,subs:[]}]},{id:'s040',text:'CR개선 1차_최용남팀장님',starred:false,checked:true,color:null,repeat:'none',completions:{},subs:[{id:'s040a',text:'소문내기 참여자 추출',checked:true,starred:false,color:null,subs:[]},{id:'s040b',text:'장성우 > 파일 전달·받기',checked:true,starred:false,color:null,subs:[]}]}],
  '2026-04-14':[{id:'s041',text:'오전) 개인화 검수',starred:true,checked:false,color:null,repeat:'none',completions:{},subs:[{id:'s041a',text:'7시반_본방',checked:false,starred:false,color:null,subs:[]},{id:'s041b',text:'퇴근 전 결재',checked:false,starred:false,color:null,subs:[]}]}],
  '2026-04-15':[{id:'s042',text:'첫구매런 > 앱푸쉬',starred:true,checked:false,color:null,repeat:'none',completions:{},subs:[{id:'s042a',text:'7시반 본방',checked:false,starred:false,color:null,subs:[]},{id:'s042b',text:'퇴근 전 결재',checked:false,starred:false,color:null,subs:[]}]},{id:'s043',text:'소문내기 마일리지 지급',starred:false,checked:true,color:null,repeat:'none',completions:{},subs:[{id:'s043a',text:'그름발송 추가 후 결재(2시)',checked:true,starred:false,color:null,subs:[]}]},{id:'s044',text:'메일 세팅(자주 필요일까지)',starred:false,checked:true,color:null,repeat:'none',completions:{},subs:[]},{id:'s045',text:'5월 기획전 배너 세팅',starred:false,checked:true,color:null,repeat:'none',completions:{},subs:[]},{id:'s046',text:'전관행사 쿠폰 생성 및 세팅',starred:false,checked:true,color:null,repeat:'none',completions:{},subs:[]}],
  '2026-04-16':[{id:'s047',text:'오전) 개인화 검수 > 오픈예정3건',starred:true,checked:false,color:null,repeat:'none',completions:{},subs:[{id:'s047a',text:'7시반_재방',checked:false,starred:false,color:null,subs:[]},{id:'s047b',text:'퇴근 전 결재',checked:false,starred:false,color:null,subs:[]}]},{id:'s048',text:'익일 11시 재방 세팅 해야함',starred:false,checked:true,color:null,repeat:'none',completions:{},subs:[]},{id:'s049',text:'전관행사 확인 후 상품세팅',starred:false,checked:false,color:null,repeat:'none',completions:{},subs:[]},{id:'s050',text:'소문내기/친구초대 상품 변경',starred:false,checked:true,color:null,repeat:'none',completions:{},subs:[]},{id:'s051',text:'첫구매_장바구니보유_SMS',starred:false,checked:true,color:null,repeat:'none',completions:{},subs:[{id:'s051a',text:'1시쯤 결재',checked:true,starred:false,color:null,subs:[]}]}],
  '2026-04-17':[{id:'s052',text:'첫구매런 페이지 검수',starred:true,checked:false,color:null,repeat:'none',completions:{},subs:[{id:'s052a',text:'11시_재방',checked:false,starred:false,color:null,subs:[]}]},{id:'s053',text:'전시휴무',starred:false,checked:false,color:'#e53935',repeat:'none',completions:{},subs:[]}],
  '2026-04-20':[{id:'s054',text:'연차',starred:false,checked:false,color:'#fb8c00',repeat:'none',completions:{},subs:[]}],
  '2026-04-21':[{id:'s055',text:'오전) 개인화 검수',starred:true,checked:false,color:null,repeat:'none',completions:{},subs:[{id:'s055a',text:'7시반본방',checked:false,starred:false,color:null,subs:[]}]}],
  '2026-04-22':[{id:'s056',text:'첫구매런 > 앱푸쉬',starred:true,checked:false,color:null,repeat:'none',completions:{},subs:[{id:'s056a',text:'7시반본방',checked:false,starred:false,color:null,subs:[]}]},{id:'s057',text:'소문내기/친구초대 지라요청',starred:false,checked:true,color:null,repeat:'none',completions:{},subs:[]},{id:'s058',text:'캠페인 (첫구매/친구매런)',starred:false,checked:true,color:null,repeat:'none',completions:{},subs:[]},{id:'s059',text:'웰컴 5월 공동 코드 등록요청',starred:false,checked:true,color:null,repeat:'none',completions:{},subs:[{id:'s059a',text:'지라요청',checked:true,starred:false,color:null,subs:[]}]}],
  '2026-04-23':[{id:'s060',text:'오전) 개인화 검수',starred:true,checked:false,color:null,repeat:'none',completions:{},subs:[{id:'s060a',text:'오픈예정3건',checked:false,starred:false,color:null,subs:[]},{id:'s060b',text:'7시반본방',checked:false,starred:false,color:null,subs:[]},{id:'s060c',text:'퇴근 전 결재',checked:false,starred:false,color:null,subs:[]}]},{id:'s061',text:'개인화 오픈일정 안내',starred:false,checked:true,color:null,repeat:'none',completions:{},subs:[]}],
  '2026-04-24':[{id:'s062',text:'첫구매런 페이지 검수',starred:true,checked:false,color:null,repeat:'none',completions:{},subs:[]},{id:'s063',text:'비용품의 작성(출석체크/친구초대/상품공구)',starred:false,checked:true,color:null,repeat:'none',completions:{},subs:[]},{id:'s064',text:'CR 쿠폰생성(승인완료)',starred:false,checked:true,color:null,repeat:'none',completions:{},subs:[]},{id:'s065',text:'첫구매 리텐션 (인수인계)',starred:false,checked:true,color:null,repeat:'none',completions:{},subs:[{id:'s065a',text:'주문쿠폰 이달 리텐션',checked:true,starred:false,color:null,subs:[]},{id:'s065b',text:'할인쿠폰 생성 후 LMS 발송',checked:true,starred:false,color:null,subs:[]}]},{id:'s066',text:'16시 > 아울렛',starred:false,checked:true,color:null,repeat:'none',completions:{},subs:[{id:'s066a',text:'15시 결재',checked:true,starred:false,color:null,subs:[]}]}],
  '2026-04-27':[{id:'s067',text:'7시반본방 > 닥스',starred:false,checked:false,color:null,repeat:'none',completions:{},subs:[]},{id:'s068',text:'CR개선 2차 > 9시에 새로고침',starred:false,checked:true,color:null,repeat:'none',completions:{},subs:[]},{id:'s069',text:'10시 웰컴 기획전 확인',starred:false,checked:true,color:null,repeat:'none',completions:{},subs:[]},{id:'s070',text:'전관행사 쿠폰 세팅',starred:false,checked:false,color:null,repeat:'none',completions:{},subs:[]},{id:'s071',text:'메시지_전표',starred:false,checked:false,color:null,repeat:'none',completions:{},subs:[]},{id:'s072',text:'비용품의 작성(웰컴/CR/정기리텐션)',starred:false,checked:true,color:null,repeat:'none',completions:{},subs:[]},{id:'s073',text:'시크릿혜택 기획전 세팅',starred:false,checked:true,color:null,repeat:'none',completions:{},subs:[{id:'s073a',text:'쿠폰/마일리지/e마일리지',checked:true,starred:false,color:null,subs:[]}]}],
  '2026-04-28':[{id:'s074',text:'오전) 개인화 검수',starred:true,checked:false,color:null,repeat:'none',completions:{},subs:[{id:'s074a',text:'7시반본방 → 바버',checked:false,starred:false,color:null,subs:[]}]},{id:'s075',text:'메일 세팅(자주 필요일까지)',starred:false,checked:true,color:null,repeat:'none',completions:{},subs:[]},{id:'s076',text:'14시 아울렛 문자 결재 완료',starred:false,checked:true,color:null,repeat:'none',completions:{},subs:[]},{id:'s077',text:'16시 이후 바버 고객군 중복검사',starred:false,checked:true,color:null,repeat:'none',completions:{},subs:[]}],
  '2026-04-29':[{id:'s078',text:'첫구매런 > 앱푸쉬',starred:true,checked:false,color:null,repeat:'none',completions:{},subs:[]},{id:'s079',text:'14시 설문조사 문자발송(결재완료)',starred:false,checked:true,color:null,repeat:'none',completions:{},subs:[]},{id:'s080',text:'메시지 전표',starred:false,checked:true,color:null,repeat:'none',completions:{},subs:[]},{id:'s081',text:'비용품의 올리기',starred:false,checked:true,color:null,repeat:'none',completions:{},subs:[]}],
  '2026-04-30':[{id:'s082',text:'오전) 개인화 검수',starred:true,checked:false,color:null,repeat:'none',completions:{},subs:[{id:'s082a',text:'7시반 재방송',checked:false,starred:false,color:null,subs:[]},{id:'s082b',text:'퇴근 전 결재',checked:false,starred:false,color:null,subs:[]}]},{id:'s083',text:'기획전 검토',starred:false,checked:true,color:null,repeat:'none',completions:{},subs:[]},{id:'s084',text:'전관행사 10시 세팅',starred:false,checked:true,color:null,repeat:'none',completions:{},subs:[]},{id:'s085',text:'첫구매 기획전 확인',starred:false,checked:true,color:null,repeat:'none',completions:{},subs:[]}],
  '2026-05-01':[{id:'s086',text:'첫구매런 페이지 검수',starred:true,checked:false,color:null,repeat:'none',completions:{},subs:[]}]
};

// ── URL User ──
const URL_PARAMS = new URLSearchParams(window.location.search);
const _rawTeam = URL_PARAMS.get('team');
const IS_TEAM = !!_rawTeam;
const USER_ID = IS_TEAM ? ('team-' + _rawTeam.replace(/[.#$\[\]\/]/g,'').trim().slice(0,40)) : (URL_PARAMS.get('u') || '');
// Firebase 경로용 ID — . # $ [ ] / 는 Firebase 키 금지 문자라 제거.
// 보내기/공유(sanitizeId)와 같은 규칙이라 서로 경로가 항상 일치한다.
// (localStorage 키는 기존 데이터 보존을 위해 원래 USER_ID 유지)
const FB_UID = IS_TEAM ? USER_ID : USER_ID.replace(/[.#$\[\]\/]/g,'').trim().slice(0,40);
const STORAGE_KEY = USER_ID ? `calTasks_${USER_ID}` : 'calTasks';

// ── 사용자 지정 휴무일 (할 일 입력하듯 날짜별 지정, 기기 간 동기화) ──
const OFF_KEY = USER_ID ? `calOffDays_${USER_ID}` : 'calOffDays';
let offDays = (() => { try { return JSON.parse(localStorage.getItem(OFF_KEY) || '{}') || {}; } catch { return {}; } })();
let offSaveTimer = null, pendingOffLocal = false;
function offFbRef() { return FB_UID && USER_ID !== 'demo' && fbDb ? fbDb.ref(`users/${FB_UID}/offdays`) : null; }
function saveOffDays() {
  if (READ_ONLY) return;
  localStorage.setItem(OFF_KEY, JSON.stringify(offDays));
  const ref = offFbRef(); if (!ref) return;
  pendingOffLocal = true;
  clearTimeout(offSaveTimer);
  offSaveTimer = setTimeout(() => {
    offSaveTimer = null;
    ref.set(Object.keys(offDays).length ? fbClean(offDays) : null)
      .then(() => { pendingOffLocal = false; _pendingCollections.delete('off'); })
      .catch((e) => { console.warn('Firebase 저장 실패(offdays):', e); _pendingCollections.add('off'); });
  }, 300);
}
function initOffSync() {
  const ref = offFbRef(); if (!ref) return;
  ref.on('value', snap => {
    if (pendingOffLocal) return;
    const remote = snap.val();
    offDays = (remote && typeof remote === 'object') ? remote : {};
    localStorage.setItem(OFF_KEY, JSON.stringify(offDays));
    render();
  }, () => {});
}

const READ_ONLY = URL_PARAMS.get('ro') === '1';
if (READ_ONLY) document.documentElement.classList.add('readonly-mode');

// ── Landing page ──
if (!USER_ID) {
  // Auto-redirect to last used user if they've been here before
  const lastUser = localStorage.getItem('lastUser');
  if (lastUser) {
    window.location.replace(`?u=${encodeURIComponent(lastUser)}`);
  } else {
    document.getElementById('landingOverlay').style.display = 'flex';
    document.getElementById('landingInput').addEventListener('keydown', e => {
      if (e.key === 'Enter') document.getElementById('landingStartBtn').click();
    });
    document.getElementById('landingStartBtn').onclick = () => {
      const name = document.getElementById('landingInput').value.trim();
      if (!name) { document.getElementById('landingInput').focus(); return; }
      localStorage.setItem('lastUser', name);
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
} else if (READ_ONLY) {
  // 읽기 전용 보기 — 방문자의 lastUser를 덮어쓰지 않음
  document.getElementById('userChip').style.display = 'flex';
  document.getElementById('userChipName').textContent = decodeURIComponent(USER_ID) + ' · 👁 읽기 전용';
} else if (IS_TEAM) {
  // 팀 캘린더 — 개인 lastUser는 보존, 팀 배지 표시
  document.getElementById('userChip').style.display = 'flex';
  document.getElementById('userChipName').textContent = '🤝 ' + _rawTeam + ' (팀)';
  document.getElementById('copyUrlBtn').style.display = 'flex';
  document.getElementById('copyUrlBtn').onclick = () => {
    navigator.clipboard.writeText(window.location.href).then(() => {
      const btn = document.getElementById('copyUrlBtn'); const o = btn.innerHTML;
      btn.innerHTML = '✅ <span>복사됨!</span>'; setTimeout(() => { btn.innerHTML = o; }, 1800);
    });
  };
  document.getElementById('switchUserBtn').style.display = 'flex';
  document.getElementById('switchUserBtn').innerHTML = '↩ <span>내 캘린더로</span>';
  document.getElementById('switchUserBtn').onclick = () => {
    const last = localStorage.getItem('lastUser');
    window.location.href = window.location.pathname + (last ? `?u=${encodeURIComponent(last)}` : '');
  };
} else {
  // Remember this user for future visits
  localStorage.setItem('lastUser', USER_ID);
  // Show user chip + copy URL button
  document.getElementById('userChip').style.display = 'flex';
  document.getElementById('userChipName').textContent = decodeURIComponent(USER_ID);
  document.getElementById('shareRoBtn').style.display = 'flex';
  document.getElementById('shareRoBtn').onclick = () => {
    const url = window.location.href.split('?')[0] + `?u=${encodeURIComponent(USER_ID)}&ro=1`;
    navigator.clipboard.writeText(url).then(() => {
      const btn = document.getElementById('shareRoBtn');
      const orig = btn.innerHTML;
      btn.innerHTML = '✅ <span>복사됨!</span>';
      setTimeout(() => { btn.innerHTML = orig; }, 1800);
    });
  };
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
  document.getElementById('forceSyncBtn').style.display = 'flex';
  document.getElementById('forceSyncBtn').onclick = () => {
    const btn = document.getElementById('forceSyncBtn');
    btn.innerHTML = '⏳ <span>저장 중...</span>';
    btn.disabled = true;
    fbUpload()
      .then(() => { btn.innerHTML = '✅ <span>저장 완료</span>'; })
      .catch(() => { btn.innerHTML = '❌ <span>저장 실패</span>'; })
      .finally(() => setTimeout(() => { btn.innerHTML = '☁️ <span>저장</span>'; btn.disabled = false; }, 2000));
  };
  document.getElementById('renameBtn').style.display = 'flex';
  document.getElementById('renameBtn').onclick = () => { document.getElementById('moreMenu').classList.add('hidden'); renameAccount(); };
  document.getElementById('switchUserBtn').style.display = 'flex';
  document.getElementById('switchUserBtn').onclick = () => {
    if (confirm('다른 캘린더로 전환할까요? 지금 데이터는 그대로 남아요.')) {
      localStorage.removeItem('lastUser');
      window.location.href = window.location.href.split('?')[0];
    }
  };
}

// ── State ──
let currentView = 'week';
let weekStart = getMonday(new Date());
let monthDate = new Date(); monthDate.setDate(1);
let dayDate = today();
let yearNum = new Date().getFullYear();
let tasks = loadTasks();
let activeInput = null;
let justToggledCb = null;   // 방금 토글한 체크박스만 팝 애니메이션 (재렌더 시 전체 팝 버그 방지)
let _justDoneId = null;
let _lastRenderedView = null;  // 뷰 종류가 바뀔 때만 전환 애니메이션 (체크 토글 재렌더엔 미적용)
let weatherByDate = {};
let weatherStatus = 'loading';  // 'loading' | 'ok' | 'error'
let weatherLoc = {lat:37.5665,lon:126.978,name:'서울'};
let searchQuery = '';
let selectMode = false;            // 다중 선택 모드
let bulkSelected = new Set();       // 선택된 태스크 키("dk|id")
let editCtx = null;
let _editColor = null, _editStarred = false, _editRepeat = 'none', _editPriority = null;

// ── Persistence ──
// Firebase는 빈 배열/객체를 저장하지 않으므로 로드 시 스키마를 복구한다 (비파괴 — 모든 필드 유지)
function normalizeTasks(raw) {
  const out = {};
  Object.entries(raw || {}).forEach(([dk, list]) => {
    const arr = Array.isArray(list) ? list : Object.values(list || {});
    const clean = arr.filter(t => t && typeof t === 'object' && t.text != null).map(t => Object.assign({}, t, {
      // 문자열 등 손상된 subs는 통째로 버리고, 요소도 객체+text 있는 것만 (문자열이면 글자별로 쪼개지는 사고 방지)
      subs: (Array.isArray(t.subs) ? t.subs : (t.subs && typeof t.subs === 'object' ? Object.values(t.subs) : []))
        .filter(s => s && typeof s === 'object' && s.text != null),
      completions: t.completions || {},
      skips: t.skips || {},
      memoImages: Array.isArray(t.memoImages) ? t.memoImages : [],
      memoHistory: Array.isArray(t.memoHistory) ? t.memoHistory : [],
      comments: Array.isArray(t.comments) ? t.comments : [],
    }));
    if (clean.length) out[dk] = clean;
  });
  return out;
}
function loadTasks() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    if (Object.keys(stored).length === 0) {
      return JSON.parse(JSON.stringify(SEED_TASKS));
    }
    return normalizeTasks(stored);
  } catch { return {}; }
}

let pendingUpload = false;
let pendingTasksLocal = false;
let _pendingCollections = new Set();
let _pendingSaveDks = new Set();   // 디바운스 대기 중인 날짜들 (여러 dk 저장 시 마지막 것만 쓰이는 버그 방지)
let _pendingSaveFull = false;      // 전체 저장 요청(인자 없는 saveTasks)이 대기 중인지

let _taskSaveRetryTimer = null;
function _flushTaskSave() {
  const ref = fbRef();
  if (!ref) return;
  const full = _pendingSaveFull;
  const dks = [..._pendingSaveDks];
  _pendingSaveFull = false; _pendingSaveDks.clear();
  let p;
  if (full || !dks.length) {
    p = ref.set(fbClean(tasks));
  } else if (dks.length === 1) {
    p = ref.child(dks[0]).set(fbClean(tasks[dks[0]]));
  } else {
    // 여러 날짜를 한 번에 — 멀티패스 업데이트 (각 날짜 노드만 갱신)
    const updates = {};
    dks.forEach(d => { updates[d] = fbClean(tasks[d]); });
    p = ref.update(updates);
  }
  p.then(() => { pendingTasksLocal = false; setSyncStatus('synced'); })
   .catch((e) => {
     console.warn('Firebase 저장 실패:', e);
     // 저장 대상을 되살리고 15초 후 자동 재시도.
     // (온라인 상태에서 난 일시 오류는 'online' 이벤트가 안 오므로 자체 재시도 필요 —
     //  이게 없으면 pendingTasksLocal이 영원히 true로 남아 원격 수신이 전부 무시됨)
     if (full) _pendingSaveFull = true;
     dks.forEach(d => _pendingSaveDks.add(d));
     pendingUpload = true; setSyncStatus('offline');
     clearTimeout(_taskSaveRetryTimer);
     _taskSaveRetryTimer = setTimeout(_flushTaskSave, 15000);
   });
}
function saveTasks(dk) {
  if (READ_ONLY) return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
  const ref = fbRef();
  if (!ref) return;
  pendingTasksLocal = true;
  // 대기 중인 저장 대상 누적 — clearTimeout으로 이전 예약이 취소돼도 대상은 보존됨
  if (dk) _pendingSaveDks.add(dk); else _pendingSaveFull = true;
  if (!navigator.onLine) { pendingUpload = true; setSyncStatus('offline'); return; }
  setSyncStatus('syncing');
  clearTimeout(fbSaveTimer);
  fbSaveTimer = setTimeout(_flushTaskSave, 300);
}

// Firebase는 데이터에 undefined가 하나라도 있으면 저장을 거부한다.
// localStorage(JSON.stringify)는 undefined를 조용히 버리므로, 같은 규칙으로
// 정리해서 보내야 "로컬은 되는데 클라우드만 실패"하는 상황을 막을 수 있다.
function fbClean(v){ return v == null ? null : JSON.parse(JSON.stringify(v)); }

function fbUpload() {
  if (READ_ONLY) return Promise.reject('read-only');
  const ref = fbRef();
  if (!ref) return Promise.reject('no ref');
  pendingTasksLocal = true;
  setSyncStatus('syncing');
  // 전체 업로드이므로 개별 dk 대기열은 비움 (디바운스·재시도 예약도 취소)
  clearTimeout(fbSaveTimer); fbSaveTimer = null;
  clearTimeout(_taskSaveRetryTimer); _taskSaveRetryTimer = null;
  _pendingSaveFull = false; _pendingSaveDks.clear();
  return ref.set(fbClean(tasks))
    .then(() => { pendingTasksLocal = false; setSyncStatus('synced'); })
    .catch(e => { console.warn('Firebase 저장 실패:', e); setSyncStatus('offline'); throw e; });
}

function initFirebaseSync() {
  const ref = fbRef();
  if (!ref) return;
  const dot = document.getElementById('syncDot');
  if (dot) dot.style.display = 'block';
  setSyncStatus('syncing');
  // 첫 방문(로컬 데이터 없음): 클라우드 첫 응답까지 스켈레톤 표시 — 빈 화면 방지
  const _mv=document.getElementById('mainView');
  if(_mv && !Object.keys(tasks).length) _mv.classList.add('skeleton-loading');
  const _clearSkeleton=()=>{ if(_mv) _mv.classList.remove('skeleton-loading'); };
  // 1) 먼저 한 번 읽어서 Firebase 데이터 유무 확인
  ref.once('value').then(snapshot => {
    _clearSkeleton();
    const remote = snapshot.val();
    if (remote && typeof remote === 'object' && Object.keys(remote).length > 0) {
      // Firebase에 데이터 있음 → 로컬에 덮어쓰기 (실시간 리스너와 동일하게 정규화)
      tasks = normalizeTasks(remote);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
      render();
      setSyncStatus('synced');
    } else if (Object.keys(tasks).length > 0 && !READ_ONLY) {
      // Firebase 비어있고 로컬에 데이터 있음 → Firebase로 업로드
      fbUpload();
    } else {
      setSyncStatus('synced');
    }
    // 2) 이후 다른 기기 변경사항 실시간 반영 (단, 내 로컬 편집 업로드 중이면 건너뜀 → 덮어쓰기 방지)
    ref.on('value', snapshot => {
      if (pendingTasksLocal) return;
      const remote = snapshot.val();
      if (remote && typeof remote === 'object') {
        tasks = normalizeTasks(remote);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
        render();
        if (typeof checkPendingNotifications === 'function') checkPendingNotifications();
      }
    });
    // 3) 개인 트리 로드 후에 구독 팀 동기화 시작 (먼저 실행되면 복사본이 덮어쓰기로 사라질 수 있음)
    if (typeof loadTeamDataFromFb === 'function') loadTeamDataFromFb();
    if (typeof syncSubscribedTeams === 'function') syncSubscribedTeams();
  }).catch(() => { _clearSkeleton(); setSyncStatus('offline'); if (typeof syncSubscribedTeams === 'function') syncSubscribedTeams(); });
}

// ── Date helpers ──
function getMonday(d) {
  const date = new Date(d);
  const day = date.getDay();
  date.setDate(date.getDate()-(day===0?6:day-1));
  date.setHours(0,0,0,0); return date;
}
function dateKey(d) { return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
function today() { const d=new Date(); d.setHours(0,0,0,0); return d; }
function dateToDayIdx(d) { const dd=(typeof d==='string')?parseDk(d):d; const day=dd.getDay(); return day===0?6:day-1; }

// ── Repeat helpers ──
// 렌더 단위 캐시: 월/연/간트 뷰는 셀마다 호출하므로 dk별 1회 계산으로 재사용 (render 시작 시 비움)
let _repeatCache = new Map();
// 휴일이면 다음 영업일로 밀어 표시하는 '날짜 기준' 반복 타입 (요일 기준인 주간/격주는 제외)
const SHIFT_REPEAT_TYPES = ['monthly','monthlyNth','monthlyFirstBiz','monthlyLastBiz'];
// 반복이 cand일에 '자연 발생'하는가 (휴일 보정 전)
function repeatNaturalOccurs(t, originDate, cand) {
  switch (t.repeat) {
    case 'weekly':
      return cand.getDay() === originDate.getDay();
    case 'biweekly': {
      if (cand.getDay() !== originDate.getDay()) return false;
      const weeksDiff = Math.round((getMonday(cand) - getMonday(originDate)) / (7*86400000));
      return weeksDiff !== 0 && weeksDiff % 2 === 0;
    }
    case 'monthly': {
      const dim = new Date(cand.getFullYear(), cand.getMonth()+1, 0).getDate();
      return cand.getDate() === Math.min(originDate.getDate(), dim);
    }
    case 'monthlyNth':
      return cand.getDay() === originDate.getDay() && Math.ceil(cand.getDate()/7) === Math.ceil(originDate.getDate()/7);
    case 'monthlyFirstBiz':
      return dateKey(firstBizDay(cand.getFullYear(), cand.getMonth())) === dateKey(cand);
    case 'monthlyLastBiz':
      return dateKey(lastBizDay(cand.getFullYear(), cand.getMonth())) === dateKey(cand);
  }
  return false;
}
function getRepeatTasksForDate(date, dayIdx) {
  const dk = dateKey(date);
  const _c = _repeatCache.get(dk);
  if (_c) return _c;
  const out = [];
  const dateIsRest = isRestDay(date);
  // date(영업일) 직전의 연속 휴일들 — 날짜지정형 반복이 그 휴일에 걸리면 이 영업일로 밀려 표시됨
  const restBefore = [];
  if (!dateIsRest) {
    const probe = new Date(date);
    for (let k=0; k<14; k++) { probe.setDate(probe.getDate()-1); if (!isRestDay(probe)) break; restBefore.push(new Date(probe)); }
  }
  Object.entries(tasks).forEach(([oDk, list]) => {
    if (!Array.isArray(list)) return;
    list.forEach(t => {
      if (!t || !t.repeat || t.repeat==='none') return;
      // 반복 종료일: 자연 발생일(휴일 이동 전) 기준으로 판정해야 하므로 각 분기에서 검사.
      // 여기서는 이동 최대폭(14일)을 더한 상한으로만 빠르게 걸러냄 — 마지막 회차가
      // 공휴일에 걸려 뒤로 밀린 경우에도 표시되도록.
      if (t.repeatEnd) {
        const endLimit = parseDk(t.repeatEnd); endLimit.setDate(endLimit.getDate()+14);
        if (date > endLimit) return;
      }
      const rEnd = t.repeatEnd || null;
      if (t.skips && t.skips[dk]) return;            // "이 날짜만 삭제"(표시일 기준)
      const originDate = parseDk(oDk);
      const limitDate = parseDk(oDk); limitDate.setFullYear(limitDate.getFullYear() + 1);
      if (date > limitDate) return; // 생성일로부터 1년 초과 시 반복 종료
      if (t.repeat==='daily') {
        if (dk > oDk && (!rEnd || dk <= rEnd)) out.push({task:t, originDk:oDk, instanceDk:dk});
        return;
      }
      if (t.repeat==='weekdays') {
        if (dk > oDk && !dateIsRest && (!rEnd || dk <= rEnd)) out.push({task:t, originDk:oDk, instanceDk:dk}); // 영업일에만
        return;
      }
      // 주간/격주: 지정 요일은 의도된 선택 → 주말엔 그대로, '공휴일/수동휴무'에 걸리면 다음 영업일로 이동
      if (t.repeat==='weekly' || t.repeat==='biweekly') {
        if (dk <= oDk) return; // 원본일은 저장(원본)으로 표시
        // 1) 자연 발생일이고 공휴일/휴무일이 아니면 그대로(주말이어도) 표시
        if ((!rEnd || dk <= rEnd) && repeatNaturalOccurs(t, originDate, date) && !isHolidayShift(date)) { out.push({task:t, originDk:oDk, instanceDk:dk}); return; }
        // 2) 공휴일/휴무일에 걸린 자연 발생일 → 다음 영업일로 1회 밀어 표시 (종료일은 자연 발생일 기준)
        if (!isRestDay(date)) {
          const probe = new Date(date);
          for (let k=0; k<14; k++) {
            probe.setDate(probe.getDate()-1);
            if (!isRestDay(probe)) break;
            const pdk = dateKey(probe);
            if (isHolidayShift(probe) && pdk >= oDk && (!rEnd || pdk <= rEnd) && repeatNaturalOccurs(t, originDate, probe)) { out.push({task:t, originDk:oDk, instanceDk:dk, adjusted:true}); break; }
          }
        }
        return;
      }
      // 매월/매월N째/첫·말영업일: 날짜 기준 → 휴일이면 다음 영업일로 밀어 표시
      if (!SHIFT_REPEAT_TYPES.includes(t.repeat)) return;
      if (dateIsRest) return; // 휴일엔 표시 안 함 (다음 영업일로 밀려나감)
      // date 및 직전 휴일 후보들에 대해 자연발생 검사 → 휴일이면 date로 밀어 1회 표시
      for (const cand of [date, ...restBefore]) {
        const cdk = dateKey(cand);
        if (cdk < oDk) continue;
        if (cdk === oDk && !isRestDay(cand)) continue; // origin이 영업일이면 저장(원본)으로 표시
        if (cand > limitDate) continue;
        if (rEnd && cdk > rEnd) continue; // 종료일은 자연 발생일 기준 (밀린 표시일 아님)
        if (repeatNaturalOccurs(t, originDate, cand)) {
          out.push({task:t, originDk:oDk, instanceDk:dk, adjusted: cdk !== dk});
          break;
        }
      }
    });
  });
  _repeatCache.set(dk, out);
  return out;
}
function isRepeatChecked(task, instanceDk) {
  if (!task.completions) return task.checked;
  return instanceDk in task.completions ? task.completions[instanceDk] : false;
}
function toggleRepeatInst(originDk, taskId, instanceDk) {
  if(READ_ONLY)return;
  const t=(tasks[originDk]||[]).find(x=>x.id===taskId); if(!t)return;
  if(!t.completions) t.completions={};
  t.completions[instanceDk]=!isRepeatChecked(t,instanceDk);
  saveTasks(originDk); render();
}
// 반복 인스턴스의 하위태스크 완료는 인스턴스별로 저장 (과거/이후 인스턴스와 분리)
function toggleRepeatSub(originDk, parentId, subId, instanceDk) {
  if(READ_ONLY)return;
  const p=(tasks[originDk]||[]).find(x=>x.id===parentId); if(!p||!Array.isArray(p.subs))return;
  const s=p.subs.find(x=>x.id===subId); if(!s)return;
  if(!s.completions) s.completions={};
  s.completions[instanceDk]=!isRepeatChecked(s,instanceDk);
  saveTasks(originDk); render();
}

// ── 반복 태스크: 이 날짜만 삭제 (skips) ──
let repeatDelCtx = null;
function skipRepeatInstance(originDk, taskId, instanceDk) {
  if (READ_ONLY) return;
  const t = (tasks[originDk]||[]).find(x => x.id === taskId);
  if (!t) return;
  if (!t.skips) t.skips = {};
  t.skips[instanceDk] = true;
  saveTasks(originDk); render();
  showUndoToast('이번 반복을 삭제했어요', () => {
    const tt = (tasks[originDk]||[]).find(x => x.id === taskId);
    if (tt && tt.skips) { delete tt.skips[instanceDk]; saveTasks(originDk); render(); }
  });
}
function openRepeatDel(originDk, taskId, shownDk) {
  repeatDelCtx = {originDk, taskId, shownDk};
  const t = (tasks[originDk]||[]).find(x => x.id === taskId);
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

// ── 미루기: 다음 영업일로 (주말·공휴일 건너뜀) ──
function nextWorkdayAfter(dk) {
  const d = parseDk(dk);
  d.setDate(d.getDate() + 1);
  let guard = 0;
  while (isRestDay(d) && guard++ < 366) d.setDate(d.getDate() + 1);
  return dateKey(d);
}
function prevWorkdayBefore(dk) {
  const d = parseDk(dk);
  d.setDate(d.getDate() - 1);
  let guard = 0;
  while (isRestDay(d) && guard++ < 366) d.setDate(d.getDate() - 1);
  return dateKey(d);
}
function postponeTask(dk, id) {
  if (READ_ONLY) return;
  const list = tasks[dk]||[];
  const idx = list.findIndex(t => t.id === id);
  if (idx < 0) return;
  const toDk = nextWorkdayAfter(dk);
  const [t] = list.splice(idx, 1);
  if (!list.length) delete tasks[dk];
  if (!tasks[toDk]) tasks[toDk] = [];
  tasks[toDk].push(t);
  saveTasks(); render();
  const d = parseDk(toDk);
  showUndoToast(`"${t.text}" → ${d.getMonth()+1}/${d.getDate()}(${DAY_NAMES[dateToDayIdx(toDk)]})로 이동`, () => {
    const l2 = tasks[toDk]||[];
    const i2 = l2.findIndex(x => x.id === id);
    if (i2 < 0) return;
    const [b] = l2.splice(i2, 1);
    if (!l2.length) delete tasks[toDk];
    if (!tasks[dk]) tasks[dk] = [];
    tasks[dk].push(b);
    saveTasks(); render();
  });
}

// ── 어제 미완료 이월 ──
function carryOverFrom(fromDk, toDk) {
  if (READ_ONLY) return;
  const pending = (tasks[fromDk]||[]).filter(t => t && !t.pending && !t.checked && (!t.repeat||t.repeat==='none'));
  if (!pending.length) return;
  const ids = pending.map(t => t.id);
  ids.forEach(id => {
    const list = tasks[fromDk]||[];
    const idx = list.findIndex(t => t.id === id);
    if (idx < 0) return;
    const [t] = list.splice(idx, 1);
    if (!tasks[toDk]) tasks[toDk] = [];
    tasks[toDk].push(t);
  });
  if (tasks[fromDk] && !tasks[fromDk].length) delete tasks[fromDk];
  saveTasks(); render();
  showUndoToast(`어제 못 끝낸 ${ids.length}개를 가져왔어요`, () => {
    ids.forEach(id => {
      const list = tasks[toDk]||[];
      const idx = list.findIndex(t => t.id === id);
      if (idx < 0) return;
      const [t] = list.splice(idx, 1);
      if (!tasks[fromDk]) tasks[fromDk] = [];
      tasks[fromDk].push(t);
    });
    if (tasks[toDk] && !tasks[toDk].length) delete tasks[toDk];
    saveTasks(); render();
  });
}

// ── 휴무일 지정/해제 (지정 시 미완료 할 일을 다음 영업일로 자동 이동) ──
// 휴무일 지정: 비반복 미완료 할 일을 다음 영업일로 이동(movedFrom 태그). 반복은 표시단에서 자동 이동.
function applyOffDayMove(dk, dir) {
  const toDk = (dir === 'prev') ? prevWorkdayBefore(dk) : nextWorkdayAfter(dk);
  const list = tasks[dk] || [];
  let moved = 0;
  for (let i = list.length - 1; i >= 0; i--) {
    const t = list[i];
    if (t && !t.checked && (!t.repeat || t.repeat === 'none')) {
      list.splice(i, 1);
      t.movedFrom = dk;
      if (!tasks[toDk]) tasks[toDk] = [];
      (dir === 'prev') ? tasks[toDk].push(t) : tasks[toDk].unshift(t);
      moved++;
    }
  }
  if (tasks[dk] && !tasks[dk].length) delete tasks[dk];
  return moved;
}
// 휴무일 해제: 이 날(dk)에서 옮겨졌던 할 일들을 원래 날짜로 복원
function restoreMovedFrom(dk) {
  let restored = 0;
  Object.keys(tasks).forEach(d => {
    const list = tasks[d];
    if (!Array.isArray(list)) return;
    for (let i = list.length - 1; i >= 0; i--) {
      const t = list[i];
      if (t && t.movedFrom === dk) {
        list.splice(i, 1);
        delete t.movedFrom;
        if (!tasks[dk]) tasks[dk] = [];
        tasks[dk].push(t);
        restored++;
      }
    }
    if (d !== dk && tasks[d] && !tasks[d].length) delete tasks[d];
  });
  return restored;
}
function toggleOffDay(dk) {
  if (READ_ONLY) return;
  if (offDays[dk]) {
    // 해제 — 이 휴무일로 옮겨졌던 할 일 원복
    delete offDays[dk];
    const restored = restoreMovedFrom(dk);
    saveOffDays(); saveTasks(); render();
    showUndoToast(restored ? `🏖 휴무일 해제 — ${restored}개를 원래 자리로 돌려놨어요` : '🏖 휴무일 해제했어요',
      () => { offDays[dk] = true; applyOffDayMove(dk); saveOffDays(); saveTasks(); render(); });
    return;
  }
  // 지정 — 옮길 할 일(비반복·미완료)이 있으면 전/후 영업일 중 선택 팝업
  const doSet = (dir) => {
    offDays[dk] = true;
    const moved = dir ? applyOffDayMove(dk, dir) : 0;
    saveOffDays(); saveTasks(); render();
    let msg = '🏖 휴무일로 지정했어요';
    if (moved) {
      const toDk = (dir === 'prev') ? prevWorkdayBefore(dk) : nextWorkdayAfter(dk), d = parseDk(toDk);
      msg = `🏖 휴무일 지정 — 할 일 ${moved}개를 ${d.getMonth()+1}/${d.getDate()}(${DAY_NAMES[dateToDayIdx(toDk)]})로 이동했어요`;
    }
    showUndoToast(msg, () => { delete offDays[dk]; restoreMovedFrom(dk); saveOffDays(); saveTasks(); render(); });
  };
  const movable = (tasks[dk] || []).filter(t => t && !t.checked && (!t.repeat || t.repeat === 'none')).length;
  if (movable > 0) {
    askOffDayDirection(dk, movable, (choice) => { if (choice !== null) doSet(choice === 'none' ? null : choice); });
  } else {
    doSet(null);
  }
}
// 휴무일 지정 시 할 일을 전/후 영업일 중 어디로 옮길지 묻는 팝업
function askOffDayDirection(dk, count, cb) {
  const d = parseDk(dk);
  const prevDk = prevWorkdayBefore(dk), nextDk = nextWorkdayAfter(dk);
  const pd = parseDk(prevDk), nd = parseDk(nextDk);
  const ov = el('div', 'modal-overlay');
  const box = el('div', 'modal-box'); box.style.maxWidth = '340px';
  box.appendChild(el('div', 'modal-title', { textContent: '🏖 휴무일 지정' }));
  box.appendChild(el('div', '', { textContent: `${d.getMonth()+1}/${d.getDate()}(${DAY_NAMES[dateToDayIdx(dk)]})에 옮길 할 일이 ${count}개 있어요. 어디로 옮길까요?`, style: 'font-size:13px;color:var(--text2);margin-bottom:12px;line-height:1.5' }));
  const mk = (label, sub, fn, primary) => {
    const b = el('button', primary ? 'btn-primary' : 'btn-secondary', { type: 'button' });
    b.style.cssText = 'width:100%;margin-bottom:8px;text-align:left;padding:10px 12px';
    b.appendChild(el('div', '', { textContent: label, style: 'font-weight:600' }));
    b.appendChild(el('div', '', { textContent: sub, style: 'font-size:11px;opacity:.8;margin-top:2px' }));
    b.onclick = () => { ov.remove(); fn(); };
    return b;
  };
  box.appendChild(mk('⬅ 전 영업일로', `${pd.getMonth()+1}/${pd.getDate()}(${DAY_NAMES[dateToDayIdx(prevDk)]})`, () => cb('prev')));
  box.appendChild(mk('➡ 다음 영업일로', `${nd.getMonth()+1}/${nd.getDate()}(${DAY_NAMES[dateToDayIdx(nextDk)]})`, () => cb('next'), true));
  box.appendChild(mk('옮기지 않고 지정', '할 일은 그대로 두기', () => cb('none')));
  const c = el('button', 'btn-secondary', { type: 'button', textContent: '취소' });
  c.style.cssText = 'width:100%;margin-top:4px';
  c.onclick = () => { ov.remove(); cb(null); };
  box.appendChild(c);
  ov.appendChild(box); document.body.appendChild(ov);
  ov.onclick = e => { if (e.target === ov) { ov.remove(); cb(null); } };
}

// ── Undo toast ──
let undoAction=null, undoTimer=null;
function showUndoToast(msg,fn){
  undoAction=fn;
  document.getElementById('undoMsg').textContent=msg;
  document.getElementById('undoToast').classList.remove('hidden');
  clearTimeout(undoTimer);
  undoTimer=setTimeout(()=>{document.getElementById('undoToast').classList.add('hidden');undoAction=null;},6000);
}
document.getElementById('undoBtn').onclick=()=>{
  const fn=undoAction; undoAction=null;
  clearTimeout(undoTimer);
  document.getElementById('undoToast').classList.add('hidden');
  if(fn)fn();
};

// ── Task mutations ──
function uid() { return Date.now().toString(36)+Math.random().toString(36).slice(2); }
function addTask(dk,text,color,starred,repeat,parentId,priority,time) {
  if(READ_ONLY)return;
  if(!tasks[dk]) tasks[dk]=[];
  const t={id:uid(),text,checked:false,starred:!!starred,color:color||null,repeat:repeat||'none',priority:priority||null,time:time||null,completions:{},subs:[]};
  if(parentId){const p=tasks[dk].find(x=>x.id===parentId);if(p){if(!Array.isArray(p.subs))p.subs=[];p.subs.push(t);}}
  else tasks[dk].push(t);
  saveTasks(dk); activeInput=null; render();
}

// ── Task sort: 중요 → 마감시간순 → 시간 없는 항목 ──
function taskSort(a,b){
  const s=(b.starred?1:0)-(a.starred?1:0); if(s)return s;
  if(a.time&&b.time)return a.time<b.time?-1:a.time>b.time?1:0;
  if(a.time)return -1;
  if(b.time)return 1;
  return 0;
}

// ── Reorder within same day (드래그 순서 변경) ──
function reorderTask(dk,dragId,targetId){
  if(READ_ONLY)return;
  const list=tasks[dk]; if(!list)return;
  const from=list.findIndex(t=>t.id===dragId);
  if(from<0)return;
  const [moved]=list.splice(from,1);
  const to=list.findIndex(t=>t.id===targetId);
  if(to<0){list.splice(from,0,moved);return;}
  list.splice(to,0,moved);
  saveTasks(dk);render();
}
// 하위 항목 순서 변경 (같은 부모 내에서)
function reorderSub(dk,parentId,dragId,targetId){
  if(READ_ONLY)return;
  const parent=(tasks[dk]||[]).find(t=>t.id===parentId);
  if(!parent||!Array.isArray(parent.subs))return;
  const list=parent.subs;
  const from=list.findIndex(s=>s.id===dragId);
  if(from<0)return;
  const [moved]=list.splice(from,1);
  const to=list.findIndex(s=>s.id===targetId);
  if(to<0){list.splice(from,0,moved);return;}
  list.splice(to,0,moved);
  saveTasks(dk);render();
}
// 모바일: 태스크/하위항목 터치 드래그(꾹 눌러서) — 데스크탑 HTML5 DnD와 동일 동작
function attachTaskTouchDrag(item){
  item.addEventListener('pointerdown', e=>{
    if(e.pointerType!=='touch' || READ_ONLY || selectMode) return;
    if(e.target.closest('button,input,textarea,.task-cb,.task-star,.memo-icon-btn,.task-more-btn,.add-sub-btn')) return;
    const meta=item._task; if(!meta) return;
    const sx=e.clientX, sy=e.clientY;
    let lifted=false, lp=null, target=null;
    const clearHi=()=>document.querySelectorAll('.drag-target,.drag-over').forEach(x=>x.classList.remove('drag-target','drag-over'));
    const lift=()=>{ lifted=true; item.classList.add('touch-dragging'); if(navigator.vibrate) navigator.vibrate(15); };
    const move=ev=>{
      if(ev.pointerId!==e.pointerId) return;
      if(!lifted){ if(Math.hypot(ev.clientX-sx,ev.clientY-sy)>12) clearTimeout(lp); return; }
      ev.preventDefault();
      item.style.visibility='hidden';
      const under=document.elementFromPoint(ev.clientX, ev.clientY);
      item.style.visibility='';
      clearHi(); target=null;
      const tEl=under&&under.closest('.task-item');
      const cEl=under&&under.closest('.day-col');
      if(tEl && tEl!==item && tEl._task){ tEl.classList.add('drag-target'); target={type:'task', meta:tEl._task}; }
      else if(cEl && cEl.dataset.dk){ cEl.classList.add('drag-over'); target={type:'col', dk:cEl.dataset.dk}; }
    };
    const end=ev=>{
      if(ev.pointerId!==e.pointerId) return;
      cleanup(); if(!lifted) return;
      item.classList.remove('touch-dragging'); clearHi();
      if(target) doDrop(target);
    };
    const doDrop=tg=>{
      if(meta.isSub){
        if(tg.type==='task' && tg.meta.isSub && tg.meta.parentId===meta.parentId && tg.meta.id!==meta.id)
          reorderSub(meta.dk, meta.parentId, meta.id, tg.meta.id);
        return;
      }
      let toDk=null;
      if(tg.type==='task'){
        const tm=tg.meta;
        if(tm.colDk===meta.colDk && !meta.isRepeat && !tm.isSub){ if(tm.id!==meta.id) reorderTask(meta.colDk, meta.id, tm.id); return; }
        toDk=tm.colDk;
      } else if(tg.type==='col'){ toDk=tg.dk; }
      if(!toDk || toDk===meta.colDk) return;
      if(meta.isRepeat){
        askRepeatMoveScope(scope=>{ if(scope==='one') moveRepeatInstanceOne(meta.dk, meta.id, meta.instanceDk, toDk); else if(scope==='all') moveTask(meta.dk, meta.id, toDk); });
      } else moveTask(meta.dk, meta.id, toDk);
    };
    const cleanup=()=>{ clearTimeout(lp); document.removeEventListener('pointermove',move); document.removeEventListener('pointerup',end); document.removeEventListener('pointercancel',end); };
    document.addEventListener('pointermove',move);
    document.addEventListener('pointerup',end);
    document.addEventListener('pointercancel',end);
    lp=setTimeout(lift, 280);
  });
}

// ── Quick input time parsing (예: "8시 회의"→08:00, "6시 보고"→18:00, "오후 2시반"→14:30) ──
// 업무시간(8시~19시) 휴리스틱: 8~12시는 오전, 1~7시는 오후로 해석
function parseQuickTime(text){
  let m;
  // 오전/오후 명시: "오후 2시", "오전 9시 30분", "오후3시반"
  if((m=text.match(/(오전|오후|저녁|밤|새벽|아침)\s*(\d{1,2})\s*시(?!간)\s*(반|(\d{1,2})\s*분)?\s*/))){
    let h=+m[2];
    const min=m[3]?(m[3]==='반'?30:+m[4]):0;
    const isPM=(m[1]==='오후'||m[1]==='저녁'||m[1]==='밤');
    if(isPM&&h<12)h+=12;
    if((m[1]==='새벽')&&h===12)h=0;
    if(h>23||min>59)return null;
    return {time:`${String(h).padStart(2,'0')}:${String(min).padStart(2,'0')}`,text:(text.slice(0,m.index)+text.slice(m.index+m[0].length)).trim()};
  }
  // 24시간 표기: "14시", "14:30", "9:00"
  if((m=text.match(/(?:^|\s)(\d{1,2}):(\d{2})(?:\s|$)/))){
    const h=+m[1],min=+m[2];
    if(h<=23&&min<=59){
      const hh=(h>=1&&h<=7)?h+12:h; // 업무시간 휴리스틱
      return {time:`${String(hh).padStart(2,'0')}:${String(min).padStart(2,'0')}`,text:text.replace(m[0],' ').replace(/\s+/g,' ').trim()};
    }
  }
  // "N시", "N시반", "N시 N분"
  if((m=text.match(/(\d{1,2})\s*시(?!간)\s*(반|(\d{1,2})\s*분)?\s*/))){
    let h=+m[1];
    const min=m[2]?(m[2]==='반'?30:+m[3]):0;
    if(h>24||min>59)return null;
    if(h>=1&&h<=7)h+=12;       // 1~7시 → 오후 (13:00~19:00)
    if(h===24)h=0;
    return {time:`${String(h).padStart(2,'0')}:${String(min).padStart(2,'0')}`,text:(text.slice(0,m.index)+text.slice(m.index+m[0].length)).trim()};
  }
  return null;
}

// ── Quick input date parsing (e.g. "내일 회의", "다음주 화요일 보고", "3/15 발표") ──
function parseQuickDate(text){
  const now=today();
  const dayMap={'일':0,'월':1,'화':2,'수':3,'목':4,'금':5,'토':6};
  let m;
  if((m=text.match(/(오늘|내일|모레|글피)\s*/))){
    const offsets={'오늘':0,'내일':1,'모레':2,'글피':3};
    const d=new Date(now); d.setDate(d.getDate()+offsets[m[1]]);
    return {date:d, text:(text.slice(0,m.index)+text.slice(m.index+m[0].length)).trim()};
  }
  if((m=text.match(/(다음\s?주|이번\s?주)\s*([월화수목금토일])요?일?\s*/))){
    const targetDay=dayMap[m[2]];
    const base=getMonday(now);
    const add=m[1].replace(/\s/g,'')==='다음주'?7:0;
    const d=new Date(base); d.setDate(d.getDate()+add+((targetDay+6)%7));
    return {date:d, text:(text.slice(0,m.index)+text.slice(m.index+m[0].length)).trim()};
  }
  if((m=text.match(/(\d{1,2})[\/월]\s?(\d{1,2})일?\s*/))){
    const mo=+m[1], da=+m[2];
    if(mo>=1&&mo<=12&&da>=1&&da<=31){
      let d=new Date(now.getFullYear(),mo-1,da);
      if(d<now) d.setFullYear(d.getFullYear()+1);
      return {date:d, text:(text.slice(0,m.index)+text.slice(m.index+m[0].length)).trim()};
    }
  }
  return null;
}
function toggleTask(dk,id,subId) {
  if(READ_ONLY)return;
  const list=tasks[dk]||[];
  if(subId){const p=list.find(x=>x.id===id);if(p){const s=p.subs.find(x=>x.id===subId);if(s)s.checked=!s.checked;}}
  else{
    const t=list.find(x=>x.id===id);
    if(t){t.checked=!t.checked; if(t.checked){t.completedAt=Date.now();_justDoneId=t.id;} else delete t.completedAt;}
  }
  saveTasks(dk); render();
}
function toggleStar(dk,id){if(READ_ONLY)return;const t=(tasks[dk]||[]).find(x=>x.id===id);if(t){t.starred=!t.starred;saveTasks(dk);render();}}
function deleteTask(dk,id,subId) {
  if(READ_ONLY)return;
  if(!tasks[dk])return;
  let trashId=null, deletedText='';
  if(subId){
    const p=tasks[dk].find(x=>x.id===id);
    if(p&&Array.isArray(p.subs)){
      const idx=p.subs.findIndex(x=>x.id===subId);
      if(idx>=0){const removed=p.subs.splice(idx,1)[0];deletedText=removed.text;trashId=addToTrash(dk,removed,id);}
    }
  } else {
    const idx=tasks[dk].findIndex(x=>x.id===id);
    if(idx>=0){const removed=tasks[dk].splice(idx,1)[0];deletedText=removed.text;trashId=addToTrash(dk,removed,null);}
  }
  saveTasks(dk); render();
  if(trashId) showUndoToast(`"${deletedText.slice(0,16)}" 삭제했어요`,()=>restoreFromTrash(trashId));
}

// ── Trash (휴지통, 30일 보관) ──
const TRASH_KEY = USER_ID ? `calTrash_${USER_ID}` : 'calTrash';
function loadTrash(){ try{ return JSON.parse(localStorage.getItem(TRASH_KEY)||'[]'); }catch{ return []; } }
function saveTrash(trash){ localStorage.setItem(TRASH_KEY, JSON.stringify(trash)); }
function purgeOldTrash(){
  const cutoff=Date.now()-30*86400000;
  const trash=loadTrash();
  const kept=trash.filter(x=>x.deletedAt>cutoff);
  if(kept.length!==trash.length) saveTrash(kept);
}
function addToTrash(dk,task,parentId){
  const trash=loadTrash();
  const trashId=uid();
  trash.unshift({id:trashId,dk,task,parentId,deletedAt:Date.now()});
  saveTrash(trash);
  return trashId;
}
function restoreFromTrash(trashId){
  const trash=loadTrash();
  const idx=trash.findIndex(x=>x.id===trashId);
  if(idx<0)return;
  const item=trash[idx];
  if(!tasks[item.dk]) tasks[item.dk]=[];
  if(item.parentId){
    const p=tasks[item.dk].find(x=>x.id===item.parentId);
    if(p){ if(!Array.isArray(p.subs))p.subs=[]; p.subs.push(item.task); }
    else tasks[item.dk].push(item.task);
  } else {
    tasks[item.dk].push(item.task);
  }
  trash.splice(idx,1); saveTrash(trash);
  saveTasks(item.dk); render(); renderTrashModal();
}
function permanentDeleteTrash(trashId){
  const trash=loadTrash();
  saveTrash(trash.filter(x=>x.id!==trashId));
  renderTrashModal();
}
function renderTrashModal(){
  const list=document.getElementById('trashList');
  list.innerHTML='';
  const trash=loadTrash();
  if(!trash.length){ list.appendChild(el('div','trash-empty',{textContent:'아직 삭제한 항목이 없어요'})); return; }
  trash.forEach(item=>{
    const row=el('div','trash-item');
    const info=el('div','trash-info');
    info.appendChild(el('div',`trash-text${item.task.checked?' done':''}`,{textContent:(item.task.starred?'★ ':'')+item.task.text}));
    const d=parseDk(item.dk);
    const daysLeft=30-Math.floor((Date.now()-item.deletedAt)/86400000);
    info.appendChild(el('div','trash-meta',{textContent:`${d.getMonth()+1}/${d.getDate()} 삭제 · ${daysLeft}일 후 사라져요`}));
    row.appendChild(info);
    const actions=el('div','trash-actions');
    const restoreBtn=el('button','trash-act-btn',{textContent:'↩ 복구'});
    restoreBtn.onclick=()=>restoreFromTrash(item.id);
    const delBtn=el('button','trash-act-btn del',{textContent:'✕'});
    delBtn.onclick=()=>{ if(confirm('영구 삭제할까요?')) permanentDeleteTrash(item.id); };
    actions.appendChild(restoreBtn); actions.appendChild(delBtn);
    row.appendChild(actions);
    list.appendChild(row);
  });
}
document.getElementById('trashBtn').onclick=()=>{
  renderTrashModal();
  document.getElementById('trashModal').classList.remove('hidden');
};
document.getElementById('trashCloseBtn').onclick=()=>document.getElementById('trashModal').classList.add('hidden');
document.getElementById('trashModal').onclick=e=>{if(e.target===document.getElementById('trashModal'))document.getElementById('trashModal').classList.add('hidden');};

function moveTask(fromDk, taskId, toDk, silent){
  if(READ_ONLY)return;
  if(!tasks[fromDk]) return;
  const idx=tasks[fromDk].findIndex(t=>t.id===taskId);
  if(idx<0) return;
  const task=tasks[fromDk].splice(idx,1)[0];
  if(!tasks[toDk]) tasks[toDk]=[];
  tasks[toDk].push(task);
  saveTasks(fromDk); saveTasks(toDk); render();
  if(!silent){
    const d=parseDk(toDk);
    showUndoToast(`"${task.text.slice(0,16)}" → ${d.getMonth()+1}/${d.getDate()}로 옮겼어요`,()=>moveTask(toDk,taskId,fromDk,true));
  }
}
// 반복 일정의 '이 회차만' 이동: 해당 회차는 건너뛰고, 대상일에 단발 복사본 생성
function moveRepeatInstanceOne(originDk, taskId, instanceDk, toDk){
  if(READ_ONLY)return;
  const t=(tasks[originDk]||[]).find(x=>x.id===taskId);
  if(!t)return;
  if(!t.skips) t.skips={};
  t.skips[instanceDk]=true;
  const copy={
    id: uid(), text: t.text, color: t.color||null, starred: !!t.starred,
    repeat:'none', repeatEnd:null, priority: t.priority||null, time: t.time||null, duration: t.duration||null,
    checked:false, completions:{}, skips:{},
    subs:(Array.isArray(t.subs)?t.subs:[]).map(s=>({id:uid(),text:s.text,checked:false,starred:false,color:s.color||null,subs:[]})),
    memo:'', memoImages:[], memoHistory:[], comments:[], movedFromRepeat:{originDk,taskId,instanceDk}
  };
  if(!tasks[toDk]) tasks[toDk]=[];
  tasks[toDk].push(copy);
  saveTasks(originDk); saveTasks(toDk); render();
  const d=parseDk(toDk);
  showUndoToast(`이 회차만 ${d.getMonth()+1}/${d.getDate()}로 이동했어요`,()=>{
    const tt=(tasks[originDk]||[]).find(x=>x.id===taskId);
    if(tt&&tt.skips) delete tt.skips[instanceDk];
    if(tasks[toDk]) tasks[toDk]=tasks[toDk].filter(x=>x.id!==copy.id);
    if(tasks[toDk]&&!tasks[toDk].length) delete tasks[toDk];
    saveTasks(originDk); saveTasks(toDk); render();
  });
}
// 반복 일정 이동 범위 묻기: 'one'(이 회차만) / 'all'(전체 시작일 변경) / null(취소)
function askRepeatMoveScope(cb){
  const ov=el('div','modal-overlay'); const box=el('div','modal-box'); box.style.maxWidth='320px';
  box.appendChild(el('div','modal-title',{textContent:'🔄 반복 일정 이동'}));
  box.appendChild(el('div','',{textContent:'이 회차만 옮길까요, 반복 전체를 옮길까요?',style:'font-size:13px;color:var(--text2);margin-bottom:12px'}));
  const mk=(label,sub,fn,primary)=>{ const b=el('button',primary?'btn-primary':'btn-secondary',{type:'button'}); b.style.cssText='width:100%;margin-bottom:8px;text-align:left;padding:10px 12px'; b.appendChild(el('div','',{textContent:label,style:'font-weight:600'})); b.appendChild(el('div','',{textContent:sub,style:'font-size:11px;opacity:.8;margin-top:2px'})); b.onclick=()=>{ov.remove();fn();}; return b; };
  box.appendChild(mk('이 회차만 이동','선택한 날짜에 단발 일정으로 (반복은 유지)',()=>cb('one'),true));
  box.appendChild(mk('반복 전체 이동','반복 시작일을 바꿔 전체가 이동',()=>cb('all')));
  const c=el('button','btn-secondary',{type:'button',textContent:'취소'}); c.style.cssText='width:100%;margin-top:4px'; c.onclick=()=>{ov.remove();cb(null);}; box.appendChild(c);
  ov.appendChild(box); document.body.appendChild(ov); ov.onclick=e=>{ if(e.target===ov){ov.remove();cb(null);} };
}

let activeMovePopup=null;
function closeMovePopup(){ if(activeMovePopup){activeMovePopup.remove();activeMovePopup=null;} }

function openMovePopup(anchor, fromDk, taskId, repCtx){
  closeMovePopup();
  const popup=el('div','move-popup');
  const base=new Date(fromDk); base.setHours(0,0,0,0);
  const tod=today();
  // 이동 확정 — 반복 인스턴스면 '이 회차만/전체'를 물어본 뒤 실행
  const commit=(toDk)=>{
    closeMovePopup();
    if(repCtx&&repCtx.isRepeatInst){
      askRepeatMoveScope(scope=>{
        if(scope==='one') moveRepeatInstanceOne(repCtx.originDk, taskId, repCtx.instanceDk, toDk);
        else if(scope==='all') moveTask(repCtx.originDk, taskId, toDk);
      });
    } else {
      moveTask(fromDk, taskId, toDk);
    }
  };

  const opts=[
    {label:'내일',       icon:'☀️', date: (()=>{const d=new Date(tod);d.setDate(d.getDate()+1);return d;})()},
    {label:'모레',       icon:'📅', date: (()=>{const d=new Date(tod);d.setDate(d.getDate()+2);return d;})()},
    {label:'다음 주 월요일', icon:'📆', date: (()=>{const d=new Date(tod);d.setDate(d.getDate()+(8-d.getDay())%7||7);return d;})()},
  ];

  opts.forEach(opt=>{
    const toDk=dateKey(opt.date);
    if(toDk===fromDk) return;
    const btn=el('button','move-opt');
    btn.innerHTML=`<span>${opt.icon}</span><span>${opt.label}</span><span class="move-opt-date">${opt.date.getMonth()+1}/${opt.date.getDate()}</span>`;
    btn.onclick=e=>{e.stopPropagation();commit(toDk);};
    popup.appendChild(btn);
  });

  // divider + date picker
  const div=document.createElement('div'); div.className='move-popup-divider'; popup.appendChild(div);
  const pickBtn=el('button','move-opt');
  const inp=document.createElement('input');
  inp.type='date'; inp.style.cssText='border:none;background:none;font-size:12px;color:var(--text);font-family:inherit;cursor:pointer;outline:none;width:100%';
  inp.min=dateKey(new Date(tod.getTime()+86400000));
  inp.onchange=e=>{
    if(!inp.value) return;
    commit(inp.value);
  };
  pickBtn.appendChild(el('span',null,{textContent:'🗓'}));
  pickBtn.appendChild(el('span',null,{textContent:'날짜 선택'}));
  pickBtn.appendChild(inp);
  pickBtn.onclick=e=>{e.stopPropagation();inp.showPicker&&inp.showPicker();};
  popup.appendChild(pickBtn);

  // position relative to anchor
  anchor.style.position='relative';
  anchor.appendChild(popup);
  activeMovePopup=popup;
  setTimeout(()=>document.addEventListener('click',closeMovePopup,{once:true}),0);
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
function openEdit(dk,task,isRepeatInst,originDk) {
  const targetDk=isRepeatInst?originDk:dk;
  const targetTask=isRepeatInst?(tasks[originDk]||[]).find(t=>t.id===task.id):task;
  if(!targetTask)return;
  editCtx={dk:targetDk,taskId:targetTask.id};
  _editColor=targetTask.color; _editStarred=targetTask.starred; _editRepeat=targetTask.repeat||'none'; _editPriority=targetTask.priority||null;
  document.getElementById('editRepeatEnd').value=targetTask.repeatEnd||'';
  buildEditColors();
  // Set star
  const starBtn=document.getElementById('editStarBtn');
  starBtn.classList.toggle('on',_editStarred);
  // Highlight current color
  const cp=document.getElementById('editColors');
  cp.querySelectorAll('.cp-dot').forEach(d=>{
    d.classList.toggle('selected',(d.dataset.color||'')===(targetTask.color||''));
  });
  // Priority
  document.querySelectorAll('#editPrioritySel .priority-opt').forEach(b=>{
    b.classList.toggle('active',b.dataset.val===(_editPriority||''));
  });
  // Repeat
  document.querySelectorAll('#editRepeatSel .repeat-opt').forEach(b=>{
    b.classList.toggle('active',b.dataset.val===_editRepeat);
  });
  document.getElementById('editRepeatCapHint').style.display = (_editRepeat!=='none'?'flex':'none');
  document.getElementById('editTimeInput').value=targetTask.time||'';
  document.getElementById('editDuration').value=targetTask.duration||'';
  document.getElementById('editInput').value=targetTask.text;
  document.getElementById('editModal').classList.remove('hidden');
  setTimeout(()=>{const inp=document.getElementById('editInput');inp.focus();inp.select();},50);
}
function closeEdit() { document.getElementById('editModal').classList.add('hidden'); editCtx=null; }
document.getElementById('editStarBtn').onclick=function(){
  _editStarred=!_editStarred; this.classList.toggle('on',_editStarred);
};
document.querySelectorAll('#editRepeatSel .repeat-opt').forEach(b=>{
  b.onclick=()=>{
    _editRepeat=b.dataset.val;
    document.querySelectorAll('#editRepeatSel .repeat-opt').forEach(x=>x.classList.remove('active'));
    b.classList.add('active');
    document.getElementById('editRepeatCapHint').style.display = (_editRepeat!=='none'?'flex':'none');
  };
});
document.querySelectorAll('#editPrioritySel .priority-opt').forEach(b=>{
  b.onclick=()=>{
    _editPriority=b.dataset.val||null;
    document.querySelectorAll('#editPrioritySel .priority-opt').forEach(x=>x.classList.remove('active'));
    b.classList.add('active');
  };
});
document.getElementById('editSaveBtn').onclick=()=>{
  if(!editCtx)return;
  const text=document.getElementById('editInput').value.trim();
  if(!text)return;
  const t=(tasks[editCtx.dk]||[]).find(x=>x.id===editCtx.taskId);
  if(t){t.text=text;t.color=_editColor;t.starred=_editStarred;t.repeat=_editRepeat;t.priority=_editPriority;t.time=document.getElementById('editTimeInput').value||null;t.duration=document.getElementById('editDuration').value||null;t.repeatEnd=_editRepeat!=='none'?(document.getElementById('editRepeatEnd').value||null):null;if(!t.completions)t.completions={};}
  saveTasks(editCtx.dk); closeEdit(); render();
};
document.getElementById('editTimeClear').onclick=()=>{document.getElementById('editTimeInput').value='';};
document.getElementById('editRepeatEndClear').onclick=()=>{document.getElementById('editRepeatEnd').value='';};
document.getElementById('editCancelBtn').onclick=closeEdit;
document.getElementById('editModal').onclick=e=>{if(e.target===document.getElementById('editModal'))closeEdit();};

// ── Memo ──
let memoCtx = null, memoTimer = null;

function openMemo(dk, taskId, anchorEl) {
  const task = (tasks[dk]||[]).find(t=>t.id===taskId);
  if (!task) return;
  memoCtx = {dk, taskId};
  document.getElementById('memoTitle').textContent = task.text;
  const ed = document.getElementById('memoEditable');
  ed.innerHTML = memoToHtml(task.memo || '');
  ed.contentEditable = READ_ONLY ? 'false' : 'true';
  document.getElementById('memoToolbar').style.display = READ_ONLY ? 'none' : 'flex';
  updateMemoCount();
  updateMemoLinks();
  renderMemoImages(task);
  if (task.memoUpdated) {
    const d = new Date(task.memoUpdated);
    const elS = document.getElementById('memoStatus');
    elS.className = 'memo-status ok';
    elS.textContent = `수정 ${d.getMonth()+1}/${d.getDate()} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
  } else setMemoStatus('saved');
  hydrateMemoSubmemos(ed);
  positionMemo(anchorEl);
  document.getElementById('memoOverlay').classList.remove('hidden');
  if (!READ_ONLY) setTimeout(()=>ed.focus(), 40);
}
// 태스크 메모 속 하위메모 칩: 제목 채우고 클릭 시 노트 창 열기
function hydrateMemoSubmemos(ed){
  if(!ed) return;
  ed.querySelectorAll('.memo-submemo[data-note]').forEach(chip=>{
    const id=chip.dataset.note, mm=memos[id];
    chip.textContent='📄 '+(mm?(memoLabel(mm)||'하위 메모'):'삭제된 메모');
    chip.classList.toggle('missing', !mm);
    chip.onclick=e=>{ e.stopPropagation(); if(!memos[id])return; memos[id].open=true; bringNoteToFront(id); saveMemos(); renderNoteWins(); };
  });
}
// 하위 메모 추가: 새 노트를 만들고 칩을 본문에 삽입 + 노트 창 열기
function insertMemoSubmemo(){
  if(READ_ONLY || !memoCtx) return;
  const ed=document.getElementById('memoEditable'); if(!ed) return;
  const id=uid();
  memos[id]={ id, title:'', text:'', parentId:null, open:true,
    x:120, y:150, w:300, h:300, z:0, created:Date.now(),
    color:null, pinned:false, cx:null, cy:null, hist:[] };
  noteEditState[id]=true;
  saveMemos();
  ed.focus();
  document.execCommand('insertHTML', false, `<span class="memo-submemo" data-note="${id}" contenteditable="false">📄 새 하위 메모</span>&nbsp;`);
  saveMemoNow();
  hydrateMemoSubmemos(ed);
  bringNoteToFront(id); renderNoteWins();
  const elw=noteWinEls[id];
  if(elw) setTimeout(()=>{ const t=elw.querySelector('.note-title-input'); if(t)t.focus(); }, 60);
}
const _memoSubBtn=document.getElementById('memoSubBtn');
if(_memoSubBtn) _memoSubBtn.onclick=insertMemoSubmemo;

function positionMemo(anchor) {
  const pop = document.getElementById('memoPopup');
  if (window.innerWidth <= 768) return; // mobile: CSS handles it (bottom sheet)
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
    const ed = document.getElementById('memoEditable');
    const v = ed.textContent.trim() === '' && !ed.querySelector('img') ? '' : sanitizeMemoHtml(ed.innerHTML);
    if (v !== (task.memo||'')) {
      // 버전 히스토리: 직전 내용 보관 (5분 간격, 최대 5개)
      const old = task.memo||'';
      if (old.trim()) {
        if (!Array.isArray(task.memoHistory)) task.memoHistory = [];
        const last = task.memoHistory[task.memoHistory.length-1];
        if (!last || Date.now()-last.ts > 5*60*1000) {
          task.memoHistory.push({ts: task.memoUpdated||Date.now(), text: old});
          if (task.memoHistory.length > 5) task.memoHistory.shift();
        }
      }
      task.memoUpdated = Date.now();
    }
    task.memo = v;
    saveTasks(memoCtx.dk);
    render();
  }
}

// ── 메모 마크다운 → HTML 변환 (옛 메모 호환용) ──
function renderMemoMD(text){
  const esc=s=>s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  return esc(text)
    .replace(/\*\*([^*\n]+)\*\*/g,'<b>$1</b>')
    .replace(/`([^`\n]+)`/g,'<code>$1</code>')
    .replace(/(https?:\/\/[^\s<]+)/g,'<a href="$1" target="_blank" rel="noopener">$1</a>')
    .split('\n').map(l=>{
      if(/^- \[x\] /i.test(l))return '<div class="md-line md-check done">☑ '+l.slice(6)+'</div>';
      if(/^- \[ \] /.test(l))return '<div class="md-line md-check">☐ '+l.slice(6)+'</div>';
      if(/^- /.test(l))return '<div class="md-line">• '+l.slice(2)+'</div>';
      if(/^# /.test(l))return '<div class="md-line md-h">'+l.slice(2)+'</div>';
      return '<div class="md-line">'+(l||'&nbsp;')+'</div>';
    }).join('');
}
// ── 메모 HTML 변환·정화 (WYSIWYG) ──
function memoIsHtml(s){ return /<\/?(b|i|u|s|strike|em|strong|span|div|font|br|a|code|p|ul|ol|li|h[1-6]|img)\b/i.test(s); }
function sanitizeMemoHtml(html){
  const tpl=document.createElement('template'); tpl.innerHTML=html||'';
  tpl.content.querySelectorAll('script,style,iframe,object,embed,link,meta,form,input,textarea,button,svg,math').forEach(n=>n.remove());
  tpl.content.querySelectorAll('*').forEach(elx=>{
    [...elx.attributes].forEach(a=>{ const n=a.name.toLowerCase();
      if(n.startsWith('on')) elx.removeAttribute(a.name);
      else if((n==='href'||n==='src')&&/^\s*(javascript|data|vbscript):/i.test(a.value)) elx.removeAttribute(a.name);
      else if(n==='style'&&/url\s*\(/i.test(a.value)) elx.removeAttribute(a.name);
    });
  });
  return tpl.innerHTML;
}
// 저장된 메모 → 편집용 HTML (옛 마크다운 메모는 자동 변환)
function memoToHtml(memo){
  if(!memo) return '';
  return memoIsHtml(memo) ? sanitizeMemoHtml(memo) : renderMemoMD(memo);
}
// 메모(HTML 또는 마크다운) → 미리보기용 평문
function memoPlainText(memo){
  if(!memo) return '';
  if(!memoIsHtml(memo)) return memo;
  let s = memo.replace(/<\s*(br|\/div|\/p|\/h[1-6]|\/li)\s*\/?>/gi,'\n').replace(/<[^>]+>/g,'');
  const ta=document.createElement('textarea'); ta.innerHTML=s;
  return (ta.value||'').replace(/\n{2,}/g,'\n').trim();
}
// 서식 명령 실행 (execCommand 기반)
function memoExec(cmd, val){
  const ed=document.getElementById('memoEditable'); if(!ed) return;
  ed.focus();
  try{ document.execCommand('styleWithCSS', false, true); }catch(e){}
  try{ document.execCommand(cmd, false, val); }catch(e){}
  scheduleMemoSave();
}
// 선택 영역을 인라인 스타일 span으로 감싸기 (글자크기·글꼴)
function memoWrapStyle(prop, value){
  const ed=document.getElementById('memoEditable'); if(!ed) return;
  ed.focus();
  const sel=window.getSelection(); if(!sel || !sel.rangeCount) return;
  const range=sel.getRangeAt(0); if(range.collapsed) return;
  const span=document.createElement('span'); span.style[prop]=value;
  try{
    span.appendChild(range.extractContents()); range.insertNode(span);
    sel.removeAllRanges(); const r=document.createRange(); r.selectNodeContents(span); sel.addRange(r);
  }catch(e){}
  scheduleMemoSave();
}
function scheduleMemoSave(){
  updateMemoCount(); updateMemoLinks(); setMemoStatus('saving');
  clearTimeout(memoTimer);
  memoTimer=setTimeout(()=>{ saveMemoNow(); setMemoStatus('saved'); }, 700);
}
// 툴바 배선
(function initMemoToolbar(){
  const tb=document.getElementById('memoToolbar'); if(!tb) return;
  tb.querySelectorAll('.mt-btn').forEach(b=>{
    b.onmousedown=e=>e.preventDefault(); // 선택 유지
    b.onclick=()=>memoExec(b.dataset.cmd);
  });
  const font=document.getElementById('mtFont');
  if(font) font.onchange=()=>{ if(font.value) memoWrapStyle('fontFamily', font.value); font.selectedIndex=0; };
  const size=document.getElementById('mtSize');
  if(size) size.onchange=()=>{ if(size.value) memoWrapStyle('fontSize', size.value); size.selectedIndex=0; };
  const fore=document.getElementById('mtFore');
  if(fore){ fore.onmousedown=e=>e.stopPropagation(); fore.onchange=()=>memoWrapStyle('color', fore.value); }
  const back=document.getElementById('mtBack');
  if(back){ back.onmousedown=e=>e.stopPropagation(); back.onchange=()=>memoWrapStyle('backgroundColor', back.value); }
})();

// ── 메모 버전 히스토리 (최근 5개) ──
function renderMemoHistory(){
  const wrap=document.getElementById('memoHistory');
  wrap.innerHTML='';
  const task=memoTask();
  const hist=Array.isArray(task&&task.memoHistory)?task.memoHistory:[];
  if(!hist.length){
    wrap.appendChild(el('div','memo-hist-empty',{textContent:'아직 이전 버전이 없어요'}));
    return;
  }
  [...hist].reverse().forEach(h=>{
    const row=el('div','memo-hist-row');
    const d=new Date(h.ts);
    const meta=el('div','memo-hist-meta',{textContent:`${d.getMonth()+1}/${d.getDate()} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`});
    const excerpt=el('div','memo-hist-excerpt',{textContent:memoPlainText(h.text).split('\n')[0].slice(0,40)||'(빈 메모)'});
    const restoreBtn=el('button','trash-act-btn',{textContent:'복원'});
    restoreBtn.onclick=()=>{
      if(!confirm('이 버전으로 되돌릴까요? 지금 내용은 히스토리에 남아요.'))return;
      document.getElementById('memoEditable').innerHTML=memoToHtml(h.text);
      hydrateMemoSubmemos(document.getElementById('memoEditable'));
      saveMemoNow();
      updateMemoCount(); updateMemoLinks();
      document.getElementById('memoHistory').classList.add('hidden');
    };
    row.appendChild(meta); row.appendChild(excerpt); row.appendChild(restoreBtn);
    wrap.appendChild(row);
  });
}
document.getElementById('memoHistBtn').onclick=()=>{
  const wrap=document.getElementById('memoHistory');
  if(wrap.classList.contains('hidden')){renderMemoHistory();wrap.classList.remove('hidden');}
  else wrap.classList.add('hidden');
};

// ── 사용 가이드 ──
// ⚠️ 새 기능을 추가하면 반드시 아래 GUIDE_SECTIONS에도 항목을 추가할 것!
//    (배열에 추가하면 가이드 모달에 자동 반영됩니다)
const GUIDE_SECTIONS=[
  { title:'🚀 시작하기', items:[
    ['👤','내 캘린더','이름을 입력하면 나만의 URL이 만들어져요. PC·모바일 어디서든 같은 URL로 접속하면 자동 동기화돼요.'],
    ['☁️','저장','자동 저장되지만, 바로 저장하고 싶으면 헤더의 ☁️ 버튼을 눌러 주세요.'],
    ['📱','앱 설치','브라우저에서 "홈 화면에 추가"를 누르면 앱처럼 쓸 수 있어요.'],
  ]},
  { title:'🗓 화면 전환', items:[
    ['📋','일간','하루만 크게 볼 수 있어요.'],
    ['📅','주간','기본 화면이에요. 한 주를 한눈에 관리해요.'],
    ['🗓','월간','한 달 전체를 볼 수 있어요. 날짜를 누르면 주간 화면으로 이동해요.'],
    ['📆','연간','12개월 달력이에요. 점이 있으면 할 일이 있는 날이에요.'],
    ['📊','타임라인','할 일을 가로 막대로 보여줘요. 반복 패턴이 잘 보여요.'],
    ['🎯','포커스','오늘 할 일과 밀린 일만 모아서 보여줘요.'],
  ]},
  { title:'✏️ 입력 꿀팁', items:[
    ['⌨️','똑똑한 입력','"내일 3시 회의"라고 쓰면 날짜와 시간을 알아서 인식해요.'],
    ['🕐','시간 인식','"8시"→오전, "6시"→저녁으로 자동 판단해요. "오후 2시반", "14:30"도 돼요.'],
    ['🔴','중요도','🔴높음 🟡중간 🟢낮음으로 우선순위를 정할 수 있어요.'],
    ['🎨','색상','색 점을 눌러 구분해 보세요.'],
    ['🔄','반복','매주·격주·매월·N째 요일 반복을 설정할 수 있어요.'],
    ['#️⃣','태그','#태그를 쓰면 같은 태그끼리 모아볼 수 있어요.'],
  ]},
  { title:'✅ 할 일 관리', items:[
    ['★','중요 표시','별을 누르면 맨 위로 올라가요.'],
    ['🍅','집중 타이머','25분 포모도로 타이머를 시작해요.'],
    ['✏️','수정','내용·색상·중요도·반복·마감시간을 바꿀 수 있어요.'],
    ['📅','날짜 이동','다른 날짜로 옮길 수 있어요.'],
    ['✕','삭제','휴지통으로 이동해요. 30일 안에 복구할 수 있어요.'],
    ['🖱','드래그','끌어서 다른 날짜로 옮기거나 순서를 바꿀 수 있어요.'],
    ['＋','하위 항목','체크리스트를 만들 수 있어요. 진행률도 표시돼요.'],
  ]},
  { title:'📝 메모', items:[
    ['📝','메모','할 일 옆 📝 아이콘을 누르면 열려요. 자동 저장돼요.'],
    ['✍️','서식','굵게·기울임·밑줄·색상 등 서식을 적용할 수 있어요.'],
    ['📷','이미지','버튼 또는 Ctrl+V로 이미지를 첨부할 수 있어요.'],
    ['🕐','히스토리','이전 버전을 최대 5개까지 되돌릴 수 있어요.'],
    ['🔗','링크','URL을 쓰면 클릭 가능한 링크로 바뀌어요.'],
  ]},
  { title:'🔔 알림', items:[
    ['🌅','아침','매일 아침(기본 9시) 오늘 할 일을 알려줘요.'],
    ['⏰','마감 전','마감 전(기본 30분)에 미리 알려줘요.'],
    ['🌆','저녁','저녁(기본 17시)에 남은 할 일을 알려줘요.'],
    ['⏱','설정','더보기 → 알림 설정에서 시간을 바꿀 수 있어요.'],
    ['💡','참고','브라우저 탭이 열려 있어야 알림이 와요.'],
  ]},
  { title:'🔍 검색', items:[
    ['🔎','검색','제목·메모·하위 항목까지 찾아줘요.'],
    ['🎚','필터','미완료·중요·메모 있는 것만 골라 볼 수 있어요.'],
    ['🏷','태그','#태그로 관련 일정을 모아볼 수 있어요.'],
  ]},
  { title:'⋯ 더보기', items:[
    ['🔗','URL 복사','내 캘린더 주소를 복사해요.'],
    ['👁','읽기전용 링크','보기만 가능한 링크를 만들어요.'],
    ['📑','템플릿','자주 쓰는 할 일을 저장해두고 한 번에 추가해요.'],
    ['☑️','여러 개 선택','한 번에 완료·삭제할 수 있어요.'],
    ['📝','메모 전체보기','모든 메모를 한눈에 볼 수 있어요.'],
    ['🗑','휴지통','삭제한 할 일을 30일 안에 복구할 수 있어요.'],
    ['📤','내보내기','구글 캘린더나 아웃룩에서 쓸 수 있는 .ics 파일로 내보내요.'],
    ['💾','백업','모든 데이터를 파일로 저장하고 복원할 수 있어요.'],
    ['✏️','이름 변경','다른 이름으로 데이터를 옮길 수 있어요.'],
    ['📍','내 위치 날씨','날씨를 내 위치 기준으로 바꿔요.'],
    ['👤','받은 일정','다른 사람이 보낸 일정이 도착하면 알림으로 알려줘요.'],
  ]},
  { title:'⌨️ 단축키', items:[
    ['←  →','주 이동','이전/다음 주로 이동해요.'],
    ['T','오늘','이번 주로 돌아와요.'],
    ['N','새 할 일','바로 입력할 수 있어요.'],
    ['F','포커스','포커스 모드로 전환해요.'],
    ['/','검색','검색창으로 이동해요.'],
    ['D','다크모드','테마를 바꿔요.'],
  ]},
  { title:'📈 대시보드', items:[
    ['📊','이번 주','완료 수, 달성률, 연속 기록을 보여줘요.'],
    ['⭐','중요 일정','곧 다가오는 중요 일정을 보여줘요.'],
    ['📈','통계','최근 8주 완료율 추이를 볼 수 있어요.'],
  ]},
];
function renderGuide(){
  const body=document.getElementById('guideBody');
  body.innerHTML='';
  GUIDE_SECTIONS.forEach(sec=>{
    const s=el('div','guide-section');
    s.appendChild(el('div','guide-section-title',{textContent:sec.title}));
    sec.items.forEach(([icon,name,desc])=>{
      const row=el('div','guide-item');
      row.appendChild(el('div','guide-icon',{textContent:icon}));
      const txt=el('div','guide-text');
      txt.appendChild(el('span','guide-name',{textContent:name}));
      txt.appendChild(el('span','guide-desc',{textContent:' — '+desc}));
      row.appendChild(txt);
      s.appendChild(row);
    });
    body.appendChild(s);
  });
}
function openGuide(){
  renderGuide();
  document.getElementById('guideModal').classList.remove('hidden');
}
document.getElementById('guideBtn').onclick=openGuide;
document.getElementById('guideCloseBtn').onclick=()=>document.getElementById('guideModal').classList.add('hidden');
document.getElementById('guideModal').onclick=e=>{if(e.target===document.getElementById('guideModal'))document.getElementById('guideModal').classList.add('hidden');};
// 첫 방문 시 자동으로 가이드 한 번 보여주기
if(USER_ID&&!READ_ONLY&&!localStorage.getItem('guideSeen')){
  localStorage.setItem('guideSeen','1');
  setTimeout(openGuide,600);
}

// ── 템플릿 (자주 쓰는 할일 묶음) ──
const TPL_KEY = USER_ID ? `calTemplates_${USER_ID}` : 'calTemplates';
function loadTpls(){ try{return JSON.parse(localStorage.getItem(TPL_KEY)||'[]');}catch{return [];} }
function saveTpls(t){ localStorage.setItem(TPL_KEY,JSON.stringify(t)); }
function applyTemplate(tpl,dk){
  if(READ_ONLY)return;
  if(!tasks[dk])tasks[dk]=[];
  tpl.items.forEach(it=>{
    tasks[dk].push({
      id:uid(),text:it.text,checked:false,starred:!!it.starred,color:it.color||null,
      repeat:'none',priority:it.priority||null,time:it.time||null,completions:{},
      subs:(it.subs||[]).map(s=>({id:uid(),text:s.text,checked:false,starred:false,color:null,subs:[]}))
    });
  });
  saveTasks(dk);render();
}
function renderTemplateModal(){
  const list=document.getElementById('templateList');
  list.innerHTML='';
  const tpls=loadTpls();
  if(!tpls.length){
    list.appendChild(el('div','trash-empty',{textContent:'아직 템플릿이 없어요.\n아래에서 만들어 보세요.'}));
    return;
  }
  tpls.forEach((tpl,i)=>{
    const row=el('div','trash-item');
    const info=el('div','trash-info');
    info.appendChild(el('div','trash-text',{textContent:`📑 ${tpl.name}`}));
    info.appendChild(el('div','trash-meta',{textContent:tpl.items.map(it=>it.text).slice(0,3).join(', ')+(tpl.items.length>3?` 외 ${tpl.items.length-3}개`:'')+` · 총 ${tpl.items.length}개`}));
    row.appendChild(info);
    const actions=el('div','trash-actions');
    const applyBtn=el('button','trash-act-btn',{textContent:'오늘 적용'});
    applyBtn.onclick=()=>{applyTemplate(tpl,dateKey(today()));document.getElementById('templateModal').classList.add('hidden');};
    const applyDateBtn=el('button','trash-act-btn',{textContent:'날짜 선택'});
    const dateInp=document.createElement('input');
    dateInp.type='date';dateInp.style.cssText='position:absolute;opacity:0;width:0;height:0';
    dateInp.onchange=()=>{ if(dateInp.value){applyTemplate(tpl,dateInp.value);document.getElementById('templateModal').classList.add('hidden');} };
    applyDateBtn.appendChild(dateInp);
    applyDateBtn.onclick=()=>{dateInp.showPicker&&dateInp.showPicker();};
    const delBtn=el('button','trash-act-btn del',{textContent:'✕'});
    delBtn.onclick=()=>{ if(confirm('템플릿을 삭제할까요?')){const t=loadTpls();t.splice(i,1);saveTpls(t);renderTemplateModal();} };
    actions.appendChild(applyBtn);actions.appendChild(applyDateBtn);actions.appendChild(delBtn);
    row.appendChild(actions);
    list.appendChild(row);
  });
}
document.getElementById('templateBtn').onclick=()=>{
  renderTemplateModal();
  document.getElementById('tplSrcDate').value=dateKey(today());
  document.getElementById('templateModal').classList.remove('hidden');
};
document.getElementById('tplCreateBtn').onclick=()=>{
  const name=document.getElementById('tplNameInput').value.trim();
  const srcDk=document.getElementById('tplSrcDate').value;
  if(!name){alert('템플릿 이름을 입력해 주세요');return;}
  const src=(tasks[srcDk]||[]).filter(t=>t);
  if(!src.length){alert('그 날짜에는 할 일이 없어요');return;}
  const items=src.map(t=>({
    text:t.text,starred:!!t.starred,color:t.color||null,priority:t.priority||null,time:t.time||null,
    subs:(t.subs||[]).map(s=>({text:s.text}))
  }));
  const tpls=loadTpls();
  tpls.push({name,items,createdAt:Date.now()});
  saveTpls(tpls);
  document.getElementById('tplNameInput').value='';
  renderTemplateModal();
};
document.getElementById('templateCloseBtn').onclick=()=>document.getElementById('templateModal').classList.add('hidden');
document.getElementById('templateModal').onclick=e=>{if(e.target===document.getElementById('templateModal'))document.getElementById('templateModal').classList.add('hidden');};

// ── 메모 모아보기 ──
function renderMemoAllModal(){
  const list=document.getElementById('memoAllList');
  list.innerHTML='';
  const items=[];
  Object.entries(tasks).forEach(([dk,tList])=>{
    if(!Array.isArray(tList))return;
    tList.forEach(t=>{
      if(t&&((t.memo&&t.memo.trim())||(Array.isArray(t.memoImages)&&t.memoImages.length)))
        items.push({dk,task:t,ts:t.memoUpdated||parseDk(dk).getTime()});
    });
  });
  items.sort((a,b)=>b.ts-a.ts);
  if(!items.length){
    list.appendChild(el('div','trash-empty',{textContent:'아직 작성한 메모가 없어요'}));
    return;
  }
  items.forEach(({dk,task})=>{
    const row=el('div','memo-all-item');
    const d=parseDk(dk);
    const head=el('div','memo-all-head');
    head.appendChild(el('span','memo-all-task',{textContent:(task.starred?'★ ':'')+task.text}));
    head.appendChild(el('span','memo-all-date',{textContent:`${d.getMonth()+1}/${d.getDate()} (${DAY_NAMES[dateToDayIdx(d)]})`}));
    row.appendChild(head);
    const imgCnt=Array.isArray(task.memoImages)?task.memoImages.length:0;
    const excerpt=memoPlainText(task.memo).split('\n').slice(0,2).join(' / ').slice(0,80);
    row.appendChild(el('div','memo-all-excerpt',{textContent:(imgCnt?`📷${imgCnt} `:'')+excerpt}));
    row.onclick=()=>{
      document.getElementById('memoAllModal').classList.add('hidden');
      weekStart=getMonday(d);setView('week');
      setTimeout(()=>openMemo(dk,task.id,document.body),100);
    };
    list.appendChild(row);
  });
}
document.getElementById('memoAllBtn').onclick=()=>{
  renderMemoAllModal();
  document.getElementById('memoAllModal').classList.remove('hidden');
};
// 우상단 태스크 메모 버튼 — 동일 모달 재사용
{
  const _tmb=document.getElementById('taskMemoBtn');
  if(_tmb) _tmb.onclick=()=>{ renderMemoAllModal(); document.getElementById('memoAllModal').classList.remove('hidden'); };
}
document.getElementById('memoAllCloseBtn').onclick=()=>document.getElementById('memoAllModal').classList.add('hidden');
document.getElementById('memoAllModal').onclick=e=>{if(e.target===document.getElementById('memoAllModal'))document.getElementById('memoAllModal').classList.add('hidden');};

// ── 메모 이미지 (IndexedDB 로컬 저장 — 기기 간 동기화되지 않음) ──
let imgDB=null;
function openImgDB(){
  return new Promise((res)=>{
    if(typeof indexedDB==='undefined'||!indexedDB)return res(null); // 미지원 환경 가드
    if(imgDB)return res(imgDB);
    const r=indexedDB.open('plannerImages',1);
    r.onupgradeneeded=()=>r.result.createObjectStore('images');
    r.onsuccess=()=>{imgDB=r.result;res(imgDB);};
    r.onerror=()=>res(null);
  });
}
function idbPutImage(id,blob){
  return openImgDB().then(db=>db&&new Promise((res,rej)=>{
    const tx=db.transaction('images','readwrite');
    tx.objectStore('images').put(blob,id);
    tx.oncomplete=()=>res(); tx.onerror=()=>rej(tx.error);
  }));
}
function idbGetImage(id){
  return openImgDB().then(db=>db?new Promise((res,rej)=>{
    const rq=db.transaction('images','readonly').objectStore('images').get(id);
    rq.onsuccess=()=>res(rq.result||null); rq.onerror=()=>rej(rq.error);
  }):null);
}
function idbDeleteImage(id){
  return openImgDB().then(db=>db&&new Promise((res,rej)=>{
    const tx=db.transaction('images','readwrite');
    tx.objectStore('images').delete(id);
    tx.oncomplete=()=>res(); tx.onerror=()=>rej(tx.error);
  }));
}
function memoTask(){
  if(!memoCtx)return null;
  return (tasks[memoCtx.dk]||[]).find(t=>t.id===memoCtx.taskId)||null;
}
function attachMemoImage(file){
  if(!file||!file.type.startsWith('image/'))return;
  if(file.size>8*1024*1024){alert('8MB 이하 이미지만 올릴 수 있어요');return;}
  const task=memoTask(); if(!task||!memoCtx)return;
  const dk=memoCtx.dk;
  const id='img_'+uid();
  idbPutImage(id,file).then(()=>{
    if(!Array.isArray(task.memoImages))task.memoImages=[];
    task.memoImages.push(id);
    saveTasks(dk);
    if(memoCtx && memoCtx.dk===dk) renderMemoImages(task);
    render();
  }).catch(()=>alert('이미지를 저장하지 못했어요'));
}
function renderMemoImages(task){
  const wrap=document.getElementById('memoImages');
  wrap.innerHTML='';
  const ids=Array.isArray(task&&task.memoImages)?task.memoImages:[];
  wrap.style.display=ids.length?'flex':'none';
  ids.forEach(id=>{
    const thumb=el('div','memo-img-thumb'); thumb.draggable=false;
    const delBtn=el('button','memo-img-del',{textContent:'✕',title:'이미지 삭제'});
    delBtn.onclick=e=>{
      e.stopPropagation();
      const t=memoTask(); if(!t)return;
      t.memoImages=(t.memoImages||[]).filter(x=>x!==id);
      idbDeleteImage(id);
      saveTasks(memoCtx.dk);
      renderMemoImages(t);
      render();
    };
    thumb.appendChild(delBtn);
    idbGetImage(id).then(blob=>{
      if(blob){
        const url=URL.createObjectURL(blob);
        const img=el('img',null,{src:url}); img.draggable=false;
        thumb.insertBefore(img,delBtn);
        thumb.onclick=()=>{
          document.getElementById('imgLightboxImg').src=url;
          document.getElementById('imgLightbox').classList.remove('hidden');
        };
      } else {
        thumb.classList.add('missing');
        thumb.insertBefore(el('span',null,{textContent:'📵',title:'이 기기에 없는 이미지'}),delBtn);
      }
    }).catch(()=>{});
    wrap.appendChild(thumb);
  });
}
document.getElementById('memoAttachBtn').onclick=()=>document.getElementById('memoFileInput').click();
document.getElementById('memoFileInput').onchange=e=>{
  [...e.target.files].forEach(attachMemoImage);
  e.target.value='';
};
document.getElementById('memoEditable').addEventListener('paste',e=>{
  const cd=e.clipboardData||window.clipboardData; if(!cd) return;
  const files=[...(cd.files||[])].filter(f=>f.type.startsWith('image/'));
  if(files.length){ e.preventDefault(); files.forEach(attachMemoImage); return; }
  // 서식 없는 텍스트로 붙여넣기(오염 방지) — 줄바꿈 유지
  e.preventDefault();
  const text=cd.getData('text/plain');
  if(text) document.execCommand('insertText', false, text);
});
// 편집영역 내 이미지 드래그로 인한 인라인 복사 버그 방지
(()=>{
  const med=document.getElementById('memoEditable');
  med.addEventListener('dragstart',e=>{ if(e.target&&e.target.tagName==='IMG') e.preventDefault(); });
  med.addEventListener('drop',e=>{
    const dt=e.dataTransfer; if(!dt) return;
    const files=[...(dt.files||[])].filter(f=>f.type.startsWith('image/'));
    if(files.length){ e.preventDefault(); e.stopPropagation(); files.forEach(attachMemoImage); return; }
    // 이미지/HTML 인라인 드롭 차단(복사본 생성 방지) — 일반 텍스트만 허용
    const types=[...(dt.types||[])];
    if(types.includes('Files')||types.some(t=>t.startsWith('image')||t==='text/html')) e.preventDefault();
  });
})();
document.getElementById('imgLightbox').onclick=()=>{
  document.getElementById('imgLightbox').classList.add('hidden');
  document.getElementById('imgLightboxImg').src='';
};

// 메모 속 URL을 클릭 가능한 칩으로 표시
function updateMemoLinks() {
  const wrap = document.getElementById('memoLinks');
  wrap.innerHTML = '';
  const urls = ((document.getElementById('memoEditable').innerText||'').match(/https?:\/\/[^\s<>"']+/g)||[]).slice(0,6);
  urls.forEach(u=>{
    const a = el('a','memo-link-chip',{href:u,target:'_blank',rel:'noopener',textContent:'🔗 '+u.replace(/^https?:\/\//,'').slice(0,40)});
    wrap.appendChild(a);
  });
  wrap.style.display = urls.length ? 'flex' : 'none';
}

function setMemoStatus(state) {
  const el = document.getElementById('memoStatus');
  el.className = 'memo-status ' + (state==='saved'?'ok':'saving');
  el.textContent = state==='saved' ? '저장했어요 ✓' : '저장하는 중...';
}

function updateMemoCount() {
  document.getElementById('memoCharCount').textContent = (document.getElementById('memoEditable').textContent||'').length + '자';
}

document.getElementById('memoEditable').addEventListener('input', ()=>{
  updateMemoCount();
  updateMemoLinks();
  setMemoStatus('saving');
  clearTimeout(memoTimer);
  memoTimer = setTimeout(()=>{ saveMemoNow(); setMemoStatus('saved'); }, 700);
});
document.getElementById('memoClose').onclick = closeMemo;
// 바깥 클릭으로는 닫히지 않음 — ✕ 버튼 또는 ESC로만 닫힘 (오버레이는 클릭 통과)

// 메모 팝업 드래그 이동 (데스크톱)
document.getElementById('memoHeader').addEventListener('mousedown', e=>{
  if (window.innerWidth <= 768) return;
  if (e.target.closest('button')) return;
  e.preventDefault();
  const pop = document.getElementById('memoPopup');
  const sx = e.clientX, sy = e.clientY, ox = pop.offsetLeft, oy = pop.offsetTop;
  const mv = ev=>{
    let nx = ox + ev.clientX - sx, ny = oy + ev.clientY - sy;
    nx = Math.max(4, Math.min(nx, window.innerWidth - 80));
    ny = Math.max(4, Math.min(ny, window.innerHeight - 50));
    pop.style.left = nx + 'px'; pop.style.top = ny + 'px';
  };
  const up = ()=>{
    document.removeEventListener('mousemove', mv);
    document.removeEventListener('mouseup', up);
  };
  document.addEventListener('mousemove', mv);
  document.addEventListener('mouseup', up);
});

// 이미지 드래그앤드롭 첨부
const memoPopupEl = document.getElementById('memoPopup');
memoPopupEl.addEventListener('dragover', e=>{
  if ([...(e.dataTransfer&&e.dataTransfer.types||[])].includes('Files')) {
    e.preventDefault();
    memoPopupEl.classList.add('drag-over');
  }
});
memoPopupEl.addEventListener('dragleave', ()=>memoPopupEl.classList.remove('drag-over'));
memoPopupEl.addEventListener('drop', e=>{
  memoPopupEl.classList.remove('drag-over');
  const files = [...(e.dataTransfer&&e.dataTransfer.files||[])].filter(f=>f.type.startsWith('image/'));
  if (!files.length) return;
  e.preventDefault();
  files.forEach(attachMemoImage);
});

// ── Weather ──
async function fetchWeather(lat,lon) {
  weatherStatus='loading';
  try {
    const r=await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=temperature_2m_max,temperature_2m_min,weathercode,precipitation_probability_max&timezone=auto&forecast_days=16`);
    if(!r.ok) throw new Error('HTTP '+r.status);
    const d=await r.json();
    if(!d.daily||!d.daily.time) throw new Error('형식 오류');
    (d.daily.time||[]).forEach((dt,i)=>{
      const code=d.daily.weathercode[i]??0;
      weatherByDate[dt]={emoji:WMO[code]||'🌡️',desc:WMO_D[code]||'',max:Math.round(d.daily.temperature_2m_max[i]),min:Math.round(d.daily.temperature_2m_min[i]),rain:d.daily.precipitation_probability_max[i]??0};
    });
    weatherStatus='ok';
    render();
  } catch(e){ console.warn('날씨 로드 실패',e); weatherStatus='error'; render(); }
}
document.getElementById('locationBtn').onclick=()=>{
  if(!navigator.geolocation)return;
  navigator.geolocation.getCurrentPosition(p=>{
    weatherLoc={lat:p.coords.latitude,lon:p.coords.longitude,name:'내 위치'};
    fetchWeather(weatherLoc.lat,weatherLoc.lon);
  },()=>fetchWeather(weatherLoc.lat,weatherLoc.lon));
};

// ── DOM helper ──
function el(tag,cls,attrs){const e=document.createElement(tag);if(cls)e.className=cls;if(attrs)Object.assign(e,attrs);return e;}
// Enter/Space로도 활성화되는 키보드 핸들러 부착 (div/span 기반 컨트롤 접근성)
function addKbd(elem,handler){elem.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();handler(e);}};}

// ── Task item builder ──
function buildTaskItem(dk,task,isSub,parentId,isRepeatInst,originDk,instanceDk,adjusted) {
  const prioCls = (!isSub && task.priority) ? ' prio-'+task.priority : '';
  const doneCls=(!isSub&&task.id===_justDoneId)?' just-done':'';
  if(task.id===_justDoneId)_justDoneId=null;
  const item=el('div',`task-item${isSub?' sub':''}${prioCls}${doneCls}`);
  // 드래그(터치) 메타 — 데스크탑 HTML5 DnD와 동일 정보
  item._task = { dk: isRepeatInst?originDk:dk, id: task.id, isRepeat: !!isRepeatInst, instanceDk: isRepeatInst?instanceDk:null, isSub: !!isSub, parentId: parentId||null, colDk: dk };
  if(!READ_ONLY && !selectMode) attachTaskTouchDrag(item);
  const checked=isRepeatInst?isRepeatChecked(task,instanceDk):task.checked;
  // 다중 선택 모드: 일반(비반복·비하위·비대기) 태스크만 선택 가능
  const selectable = selectMode && !isSub && !task.pending && !isRepeatInst;
  let toggleSel = null;
  if(selectable){
    const selKey = dk+'|'+task.id;
    item.classList.add('selectable');
    if(bulkSelected.has(selKey)) item.classList.add('selected');
    toggleSel = (e)=>{ if(e&&e.stopPropagation) e.stopPropagation();
      if(bulkSelected.has(selKey)){ bulkSelected.delete(selKey); item.classList.remove('selected'); }
      else { bulkSelected.add(selKey); item.classList.add('selected'); }
      updateBulkBar();
    };
    item.onclick = toggleSel;
  }
  if(isSub&&!READ_ONLY&&!selectMode){
    item.draggable=true;
    item.ondragstart=e=>{
      e.stopPropagation();
      e.dataTransfer.setData('application/json',JSON.stringify({sub:true,dk:dk,parentId:parentId,id:task.id}));
      e.dataTransfer.effectAllowed='move';
      item.classList.add('dragging');
    };
    item.ondragend=e=>{ e.stopPropagation(); item.classList.remove('dragging'); };
    item.ondragover=e=>{e.preventDefault();e.stopPropagation();item.classList.add('drag-target');};
    item.ondragleave=()=>item.classList.remove('drag-target');
    item.ondrop=e=>{
      e.preventDefault();e.stopPropagation();
      item.classList.remove('drag-target');
      try{
        const data=JSON.parse(e.dataTransfer.getData('application/json'));
        if(!data||!data.sub||data.id===task.id||data.parentId!==parentId)return;
        reorderSub(dk,parentId,data.id,task.id);
      }catch(err){}
    };
  }
  if(!isSub&&!READ_ONLY&&!selectMode){
    item.draggable=true;
    item.ondragstart=e=>{
      e.dataTransfer.setData('application/json',JSON.stringify({dk:isRepeatInst?originDk:dk,id:task.id,isRepeat:!!isRepeatInst,instanceDk:isRepeatInst?instanceDk:null}));
      e.dataTransfer.effectAllowed='move';
      item.classList.add('dragging');
    };
    item.ondragend=()=>item.classList.remove('dragging');
    if(!isRepeatInst){
      item.ondragover=e=>{e.preventDefault();e.stopPropagation();item.classList.add('drag-target');};
      item.ondragleave=()=>item.classList.remove('drag-target');
      item.ondrop=e=>{
        e.preventDefault();e.stopPropagation();
        item.classList.remove('drag-target');
        try{
          const data=JSON.parse(e.dataTransfer.getData('application/json'));
          if(!data||!data.id||data.id===task.id)return;
          if(data.dk===dk&&!data.isRepeat){reorderTask(dk,data.id,task.id);}
          else if(data.isRepeat){
            askRepeatMoveScope(scope=>{
              if(scope==='one') moveRepeatInstanceOne(data.dk, data.id, data.instanceDk, dk);
              else if(scope==='all') moveTask(data.dk, data.id, dk);
            });
          }
          else{ moveTask(data.dk,data.id,dk); }
        }catch(err){}
      };
    }
  }
  if(!isSub){
    const star=el('span',`task-star${task.starred?' on':''}`,{textContent:'★',title:'중요 표시'});
    const starToggle=e=>{if(selectable){toggleSel(e);return;}e.stopPropagation();toggleStar(isRepeatInst?originDk:dk,task.id);};
    star.onclick=starToggle; addKbd(star,starToggle);
    star.setAttribute('role','button'); star.tabIndex=0;
    star.setAttribute('aria-pressed',task.starred?'true':'false');
    star.setAttribute('aria-label','중요 표시 전환');
    item.appendChild(star);
  }
  if(task.color){const dot=el('div','color-dot');dot.style.background=task.color;item.appendChild(dot);}
  const cbKey=`${isRepeatInst?originDk:dk}|${parentId||''}|${task.id}|${isRepeatInst?instanceDk:''}`;
  const cb=el('div',`task-cb${checked?' checked':''}${justToggledCb===cbKey?' cb-pop':''}`);
  if(justToggledCb===cbKey) justToggledCb=null;
  const cbToggle=e=>{if(selectable){toggleSel(e);return;}e.stopPropagation();justToggledCb=cbKey;if(isRepeatInst){if(isSub)toggleRepeatSub(originDk,parentId,task.id,instanceDk);else toggleRepeatInst(originDk,task.id,instanceDk);}else toggleTask(dk,parentId||task.id,parentId?task.id:null);};
  cb.onclick=cbToggle; addKbd(cb,cbToggle);
  cb.setAttribute('role','checkbox'); cb.tabIndex=0;
  cb.setAttribute('aria-checked',checked?'true':'false');
  cb.setAttribute('aria-label',(task.text||'할 일')+' 완료');
  item.appendChild(cb);
  const body=el('div','task-body');
  // text + memo dot (clickable to open memo)
  const textWrap=el('div','task-text-wrap');
  if(!isSub&&task.priority){
    const flagMap={high:'🔴',mid:'🟡',low:'🟢'};
    textWrap.appendChild(el('span','priority-flag',{textContent:flagMap[task.priority]||''}));
  }
  if(!isSub&&task.time){
    const now=new Date();
    const nowHM=`${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
    const todayDk=dateKey(today());
    const isOverdue=!checked&&(dk<todayDk||(dk===todayDk&&task.time<=nowHM));
    textWrap.appendChild(el('span',`time-badge${isOverdue?' overdue':''}`,{textContent:'⏰'+task.time}));
  }
  const txt=el('div',`task-text${checked?' done':''}`,{textContent:task.text});
  textWrap.appendChild(txt);
  if(!isSub){
    const hasMemo=!!(task.memo&&task.memo.trim());
    const memoBtn=el('span',`memo-icon-btn${hasMemo?' has':''}`,{textContent:'📝',title:hasMemo?'메모 보기/편집':'메모 추가'});
    memoBtn.setAttribute('role','button'); memoBtn.tabIndex=0;
    const openMemoH=e=>{e.stopPropagation();openMemo(isRepeatInst?originDk:dk,task.id,memoBtn);};
    memoBtn.onclick=openMemoH; addKbd(memoBtn,openMemoH);
    textWrap.appendChild(memoBtn);
    // 본문 탭 → 수정 모달
    const openEditH=e=>{if(selectable){toggleSel(e);return;}e.stopPropagation();openEdit(dk,task,isRepeatInst,originDk);};
    textWrap.onclick=openEditH; addKbd(textWrap,openEditH);
    textWrap.setAttribute('role','button'); textWrap.tabIndex=0;
    textWrap.setAttribute('aria-label',(task.text||'할 일')+' — 수정');
  }
  body.appendChild(textWrap);
  if(!isSub && (task.by || task.fromTeam)){
    const metaWrap=el('div','task-meta');
    if(task.by){ metaWrap.appendChild(el('span','task-by',{textContent:'👤'+task.by,title:'등록: '+task.by})); }
    if(task.fromTeam){ metaWrap.appendChild(el('span','task-fromteam',{textContent:'🤝'+((teamSubs&&teamSubs[task.fromTeam]&&teamSubs[task.fromTeam].name)||task.fromTeam),title:'팀 일정(복사본)'})); }
    body.appendChild(metaWrap);
  }
  if(!isSub){
    const tags=task.text.match(/#[\w가-힣]+/g);
    if(tags&&tags.length){
      const tagWrap=el('div','tag-chips');
      tags.forEach(tag=>{
        const chip=el('span','tag-chip',{textContent:tag});
        chip.onclick=e=>{e.stopPropagation();searchQuery=tag;document.getElementById('searchInput').value=tag;render();};
        tagWrap.appendChild(chip);
      });
      body.appendChild(tagWrap);
    }
  }
  if(!isSub&&((task.memo&&task.memo.trim())||(Array.isArray(task.memoImages)&&task.memoImages.length))){
    const firstLine=memoPlainText(task.memo).split('\n')[0];
    const imgCnt=Array.isArray(task.memoImages)?task.memoImages.length:0;
    const prev=el('div','memo-preview',{textContent:'📝 '+(imgCnt?`📷${imgCnt} `:'')+firstLine,title:'메모 열기'});
    prev.onclick=e=>{e.stopPropagation();openMemo(isRepeatInst?originDk:dk,task.id,prev);};
    body.appendChild(prev);
  }
  if(!isSub&&task.repeat&&task.repeat!=='none'){
    const repeatLabels={daily:'🔄 매일',weekdays:'🔄 평일',weekly:'🔄 매주',biweekly:'🔄 격주',monthly:'🔄 매월',monthlyNth:'🔄 N째 요일',monthlyFirstBiz:'🔄 월초 영업일',monthlyLastBiz:'🔄 월말 영업일'};
    let repLabel=repeatLabels[task.repeat]||'🔄';
    if(task.repeat==='monthlyNth'){
      const od=new Date(originDk||dk);
      repLabel=`🔄 매월 ${Math.ceil(od.getDate()/7)}째 ${'일월화수목금토'[od.getDay()]}요일`;
    }
    body.appendChild(el('div','repeat-badge',{textContent:repLabel}));
  }
  if(!isSub&&task.from){
    body.appendChild(el('div','from-badge',{textContent:'👤 '+task.from+'님이 보냄'}));
    if(task.pending&&!READ_ONLY){
      const ar=el('div','accept-row');
      const ok=el('button','accept-btn',{textContent:'✅ 수락'});
      ok.onclick=e=>{e.stopPropagation();acceptTask(dk,task.id);};
      const no=el('button','reject-btn',{textContent:'🚫 거절'});
      no.onclick=e=>{e.stopPropagation();rejectTask(dk,task.id);};
      ar.appendChild(ok); ar.appendChild(no); body.appendChild(ar);
    }
  }
  if(!isSub&&Array.isArray(task.comments)&&task.comments.length){
    const cb=el('div','comment-badge',{textContent:`💬 ${task.comments.length}`});
    cb.onclick=e=>{e.stopPropagation();openComments(dk,task.id,isRepeatInst,originDk);};
    body.appendChild(cb);
  }
  if(!isSub&&adjusted){
    body.appendChild(el('div','repeat-adjusted-badge',{textContent:'📅 휴일이라 다음 영업일로'}));
  }
  if(!isSub&&Array.isArray(task.subs)&&task.subs.length){
    const subChecked=s=>isRepeatInst?isRepeatChecked(s,instanceDk):(s&&s.checked);
    const subDone=task.subs.filter(s=>s&&subChecked(s)).length;
    const subPct=Math.round(subDone/task.subs.length*100);
    const pbWrap=el('div','subprog');
    pbWrap.appendChild(el('span','checklist-badge',{textContent:`✓ ${subDone}/${task.subs.length}`}));
    const bar=el('div','subprog-bar'); const fill=el('div','subprog-fill'); fill.style.width=subPct+'%';
    if(subPct===100)fill.classList.add('done');
    bar.appendChild(fill); pbWrap.appendChild(bar);
    body.appendChild(pbWrap);
    const sl=el('div','subtask-list');
    task.subs.forEach(s=>sl.appendChild(buildTaskItem(isRepeatInst?originDk:dk,s,true,task.id,isRepeatInst,originDk,instanceDk)));
    body.appendChild(sl);
  }
  if(!isSub){
    const addSub=el('button','add-sub-btn',{textContent:'+ 하위 항목'});
    addSub.onclick=e=>{e.stopPropagation();activeInput={dateKey:dk,dataKey:isRepeatInst?originDk:dk,parentId:task.id};render();};
    body.appendChild(addSub);
  }
  item.appendChild(body);

  if(isSub){
    // 하위 항목: 인라인 삭제 버튼만 (기능 버튼 없음 → 텍스트 폭 확보)
    const actions=el('div','task-actions');
    const delBtn=el('button','task-act-btn del',{textContent:'✕',title:'삭제'});
    delBtn.setAttribute('aria-label',(task.text||'하위 항목')+' 삭제');
    delBtn.onclick=e=>{
      e.stopPropagation();
      if(confirm('삭제할까요?')){ deleteTask(isRepeatInst?originDk:dk,parentId,task.id); }
    };
    actions.appendChild(delBtn);
    item.appendChild(actions);
    return item;
  }

  // 상위 항목: 기능 아이콘들을 ⋯ 트레이(드롭다운)로 모아 가로 공간 확보
  const actionsWrap=el('div','task-actions-wrap');
  const moreBtn=el('button','task-more-btn',{textContent:'⋯',title:'작업 메뉴'});
  moreBtn.setAttribute('aria-label','작업 메뉴 열기');
  const tray=el('div','task-actions-tray hidden');
  const closeTray=()=>tray.classList.add('hidden');
  const trayItem=(icon,label,extraCls,handler)=>{
    const b=el('button',`tray-item${extraCls?' '+extraCls:''}`,{type:'button'});
    b.appendChild(el('span','tray-ico',{textContent:icon}));
    b.appendChild(el('span',null,{textContent:label}));
    b.onclick=e=>{e.stopPropagation();closeTray();handler(e);};
    tray.appendChild(b);
    return b;
  };
  trayItem('🍅','포모도로 시작',null,()=>startPomodoroForTask(task.text));
  trayItem('✏️','수정',null,()=>openEdit(dk,task,isRepeatInst,originDk));
  trayItem('📅','다른 날짜로 이동',null,()=>{
    openMovePopup(actionsWrap, dk, task.id, isRepeatInst?{isRepeatInst:true, originDk, instanceDk}:null);
  });
  if(!isRepeatInst) trayItem('⏭','다음 영업일로 미루기',null,()=>postponeTask(dk,task.id));
  trayItem('💬','댓글',null,()=>openComments(dk,task.id,isRepeatInst,originDk));
  if(!IS_TEAM && fbDb) trayItem('🤝','팀에 등록',null,()=>registerTaskToTeam(dk,task,isRepeatInst,originDk));
  trayItem('✕','삭제','del',()=>{
    if(isRepeatInst||(task.repeat&&task.repeat!=='none')){
      openRepeatDel(isRepeatInst?originDk:dk, task.id, dk);
    } else if(confirm('삭제할까요?')) {
      deleteTask(isRepeatInst?originDk:dk,task.id,null);
    }
  });
  moreBtn.onclick=e=>{
    e.stopPropagation();
    closeMovePopup();
    const willOpen=tray.classList.contains('hidden');
    document.querySelectorAll('.task-actions-tray:not(.hidden)').forEach(t=>t.classList.add('hidden'));
    if(willOpen){
      tray.classList.remove('hidden');
      setTimeout(()=>document.addEventListener('click',closeTray,{once:true}),0);
    }
  };
  actionsWrap.appendChild(moreBtn);
  actionsWrap.appendChild(tray);
  item.appendChild(actionsWrap);
  return item;
}

// ── Input form builder ──
function buildInputForm(dk,parentId){
  let selColor=null,starred=false,selRepeat='none',selPriority=null;
  let timeInp=null;
  const form=el('div','input-form');
  const row=el('div','input-row');
  const inp=el('input','task-input');
  inp.type='text';inp.placeholder=parentId?'할 일 입력...':'할 일 입력... (예: 내일 3시 회의)';inp.id=`inp-${dk}-${parentId||'main'}`;
  row.appendChild(inp);
  if(!parentId){
    const sb=el('button','star-toggle',{type:'button',textContent:'★'});
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
    const psRow=el('div','add-field-row');
    psRow.appendChild(el('span','add-field-label',{textContent:'중요도'}));
    const ps=el('div','priority-selector');
    [['high','🔴'],['mid','🟡'],['low','🟢']].forEach(([val,icon])=>{
      const btn=el('button','priority-opt',{type:'button',textContent:icon,title:val});
      btn.onclick=()=>{
        selPriority=selPriority===val?null:val;
        ps.querySelectorAll('.priority-opt').forEach(b=>b.classList.remove('active'));
        if(selPriority)btn.classList.add('active');
      };
      ps.appendChild(btn);
    });
    psRow.appendChild(ps);
    form.appendChild(psRow);
    const rs=el('div','repeat-selector');
    [['none','없음'],['daily','매일'],['weekdays','평일'],['weekly','매주'],['biweekly','격주'],['monthly','매월'],['monthlyNth','N째요일'],['monthlyFirstBiz','월초영업일'],['monthlyLastBiz','월말영업일']].forEach(([val,label])=>{
      const btn=el('button',`repeat-opt${val==='none'?' active':''}`,{type:'button',textContent:label});
      btn.onclick=()=>{selRepeat=val;rs.querySelectorAll('.repeat-opt').forEach(b=>b.classList.remove('active'));btn.classList.add('active');};
      rs.appendChild(btn);
    });
    form.appendChild(rs);
    const timeRow=el('div','time-row');
    timeRow.appendChild(el('span','time-row-label',{textContent:'⏰ 마감시간'}));
    timeInp=el('input','time-input');timeInp.type='time';
    timeRow.appendChild(timeInp);
    form.appendChild(timeRow);
  }
  const acts=el('div','form-actions');
  const addBtn=el('button','btn-add',{type:'button',textContent:'추가'});
  const cancelBtn=el('button','btn-cancel',{type:'button',textContent:'취소'});
  addBtn.onclick=()=>{
    let v=inp.value.trim();
    if(!v){activeInput=null;render();return;}
    let targetDk=dk;
    let parsedTime=null;
    if(!parentId){
      const parsed=parseQuickDate(v);
      if(parsed&&parsed.text){ v=parsed.text; targetDk=dateKey(parsed.date); }
      const pt=parseQuickTime(v);
      if(pt&&pt.text){ v=pt.text; parsedTime=pt.time; }
    }
    addTask(targetDk,v,selColor,starred,selRepeat,parentId,selPriority,(timeInp&&timeInp.value)||parsedTime||null);
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
  if(!w&&weatherStatus==='error'){
    const retry=el('span','weather-skeleton weather-error',{textContent:'날씨를 불러오지 못했어요 · 다시 시도',title:'클릭하여 다시 시도'});
    retry.style.cursor='pointer';
    retry.onclick=()=>fetchWeather(weatherLoc.lat,weatherLoc.lon);
    bar.appendChild(retry);
  }
  else if(!w)bar.appendChild(el('span','weather-skeleton',{textContent:'날씨 로드 중...'}));
  else{
    bar.appendChild(el('span','weather-emoji',{textContent:w.emoji}));
    const info=el('div','weather-info');
    const temp=el('div','weather-temp');
    temp.innerHTML=`<span class="hi">${w.max}°</span> / <span class="lo">${w.min}°</span>`;
    info.appendChild(temp);
    info.appendChild(el('div','weather-desc',{textContent:w.desc}));
    if(w.rain>0)info.appendChild(el('div','weather-rain',{textContent:`💧 ${w.rain}%`}));
    bar.appendChild(info);
    bar.style.cursor='pointer'; bar.title='상세 날씨 보기';
    bar.onclick=()=>openWeatherDetail(dk);
  }
  return bar;
}
// 날씨 상세: 해당 날짜의 시간대별 기온/습도/강수 + 일출·일몰·자외선 (요청 시 시간별 데이터 fetch)
const weatherHourlyCache={};
function openWeatherDetail(dk){
  const _ex=document.getElementById('weatherDetailOv'); if(_ex) _ex.remove();
  const w=weatherByDate[dk];
  const d=parseDk(dk);
  const dayN=['일','월','화','수','목','금','토'][d.getDay()];
  const ov=el('div','modal-overlay'); ov.id='weatherDetailOv';
  const box=el('div','modal-box'); box.style.maxWidth='480px';
  const head=el('div','wx-head');
  head.appendChild(el('span','wx-emoji-lg',{textContent:(w&&w.emoji)||'🌡️'}));
  const ht=el('div',null); ht.style.cssText='display:flex;flex-direction:column';
  ht.appendChild(el('div','wx-date',{textContent:`${d.getMonth()+1}월 ${d.getDate()}일 (${dayN})`}));
  ht.appendChild(el('div','wx-desc-sub',{textContent:(w&&w.desc)||''}));
  head.appendChild(ht);
  box.appendChild(head);
  const body=el('div','wx-body'); body.appendChild(el('div','wx-loading',{textContent:'상세 날씨 불러오는 중…'}));
  box.appendChild(body);
  const close=el('button','btn-secondary',{type:'button',textContent:'닫기'}); close.style.cssText='width:100%;margin-top:12px'; close.onclick=()=>ov.remove();
  box.appendChild(close);
  ov.appendChild(box); document.body.appendChild(ov); ov.onclick=e=>{ if(e.target===ov)ov.remove(); };

  const renderDetail=(data)=>{
    body.innerHTML='';
    const H=(data&&data.hourly)||{}; const times=H.time||[];
    if(!times.length){ body.appendChild(el('div','wx-loading',{textContent:'아직 이 날짜의 상세 예보가 준비되지 않았어요'})); return; }
    const avg=arr=>arr&&arr.length?Math.round(arr.reduce((a,b)=>a+(+b||0),0)/arr.length):null;
    const chips=el('div','wx-chips');
    const mkChip=(label,val)=>{ const c=el('div','wx-chip'); c.appendChild(el('div','wx-chip-v',{textContent:val})); c.appendChild(el('div','wx-chip-l',{textContent:label})); chips.appendChild(c); };
    if(w) mkChip('최고/최저', `${w.max}° / ${w.min}°`);
    const humAvg=avg(H.relativehumidity_2m); if(humAvg!=null) mkChip('평균 습도', `${humAvg}%`);
    if(w&&w.rain!=null) mkChip('강수확률', `${w.rain}%`);
    if(H.windspeed_10m&&H.windspeed_10m.length) mkChip('최대 바람', `${Math.round(Math.max(...H.windspeed_10m.map(x=>+x||0)))}km/h`);
    const appAvg=avg(H.apparent_temperature); if(appAvg!=null) mkChip('평균 체감', `${appAvg}°`);
    const D=(data&&data.daily)||{};
    if(D.sunrise&&D.sunrise[0]) mkChip('일출', D.sunrise[0].slice(11,16));
    if(D.sunset&&D.sunset[0]) mkChip('일몰', D.sunset[0].slice(11,16));
    if(D.uv_index_max&&D.uv_index_max[0]!=null) mkChip('자외선 지수', String(Math.round(D.uv_index_max[0])));
    body.appendChild(chips);
    body.appendChild(el('div','wx-sec-title',{textContent:'⏱ 시간대별'}));
    const strip=el('div','wx-hourly');
    times.forEach((t,i)=>{
      const hr=+t.slice(11,13);
      const cell=el('div','wx-hr');
      cell.appendChild(el('div','wx-hr-t',{textContent:hr+'시'}));
      cell.appendChild(el('div','wx-hr-e',{textContent:WMO[(H.weathercode&&H.weathercode[i])||0]||'🌡️'}));
      const tv=H.temperature_2m&&H.temperature_2m[i]!=null?Math.round(+H.temperature_2m[i])+'°':'–';
      cell.appendChild(el('div','wx-hr-temp',{textContent:tv}));
      if(H.relativehumidity_2m&&H.relativehumidity_2m[i]!=null) cell.appendChild(el('div','wx-hr-hum',{textContent:'💧'+Math.round(+H.relativehumidity_2m[i])+'%'}));
      const pp=H.precipitation_probability&&H.precipitation_probability[i];
      if(pp>0) cell.appendChild(el('div','wx-hr-rain',{textContent:'☔'+pp+'%'}));
      strip.appendChild(cell);
    });
    body.appendChild(strip);
  };

  if(weatherHourlyCache[dk]){ renderDetail(weatherHourlyCache[dk]); return; }
  const url=`https://api.open-meteo.com/v1/forecast?latitude=${weatherLoc.lat}&longitude=${weatherLoc.lon}&hourly=temperature_2m,relativehumidity_2m,apparent_temperature,precipitation_probability,weathercode,windspeed_10m&daily=sunrise,sunset,uv_index_max&timezone=auto&start_date=${dk}&end_date=${dk}`;
  fetch(url).then(r=>r.ok?r.json():Promise.reject()).then(j=>{ weatherHourlyCache[dk]=j; renderDetail(j); })
    .catch(()=>{ body.innerHTML=''; body.appendChild(el('div','wx-loading',{textContent:'상세 날씨를 불러오지 못했어요'})); });
}

// ── Day column ──
function buildDayCol(date,dayIdx){
  const dk=dateKey(date);
  const isToday=date.getTime()===today().getTime();
  const isWeekend=dayIdx>=5;
  const isOff=!!offDays[dk];
  const holiday=HOLIDAYS[dk]||(isOff?'휴무일':null);
  const col=el('div',`day-col${isToday?' is-today':''}${isWeekend?' is-weekend':''}${holiday?' is-holiday':''}`);
  col.dataset.dk=dk;
  col.ondragover=e=>{e.preventDefault();col.classList.add('drag-over');};
  col.ondragleave=()=>col.classList.remove('drag-over');
  col.ondrop=e=>{
    e.preventDefault();
    col.classList.remove('drag-over');
    try{
      const data=JSON.parse(e.dataTransfer.getData('application/json'));
      if(!data||!data.dk||!data.id||data.dk===dk) return;
      if(data.isRepeat){
        askRepeatMoveScope(scope=>{
          if(scope==='one') moveRepeatInstanceOne(data.dk, data.id, data.instanceDk, dk);
          else if(scope==='all') moveTask(data.dk, data.id, dk);
        });
      } else { moveTask(data.dk,data.id,dk); }
    }catch(err){}
  };
  // header
  const hdr=el('div','day-header');
  hdr.appendChild(el('div','day-name',{textContent:DAY_NAMES[dayIdx]+'요일'}));
  const nw=el('div','day-num-wrap');
  nw.appendChild(el('div','day-num',{textContent:date.getDate()}));
  hdr.appendChild(nw);
  hdr.appendChild(el('div','day-month',{textContent:`${date.getMonth()+1}월`}));
  if(holiday) hdr.appendChild(el('div','holiday-label',{textContent:(HOLIDAYS[dk]?'🎌 ':'🏖 ')+holiday}));
  if(!READ_ONLY){
    const offBtn=el('button','offday-btn',{textContent:isOff?'🏖 휴무 해제':'🏖 휴무일',title:isOff?'휴무일 해제':'휴무일로 지정 — 이 날의 할 일은 다음 영업일로 이동'});
    offBtn.onclick=e=>{e.stopPropagation();toggleOffDay(dk);};
    hdr.appendChild(offBtn);
  }
  // task count + mini progress (반복 인스턴스는 해당 날짜의 체크 상태 기준)
  const dayTasks=visibleStored(dk).filter(t=>!(t&&t.repeat&&t.repeat!=='none'&&t.skips&&t.skips[dk]));
  const countTasks=dayTasks.filter(t=>!(t&&t.pending));
  const repeatEntries=getRepeatTasksForDate(date,dayIdx);
  const total=countTasks.length+repeatEntries.length;
  const done=countTasks.filter(t=>t&&t.checked).length
    +repeatEntries.filter(({task,instanceDk})=>isRepeatChecked(task,instanceDk)).length;
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
  if(isToday && !READ_ONLY && !holiday){
    const y=new Date(date); y.setDate(y.getDate()-1);
    const ydk=dateKey(y);
    const pendingCnt=(tasks[ydk]||[]).filter(t=>t&&!t.pending&&!t.checked&&(!t.repeat||t.repeat==='none')).length;
    if(pendingCnt>0){
      const banner=el('button','carryover-banner',{textContent:`⏬ 어제 못 끝낸 ${pendingCnt}개 가져오기`});
      banner.onclick=()=>carryOverFrom(ydk,dk);
      col.appendChild(banner);
    }
  }
  // tasks
  const list=el('div','tasks-list');
  const sorted=[...dayTasks].sort(taskSort).filter(matchesQuery);
  sorted.forEach(t=>list.appendChild(buildTaskItem(dk,t,false,null,false,null,null)));
  getRepeatTasksForDate(date,dayIdx).filter(({task})=>matchesQuery(task)).forEach(({task,originDk,instanceDk,adjusted})=>{
    list.appendChild(buildTaskItem(dk,task,false,null,true,originDk,instanceDk,adjusted));
  });
  // 👥 공유받은 일정 (읽기 전용)
  const sharedRows = sharedTasksFor(dk);
  sharedRows.forEach(({owner, task, color}) => {
    const row = el('div', 'shared-task');
    const chip = el('span', 'shared-owner', {textContent: '👤' + owner});
    chip.style.background = color;
    row.appendChild(chip);
    row.appendChild(el('span', `shared-text${task.checked ? ' done' : ''}`, {textContent: (task.time ? task.time + ' ' : '') + task.text}));
    row.title = `${owner}님의 일정`;
    list.appendChild(row);
  });
  const icsRows = icsEventsFor(dk);
  icsRows.forEach(ev => {
    const row = el('div', 'shared-task');
    const chip = el('span', 'shared-owner', {textContent: '📅'});
    chip.style.background = ev.color;
    chip.title = ev.src;
    row.appendChild(chip);
    row.appendChild(el('span', 'shared-text', {textContent: (ev.time ? ev.time + ' ' : '') + ev.title}));
    row.title = `${ev.src} (외부 캘린더)`;
    list.appendChild(row);
  });
  if(total===0&&sharedRows.length===0&&icsEventsFor(dk).length===0){
    const empty=el('div','day-empty');
    empty.appendChild(el('div','day-empty-icon',{textContent:'○'}));
    empty.appendChild(el('div','day-empty-text',{textContent:READ_ONLY?'아직 할 일이 없어요':'여기를 눌러 할 일을 추가해요'}));
    if(!READ_ONLY){
      empty.setAttribute('role','button'); empty.tabIndex=0; empty.style.cursor='pointer';
      const openInput=()=>{activeInput={dateKey:dk,parentId:null};render();};
      empty.onclick=openInput; if(typeof addKbd==='function') addKbd(empty,openInput);
    }
    list.appendChild(empty);
  }
  const ai=activeInput;
  if(ai&&ai.dateKey===dk&&ai.parentId) list.appendChild(buildInputForm(ai.dataKey||dk,ai.parentId));
  col.appendChild(list);
  if(ai&&ai.dateKey===dk&&!ai.parentId) col.appendChild(buildInputForm(dk,null));
  else{
    const addBtn=el('button','add-task-btn',{innerHTML:'+ 할 일 추가'});
    addBtn.onclick=()=>{activeInput={dateKey:dk,parentId:null};render();};
    col.appendChild(addBtn);
  }
  col.appendChild(buildWeatherBar(dk));
  return col;
}

// ── 시간표(타임블로킹) 뷰 ──
function buildTimeblockView(){
  const wrap=el('div','timeblock-wrap');
  const dk=dateKey(dayDate);
  const dayIdx=dateToDayIdx(dayDate);
  // 그 날의 모든 항목 수집 (직접+반복)
  const items=[];
  tasksForDate(dayDate,dayIdx).forEach(e=>{ if(matchesQuery(e.task)) items.push({t:e.task,isRepeat:e.isRepeat,originDk:e.originDk,instanceDk:e.instanceDk}); });
  const timed=items.filter(x=>x.t.time).sort((a,b)=>a.t.time<b.t.time?-1:1);
  const untimed=items.filter(x=>!x.t.time);

  const START_H=6, END_H=24, HOUR_PX=52;
  const grid=el('div','tb-grid');
  // 시간 눈금
  const axis=el('div','tb-axis');
  for(let h=START_H;h<END_H;h++){
    const row=el('div','tb-hour');
    row.style.height=HOUR_PX+'px';
    row.appendChild(el('span','tb-hour-label',{textContent:`${String(h).padStart(2,'0')}:00`}));
    axis.appendChild(row);
  }
  grid.appendChild(axis);
  // 일정 레인
  const lane=el('div','tb-lane');
  lane.style.height=(END_H-START_H)*HOUR_PX+'px';
  // 시간선 (지금)
  if(dk===todayKey()){
    const now=new Date();
    const mins=(now.getHours()*60+now.getMinutes())-START_H*60;
    if(mins>=0&&mins<=(END_H-START_H)*60){
      const nl=el('div','tb-nowline'); nl.style.top=(mins/60*HOUR_PX)+'px';
      nl.appendChild(el('span','tb-now-label',{textContent:'지금'}));
      lane.appendChild(nl);
    }
  }
  // 겹침 감지용
  const placed=[];
  timed.forEach(({t,isRepeat,originDk,instanceDk})=>{
    const [hh,mm]=t.time.split(':').map(Number);
    const startMin=hh*60+mm-START_H*60;
    if(startMin<0||startMin>(END_H-START_H)*60) return;
    const dur=+t.duration||30;
    const checked=isRepeat?isRepeatChecked(t,instanceDk):t.checked;
    const blk=el('div',`tb-block${checked?' done':''}`);
    blk.style.top=(startMin/60*HOUR_PX)+'px';
    blk.style.height=Math.max(20,dur/60*HOUR_PX-3)+'px';
    if(t.color)blk.style.borderLeftColor=t.color;
    // 겹침 → 가로 분할
    const endMin=startMin+dur;
    const overlaps=placed.filter(p=>startMin<p.end&&endMin>p.start);
    const col=overlaps.length;
    blk.style.left=`calc(${col*48}px + 2px)`;
    if(col>0)blk.classList.add('tb-overlap');
    placed.push({start:startMin,end:endMin});
    blk.appendChild(el('div','tb-block-time',{textContent:t.time+(t.duration?`~${addMin(t.time,dur)}`:'')}));
    blk.appendChild(el('div','tb-block-text',{textContent:t.text}));
    blk.onclick=()=>openEdit(dk,t,isRepeat,originDk);
    lane.appendChild(blk);
  });
  grid.appendChild(lane);
  wrap.appendChild(grid);

  // 시간 미지정 항목
  if(untimed.length){
    const ut=el('div','tb-untimed');
    ut.appendChild(el('div','tb-untimed-title',{textContent:'🕒 시간 미지정'}));
    const ul=el('div','tasks-list');
    untimed.forEach(({t,isRepeat,originDk,instanceDk})=>ul.appendChild(buildTaskItem(dk,t,false,null,isRepeat,originDk,instanceDk)));
    ut.appendChild(ul);
    wrap.appendChild(ut);
  }
  if(!items.length){
    wrap.appendChild(el('div','focus-empty',{textContent:'이 날 일정이 없어요 — 시간을 지정하면 여기 블록으로 표시돼요'}));
  }
  return wrap;
}
function addMin(time,min){
  const [h,m]=time.split(':').map(Number);
  const tot=h*60+m+min;
  return `${String(Math.floor(tot/60)%24).padStart(2,'0')}:${String(tot%60).padStart(2,'0')}`;
}

// ── Focus view (오늘 포커스) ──
function buildFocusView(){
  const wrap=el('div','calendar-wrap');
  const container=el('div','focus-wrap');
  const now=today();
  const dk=dateKey(now);
  const dayIdx=dateToDayIdx(now);

  // 오늘
  const sec1=el('div','focus-section');
  sec1.appendChild(el('div','focus-section-title',{textContent:`📌 오늘 · ${now.getMonth()+1}월 ${now.getDate()}일 (${DAY_NAMES[dayIdx]})`}));
  const list1=el('div','tasks-list focus-list');
  const directToday=visibleStored(dk).filter(matchesQuery);
  const repeatsToday=getRepeatTasksForDate(now,dayIdx).filter(({task})=>matchesQuery(task));
  const sortedDirect=[...directToday].sort(taskSort);
  sortedDirect.forEach(t=>list1.appendChild(buildTaskItem(dk,t,false,null,false,null,null)));
  repeatsToday.forEach(({task,originDk,instanceDk,adjusted})=>list1.appendChild(buildTaskItem(dk,task,false,null,true,originDk,instanceDk,adjusted)));
  if(!sortedDirect.length&&!repeatsToday.length) list1.appendChild(el('div','focus-empty',{textContent:'오늘 할 일이 없어요 🎉'}));
  sec1.appendChild(list1);
  container.appendChild(sec1);

  // 지난 미완료
  const overdue=[];
  Object.entries(tasks).forEach(([odk,list])=>{
    if(!Array.isArray(list))return;
    const d=new Date(odk); d.setHours(0,0,0,0);
    if(d>=now)return;
    list.forEach(t=>{ if(t&&!t.checked&&matchesQuery(t)) overdue.push({dk:odk,task:t,date:d}); });
  });
  overdue.sort((a,b)=>b.date-a.date);
  if(overdue.length){
    const sec2=el('div','focus-section');
    sec2.appendChild(el('div','focus-section-title',{textContent:`⚠️ 지난 미완료 (${overdue.length})`}));
    const list2=el('div','tasks-list focus-list');
    overdue.slice(0,30).forEach(({dk:odk,task})=>{
      const item=buildTaskItem(odk,task,false,null,false,null,null);
      item.querySelector('.task-body').appendChild(el('span','focus-date-badge',{textContent:`${new Date(odk).getMonth()+1}/${new Date(odk).getDate()}`}));
      list2.appendChild(item);
    });
    sec2.appendChild(list2);
    container.appendChild(sec2);
  }
  wrap.appendChild(container);
  return wrap;
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
  const holiday=HOLIDAYS[dk]||(offDays[dk]?'휴무일':null);
  const cell=el('div',`month-cell${isToday?' is-today':''}${isOther?' other-month':''}${isWeekend?' is-weekend':''}${holiday?' is-holiday':''}`);
  if(isToday){const c=el('div','month-today-circle',{textContent:date.getDate()});cell.appendChild(c);}
  else cell.appendChild(el('div','month-date-num',{textContent:date.getDate()}));
  if(holiday) cell.appendChild(el('div','month-holiday-label',{textContent:(HOLIDAYS[dk]?'🎌 ':'🏖 ')+holiday}));
  const directList=(Array.isArray(tasks[dk])?tasks[dk]:[]).filter(t=>!(t&&t.repeat&&t.repeat!=='none'&&t.skips&&t.skips[dk]));
  let repeatEntries=[];
  try{repeatEntries=getRepeatTasksForDate(date,dayIdx);}catch(e){}
  const allItems=[
    ...directList.filter(matchesQuery).map(t=>({t,checked:t.checked})),
    ...repeatEntries.filter(({task})=>matchesQuery(task)).map(({task,instanceDk})=>({t:task,checked:isRepeatChecked(task,instanceDk)}))
  ];
  allItems.slice(0,3).forEach(({t,checked})=>{
    const pill=el('div',`month-pill${checked?' done':''}${t.color?' colored':''}`);
    if(t.color){pill.style.background=t.color;pill.style.opacity=checked?'.5':'1';}
    pill.textContent=(t.starred?'★ ':'')+t.text;
    cell.appendChild(pill);
  });
  if(allItems.length>3) cell.appendChild(el('div','month-more',{textContent:`+${allItems.length-3}개 더`}));
  const shCnt = sharedTasksFor(dk).length;
  if (shCnt) cell.appendChild(el('div', 'month-shared', {textContent: `👥 ${shCnt}`}));
  cell.onclick=()=>{weekStart=getMonday(date);setView('week');};
  return cell;
}

// ── Day view (일간) ──
let dayViewMode='list';
function buildDayView(){
  const wrap=el('div','day-view-wrap');
  const toggle=el('div','day-mode-toggle');
  [['list','📋 목록'],['time','🕐 타임라인']].forEach(([v,label])=>{
    const b=el('button',`day-mode-btn${dayViewMode===v?' active':''}`,{textContent:label});
    b.onclick=()=>{dayViewMode=v;render();};
    toggle.appendChild(b);
  });
  wrap.appendChild(toggle);
  if(dayViewMode==='list') wrap.appendChild(buildDayCol(new Date(dayDate),dateToDayIdx(dayDate)));
  else wrap.appendChild(buildDayTimeline());
  return wrap;
}
function buildDayTimeline(){
  const dk=dateKey(dayDate);
  const dayIdx=dateToDayIdx(dayDate);
  const box=el('div','timeblock-box');
  const items=[];
  try{ tasksForDate(dayDate,dayIdx).forEach(e=>{ if(matchesQuery(e.task)) items.push({task:e.task,isRepeat:e.isRepeat,originDk:e.originDk,instanceDk:e.instanceDk}); }); }catch(e){}
  const untimed=items.filter(x=>!x.task.time);
  if(untimed.length){
    const sec=el('div','timeblock-untimed');
    sec.appendChild(el('div','timeblock-untimed-title',{textContent:'☰ 시간 미지정'}));
    untimed.forEach(x=>sec.appendChild(buildTaskItem(dk,x.task,false,null,x.isRepeat,x.originDk,x.instanceDk)));
    box.appendChild(sec);
  }
  const grid=el('div','timeblock-grid');
  const isTodayView=dateKey(today())===dk;
  for(let h=6;h<=23;h++){
    const row=el('div','timeblock-row'+(isTodayView&&new Date().getHours()===h?' now':''));
    row.appendChild(el('div','timeblock-hour',{textContent:`${String(h).padStart(2,'0')}:00`}));
    const slot=el('div','timeblock-slot');
    items.filter(x=>x.task.time&&parseInt(x.task.time.split(':')[0],10)===h)
      .sort((a,b)=>a.task.time<b.task.time?-1:1)
      .forEach(x=>slot.appendChild(buildTaskItem(dk,x.task,false,null,x.isRepeat,x.originDk,x.instanceDk)));
    row.appendChild(slot);
    grid.appendChild(row);
  }
  box.appendChild(grid);
  return box;
}

// ── Year view (연간) ──
function buildYearView(){
  const wrap=el('div','year-wrap');
  const grid=el('div','year-grid');
  for(let m=0;m<12;m++) grid.appendChild(buildYearMonth(yearNum,m));
  wrap.appendChild(grid);
  return wrap;
}
function buildYearMonth(year,month){
  const box=el('div','year-month');
  const isCurMonth=year===new Date().getFullYear()&&month===new Date().getMonth();
  box.appendChild(el('div',`year-month-title${isCurMonth?' cur':''}`,{textContent:`${month+1}월`}));
  const dowRow=el('div','year-mini-grid year-dow-row');
  DAY_NAMES.forEach(n=>dowRow.appendChild(el('div','year-dow',{textContent:n[0]})));
  box.appendChild(dowRow);
  const grid=el('div','year-mini-grid');
  const firstDay=new Date(year,month,1);
  const lastDay=new Date(year,month+1,0);
  let cur=getMonday(firstDay);
  while(cur<=lastDay){
    for(let i=0;i<7;i++){
      const d=new Date(cur);
      if(d.getMonth()!==month){grid.appendChild(el('div','year-day other'));}
      else{
        const dk=dateKey(d);
        const isToday=d.getTime()===today().getTime();
        const isWeekend=d.getDay()===0||d.getDay()===6;
        const holiday=HOLIDAYS[dk]||(offDays[dk]?'휴무일':null);
        let hasTasks=Array.isArray(tasks[dk])&&tasks[dk].length>0;
        if(!hasTasks){try{hasTasks=getRepeatTasksForDate(d,dateToDayIdx(d)).length>0;}catch(e){}}
        const cell=el('div',`year-day${isToday?' is-today':''}${isWeekend||holiday?' weekend':''}${hasTasks?' has-tasks':''}`,{textContent:d.getDate()});
        cell.onclick=e=>{e.stopPropagation();weekStart=getMonday(d);setView('week');};
        grid.appendChild(cell);
      }
      cur.setDate(cur.getDate()+1);
    }
  }
  box.appendChild(grid);
  box.onclick=()=>{monthDate=new Date(year,month,1);setView('month');};
  return box;
}

// ── Timeline (간트) view ──
function buildTimelineView(){
  const wrap=el('div','gantt-wrap');
  const year=monthDate.getFullYear(),month=monthDate.getMonth();
  const daysInMonth=new Date(year,month+1,0).getDate();
  // 이번 달 모든 할 일 수집 (반복 일정은 한 행으로 합침)
  const repRows={},rows=[];
  for(let d=1;d<=daysInMonth;d++){
    const date=new Date(year,month,d);
    const dk=dateKey(date);
    visibleStored(dk).forEach(t=>{
      if(!t||!matchesQuery(t))return;
      if(t.repeat&&t.repeat!=='none'){
        if(!repRows[t.id])repRows[t.id]={task:t,cells:[]};
        repRows[t.id].cells.push({d,checked:t.checked,date});
      } else rows.push({task:t,cells:[{d,checked:t.checked,date}]});
    });
    try{
      getRepeatTasksForDate(date,dateToDayIdx(date)).forEach(({task,instanceDk})=>{
        if(!matchesQuery(task))return;
        if(!repRows[task.id])repRows[task.id]={task,cells:[]};
        repRows[task.id].cells.push({d,checked:isRepeatChecked(task,instanceDk),date});
      });
    }catch(e){}
  }
  const allRows=[...rows,...Object.values(repRows)].sort((a,b)=>a.cells[0].d-b.cells[0].d);
  if(!allRows.length){
    wrap.appendChild(el('div','search-empty',{textContent:'이번 달 할 일이 없어요'}));
    return wrap;
  }
  const scroller=el('div','gantt-scroller');
  const gridTemplate=`minmax(150px,200px) repeat(${daysInMonth},minmax(22px,1fr))`;
  const todayDk=dateKey(today());
  // 헤더 (날짜)
  const hdr=el('div','gantt-row gantt-header');
  hdr.style.gridTemplateColumns=gridTemplate;
  hdr.appendChild(el('div','gantt-name-cell gantt-hdr-cell',{textContent:'할 일'}));
  for(let d=1;d<=daysInMonth;d++){
    const date=new Date(year,month,d);
    const isWeekend=date.getDay()===0||date.getDay()===6;
    const isToday=dateKey(date)===todayDk;
    const c=el('div',`gantt-hdr-cell gantt-day-num${isWeekend?' weekend':''}${isToday?' is-today':''}`,{textContent:d});
    hdr.appendChild(c);
  }
  scroller.appendChild(hdr);
  // 행
  allRows.forEach(({task,cells})=>{
    const row=el('div','gantt-row');
    row.style.gridTemplateColumns=gridTemplate;
    const name=el('div','gantt-name-cell');
    if(task.color){const dot=el('span','color-dot');dot.style.background=task.color;dot.style.marginTop='0';name.appendChild(dot);}
    const isRepeat=task.repeat&&task.repeat!=='none';
    name.appendChild(el('span','gantt-name-text',{textContent:(task.starred?'★ ':'')+(isRepeat?'🔄 ':'')+task.text}));
    name.onclick=()=>{weekStart=getMonday(cells[0].date);setView('week');};
    row.appendChild(name);
    const cellMap={};cells.forEach(c=>cellMap[c.d]=c);
    for(let d=1;d<=daysInMonth;d++){
      const date=new Date(year,month,d);
      const isWeekend=date.getDay()===0||date.getDay()===6;
      const isToday=dateKey(date)===todayDk;
      const cell=el('div',`gantt-cell${isWeekend?' weekend':''}${isToday?' is-today':''}`);
      if(cellMap[d]){
        const bar=el('div',`gantt-bar${cellMap[d].checked?' done':''}`);
        if(task.color)bar.style.background=task.color;
        bar.title=`${month+1}/${d} · ${task.text}${cellMap[d].checked?' (완료)':''}`;
        bar.onclick=()=>{weekStart=getMonday(cellMap[d].date);setView('week');};
        cell.appendChild(bar);
      }
      row.appendChild(cell);
    }
    scroller.appendChild(row);
  });
  wrap.appendChild(scroller);
  return wrap;
}

// ── Search ──
let tagFilter = null;
let attrFilter = { incomplete:false, starred:false, prio:null, memo:false, timed:false, repeat:false, done:false, color:null };
function attrFilterActive(){ return attrFilter.incomplete||attrFilter.starred||attrFilter.memo||!!attrFilter.prio||attrFilter.timed||attrFilter.repeat||attrFilter.done||!!attrFilter.color; }
function allTaskTags(){
  const set = new Set();
  Object.values(tasks).forEach(list => Array.isArray(list) && list.forEach(t => {
    if (!t || !t.text) return;
    (t.text.match(/#[\w가-힣]+/g) || []).forEach(tag => set.add(tag));
  }));
  return [...set].sort();
}
function matchesQuery(t){
  if(tagFilter && !(t.text && t.text.includes(tagFilter))) return false;
  if(attrFilter.starred && !t.starred) return false;
  if(attrFilter.prio && t.priority!==attrFilter.prio) return false;
  if(attrFilter.memo && !((t.memo&&t.memo.trim())||(Array.isArray(t.memoImages)&&t.memoImages.length))) return false;
  if(attrFilter.incomplete && t.checked) return false;
  if(attrFilter.done && !t.checked) return false;
  if(attrFilter.timed && !t.time) return false;
  if(attrFilter.repeat && !(t.repeat && t.repeat!=='none')) return false;
  if(attrFilter.color && t.color!==attrFilter.color) return false;
  if(!searchQuery) return true;
  const q=searchQuery.toLowerCase();
  return (t.text&&t.text.toLowerCase().includes(q))||(t.memo&&t.memo.toLowerCase().includes(q))||(Array.isArray(t.subs)&&t.subs.some(s=>s&&s.text&&s.text.toLowerCase().includes(q)));
}
function buildTagFilterBar(){
  const tags = allTaskTags();
  const bar = el('div', 'tag-filter-bar');
  // 상태/속성 필터 칩 (항상 표시)
  const toggle=(key,label,val)=>{
    const on = val!==undefined ? attrFilter[key]===val : attrFilter[key];
    const chip = el('button', `tag-filter-chip attr-chip${on?' active':''}`, {textContent: label});
    chip.setAttribute('aria-pressed', on?'true':'false');
    chip.onclick = () => { if(val!==undefined) attrFilter[key]=(attrFilter[key]===val?null:val); else attrFilter[key]=!attrFilter[key]; render(); };
    bar.appendChild(chip);
  };
  bar.appendChild(el('span','',{textContent:'필터',style:'font-size:11px;color:var(--text3)'}));
  toggle('incomplete','◻ 미완료');
  toggle('done','✅ 완료');
  toggle('starred','★ 중요');
  toggle('prio','🔴 높음','high');
  toggle('timed','⏰ 시간');
  toggle('repeat','🔁 반복');
  toggle('memo','📝 메모');
  // 색상별 필터 (색 점)
  (typeof COLORS!=='undefined'?COLORS:[]).forEach(c=>{
    const on=attrFilter.color===c.hex;
    const dot=el('button',`tag-filter-chip color-filter-chip${on?' active':''}`,{title:'색: '+c.name});
    dot.innerHTML=`<span class="cf-dot" style="background:${c.hex}"></span>`;
    dot.onclick=()=>{ attrFilter.color=on?null:c.hex; render(); };
    bar.appendChild(dot);
  });
  if(attrFilterActive()){
    const clr=el('button','tag-filter-chip attr-clear',{textContent:'✕ 해제'});
    clr.onclick=()=>{ attrFilter={incomplete:false,starred:false,prio:null,memo:false}; render(); };
    bar.appendChild(clr);
  }
  // 태그 칩 (태그가 있을 때만)
  if(tags.length){
    bar.appendChild(el('span','',{textContent:'🏷',style:'font-size:12px;margin-left:6px'}));
    const allChip = el('button', `tag-filter-chip${tagFilter ? '' : ' active'}`, {textContent: '전체'});
    allChip.onclick = () => { tagFilter = null; render(); };
    bar.appendChild(allChip);
    tags.forEach(tag => {
      const chip = el('button', `tag-filter-chip${tagFilter === tag ? ' active' : ''}`, {textContent: tag});
      chip.onclick = () => { tagFilter = (tagFilter === tag ? null : tag); render(); };
      bar.appendChild(chip);
    });
  }
  return bar;
}

function buildSearchView(query){
  const wrap=el('div','search-results-wrap');
  if(!query.trim()){wrap.appendChild(el('div','search-empty',{textContent:'검색어를 입력해 주세요'}));return wrap;}
  const q=query.toLowerCase();
  const results=[];
  Object.entries(tasks).forEach(([dk,list])=>{
    if(!Array.isArray(list)) return;
    list.forEach(t=>{
      if(!t) return;
      const subsMatch=Array.isArray(t.subs)&&t.subs.some(s=>s&&s.text&&s.text.toLowerCase().includes(q));
      const memoMatch=t.memo&&t.memo.toLowerCase().includes(q);
      if(t.text&&t.text.toLowerCase().includes(q)||subsMatch||memoMatch)
        results.push({dk,task:t});
    });
  });
  results.sort((a,b)=>b.dk.localeCompare(a.dk));
  // 스탠드얼론 메모장 검색 (제목·본문)
  const noteHits=Object.values(memos).filter(mm=>(mm.title+' '+mm.text).toLowerCase().includes(q));
  if(noteHits.length){
    const grp=el('div','search-result-group');
    grp.appendChild(el('div','search-result-date',{textContent:`📝 메모장 (${noteHits.length})`}));
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
  if(!results.length&&!noteHits.length){wrap.appendChild(el('div','search-empty',{textContent:`"${query}"에 해당하는 결과가 없어요`}));return wrap;}
  if(!results.length)return wrap;
  const groups={};
  results.forEach(({dk,task})=>{if(!groups[dk])groups[dk]=[];groups[dk].push(task);});
  Object.entries(groups).sort((a,b)=>b[0].localeCompare(a[0])).forEach(([dk,list])=>{
    const grp=el('div','search-result-group');
    const d=parseDk(dk);
    grp.appendChild(el('div','search-result-date',{textContent:`${d.getFullYear()}년 ${d.getMonth()+1}월 ${d.getDate()}일 (${DAY_NAMES[dateToDayIdx(d)]})`}));
    list.forEach(t=>{
      const item=el('div','search-result-item');
      if(t.color){const dot=el('div','color-dot');dot.style.background=t.color;dot.style.flexShrink='0';item.appendChild(dot);}
      const cb=el('div',`task-cb${t.checked?' checked':''}`);
      cb.onclick=e=>{e.stopPropagation();toggleTask(dk,t.id,null);};
      item.appendChild(cb);
      item.appendChild(el('span','search-result-text',{textContent:(t.starred?'★ ':'')+t.text}));
      item.onclick=()=>{weekStart=getMonday(parseDk(dk));searchQuery='';document.getElementById('searchInput').value='';setView('week');};
      grp.appendChild(item);
    });
    wrap.appendChild(grp);
  });
  return wrap;
}

// ── Progress (week) ──
function calcProgress(){
  let total=0,done=0;
  for(let i=0;i<7;i++){
    const d=new Date(weekStart);d.setDate(d.getDate()+i);
    const dk=dateKey(d);
    visibleStored(dk).forEach(t=>{if(!t||t.pending)return;total++;if(t.checked)done++;(t.subs||[]).forEach(s=>{total++;if(s.checked)done++;});});
    // 반복 인스턴스 포함 (해당 날짜의 체크 상태 기준)
    try{
      getRepeatTasksForDate(d,i).forEach(({task,instanceDk})=>{
        total++; if(isRepeatChecked(task,instanceDk))done++;
      });
    }catch(e){}
  }
  return {total,done};
}

// ── 당일 완료 축하 ──
const CELEBRATE_MSGS = [
  ['다 끝냈어요!', '오늘 하루 정말 잘했어요 🙌'],
  ['올 클리어!', '목표 달성, 대단해요 🎉'],
  ['수고했어요!', '오늘도 해냈네요 ✨'],
  ['완벽해요!', '내일도 이 기세로 💪'],
  ['최고예요!', '미루지 않고 끝까지 👏'],
];
const CELEBRATE_EMOJIS = ['🎉','🎊','🥳','🏆','✨','🙌','💪'];
let _celebrateArmed = false;   // 최초 렌더(로드)에서는 축하 띄우지 않음
let _celebratedDayKey = null;  // 오늘 축하했는지(다시 미완료되면 해제 → 재완료 시 재발동)
let _celebrateTimer = null;

// 오늘 하루치 진행률 — calcProgress의 하루 집계 로직과 동일하게 계산
function todayProgress() {
  const d = today();
  const i = dateToDayIdx(d);
  const dk = dateKey(d);
  let total = 0, done = 0;
  visibleStored(dk).forEach(t => {
    if (!t || t.pending) return;
    total++; if (t.checked) done++;
    (t.subs||[]).forEach(s => { total++; if (s.checked) done++; });
  });
  try {
    getRepeatTasksForDate(d, i).forEach(({task, instanceDk}) => {
      total++; if (isRepeatChecked(task, instanceDk)) done++;
    });
  } catch (e) {}
  return { total, done };
}

function maybeCelebrate() {
  const tk = todayKey();
  const { total, done } = todayProgress();
  const allDone = total > 0 && done === total;
  if (!_celebrateArmed) {            // 페이지 로드 직후: 상태만 기록, 팝업 억제
    _celebrateArmed = true;
    if (allDone) _celebratedDayKey = tk;
    return;
  }
  if (allDone) {
    if (_celebratedDayKey !== tk) { _celebratedDayKey = tk; showCelebration(); }
  } else if (_celebratedDayKey === tk) {
    _celebratedDayKey = null;        // 다시 할 일이 생기거나 체크 해제 → 재발동 허용
  }
}

function showCelebration() {
  const overlay = document.getElementById('celebrateOverlay');
  if (!overlay) return;
  const [title, sub] = CELEBRATE_MSGS[Math.floor(Math.random()*CELEBRATE_MSGS.length)];
  document.getElementById('celebrateEmoji').textContent = CELEBRATE_EMOJIS[Math.floor(Math.random()*CELEBRATE_EMOJIS.length)];
  document.getElementById('celebrateTitle').textContent = title;
  document.getElementById('celebrateSub').textContent = sub;
  spawnConfetti();
  overlay.classList.add('show');
  overlay.setAttribute('aria-hidden','false');
  clearTimeout(_celebrateTimer);
  _celebrateTimer = setTimeout(hideCelebration, 3600);
}

function hideCelebration() {
  const overlay = document.getElementById('celebrateOverlay');
  if (!overlay) return;
  overlay.classList.remove('show');
  overlay.setAttribute('aria-hidden','true');
  clearTimeout(_celebrateTimer);
  setTimeout(() => { const c=document.getElementById('celebrateConfetti'); if(c) c.innerHTML=''; }, 300);
}

function spawnConfetti() {
  const box = document.getElementById('celebrateConfetti');
  if (!box) return;
  box.innerHTML = '';
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const colors = ['#1a73e8','#43a047','#e53935','#fb8c00','#f9a825','#8e24aa','#00acc1'];
  const n = 40;
  for (let i = 0; i < n; i++) {
    const p = el('div','confetti-piece');
    p.style.left = Math.random()*100 + '%';
    p.style.background = colors[i % colors.length];
    p.style.animationDuration = (2 + Math.random()*1.6) + 's';
    p.style.animationDelay = (Math.random()*0.5) + 's';
    if (Math.random() < 0.5) p.style.borderRadius = '50%';
    box.appendChild(p);
  }
  // 애니메이션 종료 후 DOM에서 제거(불필요한 노드/페인트 정리)
  setTimeout(() => { if (box) box.innerHTML = ''; }, 4500);
}
const _celebrateOverlayEl = document.getElementById('celebrateOverlay');
if (_celebrateOverlayEl) _celebrateOverlayEl.onclick = hideCelebration;

// ── Render ──
let _renderedWeekKey=null, _weekScroll={key:null,left:0};
function render(){
  _repeatCache.clear();  // 반복 일정 캐시 무효화(상태 변경 후 매 렌더 시작)
  if(typeof updatePendingBadge==='function') updatePendingBadge();
  if(typeof updateBulkBar==='function') updateBulkBar();
  const view=document.getElementById('mainView');
  // 모바일 주간뷰: 다시 그리기 전에 현재 가로 스크롤 위치 저장 (체크/별표 시 화면 점프 방지)
  if(window.innerWidth<=768){
    const prevWrap=view.querySelector('.calendar-wrap');
    if(prevWrap&&_renderedWeekKey) _weekScroll={key:_renderedWeekKey,left:prevWrap.scrollLeft};
  }
  view.innerHTML='';
  // week label
  if(currentView==='week'){
    const end=new Date(weekStart);end.setDate(end.getDate()+6);
    document.getElementById('weekLabel').textContent=`${weekStart.getFullYear()}년 ${weekStart.getMonth()+1}월 ${weekStart.getDate()}일 ~ ${end.getMonth()+1}월 ${end.getDate()}일`;
  } else if(currentView==='month'||currentView==='timeline') {
    document.getElementById('weekLabel').textContent=`${monthDate.getFullYear()}년 ${monthDate.getMonth()+1}월`;
  } else if(currentView==='day'||currentView==='timeblock') {
    document.getElementById('weekLabel').textContent=`${dayDate.getFullYear()}년 ${dayDate.getMonth()+1}월 ${dayDate.getDate()}일 (${DAY_NAMES[dateToDayIdx(dayDate)]})`;
  } else if(currentView==='year') {
    document.getElementById('weekLabel').textContent=`${yearNum}년`;
  } else {
    const now=new Date();
    document.getElementById('weekLabel').textContent=`${now.getFullYear()}년 ${now.getMonth()+1}월 ${now.getDate()}일`;
  }
  // main content
  if(currentView==='focus'){
    view.appendChild(buildFocusView());
  } else if(currentView==='day'){
    view.appendChild(buildDayView());
  } else if(currentView==='year'){
    view.appendChild(buildYearView());
  } else if(currentView==='timeline'){
    view.appendChild(buildTimelineView());
  } else if(currentView==='timeblock'){
    view.appendChild(buildTimeblockView());
  } else if(currentView==='week'){
    const tagBar=buildTagFilterBar(); if(tagBar) view.appendChild(tagBar);
    const wrap=el('div','calendar-wrap');
    // scroll hint on mobile
    if(window.innerWidth<=768){
      const hint=el('div','scroll-hint',{innerHTML:'← 스와이프해서 날짜 이동 →'});
      view.appendChild(hint);
    }
    const grid=el('div','calendar-grid');
    // 월~금은 각각 한 칸, 토·일은 한 칸에 위아래로 합본 (주말은 보통 비어서 평일을 넓게)
    for(let i=0;i<5;i++){const d=new Date(weekStart);d.setDate(d.getDate()+i);grid.appendChild(buildDayCol(d,i));}
    const wkndCol=el('div','weekend-col');
    [5,6].forEach(i=>{const d=new Date(weekStart);d.setDate(d.getDate()+i);wkndCol.appendChild(buildDayCol(d,i));});
    grid.appendChild(wkndCol);
    wrap.appendChild(grid); view.appendChild(wrap);
    // 모바일: 지금 어느 요일 칸을 보고 있는지 표시하는 인디케이터 (탭하면 그 요일로 이동)
    if(window.innerWidth<=768){
      const ind=el('div','week-ind');
      const cols=[...wrap.querySelectorAll('.day-col')];
      const todayIdx0=(()=>{const t=today();for(let i=0;i<7;i++){const d=new Date(weekStart);d.setDate(d.getDate()+i);if(d.getTime()===t.getTime())return i;}return -1;})();
      const dots=DAY_NAMES.map((nm,i)=>{
        const d=el('button','week-ind-dot'+(i===todayIdx0?' today':''),{type:'button',textContent:nm});
        d.setAttribute('aria-label',nm+'요일로 이동');
        d.onclick=()=>{ if(cols[i]) cols[i].scrollIntoView({behavior:'smooth',inline:'center',block:'nearest'}); };
        ind.appendChild(d); return d;
      });
      view.insertBefore(ind,wrap);
      if('IntersectionObserver' in window){
        const io=new IntersectionObserver(es=>{
          es.forEach(en=>{ if(en.isIntersecting){ const idx=cols.indexOf(en.target); if(idx>=0) dots.forEach((d,i)=>d.classList.toggle('on',i===idx)); } });
        },{root:wrap,threshold:.6});
        cols.forEach(c=>io.observe(c));
      }
    }
    const wk=dateKey(weekStart);
    if(window.innerWidth<=768){
      if(_weekScroll.key===wk){
        // 같은 주 다시 그리기 → 스크롤 위치 그대로 복원 (점프 없음)
        wrap.scrollLeft=_weekScroll.left;
      } else {
        // 주가 바뀌었을 때만 오늘(또는 첫날)으로 자동 스크롤
        setTimeout(()=>{
          const cols=document.querySelectorAll('.day-col');
          let todayIdx=-1;
          for(let i=0;i<7;i++){
            const d=new Date(weekStart);d.setDate(d.getDate()+i);
            if(d.getTime()===today().getTime()){todayIdx=i;break;}
          }
          const target=cols[todayIdx>=0?todayIdx:0];
          if(target) target.scrollIntoView({behavior:'smooth',inline:'center',block:'nearest'});
        },80);
      }
    }
    _renderedWeekKey=wk;
  } else {
    view.appendChild(buildMonthView());
  }
  // progress
  const {total,done}=calcProgress();
  const pct=total?Math.round(done/total*100):0;
  const pi=document.getElementById('progressInfo');
  pi.innerHTML=total>0?`${done}/${total} <span class="progress-bar-wrap"><span class="progress-bar-fill" style="width:${pct}%"></span></span>`:'';
  // focus
  if(activeInput){
    setTimeout(()=>{const inp=document.getElementById(`inp-${activeInput.dataKey||activeInput.dateKey}-${activeInput.parentId||'main'}`);if(inp)inp.focus();},30);
  }
  // 뷰 전환 시에만 부드러운 등장 애니메이션 (같은 뷰 재렌더는 그대로)
  if(_lastRenderedView!==currentView){
    view.classList.remove('view-enter');
    void view.offsetWidth;
    view.classList.add('view-enter');
    _lastRenderedView=currentView;
  }
  // 당일 할 일 전부 완료 시 축하 (미완료→완료 전환 순간에만)
  if(!READ_ONLY) maybeCelebrate();
  // 완료 애니메이션 플래그는 이번 렌더에서 소비됨 — 화면 밖이라 안 그려졌어도 여기서 정리
  _justDoneId=null;
}

// ── Nav ──
document.getElementById('prevBtn').onclick=()=>{
  if(currentView==='week')weekStart.setDate(weekStart.getDate()-7);
  else if(currentView==='month'||currentView==='timeline')monthDate.setMonth(monthDate.getMonth()-1);
  else if(currentView==='day'||currentView==='timeblock')dayDate.setDate(dayDate.getDate()-1);
  else if(currentView==='year')yearNum--;
  render();
};
document.getElementById('nextBtn').onclick=()=>{
  if(currentView==='week')weekStart.setDate(weekStart.getDate()+7);
  else if(currentView==='month'||currentView==='timeline')monthDate.setMonth(monthDate.getMonth()+1);
  else if(currentView==='day'||currentView==='timeblock')dayDate.setDate(dayDate.getDate()+1);
  else if(currentView==='year')yearNum++;
  render();
};
document.getElementById('todayBtn').onclick=()=>{
  weekStart=getMonday(new Date()); monthDate=new Date(); monthDate.setDate(1);
  dayDate=today(); yearNum=new Date().getFullYear(); render();
};
const VIEW_BTNS={day:'btnDay',week:'btnWeek',month:'btnMonth',timeblock:'btnTimeblock',year:'btnYear',timeline:'btnTimeline',focus:'btnFocus'};
function setView(v){
  currentView=v;
  Object.entries(VIEW_BTNS).forEach(([view,id])=>document.getElementById(id).classList.toggle('active',v===view));
  render();
}
Object.entries(VIEW_BTNS).forEach(([view,id])=>{document.getElementById(id).onclick=()=>setView(view);});

// ── 모바일 하단 탭바 — setView와 활성 상태 동기화 ──
(function(){
  const nav=document.getElementById('mobileNav'); if(!nav) return;
  const sheet=document.getElementById('mnavSheet');
  const moreBtn=document.getElementById('mnavMore');
  const SHEET_VIEWS=['year','timeblock','timeline'];
  const syncActive=()=>{
    nav.querySelectorAll('.mnav-item[data-view]').forEach(b=>b.classList.toggle('active',b.dataset.view===currentView));
    moreBtn.classList.toggle('active',SHEET_VIEWS.includes(currentView));
  };
  nav.querySelectorAll('[data-view]').forEach(b=>{
    b.onclick=()=>{ sheet.classList.add('hidden'); setView(b.dataset.view); };
  });
  moreBtn.onclick=e=>{ e.stopPropagation(); sheet.classList.toggle('hidden'); };
  document.addEventListener('click',e=>{ if(!nav.contains(e.target)) sheet.classList.add('hidden'); });
  // 단축키 등 다른 경로로 setView가 불려도 탭바 상태 반영
  const _origSetView=setView;
  setView=function(v){ _origSetView(v); syncActive(); };
  syncActive();
})();

// ── Search ──
let _searchTimer=null;
document.getElementById('searchInput').addEventListener('input',e=>{
  searchQuery=e.target.value;
  clearTimeout(_searchTimer);
  _searchTimer=setTimeout(render,160);  // 키 입력마다 전체 재렌더 방지(디바운스)
});

// ── Dark mode ──
document.getElementById('darkBtn').onclick=()=>{
  const html=document.documentElement;
  const isDark=html.dataset.theme==='dark';
  html.dataset.theme=isDark?'light':'dark';
  document.getElementById('darkBtn').textContent=isDark?'🌙':'☀️';
  localStorage.setItem('theme',html.dataset.theme);
};
(()=>{const t=localStorage.getItem('theme')||'light';document.documentElement.dataset.theme=t;document.getElementById('darkBtn').textContent=t==='dark'?'☀️':'🌙';})();

// ── More menu dropdown ──
document.getElementById('moreBtn').onclick=e=>{
  e.stopPropagation();
  document.getElementById('moreMenu').classList.toggle('hidden');
  document.getElementById('moreBtn').classList.toggle('menu-open');
};
document.getElementById('moreMenu').addEventListener('click',e=>{
  if(e.target.closest('.more-menu-item')){
    document.getElementById('moreMenu').classList.add('hidden');
    document.getElementById('moreBtn').classList.remove('menu-open');
  }
});
document.addEventListener('click',e=>{
  const menu=document.getElementById('moreMenu');
  if(!menu.classList.contains('hidden') && !menu.contains(e.target) && e.target.id!=='moreBtn'){
    menu.classList.add('hidden');
    document.getElementById('moreBtn').classList.remove('menu-open');
  }
});

// ── Notifications: 9시 오늘할일 / 마감 1시간 전 / 17시 미완료 ──
let NOTIFY_HOUR = (()=>{ const v=parseInt(localStorage.getItem('notifyMorningHour'),10); return isNaN(v)?9:v; })();      // 아침 요약
let NOTIFY_EVENING = (()=>{ const v=parseInt(localStorage.getItem('notifyEveningHour'),10); return isNaN(v)?17:v; })();  // 저녁 미완료 리마인드
let NOTIFY_LEAD = (()=>{ const v=parseInt(localStorage.getItem('notifyLeadMin'),10); return isNaN(v)?30:v; })();         // 시간지정 태스크 N분 전(기본 30)
function notifyAllowed() {
  return localStorage.getItem('notifyEnabled')==='true'
    && 'Notification' in window && Notification.permission==='granted';
}
// 알림 표시: 서비스워커 경유(모바일 PWA에서 더 안정적·클릭 시 앱 포커스), 실패 시 일반 Notification
function notify(title, opts){
  const o = Object.assign({ icon:'icon-192.png', badge:'icon-192.png' }, opts||{});
  try{
    if('serviceWorker' in navigator && navigator.serviceWorker){
      navigator.serviceWorker.ready
        .then(reg=>{ if(reg && reg.showNotification) reg.showNotification(title, o); else new Notification(title, o); })
        .catch(()=>{ try{ new Notification(title, o); }catch(e){} });
      return;
    }
  }catch(e){}
  try{ new Notification(title, o); }catch(e){}
}
// ── 백그라운드 푸시(Web Push + VAPID) — 앱을 닫아도 GitHub Actions 발송 서버가 알림 전송 ──
// 아래 키는 `npx web-push generate-vapid-keys`의 publicKey를 붙여넣으세요(비우면 백그라운드 푸시 비활성, 로컬 알림은 동작).
const VAPID_PUBLIC_KEY = '';
function urlB64ToUint8Array(b64){
  const pad='='.repeat((4-b64.length%4)%4);
  const base=(b64+pad).replace(/-/g,'+').replace(/_/g,'/');
  const raw=atob(base); const arr=new Uint8Array(raw.length);
  for(let i=0;i<raw.length;i++) arr[i]=raw.charCodeAt(i);
  return arr;
}
function savePushPrefs(){
  const me=sanitizeId(myPersonalId()||USER_ID);
  if(!fbDb || !me || me==='demo' || READ_ONLY) return;
  fbDb.ref(`users/${me}/notifyPrefs`).set({
    enabled: localStorage.getItem('notifyEnabled')==='true',
    morningHour: NOTIFY_HOUR, eveningHour: NOTIFY_EVENING, leadMin: NOTIFY_LEAD,
    tzOffset: -new Date().getTimezoneOffset()   // 분, UTC 기준 동쪽(+540=KST)
  }).catch(()=>{});
}
async function subscribeForPush(){
  try{
    if(!VAPID_PUBLIC_KEY) return;                 // 키 미설정 → 백그라운드 푸시 비활성(로컬 알림만)
    if(!('serviceWorker' in navigator) || !('PushManager' in window)) return;
    if(!('Notification' in window) || Notification.permission!=='granted') return;
    const me=sanitizeId(myPersonalId()||USER_ID);
    if(!fbDb || !me || me==='demo' || READ_ONLY) return;
    const reg=await navigator.serviceWorker.ready;
    let sub=await reg.pushManager.getSubscription();
    if(!sub) sub=await reg.pushManager.subscribe({ userVisibleOnly:true, applicationServerKey: urlB64ToUint8Array(VAPID_PUBLIC_KEY) });
    const j=sub.toJSON();
    let h=0; const ep=j.endpoint||''; for(let i=0;i<ep.length;i++) h=(h*31+ep.charCodeAt(i))>>>0;
    fbDb.ref(`users/${me}/pushSubs/${h}`).set({ endpoint:j.endpoint, keys:j.keys||{}, ua:(navigator.userAgent||'').slice(0,80), ts:Date.now() }).catch(()=>{});
    savePushPrefs();
  }catch(e){ console.warn('push 구독 실패', e); }
}
// 우선순위 가중치: 🔴 > 🟡 > 🟢 > ★ > 일반
function priorityWeight(t){
  return (t.priority==='high'?30:t.priority==='mid'?20:t.priority==='low'?10:0)+(t.starred?5:0);
}
function priorityFlag(t){
  return t.priority==='high'?'🔴 ':t.priority==='mid'?'🟡 ':t.priority==='low'?'🟢 ':t.starred?'★ ':'';
}
// "우선순위 높은 일 외 N건이 남아있습니다" 형식 메시지
function summarizeTasks(list){
  if(!list.length) return null;
  const sorted=[...list].sort((a,b)=>priorityWeight(b)-priorityWeight(a));
  const top=sorted[0];
  const name=(top.time?top.time+' ':'')+top.text;
  return list.length===1
    ? `${priorityFlag(top)}${name}`
    : `${priorityFlag(top)}${name} 외 ${list.length-1}건이 남아 있어요`;
}
// 오늘의 미완료 태스크 (반복 인스턴스 포함)
function getTodayIncomplete(){
  const now=today(); const dk=dateKey(now);
  const out=[];
  visibleStored(dk).forEach(t=>{ if(t&&!t.checked) out.push(t); });
  try{
    getRepeatTasksForDate(now,dateToDayIdx(now)).forEach(({task,instanceDk})=>{
      if(!isRepeatChecked(task,instanceDk)) out.push(task);
    });
  }catch(e){}
  return out;
}
// 알림 중복 방지 기록은 사용자별로 분리 — 같은 브라우저에서 캘린더를 오가도
// 서로의 알림 기록을 덮어쓰거나(중복 발송) 가로채지(누락) 않도록
const NKEY = k => `${k}_${USER_ID||'local'}`;
// 1) 매일 오전 9시: 오늘 할 일 요약
function checkNotificationSchedule() {
  if(!notifyAllowed()) return;
  const now = new Date();
  if(now.getHours() < NOTIFY_HOUR) return;
  const todayDk = dateKey(now);
  if(localStorage.getItem(NKEY('lastNotifyDate'))===todayDk) return;
  localStorage.setItem(NKEY('lastNotifyDate'), todayDk);
  const list=getTodayIncomplete();
  if(!list.length) return;
  notify(`🗓 오늘의 할 일 ${list.length}건`, {body: summarizeTasks(list)});
}
// 3) 매일 오후 5시: 미완료 태스크 리마인드
function checkEveningReminder() {
  if(!notifyAllowed()) return;
  const now = new Date();
  if(now.getHours() < NOTIFY_EVENING) return;
  const todayDk = dateKey(now);
  if(localStorage.getItem(NKEY('lastNotify5pm'))===todayDk) return;
  localStorage.setItem(NKEY('lastNotify5pm'), todayDk);
  const list=getTodayIncomplete();
  if(!list.length) return;
  notify(`🔔 미완료 태스크 ${list.length}건`, {body: summarizeTasks(list)});
}
function updateNotifyBtn() {
  const enabled = localStorage.getItem('notifyEnabled')==='true' && 'Notification' in window && Notification.permission==='granted';
  const btn = document.getElementById('notifyBtn');
  document.getElementById('notifyIcon').textContent = enabled?'🔔':'🔕';
  btn.title = enabled?`알림 켜짐 (${NOTIFY_HOUR}시 오늘할일·🔴중요 · 시간 ${NOTIFY_LEAD}분 전 · ${NOTIFY_EVENING}시 미완료)`:'알림 꺼짐 (클릭하여 켜기)';
}
document.getElementById('notifyBtn').onclick=()=>{
  if(!('Notification' in window)){ alert('이 브라우저는 알림을 지원하지 않아요.'); return; }
  const enabled = localStorage.getItem('notifyEnabled')==='true';
  if(enabled){
    localStorage.setItem('notifyEnabled','false');
    updateNotifyBtn();
    return;
  }
  Notification.requestPermission().then(perm=>{
    if(perm==='granted'){
      localStorage.setItem('notifyEnabled','true');
      subscribeForPush();   // 백그라운드 푸시 구독(키 설정 시)
      notify('🗓 마이플래너', {body:`알림 설정 완료!\n· 매일 ${NOTIFY_HOUR}시 오늘 할 일 · 🔴중요(높음) 태스크\n· 시간지정 태스크 ${NOTIFY_LEAD}분 전\n· 매일 ${NOTIFY_EVENING}시 미완료 리마인드\n(더보기 → 알림 시간 설정에서 변경)`});
    } else {
      alert('알림 권한이 거부됐어요. 브라우저 설정에서 알림을 허용해 주세요.');
    }
    updateNotifyBtn();
  });
};
updateNotifyBtn();
// 2) 마감 1시간 전 알림
function checkTimeNotifications(){
  if(!notifyAllowed())return;
  const now=new Date();
  const dk=dateKey(now);
  const nowMin=now.getHours()*60+now.getMinutes();
  let state={};
  try{state=JSON.parse(localStorage.getItem(NKEY('timeNotified'))||'{}');}catch{}
  if(state.dk!==dk)state={dk,ids:[]};
  const candidates=[];
  visibleStored(dk).forEach(t=>{ if(t&&t.time&&!t.checked)candidates.push({id:t.id,time:t.time,text:t.text}); });
  try{
    getRepeatTasksForDate(now,dateToDayIdx(now)).forEach(({task,instanceDk})=>{
      if(task.time&&!isRepeatChecked(task,instanceDk))candidates.push({id:task.id,time:task.time,text:task.text});
    });
  }catch(e){}
  candidates.forEach(c=>{
    if(state.ids.includes(c.id))return;
    const [h,m]=c.time.split(':').map(Number);
    const remainMin=(h*60+m)-nowMin; // 마감까지 남은 분
    if(remainMin<=NOTIFY_LEAD&&remainMin>=0){
      const msg=remainMin===0?'지금 마감 시간입니다':remainMin<=5?'곧 마감입니다':`마감 ${remainMin}분 전입니다 (${c.time} 마감)`;
      notify('⏰ '+c.text,{body:msg});
      state.ids.push(c.id);
    }
  });
  localStorage.setItem(NKEY('timeNotified'),JSON.stringify(state));
}

// 2-b) 빨강(높음) 중요 태스크 일일 알림 — 오전 NOTIFY_HOUR 이후 1회
function checkHighPriorityAlert(){
  if(!notifyAllowed())return;
  const now=new Date();
  if(now.getHours()<NOTIFY_HOUR)return;
  const todayDk=dateKey(now);
  if(localStorage.getItem(NKEY('lastNotifyHigh'))===todayDk)return;
  localStorage.setItem(NKEY('lastNotifyHigh'),todayDk);
  const reds=getTodayIncomplete().filter(t=>t.priority==='high');
  if(!reds.length)return;
  const names=reds.slice(0,3).map(t=>(t.time?t.time+' ':'')+t.text).join(', ');
  notify(`🔴 중요(높음) 태스크 ${reds.length}건`,{body:names+(reds.length>3?` 외 ${reds.length-3}건`:'')});
}

// 받은 일정(pending) 도착 알림 + 제목 배지
function updatePendingBadge(){
  let cnt=0;
  Object.values(tasks).forEach(list=>{ if(Array.isArray(list)) list.forEach(t=>{ if(t&&t.pending) cnt++; }); });
  document.title = (cnt>0 ? `(${cnt}) ` : '') + '마이플래너';
}
function checkPendingNotifications(){
  if(READ_ONLY) return;
  let seen=[]; try{ seen=JSON.parse(localStorage.getItem(NKEY('pendingNotified'))||'[]'); }catch{}
  const seenSet=new Set(seen);
  const current=[], fresh=[];
  Object.entries(tasks).forEach(([dk,list])=>{
    if(!Array.isArray(list)) return;
    list.forEach(t=>{ if(t&&t.pending){ current.push(t.id); if(!seenSet.has(t.id)) fresh.push({text:t.text,from:t.from}); } });
  });
  if(fresh.length && notifyAllowed()){
    try{ notify('👤 받은 일정 '+fresh.length+'건', {body: fresh.map(x=>`· ${x.from||'누군가'}: ${x.text}`).join('\n').slice(0,180)}); }catch(e){}
  }
  localStorage.setItem(NKEY('pendingNotified'), JSON.stringify(current));
  updatePendingBadge();
}

// 알림 시간 설정
const _notifySettingsBtn = document.getElementById('notifySettingsBtn');
if (_notifySettingsBtn) _notifySettingsBtn.onclick = () => {
  document.getElementById('moreMenu').classList.add('hidden');
  const mh = prompt('아침 요약 알림 시각 (0~23시)', NOTIFY_HOUR);
  if (mh === null) return;
  const eh = prompt('저녁 미완료 리마인드 시각 (0~23시)', NOTIFY_EVENING);
  if (eh === null) return;
  const lead = prompt('마감 몇 분 전에 알릴까요? (분)', NOTIFY_LEAD);
  if (lead === null) return;
  const mhi = Math.max(0, Math.min(23, parseInt(mh, 10)));
  const ehi = Math.max(0, Math.min(23, parseInt(eh, 10)));
  const li = Math.max(1, Math.min(1440, parseInt(lead, 10)));
  if (!isNaN(mhi)) { NOTIFY_HOUR = mhi; localStorage.setItem('notifyMorningHour', mhi); }
  if (!isNaN(ehi)) { NOTIFY_EVENING = ehi; localStorage.setItem('notifyEveningHour', ehi); }
  if (!isNaN(li)) { NOTIFY_LEAD = li; localStorage.setItem('notifyLeadMin', li); }
  savePushPrefs();   // 백그라운드 발송 서버에 시간/타임존 반영
  alert(`알림 시간을 저장했어요.\n· 아침 ${NOTIFY_HOUR}시 · 저녁 ${NOTIFY_EVENING}시 · 마감 ${NOTIFY_LEAD}분 전`);
};

setInterval(checkNotificationSchedule, 60*1000);
checkNotificationSchedule();
setInterval(checkEveningReminder, 60*1000);
checkEveningReminder();
setInterval(checkTimeNotifications, 60*1000);
checkTimeNotifications();
setInterval(checkHighPriorityAlert, 60*1000);
checkHighPriorityAlert();
// 백그라운드 인터벌은 throttle/중단되므로, 앱으로 돌아오면 놓친 알림을 즉시 catch-up
function runNotifChecks(){ [checkNotificationSchedule,checkEveningReminder,checkTimeNotifications,checkHighPriorityAlert].forEach(f=>{ try{ f(); }catch(e){} }); }
document.addEventListener('visibilitychange', ()=>{ if(!document.hidden) runNotifChecks(); });
window.addEventListener('focus', runNotifChecks);
// 이미 알림이 켜져 있으면 로드 시 백그라운드 푸시 구독 갱신
if(notifyAllowed()) setTimeout(subscribeForPush, 1500);

// ── Pomodoro timer ──
let pomodoroInterval=null, pomodoroSeconds=25*60, pomodoroRunning=false;
function updatePomodoroDisplay(){
  const m=Math.floor(pomodoroSeconds/60), s=pomodoroSeconds%60;
  document.getElementById('pomodoroTime').textContent=`${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}
function pausePomodoro(){
  clearInterval(pomodoroInterval); pomodoroInterval=null; pomodoroRunning=false;
  document.getElementById('pomodoroStartBtn').textContent='시작';
}
function startPomodoro(){
  if(pomodoroRunning) return;
  pomodoroRunning=true;
  document.getElementById('pomodoroStartBtn').textContent='일시정지';
  pomodoroInterval=setInterval(()=>{
    pomodoroSeconds--;
    updatePomodoroDisplay();
    if(pomodoroSeconds<=0){
      pausePomodoro();
      pomodoroSeconds=25*60; updatePomodoroDisplay();
      if('Notification' in window && Notification.permission==='granted') notify('🍅 포모도로 완료!',{body:'25분 집중 끝! 잠시 쉬어 가요.'});
      else alert('🍅 25분 집중 완료! 잠시 휴식하세요.');
    }
  },1000);
}
document.getElementById('pomodoroStartBtn').onclick=()=>{ pomodoroRunning?pausePomodoro():startPomodoro(); };
document.getElementById('pomodoroResetBtn').onclick=()=>{ pausePomodoro(); pomodoroSeconds=25*60; updatePomodoroDisplay(); };
document.getElementById('pomodoroBtn').onclick=()=>{
  document.getElementById('pomodoroWidget').classList.toggle('active');
};
document.getElementById('pomodoroCloseBtn').onclick=()=>document.getElementById('pomodoroWidget').classList.remove('active');
function startPomodoroForTask(text){
  pausePomodoro(); pomodoroSeconds=25*60; updatePomodoroDisplay();
  document.getElementById('pomodoroTaskLabel').textContent='🍅 '+text;
  document.getElementById('pomodoroWidget').classList.add('active');
  startPomodoro();
}

// ── iCal (.ics) export ──
function escapeICS(text){ return String(text).replace(/[\\,;]/g,m=>'\\'+m).replace(/\n/g,'\\n'); }
function buildICS(){
  const lines=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//마이플래너//KO','CALSCALE:GREGORIAN'];
  const dtstamp=new Date().toISOString().replace(/[-:]/g,'').split('.')[0]+'Z';
  const RR={
    daily:'FREQ=DAILY', weekdays:'FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR',
    weekly:'FREQ=WEEKLY', biweekly:'FREQ=WEEKLY;INTERVAL=2', monthly:'FREQ=MONTHLY',
    monthlyFirstBiz:'FREQ=MONTHLY;BYDAY=MO,TU,WE,TH,FR;BYSETPOS=1',
    monthlyLastBiz:'FREQ=MONTHLY;BYDAY=MO,TU,WE,TH,FR;BYSETPOS=-1',
  };
  Object.entries(tasks).forEach(([dk,list])=>{
    if(!Array.isArray(list)) return;
    const ymd=dk.replace(/-/g,'');
    list.forEach(t=>{
      if(!t||!t.text) return;
      const timed=t.time&&/^\d{1,2}:\d{2}$/.test(t.time);
      lines.push('BEGIN:VEVENT');
      lines.push('UID:'+t.id+'@myplanner');
      lines.push('DTSTAMP:'+dtstamp);
      if(timed){
        const [hh,mm]=t.time.split(':').map(Number);
        const dur=Math.max(15, parseInt(t.duration,10)||60);
        const endMin=hh*60+mm+dur;
        const startS=`${ymd}T${String(hh).padStart(2,'0')}${String(mm).padStart(2,'0')}00`;
        const endS=endMin>=1440?`${ymd}T235900`:`${ymd}T${String(Math.floor(endMin/60)).padStart(2,'0')}${String(endMin%60).padStart(2,'0')}00`;
        lines.push('DTSTART:'+startS);
        lines.push('DTEND:'+endS);
      } else {
        lines.push('DTSTART;VALUE=DATE:'+ymd);
      }
      lines.push('SUMMARY:'+escapeICS((t.starred?'★ ':'')+t.text));
      // 반복 규칙
      let rule=RR[t.repeat];
      if(t.repeat==='monthlyNth'){
        const od=parseDk(dk);
        rule=`FREQ=MONTHLY;BYDAY=${Math.min(Math.ceil(od.getDate()/7),5)}${['SU','MO','TU','WE','TH','FR','SA'][od.getDay()]}`;
      }
      if(rule){
        if(t.repeatEnd&&/^\d{4}-\d{2}-\d{2}$/.test(t.repeatEnd)) rule+=';UNTIL='+t.repeatEnd.replace(/-/g,'')+(timed?'T235959':'');
        lines.push('RRULE:'+rule);
        // 건너뛴 인스턴스 제외
        if(t.skips) Object.keys(t.skips).forEach(sd=>{ if(/^\d{4}-\d{2}-\d{2}$/.test(sd)) lines.push((timed?'EXDATE:':'EXDATE;VALUE=DATE:')+sd.replace(/-/g,'')+(timed?'T'+t.time.replace(':','')+'00':'')); });
      }
      // 설명: 메모 + 하위 항목
      const desc=[];
      if(t.memo) desc.push(t.memo);
      if(Array.isArray(t.subs)&&t.subs.length) desc.push('— 하위 —\n'+t.subs.map(s=>`• ${s.checked?'[완료]':'[ ]'} ${s.text}`).join('\n'));
      if(desc.length) lines.push('DESCRIPTION:'+escapeICS(desc.join('\n\n')));
      lines.push('END:VEVENT');
    });
  });
  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}
document.getElementById('icsExportBtn').onclick=()=>{
  const blob=new Blob([buildICS()],{type:'text/calendar;charset=utf-8'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');
  a.href=url; a.download='마이플래너.ics';
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

// ── 포팅 어댑터: 기존 코드베이스 헬퍼에 연결 ──
function showToast(msg, fn) { showUndoToast(msg, fn || null); }
function parseDk(dk) { const [y, m, d] = dk.split('-').map(Number); return new Date(y, m - 1, d); }
function todayKey() { return dateKey(today()); }
function openLightbox(src) {
  document.getElementById('imgLightboxImg').src = src;
  document.getElementById('imgLightbox').classList.remove('hidden');
}
function closeLightbox() { document.getElementById('imgLightbox').classList.add('hidden'); }

// ═══════════════════════════════════════
// 스탠드얼론 메모장 v2 — 노션식 하위 뎁스 + 마크다운 + 슬래시 명령 + 이미지(로컬)
// ═══════════════════════════════════════
const MEMOS_KEY = USER_ID ? `calMemos_${USER_ID}` : 'calMemos';
let memoSaveTimer2 = null, pendingMemoLocal = false, _noteTitleTimer = null;
const NOTE_Z_BASE = 410; // 모달(500)·태스크메모(450)보다 아래
const NOTE_COLORS = [null, '#f9a825', '#1a73e8', '#43a047', '#e91e63', '#8e24aa'];
const noteEditState = {}; // memoId → true(편집 모드)

function memosFbRef() {
  return FB_UID && USER_ID !== 'demo' && fbDb ? fbDb.ref(`users/${FB_UID}/memos`) : null;
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
    ref.set(fbClean(memos))
      .then(() => { pendingMemoLocal = false; _pendingCollections.delete('memos'); setSyncStatus('synced'); })
      .catch(() => { _pendingCollections.add('memos'); setSyncStatus('offline'); });
  }, 300);
}
window.addEventListener('pagehide', () => {
  if (memoSaveTimer2) {
    clearTimeout(memoSaveTimer2); memoSaveTimer2 = null;
    const ref = memosFbRef(); if (ref) ref.set(fbClean(memos));
  }
  // 할 일도 디바운스 대기 중이면 닫기 직전에 즉시 반영 (300ms 내 편집 손실 방지)
  if (fbSaveTimer) {
    clearTimeout(fbSaveTimer); fbSaveTimer = null;
    const ref = fbRef();
    if (ref) {
      if (_pendingSaveFull || !_pendingSaveDks.size) { ref.set(fbClean(tasks)); }
      else { const u={}; _pendingSaveDks.forEach(d=>{u[d]=fbClean(tasks[d]);}); ref.update(u); }
      _pendingSaveFull=false; _pendingSaveDks.clear();
    }
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
function memoLabel(m) { return m.title.trim() || memoFirstLine(m.text).slice(0,18) || '제목 없음'; }
// 본문에서 의미 있는 첫 줄을 평문으로 (페이지링크/이미지 단독줄·서식마커·마크다운 기호 제거)
function memoFirstLine(text) {
  if (!text) return '';
  for (const ln of text.split('\n')) {
    const t = ln.replace(/\{!\/?[^!{}]*!\}/g, '').replace(/<[^>]+>/g, '')
                .replace(/^#{1,3}\s+/, '').replace(/^\s*-\s+/, '').replace(/^\s*\[( |x)\]\s?/, '')
                .replace(/\*\*([^*]+)\*\*/g, '$1').replace(/`([^`]+)`/g, '$1').trim();
    if (!t) continue;
    if (/^\[\[[a-z0-9]+\]\]$/.test(t)) continue;                 // 페이지 링크 단독줄은 건너뜀
    if (/^!\[[^\]]*\]\(local:[a-z0-9_]+\)$/.test(t)) continue;   // 이미지 단독줄도 건너뜀
    return t.replace(/!\[[^\]]*\]\(local:[a-z0-9_]+\)/g, '🖼');
  }
  return '';
}
// 본문 전체를 미리보기용 평문으로 (페이지링크는 대상 메모 제목으로 치환)
function memoPreviewText(text) {
  if (!text) return '';
  return text.split('\n').map(ln => {
    let t = ln.replace(/\{!\/?[^!{}]*!\}/g, '').replace(/<[^>]+>/g, ''), mm;
    if ((mm = t.match(/^\s*\[\[([a-z0-9]+)\]\]\s*$/))) return memos[mm[1]] ? ('📄 ' + memoLabel(memos[mm[1]])) : '📄 삭제된 메모';
    if (/^\s*!\[[^\]]*\]\(local:[a-z0-9_]+\)\s*$/.test(t)) return '🖼';
    return t.replace(/^#{1,3}\s+/, '').replace(/^\s*-\s+/, '• ').replace(/^\s*\[( |x)\]\s?/, '')
            .replace(/\*\*([^*]+)\*\*/g, '$1').replace(/`([^`]+)`/g, '$1')
            .replace(/!\[[^\]]*\]\(local:[a-z0-9_]+\)/g, '🖼');
  }).join(' ').replace(/\s+/g, ' ').trim();
}

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

// ── 이미지: 기존 plannerImages IndexedDB 재사용 (idbPutImage/idbGetImage) ──
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
    img.onerror = () => { URL.revokeObjectURL(img.src); res(null); };
    img.src = URL.createObjectURL(file);
  });
}
async function insertImageFile(m, ta, file) {
  if (READ_ONLY || !file) return;
  const dataUrl = await compressImage(file);
  if (!dataUrl) { showToast('⚠️ 이미지를 읽을 수 없어요'); return; }
  const id = uid();
  await idbPutImage(id, dataUrl);
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
// WYSIWYG: 저장된 안전한 인라인 서식 태그(b/i/u/s/code/span style)를 보존하며 나머지는 escape
const NV_SAFE_INLINE = /<\/?(?:b|strong|i|em|u|s|code|span|br)(?:\s+[a-zA-Z-]+="[^"<>]*")*\s*\/?>/g;
function nvCleanStyle(style) {
  const allow = ['color','background-color','background','font-size','font-family','font-weight','font-style','text-decoration'];
  return style.split(';').map(s => s.trim()).filter(Boolean).filter(p => {
    const k = p.split(':')[0].trim().toLowerCase();
    return allow.includes(k) && !/url\(|expression|javascript:/i.test(p);
  }).join(';');
}
function nvSanitizeInlineTag(tag) {
  const m = tag.match(/^<(\/?)\s*([a-z]+)/i); if (!m) return '';
  const close = m[1], raw = m[2].toLowerCase();
  const name = raw === 'strong' ? 'b' : raw === 'em' ? 'i' : raw;
  if (name === 'br') return '<br>';
  if (close) return `</${name}>`;
  if (name === 'span') {
    const sm = tag.match(/style="([^"<>]*)"/i);
    const style = sm ? nvCleanStyle(sm[1]) : '';
    return style ? `<span style="${style}">` : '<span>';
  }
  if (name === 'code') return '<code class="nv-code">';
  return `<${name}>`;
}
function escapeKeepSafe(line) {
  const stash = [];
  let s = line.replace(NV_SAFE_INLINE, mt => { stash.push(nvSanitizeInlineTag(mt)); return `${stash.length-1}`; });
  s = escapeHtml(s);
  return s.replace(/(\d+)/g, (_, i) => stash[+i]);
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
  s = richMarkers(s); // 서식 마커 {!...!}…{!/!} → 스타일 span
  return s;
}
// ── 노트 서식 마커 ({!c=ff0000 bg=fff59d sz=20 ft=jua b u i st!}…{!/!}) ──
const NV_FONTS = {
  pretendard:"'Pretendard Variable',sans-serif",
  noto:"'Noto Sans KR',sans-serif",
  notoserif:"'Noto Serif KR',serif",
  nanum:"'Nanum Gothic',sans-serif",
  nanummyeongjo:"'Nanum Myeongjo',serif",
  gowun:"'Gowun Dodum',sans-serif",
  jua:"'Jua',sans-serif",
  dohyeon:"'Do Hyeon',sans-serif",
  gaegu:"'Gaegu',cursive",
  nanumpen:"'Nanum Pen Script',cursive"
};
function nvSpecToStyle(spec){
  const css=[]; let deco=[];
  (spec.trim().split(/\s+/)).forEach(p=>{
    let mm;
    if((mm=p.match(/^c=([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/))) css.push('color:#'+mm[1]);
    else if((mm=p.match(/^bg=([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/))) css.push('background-color:#'+mm[1]);
    else if((mm=p.match(/^sz=(\d{1,3})$/))){ const n=Math.max(8,Math.min(96,+mm[1])); css.push('font-size:'+n+'px'); }
    else if((mm=p.match(/^ft=([a-z]+)$/))){ if(NV_FONTS[mm[1]]) css.push('font-family:'+NV_FONTS[mm[1]]); }
    else if(p==='b') css.push('font-weight:700');
    else if(p==='i') css.push('font-style:italic');
    else if(p==='u') deco.push('underline');
    else if(p==='st') deco.push('line-through');
  });
  if(deco.length) css.push('text-decoration:'+deco.join(' '));
  return css.join(';');
}
function richMarkers(s){
  let out='', last=0, m, depth=0;
  const re=/\{!(\/?)([^!{}]*)!\}/g;
  while((m=re.exec(s))){
    out+=s.slice(last,m.index); last=re.lastIndex;
    if(m[1]==='/'){ if(depth>0){ out+='</span>'; depth--; } }
    else { out+=`<span class="nv-fmt" style="${nvSpecToStyle(m[2])}">`; depth++; }
  }
  out+=s.slice(last);
  while(depth-->0) out+='</span>';
  return out;
}
function renderMarkdown(text) {
  const lines = text.split('\n');
  let html = '';
  lines.forEach((line, i) => {
    let m;
    const DL = ` data-line="${i}"`;
    // 노션식 페이지 링크 블록: [[memoId]]
    if ((m = line.match(/^\s*\[\[([a-z0-9]+)\]\]\s*$/))) {
      const mm = memos[m[1]];
      const label = mm ? memoLabel(mm) : '삭제된 메모';
      const cnt = mm ? memoChildren(mm.id).length : 0;
      html += `<div class="nv-page${mm?'':' missing'}" draggable="true"${DL} data-note="${m[1]}"><span class="nv-page-icon">📄</span><span class="nv-page-title">${escapeHtml(label)}${cnt?` <small>(${cnt})</small>`:''}</span><span class="nv-page-arrow">›</span></div>`;
      return;
    }
    // 이미지 단독 라인 → 드래그 가능한 블록
    if ((m = line.match(/^\s*!\[([^\]]*)\]\(local:([a-z0-9_]+)\)\s*$/))) {
      html += `<div class="nv-imgblock" draggable="true"${DL}><img class="nv-img" data-img="${m[2]}" alt="${escapeHtml(m[1])}" draggable="false"><span class="nv-imgmove" title="드래그해서 위치 이동">⠿</span></div>`;
      return;
    }
    if (/^---+\s*$/.test(line)) { html += `<hr class="nv-hr"${DL}>`; return; }
    if ((m = line.match(/^(#{1,3})\s+(.*)$/))) {
      html += `<div class="nv-h${m[1].length}"${DL}>${mdInline(escapeKeepSafe(m[2]))}</div>`; return;
    }
    if ((m = line.match(/^\s*\[( |x)\]\s?(.*)$/))) {
      const done = m[1] === 'x';
      html += `<button class="nv-check${done?' done':''}"${DL}><span class="nv-cb${done?' on':''}"></span><span class="nv-check-text">${mdInline(escapeKeepSafe(m[2]))}</span></button>`;
      return;
    }
    if ((m = line.match(/^\s*-\s+(.*)$/))) {
      html += `<div class="nv-li"${DL}>•&nbsp;${mdInline(escapeKeepSafe(m[1]))}</div>`; return;
    }
    if (line.trim() === '') { html += `<div class="nv-gap"${DL}></div>`; return; }
    html += `<div class="nv-p"${DL}>${mdInline(escapeKeepSafe(line))}</div>`;
  });
  return html || '<div class="nv-placeholder">클릭해서 작성... ( / 로 블록 삽입 )</div>';
}
// 블록(라인)을 다른 위치로 이동 — 페이지 링크/이미지 드래그 재배치
function moveNoteLine(text, from, to) {
  const lines = text.split('\n');
  if (from < 0 || from >= lines.length) return text;
  const [ln] = lines.splice(from, 1);
  if (from < to) to -= 1;
  to = Math.max(0, Math.min(to, lines.length));
  lines.splice(to, 0, ln);
  return lines.join('\n');
}
// ── WYSIWYG 편집기 → 마크다운 역직렬화 ──
function inlineNodeToMd(node) {
  if (node.nodeType === 3) return node.nodeValue;                 // 텍스트(원문 그대로)
  if (node.nodeType !== 1) return '';
  const el = node, tag = el.tagName.toLowerCase();
  if (tag === 'img' && el.dataset.img != null) return `![${el.getAttribute('alt') || ''}](local:${el.dataset.img})`;
  if (tag === 'br') return '\n';                                   // 소프트 줄바꿈 보존
  const inner = [...el.childNodes].map(inlineNodeToMd).join('');
  if (tag === 'b' || tag === 'strong') return `**${inner}**`;
  if (tag === 'i' || tag === 'em') return `*${inner}*`;
  if (tag === 'code') return '`' + inner + '`';
  if (tag === 'a') return inner || el.getAttribute('href') || '';
  if (el.classList && (el.classList.contains('nv-tag') || el.classList.contains('nv-date'))) return inner; // #태그·@날짜는 원문 텍스트로(자동 재인식)
  if (tag === 'u') return `<u>${inner}</u>`;
  if (tag === 's' || tag === 'strike') return `<s>${inner}</s>`;
  if (tag === 'span') {
    const style = nvCleanStyle(el.getAttribute('style') || '');
    return style ? `<span style="${style}">${inner}</span>` : inner;
  }
  // 브라우저가 블록 안에 만든 중첩 블록(div/p/h/li) → 줄바꿈으로 분리(줄 손실 방지)
  if (tag === 'div' || tag === 'p' || tag === 'li' || /^h[1-6]$/.test(tag)) return inner ? '\n' + inner : '';
  return inner;
}
function childrenToMd(el) { return [...el.childNodes].map(inlineNodeToMd).join(''); }
function serializeNoteEditor(editor) {
  const lines = [];
  editor.childNodes.forEach(node => {
    if (node.nodeType === 3) { lines.push(node.nodeValue.replace(/\n+$/, '')); return; }
    if (node.nodeType !== 1) return;
    const el = node;
    const cl = el.classList || { contains: () => false };
    if (cl.contains('nv-page')) { lines.push(`[[${el.dataset.note || ''}]]`); return; }
    if (cl.contains('nv-imgblock')) { const img = el.querySelector('img[data-img]'); lines.push(`![${(img && img.getAttribute('alt')) || ''}](local:${img ? img.dataset.img : ''})`); return; }
    if (el.tagName === 'HR' || cl.contains('nv-hr')) { lines.push('---'); return; }
    if (cl.contains('nv-check')) {
      const done = cl.contains('done') || !!el.querySelector('.nv-cb.on');
      const txt = el.querySelector('.nv-check-text');
      lines.push(`[${done ? 'x' : ' '}] ${txt ? childrenToMd(txt) : ''}`); return;
    }
    let prefix = '';
    if (cl.contains('nv-h1')) prefix = '# ';
    else if (cl.contains('nv-h2')) prefix = '## ';
    else if (cl.contains('nv-h3')) prefix = '### ';
    else if (cl.contains('nv-li')) prefix = '- ';
    let md = childrenToMd(el).replace(/^• ?\s*/, '');
    lines.push(prefix + md);
  });
  return lines.join('\n');
}
// 편집기/뷰 안의 로컬 이미지 src 채우기 + 페이지링크·이미지 블록을 통째 비편집(atomic)으로
function hydrateNoteMedia(root, editable) {
  root.querySelectorAll('img[data-img]').forEach(img => {
    idbGetImage(img.dataset.img).then(data => {
      if (data) { const url = (typeof data === 'string') ? data : URL.createObjectURL(data); img.src = url; }
      else { img.alt = '🖼 이미지는 첨부한 기기에서만 보여요'; img.classList.add('missing'); }
    });
  });
  if (editable) {
    root.querySelectorAll('.nv-page,.nv-imgblock').forEach(b => { b.setAttribute('contenteditable', 'false'); });
  }
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
  weekStart = getMonday(d);
  setView('week');
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
    list.appendChild(el('div','day-modal-empty',{textContent:'아직 저장된 버전이 없어요 (편집하면 자동으로 기록돼요)'}));
  }
  [...m.hist].reverse().forEach((h, ri) => {
    const idx = m.hist.length - 1 - ri;
    const row = el('div','hist-row');
    const d = new Date(h.t);
    const info = el('div','hist-info');
    info.appendChild(el('div','hist-time',{textContent:`${d.getMonth()+1}/${d.getDate()} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`}));
    info.appendChild(el('div','hist-preview',{textContent:(h.title?h.title+' — ':'')+memoPreviewText(h.text).slice(0,48)}));
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
// contentEditable에서 블록 시작 '/' 감지 → 슬래시 메뉴
function detectSlashCE(m, editor, bodyWrap, win) {
  const sel = window.getSelection();
  if (!sel || !sel.rangeCount) { if (slashCtx) closeSlashMenu(); return; }
  const range = sel.getRangeAt(0);
  const node = range.startContainer;
  if (node.nodeType === 3 && node.nodeValue.slice(0, range.startOffset) === '/') {
    openSlashMenuCE(m, editor, bodyWrap, win, range);
  } else if (slashCtx) { closeSlashMenu(); }
}
function openSlashMenuCE(m, editor, bodyWrap, win, range) {
  slashCtx = { m, editor, bodyWrap, win };
  slashSel = 0; renderSlashMenu();
  let top = 0, left = 0;
  try { const r = range.getBoundingClientRect(); top = r.bottom || r.top; left = r.left; } catch (e) {}
  if (!top) { const er = editor.getBoundingClientRect(); top = er.top + 28; left = er.left + 16; }
  top += 6; left += 2;
  if (top + 240 > window.innerHeight) top = window.innerHeight - 250;
  slashMenu.style.top = top + 'px'; slashMenu.style.left = left + 'px';
  slashMenu.classList.remove('hidden');
}
function applySlash(i) {
  if (!slashCtx) return;
  const { m, editor, bodyWrap, win } = slashCtx;
  const it = SLASH_ITEMS[i];
  closeSlashMenu();
  if (!editor) return;
  // 현재 편집기 내용을 모델로 반영하고 '/'로 시작하는 줄을 찾음 (정확히 '/' 또는 '/'+텍스트)
  m.text = serializeNoteEditor(editor);
  const lines = m.text.split('\n');
  let idx = lines.findIndex(l => l.trim() === '/');
  if (idx < 0) idx = lines.findIndex(l => /^\s*\//.test(l));
  if (it.action === 'image') {
    if (idx >= 0) lines[idx] = lines[idx].replace(/^(\s*)\/\s?/, '$1');
    m.text = lines.join('\n');
    if (!READ_ONLY) saveMemos();
    pendingImgTarget = { m, editor };
    document.getElementById('noteImgInput').click();
    return;
  }
  const snip = (typeof it.snippet === 'function' ? it.snippet() : it.snippet).replace(/\n$/, '');
  if (idx < 0) { lines.push(snip); }
  else { const mm = lines[idx].match(/^(\s*)\/(.*)$/); lines[idx] = snip + (mm ? mm[2] : ''); }
  m.text = lines.join('\n');
  if (!READ_ONLY) saveMemos();
  renderNoteBody(m, bodyWrap, win, true);
}
let pendingImgTarget = null;
document.getElementById('noteImgInput').addEventListener('change', async e => {
  const f = e.target.files[0];
  if (f && pendingImgTarget) {
    if (pendingImgTarget.editor) await insertImageCE(pendingImgTarget.m, pendingImgTarget.editor, f);
    else await insertImageFile(pendingImgTarget.m, pendingImgTarget.ta, f);
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
// 노션식: 선택한 텍스트를 끌어다 놓으면 하위 메모로 생성 (본문엔 페이지 링크 추가)
function createSubNoteFromText(parentM, text) {
  text = (text||'').trim();
  if (!text || READ_ONLY || !parentM) return;
  const id = uid();
  const lines = text.split('\n');
  memos[id] = {
    id, title: lines[0].slice(0,80), text: lines.slice(1).join('\n'),
    parentId: parentM.id, open: false,
    x: 90, y: 130, w: 300, h: 280, z: 0, created: Date.now(),
    color: null, pinned: false, cx: null, cy: null, hist: [],
  };
  parentM.text = (parentM.text.trim() ? parentM.text.replace(/\s+$/, '') + '\n' : '') + `[[${id}]]\n`;
  saveMemos(); renderNoteWins();
  showToast('📄 하위 메모로 만들었어요');
}

function deleteMemoTree(id) {
  if (READ_ONLY) return;
  const parentId = memos[id] ? memos[id].parentId : null;
  const removed = {};
  (function collect(mid) {
    if (!memos[mid]) return;
    removed[mid] = memos[mid];
    memoChildren(mid).forEach(c => collect(c.id));
    delete memos[mid];
  })(id);
  // 부모 본문의 페이지 링크 토큰 제거 (실행취소 대비 원본 보관)
  const removedIds = Object.keys(removed);
  let parentPrevText = null;
  if (parentId && memos[parentId]) {
    parentPrevText = memos[parentId].text;
    memos[parentId].text = memos[parentId].text.split('\n')
      .filter(l => !removedIds.some(rid => l.trim() === `[[${rid}]]`)).join('\n');
  }
  saveMemos(); renderNoteWins();
  const cnt = removedIds.length;
  showToast(`메모 ${cnt}개를 삭제했어요`, () => {
    Object.assign(memos, removed);
    if (parentPrevText !== null && memos[parentId]) memos[parentId].text = parentPrevText;
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
  title.addEventListener('input', () => { m.title = title.value; clearTimeout(_noteTitleTimer); _noteTitleTimer = setTimeout(saveMemos, 400); });
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

  // ── 하위 메모 목록 (본문에 페이지 링크로 박힌 자식은 제외) ──
  const linkedIds = new Set([...m.text.matchAll(/^\s*\[\[([a-z0-9]+)\]\]\s*$/gm)].map(x => x[1]));
  const kids = memoChildren(m.id).filter(c => !linkedIds.has(c.id));
  if (kids.length || !READ_ONLY) {
    const box = el('div', 'note-children');
    if (!READ_ONLY) {
      // 본문에서 선택한 텍스트를 여기로 끌어다 놓으면 하위 메모로 생성
      box.addEventListener('dragover', e => {
        const types = [...(e.dataTransfer?.types||[])];
        if (types.includes('text/note-block')) return;
        if (types.includes('text/plain') || types.includes('text/html')) { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; box.classList.add('drop-target'); }
      });
      box.addEventListener('dragleave', e => { if (!box.contains(e.relatedTarget)) box.classList.remove('drop-target'); });
      box.addEventListener('drop', e => {
        const types = [...(e.dataTransfer?.types||[])];
        box.classList.remove('drop-target');
        if (types.includes('text/note-block')) return;
        const txt = e.dataTransfer.getData('text/plain');
        if (txt && txt.trim()) { e.preventDefault(); createSubNoteFromText(m, txt); }
      });
    }
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
      const add = el('button', 'note-add-child', {textContent: '+ 하위 메모', title: '선택한 텍스트를 이 영역으로 끌어다 놓아도 하위 메모가 만들어져요'});
      add.onclick = () => {
        const cid = createMemo(m.id);
        if (!cid) return;
        // 노션처럼 본문에 페이지 링크 블록으로 삽입
        m.text = (m.text.trim() ? m.text.replace(/\s+$/, '') + '\n' : '') + `[[${cid}]]\n`;
        saveMemos();
        navigateNote(m.id, cid);
      };
      box.appendChild(add);
    }
    win.appendChild(box);
  }

  // 이미지 드래그앤드롭 첨부
  if (!READ_ONLY) {
    win.addEventListener('dragover', e => {
      const types = [...(e.dataTransfer?.types||[])];
      if (types.includes('text/note-block')) return; // 내부 블록 재배치는 뷰에서 처리
      if (types.includes('Files')) e.preventDefault();
    });
    win.addEventListener('drop', async e => {
      if ([...(e.dataTransfer?.types||[])].includes('text/note-block')) return;
      const files = [...(e.dataTransfer?.files||[])].filter(f => f.type.startsWith('image/'));
      if (!files.length) return;
      e.preventDefault();
      noteEditState[m.id] = true;
      renderNoteBody(m, bodyWrap, win, true);
      const editor = bodyWrap.querySelector('.note-editor');
      if (editor) { for (const f of files) await insertImageCE(m, editor, f); }
    });
  }

  // 커스텀 리사이즈 핸들 (우하단 드래그로 자유 조절)
  if (window.innerWidth > 768) {
    const rh = el('div', 'note-resize', {title: '드래그해서 크기 조절'});
    rh.addEventListener('mousedown', e => {
      e.preventDefault(); e.stopPropagation();
      bringNoteToFront(m.id);
      const sx = e.clientX, sy = e.clientY, ow = win.offsetWidth, oh = win.offsetHeight;
      const mv = ev => {
        win.style.width = Math.max(240, Math.min(ow + ev.clientX - sx, window.innerWidth - 16)) + 'px';
        win.style.height = Math.max(170, Math.min(oh + ev.clientY - sy, window.innerHeight - 16)) + 'px';
      };
      const up = () => {
        document.removeEventListener('mousemove', mv);
        document.removeEventListener('mouseup', up);
        m.w = win.offsetWidth; m.h = win.offsetHeight;
        saveMemos();
      };
      document.addEventListener('mousemove', mv);
      document.addEventListener('mouseup', up);
    });
    win.appendChild(rh);
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

// 노트 서식: 선택 영역을 마커로 감싸기
function placeCaretEnd(elx) {
  elx.focus();
  try { const r = document.createRange(); r.selectNodeContents(elx); r.collapse(false); const s = window.getSelection(); s.removeAllRanges(); s.addRange(r); } catch (e) {}
}
async function insertImageCE(m, editor, file) {
  if (READ_ONLY || !file) return;
  const dataUrl = await compressImage(file);
  if (!dataUrl) { showToast('⚠️ 이미지를 읽을 수 없어요'); return; }
  const id = uid(); await idbPutImage(id, dataUrl);
  editor.focus();
  document.execCommand('insertHTML', false,
    `<div class="nv-imgblock" contenteditable="false" draggable="true"><img class="nv-img" data-img="${id}" alt="" draggable="false"><span class="nv-imgmove" title="드래그해서 위치 이동">⠿</span></div><div class="nv-p"><br></div>`);
  hydrateNoteMedia(editor, true);
  m.text = serializeNoteEditor(editor); if (!READ_ONLY) saveMemos();
  showToast('🖼 이미지 첨부됨 (이 기기에만 저장)');
}
// WYSIWYG 서식 툴바 (contentEditable + execCommand)
function buildNoteToolbar(editor, m) {
  const tb = el('div', 'note-toolbar');
  const save = () => { m.text = serializeNoteEditor(editor); if (!READ_ONLY) saveMemos(); };
  const exec = (cmd, val) => { editor.focus(); try { document.execCommand('styleWithCSS', false, true); } catch (e) {} try { document.execCommand(cmd, false, val); } catch (e) {} save(); };
  const wrap = (prop, value) => {
    editor.focus();
    const sel = window.getSelection(); if (!sel || !sel.rangeCount) return;
    const range = sel.getRangeAt(0); if (range.collapsed) return;
    const span = document.createElement('span'); span.style[prop] = value;
    try { span.appendChild(range.extractContents()); range.insertNode(span); sel.removeAllRanges(); const r = document.createRange(); r.selectNodeContents(span); sel.addRange(r); } catch (e) {}
    save();
  };
  const fontMap = { pretendard:"'Pretendard Variable',sans-serif", noto:"'Noto Sans KR',sans-serif", notoserif:"'Noto Serif KR',serif", nanum:"'Nanum Gothic',sans-serif", nanummyeongjo:"'Nanum Myeongjo',serif", gowun:"'Gowun Dodum',sans-serif", jua:"'Jua',sans-serif", dohyeon:"'Do Hyeon',sans-serif", gaegu:"'Gaegu',cursive", nanumpen:"'Nanum Pen Script',cursive" };
  const fontSel = el('select', 'nt-select', { title: '글꼴' });
  fontSel.innerHTML = '<option value="">글꼴</option><option value="pretendard">프리텐다드</option><option value="noto">본고딕</option><option value="notoserif">본명조</option><option value="nanum">나눔고딕</option><option value="nanummyeongjo">나눔명조</option><option value="gowun">고운돋움</option><option value="jua">주아</option><option value="dohyeon">도현</option><option value="gaegu">개구</option><option value="nanumpen">나눔펜</option>';
  fontSel.onchange = () => { if (fontSel.value && fontMap[fontSel.value]) wrap('fontFamily', fontMap[fontSel.value]); fontSel.selectedIndex = 0; };
  const sizeSel = el('select', 'nt-select', { title: '글자 크기' });
  sizeSel.innerHTML = '<option value="">크기</option>' + [12,14,16,18,20,24,28,32].map(n => `<option value="${n}">${n}</option>`).join('');
  sizeSel.onchange = () => { if (sizeSel.value) wrap('fontSize', sizeSel.value + 'px'); sizeSel.selectedIndex = 0; };
  tb.appendChild(fontSel); tb.appendChild(sizeSel);
  [['bold','<b>B</b>','굵게'],['italic','<i>I</i>','기울임'],['underline','<u>U</u>','밑줄'],['strikeThrough','<s>S</s>','취소선']].forEach(([cmd,label,title]) => {
    const b = el('button', 'nt-btn', { title, type: 'button' }); b.innerHTML = label;
    b.addEventListener('mousedown', e => e.preventDefault());
    b.onclick = () => exec(cmd);
    tb.appendChild(b);
  });
  const foreLab = el('label', 'nt-color', { title: '글자색' });
  foreLab.innerHTML = '<span style="color:#1a73e8;font-weight:800">A</span>';
  const fore = el('input', null, { type: 'color', value: '#1a73e8' });
  fore.onchange = () => wrap('color', fore.value);
  foreLab.appendChild(fore); tb.appendChild(foreLab);
  const bgLab = el('label', 'nt-color', { title: '배경색(형광펜)' });
  bgLab.innerHTML = '<span style="background:#fff59d;border-radius:3px;padding:0 3px">H</span>';
  const bg = el('input', null, { type: 'color', value: '#fff59d' });
  bg.onmousedown = e => e.stopPropagation();
  bg.onchange = () => wrap('backgroundColor', bg.value);
  bgLab.appendChild(bg); tb.appendChild(bgLab);
  return tb;
}
function renderNoteBody(m, bodyWrap, win, focusEdit) {
  bodyWrap.innerHTML = '';
  const editing = !READ_ONLY && (noteEditState[m.id] || (!m.text.trim() && !memoChildren(m.id).length));
  if (editing) {
    const editor = el('div', 'note-editor');
    editor.contentEditable = 'true';
    try { document.execCommand('defaultParagraphSeparator', false, 'div'); } catch (e) {} // Enter → 평평한 div(중첩 방지)
    editor.setAttribute('data-ph', '메모를 입력하세요...  ( / 입력 → 블록, 이미지 붙여넣기 )');
    editor.innerHTML = m.text.trim() ? renderMarkdown(m.text) : '<div class="nv-p"><br></div>';
    hydrateNoteMedia(editor, true);
    const serialize = () => { m.text = serializeNoteEditor(editor); if (!READ_ONLY) saveMemos(); };
    editor.addEventListener('input', () => { serialize(); detectSlashCE(m, editor, bodyWrap, win); });
    editor.addEventListener('keydown', e => {
      if (slashCtx) {
        if (e.key === 'ArrowDown') { e.preventDefault(); slashSel = (slashSel+1)%SLASH_ITEMS.length; renderSlashMenu(); return; }
        if (e.key === 'ArrowUp') { e.preventDefault(); slashSel = (slashSel-1+SLASH_ITEMS.length)%SLASH_ITEMS.length; renderSlashMenu(); return; }
        if (e.key === 'Enter') { e.preventDefault(); applySlash(slashSel); return; }
        if (e.key === 'Escape') { e.stopPropagation(); closeSlashMenu(); return; }
      }
      if (e.key === 'Escape') { e.stopPropagation(); editor.blur(); }
    });
    editor.addEventListener('blur', () => {
      setTimeout(() => {
        if (slashCtx && slashCtx.editor === editor) return; // 슬래시 메뉴 조작 중
        if (document.activeElement === editor) return;
        if (document.activeElement && document.activeElement.closest && document.activeElement.closest('.note-toolbar')) return; // 서식 툴바 조작 중
        noteEditState[m.id] = false;
        serialize(); snapshotMemo(m);
        if (!READ_ONLY) saveMemos();
        if (bodyWrap.isConnected) renderNoteBody(m, bodyWrap, win);
      }, 150);
    });
    editor.addEventListener('paste', e => {
      const items = [...(e.clipboardData?.items||[])].filter(i => i.type.startsWith('image/'));
      if (items.length) {
        e.preventDefault();
        (async () => { for (const it of items) await insertImageCE(m, editor, it.getAsFile()); })();
        return;
      }
      e.preventDefault();
      const text = (e.clipboardData || window.clipboardData).getData('text/plain');
      if (text) document.execCommand('insertText', false, text);
    });
    // 편집 중에도 페이지 링크 클릭→이동, 체크박스 클릭→토글
    editor.addEventListener('click', e => {
      const page = e.target.closest('.nv-page');
      if (page) { e.preventDefault(); e.stopPropagation(); if (memos[page.dataset.note]) { serialize(); snapshotMemo(m); navigateNote(m.id, page.dataset.note); } return; }
      const cb = e.target.closest('.nv-check');
      if (cb) { e.preventDefault(); e.stopPropagation(); cb.classList.toggle('done'); const dot = cb.querySelector('.nv-cb'); if (dot) dot.classList.toggle('on'); serialize(); }
    });
    if (!READ_ONLY) bodyWrap.appendChild(buildNoteToolbar(editor, m));
    bodyWrap.appendChild(editor);
    if (focusEdit) setTimeout(() => placeCaretEnd(editor), 30);
  } else {
    const view = el('div', 'note-view');
    view.innerHTML = renderMarkdown(m.text);
    // 이미지 하이드레이션 (IndexedDB)
    view.querySelectorAll('img[data-img]').forEach(img => {
      idbGetImage(img.dataset.img).then(data => {
        if (data) {
          const url = (typeof data === 'string') ? data : URL.createObjectURL(data);
          img.src = url;
          img.onclick = ev => { ev.stopPropagation(); openLightbox(url); };
        }
        else { img.alt = '🖼 이미지는 첨부한 기기에서만 보여요'; img.classList.add('missing'); }
      });
    });
    // 블록 드래그: 페이지 링크/이미지를 줄 사이로 이동 (그 외 요소의 네이티브 드래그 차단 → 이미지 복사 버그 수정)
    view.addEventListener('dragstart', e => {
      const blk = e.target.closest('.nv-page,.nv-imgblock');
      if (!blk || READ_ONLY) { e.preventDefault(); return; }
      e.dataTransfer.setData('text/note-block', JSON.stringify({memo: m.id, line: +blk.dataset.line}));
      e.dataTransfer.effectAllowed = 'move';
    });
    const clearDropMarks = () => view.querySelectorAll('.nv-drop-before,.nv-drop-after').forEach(x => x.classList.remove('nv-drop-before','nv-drop-after'));
    view.addEventListener('dragover', e => {
      if (![...e.dataTransfer.types].includes('text/note-block')) return;
      e.preventDefault(); e.stopPropagation();
      clearDropMarks();
      const blk = e.target.closest('[data-line]');
      if (blk) {
        const r = blk.getBoundingClientRect();
        blk.classList.add(e.clientY < r.top + r.height/2 ? 'nv-drop-before' : 'nv-drop-after');
      }
    });
    view.addEventListener('dragleave', e => { if (e.target === view) clearDropMarks(); });
    view.addEventListener('drop', e => {
      if (![...e.dataTransfer.types].includes('text/note-block')) return;
      e.preventDefault(); e.stopPropagation();
      clearDropMarks();
      if (READ_ONLY) return;
      let data; try { data = JSON.parse(e.dataTransfer.getData('text/note-block')); } catch { return; }
      if (data.memo !== m.id) return;
      const blk = e.target.closest('[data-line]');
      let to = m.text.split('\n').length;
      if (blk) {
        const r = blk.getBoundingClientRect();
        to = +blk.dataset.line + (e.clientY < r.top + r.height/2 ? 0 : 1);
      }
      m.text = moveNoteLine(m.text, data.line, to);
      saveMemos();
      renderNoteBody(m, bodyWrap, win);
    });
    view.addEventListener('click', e => {
      const page = e.target.closest('.nv-page');
      if (page) {
        e.stopPropagation();
        if (memos[page.dataset.note]) navigateNote(m.id, page.dataset.note);
        return;
      }
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
    const body = m.text.split('\n').filter(l => !/^\s*\[\[[a-z0-9]+\]\]\s*$/.test(l)).join('\n');
    if (body.trim()) {
      md += body.replace(/!\[([^\]]*)\]\(local:[a-z0-9_]+\)/g, '*[$1 — 로컬 이미지 첨부]*') + '\n\n';
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
// 마우스+터치 통합 드래그. 터치는 longPressMs>0이면 꾹 누른 뒤 시작(스크롤/팬과 구분), 0이면 즉시.
function attachDrag(handle, opts){
  const { onStart, onMove, onEnd, longPressMs=0, stopPropagation=false } = opts||{};
  handle.addEventListener('pointerdown', e=>{
    if(e.pointerType==='mouse' && e.button!==0) return;
    if(e.target.closest && e.target.closest('input,button,textarea,select,a')) return;
    if(stopPropagation) e.stopPropagation();
    const isTouch = e.pointerType==='touch';
    const sx=e.clientX, sy=e.clientY;
    let started=false, lp=null;
    const begin=()=>{ if(started)return; started=true; clearTimeout(lp); if(onStart) onStart(e); };
    const move=ev=>{
      if(ev.pointerId!==e.pointerId) return;
      if(!started){
        if(isTouch){
          if(longPressMs>0){ if(Math.hypot(ev.clientX-sx,ev.clientY-sy)>10) cleanup(); return; }
          begin();
        } else begin();
      }
      ev.preventDefault();
      if(onMove) onMove(ev);
    };
    const end=ev=>{ if(ev.pointerId!==e.pointerId) return; const was=started; cleanup(); if(was&&onEnd) onEnd(ev); };
    const cleanup=()=>{ clearTimeout(lp); document.removeEventListener('pointermove',move); document.removeEventListener('pointerup',end); document.removeEventListener('pointercancel',end); };
    document.addEventListener('pointermove',move);
    document.addEventListener('pointerup',end);
    document.addEventListener('pointercancel',end);
    if(isTouch){ if(longPressMs>0) lp=setTimeout(begin,longPressMs); } else begin();
  });
}
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
    const preview = memoPreviewText(m.text).slice(0, 36);
    if (preview) card.appendChild(el('div', 'canvas-card-preview', {textContent: preview}));
    const tags = extractTags(m);
    if (tags.length) card.appendChild(el('div', 'canvas-card-tags', {textContent: tags.map(t=>'#'+t).join(' ')}));
    // 드래그 재배치 (PC: 즉시, 모바일: 꾹 눌러서)
    let _csx, _csy, _cox, _coy;
    attachDrag(card, {
      longPressMs: 180, stopPropagation: true,
      onStart: e => { _csx=e.clientX; _csy=e.clientY; _cox=m.cx; _coy=m.cy; card.classList.add('dragging'); },
      onMove: ev => {
        m.cx = _cox + ev.clientX - _csx; m.cy = _coy + ev.clientY - _csy;
        card.style.left = (m.cx + canvasPan.x) + 'px';
        card.style.top = (m.cy + canvasPan.y) + 'px';
        drawLines();
      },
      onEnd: () => { card.classList.remove('dragging'); if (!READ_ONLY) saveMemos(); }
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
    board.appendChild(el('div', 'canvas-empty', {textContent: '메모가 없어요 — 빈 곳을 더블클릭해서 만들어 보세요'}));
  }
  // 배경 드래그로 팬 (PC/모바일 즉시)
  let _psx, _psy, _pox, _poy;
  attachDrag(board, {
    longPressMs: 0,
    onStart: e => { _psx=e.clientX; _psy=e.clientY; _pox=canvasPan.x; _poy=canvasPan.y; },
    onMove: ev => { canvasPan.x = _pox + ev.clientX - _psx; canvasPan.y = _poy + ev.clientY - _psy; renderCanvas(); }
  });
}

// ── 📝 메모 보관함 메뉴 ──
const notesMenu = document.getElementById('notesMenu');
function renderNotesMenu() {
  notesMenu.innerHTML = '';
  if (!READ_ONLY) {
    const add = el('button', 'more-menu-item', {textContent: '➕ 새 메모'});
    add.setAttribute('role', 'menuitem');
    add.onclick = () => { notesMenu.classList.add('hidden'); createMemo(null); };
    notesMenu.appendChild(add);
  }
  const canvasBtn = el('button', 'more-menu-item', {textContent: '🗺 캔버스 보기 (전체 배치)'});
  canvasBtn.setAttribute('role', 'menuitem');
  canvasBtn.onclick = () => { notesMenu.classList.add('hidden'); openCanvas(); };
  notesMenu.appendChild(canvasBtn);
  const mdBtn = el('button', 'more-menu-item', {textContent: '📤 마크다운 내보내기'});
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
    notesMenu.appendChild(el('div', 'more-menu-item', {textContent: notesTagFilter ? '이 태그의 메모 없음' : '메모 없음 — 빈 곳을 더블클릭해 만들 수 있어요', style: 'cursor:default;color:var(--text3);font-size:11px'}));
  }
  roots.forEach(m => {
    const item = el('button', 'more-menu-item');
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
  document.getElementById('moreMenu').classList.add('hidden');
  renderNotesMenu();
  notesMenu.classList.toggle('hidden');
};
document.addEventListener('click', e => {
  if (!notesMenu.classList.contains('hidden') && !e.target.closest('.more-menu-wrap'))
    notesMenu.classList.add('hidden');
  if (slashCtx && !e.target.closest('#slashMenu') && !e.target.closest('.note-editor'))
    closeSlashMenu();
});


// ═══════════════════════════════════════
// 👥 유저 간 일정 공유 — 상대 캘린더 겹쳐보기(읽기 전용) + 일정 보내기
// ═══════════════════════════════════════
const SHARES_KEY = USER_ID ? `calShares_${USER_ID}` : 'calShares';
const SHARE_COLORS = ['#8e24aa','#00897b','#d81b60','#5e35b1','#f4511e','#3949ab'];
let shares = (() => { try { return JSON.parse(localStorage.getItem(SHARES_KEY) || '{}') || {}; } catch { return {}; } })();
let sharedTasks = {};        // ownerId → 정규화된 tasks
const shareHandles = {};     // ownerId → {ref, cb}
let pendingShareLocal = false, shareSaveTimer = null;

function sharesFbRef() { return FB_UID && USER_ID !== 'demo' && fbDb ? fbDb.ref(`users/${FB_UID}/shares`) : null; }
function saveShares() {
  if (READ_ONLY) return;
  localStorage.setItem(SHARES_KEY, JSON.stringify(shares));
  const ref = sharesFbRef(); if (!ref) return;
  pendingShareLocal = true;
  clearTimeout(shareSaveTimer);
  shareSaveTimer = setTimeout(() => {
    shareSaveTimer = null;
    ref.set(Object.keys(shares).length ? fbClean(shares) : null)
      .then(() => { pendingShareLocal = false; _pendingCollections.delete('shares'); })
      .catch((e) => { console.warn('Firebase 저장 실패(shares):', e); _pendingCollections.add('shares'); });
  }, 300);
}
function initShareSync() {
  attachShareListeners();
  const ref = sharesFbRef(); if (!ref) return;
  ref.on('value', snap => {
    if (pendingShareLocal) return;
    const remote = snap.val();
    shares = (remote && typeof remote === 'object') ? remote : {};
    localStorage.setItem(SHARES_KEY, JSON.stringify(shares));
    attachShareListeners();
    renderShareList();
    render();
  }, () => {});
}
function attachShareListeners() {
  if (!fbDb) return;
  // 제거/꺼진 공유의 리스너 해제
  Object.keys(shareHandles).forEach(id => {
    if (!shares[id] || !shares[id].on) {
      shareHandles[id].ref.off('value', shareHandles[id].cb);
      delete shareHandles[id];
      delete sharedTasks[id];
    }
  });
  // 켜진 공유 구독
  Object.entries(shares).forEach(([id, s]) => {
    if (!s || !s.on || shareHandles[id]) return;
    const ref = fbDb.ref(`users/${id}/tasks`);
    const cb = snap => { sharedTasks[id] = normalizeTasks(snap.val() || {}); render(); };
    ref.on('value', cb, () => {});
    shareHandles[id] = {ref, cb};
  });
}
// 해당 날짜의 공유 일정 (v1: 직접 입력 일정 — 반복은 시작일 기준)
function sharedTasksFor(dk) {
  const out = [];
  Object.entries(sharedTasks).forEach(([owner, tree]) => {
    if (!shares[owner] || !shares[owner].on) return;
    (tree[dk] || []).forEach(t => {
      if (t) out.push({owner, task: t, color: shares[owner].color || SHARE_COLORS[0]});
    });
  });
  return out;
}

// ── 공유 관리 모달 ──
function openShareModal() {
  if (!USER_ID || USER_ID === 'demo') { showUndoToast('내 캘린더 URL(?u=이름)에서만 사용할 수 있어요'); return; }
  document.getElementById('shareMyId').textContent = USER_ID;
  renderShareList();
  document.getElementById('shareModal').classList.remove('hidden');
  setTimeout(() => document.getElementById('shareAddInput').focus(), 60);
}
function closeShareModal() { document.getElementById('shareModal').classList.add('hidden'); }
function renderShareList() {
  const box = document.getElementById('shareList');
  if (!box) return;
  box.innerHTML = '';
  const ids = Object.keys(shares);
  if (!ids.length) {
    box.appendChild(el('div', 'day-empty-text', {textContent: '아직 추가한 사람이 없어요', style: 'text-align:center;padding:10px;color:var(--text3);font-size:12px'}));
    return;
  }
  ids.forEach(id => {
    const s = shares[id];
    const row = el('div', 'share-row');
    const dot = el('button', 'share-color-dot', {title: '색상 변경'});
    dot.style.background = s.color || SHARE_COLORS[0];
    dot.onclick = () => {
      const i = SHARE_COLORS.indexOf(s.color);
      s.color = SHARE_COLORS[(i + 1) % SHARE_COLORS.length];
      saveShares(); renderShareList(); render();
    };
    row.appendChild(dot);
    row.appendChild(el('span', 'share-name', {textContent: '👤 ' + id}));
    const toggle = el('button', `share-toggle${s.on ? ' on' : ''}`, {textContent: s.on ? '👁 보는 중' : '🚫 숨김'});
    toggle.onclick = () => { s.on = !s.on; saveShares(); attachShareListeners(); renderShareList(); render(); };
    row.appendChild(toggle);
    const del = el('button', 'task-act-btn del', {textContent: '✕', title: '공유 제거'});
    del.onclick = () => { delete shares[id]; saveShares(); attachShareListeners(); renderShareList(); render(); };
    row.appendChild(del);
    box.appendChild(row);
  });
}
document.getElementById('shareCalBtn').onclick = () => {
  document.getElementById('moreMenu').classList.add('hidden');
  openShareModal();
};
document.getElementById('shareCloseBtn').onclick = closeShareModal;
document.getElementById('shareModal').onclick = e => { if (e.target === document.getElementById('shareModal')) closeShareModal(); };
document.getElementById('shareMyCopy').onclick = () => {
  navigator.clipboard.writeText(USER_ID).then(() => showUndoToast('내 이름을 복사했어요'));
};
document.getElementById('shareAddBtn').onclick = () => {
  const inp = document.getElementById('shareAddInput');
  const id = (inp.value || '').replace(/[.#$\[\]\/]/g, '').trim().slice(0, 40);
  if (!id) { inp.focus(); return; }
  if (id === USER_ID) { showUndoToast('⚠️ 내 이름은 추가할 수 없어요'); return; }
  if (shares[id]) { showUndoToast('이미 추가된 사람이에요'); return; }
  shares[id] = {on: true, color: SHARE_COLORS[Object.keys(shares).length % SHARE_COLORS.length]};
  inp.value = '';
  saveShares(); attachShareListeners(); renderShareList(); render();
  showUndoToast(`👥 ${id}님의 일정을 함께 봅니다`);
};
document.getElementById('shareAddInput').addEventListener('keydown', e => {
  if (e.key === 'Enter') document.getElementById('shareAddBtn').click();
});

// ── 일정 보내기 (에디트 모달에서) ──
document.getElementById('editSendBtn').onclick = () => {
  if (editCtx) openSendModal(editCtx.dk, editCtx.taskId);
};

// ── 사용자 디렉터리 (전체 사용자 검색용) ──
function sanitizeId(s){ return (s||'').replace(/[.#$\[\]\/]/g,'').trim().slice(0,40); }
function userDirFbRef(){
  const key = sanitizeId(USER_ID);
  return (fbDb && key && USER_ID !== 'demo') ? fbDb.ref('userDirectory/' + key) : null;
}
function registerUserDirectory(){
  const ref = userDirFbRef(); if (!ref) return;
  ref.set({ name: USER_ID, ts: Date.now() }).catch(()=>{});
}
let _userDirCache = [];
// 내가 따라보거나(shares) 보냈던 사용자 — 전역 디렉터리(userDirectory)가 규칙에 막혀도 목록에 표시
function localKnownUsers(){
  const set = new Set();
  try { (JSON.parse(localStorage.getItem('calKnownUsers')||'[]')||[]).forEach(u=>set.add(u)); } catch(e){}
  Object.keys(shares||{}).forEach(u=>set.add(u));
  set.delete(sanitizeId(USER_ID));
  return [...set].filter(Boolean);
}
function rememberUser(id){
  const s = sanitizeId(id); if(!s || s===sanitizeId(USER_ID)) return;
  try { const a=JSON.parse(localStorage.getItem('calKnownUsers')||'[]')||[]; if(!a.includes(s)){ a.push(s); localStorage.setItem('calKnownUsers', JSON.stringify(a)); } } catch(e){}
}
function fetchUserDirectory(cb){
  const merge = remote => [...new Set([...(remote||[]), ...localKnownUsers()])];
  if (!fbDb) { cb(merge(_userDirCache)); return; }
  fbDb.ref('userDirectory').once('value').then(snap => {
    const v = snap.val() || {};
    _userDirCache = Object.keys(v).filter(id => id && id !== sanitizeId(USER_ID));
    cb(merge(_userDirCache));
  }).catch(() => cb(merge(_userDirCache)));
}

// ── 태스크 보내기 모달 (검색·복수선택, 수락 필요) ──
let sendCtx = null;          // {dk, taskId}
let sendSelected = [];       // 선택된 받는 사람 id 목록
let sendDirIds = [];         // 디렉터리 전체 id
function openSendModal(dk, taskId){
  if (!fbDb) { showUndoToast('⚠️ 오프라인 상태예요'); return; }
  if (!USER_ID || USER_ID === 'demo') { showUndoToast('내 캘린더 URL(?u=이름)에서만 보낼 수 있어요'); return; }
  const t = (tasks[dk] || []).find(x => x.id === taskId); if (!t) return;
  sendCtx = { dk, taskId };
  sendSelected = [];
  sendDirIds = [];
  document.getElementById('sendTaskName').textContent = t.text;
  document.getElementById('sendSearchInput').value = '';
  renderSendChips();
  document.getElementById('sendResults').innerHTML = '<div class="send-empty">불러오는 중…</div>';
  document.getElementById('sendModal').classList.remove('hidden');
  setTimeout(() => document.getElementById('sendSearchInput').focus(), 60);
  fetchUserDirectory(ids => { sendDirIds = ids; renderSendResults(); });
}
function closeSendModal(){ document.getElementById('sendModal').classList.add('hidden'); sendCtx = null; }
function renderSendChips(){
  const box = document.getElementById('sendSelected'); box.innerHTML = '';
  sendSelected.forEach(id => {
    const chip = el('span', 'send-chip', { textContent: '👤 ' + id });
    const x = el('button', null, { type:'button', textContent: '✕', title: '제거' });
    x.onclick = () => { sendSelected = sendSelected.filter(s => s !== id); renderSendChips(); renderSendResults(); };
    chip.appendChild(x); box.appendChild(chip);
  });
}
function renderSendResults(){
  const q = sanitizeId(document.getElementById('sendSearchInput').value).toLowerCase();
  const box = document.getElementById('sendResults'); box.innerHTML = '';
  let list = sendDirIds.filter(id => !sendSelected.includes(id));
  if (q) list = list.filter(id => id.toLowerCase().includes(q));
  // 검색어로 직접 추가 (디렉터리에 없는 사람도 보낼 수 있게)
  const typed = sanitizeId(document.getElementById('sendSearchInput').value);
  if (typed && typed !== USER_ID && !sendSelected.includes(typed) && !sendDirIds.some(id => id.toLowerCase() === typed.toLowerCase())) {
    const add = el('button', 'send-result-item send-add-typed', { textContent: `+ "${typed}" 직접 추가` });
    add.onclick = () => { sendSelected.push(typed); document.getElementById('sendSearchInput').value=''; renderSendChips(); renderSendResults(); };
    box.appendChild(add);
  }
  if (!sendDirIds.length && !typed) {
    box.appendChild(el('div', 'send-empty', { textContent: '아직 등록된 사용자가 없어요. 상대가 자기 캘린더(?u=이름)를 한 번 열면 검색에 나타나요. 이름을 직접 입력해 보낼 수도 있어요.' }));
    return;
  }
  list.slice(0, 60).forEach(id => {
    const row = el('button', 'send-result-item', { type:'button', textContent: '👤 ' + id });
    row.onclick = () => { sendSelected.push(id); document.getElementById('sendSearchInput').value=''; renderSendChips(); renderSendResults(); };
    box.appendChild(row);
  });
  if (!list.length && typed) { /* 직접추가 버튼만 노출된 상태 */ }
  else if (!list.length) box.appendChild(el('div', 'send-empty', { textContent: '검색 결과가 없어요' }));
}
function confirmSend(){
  if (!sendCtx) return;
  const typed = sanitizeId(document.getElementById('sendSearchInput').value);
  if (typed && typed !== USER_ID && !sendSelected.includes(typed)) sendSelected.push(typed);
  const recipients = [...new Set(sendSelected.filter(id => id && id !== USER_ID))];
  if (!recipients.length) { showUndoToast('받는 사람을 선택해 주세요'); return; }
  recipients.forEach(rememberUser);   // 보낸 사람 로컬 기억 → 다음에 목록에 표시
  const { dk, taskId } = sendCtx;
  const t = (tasks[dk] || []).find(x => x.id === taskId);
  if (!t) { closeSendModal(); return; }
  let done = 0, fail = 0;
  Promise.all(recipients.map(to => {
    const copy = {
      id: uid(), text: t.text, checked: false, starred: !!t.starred,
      color: t.color || null, repeat: 'none', priority: t.priority || null,
      time: t.time || null, memo: t.memo || '', completions: {}, skips: {},
      subs: (t.subs || []).map(s => ({ id: uid(), text: s.text, checked: false, starred: false, color: null, subs: [] })),
      from: USER_ID, pending: true,
    };
    const ref = fbDb.ref(`users/${to}/tasks/${dk}`);
    // transaction: 읽기→쓰기 사이에 상대방(또는 다른 발신자)이 쓴 데이터를 덮어쓰지 않음
    return ref.transaction(raw => {
      const list = Array.isArray(raw) ? raw.filter(Boolean) : Object.values(raw || {});
      list.push(fbClean(copy));
      return list;
    }).then(() => { done++; }).catch(() => { fail++; });
  })).then(() => {
    closeSendModal();
    if (done) showUndoToast(`👥 ${done}명에게 보냈어요 — 상대가 수락하면 추가돼요`);
    if (fail) showUndoToast(`⚠️ ${fail}명에게 보내지 못했어요 — 네트워크를 확인해 주세요`);
  });
}
document.getElementById('sendCancelBtn').onclick = closeSendModal;
document.getElementById('sendConfirmBtn').onclick = confirmSend;
document.getElementById('sendModal').onclick = e => { if (e.target === document.getElementById('sendModal')) closeSendModal(); };
document.getElementById('sendSearchInput').addEventListener('input', renderSendResults);
document.getElementById('sendSearchInput').addEventListener('keydown', e => {
  if (e.key !== 'Enter') return;
  e.preventDefault();
  const inp = document.getElementById('sendSearchInput');
  const typed = sanitizeId(inp.value);
  if (typed) {
    // 입력 중 Enter → 바로 보내지 않고 받는 사람 목록에 추가만.
    // (부분 입력이 그대로 전송돼 존재하지 않는 사용자에게 가는 사고 방지)
    if (typed !== USER_ID && !sendSelected.includes(typed)) sendSelected.push(typed);
    inp.value = '';
    renderSendResults();
  } else {
    confirmSend();
  }
});

// ═══════════════════════════════════════
// 🎯 목표 & 연속달성(streak)
// ═══════════════════════════════════════
const GOALS_KEY = USER_ID ? `calGoals_${USER_ID}` : 'calGoals';
let goals = (() => { try { return JSON.parse(localStorage.getItem(GOALS_KEY) || '[]') || []; } catch { return []; } })();
let goalSaveTimer = null, pendingGoalLocal = false;
function goalsFbRef() { return fbDb && FB_UID && USER_ID !== 'demo' ? fbDb.ref(`users/${FB_UID}/goals`) : null; }
function saveGoals() {
  if (READ_ONLY) return;
  localStorage.setItem(GOALS_KEY, JSON.stringify(goals));
  const ref = goalsFbRef(); if (!ref) return;
  pendingGoalLocal = true;
  clearTimeout(goalSaveTimer);
  goalSaveTimer = setTimeout(() => { goalSaveTimer = null; ref.set(fbClean(goals)).then(()=>{pendingGoalLocal=false;_pendingCollections.delete('goals');}).catch((e)=>{console.warn('Firebase 저장 실패(goals):',e);_pendingCollections.add('goals');}); }, 300);
}
function initGoalSync() {
  const ref = goalsFbRef(); if (!ref) return;
  ref.on('value', snap => {
    if (pendingGoalLocal) return;
    const r = snap.val();
    goals = Array.isArray(r) ? r : (r ? Object.values(r) : []);
    localStorage.setItem(GOALS_KEY, JSON.stringify(goals));
  }, () => {});
}
// 오늘 체크 토글
function toggleGoalToday(id) {
  const g = goals.find(x => x.id === id); if (!g) return;
  if (!g.done) g.done = {};
  const tk = todayKey();
  if (g.done[tk]) delete g.done[tk]; else g.done[tk] = true;
  saveGoals(); renderGoals();
}
// 현재 연속 달성일 (오늘부터 거꾸로, target=7이면 매일 기준 / 그 외 주간목표는 이번주 횟수)
function goalStreak(g) {
  let streak = 0;
  const d = today();
  for (let i = 0; i < 400; i++) {
    if (g.done && g.done[dateKey(d)]) streak++;
    else if (i > 0) break;          // 오늘 안 했어도 어제까지 연속은 인정
    else if (!(g.done && g.done[dateKey(d)])) { /* 오늘 미완료 → 어제부터 */ }
    d.setDate(d.getDate() - 1);
  }
  return streak;
}
function goalWeekCount(g) {
  const mon = getMonday(new Date());
  let c = 0;
  for (let i = 0; i < 7; i++) { const d = new Date(mon); d.setDate(d.getDate()+i); if (g.done && g.done[dateKey(d)]) c++; }
  return c;
}
function openGoals() {
  renderGoals();
  document.getElementById('goalsModal').classList.remove('hidden');
}
function renderGoals() {
  // 상단 요약
  const box = document.getElementById('goalsStreakBox');
  const best = goals.reduce((mx, g) => Math.max(mx, goalStreak(g)), 0);
  box.innerHTML = goals.length
    ? `<div style="text-align:center;padding:10px;background:var(--surface2);border-radius:10px">
         <div style="font-size:26px">🔥 ${best}일</div>
         <div style="font-size:11px;color:var(--text3)">최고 연속 달성</div></div>`
    : '<div style="font-size:12px;color:var(--text3);text-align:center;padding:8px">목표를 추가하고 매일 체크해 보세요</div>';
  const list = document.getElementById('goalsList');
  list.innerHTML = '';
  const tk = todayKey();
  goals.forEach(g => {
    const row = el('div', 'goal-row');
    const today_done = !!(g.done && g.done[tk]);
    const cb = el('button', `goal-check${today_done ? ' on' : ''}`, {textContent: today_done ? '✓' : ''});
    cb.title = '오늘 달성 체크';
    cb.onclick = () => toggleGoalToday(g.id);
    row.appendChild(cb);
    const info = el('div', 'goal-info');
    info.appendChild(el('div', 'goal-name', {textContent: g.text}));
    const wc = goalWeekCount(g), tgt = +g.target || 7;
    info.appendChild(el('div', 'goal-meta', {textContent: `🔥 ${goalStreak(g)}일 연속 · 이번 주 ${wc}/${tgt===7?7:tgt}회`}));
    row.appendChild(info);
    const del = el('button', 'task-act-btn del', {textContent: '✕', title: '목표 삭제'});
    del.onclick = () => { goals = goals.filter(x => x.id !== g.id); saveGoals(); renderGoals(); };
    row.appendChild(del);
    list.appendChild(row);
  });
}
document.getElementById('goalsBtn').onclick = () => { document.getElementById('moreMenu').classList.add('hidden'); openGoals(); };
document.getElementById('goalsClose').onclick = () => document.getElementById('goalsModal').classList.add('hidden');
document.getElementById('goalsModal').onclick = e => { if (e.target === document.getElementById('goalsModal')) document.getElementById('goalsModal').classList.add('hidden'); };
document.getElementById('goalAddBtn').onclick = () => {
  const inp = document.getElementById('goalInput');
  const t = inp.value.trim(); if (!t) { inp.focus(); return; }
  goals.push({ id: uid(), text: t, target: +document.getElementById('goalTarget').value, done: {} });
  inp.value = ''; saveGoals(); renderGoals();
};
document.getElementById('goalInput').addEventListener('keydown', e => { if (e.key === 'Enter') document.getElementById('goalAddBtn').click(); });

// ═══════════════════════════════════════
// 📋 주간 리뷰
// ═══════════════════════════════════════
function openReview() {
  const mon = getMonday(new Date());
  let done = 0, undone = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(mon); d.setDate(d.getDate() + i);
    const dk = dateKey(d);
    (tasks[dk] || []).forEach(t => {
      if (!t || (t.repeat && t.repeat !== 'none')) return;
      if (t.checked) done++; else undone.push({dk, t, d});
    });
  }
  const total = done + undone.length;
  const pct = total ? Math.round(done / total * 100) : 0;
  const body = document.getElementById('reviewBody');
  body.innerHTML = `
    <div style="text-align:center;margin-bottom:14px">
      <div style="font-size:30px;font-weight:800;color:var(--primary)">${pct}%</div>
      <div style="font-size:12px;color:var(--text3)">이번 주 완료 ${done} / ${total}건</div>
      <div style="height:8px;background:var(--border);border-radius:4px;overflow:hidden;margin-top:8px">
        <div style="height:100%;width:${pct}%;background:var(--green)"></div></div>
    </div>`;
  const ul = el('div', '', {style: 'max-height:38vh;overflow-y:auto'});
  if (!undone.length) ul.appendChild(el('div', 'day-empty-text', {textContent: '🎉 미완료 항목이 없어요!', style: 'text-align:center;padding:14px;color:var(--green)'}));
  undone.forEach(({t, d}) => {
    const r = el('div', 'review-row');
    r.appendChild(el('span', '', {textContent: `${d.getMonth()+1}/${d.getDate()}`, style: 'font-size:11px;color:var(--text3);min-width:38px'}));
    r.appendChild(el('span', '', {textContent: t.text, style: 'flex:1;font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap'}));
    ul.appendChild(r);
  });
  body.appendChild(ul);
  document.getElementById('reviewModal').dataset.undoneCount = undone.length;
  document.getElementById('reviewModal').classList.remove('hidden');
}
function carryReviewToNextWeek() {
  const mon = getMonday(new Date());
  let moved = 0;
  for (let i = 0; i < 7; i++) {
    const d = new Date(mon); d.setDate(d.getDate() + i);
    const dk = dateKey(d);
    const list = tasks[dk] || [];
    for (let j = list.length - 1; j >= 0; j--) {
      const t = list[j];
      if (!t || t.checked || (t.repeat && t.repeat !== 'none')) continue;
      const nd = new Date(d); nd.setDate(nd.getDate() + 7);
      const ndk = dateKey(nd);
      list.splice(j, 1);
      if (!tasks[ndk]) tasks[ndk] = [];
      tasks[ndk].push(t); moved++;
    }
    if (tasks[dk] && !tasks[dk].length) delete tasks[dk];
  }
  saveTasks(); render();
  document.getElementById('reviewModal').classList.add('hidden');
  showUndoToast(`📋 미완료 ${moved}개를 다음 주로 이월했어요`);
}
document.getElementById('reviewBtn').onclick = () => { document.getElementById('moreMenu').classList.add('hidden'); openReview(); };
document.getElementById('reviewClose').onclick = () => document.getElementById('reviewModal').classList.add('hidden');
document.getElementById('reviewCarry').onclick = carryReviewToNextWeek;
document.getElementById('reviewModal').onclick = e => { if (e.target === document.getElementById('reviewModal')) document.getElementById('reviewModal').classList.add('hidden'); };

// ═══════════════════════════════════════
// ⚡ 빠른 추가 (자연어)
// ═══════════════════════════════════════
function openQuickAdd() {
  if (READ_ONLY) return;
  document.getElementById('quickInput').value = '';
  document.getElementById('quickPreview').textContent = '';
  document.getElementById('quickModal').classList.remove('hidden');
  setTimeout(() => document.getElementById('quickInput').focus(), 60);
}
function quickParse(raw) {
  let v = raw.trim(), dk = todayKey(), time = null;
  const pd = parseQuickDate(v); if (pd && pd.text) { v = pd.text; dk = dateKey(pd.date); }
  const pt = parseQuickTime(v); if (pt && pt.text) { v = pt.text; time = pt.time; }
  return { text: v, dk, time };
}
document.getElementById('quickInput').addEventListener('input', e => {
  const raw = e.target.value.trim();
  if (!raw) { document.getElementById('quickPreview').textContent = ''; return; }
  const p = quickParse(raw);
  const d = parseDk(p.dk);
  document.getElementById('quickPreview').textContent =
    `📅 ${d.getMonth()+1}/${d.getDate()}(${DAY_NAMES[dateToDayIdx(d)]})${p.time ? ' · 🕐 ' + p.time : ''} · ${p.text || '(내용 없음)'}`;
});
function quickSubmit() {
  const raw = document.getElementById('quickInput').value.trim();
  if (!raw) return;
  const p = quickParse(raw);
  if (!p.text) return;
  addTask(p.dk, p.text, null, false, 'none', null, null, p.time);
  document.getElementById('quickModal').classList.add('hidden');
  const d = parseDk(p.dk);
  showUndoToast(`⚡ ${d.getMonth()+1}/${d.getDate()}에 "${p.text}" 추가`);
}
document.getElementById('quickAdd').onclick = quickSubmit;
document.getElementById('quickCancel').onclick = () => document.getElementById('quickModal').classList.add('hidden');
document.getElementById('quickInput').addEventListener('keydown', e => { if (e.key === 'Enter') quickSubmit(); if (e.key === 'Escape') document.getElementById('quickModal').classList.add('hidden'); });
document.getElementById('quickModal').onclick = e => { if (e.target === document.getElementById('quickModal')) document.getElementById('quickModal').classList.add('hidden'); };
document.getElementById('fabAdd').onclick = openQuickAdd;

// ═══════════════════════════════════════
// 🖨 인쇄 / 이미지 저장
// ═══════════════════════════════════════
document.getElementById('printBtn').onclick = () => {
  document.getElementById('moreMenu').classList.add('hidden');
  window.print();
};

// ═══════════════════════════════════════
// 📥 외부 캘린더 구독 (ICS) — 읽기 전용 오버레이
// ═══════════════════════════════════════
const ICS_KEY = USER_ID ? `calIcs_${USER_ID}` : 'calIcs';
let icsSubs = (() => { try { return JSON.parse(localStorage.getItem(ICS_KEY) || '[]') || []; } catch { return []; } })();
let icsEvents = {};   // dk → [{title, time, src}]
function saveIcsSubs() { localStorage.setItem(ICS_KEY, JSON.stringify(icsSubs)); }
function parseICS(text, srcName) {
  // VEVENT의 DTSTART/SUMMARY 추출 (단순 파서: 종일/시간 모두)
  const out = [];
  const unfold = text.replace(/\r\n[ \t]/g, '').split(/\r?\n/);
  let cur = null;
  unfold.forEach(line => {
    if (line === 'BEGIN:VEVENT') cur = {};
    else if (line === 'END:VEVENT') { if (cur && cur.dk) out.push(cur); cur = null; }
    else if (cur) {
      let m;
      if ((m = line.match(/^DTSTART[^:]*:(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2}))?/))) {
        cur.dk = `${m[1]}-${m[2]}-${m[3]}`;
        cur.time = m[4] ? `${m[4]}:${m[5]}` : null;
      } else if ((m = line.match(/^SUMMARY[^:]*:(.+)/))) {
        cur.title = m[1].replace(/\\,/g, ',').replace(/\\n/gi, ' ').trim();
      }
    }
  });
  return out.map(e => ({ dk: e.dk, time: e.time, title: e.title || '(제목 없음)', src: srcName }));
}
function rebuildIcsEvents() {
  icsEvents = {};
  icsSubs.forEach(sub => {
    if (!sub.on || !Array.isArray(sub.events)) return;
    sub.events.forEach(ev => {
      if (!icsEvents[ev.dk]) icsEvents[ev.dk] = [];
      icsEvents[ev.dk].push({ title: ev.title, time: ev.time, color: sub.color, src: sub.name });
    });
  });
}
function icsEventsFor(dk) { return icsEvents[dk] || []; }
async function fetchIcsUrl(url) {
  const tries = [
    url,
    `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
    `https://corsproxy.io/?url=${encodeURIComponent(url)}`,
    `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`,
  ];
  for (const u of tries) {
    try {
      const r = await fetch(u);
      if (!r.ok) continue;
      const txt = await r.text();
      if (txt.includes('BEGIN:VCALENDAR')) return txt;
    } catch {}
  }
  return null;
}
const ICS_COLORS = ['#00897b','#3949ab','#d81b60','#6d4c41','#546e7a'];
function openIcsModal() { renderIcsList(); document.getElementById('icsModal').classList.remove('hidden'); }
function renderIcsList() {
  const box = document.getElementById('icsList');
  box.innerHTML = '';
  if (!icsSubs.length) { box.appendChild(el('div','day-empty-text',{textContent:'구독한 캘린더가 없어요',style:'text-align:center;padding:10px;color:var(--text3);font-size:12px'})); return; }
  icsSubs.forEach((sub, i) => {
    const row = el('div','share-row');
    const dot = el('span','share-color-dot'); dot.style.background = sub.color; dot.style.cursor='default'; row.appendChild(dot);
    const info = el('div',{},{}); info.style.flex='1'; info.style.minWidth='0';
    info.appendChild(el('div','share-name',{textContent:sub.name}));
    info.appendChild(el('div','goal-meta',{textContent:`${(sub.events||[]).length}개 일정`}));
    row.appendChild(info);
    const toggle = el('button',`share-toggle${sub.on?' on':''}`,{textContent:sub.on?'👁 보는 중':'🚫 숨김'});
    toggle.onclick=()=>{ sub.on=!sub.on; saveIcsSubs(); rebuildIcsEvents(); renderIcsList(); render(); };
    row.appendChild(toggle);
    if (sub.url) {
      const refresh = el('button','task-act-btn',{textContent:'🔄',title:'새로고침'});
      refresh.onclick=async()=>{ refresh.textContent='⏳'; const txt=await fetchIcsUrl(sub.url); if(txt){sub.events=parseICS(txt,sub.name);saveIcsSubs();rebuildIcsEvents();render();showUndoToast('🔄 캘린더를 새로고침했어요');} else showUndoToast('⚠️ 불러오기 실패'); renderIcsList(); };
      row.appendChild(refresh);
    }
    const del = el('button','task-act-btn del',{textContent:'✕',title:'구독 취소'});
    del.onclick=()=>{ icsSubs.splice(i,1); saveIcsSubs(); rebuildIcsEvents(); renderIcsList(); render(); };
    row.appendChild(del);
    box.appendChild(row);
  });
}
document.getElementById('icsImportBtn').onclick = () => { document.getElementById('moreMenu').classList.add('hidden'); openIcsModal(); };
document.getElementById('icsClose').onclick = () => document.getElementById('icsModal').classList.add('hidden');
document.getElementById('icsModal').onclick = e => { if (e.target === document.getElementById('icsModal')) document.getElementById('icsModal').classList.add('hidden'); };
document.getElementById('icsUrlAdd').onclick = async () => {
  const inp = document.getElementById('icsUrlInput');
  const url = inp.value.trim(); if (!url) { inp.focus(); return; }
  const btn = document.getElementById('icsUrlAdd'); btn.textContent='⏳';
  const txt = await fetchIcsUrl(url.replace(/^webcal:/i,'https:'));
  btn.textContent='구독';
  if (!txt) { showUndoToast('⚠️ 불러올 수 없어요 (URL·공개여부 확인)'); return; }
  const name = (url.match(/([^\/]+)\.ics/)||[])[1] || ('캘린더 '+(icsSubs.length+1));
  icsSubs.push({ name, url: url.replace(/^webcal:/i,'https:'), color: ICS_COLORS[icsSubs.length%ICS_COLORS.length], on:true, events: parseICS(txt,name) });
  inp.value=''; saveIcsSubs(); rebuildIcsEvents(); renderIcsList(); render();
  showUndoToast(`📥 ${name} 구독 완료`);
};
document.getElementById('icsFileBtn').onclick = () => document.getElementById('icsFileInput').click();
document.getElementById('icsFileInput').addEventListener('change', e => {
  const f = e.target.files[0]; if (!f) return;
  const rd = new FileReader();
  rd.onload = () => {
    const name = f.name.replace(/\.ics$/i,'');
    icsSubs.push({ name, url:null, color: ICS_COLORS[icsSubs.length%ICS_COLORS.length], on:true, events: parseICS(rd.result, name) });
    saveIcsSubs(); rebuildIcsEvents(); renderIcsList(); render();
    showUndoToast(`📥 ${name} 추가 완료`);
  };
  rd.readAsText(f);
  e.target.value='';
});

// ═══════════════════════════════════════
// 🤝 팀 캘린더 — ?team=ID 공동 편집 (URL만 알면 함께 편집)
// ═══════════════════════════════════════
document.getElementById('teamBtn').onclick = () => {
  document.getElementById('moreMenu').classList.add('hidden');
  if (IS_TEAM) { gotoPersonal(); return; }
  openTeamPicker();
};

// ═══ 팀 등록부 · 구독 · 빠른 전환 (Phase 1) ═══
function myPersonalId(){ return IS_TEAM ? (localStorage.getItem('lastUser')||'') : (USER_ID||''); }
function deviceId(){ let d=localStorage.getItem('calDeviceId'); if(!d){ d='dev-'+Math.random().toString(36).slice(2,10); localStorage.setItem('calDeviceId',d); } return d; }
const TEAM_SUBS_KEY = `calTeamSubs_${myPersonalId()||deviceId()}`;
let teamSubs = (()=>{ try{ return JSON.parse(localStorage.getItem(TEAM_SUBS_KEY)||'{}')||{}; }catch{ return {}; } })();
// 내가 들어가거나 만든 팀을 로컬에도 기억 → 피커에 항상 표시(원격 teamDirectory 규칙과 무관)
const MY_TEAMS_KEY = `calMyTeams_${myPersonalId()||deviceId()}`;
let myTeams = (()=>{ try{ return JSON.parse(localStorage.getItem(MY_TEAMS_KEY)||'{}')||{}; }catch{ return {}; } })();
function saveMyTeams(){
  try{ localStorage.setItem(MY_TEAMS_KEY, JSON.stringify(myTeams)); }catch(e){}
  const me=sanitizeId(myPersonalId());
  if(fbDb && me && me!=='demo') fbDb.ref(`users/${me}/myTeams`).set(Object.keys(myTeams).length?myTeams:null).catch(()=>{});
}
function rememberTeam(id, name){ const s=sanitizeId(id); if(!s) return; myTeams[s]={name:name||s, ts:Date.now()}; saveMyTeams(); }
function forgetTeam(id){ const s=sanitizeId(id); if(myTeams[s]){ delete myTeams[s]; saveMyTeams(); } }
// 시작 시 내 팀 구독/목록을 Firebase(users/{me})에서 복원·병합 — 기기/세션/컨텍스트 무관하게 유지
function loadTeamDataFromFb(){
  const me=sanitizeId(myPersonalId());
  if(!fbDb || !me || me==='demo') return;
  fbDb.ref(`users/${me}/teamSubs`).once('value').then(snap=>{
    const v=snap.val();
    if(v && typeof v==='object'){
      // 원격 스냅샷 기준으로 양방향 동기화 — 추가만 병합하면 다른 기기·팀 페이지에서 한
      // 구독취소가 영영 반영되지 않고, 미러 복사본이 고아로 남아 계속 갱신/삭제가 안 됨
      Object.keys(teamSubs).forEach(id=>{
        if(!v[id]){
          delete teamSubs[id];
          if(!IS_TEAM){ detachTeamListener(id); removeCopiedTeamTasks(id); }
        }
      });
      Object.keys(v).forEach(id=>{ if(!teamSubs[id]) teamSubs[id]=v[id]; });
      localStorage.setItem(TEAM_SUBS_KEY, JSON.stringify(teamSubs));
      if(!IS_TEAM) syncSubscribedTeams();
    }
  }).catch(()=>{});
  fbDb.ref(`users/${me}/myTeams`).once('value').then(snap=>{
    const v=snap.val(); if(v && typeof v==='object'){ Object.keys(v).forEach(id=>{ if(!myTeams[id]) myTeams[id]=v[id]; }); localStorage.setItem(MY_TEAMS_KEY, JSON.stringify(myTeams)); }
  }).catch(()=>{});
}
const TEAM_COPIED_KEY = `calTeamCopied_${myPersonalId()||deviceId()}`;
let teamCopied = (()=>{ try{ return JSON.parse(localStorage.getItem(TEAM_COPIED_KEY)||'{}')||{}; }catch{ return {}; } })();
function saveTeamCopied(){ localStorage.setItem(TEAM_COPIED_KEY, JSON.stringify(teamCopied)); }
// 구독한 팀들의 일정을 내 캘린더로 복사(독립) — 이미 복사한 건 dedup, 삭제해도 재복사 안 함
let teamSubListeners = {};
// 팀 스냅샷을 내 캘린더에 미러: 신규 복사 / 기존 콘텐츠 갱신 / 팀 삭제분 제거.
// 로컬 상태(완료체크·메모·하위·댓글)는 보존, 로컬에서 지운 복사본은 재추가 안 함.
function applyTeamSnapshot(id, data){
  if(IS_TEAM || READ_ONLY) return;
  data = data || {};
  let changed=false;
  const copies={}; // teamRef -> {dk, task}
  Object.keys(tasks).forEach(dk=>{ (tasks[dk]||[]).forEach(t=>{ if(t&&t.fromTeam===id&&t.teamRef) copies[t.teamRef]={dk,task:t}; }); });
  const teamRefs=new Set();
  const MIRROR=['text','color','repeat','repeatEnd','priority','time','duration']; // starred·완료·메모는 로컬 유지
  Object.entries(data).forEach(([oDk,list])=>{
    const arr=Array.isArray(list)?list:Object.values(list||{});
    arr.forEach(t=>{
      if(!t||!t.id) return;
      const ref=`${id}|${oDk}|${t.id}`; teamRefs.add(ref);
      const ex=copies[ref];
      if(ex){ // 기존: 내가 등록한 원본(selfRegistered)은 손대지 않고, 순수 미러만 콘텐츠 갱신
        const c=ex.task;
        if(!c.selfRegistered){
          MIRROR.forEach(f=>{ const nv=(t[f]!==undefined?t[f]:null), cv=(c[f]!==undefined?c[f]:null); if(cv!==nv){ c[f]=(t[f]!==undefined?t[f]:null); changed=true; } });
          // 팀에서 '이 날짜만 삭제'(skips)한 회차는 미러에도 반영 — 단, 내가 로컬에서
          // 지운 회차는 보존해야 하므로 합집합으로 병합 (객체라 MIRROR 루프론 비교 불가)
          const merged=Object.assign({}, c.skips||{}, t.skips||{});
          if(JSON.stringify(merged)!==JSON.stringify(c.skips||{})){ c.skips=merged; changed=true; }
        }
      } else if(!teamCopied[ref]){ // 신규(한 번도 복사 안 한 것만)
        teamCopied[ref]=Date.now();
        const copy=Object.assign({}, t, {
          id:uid(), fromTeam:id, teamRef:ref, by:t.by||id,
          subs:(Array.isArray(t.subs)?t.subs:Object.values(t.subs||{})).filter(Boolean),
          completions:t.completions||{}, skips:t.skips||{},
          memo:'', memoImages:[], memoHistory:[], comments:[]
        });
        (tasks[oDk]=tasks[oDk]||[]).push(copy);
        changed=true;
      }
    });
  });
  // 팀에서 사라진 항목: 순수 미러는 제거, 내가 등록한 원본(selfRegistered)은 태그만 떼고 보존
  Object.keys(copies).forEach(ref=>{
    if(!teamRefs.has(ref)){
      const {dk,task:c}=copies[ref];
      if(c.selfRegistered){ delete c.fromTeam; delete c.teamRef; delete c.selfRegistered; }
      else { tasks[dk]=(tasks[dk]||[]).filter(t=>!(t&&t.teamRef===ref)); if(!tasks[dk].length) delete tasks[dk]; }
      delete teamCopied[ref]; changed=true;
    }
  });
  // 로컬삭제+팀삭제로 고아가 된 dedup 정리
  Object.keys(teamCopied).forEach(ref=>{ if(ref.indexOf(id+'|')===0 && !teamRefs.has(ref) && !copies[ref]) delete teamCopied[ref]; });
  if(changed){ saveTeamCopied(); saveTasks(); render(); }
}
function attachTeamListener(id){
  if(IS_TEAM || READ_ONLY || !fbDb) return;
  if(teamSubListeners[id]) return;
  const ref=fbDb.ref(`users/team-${sanitizeId(id)}/tasks`);
  const cb=ref.on('value', snap=>{ try{ applyTeamSnapshot(id, snap.val()); }catch(e){} });
  teamSubListeners[id]={ref, cb};
}
function detachTeamListener(id){
  const L=teamSubListeners[id]; if(L){ try{ L.ref.off('value', L.cb); }catch(e){} delete teamSubListeners[id]; }
}
// 구독한 팀들에 실시간 리스너 부착(신규/수정/삭제 자동 반영)
function syncSubscribedTeams(){
  if(IS_TEAM || READ_ONLY || !fbDb) return;
  Object.keys(teamSubs).forEach(attachTeamListener);
}
// 구독 취소: 순수 미러는 제거, 내가 등록한 원본(selfRegistered)은 태그만 떼고 보존
function removeCopiedTeamTasks(id){
  let changed=false;
  Object.keys(tasks).forEach(dk=>{
    const list=tasks[dk]; if(!Array.isArray(list))return;
    list.forEach(t=>{ if(t&&t.fromTeam===id&&t.selfRegistered){ delete t.fromTeam; delete t.teamRef; delete t.selfRegistered; changed=true; } });
    const next=list.filter(t=>!(t&&t.fromTeam===id)); // 남은 fromTeam=순수 미러만 제거
    if(next.length!==list.length){ if(next.length) tasks[dk]=next; else delete tasks[dk]; changed=true; }
  });
  Object.keys(teamCopied).forEach(ref=>{ if(ref.indexOf(id+'|')===0) delete teamCopied[ref]; });
  saveTeamCopied();
  if(changed){ saveTasks(); render(); }
}
function saveTeamSubs(){
  localStorage.setItem(TEAM_SUBS_KEY, JSON.stringify(teamSubs));
  const me = sanitizeId(myPersonalId());
  if (fbDb && me && me!=='demo') fbDb.ref(`users/${me}/teamSubs`).set(Object.keys(teamSubs).length?teamSubs:null).catch(()=>{});
}
function registerTeamDirectory(id, name){ if (fbDb && id) fbDb.ref('teamDirectory/'+sanitizeId(id)).update({ name:name||id, ts:Date.now() }).catch(()=>{}); }
function fetchTeamDirectory(cb){
  if (!fbDb){ cb([]); return; }
  fbDb.ref('teamDirectory').once('value').then(snap=>{
    const v=snap.val()||{};
    cb(Object.keys(v).map(id=>({id, name:(v[id]&&v[id].name)||id})).sort((a,b)=>String(a.name).localeCompare(String(b.name))));
  }).catch(()=>cb([]));
}
function enterTeam(id, name){ const s=sanitizeId(id); if(!s) return; rememberTeam(s, name||id); window.location.href = window.location.pathname + `?team=${encodeURIComponent(s)}`; }
function gotoPersonal(){ const last=localStorage.getItem('lastUser'); window.location.href = window.location.pathname + (last?`?u=${encodeURIComponent(last)}`:''); }
function toggleTeamSub(id, name){
  const nowOn = !teamSubs[id];
  if (teamSubs[id]) delete teamSubs[id]; else teamSubs[id]={name:name||id, ts:Date.now()};
  saveTeamSubs();
  if (nowOn) { if(!IS_TEAM) attachTeamListener(id); }     // 구독 → 실시간 리스너(즉시 복사)
  else { if(!IS_TEAM){ detachTeamListener(id); removeCopiedTeamTasks(id); } } // 구독취소 → 리스너 해제 + 정리
  return !!teamSubs[id];
}
// 팀 선택(등록용) — 구독 팀 목록 + 직접 입력
function pickTeamForRegister(cb){
  const subs=Object.keys(teamSubs).map(id=>({id, name:(teamSubs[id].name||id)}));
  const ov=el('div','modal-overlay'); const box=el('div','modal-box'); box.style.maxWidth='320px';
  box.appendChild(el('div','modal-title',{textContent:'🤝 어느 팀에 등록할까요?'}));
  const list=el('div',null); list.style.cssText='display:flex;flex-direction:column;gap:6px;margin:8px 0;max-height:40vh;overflow-y:auto';
  if(!subs.length) list.appendChild(el('div','',{textContent:'구독한 팀이 없어요. 아래에 팀 이름을 입력하세요.',style:'font-size:12px;color:var(--text3)'}));
  subs.forEach(t=>{ const b=el('button','team-pick-name',{type:'button',textContent:'🤝 '+t.name}); b.onclick=()=>{ ov.remove(); cb(t.id); }; list.appendChild(b); });
  box.appendChild(list);
  const inRow=el('div','modal-row'); inRow.style.gap='6px';
  const inp=el('input','modal-input',{type:'text',placeholder:'팀 이름 직접 입력'}); inp.style.cssText='flex:1;margin-bottom:0';
  const go=el('button','btn-primary',{type:'button',textContent:'등록'}); go.onclick=()=>{ if(inp.value.trim()){ ov.remove(); cb(inp.value.trim()); } };
  inp.addEventListener('keydown',e=>{ if(e.key==='Enter'&&inp.value.trim()){ ov.remove(); cb(inp.value.trim()); } });
  inRow.appendChild(inp); inRow.appendChild(go); box.appendChild(inRow);
  const c=el('button','btn-secondary',{type:'button',textContent:'취소'}); c.style.cssText='margin-top:8px;width:100%'; c.onclick=()=>ov.remove(); box.appendChild(c);
  ov.appendChild(box); document.body.appendChild(ov); ov.onclick=e=>{ if(e.target===ov)ov.remove(); };
}
// 내 태스크를 팀 캘린더에 등록(복사) — 반복 유지, 작성자 이름 태그
function registerTaskToTeam(dk, task, isRepeatInst, originDk){
  if(IS_TEAM){ showUndoToast('개인 캘린더에서만 사용할 수 있어요'); return; }
  if(!fbDb){ showUndoToast('⚠️ 오프라인 상태예요'); return; }
  const srcDk=isRepeatInst?originDk:dk;
  const t=(tasks[srcDk]||[]).find(x=>x.id===task.id) || task;
  pickTeamForRegister(teamId=>{
    const tid=sanitizeId(teamId); if(!tid) return;
    const by=myPersonalId() || (localStorage.getItem('lastUser')||'나');
    const copyId=uid();
    const copy={
      id: copyId, text: t.text, color: t.color||null, starred: !!t.starred,
      repeat: t.repeat||'none', repeatEnd: t.repeatEnd||null, priority: t.priority||null,
      time: t.time||null, duration: t.duration||null, checked:false,
      completions:{}, skips:{},
      subs:(Array.isArray(t.subs)?t.subs:[]).map(s=>({id:uid(),text:s.text,checked:false,starred:false,color:null,subs:[]})),
      by, memo:'', memoImages:[], memoHistory:[], comments:[]
    };
    registerTeamDirectory(tid, teamId); rememberTeam(tid, teamId);
    const ref=fbDb.ref(`users/team-${tid}/tasks/${srcDk}`);
    // transaction: 두 멤버가 같은 날짜에 동시에 등록해도 서로의 항목을 덮어쓰지 않음
    ref.transaction(v=>{
      const arr=Array.isArray(v)?v.filter(Boolean):(v?Object.values(v):[]);
      arr.push(fbClean(copy));
      return arr;
    })
      .then(()=>{
        const refKey=`${tid}|${srcDk}|${copyId}`;
        // 별도 복사본을 만들지 않고 '원본 태스크'에 팀 등록 태그만 부착(중복 방지)
        const orig=(tasks[srcDk]||[]).find(x=>x.id===task.id);
        if(orig){ orig.fromTeam=tid; orig.teamRef=refKey; orig.selfRegistered=true; }
        teamCopied[refKey]=Date.now(); saveTeamCopied();
        // 자동 구독하지 않음 — 등록만으로 팀 전체 일정이 내 캘린더로 흘러오지 않게.
        // (팀 전체를 함께 보려면 팀 캘린더 메뉴에서 직접 '구독')
        saveTasks(srcDk); render();
        showUndoToast(`🤝 '${teamId}' 팀에 등록했어요${(t.repeat&&t.repeat!=='none')?' (반복 포함)':''}`);
      })
      .catch(()=>showUndoToast('⚠️ 팀 등록 실패'));
  });
}
function openTeamPicker(){
  const old=document.getElementById('teamPickerOv'); if(old) old.remove();
  const ov=el('div','modal-overlay'); ov.id='teamPickerOv';
  const box=el('div','modal-box'); box.style.maxWidth='340px';
  box.appendChild(el('div','modal-title',{textContent:'🤝 팀 캘린더'}));
  box.appendChild(el('div','',{textContent:'팀 이름을 눌러 들어가거나, 구독하면 내 캘린더에서 그 팀 일정을 함께 봐요.',style:'font-size:11px;color:var(--text3);margin-bottom:8px'}));
  const loading=el('div','',{textContent:'불러오는 중…',style:'font-size:12px;color:var(--text3)'});
  const listWrap=el('div',null); listWrap.style.cssText='max-height:42vh;overflow-y:auto;display:flex;flex-direction:column;gap:6px;margin-bottom:10px';
  box.appendChild(loading); box.appendChild(listWrap);
  const inRow=el('div','modal-row'); inRow.style.gap='6px';
  const inp=el('input','modal-input',{type:'text',placeholder:'새 팀 이름'}); inp.style.cssText='flex:1;margin-bottom:0';
  const goBtn=el('button','btn-primary',{type:'button',textContent:'들어가기'});
  goBtn.onclick=()=>{ if(inp.value.trim()) enterTeam(inp.value.trim(), inp.value.trim()); };
  inp.addEventListener('keydown',e=>{ if(e.key==='Enter'&&inp.value.trim()) enterTeam(inp.value.trim(), inp.value.trim()); });
  inRow.appendChild(inp); inRow.appendChild(goBtn); box.appendChild(inRow);
  const closeBtn=el('button','btn-secondary',{type:'button',textContent:'닫기',style:'margin-top:8px;width:100%'});
  closeBtn.onclick=()=>ov.remove(); box.appendChild(closeBtn);
  ov.appendChild(box); document.body.appendChild(ov);
  ov.onclick=e=>{ if(e.target===ov) ov.remove(); };
  // 로컬(내가 들어간/만든 팀) + 구독 팀 + 원격 등록부를 합쳐 표시
  const renderList=(remote)=>{
    const map={};
    Object.keys(myTeams).forEach(id=>{ map[id]={id, name:myTeams[id].name||id}; });
    Object.keys(teamSubs).forEach(id=>{ if(!map[id]) map[id]={id, name:teamSubs[id].name||id}; });
    (remote||[]).forEach(t=>{ if(!map[t.id]) map[t.id]={id:t.id, name:t.name}; });
    const list=Object.values(map).sort((a,b)=>String(a.name).localeCompare(String(b.name)));
    listWrap.innerHTML='';
    if(!list.length){ listWrap.appendChild(el('div','',{textContent:'아직 등록된 팀이 없어요. 아래에서 새로 만들어 보세요.',style:'font-size:12px;color:var(--text3)'})); return; }
    list.forEach(t=>{
      const row=el('div','team-pick-row');
      const nm=el('button','team-pick-name',{type:'button',textContent:'🤝 '+t.name}); nm.onclick=()=>enterTeam(t.id, t.name);
      const subBtn=el('button',`team-pick-sub${teamSubs[t.id]?' on':''}`,{type:'button',textContent:teamSubs[t.id]?'구독중 ✓':'구독'});
      subBtn.onclick=()=>{ const on=toggleTeamSub(t.id,t.name); subBtn.textContent=on?'구독중 ✓':'구독'; subBtn.classList.toggle('on',on); };
      const delBtn=el('button','team-pick-del',{type:'button',textContent:'✕',title:'목록에서 제거'});
      delBtn.onclick=()=>{ forgetTeam(t.id); renderList(remote); };
      row.appendChild(nm); row.appendChild(subBtn); row.appendChild(delBtn); listWrap.appendChild(row);
    });
  };
  loading.remove();
  renderList([]);                          // 로컬 즉시 표시
  fetchTeamDirectory(remote=>renderList(remote)); // 원격 도착 시 병합
}
// 상단 캘린더 이름 클릭 → 빠른 전환 드롭다운
(function initCalSwitch(){
  const chip=document.getElementById('userChip'); if(!chip) return;
  chip.style.cursor='pointer'; chip.title='캘린더 전환';
  chip.addEventListener('click', e=>{
    e.stopPropagation();
    const ex=document.getElementById('calSwitchDD'); if(ex){ ex.remove(); return; }
    const dd=el('div','cal-switch-dd'); dd.id='calSwitchDD';
    const items=[];
    if(IS_TEAM){
      const last=localStorage.getItem('lastUser');
      if(last) items.push({label:'👤 '+last+' (내 캘린더)', fn:gotoPersonal});
    } else {
      const seen={};
      Object.keys(myTeams).forEach(id=>{ seen[id]=1; items.push({label:'🤝 '+(myTeams[id].name||id), fn:()=>enterTeam(id, myTeams[id].name)}); });
      Object.keys(teamSubs).forEach(id=>{ if(!seen[id]) items.push({label:'🤝 '+(teamSubs[id].name||id), fn:()=>enterTeam(id, teamSubs[id].name)}); });
    }
    items.push({label:'＋ 팀 캘린더 관리', fn:openTeamPicker});
    if(!items.length) return;
    items.forEach(it=>{ const b=el('button','cal-switch-item',{type:'button',textContent:it.label}); b.onclick=()=>{ dd.remove(); it.fn(); }; dd.appendChild(b); });
    const r=chip.getBoundingClientRect();
    dd.style.left=Math.max(8,r.left)+'px'; dd.style.top=(r.bottom+6)+'px';
    document.body.appendChild(dd);
    setTimeout(()=>document.addEventListener('click',function h(){ const d=document.getElementById('calSwitchDD'); if(d)d.remove(); document.removeEventListener('click',h); }),0);
  });
})();
// 팀 화면이면: 등록부 등록 + 더보기에 구독 토글 추가
if (IS_TEAM) {
  const _tid = sanitizeId(_rawTeam);
  registerTeamDirectory(_tid, _rawTeam);
  rememberTeam(_tid, _rawTeam);
  const tb=document.getElementById('teamBtn');
  if (tb && tb.parentNode) {
    const subItem=document.createElement('button'); subItem.className='more-menu-item'; subItem.id='teamSubBtn';
    const refresh=()=>{ subItem.innerHTML = teamSubs[_tid] ? '🔕 <span>이 팀 구독취소</span>' : '🔔 <span>이 팀 구독</span>'; };
    refresh();
    subItem.onclick=()=>{ const on=toggleTeamSub(_tid,_rawTeam); refresh(); showUndoToast(on?'구독했어요 — 내 캘린더에서 이 팀 일정을 함께 봐요(곧 적용)':'구독을 취소했어요'); };
    tb.parentNode.insertBefore(subItem, tb);
    tb.innerHTML = '↩ <span>내 캘린더로</span>';
  }
}

// ═══════════════════════════════════════
// 💬 일정 댓글 + ✅ 수락/거절(받은 일정)
// ═══════════════════════════════════════
let commentCtx = null;
function openComments(dk, taskId, isRepeatInst, originDk) {
  const tdk = isRepeatInst ? originDk : dk;
  const t = (tasks[tdk]||[]).find(x => x.id === taskId);
  if (!t) return;
  commentCtx = { dk: tdk, taskId };
  document.getElementById('commentTaskTitle').textContent = t.text;
  renderComments();
  document.getElementById('commentModal').classList.remove('hidden');
  setTimeout(()=>document.getElementById('commentInput').focus(), 60);
}
function renderComments() {
  if (!commentCtx) return;
  const t = (tasks[commentCtx.dk]||[]).find(x => x.id === commentCtx.taskId);
  const box = document.getElementById('commentList');
  box.innerHTML = '';
  const cs = (t && t.comments) || [];
  if (!cs.length) box.appendChild(el('div','day-empty-text',{textContent:'아직 댓글이 없어요',style:'text-align:center;padding:12px;color:var(--text3);font-size:12px'}));
  cs.forEach((c, i) => {
    const row = el('div','comment-row');
    const head = el('div','comment-head');
    head.appendChild(el('span','comment-author',{textContent:'👤 '+(c.by||'익명')}));
    const d = new Date(c.ts);
    head.appendChild(el('span','comment-time',{textContent:`${d.getMonth()+1}/${d.getDate()} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`}));
    if (!READ_ONLY) {
      const del = el('button','comment-del',{type:'button',textContent:'✕',title:'댓글 삭제'});
      del.onclick = () => deleteComment(i);
      head.appendChild(del);
    }
    row.appendChild(head);
    row.appendChild(el('div','comment-text',{textContent:c.text}));
    box.appendChild(row);
  });
}
function deleteComment(i) {
  if (!commentCtx || READ_ONLY) return;
  const t = (tasks[commentCtx.dk]||[]).find(x => x.id === commentCtx.taskId);
  if (!t || !Array.isArray(t.comments) || !t.comments[i]) return;
  if (!confirm('이 댓글을 삭제할까요?')) return;
  t.comments.splice(i, 1);
  saveTasks(commentCtx.dk); renderComments(); render();
}
function addComment() {
  if (!commentCtx || READ_ONLY) return;
  const inp = document.getElementById('commentInput');
  const text = inp.value.trim(); if (!text) return;
  const t = (tasks[commentCtx.dk]||[]).find(x => x.id === commentCtx.taskId);
  if (!t) return;
  if (!Array.isArray(t.comments)) t.comments = [];
  t.comments.push({ by: IS_TEAM ? (localStorage.getItem('lastUser')||'멤버') : (USER_ID||'나'), text, ts: Date.now() });
  inp.value=''; saveTasks(commentCtx.dk); renderComments(); render();
}
document.getElementById('commentClose').onclick = () => document.getElementById('commentModal').classList.add('hidden');
document.getElementById('commentModal').onclick = e => { if (e.target === document.getElementById('commentModal')) document.getElementById('commentModal').classList.add('hidden'); };
document.getElementById('commentAdd').onclick = addComment;
document.getElementById('commentInput').addEventListener('keydown', e => { if (e.key === 'Enter') addComment(); });

// 받은 일정 수락/거절
function acceptTask(dk, taskId) {
  const t = (tasks[dk]||[]).find(x => x.id === taskId);
  if (t) { delete t.pending; saveTasks(dk); render(); showUndoToast('✅ 일정을 수락했어요'); }
}
function rejectTask(dk, taskId) {
  const list = tasks[dk]||[]; const idx = list.findIndex(x => x.id === taskId);
  if (idx<0) return;
  const [removed]=list.splice(idx,1);
  if(!list.length) delete tasks[dk];
  saveTasks(dk); render();
  showUndoToast('🚫 일정을 거절했어요', ()=>{ if(!tasks[dk])tasks[dk]=[]; tasks[dk].push(removed); saveTasks(dk); render(); });
}

// ── Keyboard shortcuts ──
document.addEventListener('keydown',e=>{
  // Escape는 입력/편집 중에도 동작(모달·메모·팝업 닫기)
  if(e.key==='Escape'){closeMemo();closeEdit();closeRepeatDel();closeNoteHist();closeCanvas();closeSlashMenu();closeLightbox();closeShareModal();
    ['quickModal','goalsModal','reviewModal','icsModal','commentModal'].forEach(id=>document.getElementById(id).classList.add('hidden'));
    document.getElementById('notesMenu').classList.add('hidden');activeInput=null;searchQuery='';document.getElementById('searchInput').value='';render();return;}
  // 입력창·텍스트영역·편집영역(메모/노트 등 contentEditable) 안에서는 전역 단축키 비활성
  const tgt=e.target;
  if(tgt && (tgt.tagName==='INPUT'||tgt.tagName==='TEXTAREA'||tgt.isContentEditable||(tgt.closest&&tgt.closest('[contenteditable=""],[contenteditable="true"]')))) return;
  if(e.metaKey||e.ctrlKey||e.altKey) return; // 조합키(복사/붙여넣기 등)는 단축키로 처리하지 않음
  if(e.key==='ArrowLeft'){document.getElementById('prevBtn').click();}
  if(e.key==='ArrowRight'){document.getElementById('nextBtn').click();}
  if(e.key==='t'||e.key==='T'){document.getElementById('todayBtn').click();}
  if(e.key==='/'){e.preventDefault();document.getElementById('searchInput').focus();}
  if(e.key==='d'||e.key==='D'){document.getElementById('darkBtn').click();}
  if(e.key==='f'||e.key==='F'){document.getElementById('btnFocus').click();}
  if(e.key==='n'||e.key==='N'){
    e.preventDefault();
    if(currentView!=='week') setView('week');
    weekStart=getMonday(new Date());
    activeInput={dateKey:dateKey(new Date()),parentId:null};
    render();
    return;
  }
});

// ── Init ──
purgeOldTrash();
render();
fetchWeather(weatherLoc.lat,weatherLoc.lon);
initFirebaseSync();
renderNoteWins();
initMemoSync();
initOffSync();
// (구독 팀 동기화는 initFirebaseSync에서 개인 트리 로드 후 호출됨)
initShareSync();
registerUserDirectory();
initGoalSync();
rebuildIcsEvents();
// 주기 백업 업로드는 '보낼 로컬 변경이 있을 때만' — 아무 변경 없는 기기가
// 5분마다 전체 트리를 덮어쓰면 다른 기기의 편집이 지워질 수 있음
setInterval(()=>{ if(fbRef() && (pendingUpload || pendingTasksLocal)) fbUpload(); }, 5*60*1000);
window.addEventListener('online', ()=>{
  setSyncStatus('syncing');
  if(pendingUpload && fbRef()){ pendingUpload=false; fbUpload(); }
  if(_pendingCollections.size){
    const retry=new Set(_pendingCollections);
    _pendingCollections.clear();
    if(retry.has('off')) saveOffDays();
    if(retry.has('memos')) saveMemos();
    if(retry.has('shares')) saveShares();
    if(retry.has('goals')) saveGoals();
  }
  if(typeof showUndoToast==='function') showUndoToast('다시 연결됐어요. 저장하는 중...');
});
window.addEventListener('offline', ()=>{
  setSyncStatus('offline');
  if(typeof showUndoToast==='function') showUndoToast('오프라인 상태예요. 로컬에 저장돼요.');
});

// ── PWA 서비스워커 등록 (오프라인 지원 + 홈 화면 설치 + 새 버전 자동 감지) ──
if ('serviceWorker' in navigator) {
  // 로드 시점에 이미 제어 중인 SW가 있었는지 — 최초 설치 때의 불필요한 새로고침 방지
  const _hadController = !!navigator.serviceWorker.controller;
  let _swReloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!_hadController || _swReloading) return;   // 최초 설치면 새로고침 안 함
    _swReloading = true;
    window.location.reload();
  });
  navigator.serviceWorker.register('./sw.js').then(reg => {
    // 30분마다 + 탭 복귀 시 업데이트 확인 (앱을 계속 열어두는 PWA 대비)
    setInterval(() => reg.update().catch(()=>{}), 30 * 60 * 1000);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) reg.update().catch(()=>{}); });
    const _watch = sw => { if (!sw) return; sw.addEventListener('statechange', () => {
      if (sw.state === 'installed' && navigator.serviceWorker.controller) showUpdateBanner();
    }); };
    if (reg.waiting && navigator.serviceWorker.controller) showUpdateBanner();
    reg.addEventListener('updatefound', () => _watch(reg.installing));
  }).catch(()=>{});
}
// 새 버전 안내 배너 (HTML/CSS 의존 없이 자체 주입 — 추가 위험 최소화)
function showUpdateBanner(){
  if (document.getElementById('updateBanner')) return;
  const bar = document.createElement('div');
  bar.id = 'updateBanner';
  bar.setAttribute('role', 'status');
  bar.setAttribute('aria-live', 'polite');
  bar.style.cssText = 'position:fixed;left:50%;bottom:20px;transform:translateX(-50%);z-index:9999;display:flex;align-items:center;gap:12px;background:var(--primary,#5b6cf0);color:#fff;padding:11px 16px;border-radius:14px;box-shadow:0 10px 28px rgba(0,0,0,.28);font-size:14px;font-weight:600;max-width:92vw;animation:none';
  const msg = document.createElement('span');
  msg.textContent = '🆕 새 버전이 있어요';
  const btn = document.createElement('button');
  btn.textContent = '새로고침';
  btn.style.cssText = 'background:#fff;color:var(--primary,#5b6cf0);border:none;border-radius:9px;padding:6px 14px;font-weight:700;cursor:pointer;font-family:inherit;font-size:13px';
  btn.onclick = () => {
    btn.disabled = true; btn.textContent = '적용 중…';
    navigator.serviceWorker.getRegistration().then(r => {
      if (r && r.waiting) r.waiting.postMessage('SKIP_WAITING');   // 대기 SW 즉시 활성화 → controllerchange가 새로고침
    }).catch(()=>{});
    setTimeout(() => window.location.reload(), 1500);              // 안전장치
  };
  bar.appendChild(msg); bar.appendChild(btn);
  document.body.appendChild(bar);
}

// ── Dashboard ──
function getImportantUpcoming(){
  const now = today();
  const items = [];
  Object.entries(tasks).forEach(([dk,list])=>{
    if(!Array.isArray(list)) return;
    const d = parseDk(dk); d.setHours(0,0,0,0);
    if(d < now) return;
    list.forEach(t=>{
      if(!t||t.checked) return;
      if(t.starred||t.priority==='high'){
        items.push({text:t.text, dk, dday:Math.round((d-now)/86400000), priority:t.priority, starred:t.starred});
      }
    });
  });
  return items.sort((a,b)=>a.dday-b.dday).slice(0,5);
}

function buildDashStats(){
  const panel = document.getElementById('dashStats');
  panel.innerHTML = '';
  const title = document.createElement('div'); title.className='dash-panel-title'; title.textContent='📊 이번 주 업무 현황';
  panel.appendChild(title);

  // stat boxes
  const now = new Date(); now.setHours(0,0,0,0);
  const monday = new Date(now); monday.setDate(now.getDate() - ((now.getDay()+6)%7));
  let weekTotal=0, weekDone=0, totalAll=0, doneAll=0;
  const dayTotals = [0,0,0,0,0,0,0];
  Object.entries(tasks).forEach(([dk, list])=>{
    if(!Array.isArray(list)) return;
    list.forEach(t=>{
      if(!t) return;
      totalAll++; if(t.checked) doneAll++;
      // 반복 태스크는 아래 루프에서 인스턴스로 집계하므로 주간 버킷에서 제외(이중집계 방지)
      if(t.repeat && t.repeat!=='none') return;
      const d = parseDk(dk); d.setHours(0,0,0,0);
      const diff = Math.round((d-monday)/86400000);
      if(diff>=0 && diff<7){ weekTotal++; if(t.checked) weekDone++; dayTotals[diff]+=1; }
    });
  });
  // 이번 주 반복 인스턴스 포함
  for(let i=0;i<7;i++){
    const d=new Date(monday); d.setDate(d.getDate()+i);
    try{
      getRepeatTasksForDate(d,i).forEach(({task,instanceDk})=>{
        weekTotal++; if(isRepeatChecked(task,instanceDk)) weekDone++; dayTotals[i]+=1;
      });
    }catch(e){}
  }
  const streak = (()=>{
    let s=0, d=new Date(now);
    for(let i=0;i<60;i++){
      const dk=dateKey(d);
      const list=tasks[dk];
      if(Array.isArray(list)&&list.length&&list.every(t=>t&&t.checked)) s++;
      else if(i>0) break;
      d.setDate(d.getDate()-1);
    }
    return s;
  })();

  const sg = document.createElement('div'); sg.className='stat-grid';
  [[weekDone+'/'+weekTotal,'이번 주 완료'],[Math.round(totalAll?doneAll/totalAll*100:0)+'%','전체 달성률'],[streak+'일','완료 연속']].forEach(([n,l])=>{
    const box=document.createElement('div'); box.className='stat-box';
    const num=document.createElement('div'); num.className='stat-num'; num.textContent=n;
    const lab=document.createElement('div'); lab.className='stat-label'; lab.textContent=l;
    box.appendChild(num); box.appendChild(lab); sg.appendChild(box);
  });
  panel.appendChild(sg);

  // week bar chart
  const barTitle=document.createElement('div'); barTitle.className='dash-panel-title'; barTitle.style.marginBottom='6px'; barTitle.textContent='요일별 태스크';
  panel.appendChild(barTitle);
  const barWrap=document.createElement('div'); barWrap.className='week-bar-wrap';
  const max=Math.max(...dayTotals,1);
  ['월','화','수','목','금','토','일'].forEach((d,i)=>{
    const col=document.createElement('div'); col.className='week-bar-col';
    const bar=document.createElement('div'); bar.className='week-bar'+(i===((now.getDay()+6)%7)?' today':'');
    bar.style.height=Math.round((dayTotals[i]/max)*50+4)+'px';
    const lbl=document.createElement('div'); lbl.className='week-bar-day'; lbl.textContent=d;
    col.appendChild(bar); col.appendChild(lbl); barWrap.appendChild(col);
  });
  panel.appendChild(barWrap);

  // important upcoming (D-day)
  const important=getImportantUpcoming();
  if(important.length){
    const ddTitle=document.createElement('div'); ddTitle.className='dash-panel-title';
    ddTitle.style.cssText='margin-top:14px;margin-bottom:6px';
    ddTitle.textContent='⭐ 다가오는 중요 일정';
    panel.appendChild(ddTitle);
    const ddList=document.createElement('div'); ddList.className='upcoming-list';
    important.forEach(it=>{
      const item=document.createElement('div'); item.className='upcoming-item';
      const dd=document.createElement('div');
      dd.className='upcoming-dday '+(it.dday===0?'today':it.dday<=3?'soon':'far');
      dd.textContent=it.dday===0?'D-DAY':'D-'+it.dday;
      const info=document.createElement('div'); info.className='upcoming-info';
      const name=document.createElement('div'); name.className='upcoming-name';
      name.textContent=(it.priority==='high'?'🔴 ':it.starred?'★ ':'')+it.text;
      const dateEl=document.createElement('div'); dateEl.className='upcoming-date';
      const d=new Date(it.dk);
      dateEl.textContent=`${d.getMonth()+1}월 ${d.getDate()}일 (${DAY_NAMES[dateToDayIdx(d)]})`;
      info.appendChild(name); info.appendChild(dateEl);
      item.appendChild(dd); item.appendChild(info);
      ddList.appendChild(item);
    });
    panel.appendChild(ddList);
  }

}

function getSheetEvents(){
  const today=new Date(); today.setHours(0,0,0,0);
  const seen=new Set();
  const events=[];
  Object.entries(tasks).forEach(([dk,list])=>{
    if(!Array.isArray(list)) return;
    list.forEach(t=>{
      if(!t||t.color!=='#1677ff'||!t.text.includes('[전관행사]')) return;
      const date=parseDk(dk); date.setHours(0,0,0,0);
      const dday=Math.round((date-today)/86400000);
      if(dday<0) return; // 지난 행사 제외
      const key=t.text+'|'+dk;
      if(seen.has(key)) return;
      seen.add(key);
      // 날짜 범위 행사는 시작일만 한번 보여주기 위해 텍스트 기준 중복 제거
      const textSeen=seen.has(t.text);
      if(!textSeen){ seen.add(t.text); events.push({text:t.text,dk,date,dday}); }
    });
  });
  return events.sort((a,b)=>a.dday-b.dday);
}

function buildDashCalendar(){
  const panel = document.getElementById('dashCalendar');
  panel.innerHTML = '';

  // ── 완료 통계 & 예정 ──
  const title = document.createElement('div'); title.className='dash-panel-title';
  title.textContent = '📈 완료 통계 & 예정';
  panel.appendChild(title);

  // 최근 8주 완료율 추이
  const now = today();
  const thisMonday = getMonday(now);
  const weekStats = [];
  for(let w=7;w>=0;w--){
    const ws=new Date(thisMonday); ws.setDate(ws.getDate()-w*7);
    let total=0,done=0;
    for(let i=0;i<7;i++){
      const d=new Date(ws); d.setDate(d.getDate()+i);
      visibleStored(dateKey(d)).forEach(t=>{ if(t){total++; if(t.checked)done++;} });
      try{
        getRepeatTasksForDate(d,i).forEach(({task,instanceDk})=>{
          total++; if(isRepeatChecked(task,instanceDk))done++;
        });
      }catch(e){}
    }
    weekStats.push({ws,total,done,pct:total?Math.round(done/total*100):0});
  }
  const trendWrap=document.createElement('div'); trendWrap.className='week-bar-wrap'; trendWrap.style.marginBottom='14px';
  weekStats.forEach(({ws,total,pct},i)=>{
    const col=document.createElement('div'); col.className='week-bar-col';
    const bar=document.createElement('div'); bar.className='week-bar'+(i===weekStats.length-1?' today':'');
    bar.style.height=Math.round(pct/100*50+4)+'px';
    bar.title=`${ws.getMonth()+1}/${ws.getDate()} 주 · ${pct}% (${total}개)`;
    const lbl=document.createElement('div'); lbl.className='week-bar-day';
    lbl.textContent=i===weekStats.length-1?'이번주':`${ws.getMonth()+1}/${ws.getDate()}`;
    col.appendChild(bar); col.appendChild(lbl); trendWrap.appendChild(col);
  });
  const trendTitle=document.createElement('div'); trendTitle.className='dash-panel-title'; trendTitle.style.marginBottom='6px';
  trendTitle.textContent='주별 완료율 (최근 8주)';
  panel.appendChild(trendTitle);
  panel.appendChild(trendWrap);

  // 앞으로 해야 할 일 (미완료·예정, 가까운 날짜순)
  const todayDk0=todayKey();
  const upcomingTodo=[];
  Object.entries(tasks).forEach(([dk,list])=>{
    if(!Array.isArray(list))return;
    if(dk<todayDk0)return; // 지난 날짜 제외(오늘 포함)
    list.forEach(t=>{ if(t&&!t.checked&&!t.pending&&(!t.repeat||t.repeat==='none')) upcomingTodo.push({dk,task:t}); });
  });
  upcomingTodo.sort((a,b)=>a.dk<b.dk?-1:a.dk>b.dk?1:0);
  const histTitle=document.createElement('div'); histTitle.className='dash-panel-title'; histTitle.style.marginBottom='6px';
  histTitle.textContent='📋 앞으로 해야 할 일';
  panel.appendChild(histTitle);
  if(upcomingTodo.length){
    const list=document.createElement('div'); list.className='upcoming-list';
    upcomingTodo.slice(0,8).forEach(({dk,task})=>{
      const item=document.createElement('div'); item.className='upcoming-item';
      item.style.cursor='pointer';
      const dday=Math.round((parseDk(dk)-today())/86400000);
      const when=document.createElement('div');
      when.className='upcoming-dday '+(dday===0?'today':dday<=7?'soon':'far');
      when.textContent=dday===0?'D-DAY':'D-'+dday;
      const info=document.createElement('div'); info.className='upcoming-info';
      const name=document.createElement('div'); name.className='upcoming-name';
      name.textContent=(task.starred?'★ ':'')+(task.priority==='high'?'🔴 ':'')+task.text;
      const dateEl=document.createElement('div'); dateEl.className='upcoming-date';
      const pd=parseDk(dk);
      dateEl.textContent=`${pd.getMonth()+1}월 ${pd.getDate()}일 (${['일','월','화','수','목','금','토'][pd.getDay()]})`+(task.time?` · ⏰${task.time}`:'');
      info.appendChild(name); info.appendChild(dateEl);
      item.appendChild(when); item.appendChild(info);
      item.onclick=()=>{weekStart=getMonday(parseDk(dk));setView('week');window.scrollTo({top:0,behavior:'smooth'});};
      list.appendChild(item);
    });
    panel.appendChild(list);
  } else {
    const empty=document.createElement('div');
    empty.style.cssText='font-size:12px;color:var(--text3);text-align:center;padding:14px';
    empty.textContent='예정된 할 일이 없어요 🎉';
    panel.appendChild(empty);
  }

  // 전관행사 (구글 시트 동기화 데이터가 있을 때만)
  const sheetEvts = getSheetEvents();
  if(sheetEvts.length){
    const sTitle=document.createElement('div'); sTitle.className='dash-panel-title';
    sTitle.style.cssText='margin-top:14px;margin-bottom:6px';
    sTitle.textContent='🏬 전관행사 일정';
    panel.appendChild(sTitle);
    const list=document.createElement('div'); list.className='upcoming-list';
    sheetEvts.slice(0,8).forEach(e=>{
      const item=document.createElement('div'); item.className='upcoming-item';
      const dd=document.createElement('div');
      dd.className='upcoming-dday '+(e.dday===0?'today':e.dday<=7?'soon':'far');
      dd.textContent=e.dday===0?'D-DAY':'D-'+e.dday;
      const info=document.createElement('div'); info.className='upcoming-info';
      const cleanName=e.text.replace('[전관행사]','').trim();
      const name=document.createElement('div'); name.className='upcoming-name'; name.textContent=cleanName||e.text;
      const dateEl=document.createElement('div'); dateEl.className='upcoming-date';
      dateEl.textContent=`${e.date.getMonth()+1}월 ${e.date.getDate()}일 (${['일','월','화','수','목','금','토'][e.date.getDay()]})`;
      info.appendChild(name); info.appendChild(dateEl);
      item.appendChild(dd); item.appendChild(info);
      list.appendChild(item);
    });
    panel.appendChild(list);
  }
}

// ── Google Sheet Sync ──
const SHEET_ID  = '1wqZEZF34-4CzAsIeNxGyIWvPkjgw4zHCcw1K_exfzIk';
const SHEET_GID = '1376643190';
const SHEET_SYNC_KEY = 'sheetLastSync';
const SHEET_COL_START = 40; // AO (0-based)
const SHEET_COL_END   = 48; // AW (0-based)

function parseCSV(text){
  const rows=[];
  for(const line of text.split('\n')){
    const fields=[]; let f='', q=false;
    for(let i=0;i<line.length;i++){
      const c=line[i];
      if(c==='"'){ if(q&&line[i+1]==='"'){f+='"';i++;}else q=!q; }
      else if(c===','&&!q){ fields.push(f); f=''; }
      else f+=c;
    }
    fields.push(f); rows.push(fields);
  }
  return rows;
}

function parseDateRange(cellText, contextYear){
  // e.g. "[전관행사] L+DAY (1/13 10시~1/15 10시) * 1/13 10시~..."
  // Deduplicate M/D pairs and track year rollover within the range
  const rawMatches=[...cellText.matchAll(/(\d{1,2})\/(\d{1,2})/g)]
    .map(m=>({month:+m[1],day:+m[2]}));
  if(!rawMatches.length) return [];
  // Deduplicate consecutive identical months/days
  const unique=[rawMatches[0]];
  for(let i=1;i<rawMatches.length;i++){
    const prev=unique[unique.length-1];
    if(rawMatches[i].month!==prev.month||rawMatches[i].day!==prev.day) unique.push(rawMatches[i]);
  }
  // Assign years: if month drops (12→1), increment year
  let yr=contextYear; let prevM=null;
  const dated=unique.map(({month,day})=>{
    if(prevM!==null&&month<prevM&&prevM>=10) yr++;
    prevM=month;
    return new Date(yr,month-1,day);
  });
  if(dated.length===1) return dated;
  // Build inclusive date range between first and last
  const days=[]; const cur=new Date(dated[0]); const end=new Date(dated[dated.length-1]);
  while(cur<=end){ days.push(new Date(cur)); cur.setDate(cur.getDate()+1); }
  return days;
}

function makeEventText(cellText){
  // Strip annotation after asterisk (e.g. "* 1/13 10시~... 우선 랜딩")
  return cellText.replace(/\*[^[]*$/,'').replace(/\s+/g,' ').trim();
}

async function fetchSheetCSV(){
  const exportUrl=`https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${SHEET_GID}`;
  const gvizUrl=`https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&gid=${SHEET_GID}`;
  const pubUrl=`https://docs.google.com/spreadsheets/d/${SHEET_ID}/pub?gid=${SHEET_GID}&single=true&output=csv`;
  // gviz 엔드포인트는 공개 시트에 CORS를 허용 → 프록시 없이 직접 시도 (가장 빠르고 안정적)
  const candidates=[
    gvizUrl,
    `https://api.allorigins.win/raw?url=${encodeURIComponent(exportUrl)}`,
    `https://api.allorigins.win/raw?url=${encodeURIComponent(gvizUrl)}`,
    `https://corsproxy.io/?url=${encodeURIComponent(exportUrl)}`,
    `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(exportUrl)}`,
    `https://api.allorigins.win/get?url=${encodeURIComponent(exportUrl)}`,
    `https://api.allorigins.win/get?url=${encodeURIComponent(pubUrl)}`,
  ];
  let fallbackCsv=null;
  for(const url of candidates){
    try{
      const res=await fetch(url,{signal:AbortSignal.timeout(10000)});
      if(!res.ok) continue;
      let csv=await res.text();
      try{ const j=JSON.parse(csv); if(j.contents) csv=j.contents; }catch(e){}
      if(!csv||!csv.includes(',')||!csv.includes('\n')) continue;
      const rows=parseCSV(csv);
      // 최우선: 전관행사 셀이 실제로 보이는 CSV
      if(rows.some(r=>r.some(c=>c&&c.includes('[전관행사]')))) return csv;
      // 차선: 컬럼 폭이 충분한 CSV (전관행사가 없는 기간일 수도 있으므로)
      if(!fallbackCsv&&rows.some(r=>r.length>SHEET_COL_END)) fallbackCsv=csv;
    }catch(e){ continue; }
  }
  return fallbackCsv;
}

async function syncSheetEvents(manual=false){
  const syncBtn=document.getElementById('sheetSyncBtn');
  if(syncBtn){ syncBtn.disabled=true; syncBtn.textContent='동기화 중...'; }
  try{
    const csv=await fetchSheetCSV();
    if(!csv) throw new Error('CSV 로드 실패');
    const rows=parseCSV(csv);

    // Determine starting year: 시트 상단에서 4자리 연도(20xx)를 직접 탐색
    let contextYear=null, prevWeekMonth=null;
    outer:
    for(let ri=0;ri<Math.min(rows.length,5);ri++){
      for(const cell of (rows[ri]||[])){
        const ym=(cell||'').match(/20(2\d)\s*년?/);
        if(ym){ contextYear=2000+(+ym[1]); break outer; }
      }
    }
    const firstDateRow=rows[2]||[];
    for(let ci=41;ci<=47;ci++){
      const m=(firstDateRow[ci]||'').match(/(\d{1,2})[월\/\s]\s*\d/);
      if(m){
        prevWeekMonth=+m[1];
        if(contextYear===null) contextYear=prevWeekMonth>=10?new Date().getFullYear()-(new Date().getMonth()>=9?0:1):new Date().getFullYear();
        break;
      }
    }
    if(contextYear===null) contextYear=new Date().getFullYear();

    let added=0;
    // Date rows at CSV indices 2,8,14,20,...  Event rows: dateIdx+1 (가변탭1), dateIdx+2 (가변탭2)
    for(let dateIdx=2; dateIdx<rows.length; dateIdx+=6){
      // Update context year by reading this week's Monday date
      const dateRow=rows[dateIdx]||[];
      for(let ci=41;ci<=47;ci++){
        const m=(dateRow[ci]||'').match(/(\d{1,2})[월\/\s]\s*\d/);
        if(m){
          const mo=+m[1];
          if(prevWeekMonth!==null&&mo<prevWeekMonth&&prevWeekMonth>=10) contextYear++;
          prevWeekMonth=mo; break;
        }
      }
      // Scan event rows: +1 (가변탭1) and +2 (가변탭2)
      for(const offset of [1,2]){
        const evRow=rows[dateIdx+offset]||[];
        for(let ci=SHEET_COL_START;ci<=SHEET_COL_END;ci++){
          const cell=(evRow[ci]||'').trim();
          if(!cell.includes('[전관행사]')) continue;
          const dates=parseDateRange(cell, contextYear);
          if(!dates.length) continue;
          const text=makeEventText(cell);
          dates.forEach(date=>{
            const dk=dateKey(date);
            if(!tasks[dk]) tasks[dk]=[];
            if(!tasks[dk].some(t=>t&&t.text===text)){
              tasks[dk].push({id:uid(),text,checked:false,starred:true,color:'#1677ff',repeat:'none',completions:{},subs:[]});
              added++;
            }
          });
        }
      }
    }
    if(added>0){ localStorage.setItem(STORAGE_KEY,JSON.stringify(tasks)); if(fbRef())fbUpload(); render(); }
    localStorage.setItem(SHEET_SYNC_KEY,new Date().toISOString().slice(0,10));
    if(syncBtn){ syncBtn.disabled=false; syncBtn.textContent=`✅ 동기화됨 (${added}건)`; }
    buildDashStats(); buildDashCalendar();
    const p=document.getElementById('dashCalendar'); if(p) appendSheetSyncRow(p);
    return {success:true,added};
  }catch(e){
    if(syncBtn){
      syncBtn.disabled=false; syncBtn.textContent=`⚠️ 실패`;
      setTimeout(()=>{ if(syncBtn.isConnected) syncBtn.textContent='📥 지금 가져오기'; },4000);
    }
    if(manual) alert('시트를 가져오지 못했어요.\n\n1) 구글시트가 "링크가 있는 모든 사용자"로 공개되어 있는지 확인해 주세요.\n2) 잠시 후 다시 시도해 주세요.');
    console.warn('Sheet sync error:',e);
    return {success:false,error:e.message};
  }
}

function checkMondaySync(){
  const today=new Date();
  if(today.getDay()!==1) return; // 월요일만
  const todayStr=today.toISOString().slice(0,10);
  if(localStorage.getItem(SHEET_SYNC_KEY)===todayStr) return;
  syncSheetEvents();
}

function appendSheetSyncRow(panel){
  // '지금 가져오기' 버튼 제거됨 — 기존에 그려진 행이 있으면 정리만 함
  const old=panel.querySelector('.sheet-sync-row');
  if(old) old.remove();
  const old2=panel.querySelector('.sheet-sync-divider');
  if(old2) old2.remove();
}

function initDashboard(){
  if(window.innerWidth<=768) return;
  buildDashStats();
  buildDashCalendar();
  appendSheetSyncRow(document.getElementById('dashCalendar'));
}

initDashboard();
checkMondaySync();

// ── 이름 변경 / 데이터 이전 ──
function renameAccount() {
  if (READ_ONLY || IS_TEAM || !USER_ID) { alert('내 캘린더(?u=이름)에서만 사용할 수 있어요.'); return; }
  const cur = USER_ID;
  const next = prompt('새 이름을 입력해 주세요.\n데이터가 새 이름으로 복사되고, 새 URL로 이동해요.\n(이전 이름 데이터는 그대로 남아요)', cur);
  if (next == null) return;
  const nn = next.trim();
  if (!nn || nn === cur) return;
  const oldSuffix = '_' + cur;
  const newSuffix = '_' + nn;
  const keys = [];
  for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && k.startsWith('cal') && k.endsWith(oldSuffix)) keys.push(k); }
  keys.forEach(k => { const base = k.slice(0, k.length - oldSuffix.length); localStorage.setItem(base + newSuffix, localStorage.getItem(k)); });
  localStorage.setItem('lastUser', nn);
  alert(`'${nn}'(으)로 이전했어요. 새 캘린더로 이동할게요.`);
  window.location.href = window.location.pathname + `?u=${encodeURIComponent(nn)}`;
}

// ── 전체 백업 / 복원 ──
function collectAllData() {
  return {
    _app: 'myplanner', _v: 1, _exported: new Date().toISOString(), user: USER_ID || null,
    tasks: tasks,
    offDays: (typeof offDays !== 'undefined' ? offDays : {}),
    memos: (typeof memos !== 'undefined' ? memos : {}),
    shares: (typeof shares !== 'undefined' ? shares : {}),
    goals: (typeof goals !== 'undefined' ? goals : []),
    icsSubs: (typeof icsSubs !== 'undefined' ? icsSubs : []),
    templates: JSON.parse(localStorage.getItem(TPL_KEY) || '[]'),
    trash: JSON.parse(localStorage.getItem(TRASH_KEY) || '[]'),
    teamSubs: (typeof teamSubs !== 'undefined' ? teamSubs : {}),
    myTeams: (typeof myTeams !== 'undefined' ? myTeams : {}),
  };
}
function _collectImageIds() {
  const ids = new Set();
  Object.values(tasks || {}).forEach(list => { if (Array.isArray(list)) list.forEach(t => { if (t && Array.isArray(t.memoImages)) t.memoImages.forEach(id => ids.add(id)); }); });
  return [...ids];
}
function _blobToDataURL(blob) { return new Promise(res => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = () => res(null); r.readAsDataURL(blob); }); }
function _dataURLToBlob(d) { try { const [h, b] = String(d).split(','); const mime = (h.match(/:(.*?);/) || [])[1] || 'image/png'; const bin = atob(b); const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return new Blob([u], { type: mime }); } catch (e) { return null; } }
async function exportAllData() {
  try {
    const data = collectAllData();
    // 메모 이미지(IndexedDB)도 base64로 포함 → 완전 백업
    const images = {};
    for (const id of _collectImageIds()) { try { const blob = await idbGetImage(id); if (blob) { const d = await _blobToDataURL(blob); if (d) images[id] = d; } } catch (e) {} }
    data.images = images;
    const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `myplanner-backup-${USER_ID || 'local'}-${todayKey()}.json`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch (e) { alert('백업에 실패했어요: ' + e.message); }
}
function importAllData(file) {
  if (READ_ONLY) { alert('읽기 전용 모드에서는 복원할 수 없어요.'); return; }
  const reader = new FileReader();
  reader.onload = () => {
    let data;
    try { data = JSON.parse(reader.result); } catch { alert('올바른 백업 파일이 아니에요.'); return; }
    if (!data || data._app !== 'myplanner' || typeof data.tasks !== 'object') {
      alert('마이플래너 백업 파일이 아니에요.'); return;
    }
    const cnt = Object.values(data.tasks || {}).reduce((n, l) => n + (Array.isArray(l) ? l.length : 0), 0);
    if (!confirm(`현재 데이터를 백업본으로 덮어써요.\n할 일 ${cnt}개 · 내보낸 시각 ${data._exported || '알 수 없음'}\n계속할까요?`)) return;
    Object.values(data.tasks||{}).forEach(list=>{if(Array.isArray(list))list.forEach(t=>{if(t&&t.memo)t.memo=sanitizeMemoHtml(t.memo);});});
    tasks = normalizeTasks(data.tasks);
    if (typeof saveTasks === 'function') saveTasks();
    if (data.offDays && typeof offDays !== 'undefined') { offDays = data.offDays; saveOffDays(); }
    if (data.memos && typeof memos !== 'undefined') { memos = data.memos; saveMemos(); }
    if (data.shares && typeof shares !== 'undefined') { shares = data.shares; saveShares(); }
    if (data.goals && typeof goals !== 'undefined') { goals = data.goals; saveGoals(); }
    // localStorage 전용 컬렉션
    if (data.icsSubs && typeof icsSubs !== 'undefined') { icsSubs = data.icsSubs; saveIcsSubs(); }
    if (data.templates) saveTpls(data.templates);
    if (data.trash) saveTrash(data.trash);
    if (data.teamSubs && typeof teamSubs !== 'undefined') { teamSubs = data.teamSubs; saveTeamSubs(); }
    if (data.myTeams && typeof myTeams !== 'undefined') { myTeams = data.myTeams; saveMyTeams(); }
    // 메모 이미지 복원(IndexedDB)
    if (data.images && typeof data.images === 'object') {
      Object.entries(data.images).forEach(([id, d]) => { const b = _dataURLToBlob(d); if (b) idbPutImage(id, b); });
    }
    render();
    alert('복원을 완료했어요.' + (data.images ? ' (이미지 포함)' : ''));
  };
  reader.onerror = () => alert('파일을 읽지 못했어요.');
  reader.readAsText(file);
}
const _backupBtn = document.getElementById('backupBtn');
if (_backupBtn) _backupBtn.onclick = () => { document.getElementById('moreMenu').classList.add('hidden'); exportAllData(); };
const _restoreBtn = document.getElementById('restoreBtn');
const _restoreInput = document.getElementById('restoreFileInput');
if (_restoreBtn && _restoreInput) {
  _restoreBtn.onclick = () => { document.getElementById('moreMenu').classList.add('hidden'); _restoreInput.click(); };
  _restoreInput.onchange = () => { if (_restoreInput.files && _restoreInput.files[0]) importAllData(_restoreInput.files[0]); _restoreInput.value = ''; };
}

// ── 모달 접근성: 포커스 트랩 + 열기 시 포커스 이동 + 닫기 시 복원 ──
let _lastFocusBeforeModal = null;
function _modalFocusables(modal) {
  return [...modal.querySelectorAll('a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])')]
    .filter(x => x.offsetParent !== null);
}
// 보이는 모달 안에서 Tab 순환
document.addEventListener('keydown', e => {
  if (e.key !== 'Tab') return;
  const overlays = [...document.querySelectorAll('.modal-overlay:not(.hidden), .memo-overlay:not(.hidden)')];
  const modal = overlays[overlays.length - 1];
  if (!modal) return;
  const f = _modalFocusables(modal);
  if (!f.length) return;
  const first = f[0], last = f[f.length - 1];
  if (!modal.contains(document.activeElement)) { e.preventDefault(); first.focus(); }
  else if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
  else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
});
// 열림/닫힘 감지 → 첫 컨트롤 포커스 / 트리거로 복원
const _modalObserver = new MutationObserver(muts => {
  muts.forEach(m => {
    const t = m.target; if (!t.classList) return;
    const wasHidden = (m.oldValue || '').includes('hidden');
    const nowHidden = t.classList.contains('hidden');
    if (wasHidden && !nowHidden) {
      _lastFocusBeforeModal = document.activeElement;
      const f = _modalFocusables(t);
      if (f.length) setTimeout(() => { try { f[0].focus(); } catch {} }, 40);
    } else if (!wasHidden && nowHidden) {
      const r = _lastFocusBeforeModal; _lastFocusBeforeModal = null;
      if (r && r.focus && document.body.contains(r)) { try { r.focus(); } catch {} }
    }
  });
});
[...document.querySelectorAll('.modal-overlay, .memo-overlay')].forEach(ov =>
  _modalObserver.observe(ov, { attributes: true, attributeFilter: ['class'], attributeOldValue: true }));

// ── 다중 선택 일괄 작업 ──
function updateBulkBar() {
  const bar = document.getElementById('bulkBar'); if (!bar) return;
  if (selectMode) { bar.classList.remove('hidden'); const c = document.getElementById('bulkCount'); if (c) c.textContent = `${bulkSelected.size}개 선택`; }
  else bar.classList.add('hidden');
}
function exitSelectMode() { selectMode = false; bulkSelected.clear(); updateBulkBar(); render(); }
function bulkForEach(fn) {
  bulkSelected.forEach(key => {
    const i = key.indexOf('|'); const dk = key.slice(0, i), id = key.slice(i + 1);
    const list = tasks[dk]; if (!Array.isArray(list)) return;
    const idx = list.findIndex(t => t && t.id === id);
    if (idx >= 0) fn(list, idx, dk);
  });
}
(() => {
  const sb = document.getElementById('selectModeBtn');
  if (sb) sb.onclick = () => { document.getElementById('moreMenu').classList.add('hidden'); selectMode = !selectMode; bulkSelected.clear(); updateBulkBar(); render(); };
  const ex = document.getElementById('bulkExitBtn'); if (ex) ex.onclick = exitSelectMode;
  const done = document.getElementById('bulkDoneBtn');
  if (done) done.onclick = () => { if (!bulkSelected.size) return; bulkForEach((l, i) => { if (!l[i].checked) { l[i].checked = true; l[i].completedAt = Date.now(); } }); saveTasks(); exitSelectMode(); };
  const undone = document.getElementById('bulkUndoneBtn');
  if (undone) undone.onclick = () => { if (!bulkSelected.size) return; bulkForEach((l, i) => { if (l[i].checked) { l[i].checked = false; } }); saveTasks(); exitSelectMode(); };
  const del = document.getElementById('bulkDeleteBtn');
  if (del) del.onclick = () => { if (!bulkSelected.size) return; if (!confirm(`선택한 ${bulkSelected.size}개를 삭제할까요? (휴지통에 30일 보관)`)) return; bulkForEach((l, i, dk) => { const removed = l.splice(i, 1)[0]; addToTrash(dk, removed, null); }); saveTasks(); exitSelectMode(); };
})();
