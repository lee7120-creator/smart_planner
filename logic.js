// 순수 캘린더/날짜 로직 — DOM·Firebase 의존 없음. 브라우저(전역)와 Node(테스트) 양쪽에서 사용.
// ── 공휴일 2026~2027 (대체공휴일 포함) ──
const HOLIDAYS = {
  '2026-01-01': '신정',
  '2026-02-16': '설날 연휴',
  '2026-02-17': '설날',
  '2026-02-18': '설날 연휴',
  '2026-03-01': '삼일절',
  '2026-03-02': '삼일절 대체공휴일',
  '2026-05-01': '근로자의 날',
  '2026-05-05': '어린이날',
  '2026-05-24': '부처님오신날',
  '2026-05-25': '부처님오신날 대체공휴일',
  '2026-06-06': '현충일',
  '2026-06-08': '현충일 대체공휴일',
  '2026-08-15': '광복절',
  '2026-08-17': '광복절 대체공휴일',
  '2026-09-24': '추석 연휴',
  '2026-09-25': '추석',
  '2026-09-26': '추석 연휴',
  '2026-09-28': '추석 대체공휴일',
  '2026-10-03': '개천절',
  '2026-10-05': '개천절 대체공휴일',
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
  return day === 0 || day === 6 || isHoliday(dateKey(date));
}
// 휴일이면 직전 평일로 이동
function prevWorkday(date) {
  let d = new Date(date);
  d.setDate(d.getDate() - 1);
  let guard = 0;
  while (isRestDay(d) && guard++ < 14) d.setDate(d.getDate() - 1);
  return d;
}
// 해당 월의 origin day 기준 조정된 영업일 반환
function adjustedMonthlyDate(year, month, originDay) {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  let d = new Date(year, month, Math.min(originDay, daysInMonth));
  if (isRestDay(d)) d = prevWorkday(d);
  if (d.getMonth() !== month) return null;
  return d;
}

function getMonday(d) {
  const date = new Date(d);
  const day = date.getDay();
  date.setDate(date.getDate()-(day===0?6:day-1));
  date.setHours(0,0,0,0); return date;
}
function dateKey(d) { return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
// 'YYYY-MM-DD'를 로컬 타임존 기준으로 파싱 (new Date(str)는 UTC로 해석되어 요일이 어긋날 수 있음)
function parseDk(dk) {
  const [y, m, d] = dk.split('-').map(Number);
  return new Date(y, m - 1, d);
}
function today() { const d=new Date(); d.setHours(0,0,0,0); return d; }
function todayKey() { return dateKey(today()); }
function dateToDayIdx(d) { const day=d.getDay(); return day===0?6:day-1; }

function nextWorkdayAfter(dk) {
  const d = parseDk(dk);
  d.setDate(d.getDate() + 1);
  let guard = 0;
  while (isRestDay(d) && guard++ < 14) d.setDate(d.getDate() + 1);
  return dateKey(d);
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { getMonday, dateKey, parseDk, today, todayKey, dateToDayIdx,
    isHoliday, isRestDay, prevWorkday, adjustedMonthlyDate, nextWorkdayAfter, HOLIDAYS };
}
