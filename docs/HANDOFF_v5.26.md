# 상동고 대시보드 v5.26 — Handoff

> **새 대화에서 이 파일부터 읽으세요.** 다음 한 줄로 컨텍스트 복원:
> ```
> Read docs/HANDOFF_v5.26.md
> ```

## 0. 한 줄 요약

상동고 20명 투수 4회 측정 통합 대시보드. **Driveline Pitching Assessment 5축 + Driveline HP Assessment 6축 + 우리식 ELI 누수 분석** 통합. v5.26에서 **render.js (2,458줄) → 5개 모듈로 분리** 완료. 빌드 결과 dashboard.html은 변동 없음 (banner comment만 +167 bytes).

## 1. 현재 dashboard 구조 (5 섹션)

| 섹션 | 카드 | 출처 |
|---|---|---|
| **§1 현재 상태** | 헤더 KPI (실측·체력 향상·메카닉 천장·통합 향상) | OBP fitness model + Driveline ceiling |
| **§2 체력 (HP)** | HP Composite 6축 라디아 + Asymmetry 별도 카드 + Velo Group cohort 비교표 | Driveline HP Assessment |
| **§3 메카닉** | §3-1 Driveline 5축 라디아 · §3-2 시간축 · §3-3 에너지·파워 · §3-4 지면반력 · §3-5 ELI 6 zone · §3-6 Action Plan | Driveline + 우리식 |
| **§4 결과** | 향상 시나리오 비교 | Combined model |
| **§5 종합 권장** | Bigger Lever 진단 | analytics |

## 2. 파일 구조 (v5.26 render 분리 후)

```
Dashboard_Pitching_Team/
├── src/
│   ├── index.html                  (1,028 lines — 5 섹션 골격)
│   ├── style.css
│   └── js/
│       ├── driveline.js            (369 lines) — Driveline 5+6축 framework (v5.25)
│       ├── analytics.js            (2,228 lines) — OBP velocity, fitness, mechanic 분석
│       ├── data.js                 (403 lines)
│       ├── render_m1.js            (289 lines) ★ v5.26 — §3 TAB 1 종합 (M1 KPI/Grid/Table/Heatmap/Charts)
│       ├── render_player.js        (579 lines) ★ v5.26 — §4 TAB 2 진입 + renderPlayerView
│       ├── render_player_cards.js  (1,134 lines) ★ v5.26 — v5.14 카드 렌더러 (메카닉 5축, 체력 6축, ELI, Action Plan)
│       ├── render_long.js          (263 lines) ★ v5.26 — §5 TAB 3 + §6 TAB 4 (roster, 반기 비교, 장기 추적)
│       ├── render_common.js        (193 lines) ★ v5.26 — chartOpts, switchTab, 이벤트, genMeasurementsFor
│       ├── render.js.bak_v5.25     (백업 — 안전 후 삭제 가능)
│       ├── io.js                   (1,248 lines) — c3d.txt 파서, FD CSV 파서
│       ├── reports_init.js         (452 lines)
│       └── svg_chart_stub.js       (158 lines) — 모바일용
├── scripts/
│   ├── build_dashboard.js          ★ v5.26: JS_MODULES 배열에 render_* 5개 등록
│   ├── process_pitching_session.py (874 lines) — Theia c3d.txt 일괄 처리
│   └── build_coach_deck.js
├── docs/
│   ├── HANDOFF_v5.0.md
│   ├── HANDOFF_v5.25.md
│   ├── HANDOFF_v5.26.md  ← 이 파일
│   └── references/
│       ├── Driveline_PitchingAssessment_{EN,KR}_sample.pdf
│       └── Driveline_HP_Assessment_{Initial,Retest}_sample.pdf
└── dashboard.html                  (456KB · 빌드 결과물 — 직접 편집 X)
```

**중요: dashboard.html 직접 편집 금지**. 항상 `src/` 편집 후 `node scripts/build_dashboard.js`.

**모듈 합성 순서 (build_dashboard.js JS_MODULES)**:
```
driveline → analytics → data
  → render_m1 → render_player → render_player_cards → render_long → render_common
  → io → reports_init
```

## 3. 자주 쓰는 명령어

