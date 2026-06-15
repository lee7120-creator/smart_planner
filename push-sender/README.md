# 백그라운드 푸시 (무료) 설정

앱을 닫아도 알림이 오게 하는 구성입니다. **Web Push + GitHub Actions(무료)** 를 씁니다.
(Firebase Blaze/유료 불필요. 단, GitHub Actions cron은 약 5분 간격·수 분 지연 가능, iOS는 홈 화면에 설치한 PWA + iOS 16.4↑ 에서만 동작)

## 1) VAPID 키 생성 (1회)
터미널에서:
```bash
npx web-push generate-vapid-keys
```
출력된 **Public Key / Private Key** 를 복사.

## 2) 앱에 공개키 넣기
`app.js` 의 다음 줄에 Public Key를 붙여넣고 배포:
```js
const VAPID_PUBLIC_KEY = '여기에_PUBLIC_KEY';
```

## 3) GitHub 시크릿 등록
레포 **Settings → Secrets and variables → Actions → New repository secret** 에서:
- `VAPID_PUBLIC` = 위 Public Key
- `VAPID_PRIVATE` = 위 Private Key
- `VAPID_SUBJECT` = `mailto:본인이메일`

## 4) 워크플로 활성화
- `.github/workflows/push.yml` 이 **기본 브랜치(default branch)** 에 있어야 cron이 돕니다.
  (이 레포의 기본 브랜치에 머지하세요. Actions 탭에서 "백그라운드 푸시 발송" 활성화 확인)
- 처음엔 Actions 탭 → 해당 워크플로 → **Run workflow** 로 수동 테스트 가능.

## 5) 사용자 쪽
앱에서 **더보기 → 마감 알림** 을 켜면(권한 허용) 자동으로 푸시 구독이 Firebase에 저장됩니다.
이후 앱을 닫아도 마감 임박/아침 요약 알림이 옵니다.

## 동작 범위 (v1)
- ✅ 시간지정·비반복 태스크의 **마감 임박**(설정한 분 전)
- ✅ **아침 요약**(설정한 시각 이후 1회, 오늘 미완료 개수)
- ⛔ 반복 일정 푸시는 아직 미포함(추후 확장 가능)

## 비용/주의
- GitHub Actions: 공개 레포 무료, 비공개도 월 2000분 무료(이 작업은 회당 수십 초).
- Firebase: 현재 공개 읽기/쓰기 규칙 기준으로 REST 접근. (규칙을 잠그면 발송기에 인증 토큰 추가 필요)
- 사용자 데이터(할 일/구독)를 GitHub Actions 실행 환경에서 읽습니다.
