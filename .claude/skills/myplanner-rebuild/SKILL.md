---
name: myplanner-rebuild
description: Blueprint to rebuild "마이플래너" (MyPlanner), a single-file vanilla JS/CSS calendar & task planner PWA with Firebase Realtime DB sync. Use this when recreating the app from scratch, porting it to a new stack, or understanding its full architecture (data models, views, repeat logic, team calendar, memos, notifications). No build step — plain HTML/CSS/JS deployed via GitHub Pages.
---

# 마이플래너 (MyPlanner) — Rebuild Blueprint

A Korean-language weekly/monthly calendar task planner. **Zero framework, zero build step.**
Three source files (`index.html`, `styles.css`, `app.js`) + PWA assets + an optional push-sender.
Local-first (localStorage + IndexedDB) with Firebase Realtime Database for cross-device sync and
team/share collaboration. Deployed on GitHub Pages (`gh-pages` branch).

## File layout

```
index.html              # DOM skeleton + <head> (CDN deps, PWA meta). ~500 lines.
styles.css              # All styling, light/dark via CSS vars. ~1440 lines.
app.js                  # All logic. ~6300 lines, no modules — one IIFE-ish global scope.
sw.js                   # Service worker, network-first cache "myplanner".
manifest.webmanifest    # PWA manifest.
icon.svg / icon-192.png / icon-512.png / icon-512-maskable.png
firebase-rules.json     # Public RTDB rules (no auth).
push-sender/            # Optional Node sender (web-push) run by GitHub Actions cron.
.github/workflows/push.yml
```

Build order when recreating: **(1)** scaffold `index.html` head + DOM containers → **(2)**
`styles.css` design tokens + layout → **(3)** `app.js` data layer (state, localStorage, dateKey
helpers) → **(4)** rendering (`render()` + view builders) → **(5)** CRUD + repeat logic →
**(6)** Firebase sync → **(7)** advanced features (memo, team, notifications, PWA).

---

## 1. External dependencies (index.html `<head>`)

- **Firebase compat SDK v10.12.0**: `firebase-app-compat.js` + `firebase-database-compat.js`.
- **Pretendard v1.3.9** (variable font, primary UI font) + Google Fonts for memo editor:
  Noto Sans KR, Noto Serif KR, Nanum Gothic/Myeongjo/Pen Script, Gowun Dodum, Jua, Gaegu, Do Hyeon.
- **Open-Meteo** weather API (no key): daily forecast (16 days) + on-demand hourly.
- **Web Push (optional)** via VAPID — `const VAPID_PUBLIC_KEY=''` disables background push (local
  notifications still work).
- **No UI library.** Everything is hand-built DOM via an `el(tag, cls, props)` helper.

Required `<head>` meta: `viewport` with `viewport-fit=cover`, `theme-color=#6366f1`,
`mobile-web-app-capable`, `apple-mobile-web-app-*`, `apple-touch-icon=icon-192.png`,
`manifest=manifest.webmanifest`.

Firebase config (replace project for a new deploy):
```js
const FB_CONFIG = {
  apiKey, authDomain, databaseURL, projectId, storageBucket, messagingSenderId, appId
};
firebase.initializeApp(FB_CONFIG);
let fbDb = firebase.database();
```

---

## 2. Data model

### Task object
```js
{
  id, text, checked, starred,
  color,          // one of 7 hex colors or null
  repeat,         // 'none'|'daily'|'weekdays'|'weekly'|'biweekly'|'monthly'|'monthlyNth'|'monthlyFirstBiz'|'monthlyLastBiz'
  priority,       // 'high'(🔴)|'mid'(🟡)|'low'(🟢)|null
  time,           // "HH:MM" or null
  duration,       // minutes or null
  completions,    // { [instanceDk]: true }  — per-instance completion for repeats
  skips,          // { [instanceDk]: true }  — "skip this date only"
  subs,           // SubTask[] (max 2 levels deep)
  memo, memoImages, memoHistory, memoUpdated,  // rich memo (see §7)
  comments,       // [{id, by, text, ts}]
  // team:    fromTeam, teamRef ("teamId|originDk|taskId"), by, selfRegistered
  // sharing: sharedWith[], pending, from
  // moves:   movedFrom (dk), completedAt
}
```
SubTask: `{ id, text, checked, starred, color, completions, subs:[] }`.