```bash
# 디렉토리 진입
cd "/Users/kikwanglee/Documents/Claude/Projects/상동고 투구 리포트/Dashboard_Pitching_Team"

# 빌드
node scripts/build_dashboard.js

# Theia c3d.txt 일괄 처리 (선수별 trial 평균 추출)
python3 scripts/process_pitching_session.py

# 단일 trial 검증 (Driveline 변인 확인)
python3 -c "
import sys; sys.path.insert(0, 'scripts')
from process_pitching_session import parse_theia_trial
t = parse_theia_trial('sample_data/2026-05-15_1차측정/01_theia/P01_LYH/Fastball RH Markerless 1.c3d.txt')
print({k:v for k,v in t.items() if 'cog' in k or 'torso' in k or 'me_' in k})
"

# 모듈 분리 검증 — 함수 누락 없는지 grep
for fn in renderM1KPI renderPlayerView v514_renderMechanicTables renderHPAssessment switchTab; do
  echo "$fn: $(grep -c "function $fn" dashboard.html)"
done
# 모두 1이어야 함
```

## 4. v5.26 주요 변경 (이번 대화 누적)

### render.js 모듈 분리 ★

| 새 파일 | 줄 수 | 포함 함수 |
|---|---|---|
| `render_m1.js` | 289 | renderM1KPI, renderProgressGrid, buildM1Table, renderM1Heatmap, renderM1Charts |
| `render_player.js` | 579 | renderPlayerSelect, renderPlayerView (거대) |
| `render_player_cards.js` | 1,134 | v514_moveFitnessCards, v516_renderFitnessHexRadar, v514_renderMechanicTables, v514_renderActionPlan, v514_renderSummaryAction, renderRapsodoFB, renderOutcomeDiagnosis, renderHPAssessment, renderTierOverlay, renderFitnessCards |
| `render_long.js` | 263 | renderRoster, renderScheduleHalves, halfAvg, gradeOf, renderHalfComparison, renderLongTab |
| `render_common.js` | 193 | CHART_PALETTE, chartOpts, switchTab, 이벤트 리스너, genMeasurementsFor |

**합계: 2,458줄 (원본과 정확히 일치)**

### 분리 원칙

- **단순 텍스트 분리**: build_dashboard.js가 모든 JS를 단일 `<script>` 블록에 concat → scope 격리 없음 → `const`/`let` 그대로 보존 OK
- **함수 경계 보존**: 각 분리점은 `}` 직후 + 빈 줄 + 섹션 배너 — 함수 중간 절단 없음
- **백업 보존**: 원본은 `render.js.bak_v5.25`로 보존. 빌드 정상 작동 확인 후 안전하게 삭제 가능

### 검증 결과

- ✅ `node scripts/build_dashboard.js` 정상 실행
- ✅ `dashboard.html` 456,285 bytes (450-500KB 범위 내)
- ✅ 24개 핵심 함수 모두 dashboard.html에 정확히 1회 등장 (누락·중복 0)
- ✅ 10개 전역 변수 (let/const) 모두 1회 등장
- ⚠️ 브라우저 콘솔 에러 — 사용자 확인 필요

## 5. v5.25 변경 (이전 누적, 참조용)

### 메카닉
- `driveline.js` 모듈 신설 — `DRIVELINE_5_MODELS`, `DRIVELINE_HP_6_MODELS`, 진단 함수들
- §3-3 **에너지·파워 카드 NEW** — 분절 KE_rot (De Leva 1996) + 관절 Power Scalar + Drive/Lead Leg 분리
- §3-4 **지면반력 카드 NEW** — FP1 뒷발 / FP2 앞발 %BW + LHEI + 균형형/Lead 우세/Drive 우세 자동 판정
- 시간축 분석: 손/팀평균 제거, 3 분절 (골반/몸통/팔)만, lag 기반 ✅좋음/⚠️보통/❌이상 자동 배지
- CoG 좌표 보정: `COM_displacement_X` → `_Y` (mound 방향). 검증: P01 max_cog_velo 0.21 → **2.76 m/s** (Driveline median 2.84와 일치)
- Trunk_Z 정의 차이 (Theia lab frame vs Driveline mound-relative) — footnote caveat 표기

