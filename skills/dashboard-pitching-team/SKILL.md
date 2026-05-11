---
name: dashboard-pitching-team
description: 상동고 투수 대시보드 프로젝트 전용 작업 가이드. 파일 구조·좌표계 변환·Force Plate 컨벤션·PAT 기반 git 워크플로우·sample 검증·코치 친근 언어 등 이 프로젝트 특유 규칙. https://github.com/kkl0511/Dashboard_Pitching_Team 저장소에서 작업 시 자동 trigger.
---

# 상동고 투수 대시보드 — 작업 가이드

국민대 스포츠과학과 (이기광 교수) 의 상동고 투수 메카닉 분석 대시보드.
바이오메카닉스 측정 (Theia 마커리스 + Force Plate + ForceDecks + Rapsodo) → Visual3D pipeline → c3d.txt export → 웹 대시보드 시각화 흐름.

## 핵심 컨벤션 (영구)

### Force Plate 매핑
- **FP1 = 앞발 (lead foot)**
- **FP2 = 뒷발 (drive foot)**
- V3D Manual 은 반대로 적혀있지만 실제 측정은 위와 같음. 절대 헷갈리지 말 것.

### V3D ↔ Driveline 좌표계 변환
- V3D 좌표축: X+ = 3루, Y+ = 홈, Z+ = 위
- Driveline 모델은 다른 좌표계 — **Trunk rotation 계열만** `(90 − V3D값)` 변환 필요
- 다른 변인 (각속도, GRF, etc.) 은 변환 불요

### 우완/좌완 자동 감지
- c3d.txt 업로드 파일에서 자동 감지 (어깨 외전 부호 기반)
- LHP 일 경우 마네킹 SVG 좌우 반전 (`transform:scaleX(-1)`)

## 파일 구조

```
Dashboard_Pitching_Team/
├── index.html                 # 모드 선택 (코치 / 분석가)
├── coach.html                 # 71줄 (HTML 구조만)
├── dashboard.html             # ~10500줄 (분석가용, 점진적 리팩토링 중)
├── dashboard_mobile.html      # 모바일 분석가용 (legacy)
├── dashboard_pro.html         # Pro 디자인 시안 (legacy)
├── css/
│   ├── coach.css              # 코치용 스타일
│   └── dashboard.css          # 분석가용 스타일 (767줄)
├── js/coach/                  # 코치 페이지 모듈 (refactored)
│   ├── helpers.js             # $, computeDvl5, gradeOf, hex2rgba 등
│   ├── variable-info.js       # VAR_INFO·ETE_INFO·RX_MAP·computeTop3
│   ├── sequence-chart.js      # 키네매틱 시퀀스 (3 종 모양 + 발광 점)
│   ├── posture-mannequin.js   # 마네킹 (Foot Strike pose + leak burst)
│   ├── fitness-radar.js       # HP 6축 레이더
│   ├── rapsodo-cards.js       # FB 카드 (구속·회전·무브·Stuff·Command)
│   ├── player-detail.js       # Tab 2 (선수별)
│   ├── team-overview.js       # Tab 1 (팀 현황)
│   ├── long-term-trend.js     # Tab 3 (장기 추적)
│   └── app.js                 # 메인 + 탭 + iframe bridge
├── scripts/                   # Node 빌드/검증 스크립트
│   ├── build_v3d_design_spec_v2.js
│   ├── verify_sample_against_parser.js
│   └── ...
├── sample_data/
│   └── V3D_Reference_Sample_RHP_complete.c3d.txt  # reference (1.6MB, 63 컬럼)
├── assets/
│   └── kinetic_chain.gif
└── V3D_Pipeline_Design_Spec_v2.0_확정판.docx  # 연구원용 파이프라인 지침
```

## 코치 ↔ 분석가 데이터 공유

코치 페이지는 데이터 입력 없음. 흐름:
1. 분석가 → dashboard.html → c3d.txt 업로드 → localStorage 저장
2. coach.html 의 hidden iframe 으로 dashboard.html 로드
3. `WIN.PLAYERS / WIN.DATA / WIN.ANALYTICS` 사용

```html
<iframe id="data-iframe" aria-hidden="true"></iframe>
<script>document.getElementById('data-iframe').src = 'dashboard.html?embed=coach&_=' + Date.now();</script>
```

`?embed=coach` 쿼리 = dashboard.html 에서 분석가용 UI 숨김 트리거.

## PAT 기반 git 워크플로우 (중요)