### Tasks are keyed by date
`tasks[dateKey] = [Task, ...]` where dateKey = `"YYYY-MM-DD"`.

### Colors (7)
`#1a73e8 파랑 · #e53935 빨강 · #f9a825 노랑 · #43a047 초록 · #8e24aa 보라 · #fb8c00 주황 · #607d8b 회색`

### Repeat semantics
- Date-based repeats (`monthly`, `monthlyNth`, `monthlyFirstBiz`, `monthlyLastBiz`) **shift to the
  next workday** when they land on a holiday/off-day (`SHIFT_REPEAT_TYPES`).
- Weekday repeats (`weekly`, `biweekly`) are intentional weekday picks — **not** shifted (Saturday
  repeats stay on Saturday), except they shift off true holidays.
- `completions[instanceDk]` / `skips[instanceDk]` track each occurrence independently.

---

## 3. localStorage keys (all suffixed with USER_ID unless noted)

| Key constant | Holds |
|---|---|
| `calTasks_{U}` | tasks by date |
| `calOffDays_{U}` | user off-days `{dk:true}` |
| `calTrash_{U}` | deleted tasks (30-day retention) |
| `calTemplates_{U}` | task templates |
| `calMemos_{U}` | floating canvas notes |
| `calShares_{U}` | shared task lists |
| `calGoals_{U}` | goals/OKRs |
| `calIcs_{U}` | ICS subscriptions |
| `calTeamSubs_{personalId\|deviceId}` | subscribed teams (device-wide) |
| `calMyTeams_{...}` | teams entered/created (device-wide) |
| `calTeamCopied_{...}` | dedup tracker for team copies |
| (browser) | `lastUser`, `theme`, `calDeviceId`, `guideSeen`, `notifyEnabled`, `notifyMorningHour`, `notifyEveningHour`, `notifyLeadMin`, `lastNotifyDate`/`lastNotify5pm`/`lastNotifyHigh`, `sheetLastSync` |

Save pattern (all collections): write localStorage synchronously, then **debounce ~300ms** before
`ref.set()` to Firebase. Guard flags (`pendingTasksLocal` etc.) block the realtime listener from
overwriting freshly-typed local data mid-upload. On `pagehide`/`visibilitychange`, flush pending timers.

---

## 4. Global state & URL params

```js
let tasks={}, offDays={}, memos={}, shares={}, goals=[], icsSubs=[],
    teamSubs={}, myTeams={}, teamCopied={}, icsEvents={};
let currentView='week';   // 'day'|'week'|'month'|'year'|'timeline'|'focus'|'timeblock'
let weekStart, monthDate, dayDate, yearNum;
let searchQuery='', selectMode=false, bulkSelected=new Set();
let activeInput=null;     // {dateKey, parentId, dataKey} for inline add
let weatherByDate={}, weatherLoc, weatherStatus;
const USER_ID, IS_TEAM, READ_ONLY;  // derived from URL
let fbDb=null;
// render cache: _repeatCache (Map), _renderedWeekKey, _weekScroll (mobile scroll restore)
```

URL params: `?u=NAME` personal calendar · `?team=ID` shared team calendar (`IS_TEAM`) ·
`?ro=1` read-only (every mutation fn early-returns on `READ_ONLY`).

---

## 5. Initialization flow

1. Parse URL → set `USER_ID`/`IS_TEAM`/`READ_ONLY`. No user → show landing overlay (name input);
   save `lastUser`.
2. `firebase.initializeApp` → `fbDb=firebase.database()`.
3. Load + `normalizeTasks()` all local collections (seed `SEED_TASKS` for first-timers).
4. `render()` — first paint from local data.
5. `initFirebaseSync()`: `ref.once('value')` → remote wins if present, else upload local; attach
   realtime listener; `loadTeamDataFromFb()` → `syncSubscribedTeams()`.
