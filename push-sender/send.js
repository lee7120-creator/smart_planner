// 마이플래너 백그라운드 푸시 발송기
// GitHub Actions cron(약 5분 간격)에서 실행됩니다.
// Firebase RTDB(REST, 공개 규칙 기준)에서 사용자별 할 일/구독/설정을 읽어
// '마감 임박'과 '아침 요약' 알림을 Web Push로 발송하고, 중복 발송을 막습니다.
//
// 필요한 환경변수:
//   DB_URL          예: https://my-calendar-1a589-default-rtdb.firebaseio.com
//   VAPID_PUBLIC    web-push generate-vapid-keys 의 publicKey
//   VAPID_PRIVATE   web-push generate-vapid-keys 의 privateKey
//   VAPID_SUBJECT   mailto:you@example.com (선택, 기본 example)
//
// 한계(v1): 반복 일정은 제외(저장된 비반복 시간지정 태스크 + 아침 요약 카운트만).

const webpush = require('web-push');

const DB = (process.env.DB_URL || '').replace(/\/$/, '');
const PUB = process.env.VAPID_PUBLIC;
const PRIV = process.env.VAPID_PRIVATE;
const SUBJ = process.env.VAPID_SUBJECT || 'mailto:admin@example.com';

if (!DB || !PUB || !PRIV) {
  console.error('환경변수 DB_URL / VAPID_PUBLIC / VAPID_PRIVATE 가 필요합니다.');
  process.exit(1);
}
webpush.setVapidDetails(SUBJ, PUB, PRIV);

const getJ = (path) => fetch(`${DB}/${path}.json`).then(r => r.json());
const putJ = (path, body) => fetch(`${DB}/${path}.json`, { method: 'PUT', body: JSON.stringify(body) });
const delJ = (path) => fetch(`${DB}/${path}.json`, { method: 'DELETE' });

const asArray = (v) => Array.isArray(v) ? v : (v && typeof v === 'object' ? Object.values(v) : []);
function localParts(ms, tzOffMin) {
  const d = new Date(ms + (tzOffMin || 0) * 60000);
  const dk = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
  const min = d.getUTCHours() * 60 + d.getUTCMinutes();
  return { dk, min };
}

async function run() {
  const users = (await getJ('users')) || {};
  const now = Date.now();
  let sent = 0;

  for (const [uid, u] of Object.entries(users)) {
    if (!u || uid.startsWith('team-')) continue;
    const prefs = u.notifyPrefs, subs = u.pushSubs;
    if (!prefs || !prefs.enabled || !subs || !Object.keys(subs).length) continue;

    const tz = Number(prefs.tzOffset || 0);
    const lead = Number(prefs.leadMin != null ? prefs.leadMin : 30);
    const morning = Number(prefs.morningHour != null ? prefs.morningHour : 9);
    const { dk, min: nowMin } = localParts(now, tz);

    const dayList = asArray((u.tasks || {})[dk]);
    const state = (u.pushState && u.pushState.dk === dk) ? u.pushState : { dk, ids: [], morning: false };
    const ids = new Set(state.ids || []);
    const toSend = [];

    // 1) 마감 임박 (시간지정·미완료·비반복)
    for (const t of dayList) {
      if (!t || t.checked || !t.time) continue;
      if (t.repeat && t.repeat !== 'none') continue;
      const [h, m] = String(t.time).split(':').map(Number);
      if (isNaN(h)) continue;
      const remain = (h * 60 + m) - nowMin;
      const key = 't_' + t.id;
      if (remain >= 0 && remain <= lead && !ids.has(key)) {
        toSend.push({ title: '⏰ ' + t.text, body: remain <= 1 ? '지금 마감입니다' : `마감 ${remain}분 전입니다 (${t.time})`, tag: key });
        ids.add(key);
      }
    }
    // 2) 아침 요약 (오늘 1회)
    if (!state.morning && nowMin >= morning * 60) {
      const cnt = dayList.filter(t => t && !t.checked && (!t.repeat || t.repeat === 'none')).length;
      if (cnt > 0) toSend.push({ title: `🗓 오늘의 할 일 ${cnt}건`, body: '오늘 할 일을 확인하세요', tag: 'morning_' + dk });
      state.morning = true;
    }

    // 발송
    if (toSend.length) {
      for (const [sid, sub] of Object.entries(subs)) {
        if (!sub || !sub.endpoint) continue;
        for (const msg of toSend) {
          try {
            await webpush.sendNotification({ endpoint: sub.endpoint, keys: sub.keys }, JSON.stringify(msg));
            sent++;
          } catch (err) {
            const sc = err && err.statusCode;
            if (sc === 404 || sc === 410) { await delJ(`users/${uid}/pushSubs/${sid}`); } // 만료 구독 정리
          }
        }
      }
    }
    state.ids = [...ids];
    await putJ(`users/${uid}/pushState`, state);
  }
  console.log(`발송 완료: ${sent}건`);
}

run().catch(e => { console.error(e); process.exit(1); });
