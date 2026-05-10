# 디자인 Playbook — Apple/Linear 미니멀 스타일

대상: Cowork 환경에서 본 대시보드를 더 프로페셔널하게 디자인하기
작성: 2026-05-11 (v5.41 base)

---

## 0. 한 눈에 보기

```
[1단계] 현재 디자인 진단         → 무엇이 부족한지 알아내기
[2단계] 디자인 토큰 정비         → CSS 변수 (색·폰트·간격) 5분 작업
[3단계] 컴포넌트 단위 개선       → KPI 카드·테이블·탭 한 개씩
[4단계] 레이아웃 + 여백 정리     → 화면 호흡감
[5단계] 모션 + 디테일            → 마우스 hover, transition
[6단계] 인쇄 모드 별도 점검      → PDF 출력용 디자인
```

각 단계마다 **복사해서 그대로 사용할 프롬프트**를 제공합니다.

---

## 1. 현재 디자인 진단

### 좋은 점 (이미 Linear/Apple 스타일 기반)

✅ System font stack (`-apple-system, SF Pro KR, Pretendard`)
✅ Light background (`#fafbfc` — Apple-스러운 거의 흰색)
✅ Subtle shadows (`box-shadow:0 1px 3px rgba(...)`)
✅ 8px border-radius (modern)
✅ Tabular numerics (`font-variant-numeric:tabular-nums`)
✅ 단일 accent color (#0969da blue)

### 개선 여지 (Apple/Linear 차이)

❌ **색깔이 GitHub Primer 풍** (파랑 #0969da, 보라 #8250df) — Linear는 더 절제됨
❌ **타이포 위계가 약함** — h1=20px, h2=15px, h3=13.5px (차이 작음). Apple은 큰 차이 선호
❌ **여백이 빡빡함** — panel padding 18-20px, 카드 간 14-16px. Apple/Linear는 32-48px 여유
❌ **score color 5단계가 너무 화려** (#1a7f37 ~ #a40e26) — Linear는 무채색 + 1색 강조
❌ **Hover/transition 없음** — Linear의 sleek 느낌은 100ms transition에서 옴
❌ **Empty state 평범** — "—" 만 표시. Apple은 일러스트 또는 안내문

---

## 2. 단계별 워크플로우

### 2-1. 디자인 토큰 정비 (5분)

가장 먼저 — CSS 변수 (`src/style.css` 첫 13줄) 만 손보면 전체 톤이 바뀝니다.

**Cowork에서 사용할 프롬프트:**

```
src/style.css 의 :root CSS 변수를 Linear/Apple 미니멀 스타일로 다시 디자인해주세요.

요구사항:
- 배경: 더 차분한 off-white (현재 #fafbfc 유지 또는 #fafafa)
- 텍스트: pure black 피하기, #0a0a0a 또는 #18181b 권장
- 단일 accent color 만 사용 (현재 두 개 — 파랑 + 보라 → 하나로 통일)
  · Linear 스타일이라면 #5e6ad2 (Linear 보라) 또는 검은색만 강조
- 점수 5단계 (s1~s5): 채도 낮게 — 무채색 그라데이션 + 위험 1~2개만 빨강
- 회색 스케일 6단계 추가 (--gray-50 ~ --gray-900) — Tailwind 풍

기존 변수 이름 (--bg, --panel, --text 등) 유지해 다른 코드 깨지지 않게.
변경사항을 표로 정리해서 보여주고 적용 확인 후 진행해주세요.
```

### 2-2. 타이포 위계 강화 (10분)

Apple/Linear 의 핵심 비밀 — **헤드라인은 크게, 본문은 작게, 차이를 명확히**.

**프롬프트:**

```
src/style.css 의 타이포 시스템을 강화해주세요.

현재:
- header h1: 20px
- panel h2: 15px
- panel h3: 13.5px
- body: 14px

목표 (Apple Human Interface 기반):
- 페이지 타이틀: 28-32px, weight 600, letter-spacing -0.02em (negative tracking — 큰 글씨에서 답답함 해소)
- 섹션 헤더: 18-20px, weight 600
- 카드 헤더: 14-15px, weight 600
- 본문: 14px (그대로), line-height 1.5
- caption/label: 12px, weight 500, color: var(--muted)
- KPI value: 32-36px, weight 600, tabular-nums (현재 24px → 더 크게)

font-feature-settings: "ss01", "cv11" 추가 (SF/Pretendard 의 modern figures 활성화).

파일은 자동 수정하지 말고, 변경할 selector + before/after 표로 먼저 보여주세요.
```

### 2-3. 여백 + 그리드 정리 (15분)

Apple 디자인의 비결 — **여백이 콘텐츠보다 중요**.

**프롬프트:**

```
src/style.css 의 spacing 을 Apple/Linear 풍으로 풀어주세요.

원칙: 8px grid (8, 16, 24, 32, 48, 64).

현재 빡빡한 곳:
- main padding: 22px 28px → 32px 48px
- panel padding: 18px 20px → 24px 28px
- panel margin-bottom: 16px → 24px
- grid gap: 14px → 20px
- KPI padding: 14px 16px → 20px 24px
- header padding: 18px 28px → 24px 48px

추가:
- max-width: 1500px → 1280px (Linear 풍, 양쪽 여백 확보)
- 작은 화면 (< 1100px) 에서는 padding 자동 축소 (clamp 활용)

CSS 변수로 --space-1 ~ --space-12 정의해 일관성 부여.
변경 적용 후 dashboard.html 빌드해서 시각적 확인까지 부탁드립니다.
```

### 2-4. 컴포넌트 단위 개선 (가장 임팩트 큼)

전체 레이아웃 손대지 말고 **개별 컴포넌트** 만 단계적으로 개선.

#### A. KPI 카드 (가장 눈에 띄는 곳)

**프롬프트:**

```
src/index.html 의 Tab 1 KPI 카드 4개 (#kpi-progress, #kpi-velo, #kpi-score, #kpi-risk) 를
Apple 스타일로 리디자인해주세요. style.css 의 .kpi 클래스 갱신.

현재:
[label] [value] [delta]
"측정 진행 (1차)" / "—" / "선수 × {...}"

목표 (Linear / Stripe Dashboard 스타일):
- label: uppercase 제거, sentence case ("측정 진행" 그대로)
- value: 32-36px, weight 600
- delta: 작은 배지 + 추세 (▲ 또는 ▼ 화살표)
- 카드 hover 시 subtle highlight (border-color 변화 100ms transition)
- 카드끼리 구분선 — border 대신 미세한 그림자 + 배경 panel2 차이만으로

변경 후 src/index.html 의 KPI 마크업도 일관되게 수정 + dashboard.html 빌드.
```

#### B. 히트맵 테이블 (Tab 1 주요 시각 자산)

**프롬프트:**

```
src/style.css 의 table.heatmap 클래스를 더 차분한 스타일로 다시 만들어주세요.

현재 5단계 색깔 (s1~s5) 이 너무 채도 높음 — Linear / Datadog 풍으로:
- s5 (최고): var(--gray-900) 검정 + 흰 글씨
- s4: var(--gray-700)
- s3: var(--gray-500)
- s2: var(--accent) 색깔 (예: 빨강) 채도 낮게
- s1 (최저): var(--bad) 짙게

또는 더 sleek 한 옵션 — **모노크롬 + 1색 강조**:
- s1~s5 모두 같은 hue (예: 파랑) 의 명도 차이만 5단계
- 현재 형광에 가까운 빨강·녹색 모두 제거

행 hover 시 row highlight (background var(--panel2)) + tabular-nums 유지.

before/after 비교 스크린샷 위해 dashboard.html 빌드까지 부탁드립니다.
```

#### C. 탭 네비게이션

**프롬프트:**

```
src/style.css nav.tabs 를 Apple Notes / Linear 풍으로 리디자인.

현재: border-bottom 2px 로 active 표시 (GitHub 스타일).

목표:
- 탭 전체에 미세한 segmented control 컨테이너 (rounded background)
- active 탭: 흰 배경 + subtle shadow (Apple Settings 스타일)
- inactive 탭: 투명 배경 + var(--muted) 글씨
- 100ms transition (background-color + box-shadow)
- 작은 숫자 배지 (.num) 디자인도 더 미니멀 — pill 모양 + 단색
```

### 2-5. 인쇄 모드 (PDF 출력) 별도 점검

**프롬프트:**

```
@media print 영역 점검해주세요. 현재 reports_init.js 가 PDF 출력 담당.

요구사항:
- A4 1페이지에 깔끔하게 (margin 15mm)
- KPI value 폰트 더 크게 (인쇄 시 작게 보임)
- 색깔 → 흑백 친화 (heatmap s1~s5 색을 명도로 자동 변환, CSS color-adjust: exact 활용)
- 페이지 break 명시 (.panel { break-inside: avoid })
- 헤더 logo + 페이지 번호

scripts/build_individual_report.js 로 단일 선수 PDF 생성 후 확인.
```

---

## 3. Cowork 효과적 프롬프트 템플릿

### 3-1. 디자인 reference 공유법

스크린샷 활용 — **Apple Notes / Linear / Stripe** 스크린샷 1~2장 넣고:

```
이 스크린샷 [첨부] 의 디자인 언어를 src/style.css 에 적용하고 싶습니다.

특히 이 부분이 좋아 보입니다:
- (스크린샷에서 가리키며) 이 카드의 padding 과 그림자
- 이 헤더의 폰트 사이즈 비율 (제목 vs 부제)
- 이 색깔 팔레트 (3개만 사용)

src/style.css 와 src/index.html 둘 다 보고, 어디를 어떻게 수정할지
변경 목록부터 보여주세요. 적용은 제가 OK 한 다음에 진행.
```

### 3-2. 단계별 검토 요청

큰 변경은 한 번에 하지 말고:

```
v5.41 → v5.42 디자인 개선을 진행하려 합니다.
한 번에 한 단계씩 — 다음 5단계 계획만 먼저 보여주세요:
1) 디자인 토큰 (색·폰트·간격 변수)
2) 타이포 위계
3) KPI 카드
4) 히트맵 테이블
5) 탭 네비게이션

각 단계 OK 받은 다음에만 다음 진행. 빌드 + 스크린샷 캡처도 단계별로.
```

### 3-3. 변경 미리보기 요청

코드 수정 전:

```
변경 적용 전, 다음을 알려주세요:
1. 어떤 파일·selector 를 수정?
2. before/after CSS 비교 (코드 블록)
3. 시각적 영향 — 어떤 화면이 어떻게 바뀌는지 한 줄씩
4. 부작용 가능성 (다른 페이지 깨질지)

OK 받으면 적용 + node scripts/build_dashboard.js 빌드 후 결과 알려주세요.
```

### 3-4. 인터랙티브 design 시안 요청

여러 옵션을 빠르게 보고 싶을 때 — Cowork 의 artifact 기능 활용:

```
KPI 카드 디자인 시안 3개를 HTML 단일 파일로 만들어서 보여주세요.
시안 A: Linear 풍 (모노크롬 + 보라)
시안 B: Stripe 풍 (이모지 아이콘 + 명도 차이)
시안 C: Apple Health 풍 (가로 막대 차트 통합)

같은 페이지에 3개 나란히 배치 + 데모 데이터 (구속 92.4 km/h, 종합 73점 등).
파일 저장 후 브라우저로 열어 결정.
```

---

## 4. 디자인 reference 자료

### 4-1. Linear (강추)
- 홈: https://linear.app/
- 디자인 시스템: https://vercel.com/geist/colors (Linear 만든 팀)
- 핵심 학습 포인트: 단일 accent (#5e6ad2), 절제된 회색, subtle 모션

### 4-2. Apple Human Interface Guidelines
- HIG: https://developer.apple.com/design/human-interface-guidelines/
- 핵심: typography (SF Pro), color (System Gray), motion (ease-out 200ms)

### 4-3. Stripe Dashboard (data 시각화 참고)
- https://stripe.com/docs/dashboard
- 핵심: KPI 카드, 차트 색깔 (4색만), 표 디자인

### 4-4. Vercel / Geist
- https://vercel.com/geist
- 오픈소스 디자인 시스템 — CSS 변수 그대로 차용 가능

### 4-5. 한글 친화적 폰트
- **Pretendard** (이미 fallback 에 있음) — Apple SD Gothic Neo 보다 더 sleek
- **Spoqa Han Sans Neo** — 약간 더 corporate
- **Wanted Sans** (한글 가변 폰트 — 2024) — 가장 modern

설치 권장:
```html
<!-- src/index.html head 에 추가 -->
<link href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css" rel="stylesheet">
```

---

## 5. 흔한 함정 (피해야 할 디자인)

❌ **너무 많은 색깔** — Linear 는 색깔 6개 미만 (회색 5단계 + 1 accent)
❌ **모든 카드에 그림자** — Apple 은 그림자 없음 / 1px line + 명도 차이만
❌ **Border-radius 과도** — 12px 이상은 cute, 8px 가 professional
❌ **너무 두꺼운 글씨** — bold (700) 대신 semibold (600)
❌ **이모지 남용** — Tab 라벨 등 instructional 영역에만, 데이터 영역 X
❌ **gradient 배경** — Linear/Apple 모두 사용 안 함, 단색 + 명도 차이
❌ **animation 과도** — 100~200ms transition 만, 0.5s+ 는 답답

---

## 6. 작업 우선순위 (성능 대비 효과)

| 단계 | 효과 | 시간 | 추천 순서 |
|---|---|---|---|
| 디자인 토큰 정비 | ⭐⭐⭐⭐⭐ | 5분 | 1순위 |
| 타이포 위계 | ⭐⭐⭐⭐⭐ | 10분 | 2순위 |
| 여백 + 그리드 | ⭐⭐⭐⭐ | 15분 | 3순위 |
| KPI 카드 | ⭐⭐⭐⭐ | 20분 | 4순위 |
| 히트맵 테이블 | ⭐⭐⭐ | 20분 | 5순위 |
| 탭 네비게이션 | ⭐⭐ | 10분 | 6순위 |
| 인쇄 모드 | ⭐⭐⭐ | 30분 | 7순위 |
| 모션/transition | ⭐⭐ | 15분 | 8순위 |

**1+2+3 만 해도 80% 임팩트** — 25분 투자로 메인 변신.

---

## 7. 작업 세션 시작 명령 (복사용)

이 가이드 보고 작업 시작할 때:

```
DESIGN_PLAYBOOK.md 읽었습니다. v5.42 디자인 개선 시작합니다.

먼저 현재 dashboard.html 스크린샷 캡처해서 before 상태 docs/screenshots/v5.41_before/ 에 저장해주세요.
- Tab 1 (1차 측정 결과)
- Tab 2 (선수별 리포트, TestPlayer)
- Tab 4 (인쇄 모드)

그 다음 §2-1 디자인 토큰부터 진행 — 현재 :root CSS 변수 분석 + Linear 풍 변경 제안.
변경 표 OK 후에만 적용. 빌드는 한 단계마다.
```

---

## 8. 검증 체크리스트 (단계마다)

각 디자인 단계 마무리 후 확인:

- [ ] dashboard.html 빌드 성공 (`node scripts/build_dashboard.js`)
- [ ] 모든 Tab (1·2·4·5) 정상 렌더링
- [ ] PDF 인쇄 미리보기 깨지지 않음
- [ ] 1100px 화면에서 layout 깨지지 않음
- [ ] 한글 폰트 깨끗하게 (특히 b/숫자 혼용)
- [ ] before/after 스크린샷 docs/screenshots/ 에 보관
- [ ] git commit (단계별 — 디자인 변경은 작은 commit 권장)

---

## 9. 디자인 commit 메시지 예시

```bash
# 토큰 변경
git commit -m "design(tokens): Linear 풍 단일 accent + 무채색 6단계"

# 타이포
git commit -m "design(typography): 위계 강화 (제목 32px, KPI value 36px)"

# 여백
git commit -m "design(spacing): 8px grid + max-width 1280px"

# 컴포넌트
git commit -m "design(kpi): 카드 hover transition + delta 추세 화살표"
git commit -m "design(heatmap): 채도 낮춘 5단계 + row hover"
```

이 작은 commit 들이 나중에 디자인 회귀 디버깅 시 매우 유용합니다.

---

**문의**: kklee@kookmin.ac.kr
**저장소**: https://github.com/kkl0511/Dashboard_Pitching_Team
**버전**: v5.41 base · 2026-05-11