6. `initMemoSync()`, `initOffSync()`, `rebuildIcsEvents()`.
7. Wire event listeners (nav, view buttons, search debounce, more-menu, dark toggle, modals).
8. Start notification checks on a 60s interval **and** on `visibilitychange`/`focus` (catch-up for
   throttled background timers).
9. Desktop only (`width>768`): `initDashboard()`, Monday Google-Sheets auto-sync.

---

## 6. Views & rendering

`render()` is the single orchestrator → dispatches to a builder by `currentView`:
`buildWeekView / buildDayView / buildMonthView / buildYearView / buildTimelineView(gantt) /
buildFocusView / buildTimeblockView`. Each day cell is `buildDayCol(date, ...)`; each row is
`buildTaskItem(dk, task, isSub, parentId, isRepeatInst, originDk, instanceDk, adjusted)`.

Key rendering rules:
- Collect a day's items via `tasksForDate(date)` = stored tasks (`visibleStored`) + repeat instances
  (`getRepeatTasksForDate`). Always pair these two to avoid dupes/misses.
- Mobile preserves scroll position across same-week re-renders (`_renderedWeekKey`, `_weekScroll`);
  only auto-scrolls to today on a week change.
- Badges (`👤by`, `🤝fromTeam`) render in a **separate `.task-meta` row below the text**, not inline
  (inline overflows the narrow column). Tags `#hashtag` render as a `.tag-chips` row.
- Carryover banner ("⏬ 어제 미완료 N개 가져오기") shows only when `isToday && !READ_ONLY && !holiday`.

---

## 7. Feature map (function names to recreate)

- **Task CRUD**: `addTask`, `deleteTask`, `toggleTask`, `toggleStar`, `moveTask`, `reorderTask`,
  `reorderSub`, `postponeTask`, `carryOverFrom`.
- **Repeat engine**: `getRepeatTasksForDate`, `repeatNaturalOccurs`, `isRepeatChecked`,
  `toggleRepeatInst`, `toggleRepeatSub`, `skipRepeatInstance`, `moveRepeatInstanceOne`,
  `openRepeatDel` (this-instance / all scope modal).
- **Holidays/off-days**: `HOLIDAYS` const (KR 2026–27 + substitutes), `isHoliday`, `isRestDay`,
  `isHolidayShift`, `nextWorkday`, `firstBizDay`, `lastBizDay`, `toggleOffDay`,
  `askOffDayDirection` (prev/next/none popup), `applyOffDayMove`, `restoreMovedFrom`.
- **Drag & drop**: desktop HTML5 DnD on `.task-item`; mobile `attachTaskTouchDrag` (280ms long-press
  lift, `elementFromPoint` target detection, `navigator.vibrate(15)`, `.touch-dragging` class).
- **Quick input parse**: `parseQuickDate` (내일/모레/다음주 화요일/3월 15일), `parseQuickTime`
  (business-hours heuristic: 1–7→PM, 8–12→AM; "시반"→:30; `(?!간)` lookahead to skip "N시간").
- **Memo (WYSIWYG)**: contenteditable editor with toolbar (font/size/B/I/U/S/color/highlight).
  Stored as sanitized HTML; legacy markdown auto-migrates. Images via IndexedDB
  (`idbPutImage`/`idbGetImage`, `![](local:id)`); page links `[[memoId]]`; version history (max 5);
  memo preview line on the task row; URL chips. Also a floating **canvas** mode (draggable/resizable
  sticky notes with x/y/z/w/h, pin, parent grouping).
- **Team calendar** (`?team=`): `registerTaskToTeam` (tags original with
  `fromTeam`/`teamRef`/`selfRegistered`, pushes a copy to `users/team-{id}/tasks`), `applyTeamSnapshot`
  (new→copy once via `teamCopied` dedup; updates→mirror text/color/repeat/priority/time but NOT
  completion/memo; deletions→remove mirror), `attachTeamListener`/`syncSubscribedTeams`,
  `toggleTeamSub`, `enterTeam`, `pickTeamForRegister`, `openTeamPicker`. Registering does NOT
  auto-subscribe (avoids pulling whole team).
