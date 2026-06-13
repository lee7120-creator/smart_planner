// logic.js 순수 로직 단위 테스트 — `node --test` 로 실행
const test = require('node:test');
const assert = require('node:assert');
const L = require('./logic.js');

test('getMonday: 어떤 요일이든 그 주 월요일 반환', () => {
  // 2026-06-13 은 토요일 → 같은 주 월요일은 2026-06-08
  assert.strictEqual(L.dateKey(L.getMonday(new Date(2026, 5, 13))), '2026-06-08');
  // 월요일 자신은 그대로
  assert.strictEqual(L.dateKey(L.getMonday(new Date(2026, 5, 8))), '2026-06-08');
  // 일요일은 직전 월요일
  assert.strictEqual(L.dateKey(L.getMonday(new Date(2026, 5, 14))), '2026-06-08');
});

test('dateKey: 2자리 0 패딩', () => {
  assert.strictEqual(L.dateKey(new Date(2026, 0, 5)), '2026-01-05');
  assert.strictEqual(L.dateKey(new Date(2026, 11, 25)), '2026-12-25');
});

test('parseDk: 로컬 타임존 기준 파싱', () => {
  const d = L.parseDk('2026-03-02');
  assert.strictEqual(d.getFullYear(), 2026);
  assert.strictEqual(d.getMonth(), 2);
  assert.strictEqual(d.getDate(), 2);
});

test('dateToDayIdx: 월=0 ... 일=6', () => {
  assert.strictEqual(L.dateToDayIdx(new Date(2026, 5, 8)), 0);  // 월
  assert.strictEqual(L.dateToDayIdx(new Date(2026, 5, 14)), 6); // 일
});

test('isHoliday / isRestDay', () => {
  assert.strictEqual(L.isHoliday('2026-06-06'), true);   // 현충일
  assert.strictEqual(L.isHoliday('2026-06-10'), false);
  assert.strictEqual(L.isRestDay(new Date(2026, 5, 6)), true);  // 토 + 현충일
  assert.strictEqual(L.isRestDay(new Date(2026, 5, 9)), false); // 평일
});

test('prevWorkday: 주말·공휴일 건너뛰어 직전 영업일', () => {
  // 2026-06-09(화) 기준 직전 영업일 → 06-08(대체공휴일)·07(일)·06(토) 건너뛰고 06-05(금)
  assert.strictEqual(L.dateKey(L.prevWorkday(new Date(2026, 5, 9))), '2026-06-05');
});

test('nextWorkdayAfter: 주말·공휴일 건너뛰어 다음 영업일', () => {
  // 06-05(금) 다음 → 06(토)·07(일)·08(대체공휴일) 건너뛰고 06-09(화)
  assert.strictEqual(L.nextWorkdayAfter('2026-06-05'), '2026-06-09');
});

test('adjustedMonthlyDate: 휴일이면 같은 달 내 직전 영업일', () => {
  const d = L.adjustedMonthlyDate(2026, 5, 6); // 6월 6일=토+현충일 → 6월 5일(금)
  assert.strictEqual(L.dateKey(d), '2026-06-05');
  assert.strictEqual(d.getMonth(), 5);
});

test('adjustedMonthlyDate: 조정 결과가 이전 달로 넘어가면 null', () => {
  // 2026-08-01 은 토요일 → prevWorkday 가 7월로 넘어감 → null
  assert.strictEqual(L.adjustedMonthlyDate(2026, 7, 1), null);
});