GitHub Desktop GUI 클릭 (~70초/cycle) 대신 PAT 기반 git CLI (~1.5초/cycle) 사용.
PAT 는 `/tmp/dashboard_repo` clone 의 remote URL 에 이미 embed:

```bash
cd /tmp/dashboard_repo
cp -r "/sessions/.../mnt/상동고 투수 대시보드/Dashboard_Pitching_Team/css" .
cp -r "/sessions/.../mnt/상동고 투수 대시보드/Dashboard_Pitching_Team/js" .
cp ".../coach.html" .
git add -A
git -c user.email=kklee@kookmin.ac.kr -c user.name="kkl0511" commit -m "feat: ..."
git push origin main
```

## 라이브 검증

GitHub Pages 자동 배포 (push 후 ~30-60초). 캐시 회피 query string:
```
https://kkl0511.github.io/Dashboard_Pitching_Team/coach.html?v=N
```

빌드 상태 API:
```bash
curl -s -H "Authorization: token $PAT" \
  "https://api.github.com/repos/kkl0511/Dashboard_Pitching_Team/pages/builds/latest"
```

## Sample 데이터 검증

수정 후 `scripts/verify_sample_against_parser.js` 로 33/33 변인 통과 확인:
```bash
node scripts/verify_sample_against_parser.js
# 기대: ✅ 33/33 variables populated
```

## 코치 친근 언어 가이드

코치 페이지 (coach.html) 에서는 학술 용어 금지. 변환 표:

| 학술어 | 친근 언어 |
|---|---|
| 분절 시퀀스 정합성 | 회전 흐름 — 누가 먼저 빨라지는가 |
| 키네틱 체인 / proximal-distal | 힘이 발 → 골반 → 몸통 → 손으로 흐름 |
| Composite Mechanics | 5가지 영역 점수 |
| Layback / Scap Retraction | 어깨 젖힘 / 견갑 모음 |
| 측정 구속 / 잠재 구속 | 오늘 구속 / 목표 구속 |
| 정의 / 의미 / 진단 | 이게 뭐냐면 / 왜 중요해 / 지금 상태 |
| 골반→몸통 leak | 엉덩이→몸통 힘 새는 중 |
| transition / lag | 넘김 / 타이밍 차이 |
| Stuff / Command | 구질 종합 / 제구 |

분석가 페이지 (dashboard.html) 에서는 학술 용어 그대로 OK.

## 코치 페이지 7단계 흐름 (선수별 탭)

```
1. 오늘의 폼      메카닉 5영역 + Composite donut
2. 공의 질        랩소도 (구속·회전·무브·Stuff·Command)
3. 체력           HP 6축 레이더 (Driveline HP Composite)
4. 힘 흐름        다이나믹 마네킹
5. 고칠 곳        키네매틱 시퀀스 차트 + Top 3 변인
6. 훈련 처방      drill + 선수에게 말할 cue + 코치 관찰 포인트
7. 설명 가이드    자동 생성 talking script
```

## 주의사항

- **차트 색상**: Chart.js Canvas 는 `var(--*)` CSS 변수 못 받음 → 항상 hex 직접 사용
- **사용자 = 코딩 초보자**: 단순한 패턴 유지. 빌드 도구·모듈 번들러 사용 금지
- **3 dashboard HTML** (`dashboard.html` / `dashboard_mobile.html` / `dashboard_pro.html`) 부분 코드 중복. 한 곳 수정 시 다른 곳 확인
- **메모리 파일** 의 FP convention + 좌표계 변환은 절대 잊지 말 것
- **사용자 선호**: 다크 모드 X (모든 페이지 라이트), 학술용 X (코치 친근 언어 우선)
- **레이아웃 변경 시** 항상 모바일/iPad 반응형 확인 (`@media (max-width:640px)`)

## 메모리 파일 위치

`~/Library/Application Support/Claude/local-agent-mode-sessions/.../memory/`
- `project_force_plate_convention.md` — FP1=앞발, FP2=뒷발
- `project_v3d_driveline_coord_systems.md` — 좌표계 변환

## 워크플로우: 새 기능 추가 시

1. AskUserQuestion 으로 요구사항 명확화 (특히 친근 언어 vs 학술 언어)
2. 어느 페이지인지 확인 (coach / dashboard)
3. coach 페이지면 `js/coach/<적절한모듈>.js` 에서 작업
4. dashboard 페이지면 dashboard.html 에서 작업 (TODO: 점진적 리팩토링)
5. 문법 검증 (`node --check` + `python3 HTMLParser`)
6. PAT git 으로 commit/push
7. ~60초 대기 후 라이브 검증 (`curl + ?v=N`)