- **Sharing & comments**: `sharedTasksFor` (read-only peer tasks via `?u=` of others), `openComments`,
  `acceptPending`/`rejectPending`.
- **Notifications** (3-tier + extras): `checkNotificationSchedule` (9AM today-summary),
  `checkTimeNotifications` (lead 30min before due), `checkEveningReminder` (5PM incomplete),
  `checkHighPriorityAlert`, `checkPendingNotifications`. `summarizeTasks` → "🔴 top-priority 외 N건이
  남아있습니다". `notify()` routes through `registration.showNotification` (SW) with `new Notification`
  fallback. De-dup via localStorage date stamps. Title badge "(n) 마이플래너".
- **ICS**: `parseICS` (VEVENT DTSTART/SUMMARY), `fetchIcsUrl` (CORS proxy fallbacks),
  `rebuildIcsEvents`. Read-only overlay events.
- **Other**: templates (`applyTemplate`), trash (30-day, `purgeOldTrash`/`restoreFromTrash`),
  goals/OKRs, dashboard stats (`buildDashStats`/`buildDashCalendar`/`calcProgress`),
  undo toast (`showUndoToast`, 6s), pomodoro, search+attr filters, backup/restore
  (`collectAllData`/`exportAllData`/`importAllData`, images base64-embedded), `renameAccount`,
  `GUIDE_SECTIONS` data-driven guide (auto-opens first visit).

---

## 8. CSS design system (styles.css)

Everything is driven by CSS custom properties on `:root` with a `[data-theme="dark"]` override.
Font stack: `'Pretendard Variable', Pretendard, -apple-system, 'Apple SD Gothic Neo', 'Malgun Gothic',
sans-serif`; global `letter-spacing:-.01em`, antialiased.

### Light tokens
```
--bg #f3f5f8  --surface #ffffff  --surface2 #f4f6f9  --surface3 #e8ecf1
--border #e4e8ee  --border2 #eef1f5
--text #2a3342  --text2 #5b6678  --text3 #6b7280
--primary #5b6cf0  --primary-h #4856d8  --primary-l #eef0fe
--green #16a37a  --red #e35454  --orange #ee8434  --yellow #e8a521
--shadow    0 1px 3px rgba(35,45,65,.05), 0 1px 2px rgba(35,45,65,.04)
--shadow-md 0 4px 8px rgba(35,45,65,.07), 0 2px 4px rgba(35,45,65,.05)
--shadow-lg 0 12px 24px rgba(35,45,65,.1), 0 4px 8px rgba(35,45,65,.05)
```
### Dark tokens (`[data-theme="dark"]`)
```
--bg #14181f  --surface #1d232c  --surface2 #272f3a  --surface3 #14181f
--border #333c49  --border2 #232a34
--text #e6eaf0  --text2 #9aa6b5  --text3 #8a94a6
--primary #8b97f5  --primary-h #6d7bee  --primary-l #262b48
--green #2cb893  --red #e57373  --orange #ef9a55  --yellow #e0b13e
--shadow* use rgba(0,0,0,.3/.4/.5)
```
Subtle tints use `color-mix(in srgb, var(--X) N%, transparent)` (weekend 3–5% red; priority 9–20%).

### Layout
- **Week grid** (`.calendar-grid`): desktop `grid-template-columns: repeat(6, minmax(150px,1fr))`,
  gap 8px, min-width 940px. 6 columns = Mon–Fri (1 each) + one **weekend column** stacking Sat/Sun.
  `.day-col` radius 16px, min-height 560px.
- **Tablet 769–1059px**: 3 columns. **Mobile ≤768px**: flex row, each card `width:82vw`,
  `scroll-snap-align:center`, `scroll-snap-type:x mandatory`, `padding-inline:9vw`. **≤380px**: 90vw / 5vw.