### 체력
- HP Composite 6축 라디아: Strength / Rel Strength / Power / Rel Power / Reactive Strength / Upper Body Power
- 100점 = HS group 평균 정규화 (Driveline 표준)
- Velo Group cohort 비교표 (`<80` / `80-85` / `85-90` / `90+` mph) 별도 details
- Asymmetry 별도 카드 (IMTP / CMJ / Plyo Push Up, ±15% 임계 점선)

### KPI 일관성
- §1 [4] 메카닉 KPI = Mechanical Ceiling (Driveline)
- §1 [5] 통합 KPI = 체력 향상 + Mechanical Ceiling

## 6. 메모리 reference (영구 저장)

- `~/memory/MEMORY.md` — 인덱스
- `~/memory/reference_driveline_pitching_report.md` — 메카닉 5 모델 (Arm Action / Posture / Rotation / Block / CoG)
- `~/memory/reference_driveline_hp_assessment.md` — HP 6축 + Velo Group cohort

## 7. 다음 대화 작업 후보

### 우선순위 높음
1. ~~**render.js 모듈 분리**~~ ✅ v5.26 완료
2. **render_player_cards.js 추가 세분화** (1,134줄 — 여전히 큼)
   - 후보: `render_card_radar.js` (Driveline 5+6축), `render_card_kinetic.js` (메카닉 표/시간축), `render_card_energy_grf.js` (에너지·파워+지면반력), `render_card_eli_action.js` (ELI 6존+Action Plan), `render_card_hp.js` (HP Assessment+Tier overlay)
   - **주의**: 카드 단위 분리는 함수 경계가 명확하지 않은 부분이 있을 수 있음 — 함수별로만 잘라야 안전
3. **실측 데이터 검증** — 41명 cohort + 4회 측정 들어오면 Velo Group 분포가 맞는지 검증
4. **1차/2차 측정 dual radar overlay** — Driveline HP에서 매우 자연스러운 패턴

### 우선순위 중간
5. **ForceDecks 32컬럼 CSV에 Plyo Push Up 추가 측정** — Upper Body Power 축 자동 채워짐
6. **process_pitching_session.py에 fitness 처리 보강**
7. **PPTX 코치덱 v5.26 재생성** — 새 모듈 구조 반영

### 우선순위 낮음 (장기)
8. **analytics.js 분리** — `velocity_models.js`, `fitness_diag.js`, `mechanic_diag.js`
9. **io.js 분리** — `parser_c3d.js`, `parser_fd.js`, `parser_uplift.js`
10. **render.js.bak_v5.25 삭제** — 충분히 안정 동작 확인 후

## 8. 새 대화 시작 안내 — 한 줄 부트스트랩

새 대화에서 이렇게 시작:

```
프로젝트는 /Users/kikwanglee/Documents/Claude/Projects/상동고 투구 리포트/Dashboard_Pitching_Team/ 입니다.
docs/HANDOFF_v5.26.md를 읽고 작업을 이어가주세요.
[추가로 하고 싶은 작업 한 줄]
```

또는 더 간결하게:

```
HANDOFF_v5.26 읽고 [작업 내용] 해줘.
```

**메모리 자동 로드**: 새 대화 시작 시 `MEMORY.md`가 자동 로드되므로 user role / 프로젝트 컨텍스트 / Driveline reference는 즉시 사용 가능.

## 9. 검증 체크리스트 (대화 종료 전 매번)

- [ ] `node scripts/build_dashboard.js` 정상 실행
- [ ] `dashboard.html` 파일 크기 합리적 (450-500KB 범위)
- [ ] 새 카드 ID grep 확인: `grep -c "id=\"p-NEW-CARD-ID\"" dashboard.html` → 1
- [ ] sample 데이터로 Driveline 진단 점수 합리적 (0-200 범위)
- [ ] 브라우저 콘솔 에러 없는지 (사용자 확인 요청)
- [ ] 모듈 분리 후 핵심 함수 중복/누락 없는지 grep으로 검증

---

**연락처**: kklee@kookmin.ac.kr · 국민대 스포츠과학과 야구 바이오메카닉스
