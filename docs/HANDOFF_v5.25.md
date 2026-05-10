# 상동고 대시보드 v5.25 — Handoff

> **새 대화에서 이 파일부터 읽으세요.** 다음 한 줄로 컨텍스트 복원:
> ```
> Read docs/HANDOFF_v5.25.md
> ```

## 0. 한 줄 요약

상동고 20명 투수 4회 측정 통합 대시보드. **Driveline Pitching Assessment 5축 + Driveline HP Assessment 6축 + 우리식 ELI 누수 분석** 통합. v5.25에서 (1) 에너지·파워 + 지면반력 카드 추가 (2) 시퀀스 차트 정리 (3) `driveline.js` 모듈 분리.

## 1. 현재 dashboard 구조 (5 섹션)

| 섹션 | 카드 | 출처 |
|---|---|---|
| **§1 현재 상태** | 헤더 KPI (실측·체력 향상·메카닉 천장·통합 향상) | OBP fitness model + Driveline ceiling |
| **§2 체력 (HP)** | HP Composite 6축 라디아 + Asymmetry 별도 카드 + Velo Group cohort 비교표 | Driveline HP Assessment |
| **§3 메카닉** | §3-1 Driveline 5축 라디아 · §3-2 시간축 · §3-3 에너지·파워 · §3-4 지면반력 · §3-5 ELI 6 zone · §3-6 Action Plan | Driveline + 우리식 |
| **§4 결과** | 향상 시나리오 비교 | Combined model |
| **§5 종합 권장** | Bigger Lever 진단 | analytics |

## 2. 파일 구조 (v5.25 분리 후)

```
Dashboard_Pitching_Team/
├── src/
│   ├── index.html              (1,028 lines — 5 섹션 골격)
│   ├── style.css
│   └── js/
│       ├── driveline.js        (369 lines) ★ v5.25 NEW — Driveline 5+6축 framework
│       ├── analytics.js        (2,228 lines) — OBP velocity, fitness, mechanic 분석
│       ├── data.js             (403 lines)
│       ├── render.js           (2,458 lines) ⚠ 다음 대화에서 분리 권장
│       ├── io.js               (1,248 lines) — c3d.txt 파서, FD CSV 파서
│       ├── reports_init.js     (452 lines)
│       └── svg_chart_stub.js   (158 lines) — 모바일용
├── scripts/
│   ├── build_dashboard.js      ★ src/ → dashboard.html 합성
│   ├── process_pitching_session.py  (874 lines) — Theia c3d.txt 일괄 처리
│   └── build_coach_deck.js
├── docs/
│   ├── HANDOFF_v5.0.md
│   ├── HANDOFF_v5.25.md  ← 이 파일
│   └── references/
│       ├── Driveline_PitchingAssessment_{EN,KR}_sample.pdf
│       └── Driveline_HP_Assessment_{Initial,Retest}_sample.pdf
└── dashboard.html              (456KB · 빌드 결과물 — 직접 편집 X)
```

**중요: dashboard.html 직접 편집 금지**. 항상 `src/` 편집 후 `node scripts/build_dashboard.js`.

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

# Driveline HP diagnosis 빠른 검증 (브라우저용 — node에서는 const scope 때문에 분리 eval 어려움)
# 가장 확실한 검증: dashboard.html을 브라우저에서 열고 sample 데이터 드래그
```

## 4. v5.25 주요 변경 (이번 대화 누적)

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
- Upper Body Power = 미측정 → Plyo Push Up 측정 추가 시 자동 채워짐

### KPI 일관성
- §1 [4] 메카닉 KPI = Mechanical Ceiling (Driveline)
- §1 [5] 통합 KPI = 체력 향상 + Mechanical Ceiling (일관 통합)
- §5 종합 권장 카드도 Mechanical Ceiling 기반으로 변경

## 5. 메모리 reference (영구 저장)

- `~/memory/MEMORY.md` — 인덱스
- `~/memory/reference_driveline_pitching_report.md` — 메카닉 5 모델 (Arm Action / Posture / Rotation / Block / CoG)
- `~/memory/reference_driveline_hp_assessment.md` — HP 6축 (Strength / Rel Strength / Power / Rel Power / Reactive / Upper Power) + Velo Group cohort

## 6. 다음 대화 작업 후보

### 우선순위 높음
1. **render.js 모듈 분리** (2,458 → ~5개 모듈로) — 가장 risky, 차근차근.
   - 후보 파일: `render_kpi.js`, `render_radar.js`, `render_kinetic.js`, `render_energy_grf.js`, `render_eli_action.js`, `render_fitness.js`
   - **주의**: 함수가 글로벌 scope에 있어야 하므로 `const`/`let` 대신 `function` 또는 `var`로 선언

2. **실측 데이터 검증** — 41명 cohort + 4회 측정 들어오면 Velo Group 분포가 맞는지 검증
3. **1차/2차 측정 dual radar overlay** — Driveline HP에서 매우 자연스러운 패턴 (메모리 reference에 명시)

### 우선순위 중간
4. **ForceDecks 32컬럼 CSV에 Plyo Push Up 추가 측정** — Upper Body Power 축 자동 채워짐
5. **process_pitching_session.py에 fitness 처리 보강** — 현재 부분적
6. **PPTX 코치덱 v5.25 재생성** — Driveline HP 6축 + 에너지·파워 + 지면반력 카드 반영

### 우선순위 낮음 (장기)
7. **analytics.js 추가 분리** — `velocity_models.js` (OBP + KR), `fitness_diag.js`, `mechanic_diag.js`
8. **io.js 분리** — `parser_c3d.js`, `parser_fd.js`, `parser_uplift.js`

## 7. 새 대화 시작 안내 — 한 줄 부트스트랩

새 대화에서 이렇게 시작:

```
프로젝트는 /Users/kikwanglee/Documents/Claude/Projects/상동고 투구 리포트/Dashboard_Pitching_Team/ 입니다.
docs/HANDOFF_v5.25.md를 읽고 작업을 이어가주세요.
[추가로 하고 싶은 작업 한 줄]
```

또는 더 간결하게:

```
HANDOFF_v5.25 읽고 [작업 내용] 해줘.
```

**메모리 자동 로드**: 새 대화 시작 시 `MEMORY.md`가 자동 로드되므로 user role / 프로젝트 컨텍스트 / Driveline reference는 즉시 사용 가능.

## 8. 검증 체크리스트 (대화 종료 전 매번)

- [ ] `node scripts/build_dashboard.js` 정상 실행
- [ ] `dashboard.html` 파일 크기 합리적 (450-500KB 범위)
- [ ] 새 카드 ID grep 확인: `grep -c "id=\"p-NEW-CARD-ID\"" dashboard.html` → 1
- [ ] sample 데이터로 Driveline 진단 점수 합리적 (0-200 범위)
- [ ] 브라우저 콘솔 에러 없는지 (사용자 확인 요청)

---

**연락처**: kklee@kookmin.ac.kr · 국민대 스포츠과학과 야구 바이오메카닉스