- Other views: `.day-view-wrap` (max 620px), `.focus-wrap` (680px), `.year-grid`
  (`repeat(4,1fr)`, mini 7×7), `.month-grid` (`repeat(7,1fr)` weeks, cell min-height 100px),
  `.gantt-*` (sticky name col, `.gantt-bar` 12px tall), `.dashboard` (`1fr 1fr`, desktop only).
- **Header** `.header`: sticky, 60px, `backdrop-filter:blur(10px)`, `color-mix` translucent surface.
  `.view-btn.active` = primary bg. `.icon-btn` 32×32. `.save-btn` primary. Mobile: wraps, hides
  button label text, enlarges touch targets.

### Component notes
- `.task-cb` 16×16 (mobile 24), green+`✓` when `.checked`, `.cb-pop` scale animation (only the
  toggled box).
- `.task-meta` flex-wrap row under text holding `.task-by` (surface3) / `.task-fromteam` (primary-l,
  weight 600, ellipsis). `.time-badge` red when overdue.
- `.carryover-banner` dashed orange, `color-mix` bg.
- Modals: `.modal-overlay` (blur backdrop, z 500) + `.modal-box` (radius 20, 340px; mobile
  full-width). `.memo-popup` draggable/resizable, mobile → bottom sheet.
- Accessibility: `:focus-visible` 2px primary outline; `@media (prefers-reduced-motion)` kills
  animations; `@media print` hides chrome and avoids page-breaking day columns.

---

## 9. PWA & infra

- **sw.js**: cache name `'myplanner'` (fixed — network-first means no manual version bumps).
  `install` pre-caches `./ index.html styles.css app.js icon.svg icon-192/512/512-maskable.png
  manifest`. `activate` deletes other caches + `clients.claim()`. **Network-first** for same-origin
  GET (cache on success, fall back to cache, then `index.html` for navigations); skips cross-origin
  (Firebase/fonts). `push` handler → `showNotification`. `notificationclick` → focus existing window
  or open `./`.
- **manifest.webmanifest**: `name/short_name "마이플래너"`, `display standalone`, `start_url ./`,
  `theme_color #6366f1`, `background_color #f8fafc`, icons 192/512/512-maskable + svg.
- **firebase-rules.json**: public read/write under `users`, `teamDirectory`, `userDirectory`
  (no auth — do not store sensitive data).
- **push-sender/** (optional): `send.js` uses `web-push@^3.6.7`; reads users via Firebase REST,
  sends due-soon (non-repeat timed tasks within `leadMin`, default 30) + once-daily morning summary
  (`morningHour`, default 9); dedups via `pushState.{uid}`; prunes 404/410 subs. Env: `DB_URL`,
  `VAPID_PUBLIC`, `VAPID_PRIVATE`, `VAPID_SUBJECT`. `.github/workflows/push.yml` runs it on
  `cron: */5 * * * *` + `workflow_dispatch`, Node 20, `npm install --omit=dev`.

---

## 10. Recreation gotchas (lessons already learned)

- Render repeat instances by passing **`originDk`** (not the display `dk`) for subtask/memo data
  targeting, or checkboxes/memos hit the wrong record.
- Progress counters must include repeat instances via `isRepeatChecked(task, instanceDk)`.
- Keep team/registered-author **badges on their own `.task-meta` row** — inline badges overflow the
  narrow day column.
- `parseQuickTime` must use a `(?!간)` negative lookahead so "3시간"(duration) ≠ "3시"(o'clock).
- Guard **every** mutation behind `READ_ONLY`.
- Global keyboard shortcuts must ignore `INPUT/TEXTAREA` **and** `contenteditable` (memo editor),
  but let `Escape` through.
- Mobile: don't reset scroll on check/star — only auto-scroll on week change.
- Team register should **not** auto-subscribe (would flood personal calendar with the whole team).

---

## Deploy

Commit the three files + assets to the `gh-pages` branch; GitHub Pages serves the root. Because the
SW is network-first, a normal reload picks up changes (hard-refresh / app restart if a client is
serving a stale cache). No bundler, no install step.
